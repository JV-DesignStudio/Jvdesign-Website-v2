#!/usr/bin/env node
// tests/my-first-gamemaker-game-http.js (A1901)
// Checks the GameMaker series start page puts setup and licence terms before
// Episode 1, and shows one age standard, at 390px and 1440px.
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
        response = await page.goto(base + '/workshops/my-first-gamemaker-game.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const setup = document.querySelector('.ws-setup');
        const episodes = document.querySelector('.episodes');
        const body = document.body.innerText.replace(/\s+/g, ' ');
        return {
          setup: !!setup,
          setupId: setup ? setup.id : '',
          beforeEpisodes: !!(setup && episodes && (setup.compareDocumentPosition(episodes) & Node.DOCUMENT_POSITION_FOLLOWING)),
          setupText: text(setup),
          links: setup ? [...setup.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
          hasOldAge: /Ages? 9\+/.test(body),
          hasNewAge: /Ages? 10\+/.test(body),
          h1: document.querySelectorAll('h1').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(info.setup, width + 'px setup panel');
      assert.equal(info.setupId, 'setup', width + 'px setup anchor');
      assert.ok(info.beforeEpisodes, width + 'px setup before episodes');
      assert.ok(/Install/.test(info.setupText), width + 'px names install');
      assert.ok(/Account/.test(info.setupText), width + 'px names account');
      assert.ok(/Internet/.test(info.setupText), width + 'px names internet');
      assert.ok(/Licence/.test(info.setupText), width + 'px names licence');
      assert.ok(/non-commercial/i.test(info.setupText), width + 'px names non-commercial use');
      assert.ok(/commercial/i.test(info.setupText), width + 'px names commercial publishing');
      assert.ok(info.links.some((href) => /gamemaker\.io/.test(href || '')), width + 'px install link');
      assert.ok(info.hasNewAge, width + 'px shows Ages 10+');
      assert.ok(!info.hasOldAge, width + 'px no Ages 9+ left');
      assert.equal(info.h1, 1, width + 'px one h1');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS my-first-gamemaker-game-http: 390/1440, setup and licence before Episode 1, Ages 10+ standard, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL my-first-gamemaker-game-http: ' + error.message);
  process.exit(1);
});
