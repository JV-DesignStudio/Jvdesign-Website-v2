// HTTP runtime verification for the Palette Studio presets page.
// A2903 removed the cross-page "Also try" strip, so the page must still render
// its ten palettes, copy a hex code and fit at 390px and 1440px.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8132;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail !== undefined ? ' , ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon/.test(t)) return;
    errors.push('console: ' + t);
  });
  await page.evaluateOnNewDocument(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text) => { window.__copied.push(text); return Promise.resolve(); } }
    });
  });

  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    await page.goto(`http://127.0.0.1:${PORT}/tools/colour-palettes.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.palette-card');

    const state = await page.evaluate(() => ({
      cards: document.querySelectorAll('.palette-card').length,
      hexes: document.querySelectorAll('.swatch-hex').length,
      alsoTry: !!document.querySelector('.also-try'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : ''
    }));
    check(width + 'px: ten palettes render', state.cards === 10, String(state.cards));
    check(width + 'px: every swatch has a hex label', state.hexes >= 50, String(state.hexes));
    check(width + 'px: no cross-page Also try strip', !state.alsoTry);
    check(width + 'px: heading names Palette Studio', /Palette Studio/i.test(state.title), state.title);
    check(width + 'px: no horizontal overflow', state.overflow <= 2, String(state.overflow));

    await page.click('.swatch-hex');
    await new Promise((r) => setTimeout(r, 150));
    const copied = await page.evaluate(() => window.__copied);
    check(width + 'px: clicking a hex copies it', copied.length === 1 && /^#[0-9A-F]{6}$/i.test(copied[0]), copied.join(','));
  }

  check('zero uncaught JS errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nCOLOUR PALETTES HTTP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Harness error:', e); process.exit(1); });
