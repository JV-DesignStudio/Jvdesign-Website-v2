#!/usr/bin/env node
/*
 * tests/stardust-collection-smoke.js , A586
 *
 * Stardust Constellation Rescue is one map now: restore the Lantern of Lyra,
 * see the restored ending, or get the kind lantern-dark ending that still
 * shows the order. The 5-map ladder and practice-mode dodge are gone. This
 * plays the falling-symbol loop through the real input (pointer chasing the
 * highlighted symbol) until an ending appears, then plays again.
 *
 * Run: node tests/stardust-collection-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.SR_PORT || 8154);
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : ''));
  if (!cond) failures++;
};

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const SNAP = () => ({
  level: document.getElementById('level').textContent,
  mission: document.getElementById('missionName').textContent,
  overlayOff: document.getElementById('overlay').classList.contains('off'),
  overlayTitle: document.querySelector('#overlay h2').textContent,
  overlayText: document.querySelector('#overlay p').textContent,
  lives: document.getElementById('lives').textContent,
});

// where the ship should go: center-x of the lowest expected falling target
const TARGET_X = () => {
  const next = document.querySelector('#pattern .glyph.next');
  if (!next) return null;
  const want = next.textContent;
  const field = document.getElementById('playfield').getBoundingClientRect();
  let bestX = null, bestY = -1;
  document.querySelectorAll('#playfield .falling.target').forEach(el => {
    if (el.textContent !== want) return;
    const r = el.getBoundingClientRect();
    if (r.top > bestY) { bestY = r.top; bestX = r.left + r.width / 2 - field.left; }
  });
  return bestX === null ? null : { x: bestX, fieldLeft: field.left, fieldTop: field.top, fieldWidth: field.width };
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/stardust_collection.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#startBtn', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': one map on the board, not a ladder of 5', start.level === '1/1', start.level);
      ok(vp.name + ': tonight is the Lantern of Lyra', start.mission === 'Lantern of Lyra', start.mission);
      ok(vp.name + ': no practice-mode dodge on the start card', await page.evaluate(() => !document.getElementById('practiceBtn')));

      await page.evaluate(() => document.getElementById('startBtn').click());
      await new Promise(r => setTimeout(r, 500));

      // chase the highlighted symbol until an ending appears
      let ending = null;
      const deadline = Date.now() + 150000;
      while (Date.now() < deadline) {
        const s = await page.evaluate(SNAP);
        if (!s.overlayOff) { ending = s; break; }
        const t = await page.evaluate(TARGET_X);
        const fieldBox = await page.evaluate(() => {
          const r = document.getElementById('playfield').getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width };
        });
        if (t) await page.mouse.move(fieldBox.x + t.x, fieldBox.y + 400, { steps: 2 });
        else await page.mouse.move(fieldBox.x + fieldBox.w / 2, fieldBox.y + 400, { steps: 2 });
        await new Promise(r => setTimeout(r, 70));
      }
      ending = ending || await page.evaluate(SNAP);
      ok(vp.name + ': the rescue reaches a visible ending', ending && ending.overlayOff === false, ending && ending.overlayTitle);
      ok(vp.name + ': the ending restores the lantern or kindly shows its order',
        /lantern of lyra restored|lantern went dark/i.test(ending.overlayTitle) && /✦/.test(ending.overlayText),
        ending.overlayTitle);

      // play again restarts the same single map
      await page.evaluate(() => document.getElementById('startBtn').click());
      await new Promise(r => setTimeout(r, 500));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': playing again restarts the same Lantern rescue',
        replay.overlayOff === true && replay.level === '1/1' && replay.mission === 'Lantern of Lyra',
        JSON.stringify({ level: replay.level, mission: replay.mission }));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    const html = fs.readFileSync(path.join(ROOT, 'games', 'stardust_collection.html'), 'utf8');
    ok('no map ladder left in the page', !/Compass of Orion|Crown of Cassiopeia|Dragon Trail|Jubilee Star Gate/.test(html));
    ok('no practice mode left in the page', !/practiceBtn|isPractice/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nStardust Collection run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
