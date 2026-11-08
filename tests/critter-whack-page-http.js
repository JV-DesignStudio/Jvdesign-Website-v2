/* Critter Whack redirect + game parity (A2836).

   The game used to be a marketing landing page (critter-whack-page.html) that
   embedded the real game in an iframe. A2836 rebuilt critter-whack.html as a
   fullscreen game and turned the old landing page into a redirect, so the
   Arcade card launches the game directly.

   This pins:
     - the old page redirects to the game (no iframe, no landing copy)
     - the game page is Ranger Sort, names Echo, and fits both widths
     - no browser errors

   Run: node tests/critter-whack-page-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  // Static: the old landing page must be a redirect, not an iframe wrapper.
  const oldHtml = fs.readFileSync(path.join(root, 'games/critter-whack-page.html'), 'utf8');
  check('old page redirects to the game', /http-equiv=["']refresh["'][^>]*url=critter-whack\.html/i.test(oldHtml));
  check('old page canonical points at the game', /rel=["']canonical["'][^>]*games\/critter-whack\.html/i.test(oldHtml));
  check('old page is noindex', /name=["']robots["'][^>]*noindex/i.test(oldHtml));
  check('old page no longer embeds an iframe', !/<iframe\b/i.test(oldHtml));

  const gameHtml = fs.readFileSync(path.join(root, 'games/critter-whack.html'), 'utf8');
  check('game page has no iframe', !/<iframe\b/i.test(gameHtml));
  check('game page has no landing redirect', !/http-equiv=["']refresh["']/i.test(gameHtml));

  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/games/critter-whack.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 600));
    const d = await page.evaluate(() => {
      const meta = n => { const e = document.querySelector(n); return e ? (e.getAttribute('content') || '') : ''; };
      return {
        title: document.title,
        desc: meta('meta[name="description"]'),
        og: meta('meta[property="og:description"]'),
        body: document.body.innerText,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    check('game title is Ranger Sort', /Ranger Sort/.test(d.title), d.title);
    check('meta description describes the sorting game', /ranger clue|sort/i.test(d.desc), d.desc.slice(0, 70));
    check('og:description names Echo', /Echo/.test(d.og), d.og.slice(0, 70));
    check('body names Echo', /Echo/.test(d.body));
    check('desktop 1440 no horizontal overflow', d.overflow <= 2, 'overflow=' + d.overflow);
    check('desktop no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));
    const mob = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('phone 390 no horizontal overflow', mob <= 2, 'overflow=' + mob);
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
