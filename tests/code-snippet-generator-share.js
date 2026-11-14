/* Code Snippet Generator (tools/code-snippet-generator.html) share + persistence checks.

   Tool Parity pass: a learner's tweaked options must survive a reload and travel
   in a share link, not just the language and search filters.

   Run: node tests/code-snippet-generator-share.js
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

const noTour = () => { try { localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); } catch (e) {} };

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pageUrl = base + '/tools/code-snippet-generator.html';
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
    await page.evaluateOnNewDocument(noTour);
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));

    await page.evaluate(() => {
      const inp = document.querySelector('input[data-sid="cs-move"][data-key="speed"]');
      inp.value = '12';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 400));

    const tweaked = await page.evaluate(() => ({
      hash: location.hash,
      code: document.getElementById('code-cs-move').textContent,
    }));
    check('changing an option updates the code', /speed = 12f/.test(tweaked.code));
    check('the URL now carries the option values', /opts=/.test(tweaked.hash), tweaked.hash.slice(0, 32) + '...');

    const copied = await page.evaluate(async () => {
      const got = [];
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { got.push(t); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      const btn = document.querySelector('[data-on="shareConfig"]');
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 80));
      return got[0] || '';
    });
    check('Share copies a link with the options', /opts=/.test(copied) && copied.indexOf('/tools/code-snippet-generator.html') >= 0, copied.slice(0, 60) + '...');

    // A fresh device opens the shared link and sees the same tuned snippet.
    // Use an isolated context so its empty storage does not wipe this page's data.
    const freshCtx = await browser.createBrowserContext();
    const fresh = await freshCtx.newPage();
    const freshErrors = [];
    fresh.on('pageerror', e => freshErrors.push(e.message));
    await fresh.setRequestInterception(true);
    fresh.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await fresh.setViewport({ width: 390, height: 844, isMobile: true });
    await fresh.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); } catch (e) {} });
    await fresh.goto(pageUrl + tweaked.hash, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const shared = await fresh.evaluate(() => ({
      value: (document.querySelector('input[data-sid="cs-move"][data-key="speed"]') || {}).value,
      code: (document.getElementById('code-cs-move') || {}).textContent || '',
    }));
    check('shared link restores the option value', shared.value === '12', 'value=' + shared.value);
    check('shared link regenerates the tuned code', /speed = 12f/.test(shared.code));
    check('shared link page has no errors', freshErrors.length === 0, freshErrors.slice(0, 2).join(' | '));
    await fresh.close();
    await freshCtx.close();

    // Same device: a plain reload keeps the tweak.
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));
    const persisted = await page.evaluate(() => ({
      value: (document.querySelector('input[data-sid="cs-move"][data-key="speed"]') || {}).value,
      code: (document.getElementById('code-cs-move') || {}).textContent || '',
    }));
    check('reload keeps the tuned option', persisted.value === '12', 'value=' + persisted.value);
    check('reload regenerates the tuned code', /speed = 12f/.test(persisted.code));

    // Reset clears the tweak and the URL should drop it.
    await page.evaluate(() => resetSnippet('cs-move'));
    await new Promise(r => setTimeout(r, 300));
    const reset = await page.evaluate(() => ({ hash: location.hash, code: document.getElementById('code-cs-move').textContent }));
    check('Reset restores the default code', /speed = 6f/.test(reset.code));
    check('Reset drops the option from the URL', !/opts=/.test(reset.hash), reset.hash.slice(0, 32));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('390 no horizontal overflow', overflow <= 2, 'overflow=' + overflow);
    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS code-snippet-generator-share: options persist and travel in share links');
})().catch(e => { console.error(e); process.exit(1); });
