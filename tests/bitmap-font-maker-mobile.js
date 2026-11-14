/* Bitmap Font Maker (tools/bitmap-font-maker.html) mobile / parity checks.

   Covers the Tool Parity bar for this page on a 390px touch device:
   - touch drawing on the character grid (real tap, not a mouse click)
   - undo restores the cleared glyph
   - autosave keeps the drawn glyph after a refresh
   - PNG export opens a download
   - labelled controls, Ember touchpoint and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/bitmap-font-maker-mobile.js
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
        localStorage.setItem('jvds_bitmapfont_seen_v1', '1');
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

    const url = base + '/tools/bitmap-font-maker.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const shell = await page.evaluate(() => {
      const name = el => {
        if (!el) return '';
        const lbl = el.id && document.querySelector('label[for="' + el.id + '"]');
        return (el.getAttribute('aria-label') || (lbl && lbl.textContent) || '').trim();
      };
      return {
        title: document.title,
        ember: ((document.querySelector('.brief-ember') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
        gridLabel: name(document.getElementById('grid-canvas')),
        textLabel: name(document.getElementById('pv-text')),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        api: typeof getArr === 'function' && typeof clearChar === 'function'
      };
    });
    check('page title loads', /Bitmap Font/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('character grid has an accessible name', !!shell.gridLabel, shell.gridLabel);
    check('preview text box has an accessible name', !!shell.textLabel, shell.textLabel);
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);
    check('editor API is ready', shell.api);

    // Clear the current glyph, then touch-tap one cell.
    const cell = await page.evaluate(() => {
      clearChar();
      const canvas = document.getElementById('grid-canvas');
      const r = canvas.getBoundingClientRect();
      const sx = canvas.width / r.width;
      const sy = canvas.height / r.height;
      const col = 2, row = 2;
      const px = BORDER + (CELL + BORDER) * col + CELL / 2;
      const py = BORDER + (CELL + BORDER) * row + CELL / 2;
      return { x: r.left + px / sx, y: r.top + py / sy, idx: row * GW + col };
    });
    await page.touchscreen.tap(cell.x, cell.y);
    await new Promise(r => setTimeout(r, 250));
    const drawn = await page.evaluate(i => getArr(currentChar)[i], cell.idx);
    check('a touch tap draws a pixel', drawn === 1, 'cell=' + drawn);

    await page.evaluate(async () => {
      document.querySelector('[aria-label="Undo"]').click();
      await new Promise(r => setTimeout(r, 250));
    });
    const undoneCell = await page.evaluate(i => getArr(currentChar)[i], cell.idx);
    check('undo puts the grid back', undoneCell === 0, 'cell=' + undoneCell);

    // Draw again, let autosave (800ms) run, then reload.
    await page.touchscreen.tap(cell.x, cell.y);
    await new Promise(r => setTimeout(r, 1100));
    const saved = await page.evaluate(() => { try { return localStorage.getItem('jvds_bitmapfont'); } catch (e) { return null; } });
    check('autosave writes the font to this device', !!saved && saved.indexOf('"chars"') >= 0);

    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const restored = await page.evaluate(i => getArr(currentChar)[i], cell.idx);
    check('autosaved glyph reloads after a refresh', restored === 1, 'cell=' + restored);

    // PNG export opens a download.
    const exported = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      exportPNG();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 3000);
    }));
    check('PNG export opens a download', exported === 'bitmap_font.png', exported);

    // Desktop smoke: the same page boots clean at 1440.
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));
    const desktop = await page.evaluate(() => ({
      api: typeof getArr === 'function',
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 editor boots', desktop.api);
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS bitmap-font-maker-mobile: touch draw, undo, autosave and PNG export work at 390');
})().catch(e => { console.error(e); process.exit(1); });
