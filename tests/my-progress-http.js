// my-progress-http.js - page check for My Progress.
// Covers the A2342 "Reported steps" panel and the usual load/overflow checks.
//
// Run: node tests/my-progress-http.js
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

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
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'x' + vp.height;
      await page.setViewport(vp);
      await page.goto(base + '/workshops/my-progress.html', { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => !!document.getElementById('stuckReports'), { timeout: 8000 });

      const title = await page.title();
      check(tag + ' page loads', /My Progress/i.test(title), title);

      const hidden = await page.evaluate(() => {
        const s = document.getElementById('stuckReports');
        return s ? getComputedStyle(s).display : 'missing';
      });
      check(tag + ' reported panel stays hidden with no reports', hidden === 'none', hidden);

      await page.evaluate(() => {
        localStorage.setItem('jvds_stuck_reports', JSON.stringify([
          { workshop: 'js-flappy-workshop.html', step: 1, title: 'Canvas & First Draw', note: 'blank canvas', at: '2026-11-04T10:00:00.000Z' }
        ]));
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => {
        const s = document.getElementById('stuckReports');
        return s && getComputedStyle(s).display !== 'none';
      }, { timeout: 8000 });
      const panel = await page.evaluate(() => document.getElementById('stuckReports').textContent);
      check(tag + ' reported panel lists a report',
        /js-flappy-workshop\.html/.test(panel) && /blank canvas/.test(panel));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' no horizontal overflow', overflow);
    }
    check('no runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: My Progress loads and lists reported steps at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
