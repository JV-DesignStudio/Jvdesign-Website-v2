/* HTTP test for my-first-godot-game-canvas.
   Loads the page, proves the canvas engine rendered all 7 steps (including the
   Debug It step 7 with its clues panel), no overflow, no console errors at
   390 and 1440. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const PAGE = 'workshops/my-first-godot-game-canvas.html';

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
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const resp = await page.goto(base + '/' + PAGE, { waitUntil: 'load' });
      assert.equal(resp.status(), 200, 'status at ' + width);
      await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 10000 });
      const info = await page.evaluate(() => {
        const cfg = window.CW_CONFIG || {};
        const s7 = (cfg.steps || []).find(function(s) { return s.num === 7; });
        const frame = document.getElementById('gameFrame');
        return {
          cfgSteps: (cfg.steps || []).length,
          domSteps: document.querySelectorAll('.cw-step').length,
          active: document.querySelectorAll('.cw-step.active').length,
          editors: document.querySelectorAll('.cw-editor').length,
          step7HasDebugClues: !!(s7 && s7.debugClues),
          step7HasDebugWrong: !!(s7 && s7.debugWrong && s7.debugWrong.length > 0),
          frameHost: !!(frame && /canvas-preview\.html/.test(frame.getAttribute('src') || '')),
          canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      const where = PAGE + ' @' + width;
      assert.ok(info.cfgSteps === 7, where + ' CW_CONFIG steps ' + info.cfgSteps);
      assert.equal(info.domSteps, info.cfgSteps, where + ' rendered steps');
      assert.equal(info.active, 1, where + ' active steps ' + info.active);
      assert.equal(info.editors, info.domSteps, where + ' editors ' + info.editors);
      assert.ok(info.step7HasDebugClues, where + ' step 7 missing debugClues');
      assert.ok(info.step7HasDebugWrong, where + ' step 7 missing debugWrong');
      assert.ok(info.frameHost, where + ' live preview frame missing');
      assert.ok(/my-first-godot-game-canvas\.html/.test(info.canonical), where + ' canonical ' + info.canonical);
      assert.ok(info.overflow <= 2, where + ' overflow ' + info.overflow);
      assert.deepEqual(errors, [], where + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }
    console.log('PASS: ' + PAGE + ' canvas at 390 and 1440 with Debug It step');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
