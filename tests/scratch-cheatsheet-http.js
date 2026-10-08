// Scratch cheat sheet + starter overhaul (A938) verification.
// Guards the regressions this task fixed: the duplicate /workshops/cheatsheet
// must forward to the canonical /tools/ page, the canonical page must carry
// accurate Scratch 3 blocks (no phantom "forever if", no pseudo-code "end"),
// the starter guide must offer a real downloadable .sb3, and both pages must
// fit 390px. Served from disk with a tiny static server.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.sb3':'application/octet-stream'};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail !== undefined ? ' , ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('about:') || u.startsWith('blob:')) req.continue();
    else req.abort();
  });

  /* ── canonical cheat sheet ── */
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${origin}/tools/scratch-cheatsheet.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.sheet-card');

  const sheet = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent.trim(),
    cards: document.querySelectorAll('.sheet-card').length,
    tables: document.querySelectorAll('.sheet-card table').length,
    text: document.body.innerText,
    html: document.documentElement.outerHTML
  }));
  check('h1 is the Scratch Block Reference Cheat Sheet', sheet.h1 === 'Scratch Block Reference Cheat Sheet', sheet.h1);
  check('8 category cards + Common Patterns render', sheet.cards === 9, String(sheet.cards));
  check('block tables render', sheet.tables === 6, String(sheet.tables));
  check('Scratch 3 blocks present (repeat until, when green flag clicked)',
    /repeat until/.test(sheet.text) && /when green flag clicked/.test(sheet.text));
  check('phantom "forever if" removed', !/forever if/.test(sheet.text));
  check('no pseudo-code "end" token in blocks', !/<\/span>end<\/span>/.test(sheet.html));
  check('starter guide is linked from the sheet', await page.$eval('a[href="scratch-starter-guide.html"]', a => !!a).catch(() => false));

  /* ── starter guide ── */
  await page.goto(`${origin}/tools/scratch-starter-guide.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.step-card');
  const guide = await page.evaluate(() => ({
    steps: document.querySelectorAll('.step-card').length,
    href: document.querySelector('a[href="scratch-starter.sb3"]')?.getAttribute('href') || null,
    hrefClass: document.querySelector('a[href="scratch-starter.sb3"]')?.className || null
  }));
  check('starter guide keeps its 8 steps', guide.steps === 8, String(guide.steps));
  check('starter guide offers the .sb3 download', guide.href === 'scratch-starter.sb3', String(guide.href));
  check('download button is styled', /btn-download/.test(guide.hrefClass || ''), String(guide.hrefClass));
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.step-card');
  const guideOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('starter guide fits 390px', guideOverflow <= 1, guideOverflow + 'px');

  /* ── canonical page mobile fit ── */
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${origin}/tools/scratch-cheatsheet.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sheet-card');
  const sheetOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('cheat sheet fits 390px', sheetOverflow <= 1, sheetOverflow + 'px');

  check('zero uncaught JS errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  /* ── duplicate page is now a forwarding stub ── */
  const stub = fs.readFileSync(path.join(ROOT, 'workshops', 'scratch-cheatsheet.html'), 'utf8');
  check('workshops cheat sheet is a redirect stub', /http-equiv=["']refresh["']/i.test(stub), 'refresh meta');
  check('stub forwards to the canonical tools page', /url=\.\.\/tools\/scratch-cheatsheet\.html/.test(stub));
  check('stub canonical points at the tools page', /<link rel="canonical" href="https:\/\/jvdesignstudio\.co\.uk\/tools\/scratch-cheatsheet\.html">/.test(stub));
  check('stub is noindex', /name="robots" content="noindex/.test(stub));

  /* ── real downloadable starter ── */
  const sb3Path = path.join(ROOT, 'tools', 'scratch-starter.sb3');
  const exists = fs.existsSync(sb3Path);
  check('scratch-starter.sb3 exists', exists);
  if (exists) {
    const buf = fs.readFileSync(sb3Path);
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
    const hasProject = buf.includes(Buffer.from('project.json'));
    check('starter is a zip (PK signature)', isZip);
    check('starter bundle contains project.json', hasProject);
  }

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nSCRATCH CHEAT SHEET HTTP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
