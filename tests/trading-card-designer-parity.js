/* Trading Card Designer (tools/trading-card-designer.html) parity checks.

   The tool already has undo/redo, autosave and #card= share links. This proves
   they actually work on the device, which the existing http/HiDPI tests do not:
   - autosave restores the card on reload
   - undo/redo revert a change
   - Copy Share Link reopens the same card on a clean device
   - 390px layout stays inside the viewport

   Run: node tests/trading-card-designer-parity.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const seed = () => { try { localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); localStorage.setItem('jvds_trading_card_seen_v1', '1'); } catch (e) {} };

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pageUrl = base + '/tools/trading-card-designer.html';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.evaluateOnNewDocument(seed);
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    const name = 'Upload Warden ' + Date.now();
    await page.evaluate(n => {
      const el = document.getElementById('cardName');
      el.value = n;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, name);
    await new Promise(r => setTimeout(r, 300));

    const copied = await page.evaluate(async () => {
      const got = [];
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { got.push(t); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      const btn = document.querySelector('[data-on="copyShareLink"]');
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 80));
      return got[0] || '';
    });
    check('Copy Share Link produces a #card= link', /#card=/.test(copied) && copied.indexOf('/tools/trading-card-designer.html') >= 0, copied.slice(0, 60) + '...');

    // A clean device opens the link and sees the same card name.
    const ctx = await browser.createBrowserContext();
    const fresh = await ctx.newPage();
    const freshErrors = [];
    fresh.on('pageerror', e => freshErrors.push(e.message));
    await fresh.setRequestInterception(true);
    fresh.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await fresh.setViewport({ width: 390, height: 844, isMobile: true });
    await fresh.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('jvds_trading_card_seen_v1', '1'); localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); } catch (e) {} });
    await fresh.goto(copied, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const sharedName = await fresh.evaluate(() => (document.getElementById('cardName') || {}).value);
    check('shared link restores the card on a clean device', sharedName === name, 'name=' + sharedName);
    check('shared link page has no errors', freshErrors.length === 0, freshErrors.slice(0, 2).join(' | '));
    await fresh.close();
    await ctx.close();

    // Same device: reload keeps the card (autosave).
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const autoName = await page.evaluate(() => (document.getElementById('cardName') || {}).value);
    check('reload keeps the card via autosave', autoName === name, 'name=' + autoName);

    // Undo / redo a name change.
    const undoResult = await page.evaluate(n => {
      const el = document.getElementById('cardName');
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.value = n + ' (edited)';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const edited = el.value;
      window.cardUndo();
      const afterUndo = el.value;
      window.cardRedo();
      const afterRedo = el.value;
      return { edited, afterUndo, afterRedo };
    }, name);
    check('undo reverts the edit', undoResult.afterUndo === name, undoResult.afterUndo);
    check('redo reapplies the edit', undoResult.afterRedo === undoResult.edited, undoResult.afterRedo);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('390 no horizontal overflow', overflow <= 2, 'overflow=' + overflow);
    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS trading-card-designer-parity: share link, autosave and undo/redo work');
})().catch(e => { console.error(e); process.exit(1); });
