#!/usr/bin/env node
// tests/workshop-finish-checklist.js (A1846)
// Guards the "Finished? Check your game" panel on the Sci-Fi Runner and Race
// Builder workshops: five checklist items, a "How to keep it" note, no overflow
// and no console/page errors at 390px and 1440px.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['workshops/sci-fi-runner-builder.html', 'workshops/race-builder.html'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

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
  try {
    for (const width of [390, 1440]) {
      for (const file of PAGES) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 950 });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        const resp = await page.goto(base + '/' + file, { waitUntil: 'load', timeout: 30000 });
        const where = file + ' @' + width;
        assert.equal(resp.status(), 200, where + ' status');
        const info = await page.evaluate(() => {
          const panel = [...document.querySelectorAll('section')].find((s) => /Finished\? Check your game/.test(s.textContent));
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            found: !!panel,
            items: panel ? panel.querySelectorAll('li').length : 0,
            keep: panel ? /How to keep it/.test(panel.textContent) : false,
            reference: panel ? !!panel.querySelector('a[href$="reference.zip"]') : false
          };
        });
        assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow + 'px');
        assert.ok(info.found, where + ' checklist panel');
        assert.ok(info.items >= 5, where + ' five checklist items');
        assert.ok(info.keep, where + ' how to keep it');
        assert.ok(info.reference, where + ' reference pack link');
        assert.deepEqual(errors, [], where + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
        await page.close();
      }
    }
    console.log('PASS workshop-finish-checklist: 2 workshops x 390/1440, checklist + keeping note present, 0 errors, no overflow');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAIL workshop-finish-checklist: ' + e.message); process.exit(1); });
