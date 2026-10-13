// Copy-chip tap-target guard (A1499).
//
// tools/code-snippet-generator.html and tools/colour-palettes.html had copy /
// option chips under 40px at 390px (Copy, Reset, language select, Copy all,
// swatch copy buttons) plus the shared creation-keepsake "Export to keep"
// button. This pins them at 40px+.
//
// Measurement uses offsetWidth/offsetHeight (unaffected by CSS 3D transforms).
// Run: node tests/tools-copy-touch.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };

const PAGES = ['tools/code-snippet-generator.html', 'tools/colour-palettes.html'];

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
    for (const rel of PAGES) {
      const page = await browser.newPage();
      page.on('pageerror', () => {});
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 25000 });
      await new Promise(r => setTimeout(r, 400));
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        const main = document.querySelector('main') || document.body;
        const vis = el => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width >= 1 && r.height >= 1 && st.display !== 'none' && st.visibility !== 'hidden' && st.pointerEvents !== 'none'; };
        const small = [];
        for (const el of main.querySelectorAll('a,button,[role="button"],input,select,[tabindex]')) {
          if (!vis(el)) continue;
          const r = el.getBoundingClientRect();
          const w = el.offsetWidth || r.width, h = el.offsetHeight || r.height;
          if (el.matches('button,.btn,[role="button"],input[type="submit"],select') && Math.min(w, h) < 40) {
            small.push((el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : (el.id || el.tagName)) + ':' + Math.min(w, h));
          }
        }
        return { overflow: doc.scrollWidth - doc.clientWidth, smallCount: small.length, small: small.slice(0, 5) };
      });
      check(`${rel} @ 390: no sub-40px tap target`, m.smallCount === 0, `small=${m.smallCount}${m.small.length ? ' ' + m.small.join(', ') : ''}`);
      check(`${rel} @ 390: no horizontal overflow`, m.overflow <= 1, `overflow=${m.overflow}`);
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL COPY-CHIP TOUCH CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
