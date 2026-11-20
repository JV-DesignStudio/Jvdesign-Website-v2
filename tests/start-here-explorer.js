/* Start Here explorer door (A3129).

   Run: node tests/start-here-explorer.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const vp of [{ width: 1440, height: 900, name: '1440' }, { width: 390, height: 844, name: '390' }]) {
      const page = await browser.newPage(), errors = [];
      if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      const res = await page.goto(base + '/workshops/start-here.html?who=explorer', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
      const d = await page.evaluate(() => ({
        step0: document.getElementById('pypStep0').classList.contains('active'),
        step1: document.getElementById('pypStep1').classList.contains('active'),
        title: (document.getElementById('pypStep1Title') || {}).textContent || '',
        options: document.querySelectorAll('#pypFocusGrid .pyp-card').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check(vp.name + ' page returns 200', res && res.status() === 200, res ? String(res.status()) : 'no response');
      check(vp.name + ' skips the who step', d.step1 && !d.step0, JSON.stringify(d));
      check(vp.name + ' opens the build question', /what do you want to build/i.test(d.title), d.title);
      check(vp.name + ' offers four explorer paths', d.options === 4, String(d.options));
      check(vp.name + ' no horizontal overflow', d.overflow <= 2, 'overflow=' + d.overflow);
      check(vp.name + ' no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' EXPLORER DOOR CHECK(S) FAILED'); process.exit(1); }
  console.log('\nALL EXPLORER DOOR CHECKS PASSED');
})();
