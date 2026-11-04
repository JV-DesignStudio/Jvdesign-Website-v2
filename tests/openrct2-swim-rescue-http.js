#!/usr/bin/env node
// tests/openrct2-swim-rescue-http.js (A1935)
// Checks the Swim Rescue workshop labels the simulation, the real-game test and
// the reference download, and requires both simulated and real behaviour.
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
        response = await page.goto(base + '/workshops/openrct2-swim-rescue.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const block = document.querySelector('[data-workshop-envs="openrct2-swim-rescue"]');
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        return {
          block: !!block,
          heading: text(block && block.querySelector('.ws-skill-title')),
          body: text(block),
          hasFinalChecklist: !!block && !!block.querySelector('h3'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i)
        };
      });

      assert.ok(info.block, width + 'px environment block');
      assert.equal(info.heading, 'Simulation, real game and reference', width + 'px heading');
      assert.ok(/Workshop simulation/.test(info.body), width + 'px labels simulation');
      assert.ok(/Real-game test/.test(info.body), width + 'px labels real game');
      assert.ok(/Reference download/.test(info.body), width + 'px labels reference');
      assert.ok(info.hasFinalChecklist, width + 'px final checklist');
      assert.ok(/Show the simulation/.test(info.body), width + 'px requires simulation demo');
      assert.ok(/Show the same rescue in OpenRCT2/.test(info.body), width + 'px requires real-game demo');
      assert.ok(/one thing the simulation simplifies/i.test(info.body), width + 'px asks for the difference');
      assert.deepEqual(info.duplicateIds, [], width + 'px duplicate ids');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS openrct2-swim-rescue-http: 390/1440, simulation vs real game vs reference labelled, final checklist for both');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL openrct2-swim-rescue-http: ' + error.message);
  process.exit(1);
});
