const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19262;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
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
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon|googletagmanager|google-analytics/.test(text)) return;
    errors.push('console: ' + text);
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:' + port + '/games/cozy-biscuit-clicker.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((resolve) => setTimeout(resolve, 900));

  const initial = await page.evaluate(() => ({
    title: document.title,
    consentScripts: document.querySelectorAll('script[src$="cookie-consent.js"]').length,
    analytics: document.querySelectorAll('script[src$="analytics-loader.js"]').length,
    banner: !!document.getElementById('cookie-banner'),
    tin: !!document.getElementById('tinBtn'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));

  check('title loads', initial.title.includes('Biscuit Tin'), initial.title);
  check('cookie banner is present', initial.banner);
  check('cookie-consent.js loads exactly once', initial.consentScripts === 1, String(initial.consentScripts));
  check('analytics loader is present', initial.analytics === 1, String(initial.analytics));
  check('game tin button is present', initial.tin);
  check('desktop has no horizontal overflow', initial.overflow <= 2, String(initial.overflow));

  await page.click('#cookie-decline');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const declined = await page.evaluate(() => ({
    banner: !!document.getElementById('cookie-banner'),
    cookie: document.cookie
  }));
  check('decline removes the banner', declined.banner === false);
  check('decline is stored in a cookie', /jvds-cookie-consent=declined/.test(declined.cookie), declined.cookie);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const persisted = await page.evaluate(() => !!document.getElementById('cookie-banner'));
  check('declined choice persists after reload', persisted === false);

  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    document.cookie = 'jvds-cookie-consent=;path=/;max-age=0';
  });
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((resolve) => setTimeout(resolve, 900));
  const mobile = await page.evaluate(() => ({
    banner: !!document.getElementById('cookie-banner'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check('mobile shows the banner', mobile.banner);
  check('mobile has no horizontal overflow', mobile.overflow <= 2, String(mobile.overflow));
  check('no runtime errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL COZY BISCUIT CLICKER HTTP CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
