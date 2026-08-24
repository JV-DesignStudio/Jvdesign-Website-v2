// HTTP runtime verification for the Colour Palette Generator tool.
// Covers the regression-prone areas: lock/shuffle semantics, harmony mode,
// export buttons (the old quote-breaking onclick bug), save/load round-trip.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8131;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webp':'image/webp'};

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
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail !== undefined ? ' — ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/tools/colour-palette.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.mood-card');

  /* ── structure ── */
  const struct = await page.evaluate(() => ({
    moodCards: document.querySelectorAll('.mood-card').length,
    heroIsSectionSibling: document.querySelector('#main-content') && !document.querySelector('.main').closest('#main-content'),
    swatches: document.querySelectorAll('.swatch').length,
    viewportZoomable: !/user-scalable=no/i.test(document.querySelector('meta[name=viewport]').content)
  }));
  check('12 mood cards render', struct.moodCards === 12, String(struct.moodCards));
  check('hero section closed properly (.main not nested)', struct.heroIsSectionSibling);
  check('default palette renders 6 swatches', struct.swatches === 6, String(struct.swatches));
  check('pinch-zoom not disabled', struct.viewportZoomable);

  /* ── lock + shuffle semantics ── */
  await page.click('.swatch'); // lock swatch 0
  const lockedBefore = await page.$eval('.swatch-hex', el => el.textContent);
  const lockedClass = await page.$eval('.swatch', el => el.classList.contains('locked'));
  await page.click('button[onclick="shuffleUnlocked()"]');
  const afterUnlockShuffle = await page.$eval('.swatch-hex', el => el.textContent);
  check('lock applies to swatch 0', lockedClass);
  check('shuffle-unlocked preserves locked colour', afterUnlockShuffle === lockedBefore);

  await page.click('button[onclick="shufflePalette()"]');
  const afterFullShuffle = await page.$eval('.swatch-hex', el => el.textContent);
  check('full shuffle reshuffles even locked colour', afterFullShuffle !== lockedBefore, `${lockedBefore}→${afterFullShuffle}`);

  // Keyboard: Enter on focused swatch toggles lock back ON
  await page.focus('.swatch');
  await page.keyboard.press('Enter');
  const kbLocked = await page.$eval('.swatch', el => el.classList.contains('locked'));
  check('keyboard Enter toggles lock', kbLocked);

  /* ── switching mood clears locks ── */
  await page.evaluate(() => selectMood('ocean'));
  const lockAfterMoodSwitch = await page.evaluate(() => palette.some(p => p.locked));
  check('switching mood clears stale locks', !lockAfterMoodSwitch);

  /* ── harmony fills palette size ── */
  await page.evaluate(() => setHarmonyMode('complementary'));
  const harmonyCount = await page.$$eval('.swatch', els => els.length);
  check('complementary expands to full palette size', harmonyCount === 6, String(harmonyCount));

  /* ── exports survive quoting (old broken-copy bug) ── */
  const gdOk = await page.evaluate(() =>
    /^var color_1 = Color\("[0-9a-f]{6}"\)/.test(lastExports.gd) && lastExports.gd.split('\n').length === 6);
  const jsOk = await page.evaluate(() => /^const palette = \["#[0-9a-f]{6}".*\];$/.test(lastExports.js));
  check('GDScript export string well-formed', gdOk);
  check('hex-array export string well-formed', jsOk);

  // Clicking every export button must not throw and must surface the toast
  await page.$$eval('#exportFormats .copy-btn', btns => btns.forEach(b => b.click()));
  await new Promise(r => setTimeout(r, 300));
  const toastShown = await page.$eval('#toast', el => el.textContent.length > 0);
  check('all export buttons clickable without error', toastShown, await page.$eval('#toast', el => el.textContent));

  /* ── save / load round-trip with size sync ── */
  await page.$eval('#adjSize', el => { el.value = 8; el.dispatchEvent(new Event('input')); });
  const sizeSwatches = await page.$$eval('.swatch', els => els.length);
  check('size slider renders 8 swatches', sizeSwatches === 8, String(sizeSwatches));

  await page.click('button[onclick="savePalette()"]');
  const savedCount = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds_palettes')).length);
  check('save persists one palette', savedCount === 1, String(savedCount));

  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.saved-item');
  await page.click('.saved-item');
  await new Promise(r => setTimeout(r, 200));
  const synced = await page.$eval('#adjSize', el => el.value);
  check('loading 8-colour save syncs size slider', synced === '8', 'slider=' + synced);

  /* ── runtime errors ── */
  check('zero uncaught JS errors over HTTP', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nCOLOUR PALETTE HTTP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
