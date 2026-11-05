#!/usr/bin/env node
// tests/diablo-blueprint-http.js (A2583)
// Page check for the Hellfire Descent blueprint: it loads at 390px and 1440px
// with the outcome panel and a finish line that names the next step.
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
        response = await page.goto(base + '/workshops/diablo-blueprint.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
      }
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const finish = document.querySelector('#wsFinish[data-workshop-finish="diablo-blueprint"]');
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        return {
          h1: document.querySelectorAll('h1').length,
          outcome: !!document.querySelector('.ws-outcome'),
          finish: !!finish,
          condition: text(finish && finish.querySelector('.ws-finish-condition')),
          next: (finish && finish.querySelector('.ws-finish-next')) ? finish.querySelector('.ws-finish-next').getAttribute('href') : null,
          progress: (finish && finish.querySelector('.ws-finish-progress')) ? finish.querySelector('.ws-finish-progress').getAttribute('href') : null,
          duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.equal(info.h1, 1, width + 'px one h1');
      assert.ok(info.outcome, width + 'px outcome panel');
      assert.ok(info.finish, width + 'px finish line');
      assert.ok(info.condition.length > 20, width + 'px finish condition names what finished means');
      assert.ok(/\.html$/.test(info.next || ''), width + 'px finish next step is a local page');
      assert.equal(info.progress, 'my-progress.html', width + 'px finish progress link');
      assert.deepEqual(info.duplicateIds, [], width + 'px duplicate ids');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS diablo-blueprint-http: 390/1440, outcome + finish line, one h1, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL diablo-blueprint-http: ' + error.message);
  process.exit(1);
});
