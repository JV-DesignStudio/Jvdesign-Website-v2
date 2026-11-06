const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ w: 390, h: 844, label: '390x844' }, { w: 1440, h: 900, label: '1440x900' }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w <= 480, hasTouch: vp.w <= 480, deviceScaleFactor: 1 });
      await page.goto(base + '/pages/contact.html', { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 400));
      const m = await page.evaluate(() => ({
        h1: (document.querySelector('h1') || {}).textContent || '',
        hasForm: !!document.querySelector('form'),
        hasEmail: !!document.querySelector('a[href^="mailto:"]') || !!document.querySelector('[data-mailto]'),
        hasA11y: !!document.querySelector('a[href$="accessibility-statement.html"], a[href$="accessibility-statement"]'),
        overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
      }));
      check(`${vp.label}: contact page has one clear H1`, m.h1.trim().length > 5, m.h1.trim());
      check(`${vp.label}: contact route and form are present`, m.hasForm && m.hasEmail);
      check(`${vp.label}: footer links to the accessibility statement`, m.hasA11y);
      check(`${vp.label}: no horizontal overflow`, m.overflow <= 1, 'overflow=' + m.overflow);
      check(`${vp.label}: no page errors`, errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nCONTACT PAGE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
