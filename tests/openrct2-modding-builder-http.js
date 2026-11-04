#!/usr/bin/env node
// tests/openrct2-modding-builder-http.js (A1936)
// Checks the OpenRCT2 Python builder names the concept each feature teaches,
// the runtime requirements, and the add-your-own-shop challenge.
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
        response = await page.goto(base + '/workshops/openrct2-modding-builder.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const block = document.querySelector('[data-workshop-skill="openrct2-modding-builder"]');
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        return {
          block: !!block,
          heading: text(block && block.querySelector('.ws-skill-title')),
          body: text(block),
          headings: block ? [...block.querySelectorAll('h3')].map(text) : [],
          h1: document.querySelectorAll('h1').length,
          duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(info.block, width + 'px concepts block');
      assert.equal(info.heading, 'Python concepts and runtime', width + 'px heading');
      assert.equal(info.h1, 1, width + 'px one h1');
      for (const concept of ['Dictionaries', 'Lists', 'Loops', 'Functions', 'File I/O']) {
        assert.ok(new RegExp(concept.replace('/', '\\/')).test(info.body), width + 'px names ' + concept);
      }
      assert.ok(/Define shop properties/.test(info.body), width + 'px ties dictionaries to shop properties');
      assert.ok(/Manage collections of items/.test(info.body), width + 'px ties lists to items');
      assert.ok(/Process multiple items/.test(info.body), width + 'px ties loops to processing');
      assert.ok(/registration and upgrade logic/.test(info.body), width + 'px ties functions to registration');
      assert.ok(/config/.test(info.body), width + 'px ties file I/O to config');
      assert.ok(/0\.5\.0 or newer/.test(info.body), width + 'px names OpenRCT2 version');
      assert.ok(/Python 3/.test(info.body), width + 'px names Python 3');
      assert.ok(/plugin folder/.test(info.body), width + 'px names plugin setup');
      assert.ok(/Add your own shop/.test(info.body), width + 'px challenge');
      assert.ok(/explain one line of code/i.test(info.body), width + 'px asks for explanation');
      assert.ok(info.headings.includes('Runtime requirements'), width + 'px runtime heading');
      assert.ok(info.headings.includes('Challenge'), width + 'px challenge heading');
      assert.deepEqual(info.duplicateIds, [], width + 'px duplicate ids');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS openrct2-modding-builder-http: 390/1440, Python concepts mapped to features, runtime requirements, add-your-own-shop challenge');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL openrct2-modding-builder-http: ' + error.message);
  process.exit(1);
});
