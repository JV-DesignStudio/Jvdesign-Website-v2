#!/usr/bin/env node
/*
 * tests/pixel-studio-floating-share.js
 * A2804: the big floating Share button sends the creation, not an empty tool URL.
 *   - with nothing drawn it falls back to the tool link
 *   - with a sprite drawn it shares the #art= creation link
 *   - the share still carries the Make your own text and fires jvds:shared
 * Run: node tests/pixel-studio-floating-share.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PSFLOAT_PORT || 8154;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const TOOL_URL = 'https://jvdesignstudio.co.uk/tools/pixel-studio.html';

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.evaluateOnNewDocument(() => {
    window.__shared = null;
    window.__sharedEvent = false;
    window.addEventListener('jvds:shared', () => { window.__sharedEvent = true; });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: function (d) { window.__shared = d; return Promise.resolve(); }
    });
  });
  await page.setViewport({ width: 1440, height: 900 });

  async function clickShare() {
    await page.evaluate(() => document.getElementById('jvds-share-btn').click());
    await page.waitForSelector('#jvds-share-warn', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('.jvds-share-warn-go').click());
    await new Promise(r => setTimeout(r, 250));
    return page.evaluate(() => ({ shared: window.__shared, event: window.__sharedEvent }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('jvds_pixel_seen', '1'); } catch (e) {} });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));

    // Nothing drawn: the floating share falls back to the tool URL.
    const empty = await clickShare();
    check('empty canvas shares the tool link', empty.shared && empty.shared.url === TOOL_URL, empty.shared && empty.shared.url);
    check('the fallback still fires jvds:shared', empty.event === true, '');

    // Draw: the floating share now carries the creation.
    const link = await page.evaluate(() => {
      setCanvasSize(8, 8, false);
      frames = [[new ImageData(8, 8)]];
      setPixel(getID(), 1, 1, 255, 0, 0, 255);
      renderAll();
      return pixelShareLink();
    });
    const drawn = await clickShare();
    check('a drawn sprite shares the creation link', drawn.shared && drawn.shared.url === link, drawn.shared && drawn.shared.url);
    check('the share still points home to make your own', drawn.shared && /Make your own/i.test(drawn.shared.text) && /jvdesignstudio\.co\.uk\/tools\//.test(drawn.shared.text), drawn.shared && drawn.shared.text);
    check('the creation link carries #art=', /#art=/.test((drawn.shared && drawn.shared.url) || ''), '');
    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? 'FAILURES PRESENT (' + failures + ')' : 'ALL FLOATING SHARE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
