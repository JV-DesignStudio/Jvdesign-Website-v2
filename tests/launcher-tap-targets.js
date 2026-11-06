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
  { p: 'index.html' },
  { p: 'browse.html' },
  { p: 'arcade.html' },
  { p: 'pages/content_hub.html' },
  { p: 'pages/workshop.html' },
  { p: 'workshops/start-here.html', extra: ['.jump-nav a'] },
  { p: 'tools/pixel-studio.html', tool: ['#psTopTab'] },
  { p: 'tools/game-logo-maker.html', tool: ['#studioTopTab'] },
  { p: 'tools/bitmap-font-maker.html', tool: [] }
];

const VIEWPORTS = [
  { w: 390, h: 844, label: '390x844', mobile: true, maxOverflow: 1 },
  { w: 1440, h: 900, label: '1440x900', mobile: false, maxOverflow: 8 }
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
    for (const vp of VIEWPORTS) {
      for (const cfg of PAGES) {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 });
        await page.goto(base + '/' + cfg.p, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1200));
        const m = await page.evaluate((cfg, MIN) => {
          const main = document.querySelector('main') || document.body;
          const visible = el => {
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            return r.width >= 1 && r.height >= 1 && st.display !== 'none' && st.visibility !== 'hidden';
          };
          const sample = el => {
            const r = el.getBoundingClientRect();
            const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30);
            return `${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${label}"`;
          };
          const small = [];
          const controls = cfg.tool ? [] : [...main.querySelectorAll('button,input,select,textarea,[role="button"]')];
          for (const el of controls) {
            if (el.matches('input[type="hidden"]') || !visible(el)) continue;
            const r = el.getBoundingClientRect();
            if (Math.min(r.width, r.height) >= MIN) continue;
            small.push(sample(el));
          }
          for (const sel of (cfg.tool || []).concat(cfg.extra || [])) {
            for (const el of document.querySelectorAll(sel)) {
              if (!visible(el)) continue;
              const r = el.getBoundingClientRect();
              if (Math.min(r.width, r.height) >= MIN) continue;
              small.push(sample(el));
            }
          }
          return {
            overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            small: [...new Set(small)].slice(0, 6)
          };
        }, cfg, MIN);
        check(`${vp.label} ${cfg.p}: no horizontal overflow`, m.overflow <= vp.maxOverflow, 'overflow=' + m.overflow);
        if (vp.mobile) {
          check(`${vp.label} ${cfg.p}: launcher controls at least ${MIN}px`, m.small.length === 0, m.small.length ? m.small.join(' | ') : 'all targets pass');
        }
        await page.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL LAUNCHER TAP-TARGET CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
