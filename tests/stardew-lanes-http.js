#!/usr/bin/env node
// tests/stardew-lanes-http.js (A3093)
// Renders every Stardew workshop page at 390 and 1440 and proves each step has
// the two-lane strip, the Studio link, the real file/section/line and a
// checkpoint that saves on the device. No install, no overflow.
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
  '.ico': 'image/x-icon'
};
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'stardew-lanes.json'), 'utf8'));
const pagesToCheck = Object.keys(data.pages);

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
      for (const slug of pagesToCheck) {
        const expected = data.pages[slug].length;
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

        await page.goto(base + '/workshops/' + slug + '.html', { waitUntil: 'load', timeout: 30000 });
        await page.waitForSelector('.sd-lane', { timeout: 10000 });

        const label = slug + ' @' + width;
        const info = await page.evaluate(() => ({
          lanes: document.querySelectorAll('.sd-lane').length,
          schoolLinks: [...document.querySelectorAll('.sd-lane-card--school .sd-lane-open')].map((a) => a.getAttribute('href')),
          files: [...document.querySelectorAll('.sd-lane-card--home code')].map((c) => c.textContent.trim()).filter(Boolean),
          locs: [...document.querySelectorAll('.sd-lane-card--home .sd-lane-loc')].map((c) => c.textContent.trim()).filter(Boolean),
          checks: document.querySelectorAll('[data-sd-done]').length,
          progress: (document.querySelector('.sd-lane-progress') || {}).textContent || '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }));

        assert.equal(info.lanes, expected, label + ' lanes');
        assert.equal(info.schoolLinks.length, expected, label + ' school links');
        assert.ok(info.schoolLinks.every((h) => h === data.studio), label + ' every school lane opens the Studio');
        assert.equal(info.files.length, expected, label + ' real-file labels');
        assert.equal(info.locs.length, expected, label + ' section and line labels');
        assert.equal(info.checks, expected, label + ' checkpoints');
        assert.ok(/0 of \d+ steps checked/.test(info.progress), label + ' progress starts at zero');
        assert.ok(info.overflow <= 2, label + ' overflow ' + info.overflow);

        await page.evaluate(() => {
          const box = document.querySelector('[data-sd-done]');
          box.checked = true;
          box.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await new Promise((r) => setTimeout(r, 60));
        const after = await page.evaluate(() => ({
          progress: (document.querySelector('.sd-lane-progress') || {}).textContent || '',
          stored: !!localStorage.getItem('jvds-stardew-lane:' + location.pathname.split('/').pop().replace('.html', ''))
        }));
        assert.ok(/1 of \d+ steps checked/.test(after.progress), label + ' progress advances');
        assert.ok(after.stored, label + ' checkpoint saves on this device');

        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('.sd-lane', { timeout: 10000 });
        const restored = await page.evaluate(() => document.querySelector('[data-sd-done]').checked);
        assert.ok(restored, label + ' checkpoint restores');

        assert.deepEqual(errors, [], label + ' page errors: ' + errors.slice(0, 2).join(' | '));
        checked++;
        await context.close();
      }
    }
    console.log('PASS stardew-lanes-http: ' + pagesToCheck.length + ' pages x 390/1440, ' +
      checked + ' loads, two lanes per step, saved checkpoints, no overflow or errors');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error('FAIL stardew-lanes-http: ' + e.message);
  process.exit(1);
});
