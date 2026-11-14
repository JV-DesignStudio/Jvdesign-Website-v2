const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19284;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR/.test(m.text())) return;
        errors.push('console: ' + m.text());
      });
      await page.setViewport({ width, height, isMobile: width === 390 });
      await page.goto('http://127.0.0.1:' + port + '/tools/screenshot-generator.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((resolve) => setTimeout(resolve, 700));
      const info = await page.evaluate(() => ({
        title: document.title,
        hasExport: typeof exportPNG === 'function',
        canvas: !!document.getElementById('preview'),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      }));
      check('page loads @' + width, /Screenshot Mode/i.test(info.title), info.title);
      check('preview canvas exists @' + width, info.canvas);
      check('export function parsed @' + width, info.hasExport);
      check('no horizontal overflow @' + width, !info.overflow);

      const exported = await page.evaluate(() => {
        document.getElementById('title').value = 'Test Game';
        const orig = HTMLAnchorElement.prototype.click;
        let anchor = null;
        HTMLAnchorElement.prototype.click = function () { anchor = this; };
        const btn = document.querySelector('[data-on="exportPNG"]');
        if (!btn) { HTMLAnchorElement.prototype.click = orig; return { clicked: false, href: '' }; }
        btn.click();
        HTMLAnchorElement.prototype.click = orig;
        return { clicked: true, href: anchor ? anchor.href : '' };
      });
      check('export button is wired @' + width, exported.clicked);
      check('export produces a PNG data URL @' + width, /^data:image\/png;base64,iVBOR/.test(exported.href || '') && exported.href.length > 500);
      await page.close();
    }
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nSCREENSHOT GENERATOR HTTP CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
