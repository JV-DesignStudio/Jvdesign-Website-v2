#!/usr/bin/env node
// tests/unity-multiplayer-prereq-http.js (A1890)
// Checks the Unity multiplayer episode has a prerequisite checkpoint before the
// five moves, covering ownership, authority, disconnects and two-client testing.
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

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
      });
      res.end(err ? '' : data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 950 });
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      page.on('request', (r) => (
        r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:')
          ? r.continue()
          : r.abort()
      ));

      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) {
          errors.push(m.text());
        }
      });

      let response = null;
      for (let attempt = 0; attempt < 2 && !(response && response.status() === 200); attempt++) {
        response = await page.goto(base + '/workshops/unity-multiplayer-workshop.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const block = document.querySelector('[data-workshop-prereq="unity-multiplayer-workshop"]');
        const outcome = document.querySelector('.ws-outcome');
        const release = document.querySelector('.ws-release');
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        return {
          block: !!block,
          heading: text(block && block.querySelector('.ws-skill-title')),
          body: text(block),
          details: block ? block.querySelectorAll('details').length : 0,
          afterOutcome: !!(block && outcome && (outcome.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING)),
          beforeRelease: !!(block && release && (block.compareDocumentPosition(release) & Node.DOCUMENT_POSITION_FOLLOWING)),
          duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(info.block, width + 'px prerequisite block');
      assert.equal(info.heading, 'Multiplayer prerequisite checkpoint', width + 'px heading');
      assert.ok(/Host and client/.test(info.body), width + 'px host and client');
      assert.ok(/Ownership/.test(info.body), width + 'px ownership');
      assert.ok(/Server authority/.test(info.body), width + 'px server authority');
      assert.ok(/Disconnects/.test(info.body), width + 'px disconnects');
      assert.ok(/Two-client test/.test(info.body), width + 'px two-client testing');
      assert.ok(/Two players in one arena collecting coins and seeing the same score/.test(info.body), width + 'px modest first goal');
      assert.equal(info.details, 2, width + 'px quick checks');
      assert.ok(/why does server authority matter/i.test(info.body), width + 'px authority explanation');
      assert.ok(info.afterOutcome, width + 'px after outcome');
      assert.ok(info.beforeRelease, width + 'px before five moves');
      assert.deepEqual(info.duplicateIds, [], width + 'px duplicate ids');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS unity-multiplayer-prereq-http: 390/1440, prerequisite checkpoint before the five moves, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL unity-multiplayer-prereq-http: ' + error.message);
  process.exit(1);
});
