const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const PAGE = '/workshops/js-flappy-workshop.html';
const STEP_KEY = 'wkp_workshops_js_flappy_workshop_html';
const CANVAS_KEY = 'jvds-js-flappy-canvas';

(async () => {
  let failures = 0;
  const check = (name, ok, detail = '') => {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
    if (!ok) failures++;
  };

  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'x' + vp.height;
      const page = await browser.newPage();
      await page.setViewport(vp);
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      await page.goto(base + PAGE, { waitUntil: 'load' });
      await page.evaluate((stepKey, canvasKey) => {
        localStorage.clear();
        localStorage.setItem(stepKey, JSON.stringify([1, 2]));
        localStorage.setItem(canvasKey, JSON.stringify({ completed: { 1: true, 2: true }, version: 1 }));
      }, STEP_KEY, CANVAS_KEY);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelectorAll('.kp-block').length === 2, { timeout: 8000 });

      const blocks = await page.evaluate(() => [...document.querySelectorAll('.kp-block')].map((el) => ({
        pos: el.classList.contains('kp-block--start') ? 'start' : 'end',
        visible: el.getBoundingClientRect().height > 40,
        text: el.textContent.replace(/\s+/g, ' ').trim()
      })));
      check(tag + ' start and end blocks are visible', blocks.length === 2 && blocks.every((b) => b.visible), JSON.stringify(blocks.map((b) => b.pos)));
      check(tag + ' blocks explain the no-account save', blocks.every((b) => /Keep your progress/.test(b.text) && /No account/.test(b.text)));

      const order = await page.evaluate(() => {
        const start = document.querySelector('.kp-block--start');
        const end = document.querySelector('.kp-block--end');
        const main = document.querySelector('main.workshop') || document.querySelector('main');
        if (!start || !end || !main) return { startBefore: false, endAfter: false };
        return {
          startBefore: !!(start.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
          endAfter: !!(end.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_PRECEDING)
        };
      });
      check(tag + ' a block sits before and after the steps', order.startBefore && order.endAfter, JSON.stringify(order));

      await page.evaluate(() => document.querySelector('.kp-block--start [data-kp="export"]').click());
      await page.waitForFunction(() => {
        const ta = document.querySelector('.kp-block--start .kp-code');
        return ta && ta.value && ta.value.length > 20;
      }, { timeout: 8000 });
      const pack = await page.evaluate(() => JSON.parse(document.querySelector('.kp-block--start .kp-code').value));
      check(tag + ' export writes a backpack code',
        pack && pack.format === 'jvds-backpack' && pack.keys && pack.keys[STEP_KEY] === '[1,2]' && !!pack.keys[CANVAS_KEY],
        'keys ' + (pack && pack.keys ? Object.keys(pack.keys).length : 0));

      const afterRestore = await page.evaluate(async (code) => {
        localStorage.clear();
        try { await window.JVDSKeepProgress.restore(code); } catch (e) { return { error: e.message }; }
        return {
          step: localStorage.getItem('wkp_workshops_js_flappy_workshop_html'),
          canvas: localStorage.getItem('jvds-js-flappy-canvas')
        };
      }, JSON.stringify(pack));
      check(tag + ' import restores completed steps',
        afterRestore.step === '[1,2]' && /"1":true/.test(afterRestore.canvas || ''),
        JSON.stringify(afterRestore));

      const panelOpen = await page.evaluate(() => {
        const btn = document.querySelector('.kp-block--end [data-kp="import"]');
        btn.click();
        return !document.querySelector('.kp-block--end .kp-import-panel').hidden;
      });
      check(tag + ' Bring my progress here opens the code panel', panelOpen);

      await page.evaluate(() => document.querySelector('.kp-block--end [data-kp="dismiss"]').click());
      const left = await page.evaluate(() => document.querySelectorAll('.kp-block').length);
      check(tag + ' Not now dismisses both blocks', left === 0, 'left ' + left);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' no horizontal overflow', overflow);
      check(tag + ' no page errors', errors.filter((e) => !/Failed to load resource|net::ERR_FAILED/i.test(e)).length === 0, errors.slice(0, 2).join(' | '));

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: keep-progress exports, imports and dismisses from a workshop page at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
