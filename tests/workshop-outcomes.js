#!/usr/bin/env node
// tests/workshop-outcomes.js (A2028)
// Checks the outcome statement renders on published workshops at 390px and
// 1440px: your project, what you learn, what you finish with and how to extend
// it. Also checks the hub catalogue shows an outcome line per published card.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGES = [
  'workshops/js-snake-workshop.html',
  'workshops/cpp-tower-defence-builder.html',
  'workshops/blender-cheatsheet.html',
  'workshops/minecraft-world-workshop.html',
  'workshops/blender-mod-studio.html',
  'workshops/my-first-browser-game.html'
];
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
        await page.setBypassServiceWorker(true);
        await page.setRequestInterception(true);
        page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()));
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        const resp = await page.goto(base + '/' + file, { waitUntil: 'load', timeout: 30000 });
        const where = file + ' @' + width;
        assert.equal(resp && resp.status(), 200, where + ' status (' + (resp ? resp.status() : 'no response') + ')');
        const info = await page.evaluate(() => {
          const panel = document.querySelector('.ws-outcome');
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            found: !!panel,
            visible: !!panel && panel.getBoundingClientRect().height > 20,
            labels: panel ? [...panel.querySelectorAll('dt')].map((d) => d.textContent.trim()) : [],
            text: panel ? panel.textContent.replace(/\s+/g, ' ').trim() : ''
          };
        });
        assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow + 'px');
        assert.ok(info.found && info.visible, where + ' outcome panel visible');
        assert.deepEqual(info.labels, ['Your project', "You'll learn", 'Finish with', 'Then extend it'], where + ' labels');
        assert.ok(info.text.length > 80, where + ' outcome text too short');
        assert.deepEqual(errors.filter((e) => !/Failed to load resource|net::ERR_FAILED/i.test(e)), [], where + ' console/page errors');
        await page.close();
      }
    }

    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 950 });
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()));
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/pages/workshop.html', { waitUntil: 'load', timeout: 30000 });
      const info = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        lines: document.querySelectorAll('#catalogueGrid .course-outcome').length,
        first: (document.querySelector('#catalogueGrid .course-outcome') || {}).textContent || ''
      }));
      assert.ok(info.overflow <= 2, 'hub @' + width + ' horizontal overflow ' + info.overflow + 'px');
      assert.ok(info.lines >= 263, 'hub @' + width + ' outcome lines ' + info.lines);
      assert.ok(/Finish with/.test(info.first) && /Extend it by/.test(info.first), 'hub @' + width + ' outcome copy');
      assert.deepEqual(errors, [], 'hub @' + width + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }

    console.log('PASS workshop-outcomes: 6 pages x 390/1440 + hub, outcome panel and catalogue line visible, 0 errors, no overflow');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAIL workshop-outcomes: ' + e.message); process.exit(1); });
