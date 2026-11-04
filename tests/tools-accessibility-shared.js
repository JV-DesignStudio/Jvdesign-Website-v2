const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19310;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
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
    if (/ERR_NETWORK_ACCESS DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon|googletagmanager|google-analytics/.test(text)) return;
    errors.push('console: ' + text);
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('jvds_accessibility', JSON.stringify({ announce: true, motion: true, contrast: true, textSize: '130', font: true }));
  });

  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    for (const route of ['/tools/pixel-studio.html', '/tools/sound-studio.html', '/tools/level-designer.html', '/pages/dev-tools.html']) {
      await page.goto('http://127.0.0.1:' + port + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise((resolve) => setTimeout(resolve, 600));
      const state = await page.evaluate(() => ({
        size: document.documentElement.style.fontSize,
        reduced: document.documentElement.classList.contains('reduced-motion'),
        contrast: document.body.classList.contains('high-contrast'),
        font: document.body.classList.contains('reading-font'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check(width + 'px ' + route + ': text size travels', state.size === '130%', state.size);
      check(width + 'px ' + route + ': reduced motion travels', state.reduced);
      check(width + 'px ' + route + ': high contrast travels', state.contrast);
      check(width + 'px ' + route + ': reading font travels', state.font);
      check(width + 'px ' + route + ': no horizontal overflow', state.overflow <= 2, String(state.overflow));
    }
  }

  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:' + port + '/tools/accessibility.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const hasSwitch = await page.$('#swFont');
  check('accessibility page has the reading font switch', !!hasSwitch);
  if (hasSwitch) {
    await page.click('#swFont');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds_accessibility') || '{}').font);
    check('reading font switch persists', stored === false, String(stored));
  }
  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL SHARED ACCESSIBILITY CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
