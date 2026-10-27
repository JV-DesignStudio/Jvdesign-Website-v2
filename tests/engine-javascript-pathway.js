#!/usr/bin/env node
// tests/engine-javascript-pathway.js (A1841)
// Guards the five-step JavaScript pathway on workshops/engine-javascript.html:
// the steps are in order, each step links to the next one, every link resolves,
// the completion checklist is present, and the page has no overflow or console
// errors at 390px and 1440px.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

(async () => {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 950 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const resp = await page.goto(base + '/workshops/engine-javascript.html', { waitUntil: 'load', timeout: 30000 });
      assert.equal(resp.status(), 200, 'page @' + width + ' status');
      const info = await page.evaluate(() => {
        const steps = [...document.querySelectorAll('.js-path-step')].map((li) => {
          const card = li.querySelector('.js-path-card');
          const next = li.querySelector('.js-path-next a');
          return {
            href: card ? card.getAttribute('href') : null,
            cardAbs: card ? card.href : null,
            next: next ? next.getAttribute('href') : null,
            nextAbs: next ? next.href : null
          };
        });
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          steps,
          checks: document.querySelectorAll('.js-path-check li').length,
          heading: (document.querySelector('#js-path-title') || {}).textContent || ''
        };
      });
      const where = 'pathway @' + width;
      assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow + 'px');
      assert.equal(info.steps.length, 5, where + ' five stages');
      assert.ok(/pathway/i.test(info.heading), where + ' heading');
      assert.ok(info.checks >= 5, where + ' completion checklist');
      info.steps.forEach((step, i) => {
        assert.ok(step.href && step.cardAbs, where + ' stage ' + (i + 1) + ' card link');
        assert.ok(step.next && step.nextAbs, where + ' stage ' + (i + 1) + ' next link');
        if (i < 4) assert.equal(step.next, info.steps[i + 1].href, where + ' stage ' + (i + 1) + ' links to stage ' + (i + 2));
      });
      for (const step of info.steps) {
        const cardResp = await fetch(step.cardAbs);
        assert.equal(cardResp.status, 200, where + ' resolves ' + step.cardAbs);
        const nextResp = await fetch(step.nextAbs);
        assert.equal(nextResp.status, 200, where + ' resolves next ' + step.nextAbs);
      }
      assert.deepEqual(errors, [], where + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }
    console.log('PASS engine-javascript-pathway: 5 ordered stages, links resolve, checklist present, 390/1440 clean');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAIL engine-javascript-pathway: ' + e.message); process.exit(1); });
