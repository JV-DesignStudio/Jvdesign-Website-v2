/* A2959 page test for the Godot engine hub: the Godot Lab launch section and
   its real-editor link render at 390 and 1440 with no overflow or errors. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/engine-godot.html';
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport({ width, height: 900 });
      const resp = await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
      const info = await page.evaluate(() => ({
        title: document.title,
        heading: (document.getElementById('godot-lab-title') || {}).textContent || '',
        steps: document.querySelectorAll('.godot-lab-step').length,
        editor: !!document.querySelector('a[href="https://editor.godotengine.org/latest/"]'),
        lab: !!document.querySelector('a[href="/workshops/godot-lab/index.html"]'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check('status 200 @' + width, !!resp && resp.status() === 200, String(resp && resp.status()));
      check('page title @' + width, /Godot/i.test(info.title), info.title);
      check('lab heading @' + width, /Godot Lab/i.test(info.heading), info.heading);
      check('three lab steps @' + width, info.steps === 3, 'steps ' + info.steps);
      check('Godot Lab link @' + width, info.lab);
      check('official editor fallback @' + width, info.editor);
      check('no horizontal overflow @' + width, info.overflow <= 2, info.overflow + 'px');
      check('no page errors @' + width, errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nPASS: engine-godot page');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
