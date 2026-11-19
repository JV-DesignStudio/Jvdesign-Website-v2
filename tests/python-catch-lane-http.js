/* Python lane test (A3075).
   Proves a code build-along renders the In Python panel beside the canvas:
   every step names game.py, at least three ordered actions and a checkpoint,
   and the reference project downloads from the same page. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'workshops/python-catch-workshop.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.zip': 'application/zip' };

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/' + PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW_CONFIG && document.querySelectorAll('.cw-step').length > 0, { timeout: 10000 });

    const data = await page.evaluate(() => ({
      steps: window.CW_CONFIG.steps.map((s) => ({
        num: s.num,
        name: s.engine && s.engine.name,
        file: s.engine && s.engine.file,
        doCount: s.engine && Array.isArray(s.engine.do) ? s.engine.do.length : 0,
        check: s.engine && s.engine.check
      })),
      projectHref: (document.querySelector('.cw-engine-project') || {}).getAttribute ? document.querySelector('.cw-engine-project').getAttribute('href') : '',
      panel: (document.querySelector('.cw-step.active .cw-engine') || {}).textContent || '',
      fileLine: (document.querySelector('.cw-step.active .cw-engine-file') || {}).textContent || ''
    }));

    assert.equal(data.steps.length, 6, 'step count');
    for (const s of data.steps) {
      assert.equal(s.name, 'Python 3', 'step ' + s.num + ' engine name');
      assert.equal(s.file, 'game.py', 'step ' + s.num + ' engine file');
      assert.ok(s.doCount >= 3, 'step ' + s.num + ' needs 3 actions, got ' + s.doCount);
      assert.ok(s.check, 'step ' + s.num + ' engine checkpoint');
    }
    assert.match(data.panel, /In Python 3/);
    assert.match(data.fileLine, /game\.py/);
    assert.match(data.panel, /Check:/);
    assert.equal(data.projectHref, '/downloads/python-catch-workshop-reference.zip');

    const zip = await page.evaluate(async (href) => {
      const r = await fetch(href);
      return { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
    }, data.projectHref);
    assert.equal(zip.status, 200, 'reference zip status');
    assert.ok(zip.bytes > 100, 'reference zip bytes ' + zip.bytes);

    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 900 });
      await new Promise((r) => setTimeout(r, 120));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 2, 'overflow ' + overflow + 'px at ' + width);
    }
    assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
    console.log('PASS: ' + PAGE + ' renders a complete Python lane on every step and the reference downloads');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
