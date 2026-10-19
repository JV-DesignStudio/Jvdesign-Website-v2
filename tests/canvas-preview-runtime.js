#!/usr/bin/env node
// tests/canvas-preview-runtime.js (A1717)
// Proves a build-along's live preview actually runs the learner's game code.
// The preview host is assets/canvas-preview.html (no CSP of its own); learner
// code runs inline in its sandboxed stage. A srcdoc/blob frame would inherit the
// page Content-Security-Policy, block those inline scripts, log a CSP error and
// leave a blank canvas. This asserts a complete solution paints real pixels and
// logs zero console errors.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const PAGE = 'workshops/cpp-breakout-canvas.html';

(async () => {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 10000 });

    const started = await page.evaluate(() => {
      const s = (window.CW_CONFIG.steps || []).find((x) => x.solution && !/_{3,}|\?{2,}/.test(x.solution));
      if (!s) return false;
      window.CW.showSolution(s.num);
      return true;
    });
    assert.ok(started, PAGE + ' has no complete first solution to render');

    let painted = -1;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 150));
      for (const f of page.frames()) {
        if (f === page.mainFrame()) continue;
        try {
          painted = await f.evaluate(() => {
            const c = document.querySelector('canvas');
            if (!c) return -1;
            try {
              const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
              let n = 0;
              for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
              return n;
            } catch (e) { return -1; }
          });
        } catch (e) { painted = -1; }
        if (painted > 0) break;
      }
      if (painted > 0) break;
    }
    assert.ok(painted > 1000, PAGE + ' preview canvas not painted (painted=' + painted + ')');
    assert.deepEqual(errors, [], PAGE + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
    console.log('PASS canvas-preview-runtime: ' + PAGE + ' preview ran learner code, canvas painted ' + painted + 'px, 0 console errors');
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
