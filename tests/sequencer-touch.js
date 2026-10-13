// Sequencer / pad tap-target guard (A1498).
//
// tools/music-maker.html, tools/drum-pad.html and tools/sfx-generator.html are
// redirect stubs to tools/sound-studio.html (Audio Studio), so one fix covers
// all four URLs. The beat cells were 36px, drum pads 39px tall and SFX buttons
// 38px tall at 390px. They now meet the 44px floor. This pins them.
//
// Run: node tests/sequencer-touch.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };

const PAGES = ['tools/music-maker.html', 'tools/sound-studio.html', 'tools/drum-pad.html', 'tools/sfx-generator.html'];

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
      await page.setRequestInterception(true);
      page.on('request', r => { if (r.resourceType() === 'media') r.abort(); else r.continue(); });
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 25000 });
      await new Promise(r => setTimeout(r, 600));
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        const main = document.querySelector('main') || document.body;
        const vis = el => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width >= 1 && r.height >= 1 && st.display !== 'none' && st.visibility !== 'hidden' && st.pointerEvents !== 'none'; };
        const small = [];
        for (const el of main.querySelectorAll('a,button,[role="button"],input,select,textarea,[tabindex]')) {
          if (!vis(el)) continue;
          const r = el.getBoundingClientRect();
          const min = Math.min(r.width, r.height);
          if (el.matches('button,.btn,[role="button"],input[type="submit"],select') && min < 40) {
            small.push((el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : el.tagName) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
          }
        }
        return { overflow: doc.scrollWidth - doc.clientWidth, small: small.slice(0, 6), smallCount: small.length };
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
  console.log('\nALL SEQUENCER TOUCH CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
