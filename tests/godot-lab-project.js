/* A3070: the Lab can open the exact project from the lesson. With
   ?project=godot-tutorial the download link follows the choice, so the page and
   the real editor never point at two different ZIPs. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/godot-lab/index.html';
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.zip': 'application/zip'
};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(root, u);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const cases = [
      ['', 'projects/starter.zip', 'my-first-godot-project.zip', 'First Video Game starter'],
      ['?project=godot-tutorial', 'projects/godot-tutorial.zip', 'star-collector-godot.zip', 'Star Collector'],
      ['?project=platformer', 'projects/platformer.zip', '2d-platformer.zip', '2D Platformer'],
      ['?project=gatekeeper-1', 'projects/gatekeeper-1.zip', 'who-goes-there-part1.zip', 'Who Goes There? Part 1']
    ];
    for (const [query, zip, download, title] of cases) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        if (r.url().endsWith('/coi-serviceworker.js')) return r.abort();
        return r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort();
      });
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      const resp = await page.goto(base + '/' + PAGE + query, { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('[data-gl-download]', { timeout: 15000 });
      await page.waitForFunction(() => document.querySelectorAll('#gl-project option').length >= 10, { timeout: 15000 });
      const info = await page.evaluate(() => {
        const a = document.querySelector('[data-gl-download]');
        const workshop = document.querySelector('[data-gl-workshop]');
        return {
          href: a.getAttribute('href'),
          download: a.getAttribute('download'),
          options: document.querySelectorAll('#gl-project option').length,
          selected: (document.querySelector('[data-gl-project]') || {}).value || '',
          name: (document.querySelector('[data-gl-project-name]') || {}).textContent || '',
          workshop: workshop ? workshop.getAttribute('href') : '',
          mobile: !!(document.querySelector('[data-gl-mobile]') && !document.querySelector('[data-gl-mobile]').hidden),
          copy: !!document.querySelector('[data-gl-copy]'),
          anyway: !!document.querySelector('[data-gl-anyway]'),
          mobileLink: (document.querySelector('[data-gl-mobile-link]') || {}).textContent || '',
          frameSrc: (document.getElementById('godot-frame') || {}).getAttribute('src') || '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      const label = query || 'default';
      check('status 200 ' + label, resp && resp.status() === 200, String(resp && resp.status()));
      check('project library loaded ' + label, info.options >= 10, 'options ' + info.options);
      check('download href ' + label, info.href === zip, info.href);
      check('download name ' + label, info.download === download, info.download);
      check('project title ' + label, info.name.trim() === title, info.name);
      check('project workshop link ' + label, /^\/workshops\//.test(info.workshop || ''), info.workshop);
      check('phone hand-off card ' + label, info.mobile && info.copy && info.anyway, JSON.stringify({ mobile: info.mobile, copy: info.copy, anyway: info.anyway }));
      check('phone link carries the project ' + label, /\?project=/.test(info.mobileLink), info.mobileLink);
      check('phone does not load the 96 MB editor ' + label, !info.frameSrc, info.frameSrc || 'not loaded');
      check('no overflow ' + label, info.overflow <= 2, info.overflow + 'px');
      check('no page errors ' + label, errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise((r) => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nPASS: Lab project hand-off');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
