// A1545: printable safeguarding sheet on pages/teachers.html, linked from pages/parents.html.
// Verifies the sheet exists, Lumo character presence, the print wiring isolates just the
// sheet (it must be a direct child of the scope section), no horizontal overflow at
// 390/1440, and the parents page links to it.
//
// Run: node tests/teachers-safeguarding.js
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
      hasSheet: !!document.getElementById('safeguarding-sheet'),
      hasSection: !!document.getElementById('safeguarding'),
      button: !!document.querySelector('#safeguarding button.tp-print-plan[data-plan="safeguarding-sheet"][data-scope="#safeguarding"]'),
      lumo: /Lumo says/.test((document.getElementById('safeguarding-sheet') || {}).textContent || ''),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('teachers: safeguarding sheet present', info.hasSheet);
    check('teachers: safeguarding section present', info.hasSection);
    check('teachers: print button wired to the sheet', info.button);
    check('teachers: Lumo character presence', info.lumo);
    check('teachers: no horizontal overflow @1440', info.overflow <= 1, 'overflow=' + info.overflow);

    await t.evaluate(() => { window.print = function () {}; });
    await t.click('#safeguarding button.tp-print-plan');
    await new Promise(r => setTimeout(r, 150));
    const pr = await t.evaluate(() => ({
      bodyPlan: document.body.classList.contains('tp-print-plan'),
      scope: document.getElementById('safeguarding').classList.contains('tp-print-scope'),
      thisEl: document.getElementById('safeguarding-sheet').classList.contains('tp-print-this'),
      direct: document.getElementById('safeguarding-sheet').parentElement === document.getElementById('safeguarding')
    }));
    check('print: body.tp-print-plan applied', pr.bodyPlan);
    check('print: scope class applied', pr.scope);
    check('print: sheet gets tp-print-this', pr.thisEl);
    check('print: sheet is direct child of scope (prints alone)', pr.direct);

    await t.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 300));
    const o390 = await t.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('teachers: no horizontal overflow @390', o390 <= 1, 'overflow=' + o390);
    await t.close();

    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(base + '/pages/parents.html', { waitUntil: 'load', timeout: 25000 });
    await new Promise(r => setTimeout(r, 300));
    const pl = await p.evaluate(() => ({
      link: !!document.querySelector('a[href="/teachers#safeguarding"]'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('parents: page links to /teachers#safeguarding', pl.link);
    check('parents: no horizontal overflow @1440', pl.overflow <= 1, 'overflow=' + pl.overflow);
    await p.close();
  } finally { await browser.close(); server.close(); }

  console.log('\n' + (failures ? 'FAILED ' + failures : 'ALL SAFEGUARDING CHECKS PASSED'));
  process.exit(failures ? 1 : 0);
})();
