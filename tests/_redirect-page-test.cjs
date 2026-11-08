/* Shared redirect page test (A2841).

   Usage from a thin tests/<page>-http.js:
     require('./_redirect-page-test.cjs')('lumo-dash-page.html','lumo-dash.html','Lumo Dash');

   Proves the old wrapper is a redirect (no iframe), the browser lands on the
   real game, the page has no horizontal overflow and no script errors.
*/
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

module.exports = async function (source, target, label) {
  let failures = 0;
  const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const html = fs.readFileSync(path.join(ROOT, 'games', source), 'utf8');
  ok('redirects to ' + target, new RegExp('http-equiv=["\']refresh["\'][^>]*url=' + esc(target), 'i').test(html));
  ok('canonical points at the game', new RegExp('rel=["\']canonical["\'][^>]*games/' + esc(target), 'i').test(html));
  ok('is noindex', /name=["']robots["'][^>]*noindex/i.test(html));
  ok('no iframe wrapper remains', !/<iframe\b/i.test(html));

  const server = http.createServer((req, res) => {
    let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(base + '/games/' + source, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    const landed = await page.evaluate(() => ({
      path: location.pathname,
      title: document.title,
      body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 220),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    ok('browser follows the redirect', new RegExp('/games/' + esc(target) + '$').test(landed.path), landed.path);
    ok('lands on ' + label, new RegExp(label.split(' ')[0], 'i').test(landed.title + ' ' + landed.body), landed.title);
    ok('no horizontal overflow', landed.overflow <= 2, 'overflow=' + landed.overflow);
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
};
