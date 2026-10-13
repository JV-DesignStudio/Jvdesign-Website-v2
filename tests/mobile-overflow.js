// Mobile horizontal-overflow regression guard (A1496).
//
// The site-wide mobile sweep found two pages that scrolled sideways at 390px:
// the 3D Builders hub (196px, its breadcrumb nav could not shrink) and the
// Call of the Cards rules page (59px, an unbreakable URL). This pins both at
// 390 and 320 so the fix cannot silently regress.
//
// Run: node tests/mobile-overflow.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml' };

const PAGES = ['pages/3d-builders.html', 'call-of-the-cards-rules.html'];
const VIEWPORTS = [{ w: 390, h: 844 }, { w: 320, h: 568 }];

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
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const rel of PAGES) for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 25000 });
      await new Promise(r => setTimeout(r, 300));
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        const cw = doc.clientWidth;
        const clipped = el => { let p = el.parentElement; while (p) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return true; p = p.parentElement; } return false; };
        const off = [];
        for (const e of document.querySelectorAll('body *')) {
          const r = e.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          const cs = getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (r.right > cw + 1 && !clipped(e)) off.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''));
        }
        return { overflow: doc.scrollWidth - cw, offenders: off.slice(0, 3) };
      });
      check(`${rel} @ ${vp.w}px: no horizontal overflow`, m.overflow <= 1, `overflow=${m.overflow}${m.offenders.length ? ' offenders: ' + m.offenders.join(', ') : ''}`);
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL MOBILE OVERFLOW CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
