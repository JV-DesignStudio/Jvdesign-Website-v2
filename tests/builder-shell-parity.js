/* Builder shell parity guard (A2505).
   The builder family must load one shared stylesheet, carry an engine theme
   through data-wb, keep inline style attributes low and render cleanly at
   1440 and 390. The six code-builder pages must no longer link their old
   per-engine stylesheet; race and world keep their own layout sheet parked
   on top of the shared shell. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const PAGES = [
  { page: 'cpp-tower-defence-builder.html', wb: 'cpp' },
  { page: 'js-platformer-builder.html', wb: 'js' },
  { page: 'python-game-builder.html', wb: 'python' },
  { page: 'sci-fi-runner-builder.html', wb: 'sci' },
  { page: 'unreal-clicker-builder.html', wb: 'unreal' },
  { page: 'openrct2-modding-builder.html', wb: 'openrct2' },
  { page: 'race-builder.html', wb: 'race', parked: 'style-workshop-race-builder.css' },
  { page: 'world-builder-3d.html', wb: 'world', parked: 'style-workshop-world-builder-3d.css' }
];

const DELETED = [
  'style-workshop-cpp-tower-defence-builder.css',
  'style-workshop-js-platformer-builder.css',
  'style-workshop-python-game-builder.css',
  'style-workshop-sci-fi-runner-builder.css',
  'style-workshop-unreal-clicker-builder.css',
  'style-workshop-openrct2-modding-builder.css'
];

const shared = 'style-workshop-builder.css';
check('shared builder stylesheet exists', fs.existsSync(path.join(root, shared)), shared);

for (const gone of DELETED) {
  check('old per-engine stylesheet is gone: ' + gone, !fs.existsSync(path.join(root, gone)), gone);
}

const missing = [];
const noTheme = [];
const tooMany = [];
const stillOld = [];
const missingParked = [];
for (const p of PAGES) {
  const file = path.join(root, 'workshops', p.page);
  if (!fs.existsSync(file)) { missing.push(p.page); continue; }
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(shared)) missing.push(p.page + ' (no shared shell)');
  if (!new RegExp('<body[^>]*data-wb="' + p.wb + '"').test(html)) noTheme.push(p.page);
  const inline = (html.match(/\sstyle="[^"]*"/g) || []).length;
  if (inline > 15) tooMany.push(p.page + ' (' + inline + ')');
  for (const gone of DELETED) {
    if (html.includes(gone)) stillOld.push(p.page + ' -> ' + gone);
  }
  if (p.parked && !html.includes(p.parked)) missingParked.push(p.page + ' -> ' + p.parked);
  if (p.parked && !fs.existsSync(path.join(root, p.parked))) missingParked.push(p.page + ' missing ' + p.parked);
}

check('every builder page links the shared shell', missing.length === 0, missing.join(', '));
check('every builder page carries its data-wb theme', noTheme.length === 0, noTheme.join(', '));
check('inline style attributes stay at or below 15 per page', tooMany.length === 0, tooMany.join(', '));
check('the six code builders no longer link a per-engine stylesheet', stillOld.length === 0, stillOld.join(', '));
check('race and world keep their parked layout sheet', missingParked.length === 0, missingParked.join(', '));

const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.zip': 'application/zip' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const p of PAGES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setRequestInterception(true);
      page.on('request', r => {
        const u = r.url();
        (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort();
      });
      let ok = true;
      let detail = '';
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000, isMobile: width < 500 });
        await page.goto(base + '/workshops/' + p.page, { waitUntil: 'load', timeout: 30000 });
        const info = await page.evaluate(() => {
          const css = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href') || '');
          return {
            scrollWidth: document.documentElement.scrollWidth,
            shell: css.some(h => h.includes('style-workshop-builder.css'))
          };
        });
        if (info.scrollWidth > width + 2) { ok = false; detail += width + 'px scrollWidth ' + info.scrollWidth + ' '; }
        if (!info.shell) { ok = false; detail += width + 'px shared shell not applied '; }
      }
      if (errors.length) { ok = false; detail += 'errors: ' + errors.slice(0, 2).join(' | '); }
      check(p.page + ': shell applied, no overflow at 1440/390, no console errors', ok, detail);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  console.log(failures ? '\n' + failures + ' FAILED' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
