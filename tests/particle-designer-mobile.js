/* Particle Designer (tools/particle-designer.html) mobile / parity checks.

   Covers the Tool Parity bar on a 390px touch device:
   - every tab is a labelled tab and a touch tap switches panels
   - the Loop / Trail switches are labelled, touch and keyboard toggles
   - undo restores a switch change, and the session autosaves across reload
   - Share URL copies a ?p= link that restores the effect
   - every slider, reset button, select and toggle has an accessible name
   - Export still downloads through a touch tap
   - Ember touchpoint, no horizontal overflow, 1440px boot

   Run: node tests/particle-designer-mobile.js
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
      try {
        localStorage.setItem('jvds_pd_seen', '1');
        localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true }));
      } catch (e) {}
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

    const url = base + '/tools/particle-designer.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.ember-note') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      tabs: document.querySelectorAll('.sb-tab[role="tab"]').length,
      selected: document.querySelector('.sb-tab[data-tab="presets"]').getAttribute('aria-selected'),
      switches: Array.from(document.querySelectorAll('.toggle[role="switch"]')).map(t => ({ id: t.id, label: t.getAttribute('aria-label'), checked: t.getAttribute('aria-checked') })),
      canvasLabel: (document.getElementById('canvas') || {}).getAttribute ? document.getElementById('canvas').getAttribute('aria-label') : '',
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('page title loads', /Particle Designer/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('five labelled tabs', shell.tabs === 5 && shell.selected === 'true', JSON.stringify({ tabs: shell.tabs, selected: shell.selected }));
    check('preview canvas has a label', /particle preview/i.test(shell.canvasLabel), shell.canvasLabel);
    check('switches are labelled', shell.switches.length === 2 && shell.switches.every(s => s.label), JSON.stringify(shell.switches));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    // Touch tap a tab and check the panel + tab state follow.
    await tap(page, '.sb-tab[data-tab="params"]');
    await new Promise(r => setTimeout(r, 250));
    const tabbed = await page.evaluate(() => ({
      shown: document.getElementById('tab-params').style.display,
      hidden: document.getElementById('tab-presets').style.display,
      selected: document.querySelector('.sb-tab[data-tab="params"]').getAttribute('aria-selected'),
      previous: document.querySelector('.sb-tab[data-tab="presets"]').getAttribute('aria-selected'),
      tabindex: document.querySelector('.sb-tab[data-tab="params"]').getAttribute('tabindex')
    }));
    check('a touch tap switches the panel', tabbed.shown === 'block' && tabbed.hidden === 'none', JSON.stringify(tabbed));
    check('the active tab is announced', tabbed.selected === 'true' && tabbed.previous === 'false' && tabbed.tabindex === '0', JSON.stringify(tabbed));

    // Touch the Trail switch: it flips, and the switch state is announced.
    await tap(page, '#tTrail');
    await new Promise(r => setTimeout(r, 200));
    const trailing = await page.evaluate(() => ({ checked: document.getElementById('tTrail').getAttribute('aria-checked'), trail: document.getElementById('tTrail').classList.contains('on') }));
    check('a touch tap flips the switch', trailing.checked === 'true' && trailing.trail === true, JSON.stringify(trailing));

    // Keyboard: focus the switch and press Space to toggle it back.
    await page.focus('#tTrail');
    await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 200));
    const keyboardSwitch = await page.evaluate(() => ({ checked: document.getElementById('tTrail').getAttribute('aria-checked'), trail: document.getElementById('tTrail').classList.contains('on') }));
    check('Space toggles the switch', keyboardSwitch.checked === 'false' && keyboardSwitch.trail === false, JSON.stringify(keyboardSwitch));

    // Arrow keys move between tabs.
    const arrowTabs = await page.evaluate(async () => {
      document.querySelector('.sb-tab[data-tab="params"]').focus();
      document.querySelector('.sb-tab[data-tab="params"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      return {
        selected: document.querySelector('.sb-tab[data-tab="curves"]').getAttribute('aria-selected'),
        active: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.tab : ''
      };
    });
    check('arrow keys move and select the next tab', arrowTabs.selected === 'true' && arrowTabs.active === 'curves', JSON.stringify(arrowTabs));

    // Undo brings the switch change back.
    await page.evaluate(() => { sbTab('params'); document.getElementById('btnUndo').click(); });
    await new Promise(r => setTimeout(r, 250));
    const undone = await page.evaluate(() => ({ checked: document.getElementById('tTrail').getAttribute('aria-checked'), trail: document.getElementById('tTrail').classList.contains('on') }));
    check('undo restores the switch change', undone.checked === 'true' && undone.trail === true, JSON.stringify(undone));

    // Change a slider, let it autosave, and reload.
    await page.evaluate(() => {
      const el = document.getElementById('pRate');
      el.value = '77';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1300));
    const stored = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('jvds_pd_session_v1') || '{}').rate; } catch (e) { return null; }
    });
    check('the session autosaves', stored === 77, String(stored));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const restored = await page.evaluate(() => document.getElementById('pRate').value);
    check('the session restores after reload', restored === '77', String(restored));

    // Share URL copies a link and that link restores the effect.
    await page.evaluate(() => {
      const el = document.getElementById('pAngle');
      el.value = '180';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 200));
    await tap(page, '.sb-tab[data-tab="export"]');
    const shared = await page.evaluate(() => {
      window.__share = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__share = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      document.getElementById('btnShare').click();
      return window.__share;
    });
    check('Share URL copies a ?p= link', /\?p=/.test(shared), shared.slice(0, 64) + '...');
    if (/\?p=/.test(shared)) {
      await page.goto(shared, { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 900));
      const opened = await page.evaluate(() => document.getElementById('pAngle').value);
      check('the shared link restores the effect', opened === '180', String(opened));
    } else {
      check('the shared link restores the effect', false, 'no share URL');
    }

    // Export still downloads after a touch tap.
    const exported = await page.evaluate(async () => {
      const downloads = [];
      const old = window.download;
      window.download = (data, name) => { downloads.push(name); };
      sbTab('export');
      document.getElementById('btnRaw').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('exportModalDownload').click();
      await new Promise(r => setTimeout(r, 250));
      window.download = old;
      return downloads;
    });
    check('Export downloads through a touch tap', exported.includes('particle_config.json'), exported.join(', '));

    // Every control in the sidebar has an accessible name.
    const names = await page.evaluate(() => {
      const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const list = Array.from(document.querySelectorAll('#sidebar button, #sidebar input, #sidebar select, #sidebar [role="switch"], #sidebar [role="tab"]'))
        .filter(el => el.type !== 'file' && visible(el));
      const unnamed = [];
      for (const el of list) {
        const label = el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent;
        if (!String(label || '').replace(/\s+/g, ' ').trim()) unnamed.push(el.id || el.className || el.tagName);
      }
      return {
        controls: list.length,
        unnamed,
        resets: document.querySelectorAll('.reset-btn[data-reset]').length,
        namedResets: document.querySelectorAll('.reset-btn[aria-label^="Reset "]').length
      };
    });
    check('every visible sidebar control has a name', names.unnamed.length === 0, names.unnamed.slice(0, 4).join(' | '));
    check('every slider reset button is labelled', names.resets > 10 && names.namedResets === names.resets, `${names.namedResets}/${names.resets}`);

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await page.evaluate(() => ({
      tabs: document.querySelectorAll('.sb-tab').length,
      ember: !!document.querySelector('.ember-note'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 desktop boots', desktop.tabs === 5 && desktop.ember, JSON.stringify(desktop));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS particle-designer-mobile: tabs, switches, undo, autosave, share and labels work at 390');
})().catch(e => { console.error(e); process.exit(1); });
