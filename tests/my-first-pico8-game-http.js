#!/usr/bin/env node
// tests/my-first-pico8-game-http.js (A1876)
// Checks the PICO-8 series hub shows Ages 8+ on every episode badge and keeps
// the adult-support note in the FAQ. Runs at 390px and 1440px.
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

      const response = await page.goto(base + '/workshops/my-first-pico8-game.html', { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        return {
          h1: document.querySelectorAll('h1').length,
          badges: [...document.querySelectorAll('.ep-badge')].map(text),
          faq: [...document.querySelectorAll('.faq-a')].map(text).join(' '),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      const ageBadges = info.badges.filter((badge) => /^Ages /.test(badge));
      assert.equal(info.h1, 1, width + 'px one h1');
      assert.equal(ageBadges.length, 6, width + 'px six age badges');
      assert.ok(ageBadges.every((badge) => badge === 'Ages 8+'), width + 'px every episode is Ages 8+');
      assert.ok(/age 8/i.test(info.faq), width + 'px FAQ names the age');
      assert.ok(/adult/i.test(info.faq), width + 'px FAQ names adult support');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS my-first-pico8-game-http: 390/1440, Ages 8+ on every episode, adult-support note, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL my-first-pico8-game-http: ' + error.message);
  process.exit(1);
});
