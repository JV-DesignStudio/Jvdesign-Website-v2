#!/usr/bin/env node
// tests/engine-gml-gamemaker-http.js (A1902)
// Checks the GameMaker hub publishes the GML skill progression in order, with
// a real episode for each rung, at 390px and 1440px.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

// A2609: the hub must not point at the removed -canvas ids.
const { assertHubData } = require('./lib/engine-hub');
assertHubData('gml-gamemaker', {
  expectedStart: 'gml-pong-workshop',
  absent: ['gml-pong-canvas', 'gml-breakout-canvas', 'gml-platformer-canvas', 'gml-rpg-canvas']
});

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const EXPECTED_LADDER = [
  ['Pong', 'Beginner'],
  ['Platformer', 'Beginner+'],
  ['Breakout', 'Improver'],
  ['Space Shooter', 'Intermediate'],
  ['RPG', 'Advanced finale']
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
        response = await page.goto(base + '/workshops/engine-gml-gamemaker.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        return {
          ladder: [...document.querySelectorAll('.hub-ladder li')].map((li) => ({
            title: text(li.querySelector('a')),
            level: text(li.querySelector('.hub-ladder-level')),
            href: (li.querySelector('a') || {}).getAttribute ? li.querySelector('a').getAttribute('href') : ''
          })),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.equal(info.ladder.length, EXPECTED_LADDER.length, width + 'px ladder length');
      EXPECTED_LADDER.forEach(([title, level], i) => {
        assert.equal(info.ladder[i].title, title, width + 'px ladder title ' + i);
        assert.equal(info.ladder[i].level, level, width + 'px ladder level ' + i);
        assert.ok(/^gml[_-].+\.html$/.test(info.ladder[i].href), width + 'px ladder href ' + i);
        assert.ok(fs.existsSync(path.join(ROOT, 'workshops', info.ladder[i].href)), width + 'px ladder page exists ' + i);
      });
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS engine-gml-gamemaker-http: 390/1440, five-rung GML progression, every rung links to a real episode, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL engine-gml-gamemaker-http: ' + error.message);
  process.exit(1);
});
