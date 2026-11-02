/* Dev Tools hub page check (A1821).

   pages/dev-tools.html is one of the representative performance pages. This
   keeps the hub usable after the layout was moved into <head> so the tools
   grid no longer jumps into place after first paint.

   Run: node tests/dev-tools-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
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
    for (const vp of [{ width: 1440, height: 900, isMobile: false, hasTouch: false }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
      const page = await browser.newPage(), errors = [];
      if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport(vp);
      const res = await page.goto(base + '/pages/dev-tools.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 700));
      const d = await page.evaluate(() => {
        const q = sel => document.querySelector(sel);
        const tools = q('#tools'), handoff = q('.hub-handoff--create');
        return {
          title: document.title,
          tools: !!tools,
          cards: document.querySelectorAll('#tools [data-tool-card]').length,
          start: !!q('.hub-start'),
          path: !!q('#toolPathTitle'),
          handoff: !!handoff,
          bodyDisplay: getComputedStyle(document.body).display,
          toolsY: tools ? Math.round(tools.getBoundingClientRect().top) : -1,
          handoffY: handoff ? Math.round(handoff.getBoundingClientRect().top) : -1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      check(vp.width + ' page returns 200', res && res.status() === 200, res ? String(res.status()) : 'no response');
      check(vp.width + ' has a title', /Toolbox/i.test(d.title), d.title);
      check(vp.width + ' tools grid exists', d.tools);
      check(vp.width + ' tool cards present', d.cards >= 10, 'cards=' + d.cards);
      check(vp.width + ' start and guided path present', d.start && d.path);
      check(vp.width + ' next-step handoff present', d.handoff);
      check(vp.width + ' reorder CSS is applied before paint', d.bodyDisplay === 'flex', d.bodyDisplay);
      check(vp.width + ' tools grid sits above the handoff', d.toolsY >= 0 && d.handoffY > d.toolsY, 'tools=' + d.toolsY + ' handoff=' + d.handoffY);
      check(vp.width + ' no horizontal overflow', d.overflow <= 2, 'overflow=' + d.overflow);
      check(vp.width + ' no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS dev-tools-http: hub at 390 and 1440, reorder in head, no errors');
})().catch(e => { console.error(e); process.exit(1); });
