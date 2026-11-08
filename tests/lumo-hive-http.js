#!/usr/bin/env node
/* Lumo's Hive page contract (A2844).

   The accessibility baseline needs a page test for games/lumo-hive.html:
   a labelled play field, a live status region, a pause control, and a clean
   phone load with no runtime errors.

   Run: node tests/lumo-hive-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };
const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'games/lumo-hive.html'), 'utf8');
  let code = html;
  for (const m of html.matchAll(/<script[^>]*\ssrc=["']([^"']*assets\/js\/inline\/[^"']+)["']/gi)) {
    const p = path.resolve(path.join(ROOT, 'games'), m[1]);
    if (fs.existsSync(p)) code += '\n' + fs.readFileSync(p, 'utf8');
  }
  ok('play field is labelled', /<canvas[^>]*aria-label="[^"]*play field"/i.test(html));
  ok('has a live status region', /aria-live|role=["']status["']/i.test(code));
  ok('has a pause control', /pause|autoPause/i.test(code));
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(base + '/games/lumo-hive.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 900));
    const info = await page.evaluate(() => ({
      title: document.title,
      canvas: !!document.getElementById('game'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    ok('page loads with its canvas', info.canvas, info.title);
    ok('no horizontal overflow', info.overflow <= 2, 'overflow=' + info.overflow);
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();
  } finally { await browser.close(); await new Promise((r) => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
