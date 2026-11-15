/* Accessibility tool (tools/accessibility.html) mobile / parity checks.

   Covers the Tool Parity bar on a 390px touch device:
   - tap the motion, contrast and reading-font switches
   - change text size with the select
   - settings autosave and reload
   - Undo reverts the last change
   - Export downloads settings JSON
   - Share builds an #a11y= link and the link restores settings
   - Ember touchpoint, labelled controls and no horizontal overflow
   - 1440px boot + layout stays clean

   Run: node tests/accessibility-mobile.js
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
const readState = (page) => page.evaluate(() => ({
  motion: state.motion, contrast: state.contrast, font: state.font, textSize: state.textSize,
  rootSize: document.documentElement.style.fontSize,
  className: document.body.className,
  motionName: getComputedStyle(document.getElementById('motionPreview').firstElementChild).animationName
}));

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

    const url = base + '/tools/accessibility.html';
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const shell = await page.evaluate(() => ({
      title: document.title,
      ember: ((document.querySelector('.brief-ember') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      labelled: document.querySelectorAll('button[role="switch"][aria-label], select#textSize').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('page title loads', /Accessibility/i.test(shell.title), shell.title);
    check('Ember touchpoint is on the page', /Ember says/i.test(shell.ember), shell.ember.slice(0, 60));
    check('switches and text size are labelled', shell.labelled >= 5, String(shell.labelled));
    check('390 no horizontal overflow', shell.overflow <= 2, 'overflow=' + shell.overflow);

    await tap(page, '#swMotion');
    await new Promise(r => setTimeout(r, 150));
    let s = await readState(page);
    check('a touch tap turns reduced motion on', s.motion === true, JSON.stringify(s));
    check('reduced motion stops the preview animation', s.motionName === 'none', s.motionName);

    await tap(page, '#swContrast');
    await new Promise(r => setTimeout(r, 150));
    s = await readState(page);
    check('a touch tap turns high contrast on', s.contrast === true, JSON.stringify(s));
    check('high contrast class is applied', /high-contrast/.test(s.className), s.className);

    await page.select('#textSize', '130');
    await new Promise(r => setTimeout(r, 150));
    s = await readState(page);
    check('text size select applies 130%', s.textSize === '130' && s.rootSize === '130%', JSON.stringify(s));

    await tap(page, '#swFont');
    await new Promise(r => setTimeout(r, 150));
    s = await readState(page);
    check('a touch tap turns the reading font on', s.font === true, JSON.stringify(s));
    check('reading font class is applied', /jvds-easy-read/.test(s.className), s.className);

    await tap(page, '#btnUndo');
    await new Promise(r => setTimeout(r, 150));
    s = await readState(page);
    check('Undo reverts the last change', s.font === false && !/jvds-easy-read/.test(s.className), JSON.stringify(s));

    await new Promise(r => setTimeout(r, 600));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    s = await readState(page);
    check('settings autosave and reload', s.motion === true && s.contrast === true && s.textSize === '130' && s.font === false, JSON.stringify(s));

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
    check('Export downloads a settings JSON', /\.json$/i.test(exported || ''), exported);

    const shared = await page.evaluate(() => {
      window.__share = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__share = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      window.shareAccessibilitySettings();
      return window.__share;
    });
    check('Share copies an #a11y= URL', /#a11y=/.test(shared), shared.slice(0, 64) + '...');

    if (shared) {
      const restored = await browser.newPage();
      await restored.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await restored.goto(shared, { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 700));
      const rr = await readState(restored);
      check('a shared link restores the settings', rr.motion === true && rr.contrast === true && rr.textSize === '130', JSON.stringify(rr));
      await restored.close();
    }

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    const desktop = await page.evaluate(() => ({
      switches: document.querySelectorAll('button[role="switch"]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('1440 page boots', desktop.switches >= 4, String(desktop.switches));
    check('1440 no horizontal overflow', desktop.overflow <= 2, 'overflow=' + desktop.overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS accessibility-mobile: touch switches, autosave, undo, export and share work at 390');
})().catch(e => { console.error(e); process.exit(1); });
