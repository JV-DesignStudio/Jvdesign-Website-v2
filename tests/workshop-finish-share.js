/* Verifies the shared workshop engine adds a "Share what you made" action to
   the finish banner once every step is complete, and that it never duplicates.
   Simulates completion by seeding the workshop's own localStorage key. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = 'workshops/blender-cube-workshop.html';
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(base + '/' + PAGE, { waitUntil: 'load' });
    const before = await page.evaluate(() => ({
      share: document.querySelectorAll('#finishBanner .finish-share').length,
      total: window.WORKSHOP_TOTAL,
      key: window.WORKSHOP_KEY
    }));
    check('no share button before finishing', before.share === 0, 'found ' + before.share);
    check('workshop exposes total + key', before.total >= 1 && !!before.key, before.total + ' / ' + before.key);

    // Seed full completion, then let the engine restore it on reload.
    await page.evaluate((total, key) => {
      const completed = []; for (let i = 1; i <= total; i++) completed.push(i);
      localStorage.setItem(key, JSON.stringify({ completed, total, xp: 120, level: 2, bestStreak: 3, totalQuizzes: total, correctFirst: total }));
    }, before.total, before.key);
    await page.reload({ waitUntil: 'load' });

    const after = await page.evaluate(() => {
      const btn = document.querySelector('#finishBanner .finish-share');
      return {
        bannerShown: document.getElementById('finishBanner').classList.contains('show'),
        count: document.querySelectorAll('#finishBanner .finish-share').length,
        text: btn ? btn.textContent.trim() : '',
        sw: document.documentElement.scrollWidth
      };
    });
    check('finish banner shown when complete', after.bannerShown);
    check('share button appears in finish banner', after.count === 1, 'count ' + after.count);
    check('share button labelled', /share/i.test(after.text), after.text);
    check('desktop no overflow', after.sw <= 1442, after.sw + '');

    // Clicking dispatches jvds:shared and does not throw.
    const shared = await page.evaluate(async () => {
      let fired = false;
      window.addEventListener('jvds:shared', () => { fired = true; }, { once: true });
      const btn = document.querySelector('#finishBanner .finish-share');
      btn.click();
      await new Promise(r => setTimeout(r, 120));
      return { fired, count: document.querySelectorAll('#finishBanner .finish-share').length };
    });
    check('click dispatches jvds:shared', shared.fired);
    check('click does not duplicate the button', shared.count === 1, 'count ' + shared.count);

    // Re-running showFinish (engine path) must not add a second button.
    await page.evaluate(() => { if (window._wsEngine) { /* noop */ } });
    await page.evaluate(() => { try { window.completeStep(window.WORKSHOP_TOTAL); } catch (e) {} });
    const again = await page.evaluate(() => document.querySelectorAll('#finishBanner .finish-share').length);
    check('engine re-run does not duplicate the button', again === 1, 'count ' + again);

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load' });
    const mob = await page.evaluate(() => document.documentElement.scrollWidth);
    check('390px no overflow', mob <= 392, 'scrollWidth ' + mob);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
