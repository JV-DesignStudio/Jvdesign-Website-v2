const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19282;
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
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
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
        if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(m.text())) return;
        errors.push('console: ' + m.text());
      });
      await page.setViewport({ width, height, isMobile: width === 390 });
      await page.goto('http://127.0.0.1:' + port + '/tools/game-logo-maker.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((resolve) => setTimeout(resolve, 600));
      const info = await page.evaluate(() => ({
        title: document.title,
        main: !!document.getElementById('main-content'),
        watchdog: !!document.getElementById('hash-watchdog'),
        watchdogScript: !!document.querySelector('script[src*="hash-size-watchdog"]'),
        watchdogApi: typeof window.HashWatchdog,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      }));
      check('title loads @' + width, info.title.includes('Logo Mode'), info.title);
      check('main target exists @' + width, info.main);
      check('no floating hash-size badge @' + width, !info.watchdog && !info.watchdogScript && info.watchdogApi === 'undefined');
      check('no horizontal overflow @' + width, !info.overflow);
      await page.close();
    }
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nGAME LOGO MAKER HTTP CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
