const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let failures = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };
const delay = ms => new Promise(r => setTimeout(r, ms));

async function test(browser, base, w, h, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: w <= 480 });
  await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
  await delay(500);
  const before = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(`[${label}] no horizontal overflow`, before.sw <= before.cw + 1, before.sw + '/' + before.cw);

  const ham = await page.$('#navToggle');
  check(`[${label}] hamburger present`, !!ham);
  if (ham) {
    await page.click('#navToggle'); await delay(150);
    const open = await page.evaluate(() => document.getElementById('mainNav').classList.contains('open'));
    check(`[${label}] hamburger opens nav`, open);
    await page.keyboard.press('Escape'); await delay(150);
    const closed = await page.evaluate(() => !document.getElementById('mainNav').classList.contains('open'));
    check(`[${label}] Escape closes nav`, closed);
  }

  const more = await page.$('#moreDropdownBtn');
  if (more) {
    // At narrow widths the More button lives inside the collapsed nav, so open it first.
    await page.evaluate(() => { const n = document.getElementById('mainNav'); if (n && !n.classList.contains('open')) { const b = document.getElementById('navToggle'); if (b) b.click(); } });
    await delay(200);
    await page.evaluate(() => document.getElementById('moreDropdownBtn').click()); await delay(150);
    const st = await page.evaluate(() => ({ open: document.querySelector('.nav-dropdown').classList.contains('open'), exp: document.getElementById('moreDropdownBtn').getAttribute('aria-expanded') }));
    check(`[${label}] More menu opens + aria-expanded`, st.open && st.exp === 'true', JSON.stringify(st));
    // focus should be able to reach a menu item (keyboard)
    await page.evaluate(() => document.querySelector('.nav-dropdown-menu a') && document.querySelector('.nav-dropdown-menu a').focus());
    const focusedIn = await page.evaluate(() => !!document.activeElement && document.activeElement.closest('.nav-dropdown-menu'));
    check(`[${label}] keyboard focus reaches menu item`, focusedIn);
    await page.keyboard.press('Escape'); await delay(150);
    const closed2 = await page.evaluate(() => !document.querySelector('.nav-dropdown').classList.contains('open'));
    check(`[${label}] Escape closes More menu`, closed2);
    const backToBtn = await page.evaluate(() => document.activeElement && document.activeElement.id === 'moreDropdownBtn');
    check(`[${label}] focus returns to More button`, backToBtn);
  }

  // No focus trap: tabbing repeatedly must be able to leave the header/nav.
  await page.evaluate(() => document.body.focus());
  let escaped = false;
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); const inNav = await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.site-header')); if (!inNav) { escaped = true; break; } }
  check(`[${label}] no focus trap (Tab can leave header)`, escaped);

  await page.close();
}

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    await test(browser, base, 320, 568, '320x568');
    await test(browser, base, 375, 812, '375x812');
    await test(browser, base, 390, 844, '390x844');
    await test(browser, base, 844, 390, '844x390 landscape');
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? '\n' + failures + ' FAILED' : '\nALL NAV MOBILE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
