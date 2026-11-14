/* pages/class.html page check (A3054).

   The old "Today in Class" page is now a parents-to-kids family session, so the
   visible copy must not frame the experience as classroom, teacher or student
   work. Runs at 390 and 1440 and checks the page still renders its session.

   Run: node tests/class-http.js
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
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage(), errors = [];
      if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport(vp);
      const res = await page.goto(base + '/pages/class.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
      const d = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : '',
        text: document.body.innerText,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check(vp.width + ' page returns 200', res && res.status() === 200, res ? String(res.status()) : 'no response');
      check(vp.width + ' title is a family session', /Family Session/i.test(d.title), d.title);
      check(vp.width + ' heading is a making session', /making session/i.test(d.h1), d.h1);
      check(vp.width + ' no classroom, teacher or student wording', !/classroom|teacher|student|mentor|one-to-one|tutor/i.test(d.text));
      check(vp.width + ' no horizontal overflow', d.overflow <= 2, 'overflow=' + d.overflow);
      check(vp.width + ' no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS class-http: family session at 390 and 1440, parent-to-kid voice');
})().catch(e => { console.error(e); process.exit(1); });
