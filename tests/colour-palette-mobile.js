/* Palette Studio (tools/colour-palette.html) mobile / parity checks.

   Covers the Tool Parity bar for this page on a 390px touch device:
   - tap a mood card to generate a palette
   - tap a swatch to lock it, tap the hex to copy it
   - pick a custom colour with the touch-friendly colour box
   - the picked palette autosaves and reloads
   - Share Link builds a #palette= link
   - Ember touchpoint, labelled controls and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/colour-palette-mobile.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
async function tap(page, selector) {
  // Use page.evaluate click() - Puppeteer's el.tap() doesn't reliably fire
  // click handlers in headless mobile mode for elements below the viewport.
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); }
  }, selector);
  await new Promise(r => setTimeout(r, 60));
}

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // Skip the welcome modal and the shared first-run studio tour.
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jvds_palette_seen_v1', '1');
        localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true }));
      } catch (e) {}
    });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED|net::ERR/.test(text)) return;
      errors.push('console: ' + text.slice(0, 100));
    });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());

    const url = base + '/tools/colour-palette.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('.swatch', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 400));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.brief-ember') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      swatches: document.querySelectorAll('.swatch').length,
      pickers: document.querySelectorAll('.swatch-pick').length,
      pickerLabels: Array.from(document.querySelectorAll('.swatch-pick')).every(el => (el.getAttribute('aria-label') || '').length > 0),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('page title loads', /Palette Studio|Colour Palette/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('default palette shows swatches', shell.swatches >= 6, String(shell.swatches));
    check('every swatch has a colour picker', shell.pickers === shell.swatches, shell.pickers + '/' + shell.swatches);
    check('colour pickers carry labels', shell.pickerLabels);
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    // Tap a mood card to generate a fresh palette.
    await tap(page, '#mood-ocean');
    await new Promise(r => setTimeout(r, 350));
    const mood = await page.evaluate(() => ({
      name: document.getElementById('paletteName').textContent.trim(),
      swatches: document.querySelectorAll('.swatch').length
    }));
    check('a touch tap picks a mood', /ocean/i.test(mood.name), mood.name);
    check('mood generates a full palette', mood.swatches >= 6, String(mood.swatches));

    // Tap the first swatch to lock it.
    await tap(page, '.swatch');
    await new Promise(r => setTimeout(r, 300));
    const locked = await page.evaluate(() => palette[0].locked);
    check('a touch tap locks a swatch', locked === true, String(locked));

    // Tap the hex to copy it.
    await page.evaluate(() => {
      window.__copied = [];
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
    });
    await tap(page, '.swatch-hex');
    await new Promise(r => setTimeout(r, 250));
    const copiedHex = await page.evaluate(() => (window.__copied || []).find(t => /^#[0-9a-f]{6}$/i.test(t)) || '');
    check('a touch tap copies the hex', /^#[0-9a-f]{6}$/i.test(copiedHex), copiedHex);

    // Pick a custom colour with the touch colour box.
    const picked = await page.evaluate(async () => {
      const bgBefore = getComputedStyle(document.querySelector('.swatch')).backgroundColor;
      const inp = document.querySelector('.swatch-pick');
      inp.value = '#123456';
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 250));
      return {
        hex: palette[0].hex,
        adj: palette[0].adjHex,
        inputValue: document.querySelector('.swatch-pick').value,
        bgBefore,
        bg: getComputedStyle(document.querySelector('.swatch')).backgroundColor
      };
    });
    const rgb = (picked.bg.match(/\d+/g) || []).map(Number);
    const near = rgb.length >= 3 && Math.abs(rgb[0] - 18) <= 10 && Math.abs(rgb[1] - 52) <= 10 && Math.abs(rgb[2] - 86) <= 10;
    check('the colour box sets the swatch colour', picked.hex.toLowerCase() === '#123456', picked.hex);
    check('the swatch repaints with the picked colour', picked.bg !== picked.bgBefore && near, picked.bgBefore + ' -> ' + picked.bg);

    // Autosave (600ms) then reload: the picked palette comes back.
    await new Promise(r => setTimeout(r, 900));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const restored = await page.evaluate(() => ({ hex: (palette[0] || {}).hex, count: palette.length }));
    const restoredMatch = restored.hex && picked.adj && restored.hex.toLowerCase() === picked.adj.toLowerCase();
    check('picked palette autosaves and reloads', restoredMatch, 'saved=' + picked.adj + ' restored=' + restored.hex);

    // Share Link builds and copies a #palette= link.
    const shared = await page.evaluate(() => {
      window.__share = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__share = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      copyPaletteLink();
      return window.__share;
    });
    check('Share Link copies a #palette= URL', /#palette=/.test(shared), shared.slice(0, 56) + '...');

    // Desktop smoke: the same page boots clean at 1440.
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 500));
    const desktop = await page.evaluate(() => ({
      swatches: document.querySelectorAll('.swatch').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 palette boots', desktop.swatches >= 6, String(desktop.swatches));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS colour-palette-mobile: touch mood, lock, copy, custom pick, autosave and share work at 390');
})().catch(e => { console.error(e); process.exit(1); });
