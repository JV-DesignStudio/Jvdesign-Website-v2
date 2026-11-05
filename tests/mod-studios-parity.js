/* Mod studios parity guard.
   Every workshops/*-mod-studio.html must:
   - link the shared workshop shell (style-workshop.css)
   - link the ONE shared mod-studio stylesheet (style-workshop-mod-studio.css)
   - carry a data-ms accent and fewer than 15 inline styles
   - render with no horizontal overflow at 1440 and 390 and no console errors
   Keeps the 15 studios on one path so a new studio cannot ship unstyled or
   reintroduce a per-engine CSS copy. */
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
  const missingSheet = [], missingShell = [], missingAccent = [], tooManyInline = [], strayCopies = [];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(root, 'workshops', p), 'utf8');
    if (!/style-workshop\.css/.test(html)) missingShell.push(p);
    if (!/style-workshop-mod-studio\.css/.test(html)) missingSheet.push(p);
    if (!/<body[^>]+data-ms="[a-z0-9]+"/.test(html)) missingAccent.push(p);
    const inline = (html.match(/\sstyle="/g) || []).length;
    if (inline >= 15) tooManyInline.push(p + ' (' + inline + ')');
    const copies = html.match(/style-workshop-[a-z0-9-]+-mod-studio\.css/g) || [];
    for (const c of copies) if (c !== 'style-workshop-mod-studio.css') strayCopies.push(p + ' -> ' + c);
  }
  check('every committed mod studio links the workshop shell', missingShell.length === 0, missingShell.join(', '));
  check('every committed mod studio links the shared mod-studio stylesheet', missingSheet.length === 0, missingSheet.join(', '));
  check('the shared mod-studio stylesheet exists', fs.existsSync(path.join(root, 'style-workshop-mod-studio.css')));
  check('no mod studio links a per-engine CSS copy', strayCopies.length === 0, strayCopies.join(', '));
  check('every committed mod studio sets a data-ms accent', missingAccent.length === 0, missingAccent.join(', '));
  check('every committed mod studio is under 15 inline styles', tooManyInline.length === 0, tooManyInline.join(', '));

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
