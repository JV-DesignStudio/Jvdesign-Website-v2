// A3002: optional Mission 2. Adds a walk frame, saves a named player/enemy/coin
// set into My Creations, remembers completion and can be skipped.
// Run: node tests/pixel-studio-mission-2.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_MISSION2_PORT || 19304);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
const listen = () => new Promise((resolve) => server.listen(port, resolve));

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function makePage(browser, errors) {
  return browser.newPage().then(async (page) => {
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const t = m.text();
        if (!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ServiceWorker|sw\.js|is\.gd|The operation was aborted/i.test(t)) errors.push('console: ' + t);
      }
    });
    return page;
  });
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ---- 390 -------------------------------------------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof window.showMission2==="function"', { timeout: 20000 });

    const out = await page.evaluate(() => {
      applyProject({ v: 3, cW: 16, cH: 16, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[new Uint8ClampedArray(16 * 16 * 4)]] });
      saveProject();
      showMission2();
      const bar = document.getElementById('mission2-bar');
      const visible = !bar.hidden && getComputedStyle(bar).display !== 'none';
      mission2Walk();
      const framesAfter = frames.length;
      mission2Save('player'); mission2Save('enemy'); mission2Save('coin');
      const gal = JSON.parse(localStorage.getItem('jvds_pixel_keepsake') || '[]');
      const st = JSON.parse(localStorage.getItem('jvds_pixel_mission2') || '{}');
      showMission2();
      const hiddenAfter = document.getElementById('mission2-bar').hidden;
      return {
        visible,
        framesAfter,
        titles: gal.map(g => g.title),
        done: st.done === true,
        hiddenAfter
      };
    });

    check('390: Mission 2 appears after a first save', out.visible);
    check('390: the walk step adds a second frame', out.framesAfter >= 2, String(out.framesAfter));
    check('390: the set saves Player, Enemy and Coin', ['Player', 'Enemy', 'Coin'].every(n => out.titles.includes(n)), JSON.stringify(out.titles));
    check('390: finishing remembers completion and hides the bar', out.done && out.hiddenAfter, JSON.stringify({ done: out.done, hidden: out.hiddenAfter }));

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('typeof window.showMission2==="function"', { timeout: 20000 });
    const afterReload = await page.evaluate(() => { showMission2(); return { hidden: document.getElementById('mission2-bar').hidden, done: (JSON.parse(localStorage.getItem('jvds_pixel_mission2') || '{}')).done }; });
    check('390: completion survives a refresh', afterReload.hidden === true && afterReload.done === true, JSON.stringify(afterReload));

    const skipped = await page.evaluate(() => {
      localStorage.removeItem('jvds_pixel_mission2');
      showMission2();
      const before = !document.getElementById('mission2-bar').hidden;
      mission2Skip();
      const st = JSON.parse(localStorage.getItem('jvds_pixel_mission2') || '{}');
      return { before, after: document.getElementById('mission2-bar').hidden, skipped: st.skipped === true };
    });
    check('390: Skip hides Mission 2 and is remembered', skipped.before && skipped.after && skipped.skipped, JSON.stringify(skipped));

    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('390 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 390', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- 1440 ------------------------------------------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof window.showMission2==="function"', { timeout: 20000 });
    const out = await page.evaluate(() => {
      try { localStorage.removeItem('jvds_pixel_mission2'); localStorage.removeItem('jvds_pixel_keepsake'); } catch (e) {}
      applyProject({ v: 3, cW: 16, cH: 16, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[new Uint8ClampedArray(16 * 16 * 4)]] });
      saveProject(); showMission2();
      return { visible: !document.getElementById('mission2-bar').hidden };
    });
    check('1440: Mission 2 opens on desktop too', out.visible);
    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('1440 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 1440', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PIXEL STUDIO MISSION 2 CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
