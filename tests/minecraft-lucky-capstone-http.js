#!/usr/bin/env node
// tests/minecraft-lucky-capstone-http.js (A1933)
// Checks the Lucky Block capstone brief requires an original texture, an
// original feature, a code explanation, testing, packaging and install notes.
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
        response = await page.goto(base + '/workshops/minecraft-lucky-mod.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const block = document.querySelector('[data-workshop-challenge="minecraft-lucky-mod"]');
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        return {
          block: !!block,
          heading: text(block && block.querySelector('h2')),
          body: text(block),
          items: block ? block.querySelectorAll('ol li').length : 0,
          duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(info.block, width + 'px capstone block');
      assert.equal(info.heading, 'Make the mod yours', width + 'px heading');
      assert.equal(info.items, 6, width + 'px six brief steps');
      assert.ok(/Original item/.test(info.body) && /texture/.test(info.body), width + 'px original item texture');
      assert.ok(/Original block/.test(info.body) && /texture/.test(info.body), width + 'px original block texture');
      assert.ok(/Special interaction/.test(info.body), width + 'px special interaction');
      assert.ok(/name one Java class/i.test(info.body), width + 'px code explanation');
      assert.ok(/fresh game session/.test(info.body), width + 'px fresh session test');
      assert.ok(/fix one bug/.test(info.body), width + 'px bug fix');
      assert.ok(/build the mod jar/.test(info.body) && /install steps/.test(info.body), width + 'px packaging and install');
      assert.ok(/at least one original texture and one feature you designed yourself/.test(info.body), width + 'px done condition');
      assert.deepEqual(info.duplicateIds, [], width + 'px duplicate ids');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS minecraft-lucky-capstone-http: 390/1440, six-step capstone brief with original texture, feature, code, test, package and install notes');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL minecraft-lucky-capstone-http: ' + error.message);
  process.exit(1);
});
