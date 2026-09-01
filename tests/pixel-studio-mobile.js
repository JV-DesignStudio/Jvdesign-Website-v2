// Mobile touch regression tests for Pixel Studio.
// Simulates a phone (390x744, touch) and drives real touch events via CDP.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; };

(async () => {
  await new Promise(r => server.listen(8127, r));
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
    defaultViewport: { width: 390, height: 744, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://127.0.0.1:8127/tools/pixel-studio.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));

  const client = await page.target().createCDPSession();
  const touch = async (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: Number(p.x), y: Number(p.y) })) });
  const tapAt = async (x, y) => {
    await touch('touchStart', [{ x, y }]);
    await touch('touchEnd', []);
  };
  const stroke = async (x1, y1, x2, y2) => {
    await touch('touchStart', [{ x: x1, y: y1 }]);
    await touch('touchMove', [{ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }]);
    await touch('touchMove', [{ x: x2, y: y2 }]);
    await touch('touchEnd', []);
  };

  // 1. THE regression: tapping a bottom-bar tab must switch panels
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.bb-tab')].map(b => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  await tapAt(tabs[1].x, tabs[1].y);
  await new Promise(r => setTimeout(r, 150));
  ok('tap: Colour tab switches panel', await page.evaluate(() => document.getElementById('bb1').classList.contains('on')));

  // 2. Tap a palette swatch → fg colour changes (was dead before the fix)
  const sw = await page.evaluate(() => { const s = document.querySelectorAll('#bbPal .bb-sw')[5]; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, col: s.dataset.col }; });
  await tapAt(sw.x, sw.y);
  await new Promise(r => setTimeout(r, 150));
  ok('tap: palette swatch sets fg colour', await page.evaluate(col => fgColour === col, sw.col));

  // 3. Switch back to Tools tab, then tap a tool tile
  await tapAt(tabs[0].x, tabs[0].y);
  await new Promise(r => setTimeout(r, 150));
  const tool = await page.evaluate(() => { const t = document.querySelector('#bbTools .bb-tb:nth-child(2)'); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, tool: t.dataset.tool }; });
  await tapAt(tool.x, tool.y);
  await new Promise(r => setTimeout(r, 150));
  ok('tap: tool tile switches tool (' + tool.tool + ')', await page.evaluate(t => currentTool === t, tool.tool));

  // 4. Touch-draw a stroke on the canvas
  const c = await page.evaluate(() => { const r = document.getElementById('main-canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.evaluate(() => setTool('pencil'));
  const before = await page.evaluate(() => frames[0][0] ? frames[0][0].data.filter((v, i) => i % 4 === 3 && v > 0).length : 0);
  await stroke(c.x + c.w / 2, c.y + c.h / 2, c.x + c.w / 2 + 40, c.y + c.h / 2 + 20);
  const after = await page.evaluate(() => frames[0][0].data.filter((v, i) => i % 4 === 3 && v > 0).length);
  ok('touch-draw: stroke paints pixels (' + before + '→' + after + ')', after > before);

  // 5. Tap the undo button in the bottom bar (was dead before fix; Tools tab is active)
  const undoBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#bb0 .z-btn')].find(b => b.textContent === '↶'); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await tapAt(undoBtn.x, undoBtn.y);
  await new Promise(r => setTimeout(r, 150));
  const undone = await page.evaluate(() => frames[0][0].data.filter((v, i) => i % 4 === 3 && v > 0).length);
  ok('tap: bottom-bar Undo works', undone === before);

  // 6. Pinch-zoom: spread two fingers → zoom increases
  const z0 = await page.evaluate(() => zoomLevel);
  await touch('touchStart', [{ x: c.x + 60, y: c.y + 60 }, { x: c.x + c.w - 60, y: c.y + c.h - 60 }]);
  await touch('touchMove', [{ x: c.x + 20, y: c.y + 20 }, { x: c.x + c.w - 20, y: c.y + c.h - 20 }]);
  await touch('touchEnd', []);
  await new Promise(r => setTimeout(r, 150));
  const z1 = await page.evaluate(() => zoomLevel);
  ok('pinch: zoom increases (' + z0 + '×→' + z1 + '×)', z1 > z0);

  // 7. Pinch-in then single-finger draw must NOT paint (stroke cancelled)
  // Re-measure canvas rect: pinch in test 6 resized/re-centred it
  const c7 = await page.evaluate(() => { const r = document.getElementById('main-canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const before7 = await page.evaluate(() => frames[0][0].data.filter((v, i) => i % 4 === 3 && v > 0).length);
  await touch('touchStart', [{ x: c7.x + 80, y: c7.y + 80 }, { x: c7.x + 140, y: c7.y + 140 }]);
  await touch('touchMove', [{ x: c7.x + 70, y: c7.y + 70 }, { x: c7.x + 160, y: c7.y + 160 }]);
  await touch('touchEnd', [{ x: c7.x + 70, y: c7.y + 70 }]); // one finger lifts
  await touch('touchEnd', []); // second lifts
  const after7 = await page.evaluate(() => frames[0][0].data.filter((v, i) => i % 4 === 3 && v > 0).length);
  ok('pinch: no accidental paint during pinch (' + before7 + '→' + after7 + ')', after7 === before7);

  // 8. Palette strip is horizontally scrollable (touch-action fix) — Colour tab active
  await tapAt(tabs[1].x, tabs[1].y);
  await new Promise(r => setTimeout(r, 150));
  const scrollable = await page.evaluate(() => {
    const el = document.getElementById('bbPal');
    return el.scrollWidth > el.clientWidth && getComputedStyle(el).touchAction === 'pan-x';
  });
  ok('scroll: mobile palette strip scrollable (touch-action:pan-x)', scrollable);

  // 9. Tap the mobile play button (bb2 panel)
  const tabs2 = await page.evaluate(() => [...document.querySelectorAll('.bb-tab')].map(b => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  await tapAt(tabs2[2].x, tabs2[2].y);
  await new Promise(r => setTimeout(r, 150));
  const playBtn = await page.evaluate(() => { const b = document.querySelector('#bb2 .play-btn'); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await tapAt(playBtn.x, playBtn.y);
  await new Promise(r => setTimeout(r, 150));
  ok('tap: mobile play button toggles playback', await page.evaluate(() => isPlaying === true));
  await tapAt(playBtn.x, playBtn.y); // stop
  await new Promise(r => setTimeout(r, 150));

  // 10. Tap outside canvas (header area) does not paint or error
  await stroke(10, 60, 30, 70);
  ok('tap: touch on header is harmless', errors.filter(e => e.includes('pageerror')).length === 0);

  console.log('');
  if (errors.length) {
    console.log('RUNTIME ERRORS:');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  } else {
    console.log('No runtime errors.');
  }
  console.log(failures === 0 && errors.length === 0 ? '\nALL MOBILE CHECKS PASSED' : '\n' + failures + ' FAILURES, ' + errors.length + ' errors');
  await browser.close();
  server.close();
  process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
