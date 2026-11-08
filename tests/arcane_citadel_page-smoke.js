/* Arcane Citadel wrapper redirect (A2837).

   games/arcane_citadel_page.html used to be an iframe landing wrapper. A2837
   made the real game (games/arcane_citadel.html) the arcade target and turned
   this page into a redirect, so old links and the app-mode bug both go straight
   into the game.

   Run: node tests/arcane_citadel_page-smoke.js
*/
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AC_PORT || 8161);
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };
const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'games/arcane_citadel_page.html'), 'utf8');
  ok('redirects to the game', /http-equiv=["']refresh["'][^>]*url=arcane_citadel\.html/i.test(html));
  ok('canonical points at the game', /rel=["']canonical["'][^>]*games\/arcane_citadel\.html/i.test(html));
  ok('is noindex', /name=["']robots["'][^>]*noindex/i.test(html));
  ok('no iframe wrapper remains', !/<iframe\b/i.test(html));

  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + '/games/arcane_citadel_page.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1200));
    const landed = await page.evaluate(() => ({
      url: location.pathname,
      title: document.title,
      start: !!document.getElementById('screen-start') && getComputedStyle(document.getElementById('screen-start')).display !== 'none',
      canvas: !!document.getElementById('gameCanvas')
    }));
    ok('browser follows the redirect into the game', /\/games\/arcane_citadel\.html$/.test(landed.url), landed.url);
    ok('game title loads', /Arcane Citadel/i.test(landed.title), landed.title);
    ok('start screen is up', landed.start);
    ok('game canvas is present', landed.canvas);
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
