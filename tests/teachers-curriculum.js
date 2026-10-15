// A1544: printable KS2/KS3 curriculum map on pages/teachers.html.
// Verifies the map exists with 12+ mapped workshops, Lumo presence, the print
// wiring isolates just the map (direct child of the scope section), and no
// horizontal page overflow at 390/1440 (the wide table scrolls inside its wrapper).
//
// Run: node tests/teachers-curriculum.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
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

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const t = await browser.newPage();
    await t.setViewport({ width: 1440, height: 900 });
    await t.goto(base + '/pages/teachers.html', { waitUntil: 'load', timeout: 25000 });
    await new Promise(r => setTimeout(r, 400));
    const info = await t.evaluate(() => ({
      section: !!document.getElementById('tp-curriculum'),
      sheet: !!document.getElementById('curriculum-sheet'),
      rows: document.querySelectorAll('#tp-curriculum table.curriculum-table tbody tr').length,
      button: !!document.querySelector('#tp-curriculum button.tp-print-plan[data-plan="curriculum-sheet"][data-scope="#tp-curriculum"]'),
      lumo: /Lumo says/.test((document.getElementById('curriculum-sheet') || {}).textContent || ''),
      direct: document.getElementById('curriculum-sheet').parentElement === document.getElementById('tp-curriculum'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('curriculum map section present', info.section);
    check('map sheet present', info.sheet);
    check('at least 12 mapped workshops', info.rows >= 12, 'rows=' + info.rows);
    check('print button wired to the map', info.button);
    check('Lumo character presence', info.lumo);
    check('map sheet is a direct child of the scope (prints alone)', info.direct);
    check('no horizontal overflow @1440', info.overflow <= 1, 'overflow=' + info.overflow);

    await t.evaluate(() => { window.print = function () {}; });
    await t.click('#tp-curriculum button.tp-print-plan');
    await new Promise(r => setTimeout(r, 150));
    const pr = await t.evaluate(() => ({
      plan: document.body.classList.contains('tp-print-plan'),
      thisEl: document.getElementById('curriculum-sheet').classList.contains('tp-print-this')
    }));
    check('print: body.tp-print-plan applied', pr.plan);
    check('print: map gets tp-print-this', pr.thisEl);

    await t.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 300));
    const o390 = await t.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('no page overflow @390 (table scrolls inside its wrapper)', o390 <= 1, 'overflow=' + o390);
    await t.close();
  } finally { await browser.close(); server.close(); }

  console.log('\n' + (failures ? 'FAILED ' + failures : 'ALL CURRICULUM CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})();
