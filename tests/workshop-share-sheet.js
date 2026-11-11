/* A2956: canvas workshops expose one Share-it sheet that saves a card of the
   learner's own game, not just a link to the workshop.
   Checks the sheet, its actions, PNG card generation, keyboard close and the
   390px layout on a real build-along page. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/js-snake-workshop.html';
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.CW && document.querySelector('.cw-share-open'), { timeout: 15000 });

    const before = await page.evaluate(() => ({
      shareButtons: document.querySelectorAll('.cw-share-open').length,
      label: (document.querySelector('.cw-share-open') || {}).textContent || '',
      api: typeof window.CW.shareCardDataUrl
    }));
    check('one Share it button', before.shareButtons === 1, 'found ' + before.shareButtons);
    check('Share it button labelled', /share/i.test(before.label), before.label);
    check('share card API exposed', before.api === 'function', before.api);

    const opened = await page.evaluate(() => {
      document.querySelector('.cw-share-open').click();
      const layer = document.querySelector('.cw-share-layer');
      const actions = [...document.querySelectorAll('[data-cw-share]')].map(b => b.getAttribute('data-cw-share'));
      return {
        visible: !!layer && !layer.hidden,
        dialog: !!document.querySelector('.cw-share-sheet[role="dialog"]'),
        actions,
        studio: !!document.querySelector('.cw-share-studio'),
        focused: (document.activeElement && document.activeElement.getAttribute('data-cw-share')) || ''
      };
    });
    check('sheet opens', opened.visible);
    check('sheet is a dialog', opened.dialog);
    check('sheet has save card action', opened.actions.includes('card'), opened.actions.join(','));
    check('sheet has download action', opened.actions.includes('game'), opened.actions.join(','));
    check('sheet has copy code action', opened.actions.includes('code'), opened.actions.join(','));
    check('sheet has workshop link action', opened.actions.includes('link'), opened.actions.join(','));
    check('sheet links to My Studio', opened.studio);
    check('focus lands on save card', opened.focused === 'card', opened.focused);

    const escaped = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return document.querySelector('.cw-share-layer').hidden;
    });
    check('Escape closes the sheet', escaped);

    // Reopen and generate the card the same way the button does.
    const card = await page.evaluate(async () => {
      document.querySelector('.cw-share-open').click();
      try {
        const url = await window.CW.shareCardDataUrl();
        return { ok: typeof url === 'string' && url.indexOf('data:image/png') === 0, length: (url || '').length };
      } catch (e) { return { ok: false, length: 0, error: String(e && e.message || e) }; }
    });
    check('share card is a PNG', card.ok, card.error || ('bytes ' + card.length));
    check('share card has real content', card.length > 4000, 'bytes ' + card.length);

    const closed = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return document.querySelector('.cw-share-layer').hidden;
    });
    check('sheet closes after making a card', closed);

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.CW && document.querySelector('.cw-share-open'), { timeout: 15000 });
    const mobile = await page.evaluate(() => {
      document.querySelector('.cw-share-open').click();
      const layer = document.querySelector('.cw-share-layer');
      const sheet = document.querySelector('.cw-share-sheet');
      const r = sheet.getBoundingClientRect();
      return {
        visible: !!layer && !layer.hidden,
        scrollWidth: document.documentElement.scrollWidth,
        sheetRight: r.right,
        sheetLeft: r.left,
        innerWidth: window.innerWidth
      };
    });
    check('390px sheet opens', mobile.visible);
    check('390px no horizontal overflow', mobile.scrollWidth <= 392, 'scrollWidth ' + mobile.scrollWidth);
    check('390px sheet fits viewport', mobile.sheetLeft >= 0 && mobile.sheetRight <= mobile.innerWidth + 1,
      mobile.sheetLeft + '..' + mobile.sheetRight + ' of ' + mobile.innerWidth);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
