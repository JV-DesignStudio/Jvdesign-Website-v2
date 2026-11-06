const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const PAGES = [
  'workshops/learning-lab.html',
  'workshops/jump-jump-mario-workshop.html',
  'pages/workshop.html'
];

const MIN = 44;

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
    for (const rel of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(base + '/' + rel, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));
      const m = await page.evaluate((MIN) => {
        const main = document.querySelector('main') || document.body;
        const visible = el => {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          return r.width >= 1 && r.height >= 1 && st.display !== 'none' && st.visibility !== 'hidden';
        };
        const label = el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 34);
        const describe = el => `${el.tagName.toLowerCase()} ${(typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')} "${label(el)}"`;
        const candidates = [...main.querySelectorAll('a,button,input,select,textarea,[role="button"],[tabindex]')]
          .filter(el => !el.matches('input[type="hidden"], .skip-link'))
          .filter(visible)
          .filter(el => el.tagName !== 'A' || (el.className && !el.closest('p')));
        const small = [];
        const noFocus = [];
        for (const el of candidates) {
          const r = el.getBoundingClientRect();
          if (Math.min(r.width, r.height) < MIN) small.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
          el.focus({ preventScroll: true });
          const st = getComputedStyle(el);
          const ring = (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) || (st.boxShadow && st.boxShadow !== 'none');
          if (!ring) noFocus.push(`${describe(el)} outline=${st.outlineStyle}/${st.outlineWidth}`);
        }
        return {
          overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          small: [...new Set(small)].slice(0, 8),
          noFocus: [...new Set(noFocus)].slice(0, 8)
        };
      }, MIN);
      check(`${rel}: no horizontal overflow at 390px`, m.overflow <= 1, 'overflow=' + m.overflow);
      check(`${rel}: interactive targets at least ${MIN}px`, m.small.length === 0, m.small.length ? m.small.join(' | ') : 'all pass');
      check(`${rel}: focus is visible on every control`, m.noFocus.length === 0, m.noFocus.length ? m.noFocus.join(' | ') : 'all pass');
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nQUEST MOBILE AUDIT PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
