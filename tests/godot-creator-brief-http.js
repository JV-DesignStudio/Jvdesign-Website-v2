#!/usr/bin/env node
// tests/godot-creator-brief-http.js (A3116)
// Renders the Godot Creator brief at 390 and 1440 and checks the Creator page
// contract: brief, four phases, checklists, recovery block and a real next step.
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
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      res.writeHead(err ? 404 : 200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
      });
      res.end(err ? '' : buf);
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
      await page.goto(base + '/workshops/godot-creator-brief.html', { waitUntil: 'load', timeout: 30000 });
      const info = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelectorAll('h1').length,
        phases: document.querySelectorAll('.step-card[data-step]').length,
        checks: document.querySelectorAll('.check-task').length,
        complete: document.querySelectorAll('.step-complete-btn').length,
        brief: !!document.getElementById('brief-title'),
        outcome: !!document.querySelector('.ws-outcome'),
        stuck: !!document.querySelector('.ws-stuck'),
        next: !!document.querySelector('.next-route'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      const label = width + 'px';
      assert.ok(/Godot Creator/.test(info.title), label + ' title');
      assert.equal(info.h1, 1, label + ' one h1');
      assert.equal(info.phases, 4, label + ' four phases');
      assert.ok(info.checks >= 12, label + ' checklist items (' + info.checks + ')');
      assert.equal(info.complete, 4, label + ' one complete button per phase');
      assert.ok(info.brief, label + ' brief section');
      assert.ok(info.outcome && info.stuck && info.next, label + ' page blocks');
      assert.ok(info.overflow <= 2, label + ' overflow ' + info.overflow);
      assert.deepEqual(errors, [], label + ' page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }
    console.log('PASS godot-creator-brief-http: brief, 4 phases, checklists, recovery and next step at 390/1440');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error('FAIL godot-creator-brief-http: ' + e.message);
  process.exit(1);
});
