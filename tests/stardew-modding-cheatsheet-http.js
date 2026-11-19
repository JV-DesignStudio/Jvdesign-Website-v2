// stardew-modding-cheatsheet-http.js
// Page test for workshops/stardew-modding-cheatsheet.html: it loads, carries the
// workshop kit switcher and three remix prompts, and does not overflow.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const PAGE = '/workshops/stardew-modding-cheatsheet.html';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      await page.setViewport({ width, height: 900 });
      const resp = await page.goto(base + PAGE, { waitUntil: 'load', timeout: 30000 }).catch(() => null);
      check('status 200 @' + width, resp && resp.status() === 200, 'status ' + (resp && resp.status()));
      await page.waitForSelector('.ws-kit', { timeout: 8000 }).catch(() => {});
      const info = await page.evaluate(() => ({
        title: document.title,
        kit: !!document.querySelector('.ws-kit'),
        tabs: [...document.querySelectorAll('.ws-kit-tab')].map((b) => b.dataset.track),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check('page title names Stardew @' + width, /stardew/i.test(info.title), info.title);
      check('workshop kit switcher present @' + width, info.kit);
      check('make-it-yours track present @' + width, info.tabs.includes('remix'), info.tabs.join(','));
      if (info.kit) {
        await page.evaluate(() => document.querySelector('.ws-kit-tab[data-track="remix"]').click());
        const cards = await page.$$eval('.ws-kit-remix .ws-kit-card', (els) => els.length);
        check('three remix prompts @' + width, cards === 3, 'got ' + cards);
      }
      check('no horizontal overflow @' + width, info.overflow <= 2, info.overflow + 'px');
      check('no page errors @' + width, errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILED for ' + PAGE); process.exit(1); }
  console.log('\nPASS: ' + PAGE + ' loads with the workshop kit');
})().catch((e) => { console.error(e); process.exitCode = 1; });
