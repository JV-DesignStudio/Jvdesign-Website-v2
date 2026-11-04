/* 3D Builder page check (A1821).

   workshops/3d-builder.html is one of the representative performance pages.
   This pins the page-level contract: the shell loads, the 3D engine and shared
   exporter are available, and the first preset mounts inline at 390 and 1440
   with no console errors. The deeper preset/export work stays in
   tests/3d-builder-shell.js.

   Run: node tests/3d-builder-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.zip': 'application/zip', '.txt': 'text/plain' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const vp of [{ width: 1440, height: 900, isMobile: false, hasTouch: false }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/Content Security Policy/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setViewport(vp);
      const res = await page.goto(base + '/workshops/3d-builder.html', { waitUntil: 'load', timeout: 45000 });
      await page.waitForFunction(() => window._builderGetState && document.querySelector('#bsHost .bs-stage'), { timeout: 30000 });
      const d = await page.evaluate(() => ({
        title: document.title,
        chips: document.querySelectorAll('#bsChips .bs-chip').length,
        labelledChips: [].slice.call(document.querySelectorAll('#bsChips .bs-chip'))
          .filter((c) => c.dataset.age && c.dataset.level && /Ages|Guided|Challenge/.test(c.textContent + ' ' + (c.title || ''))).length,
        labelledOptions: [].slice.call(document.querySelectorAll('#bsSelect option'))
          .filter((o) => /Ages \d/.test(o.textContent)).length,
        frame: !!document.querySelector('#bsHost iframe'),
        three: !!window.THREE,
        exporter: !!(window.JVExporter && window.JVExporter.makeBundle),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check(vp.width + ' page returns 200', res && res.status() === 200, res ? String(res.status()) : 'no response');
      check(vp.width + ' has a title', /3D Builder/i.test(d.title), d.title);
      check(vp.width + ' has all 11 presets', d.chips === 11, 'chips=' + d.chips);
      check(vp.width + ' every preset shows an age and level', d.labelledChips === 11, 'labelled=' + d.labelledChips);
      check(vp.width + ' preset picker lists the ages', d.labelledOptions === 11, 'options=' + d.labelledOptions);
      check(vp.width + ' first preset mounts inline', !d.frame);
      check(vp.width + ' engine loaded', d.three);
      check(vp.width + ' shared exporter loaded', d.exporter);
      check(vp.width + ' no horizontal overflow', d.overflow <= 2, 'overflow=' + d.overflow);
      check(vp.width + ' no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS 3d-builder-http: shell + engine + inline preset at 390 and 1440');
})().catch(e => { console.error(e); process.exit(1); });
