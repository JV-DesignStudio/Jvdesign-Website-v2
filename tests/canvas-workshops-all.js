#!/usr/bin/env node
// tests/canvas-workshops-all.js (A1716)
// Bulk gate for every interactive build-along page (workshops/*-canvas.html).
// The per-page suite (canvas-workshop-suite.js) is opt-in, so a canvas page can
// regress (missing CW_CONFIG, runtime error, overflow) without any test noticing.
// This reads the canvas list from content/workshops.json and loads every page in
// a real browser at 390px and 1440px: steps render from CW_CONFIG, exactly one
// step is active, every step has an editor, the shared topbar carries Lumo, the
// page has a canonical, there are no console/page errors and no horizontal scroll.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const WIDTHS = process.env.CANVAS_WIDTHS ? process.env.CANVAS_WIDTHS.split(',').map(Number) : [390, 1440];

const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const pages = workshops
  .map((w) => String(w.url || '').replace(/^\//, ''))
  .filter((u) => /^workshops\/.+\.html$/.test(u) && /-canvas\.html$/.test(u))
  .filter((u) => fs.existsSync(path.join(ROOT, u)));

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
  let loads = 0, steps = 0;
  try {
    for (const width of WIDTHS) {
      for (const rel of pages) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 900 });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        const resp = await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 30000 });
        assert.equal(resp.status(), 200, rel + ' @' + width + ' status');
        await page.waitForFunction(() => window.CW && document.querySelectorAll('.cw-step').length > 0, { timeout: 10000 })
          .catch(() => assert.fail(rel + ' @' + width + ' did not render canvas steps'));
        const info = await page.evaluate(() => {
          const chip = document.querySelector('.cw-topbar-char');
          const canonical = document.querySelector('link[rel="canonical"]');
          return {
            cfgSteps: (window.CW_CONFIG && window.CW_CONFIG.steps || []).length,
            domSteps: document.querySelectorAll('.cw-step').length,
            active: document.querySelectorAll('.cw-step.active').length,
            editors: document.querySelectorAll('.cw-editor').length,
            chipText: chip ? chip.textContent : '',
            chipImg: chip && chip.querySelector('img') ? chip.querySelector('img').getAttribute('src') : '',
            canonical: canonical ? canonical.getAttribute('href') : '',
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });
        const where = rel + ' @' + width;
        assert.ok(info.cfgSteps >= 1, where + ' CW_CONFIG has no steps');
        assert.equal(info.domSteps, info.cfgSteps, where + ' rendered steps !== CW_CONFIG steps');
        assert.equal(info.active, 1, where + ' active steps ' + info.active);
        assert.equal(info.editors, info.domSteps, where + ' editors ' + info.editors + ' vs steps ' + info.domSteps);
        assert.match(info.chipText, /Lumo/i, where + ' topbar not Lumo: ' + info.chipText);
        assert.match(info.chipImg, /lumo-badge\.webp/, where + ' topbar badge ' + info.chipImg);
        assert.ok(info.canonical && info.canonical.includes(rel), where + ' canonical missing: ' + info.canonical);
        assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow + 'px');
        // Render every complete solution so each step's preview executes real
        // learner code. A CSP-blocked preview (e.g. a srcdoc frame that inherits
        // the page policy) logs "Executing inline script violates..." here, and a
        // template that references a missing variable throws. Any console error
        // therefore fails the gate.
        await page.evaluate(async () => {
          const ok = (window.CW_CONFIG.steps || []).filter((x) => x.solution && !/_{3,}|\?{2,}/.test(x.solution));
          for (const s of ok) {
            window.CW.showSolution(s.num);
            await new Promise((r) => setTimeout(r, 100));
          }
        });
        assert.deepEqual(errors, [], where + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
        loads++; steps += info.domSteps;
        await page.close();
      }
    }
    console.log('PASS canvas-workshops-all: ' + pages.length + ' canvas pages x ' + WIDTHS.join('/') + ' clean (' + loads + ' loads, ' + steps + ' steps, 0 console errors, 0 overflow)');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
