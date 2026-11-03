// workshop-page-check.js - shared page test for the Roblox and Minecraft
// page-standard slice (A1867). Each tests/<page>-http.js wrapper calls run()
// with the page path and its expected next-step href.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

async function run(pagePath, opts) {
  opts = opts || {};
  const next = opts.next;
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
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      await page.setViewport({ width, height: 900 });
      let resp = null;
      for (let attempt = 0; attempt < 2 && !(resp && resp.status() === 200); attempt++) {
        resp = await page.goto(base + pagePath, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(resp && resp.status() === 200)) await new Promise((r) => setTimeout(r, 400));
      }
      const where = pagePath + ' @' + width;
      const loaded = await page.evaluate(() => document.readyState === 'complete' || document.readyState === 'interactive').catch(() => false);
      check('status 200', (resp && resp.status() === 200) || (!resp && loaded), 'status ' + (resp && resp.status()));

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const stuck = document.querySelector('.ws-stuck');
        const next = document.querySelector('.next-route[data-workshop-next]');
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        return {
          outcome: !!document.querySelector('.ws-outcome'),
          stuck: !!stuck,
          stuckItems: stuck ? stuck.querySelectorAll('details.ws-stuck-item').length : 0,
          challenge: !!document.querySelector('.ws-challenge'),
          reflect: !!document.querySelector('.ws-reflect'),
          info: !!document.querySelector('.ws-info'),
          nextHref: next ? (next.querySelector('a.next-route-inner') || {}).getAttribute?.('href') : null,
          nextText: text(next),
          duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      check('outcome panel visible', info.outcome);
      check('Stuck? Try this block has at least three items', info.stuck && info.stuckItems >= 3, 'items ' + info.stuckItems);
      if (opts.challenge !== false) check('independent challenge block visible', info.challenge);
      if (opts.reflect) check('reflection block visible', info.reflect);
      if (opts.info) check('learning info block visible', info.info);
      if (next) check('next step href', info.nextHref === next, String(info.nextHref));
      check('next step uses the shared kicker', /Up next in the series/.test(info.nextText));
      check('no duplicate element ids', info.duplicateIds.length === 0, info.duplicateIds.join(','));
      check('no horizontal overflow', info.overflow <= 2, info.overflow + 'px');
      check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILED for ' + pagePath); process.exit(1); }
  console.log('\nPASS: ' + pagePath + ' page standard');
}

module.exports = { run };
