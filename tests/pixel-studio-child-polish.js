// A3004: child-friendly polish. A big phone Oops, Advanced collapsed on phones,
// and colour-blind swatch labels with a stronger outline.
// Run: node tests/pixel-studio-child-polish.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_POLISH_PORT || 19303);
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
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof toggleColourBlind==="function"', { timeout: 20000 });

    const phone = await page.evaluate(() => {
      const oops = document.getElementById('oopsBtn');
      const r = oops.getBoundingClientRect();
      const shown = getComputedStyle(oops).display !== 'none' && r.height > 0;
      const advanced = document.getElementById('advancedTools');
      const canvas = document.getElementById('canvas-area').getBoundingClientRect();
      pushUndo();
      const id = getID();
      id.data[3] = 255;
      renderAll();
      const before = id.data[3];
      undo();
      const after = getID().data[3];
      toggleColourBlind();
      const labels = document.querySelectorAll('#palette .cb-label').length;
      const named = Array.from(document.querySelectorAll('#palette .cb-label')).some(l => /red|orange|yellow|green|teal|blue|purple|pink|white|black|grey/i.test(l.textContent));
      const outline = getComputedStyle(document.querySelector('#palette .sw')).outlineWidth;
      const classOn = document.documentElement.classList.contains('ps-colourblind');
      toggleColourBlind();
      const off = document.querySelectorAll('#palette .cb-label').length === 0 && !document.documentElement.classList.contains('ps-colourblind');
      return { shown, h: Math.round(r.height), advancedOpen: advanced.open, canvasH: Math.round(canvas.height), before, after, labels, named, outline, classOn, off };
    });

    check('390: the Oops button is visible and large', phone.shown && phone.h >= 40, JSON.stringify({ shown: phone.shown, h: phone.h }));
    check('390: Oops undoes the last change', phone.before === 255 && phone.after === 0, `${phone.before}/${phone.after}`);
    check('390: Advanced starts collapsed on a phone', phone.advancedOpen === false);
    check('390: the canvas still has room on the first screen', phone.canvasH > 120, String(phone.canvasH));
    check('390: colour-blind labels name the swatches', phone.classOn && phone.labels > 0 && phone.named && phone.outline === '2px', JSON.stringify({ labels: phone.labels, named: phone.named, outline: phone.outline }));
    check('390: colour-blind mode can be turned off', phone.off);

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
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof toggleColourBlind==="function"', { timeout: 20000 });
    const out = await page.evaluate(() => {
      const oops = getComputedStyle(document.getElementById('oopsBtn')).display;
      toggleColourBlind();
      const labels = document.querySelectorAll('#palette .cb-label').length;
      const classOn = document.documentElement.classList.contains('ps-colourblind');
      toggleColourBlind();
      const advanced = document.getElementById('advancedTools');
      advanced.open = true;
      return { oops, labels, classOn, advancedOpen: advanced.open };
    });
    check('1440: Oops is phone-only', out.oops === 'none');
    check('1440: colour-blind labels still work', out.classOn && out.labels > 0, String(out.labels));
    check('1440: Advanced can still be opened', out.advancedOpen === true);
    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('1440 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 1440', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PIXEL STUDIO CHILD POLISH CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
