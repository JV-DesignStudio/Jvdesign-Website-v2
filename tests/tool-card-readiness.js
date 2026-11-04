const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19313;
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
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon|googletagmanager|google-analytics/.test(text)) return;
    errors.push('console: ' + text);
  });

  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    await page.goto('http://127.0.0.1:' + port + '/pages/dev-tools.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.tool-card-readiness').length > 5, { timeout: 8000 }).catch(() => {});
    const state = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.tool-card[data-tool-card]'));
      const ready = Array.from(document.querySelectorAll('.tool-card-readiness'));
      return {
        cards: cards.length,
        ready: ready.length,
        weights: ready.filter((x) => /~\d+ KB/.test(x.innerText)).length,
        offline: ready.filter((x) => /Offline ready/.test(x.innerText)).length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    check(width + 'px: hub cards found', state.cards >= 20, String(state.cards));
    check(width + 'px: every card has readiness', state.ready >= state.cards, state.ready + '/' + state.cards);
    check(width + 'px: weights are shown', state.weights >= 20, String(state.weights));
    check(width + 'px: offline badges are shown', state.offline >= 5, String(state.offline));
    check(width + 'px: no horizontal overflow', state.overflow <= 2, String(state.overflow));
  }
  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL TOOL CARD READINESS CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
