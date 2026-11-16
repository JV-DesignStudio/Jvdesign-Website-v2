const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19285;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
};
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PAGES = [
  { file: 'store-page-builder', title: /Launch Studio/i, field: 'gameTitle', value: 'Test Store', live: "announceToast('Saved store')", auto: true },
  { file: 'screenshot-generator', title: /Screenshot Mode/i, field: 'title', value: 'Test Shot', live: "announceToast('Saved shot')", auto: true },
  { file: 'game-logo-maker', title: /Logo Mode/i, field: 'titleText', value: 'TEST LOGO', live: "toast('Saved logo')", auto: true }
];

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    for (const spec of PAGES) {
      for (const [width, height] of [[390, 844], [1440, 900]]) {
        const page = await browser.newPage();
        page.on('pageerror', (e) => errors.push(spec.file + ' pageerror: ' + e.message));
        page.on('console', (m) => {
          if (m.type() !== 'error') return;
          if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ERR_BLOCKED/.test(m.text())) return;
          errors.push(spec.file + ' console: ' + m.text());
        });
        await page.setViewport({ width, height, isMobile: width === 390, hasTouch: width === 390 });
        await page.goto('http://127.0.0.1:' + port + '/tools/' + spec.file + '.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await wait(700);

        const info = await page.evaluate((field) => ({
          title: document.title,
          manifest: !!document.querySelector('link[rel="manifest"]'),
          live: !!document.getElementById('jvds-announce'),
          field: !!document.getElementById(field),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
        }), spec.field);
        check(spec.file + ' loads @' + width, spec.title.test(info.title), info.title);
        check(spec.file + ' manifest @' + width, info.manifest);
        check(spec.file + ' live region @' + width, info.live);
        check(spec.file + ' main field @' + width, info.field);
        check(spec.file + ' no horizontal overflow @' + width, !info.overflow);

        if (width === 390) {
          const announced = await page.evaluate((code) => {
            try { eval(code); } catch (e) { return { text: 'error: ' + e.message }; }
            const el = document.getElementById('jvds-announce');
            return { text: el ? el.textContent : '', count: document.querySelectorAll('#jvds-announce').length };
          }, spec.live);
          check(spec.file + ' announces to screen readers', /Saved/.test(announced.text || '') && announced.count === 1, JSON.stringify(announced));

          await page.evaluate((field, value) => {
            const el = document.getElementById(field);
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, spec.field, spec.value);
          await wait(900);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await wait(700);
          const restored = await page.evaluate((field) => document.getElementById(field).value, spec.field);
          check(spec.file + ' autosaves and restores', restored === spec.value, restored);

          const wired = await page.evaluate((file) => {
            if (file === 'store-page-builder') return typeof exportHTML === 'function';
            if (file === 'screenshot-generator') return typeof exportPNG === 'function';
            return typeof exportPNG === 'function' && typeof exportSVG === 'function';
          }, spec.file);
          check(spec.file + ' export is wired', wired);
        }
        await page.close();
      }
    }
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nLAUNCH STUDIO MOBILE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
