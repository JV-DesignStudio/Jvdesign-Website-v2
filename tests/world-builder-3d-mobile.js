/* World Builder (workshops/world-builder-3d.html) mobile / parity checks.

   Covers the Tool Parity bar for this studio on a 390px touch device:
   - tap tabs, the example, palette pieces and the export/debug panels
   - touch-drag the 3D canvas to orbit the camera
   - the level autosaves and reloads
   - Download builds a real .zip for the level
   - Ember touchpoint, labelled tabs and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/world-builder-3d-mobile.js
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

    const url = base + '/workshops/world-builder-3d.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    if (await page.$('#cookie-decline')) await page.tap('#cookie-decline');
    await new Promise(r => setTimeout(r, 700));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: /Ember says/i.test(document.body.innerText),
      tabs: document.querySelectorAll('.wbs-tab[role="tab"][aria-controls]').length,
      labelled: document.querySelectorAll('.wbs-tab[aria-controls], .wbs-tool[aria-label], .wbs-swatch[aria-label]').length,
      canvases: document.querySelectorAll('#vxCanvas').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('page title loads', /World Builder/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', shell.ember);
    check('five labelled tabs', shell.tabs === 5, String(shell.tabs));
    check('controls carry labels', shell.labelled >= 5, String(shell.labelled));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);
    check('the 3D canvas renders', shell.canvases === 1);

    await tap(page, '#vxExample');
    await new Promise(r => setTimeout(r, 300));
    const built = await page.evaluate(() => ({ count: window.WLD_count ? window.WLD_count() : 0, obj: window.WLD_buildOBJ ? window.WLD_buildOBJ() : '' }));
    check('a touch tap builds the example level', built.count > 0, 'pieces=' + built.count);
    check('the level exports a real OBJ', /^o level/m.test(built.obj) && /^v /m.test(built.obj), 'len=' + (built.obj || '').length);

    // Touch-drag the canvas: the camera yaw must change and the canvas repaint.
    const orbit = await page.evaluate(async () => {
      const cv = document.getElementById('vxCanvas');
      const r = cv.getBoundingClientRect();
      const before = cv.toDataURL();
      const countBefore = window.WLD_count ? window.WLD_count() : 0;
      const fire = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y }));
      fire('pointerdown', r.left + 20, r.top + 20);
      fire('pointermove', r.left + 120, r.top + 60);
      fire('pointerup', r.left + 120, r.top + 60);
      await new Promise(res => setTimeout(res, 250));
      return { repainted: cv.toDataURL() !== before, countBefore, countAfter: window.WLD_count ? window.WLD_count() : 0 };
    });
    check('a touch drag orbits the camera', orbit.repainted === true, JSON.stringify({ repainted: orbit.repainted }));
    check('a drag does not place a piece', orbit.countAfter === orbit.countBefore, orbit.countBefore + ' -> ' + orbit.countAfter);

    // Autosave: reload and the level is still there.
    await new Promise(r => setTimeout(r, 500));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    const restored = await page.evaluate(() => window.WLD_count ? window.WLD_count() : 0);
    check('the level autosaves and reloads', restored > 0, 'pieces=' + restored);

    // Export tab + download builds a zip.
    await tap(page, '#tab-export');
    await new Promise(r => setTimeout(r, 250));
    const exportOpen = await page.evaluate(() => document.getElementById('panel-export').classList.contains('is-active'));
    check('the export tab opens', exportOpen);
    const downloaded = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      document.getElementById('gmDownload').click();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 3000);
    }));
    check('Download builds a project zip', /\.zip$/i.test(downloaded || ''), downloaded);

    // Debug tab accepts a correct fix.
    await tap(page, '#tab-debug');
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => { const e = document.querySelector('#gmLog .err'); if (e) e.click(); const o = document.querySelector('#gmOptions .wbs-dbg-opt'); if (o) o.click(); });
    await new Promise(r => setTimeout(r, 200));
    const dbg = await page.evaluate(() => !!document.querySelector('#gmOptions .is-correct'));
    check('the debug check accepts a correct fix', dbg);

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await page.evaluate(() => ({
      tabs: document.querySelectorAll('.wbs-tab').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 studio boots', desktop.tabs === 5, String(desktop.tabs));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS world-builder-3d-mobile: touch tabs, example, orbit, autosave, export and debug work at 390');
})().catch(e => { console.error(e); process.exit(1); });
