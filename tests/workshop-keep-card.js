#!/usr/bin/env node
// tests/workshop-keep-card.js (A3058)
// The "keep what you made" card on engine workshops: it must render, remember
// the learner's words on the device, compose a PNG, and offer a share message.
// Covers a Roblox, a Blender and a Minecraft page at 390px and 1440px.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const PAGES = [
  '/workshops/roblox-obby-workshop.html',
  '/workshops/blender-workshop.html',
  '/workshops/minecraft-custom-block-mod.html'
];

(async () => {
  const root = path.resolve(__dirname, '..');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.join(root, decodeURIComponent(url.pathname));
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push('console: ' + m.text());
    });

    for (const url of PAGES) {
      const id = path.basename(url, '.html');
      await page.setViewport({ width: 1440, height: 950 });
      await page.goto(base + url, { waitUntil: 'load' });
      if (await page.$('#cookie-decline')) await page.click('#cookie-decline');

      const block = await page.$('[data-workshop-keep="' + id + '"]');
      assert.ok(block, id + ': keep card block must exist');
      assert.ok(await page.$eval('[data-workshop-keep="' + id + '"]', (el) => el.offsetHeight > 0), id + ': block must render');

      const api = await page.evaluate(() => ({
        count: window.JVDSKeepCard && window.JVDSKeepCard.count(),
        hasTitle: !!document.querySelector('[data-workshop-keep]').getAttribute('data-workshop-title'),
        hasDownload: !!document.querySelector('[data-keep-download]'),
        hasCopy: !!document.querySelector('[data-keep-copy]')
      }));
      assert.equal(api.count, 1, id + ': one keep card instance');
      assert.ok(api.hasTitle, id + ': workshop title attribute');
      assert.ok(api.hasDownload && api.hasCopy, id + ': both actions present');

      await page.type('[data-workshop-keep="' + id + '"] [data-keep-made]', 'A test project');
      await page.type('[data-workshop-keep="' + id + '"] [data-keep-learned]', 'How to check my work');
      const png = await page.evaluate((wid) => window.JVDSKeepCard.compose(wid), id);
      assert.ok(png.startsWith('data:image/png;base64,'), id + ': compose returns a PNG data URL');
      assert.ok(png.length > 4000, id + ': PNG has content');

      const share = await page.evaluate((wid) => window.JVDSKeepCard.shareText(wid), id);
      assert.ok(/A test project/.test(share), id + ': share text names the project');
      assert.ok(/JVDesignStudio/.test(share), id + ': share text names the studio');
      assert.ok(new RegExp('/workshops/' + id + '\\.html').test(share), id + ': share text links the workshop');

      await page.evaluate(() => {
        navigator.clipboard = { writeText: () => Promise.resolve() };
      });
      await page.click('[data-workshop-keep="' + id + '"] [data-keep-copy]');
      await page.waitForFunction(() => /copied/i.test(document.querySelector('[data-keep-status]').textContent));
      const tone = await page.$eval('[data-workshop-keep="' + id + '"] [data-keep-status]', (el) => el.getAttribute('data-tone'));
      assert.equal(tone, 'good', id + ': copy confirms with a good status');

      await page.reload({ waitUntil: 'load' });
      const saved = await page.$eval('[data-workshop-keep="' + id + '"] [data-keep-made]', (el) => el.value);
      assert.equal(saved, 'A test project', id + ': the words are remembered on the device');

      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 950 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(overflow <= width, id + ' overflow at ' + width + ': ' + overflow);
      }
    }

    assert.deepEqual(errors, []);
    console.log('PASS: keep card renders, composes a PNG, copies a message, remembers words, no overflow at 1440/390 on ' + PAGES.length + ' pages');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
