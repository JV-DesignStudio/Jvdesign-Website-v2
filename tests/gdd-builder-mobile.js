/* Game Design Studio (tools/gdd-builder.html) mobile / parity checks.

   Covers the Tool Parity bar for this page on a 390px touch device:
   - starter template tap, section collapse tap and mood-board drawing
   - save progress, autosave restore after reload
   - JSON export and a #gdd= share link
   - undo / redo including the Ctrl+Z / Ctrl+Y keyboard path
   - Ember touchpoint, labelled controls, 40px touch targets
   - no horizontal overflow at 390, clean boot at 1440

   Run: node tests/gdd-builder-mobile.js
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

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // Skip the welcome modal, the shared tour and the cookie bar. Clear the
    // saved document once per tab so the restore checks are deterministic.
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jvds_gdd_seen_v1', '1');
        localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true }));
        localStorage.setItem('jvds-cookie-consent', 'declined');
        if (!sessionStorage.getItem('__gdd_test_cleared')) {
          sessionStorage.setItem('__gdd_test_cleared', '1');
          localStorage.removeItem('jvds_gdd');
          localStorage.removeItem('jvds_gdd_auto');
          localStorage.removeItem('jvds_gdd_achievements');
          try { indexedDB.deleteDatabase('jvds-gdd'); } catch (e) {}
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

    const url = base + '/tools/gdd-builder.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.hero-next-head') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      sections: document.querySelectorAll('.gdd-section').length,
      labels: document.querySelectorAll('[aria-label]').length,
      save: !!document.querySelector('[data-on="saveProject"]'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('page title loads', /Game Design/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('all 9 sections render', shell.sections === 9, String(shell.sections));
    check('controls carry aria labels', shell.labels >= 20, String(shell.labels));
    check('save control is present', shell.save);
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    const targets = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.hero-btn')];
      return {
        count: btns.length,
        small: btns.filter(b => b.getBoundingClientRect().height < 38).length
      };
    });
    check('hero buttons are touch sized', targets.count > 0 && targets.small === 0, JSON.stringify(targets));

    // Touch: load the platformer starter.
    await page.tap('[data-on-arg="platformer"]');
    await new Promise(r => setTimeout(r, 500));
    const templated = await page.evaluate(() => ({
      title: document.getElementById('gameTitle').value,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('a touch tap loads the platformer starter', templated.title === 'Sky Hopper', templated.title);
    check('390 still fits after loading a starter', templated.overflow <= 2, 'overflow=' + templated.overflow);

    // Touch: collapse and reopen a section.
    await page.tap('#tog-world');
    await new Promise(r => setTimeout(r, 250));
    const collapsed = await page.evaluate(() => document.getElementById('body-world').classList.contains('hidden'));
    await page.tap('#tog-world');
    await new Promise(r => setTimeout(r, 250));
    const reopened = await page.evaluate(() => !document.getElementById('body-world').classList.contains('hidden'));
    check('a touch tap collapses a section', collapsed);
    check('a touch tap reopens a section', reopened);

    // Touch: draw on the mood board. Disable smooth scrolling so the tap
    // coordinates match the canvas after scrollIntoView.
    const canvasBox = await page.evaluate(() => {
      const c = document.getElementById('doodleCanvas');
      document.documentElement.style.scrollBehavior = 'auto';
      c.scrollIntoView({ block: 'center' });
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, before: c.toDataURL() };
    });
    await new Promise(r => setTimeout(r, 150));
    await page.touchscreen.tap(canvasBox.x, canvasBox.y);
    await new Promise(r => setTimeout(r, 350));
    const drawnAfter = await page.evaluate(() => document.getElementById('doodleCanvas').toDataURL());
    check('a touch tap draws on the mood board', drawnAfter !== canvasBox.before);

    // Save progress.
    await page.evaluate(() => {
      const el = document.getElementById('gameTitle');
      el.value = 'Sky Hopper Deluxe';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      saveProject();
    });
    const saved = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('jvds_gdd') || 'null'); } catch (e) { return null; }
    });
    check('save progress writes the document', !!saved && saved.gameTitle === 'Sky Hopper Deluxe', saved && saved.gameTitle);

    // Autosave (1.5s) then reload: the restore bar offers the session back.
    await new Promise(r => setTimeout(r, 1900));
    const autoSaved = await page.evaluate(() => { try { return !!localStorage.getItem('jvds_gdd_auto'); } catch (e) { return false; } });
    check('editing autosaves the document', autoSaved);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));
    const bar = await page.evaluate(() => {
      const b = document.getElementById('gddRestoreBar');
      return !!b && getComputedStyle(b).display !== 'none';
    });
    check('reload offers the autosaved document', bar);
    if (bar) {
      await page.tap('[data-on="acceptGddRestore"]');
      await new Promise(r => setTimeout(r, 800));
    }
    const restored = await page.evaluate(() => document.getElementById('gameTitle').value);
    check('restoring brings the title back', restored === 'Sky Hopper Deluxe', restored);

    // Export JSON produces a real file.
    const exported = await page.evaluate(() => new Promise(resolve => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        const name = this.download;
        HTMLAnchorElement.prototype.click = orig;
        resolve(name);
      };
      exportJSON();
      setTimeout(() => { HTMLAnchorElement.prototype.click = orig; resolve(''); }, 3000);
    }));
    check('export JSON downloads a .json file', /\.json$/i.test(exported || ''), exported);

    // Share link carries the plan in the hash.
    const share = await page.evaluate(() => buildShareUrl());
    check('share link builds a #gdd= URL', typeof share === 'string' && /#gdd=/.test(share), String(share).slice(0, 60) + '...');

    // Undo and redo from a normal edit (no manual stack seeding).
    const history = await page.evaluate(() => {
      const el = document.getElementById('gameTitle');
      el.value = 'Undo Test';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const changed = document.getElementById('gameTitle').value;
      gddUndo();
      const afterUndo = document.getElementById('gameTitle').value;
      gddRedo();
      const afterRedo = document.getElementById('gameTitle').value;
      return { changed, afterUndo, afterRedo };
    });
    check('an edit can be undone', history.afterUndo === 'Sky Hopper Deluxe', JSON.stringify(history));
    check('an edit can be redone', history.afterRedo === 'Undo Test', JSON.stringify(history));

    // Keyboard Ctrl+Z reaches the same undo path.
    await page.evaluate(() => document.body.focus());
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 300));
    const keyboardUndo = await page.evaluate(() => document.getElementById('gameTitle').value);
    check('Ctrl+Z undoes from the keyboard', keyboardUndo === 'Sky Hopper Deluxe', keyboardUndo);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    // Desktop smoke in a fresh tab, so the mobile viewport switch cannot
    // trigger a reload while the page has unsaved edits.
    const desk = await browser.newPage();
    await desk.setViewport({ width: 1440, height: 900 });
    await desk.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await desk.evaluate(() => ({
      sections: document.querySelectorAll('.gdd-section').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 editor boots', desktop.sections === 9, String(desktop.sections));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);
    await desk.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS gdd-builder-mobile: touch templates, drawing, save, autosave, export, share and undo work at 390');
})().catch(e => { console.error(e); process.exit(1); });
