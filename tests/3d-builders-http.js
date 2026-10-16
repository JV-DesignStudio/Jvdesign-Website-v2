// A1581: the 3D Builders hub (pages/3d-builders.html).
// Checks the cards are well-formed (every anchor closed, no nesting), every
// builder link resolves, the type filter + search narrow the grid, and there is
// no horizontal overflow at 390/1440.
//
// Run: node tests/3d-builders-http.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = '/pages/3d-builders.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(ROOT, clean);
  if (!path.extname(p)) p = path.join(ROOT, 'pages', clean.replace(/^\//, '') + '.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' , ' + extra : '')); if (!ok) failures++; };
const visibleCards = (page) => page.evaluate(() =>
  document.querySelectorAll('.builders-grid > .bcard:not([hidden])').length);

(async () => {
  // raw-markup checks (a nesting bug that the HTML parser would silently fix)
  const raw = fs.readFileSync(path.join(ROOT, 'pages', '3d-builders.html'), 'utf8');
  const opens = (raw.match(/<a[\s>]/g) || []).length;
  const closes = (raw.match(/<\/a>/g) || []).length;
  check('every anchor is closed', opens === closes, opens + ' open vs ' + closes + ' close');
  check('14 builder cards in source', (raw.match(/class="bcard"/g) || []).length === 14);

  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + PAGE, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('.builders-grid > .bcard');

    const total = await page.evaluate(() => document.querySelectorAll('.builders-grid > .bcard').length);
    check('14 cards render', total === 14, 'cards=' + total);
    check('no card nests another card', await page.evaluate(() =>
      document.querySelectorAll('.bcard .bcard, a.bcard a').length) === 0);

    // every builder href resolves to a real file
    const hrefs = await page.evaluate(() => [].slice.call(document.querySelectorAll('a.bcard'))
      .map(a => a.getAttribute('href')));
    const missing = hrefs.filter(h => {
      const rel = h.replace(/^\.\.\//, '').replace(/^\//, '');
      return !fs.existsSync(path.join(ROOT, rel));
    });
    check('every builder link resolves', missing.length === 0, missing.join(', '));

    check('filter shows all by default', await visibleCards(page) === 14);
    await page.click('#bf-chips .bf-chip[data-type="vehicles"]');
    await new Promise(r => setTimeout(r, 60));
    check('Vehicles filter narrows to 4', await visibleCards(page) === 4);
    await page.click('#bf-chips .bf-chip[data-type="all"]');
    await page.type('#bf-q', 'rocket');
    await new Promise(r => setTimeout(r, 60));
    check('search "rocket" narrows to 1', await visibleCards(page) === 1);
    await page.evaluate(() => {
      const q = document.getElementById('bf-q');
      q.value = ''; q.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 60));
    check('clearing search restores all', await visibleCards(page) === 14);
    check('count readout updates', await page.evaluate(() => {
      const q = document.getElementById('bf-q');
      q.value = 'zzz'; q.dispatchEvent(new Event('input'));
      const t = document.getElementById('bf-count').textContent;
      q.value = ''; q.dispatchEvent(new Event('input'));
      return /0 of 14/.test(t);
    }));

    for (const w of [390, 1440]) {
      await page.setViewport({ width: w, height: 900, isMobile: w === 390, hasTouch: w === 390 });
      await new Promise(r => setTimeout(r, 150));
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check('no horizontal overflow @' + w, ov <= 1, 'overflow=' + ov);
    }
    await page.close();
  } finally { await browser.close(); server.close(); }

  console.log('\n' + (failures ? 'FAILED ' + failures : 'ALL 3D-BUILDERS HUB CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})();
