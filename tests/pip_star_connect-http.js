// A1985: PiP's Star Connect loads and links back to the Pip book.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19312;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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

const file = path.join(root, 'games', 'pip_star_connect.html');
const html = fs.readFileSync(file, 'utf8');
check('game links back to the Pip book', /href="\/books\/Pip_and_the_night_sky\.html"/.test(html));

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

  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    await page.goto('http://127.0.0.1:' + port + '/games/pip_star_connect.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const state = await page.evaluate(() => ({
      title: document.title,
      hasCanvas: !!document.getElementById('canvas'),
      bookLink: [...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/books/Pip_and_the_night_sky.html'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check(width + 'px: title loads', /Star Connect/i.test(state.title), state.title);
    check(width + 'px: sky canvas present', state.hasCanvas);
    check(width + 'px: book back-link visible', state.bookLink);
    check(width + 'px: no horizontal overflow', state.overflow <= 2, String(state.overflow));
  }
  check('no runtime errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PIP STAR CONNECT CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
