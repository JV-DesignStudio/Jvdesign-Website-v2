/* A3069 page test for the GDScript Essentials build canvas.
   The lesson starts straight away. A coding fundamentals lesson should not ask
   for a game colour, name or difficulty first. This checks the start panel, the
   six lesson steps and the 390/1440 layout. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/godot-gdscript-essentials-canvas.html';
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
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      await page.setViewport({ width, height: 900 });
      await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 15000 });

      const start = await page.evaluate(() => ({
        heading: (document.querySelector('#designForm h2') || {}).textContent || '',
        questions: document.querySelectorAll('.cw-design-q').length,
        swatches: document.querySelectorAll('.cw-swatch').length,
        button: (document.getElementById('designStartBtn') || {}).textContent || '',
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check('start panel heading @' + width, /start with the code/i.test(start.heading), start.heading);
      check('no game-design questions @' + width, start.questions === 0 && start.swatches === 0, 'questions ' + start.questions + ', swatches ' + start.swatches);
      check('start button present @' + width, /start the lesson/i.test(start.button), start.button);
      check('no horizontal overflow @' + width, start.overflow <= 2, start.overflow + 'px');

      await page.click('#designStartBtn');
      await page.waitForFunction(() => (document.getElementById('buildCanvas') || {}).style.display !== 'none', { timeout: 5000 });
      const built = await page.evaluate(() => ({
        steps: document.querySelectorAll('.cw-step').length,
        active: document.querySelectorAll('.cw-step.active').length,
        editors: document.querySelectorAll('.cw-editor').length,
        first: (document.querySelector('.cw-step.active h3') || {}).textContent || ''
      }));
      check('six lessons plus the take-home step @' + width, built.steps === 7, 'steps ' + built.steps);
      check('one active step @' + width, built.active === 1, 'active ' + built.active);
      check('every step has an editor @' + width, built.editors === built.steps, built.editors + ' editors');
      check('first step is Variables @' + width, /variables/i.test(built.first), built.first);

      const v2 = await page.evaluate(() => {
        const active = document.querySelector('.cw-step.active');
        const others = Array.from(document.querySelectorAll('.cw-step:not(.active)'));
        const bodyOf = (card) => Array.from(card.children).find((c) => !c.classList.contains('cw-step-head'));
        const collapsed = others.every((card) => {
          const body = bodyOf(card);
          return !body || getComputedStyle(body).display === 'none';
        });
        const activeBody = active ? bodyOf(active) : null;
        return {
          tools: !!document.querySelector('.cw-stage-tools'),
          activeOpen: !!activeBody && getComputedStyle(activeBody).display !== 'none',
          collapsed,
          js: window.CWTranspileGDScript ? window.CWTranspileGDScript('func add(a, b):\n    return a + b\n\nprint(add(1, 2))', { keepPrint: true }) : ''
        };
      });
      check('stage tools @' + width, v2.tools);
      check('focus mode collapses other steps @' + width, v2.activeOpen && v2.collapsed, JSON.stringify(v2));
      check('GDScript function compiles @' + width, /function add\(a, b\) \{/.test(v2.js) && /return a \+ b;/.test(v2.js) && /\n\}/.test(v2.js), v2.js);
      check('print stays visible in the output lesson @' + width, /print\(add\(1, 2\)\);/.test(v2.js), v2.js);
      const labLink = await page.evaluate(() => {
        const a = document.querySelector('.cw-engine-project');
        return a ? a.getAttribute('href') : '';
      });
      check('Lab project link @' + width, /godot-lab\/index\.html\?project=gdscript-essentials/.test(labLink), labLink);
      check('no page errors @' + width, errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise((r) => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nPASS: GDScript Essentials starts without a design form');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
