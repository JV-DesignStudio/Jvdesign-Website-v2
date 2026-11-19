/* Proves the Biscuit Tycoon page has a real Godot lane beside the canvas:
   every step names a file, the clicks and a checkpoint, and the starter
   project is downloadable from the same page. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'workshops/godot-autoclicker-workshop.html';
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
    await page.setViewport({ width: 1440, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/' + PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 10000 });

    const data = await page.evaluate(() => ({
      steps: window.CW_CONFIG.steps.map((s) => ({
        num: s.num,
        name: s.engine && s.engine.name,
        file: s.engine && s.engine.file,
        doCount: s.engine && Array.isArray(s.engine.do) ? s.engine.do.length : 0,
        check: s.engine && s.engine.check
      })),
      projectHref: (document.querySelector('.cw-engine-project') || {}).getAttribute ? document.querySelector('.cw-engine-project').getAttribute('href') : '',
      firstPanel: (document.querySelector('.cw-step.active .cw-engine') || {}).textContent || '',
      firstFile: (document.querySelector('.cw-step.active .cw-engine-file') || {}).textContent || ''
    }));

    assert.equal(data.steps.length, 7, 'step count');
    for (const s of data.steps) {
      assert.equal(s.name, 'Godot 4', 'step ' + s.num + ' engine name');
      assert.ok(s.file, 'step ' + s.num + ' engine file');
      assert.ok(s.doCount >= 3, 'step ' + s.num + ' engine clicks');
      assert.ok(s.check, 'step ' + s.num + ' engine checkpoint');
    }
    assert.match(data.firstPanel, /In Godot 4/);
    assert.match(data.firstFile, /bakery\.gd/);
    assert.match(data.firstPanel, /Check:/);
    assert.equal(data.projectHref, '/biscuit-tycoon-godot.zip');

    const zip = await page.evaluate(async () => {
      const r = await fetch('/biscuit-tycoon-godot.zip');
      return { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
    });
    assert.equal(zip.status, 200, 'starter zip status');
    assert.ok(zip.bytes > 1000, 'starter zip bytes ' + zip.bytes);
    assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
    console.log('PASS: every Biscuit Tycoon step has a Godot lane and the starter zip downloads');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
