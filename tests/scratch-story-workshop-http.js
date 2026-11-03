// scratch-story-workshop-http.js - page test for the custom Scratch story
// workshop (A1851). The page uses its own step engine, so it is not part of the
// canvas suite. This checks the page loads, the 13 steps render, the page
// standard blocks are present, and 390/1440 have no overflow or page errors.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = '/workshops/scratch-story-workshop.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('missing ' + url);
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });
    const resp = await page.goto(base + PAGE, { waitUntil: 'load', timeout: 30000 });
    check('page returns 200', resp && resp.status() === 200, 'status ' + (resp && resp.status()));

    const info = await page.evaluate(() => {
      const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
      const stuck = document.querySelector('.ws-stuck');
      const next = document.querySelector('.next-route[data-workshop-next]');
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
      return {
        steps: document.querySelectorAll('.step-card').length,
        progress: text(document.getElementById('progressCount')),
        outcome: !!document.querySelector('.ws-outcome'),
        stuck: !!stuck,
        stuckItems: stuck ? stuck.querySelectorAll('details.ws-stuck-item').length : 0,
        nextHref: next ? (next.querySelector('a.next-route-inner') || {}).getAttribute?.('href') : null,
        nextText: text(next),
        engine: typeof window.checkQuiz === 'function' || typeof window.completeStep === 'function',
        dashes: (document.body.innerText.match(/[\u2013\u2014]/g) || []).length,
        duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
        scrollWidth: document.documentElement.scrollWidth
      };
    });
    check('13 step cards render', info.steps === 13, 'steps ' + info.steps);
    check('progress counter reads the step total', /0 \/ 13 steps/.test(info.progress), info.progress);
    check('outcome panel present', info.outcome);
    check('Stuck? Try this block has at least three items', info.stuck && info.stuckItems >= 3, 'items ' + info.stuckItems);
    check('next step points at the series hub', info.nextHref === 'my-first-scratch-game.html', String(info.nextHref));
    check('next step uses the shared kicker', /Up next in the series/.test(info.nextText));
    check('step engine loaded', info.engine);
    check('no duplicate element ids', info.duplicateIds.length === 0, info.duplicateIds.join(','));
    check('no em or en dashes', info.dashes === 0, 'dashes ' + info.dashes);
    check('desktop no overflow', info.scrollWidth <= 1442, String(info.scrollWidth));
    check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load' });
    const mobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth,
      stuck: !!document.querySelector('.ws-stuck'),
      next: !!document.querySelector('.next-route[data-workshop-next]')
    }));
    check('390px no overflow', mobile.overflow <= 392, 'scrollWidth ' + mobile.overflow);
    check('390px keeps the recovery and next blocks', mobile.stuck && mobile.next);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILED'); process.exit(1); }
  console.log('\nPASS: ' + PAGE + ' story workshop');
})().catch((e) => { console.error(e); process.exit(1); });
