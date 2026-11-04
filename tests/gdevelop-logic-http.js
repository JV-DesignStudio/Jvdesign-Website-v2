#!/usr/bin/env node
// tests/gdevelop-logic-http.js (A1907)
// Checks every GDevelop workshop page names the visual logic concept it
// teaches, in a visible logic spotlight block, at 390px and 1440px.
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

const PAGES = [
  ['gdevelop-pong-workshop.html', /Input and collision/],
  ['gdevelop-snake-workshop.html', /State and conditions/],
  ['gdevelop-platformer-workshop.html', /Physics and checkpoints/],
  ['gdevelop-shooter-workshop.html', /Spawning and timers/],
  ['gdevelop-pointclick-workshop.html', /Inventory and puzzle conditions/],
  ['gdevelop-adventure-workshop.html', /NPCs and game states/]
];

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
      for (const [file, concept] of PAGES) {
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
          response = await page.goto(base + '/workshops/' + file, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
          if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
        }
        assert.equal(response && response.status(), 200, file + ' @' + width + ' status');

        const info = await page.evaluate(() => {
          const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
          const logic = document.querySelector('.ws-logic');
          const outcome = document.querySelector('.ws-outcome');
          const release = document.querySelector('.ws-release');
          const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
          return {
            logic: !!logic,
            href: logic ? logic.getAttribute('data-workshop-logic') : '',
            heading: text(logic && logic.querySelector('.ws-logic-title')),
            body: text(logic),
            afterOutcome: !!(logic && outcome && (outcome.compareDocumentPosition(logic) & Node.DOCUMENT_POSITION_FOLLOWING)),
            beforeRelease: !!(logic && release && (logic.compareDocumentPosition(release) & Node.DOCUMENT_POSITION_FOLLOWING)),
            duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });

        const where = file + ' @' + width;
        assert.ok(info.logic, where + ' logic block');
        assert.equal(info.href, file.replace('.html', ''), where + ' logic block id');
        assert.equal(info.heading, "The visual logic you'll use", where + ' logic heading');
        assert.ok(concept.test(info.body), where + ' names the concept');
        assert.ok(info.afterOutcome, where + ' logic block after outcome');
        assert.ok(info.beforeRelease, where + ' logic block before five moves');
        assert.deepEqual(info.duplicateIds, [], where + ' duplicate ids');
        assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow);
        assert.deepEqual(errors, [], where + ' console or page errors: ' + errors.slice(0, 2).join(' | '));

        await page.close();
      }
    }
    console.log('PASS gdevelop-logic-http: 6 GDevelop workshops at 390/1440 name their visual logic concept, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL gdevelop-logic-http: ' + error.message);
  process.exit(1);
});
