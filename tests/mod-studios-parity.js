/* Mod studios parity guard.
   Every workshops/*-mod-studio.html must:
   - link the shared workshop shell (style-workshop.css)
   - link a per-engine stylesheet (style-workshop-<engine>-mod-studio.css)
   - have that stylesheet on disk
   - render with no horizontal overflow at 1440 and 390 and no console errors
   Keeps the 15 studios on one path so a new studio cannot ship unstyled. */
const http = require('http'), fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
function committedModStudios() {
  const all = fs.readdirSync(path.join(root, 'workshops')).filter(f => /-mod-studio\.html$/.test(f)).sort();
  try {
    const tracked = new Set(execSync('git ls-files workshops', { cwd: root }).toString().split(/\r?\n/).filter(Boolean).map(l => l.split('/').pop()));
    const only = all.filter(f => tracked.has(f));
    if (only.length) return only;
  } catch { /* git unavailable: guard every page on disk */ }
  return all;
}
const pages = committedModStudios();
(async () => {
  if (!pages.length) { console.log('FAIL no mod studio pages found'); process.exit(1); }
  const missingCss = [], missingShell = [], missingGranular = [];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(root, 'workshops', p), 'utf8');
    if (!/style-workshop\.css/.test(html)) missingShell.push(p);
    const m = html.match(/style-workshop-[a-z0-9-]+-mod-studio\.css/);
    if (!m) { missingGranular.push(p); continue; }
    if (!fs.existsSync(path.join(root, m[0]))) missingCss.push(p + ' -> ' + m[0]);
    if (/style-mod-studio-polish\.css/.test(html)) missingGranular.push(p + ' (still links shared polish)');
  }
  check('every committed mod studio links the workshop shell', missingShell.length === 0, missingShell.join(', '));
  check('every committed mod studio links a per-engine stylesheet', missingGranular.length === 0, missingGranular.join(', '));
  check('every referenced per-engine stylesheet exists', missingCss.length === 0, missingCss.join(', '));

  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const p of pages) {
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', r => { const u = r.url(); (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort(); });
      let ok = true, detail = '';
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000, isMobile: width < 500 });
        await page.goto(base + '/workshops/' + p, { waitUntil: 'load', timeout: 30000 });
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        if (sw > width + 2) { ok = false; detail += width + 'px scrollWidth ' + sw + ' '; }
      }
      if (errors.length) { ok = false; detail += 'errors: ' + errors.slice(0, 2).join(' | '); }
      check(p.replace('-mod-studio.html', '') + ': no overflow 1440/390, no console errors', ok, detail);
    }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
