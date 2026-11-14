/* Icon Generator (tools/icon-generator.html) mobile / parity checks.

   Covers the Tool Parity bar for this page on a 390px touch device:
   - tap a symbol, a palette and a background style
   - change the accent with the native colour input
   - the design autosaves and reloads
   - a size button exports a PNG
   - Share Link builds a #icon= link
   - Ember touchpoint, labelled controls and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/icon-generator-mobile.js
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
  const el = await page.$(selector);
  if (!el) throw new Error('missing selector ' + selector);
  await el.tap();
}

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // Skip the welcome overlay and the shared first-run studio tour.
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jvds_icon_seen', '1');
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

    const url = base + '/tools/icon-generator.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.brief-ember') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      canvases: document.querySelectorAll('canvas').length,
      labelled: document.querySelectorAll('#symbolGrid button[aria-label], #paletteGrid button[aria-label]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlay: document.getElementById('ig-overlay').classList.contains('show')
    }));
    check('page title loads', /Icon Generator/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('three preview canvases render', shell.canvases === 3, String(shell.canvases));
    check('symbol and palette buttons carry labels', shell.labelled >= 10, String(shell.labelled));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);
    check('welcome overlay stays closed', shell.overlay === false);

    const before = await page.evaluate(() => ({
      symbol: state.symbol,
      palette: state.palette,
      bg: state.bgStyle,
      paint: document.getElementById('cvMain').toDataURL().length
    }));

    // Tap a different symbol.
    const nextSymbol = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('#symbolGrid button[data-id]')).map(b => b.dataset.id);
      return ids.find(id => id !== state.symbol) || ids[0];
    });
    await tap(page, `#symbolGrid button[data-id="${nextSymbol}"]`);
    await new Promise(r => setTimeout(r, 300));
    const afterSymbol = await page.evaluate(() => ({
      symbol: state.symbol,
      paint: document.getElementById('cvMain').toDataURL().length
    }));
    check('a touch tap picks a symbol', afterSymbol.symbol === nextSymbol && afterSymbol.symbol !== before.symbol, nextSymbol);
    check('picking a symbol repaints the preview', afterSymbol.paint !== before.paint);

    // Tap a palette chip.
    const paletteId = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('#paletteGrid button[data-id]')).map(b => b.dataset.id);
      return ids.find(id => id !== state.palette) || ids[0];
    });
    await tap(page, `#paletteGrid button[data-id="${paletteId}"]`);
    await new Promise(r => setTimeout(r, 250));
    const afterPalette = await page.evaluate(() => ({ palette: state.palette, accent: state.accent }));
    check('a touch tap picks a palette', afterPalette.palette === paletteId, paletteId + ' accent ' + afterPalette.accent);

    // Tap a background style.
    const bgId = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('#bgGrid button[data-id]')).map(b => b.dataset.id);
      return ids.find(id => id !== state.bgStyle) || ids[0];
    });
    await tap(page, `#bgGrid button[data-id="${bgId}"]`);
    await new Promise(r => setTimeout(r, 250));
    const afterBg = await page.evaluate(() => state.bgStyle);
    check('a touch tap picks a background', afterBg === bgId, bgId);

    // Pick an accent colour with the native colour input.
    const accent = await page.evaluate(async () => {
      const inp = document.getElementById('inAccent');
      inp.value = '#00d4aa';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 250));
      return { accent: state.accent, input: inp.value };
    });
    check('the accent colour input updates the design', accent.accent.toLowerCase() === '#00d4aa', accent.accent);

    // Autosave (600ms) then reload: the symbol and accent come back.
    await new Promise(r => setTimeout(r, 900));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    const restored = await page.evaluate(() => ({ symbol: state.symbol, accent: state.accent }));
    check('design autosaves and reloads', restored.symbol === nextSymbol && restored.accent.toLowerCase() === '#00d4aa', JSON.stringify(restored));

    // A size button downloads a PNG.
    const exported = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      document.querySelector('[data-on="exportSize"]').click();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 3000);
    }));
    check('a size button exports a PNG', /\.png$/i.test(exported || ''), exported);

    // Share Link builds and copies a #icon= link.
    const shared = await page.evaluate(() => {
      window.__share = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__share = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      copyIconShareLink();
      return window.__share;
    });
    check('Share Link copies a #icon= URL', /#icon=/.test(shared), shared.slice(0, 56) + '...');

    // Desktop smoke: the same page boots clean at 1440.
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 editor boots', desktop.canvases === 3, String(desktop.canvases));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS icon-generator-mobile: touch symbol, palette, background, accent, autosave, export and share work at 390');
})().catch(e => { console.error(e); process.exit(1); });
