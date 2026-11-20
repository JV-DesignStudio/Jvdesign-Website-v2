#!/usr/bin/env node
// tests/offline-labels-http.js (A1995)
// Renders one offline tool and one online-only tool at 390 and 1440 and checks
// the badge says the right thing. No overflow, no page errors.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};
const pages = [
  { file: '/tools/pixel-studio.html', label: /Available offline after one visit/i },
  { file: '/tools/godot-cheatsheet.html', label: /Needs a connection for the first visit/i }
];

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      res.writeHead(err ? 404 : 200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
      });
      res.end(err ? '' : buf);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  let checked = 0;

  try {
    for (const width of [390, 1440]) {
      for (const spec of pages) {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setViewport({ width, height: 950 });
        await page.setRequestInterception(true);
        page.on('request', (r) => {
          const url = r.url();
          if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) r.continue();
          else r.abort();
        });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push(m.text());
        });
        const label = spec.file + ' @' + width;
        await page.goto(base + spec.file, { waitUntil: 'load', timeout: 30000 });
        await page.waitForSelector('#tool-offline-badge', { timeout: 10000 });
        const info = await page.evaluate(() => ({
          text: (document.getElementById('tool-offline-badge') || {}).textContent || '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }));
        assert.ok(spec.label.test(info.text), label + ' badge text: ' + info.text.slice(0, 80));
        assert.ok(info.overflow <= 2, label + ' overflow ' + info.overflow);
        assert.deepEqual(errors, [], label + ' page errors: ' + errors.slice(0, 2).join(' | '));
        checked++;
        await context.close();
      }
    }
    console.log('PASS offline-labels-http: ' + pages.length + ' tools x 390/1440, ' + checked + ' loads, correct labels, no overflow or errors');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error('FAIL offline-labels-http: ' + e.message);
  process.exit(1);
});
