#!/usr/bin/env node
// tests/workshop-path-rollout-http.js (A2194)
// Samples every series and proves the shared before/during/after/next block
// renders at 390 and 1440, including a canvas page with no workshop loader.
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
  'scratch-catch-workshop', 'js-flappy-workshop', 'python-catch-workshop', 'cpp-pong-workshop',
  'godot-tutorial-canvas', 'minecraft-first-item-mod', 'blender-cube-workshop',
  'mugen-basics-workshop', 'unity-pong-workshop', 'barrel-blast-workshop'
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
      for (const slug of pages) {
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
        const label = slug + ' @' + width;
        await page.goto(base + '/workshops/' + slug + '.html', { waitUntil: 'load', timeout: 30000 });
        await page.waitForSelector('.ws-path-step', { timeout: 12000 });
        const info = await page.evaluate(() => ({
          steps: document.querySelectorAll('.ws-path-step').length,
          labels: [...document.querySelectorAll('.ws-path-label')].map((n) => n.textContent.trim()),
          links: [...document.querySelectorAll('.ws-path-link')].map((a) => a.getAttribute('href')).filter(Boolean),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }));
        assert.equal(info.steps, 4, label + ' four slots');
        for (const want of ['Before', 'During', 'After', 'Next']) assert.ok(info.labels.includes(want), label + ' label ' + want);
        assert.ok(info.links.length >= 4, label + ' real links');
        assert.ok(info.links.every((h) => h.startsWith('/')), label + ' absolute links');
        assert.ok(info.overflow <= 2, label + ' overflow ' + info.overflow);
        assert.deepEqual(errors, [], label + ' page errors: ' + errors.slice(0, 2).join(' | '));
        checked++;
        await context.close();
      }
    }
    console.log('PASS workshop-path-rollout-http: ' + pages.length + ' series pages x 390/1440, ' +
      checked + ' loads, four slots and real links, no overflow or errors');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error('FAIL workshop-path-rollout-http: ' + e.message);
  process.exit(1);
});
