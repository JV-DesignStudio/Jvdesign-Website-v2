/* Tool Gallery (tools/gallery.html) mobile / parity checks.

   Covers the Tool Parity bar on a 390px touch device:
   - add a creation through the dialog with touch taps
   - filter by tool, filter autosaves and the URL carries ?filter=
   - Back restores the previous filter
   - Share this view copies the filtered link
   - keyboard arrows move the filter tabs
   - Export all downloads the gallery JSON
   - Ember touchpoint, labelled controls and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/gallery-mobile.js
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
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); } catch (e) {}
    });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED|net::ERR|google-analytics|googletagmanager/.test(text)) return;
      errors.push('console: ' + text.slice(0, 100));
    });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());

    const url = base + '/tools/gallery.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.brief-ember') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      chips: document.querySelectorAll('.chip[role="tab"][aria-controls="grid"]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('page title loads', /Gallery/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('filter chips are labelled tabs', shell.chips === 5, String(shell.chips));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    // Add one creation through the dialog with touch taps.
    await tap(page, '#btnAdd');
    await page.type('#fTitle', 'Touch Hero');
    await page.select('#fTool', 'pixel');
    await tap(page, '#btnSave');
    await new Promise(r => setTimeout(r, 800));
    const added = await page.evaluate(() => ({ cards: document.querySelectorAll('#grid .card').length, empty: document.getElementById('empty').hidden }));
    check('a touch tap adds a creation', added.cards === 1, 'cards=' + added.cards);

    // Filter to pixel, check URL + saved filter + Back.
    await tap(page, '.chip[data-filter="pixel"]');
    await new Promise(r => setTimeout(r, 400));
    const filtered = await page.evaluate(() => ({
      selected: document.querySelector('.chip[data-filter="pixel"]').getAttribute('aria-selected'),
      saved: localStorage.getItem('jvds_gallery_filter'),
      search: location.search,
      backHidden: document.getElementById('btnBack').hidden,
      cards: document.querySelectorAll('#grid .card').length
    }));
    check('a touch tap filters the gallery', filtered.selected === 'true' && filtered.cards === 1, JSON.stringify(filtered));
    check('the filter is written to the URL', /filter=pixel/.test(filtered.search), filtered.search);
    check('the filter autosaves', filtered.saved === 'pixel', String(filtered.saved));
    check('Back appears after a filter change', filtered.backHidden === false);

    // Reload: the filter comes back from storage.
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const restored = await page.evaluate(() => ({
      selected: document.querySelector('.chip[data-filter="pixel"]').getAttribute('aria-selected'),
      saved: localStorage.getItem('jvds_gallery_filter')
    }));
    check('the filter restores after reload', restored.selected === 'true' && restored.saved === 'pixel', JSON.stringify(restored));

    // Change filter, then Back returns to the filtered view.
    await tap(page, '.chip[data-filter="all"]');
    await new Promise(r => setTimeout(r, 300));
    const backShown = await page.evaluate(() => document.getElementById('btnBack').hidden === false);
    check('Back appears after a filter change', backShown);
    await tap(page, '#btnBack');
    await new Promise(r => setTimeout(r, 300));
    const backed = await page.evaluate(() => ({
      selected: document.querySelector('.chip[data-filter="pixel"]').getAttribute('aria-selected'),
      backHidden: document.getElementById('btnBack').hidden,
      search: location.search
    }));
    check('Back restores the previous filter', backed.selected === 'true' && backed.backHidden === true, JSON.stringify(backed));
    check('Back keeps the filtered URL', /filter=pixel/.test(backed.search), backed.search);

    // Share the filtered view.
    await tap(page, '.chip[data-filter="pixel"]');
    await new Promise(r => setTimeout(r, 300));
    const shared = await page.evaluate(() => {
      window.__share = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__share = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      window.shareGalleryView();
      return window.__share;
    });
    check('Share this view copies a ?filter= link', /filter=pixel/.test(shared), shared.slice(0, 64) + '...');

    // Keyboard arrows move the tabs.
    const keys = await page.evaluate(async () => {
      const chips = Array.from(document.querySelectorAll('.chip'));
      chips[1].focus();
      chips[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      return {
        audio: document.querySelector('.chip[data-filter="audio"]').getAttribute('aria-selected'),
        active: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.filter : ''
      };
    });
    check('arrow keys move and select the next filter', keys.audio === 'true' && keys.active === 'audio', JSON.stringify(keys));

    // Export all downloads JSON.
    const exported = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      document.getElementById('btnExport').click();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 3000);
    }));
    check('Export all downloads the gallery JSON', /\.json$/i.test(exported || ''), exported);

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await page.evaluate(() => ({
      chips: document.querySelectorAll('.chip').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 gallery boots', desktop.chips === 5, String(desktop.chips));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS gallery-mobile: touch add, filter autosave, share, back and export work at 390');
})().catch(e => { console.error(e); process.exit(1); });
