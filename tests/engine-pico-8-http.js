#!/usr/bin/env node
// tests/engine-pico-8-http.js (A1876)
// Checks the PICO-8 hub uses one age label, separates age from difficulty and
// publishes the skill ladder in order. Runs at 390px and 1440px.
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

const EXPECTED_LADDER = [
  ['Pong', 'Beginner'],
  ['Snake', 'Beginner'],
  ['Space Shooter', 'Beginner-Intermediate'],
  ['Match-3', 'Intermediate'],
  ['Dungeon Crawler', 'Intermediate'],
  ['Platformer', 'Advanced capstone']
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

      const response = await page.goto(base + '/workshops/engine-pico-8.html', { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const tags = [...document.querySelectorAll('.course-card .course-tag')].map(text);
        const ladder = [...document.querySelectorAll('.hub-ladder li')].map((li) => ({
          title: text(li.querySelector('a')),
          level: text(li.querySelector('.hub-ladder-level')),
          href: (li.querySelector('a') || {}).getAttribute ? li.querySelector('a').getAttribute('href') : ''
        }));
        return {
          tags,
          ladder,
          ageNote: text(document.querySelector('.hub-age-note')),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(info.tags.length > 0, width + 'px has workshop cards');
      assert.ok(info.tags.every((tag) => /Ages 8\+/.test(tag)), width + 'px every card shows Ages 8+');
      assert.ok(info.tags.every((tag) => !/Ages (7-9|9\+|10\+)/.test(tag)), width + 'px no old age bands');
      assert.ok(/Recommended age: 8\+/.test(info.ageNote), width + 'px hub note names the recommended age');
      assert.ok(/Difficulty is separate from age/i.test(info.ageNote), width + 'px note separates age and difficulty');
      assert.ok(/adult/i.test(info.ageNote), width + 'px note names adult support');

      assert.equal(info.ladder.length, EXPECTED_LADDER.length, width + 'px ladder length');
      EXPECTED_LADDER.forEach(([title, level], i) => {
        assert.equal(info.ladder[i].title, title, width + 'px ladder title ' + i);
        assert.equal(info.ladder[i].level, level, width + 'px ladder level ' + i);
        assert.ok(/^pico8-.+-workshop\.html$/.test(info.ladder[i].href), width + 'px ladder href ' + i);
      });
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS engine-pico-8-http: 390/1440, Ages 8+ everywhere, ladder order and levels, hub note, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL engine-pico-8-http: ' + error.message);
  process.exit(1);
});
