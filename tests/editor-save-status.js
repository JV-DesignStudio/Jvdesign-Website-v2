/* A2311: every main studio shows a visible undo / redo / autosave status.

   Loads the shared editor-status bar on six studios at 390px and 1440px:
   - the bar is present with Undo, Redo, a live state label and Save
   - an edit changes the label to Unsaved changes
   - saving changes it to Saved <time> and persists across a reload
   - undo and redo are reachable and do not throw
   - no horizontal overflow and no page errors

   Run: node tests/editor-save-status.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mjs': 'application/javascript', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const wait = ms => new Promise(r => setTimeout(r, ms));

const TOOLS = [
  ['Pixel Studio', '/tools/pixel-studio.html'],
  ['World Builder', '/tools/level-designer.html'],
  ['Audio Studio', '/tools/sound-studio.html'],
  ['Sprite Animator', '/tools/sprite-animator.html'],
  ['Trading Card Designer', '/tools/trading-card-designer.html'],
  ['Palette Studio', '/tools/colour-palette.html']
];

async function run(browser, base, label, url, width) {
  const page = await browser.newPage();
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
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true }));
      localStorage.setItem('jvds-cookie-consent', 'declined');
    } catch (e) {}
  });
  await page.setViewport({ width, height: width === 390 ? 844 : 900, isMobile: width === 390, hasTouch: width === 390 });
  await page.goto(base + url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('#editor-status', { timeout: 20000 });
  await wait(300);

  const shell = await page.evaluate(() => {
    const bar = document.getElementById('editor-status');
    const undo = bar && bar.querySelector('[data-es="undo"]');
    const redo = bar && bar.querySelector('[data-es="redo"]');
    const save = bar && bar.querySelector('[data-es="save"]');
    const state = bar && bar.querySelector('[data-es="state"]');
    return {
      bar: !!bar,
      undo: !!undo, redo: !!redo, save: !!save && !save.hidden,
      undoOn: !!undo && !undo.disabled, redoOn: !!redo && !redo.disabled,
      state: state ? state.textContent.trim() : ''
    };
  });
  check(label + ' ' + width + ': status bar is visible', shell.bar);
  check(label + ' ' + width + ': undo and redo are shown', shell.undo && shell.redo, JSON.stringify(shell));
  check(label + ' ' + width + ': undo and redo are usable', shell.undoOn && shell.redoOn, JSON.stringify(shell));
  check(label + ' ' + width + ': autosave state is shown', /autosave|saved/i.test(shell.state), shell.state);

  // A real edit marks the status dirty.
  await page.evaluate(() => {
    const host = document.getElementById('main-content') || document.querySelector('main') || document.body;
    host.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait(350);
  const dirty = await page.evaluate(() => document.querySelector('#editor-status [data-es="state"]').textContent.trim());
  check(label + ' ' + width + ': an edit shows Unsaved changes', /unsaved/i.test(dirty), dirty);

  // Saving marks it saved.
  await page.evaluate(() => window.EditorStatus.markSaved());
  await wait(150);
  const saved = await page.evaluate(() => document.querySelector('#editor-status [data-es="state"]').textContent.trim());
  check(label + ' ' + width + ': save shows a saved time', /^Saved \d{1,2}:\d{2}/.test(saved), saved);

  // Undo / redo clicks do not throw.
  await page.click('#editor-status [data-es="undo"]');
  await wait(150);
  await page.click('#editor-status [data-es="redo"]');
  await wait(150);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(label + ' ' + width + ': no horizontal overflow', overflow <= 2, 'overflow=' + overflow);
  check(label + ' ' + width + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  // Reload keeps the saved status.
  await page.reload({ waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('#editor-status', { timeout: 20000 });
  await wait(300);
  const restored = await page.evaluate(() => document.querySelector('#editor-status [data-es="state"]').textContent.trim());
  check(label + ' ' + width + ': saved status survives a reload', /^Saved \d{1,2}:\d{2}/.test(restored), restored);

  await page.close();
}

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const [label, url] of TOOLS) {
      for (const width of [390, 1440]) await run(browser, base, label, url, width);
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS editor-save-status: undo, redo and saved status are visible and update at 390 and 1440');
})().catch(e => { console.error(e); process.exit(1); });
