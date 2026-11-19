// workshop-recommend-http.js - A2620 runtime check
// Loads a real workshop page, waits for the recommender and checks it shows
// three different local workshops, never the current page, and never appears on
// the hub. Run: node tests/workshop-recommend-http.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.url().startsWith(base) || /^data:|^blob:/.test(r.url())) return r.continue();
      return r.abort();
    });

    await page.goto(base + '/workshops/scratch-catch-workshop.html', { waitUntil: 'load' });
    await page.waitForSelector('.ws-rec', { timeout: 8000 }).catch(() => {});
    const cards = await page.$$eval('.ws-rec .ws-rec-card', (els) => els.map((a) => ({
      href: a.getAttribute('href'),
      name: (a.querySelector('.ws-rec-name') || {}).textContent,
      meta: (a.querySelector('.ws-rec-meta') || {}).textContent
    })));

    check('recommender appears on a workshop page', cards.length > 0);
    check('recommender shows three cards', cards.length === 3, 'got ' + cards.length);
    check('no card points at the current page', cards.every((c) => !/scratch-catch-workshop/.test(c.href || '')));
    check('every card links to a real workshop file', cards.every((c) => {
      if (!/^\/workshops\/[^/]+\.html$/.test(c.href || '')) return false;
      return fs.existsSync(path.join(root, c.href.replace(/^\//, '')));
    }), cards.map((c) => c.href).join(', '));
    check('cards show a duration', cards.every((c) => /~\d+ min/.test(c.meta || '')), cards.map((c) => c.meta).join(' | '));

    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 900 });
      await new Promise((r) => setTimeout(r, 150));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
      check('no horizontal overflow at ' + width + 'px', overflow <= width, 'scrollWidth ' + overflow);
      const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.ws-rec-grid')).gridTemplateColumns.split(' ').length);
      if (width === 390) check('cards stack in one column on mobile', cols === 1, 'columns ' + cols);
    }

    await page.goto(base + '/pages/workshop.html', { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 600));
    const onHub = await page.$('.ws-rec');
    check('recommender stays off the catalogue hub', !onHub);

    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\nFAIL workshop-recommend-http: ' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nPASS workshop-recommend-http: three contextual next steps render on a real workshop page');
})().catch((e) => { console.error(e); process.exitCode = 1; });
