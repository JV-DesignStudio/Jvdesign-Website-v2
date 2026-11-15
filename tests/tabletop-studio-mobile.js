/* Tabletop Studio (tools/tabletop-studio.html) mobile / parity checks.

   Separate 390px proof for the Tool Parity bar (the main http suite is one
   very large file). Covers:
   - toolbox drawer open/close and 40px touch targets
   - touch painting on the board without scrolling the page
   - tapping a piece onto the board, undo and redo
   - save to this browser, PNG export and a TT3 share code
   - Ember touchpoint, labelled controls, no horizontal overflow
   - clean boot at 1440

   Run: node tests/tabletop-studio-mobile.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mjs': 'application/javascript', '.mp3': 'audio/mpeg' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true }));
        localStorage.setItem('jvds-cookie-consent', 'declined');
        if (!sessionStorage.getItem('__tt_test_cleared')) {
          sessionStorage.setItem('__tt_test_cleared', '1');
          localStorage.removeItem('jvds-tabletop-v1');
          localStorage.removeItem('jvds-tabletop-v2');
        }
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

    const url = base + '/tools/tabletop-studio.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 15000 });
    await wait(400);

    const shell = await page.evaluate(() => {
      const zoom = document.getElementById('ttZoomIn').getBoundingClientRect();
      const ember = (document.body.innerText.match(/Ember[^\n]{0,80}/i) || [''])[0];
      return {
        title: document.title,
        ember,
        canvas: !!document.getElementById('ttBoard'),
        labels: document.querySelectorAll('[aria-label]').length,
        zoomW: Math.round(zoom.width),
        zoomH: Math.round(zoom.height),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    check('page title loads', /Tabletop Studio/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember/i.test(shell.ember), shell.ember.slice(0, 60));
    check('board canvas exists', shell.canvas);
    check('controls carry aria labels', shell.labels >= 30, String(shell.labels));
    check('zoom button is touch sized', shell.zoomW >= 40 && shell.zoomH >= 40, shell.zoomW + 'x' + shell.zoomH);
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    // Toolbox drawer.
    await page.tap('#ttPiecesOpen');
    await wait(400);
    const drawer = await page.evaluate(() => ({
      open: document.getElementById('ttSidebar').classList.contains('open'),
      expanded: document.getElementById('ttSidebarOpen').getAttribute('aria-expanded'),
      pieceVisible: !!document.querySelector('#ttPieces [data-piece]')
    }));
    check('pieces button opens the toolbox', drawer.open && drawer.expanded === 'true' && drawer.pieceVisible, JSON.stringify(drawer));

    // Load a starter and pick lava, then close the drawer.
    await page.tap('.tt-starters [data-template="dungeon"]');
    await wait(500);
    await page.tap('[data-terrain="lava"]');
    await page.tap('#ttSidebarClose');
    await wait(350);

    const touchRect = await page.$eval('#ttBoard', el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, scrollY: window.scrollY };
    });
    const beforeTouch = await page.evaluate(() => ({
      canvas: document.getElementById('ttBoard').toDataURL().length,
      scrollY: window.scrollY
    }));
    const cdp = await page.target().createCDPSession();
    const ty = touchRect.y + touchRect.h * 0.5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchRect.x + touchRect.w * 0.25, y: ty, id: 0 }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchRect.x + touchRect.w * (0.25 + i * 0.06), y: ty, id: 0 }] });
      await wait(35);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(300);
    const afterTouch = await page.evaluate(() => ({
      canvas: document.getElementById('ttBoard').toDataURL().length,
      scrollY: window.scrollY
    }));
    check('touch painting changes the board', afterTouch.canvas !== beforeTouch.canvas, beforeTouch.canvas + ' -> ' + afterTouch.canvas);
    check('touch painting does not scroll the page', afterTouch.scrollY === beforeTouch.scrollY, beforeTouch.scrollY + ' -> ' + afterTouch.scrollY);

    // Tap a piece onto the board, then undo and redo.
    const tokensBefore = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token').length);
    await page.tap('#ttPiecesOpen');
    await wait(350);
    await page.tap('#ttPieces [data-piece]');
    await wait(400);
    await page.tap('#ttSidebarClose');
    await wait(300);
    const tokensAfter = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token').length);
    check('a touch tap places a piece', tokensAfter === tokensBefore + 1, tokensBefore + ' -> ' + tokensAfter);
    await page.tap('#ttUndo');
    await wait(300);
    const tokensUndone = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token').length);
    check('undo removes the placed piece', tokensUndone === tokensBefore, tokensBefore + ' -> ' + tokensUndone);
    await page.tap('#ttRedo');
    await wait(300);
    const tokensRedone = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token').length);
    check('redo puts the piece back', tokensRedone === tokensAfter, tokensAfter + ' -> ' + tokensRedone);

    // Save to this browser.
    await page.tap('#ttSave');
    await wait(400);
    const saved = await page.evaluate(() => {
      let lib = null;
      try { lib = JSON.parse(localStorage.getItem('jvds-tabletop-v2') || 'null'); } catch (e) {}
      return {
        boards: lib && Array.isArray(lib.boards) ? lib.boards.length : 0,
        state: (document.getElementById('ttSaved') || {}).textContent || ''
      };
    });
    check('save writes the board library', saved.boards >= 1, JSON.stringify(saved));
    check('save shows the saved state', /Saved/i.test(saved.state), saved.state);

    // PNG export.
    const exported = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      document.getElementById('ttExport').click();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 4000);
    }));
    check('picture export downloads a PNG', /\.png$/i.test(exported || ''), exported);

    // Share code (the control lives in the closed toolbox on mobile).
    await page.evaluate(() => document.getElementById('ttShareCopy').click());
    await wait(300);
    const share = await page.evaluate(() => (document.getElementById('ttShareCode') || {}).value || '');
    check('share code is generated', /^TT3-/.test(share), String(share).slice(0, 24) + '...');

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    // Desktop smoke in a fresh tab.
    const desk = await browser.newPage();
    await desk.setViewport({ width: 1440, height: 900 });
    await desk.goto(url, { waitUntil: 'load', timeout: 30000 });
    await desk.waitForSelector('#ttTerrain .tt-swatch', { timeout: 15000 });
    await wait(500);
    const desktop = await desk.evaluate(() => ({
      canvas: !!document.getElementById('ttBoard'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 editor boots', desktop.canvas);
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);
    await desk.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS tabletop-studio-mobile: toolbox, touch painting, pieces, undo/redo, save, PNG and share work at 390');
})().catch(e => { console.error(e); process.exit(1); });
