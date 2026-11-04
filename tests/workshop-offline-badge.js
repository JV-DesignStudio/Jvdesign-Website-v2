const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19314;
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

  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    for (const id of ['my-first-browser-game', 'my-first-python-game', 'my-first-cpp-game']) {
      await page.goto('http://127.0.0.1:' + port + '/workshops/' + id + '.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('#workshop-offline-badge', { timeout: 5000 }).catch(() => {});
      const state = await page.evaluate(() => {
        const badge = document.getElementById('workshop-offline-badge');
        return {
          present: !!badge,
          text: badge ? badge.innerText : '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      check(width + 'px ' + id + ': offline badge', state.present);
      check(width + 'px ' + id + ': badge explains one visit', /offline after one visit/i.test(state.text), state.text.slice(0, 80));
      check(width + 'px ' + id + ': no horizontal overflow', state.overflow <= 2, String(state.overflow));
    }
  }

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:' + port + '/workshops/my-first-scratch-game.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const scratch = await page.evaluate(() => !!document.getElementById('workshop-offline-badge'));
  check('non-flagship workshop has no offline badge', scratch === false);
  check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL WORKSHOP OFFLINE BADGE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
