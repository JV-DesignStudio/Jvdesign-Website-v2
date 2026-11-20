#!/usr/bin/env node
// tests/workshop-demo-runtime.js (A3125)
// The See it tab embeds a generated finished-build page. A demo that throws a
// page error, paints nothing, or has no shell/controls is not a preview of the
// game a learner is about to build. This loads every Scratch demo and checks
// the game runs, the blocks panel opens and the touch pad is present.
// Run: node tests/workshop-demo-runtime.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const DEMO_DIR = path.join(ROOT, 'workshops', 'demos');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? ' :: ' + detail : ''));
  if (!ok) failures++;
};

const demos = fs.readdirSync(DEMO_DIR).filter((f) => /^(scratch-|my-first-scratch-).*\.html$/.test(f)).sort();
const WITH_PAD = /^(scratch-catch|scratch-maze|scratch-platformer|scratch-pong|scratch-quiz|my-first-scratch)/;

function painted(page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4000) if (d[i] !== 0) return true;
    } catch (e) {}
    return false;
  });
}

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  check('scratch demos exist', demos.length >= 6, String(demos.length));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const demo of demos) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        if (r.url().startsWith(base) || /^data:|^blob:/.test(r.url())) return r.continue();
        return r.abort();
      });
      await page.setViewport({ width: 900, height: 760 });
      await page.goto(base + '/workshops/demos/' + demo, { waitUntil: 'load', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 650));

      check(demo + ': no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      check(demo + ': canvas paints', await painted(page));

      const shell = await page.evaluate(() => ({
        title: (document.querySelector('.demo-top h1') || {}).textContent || '',
        blocks: !!document.querySelector('#demoCode'),
        button: !!document.querySelector('.demo-code-btn')
      }));
      check(demo + ': has a titled shell', !!shell.title.trim());
      check(demo + ': has a blocks button', shell.blocks && shell.button);

      if (shell.button) {
        await page.evaluate(() => document.querySelector('.demo-code-btn').click());
        const opened = await page.evaluate(() => {
          const code = document.querySelector('#demoCode');
          const pre = code && code.querySelector('pre code');
          return !!code && !code.hidden && !!pre && (pre.textContent || '').indexOf('set [') !== -1;
        });
        check(demo + ': blocks panel opens with step code', opened);
      }

      if (WITH_PAD.test(demo)) {
        const keys = await page.$$eval('.demo-key', (els) => els.length);
        check(demo + ': touch controls are present', keys > 0, String(keys));
        if (keys > 0) {
          const before = errors.length;
          await page.evaluate(() => {
            const btn = document.querySelector('.demo-key');
            btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          });
          await new Promise((r) => setTimeout(r, 120));
          await page.evaluate(() => {
            const btn = document.querySelector('.demo-key');
            btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          });
          await new Promise((r) => setTimeout(r, 120));
          check(demo + ': touch control dispatches without errors', errors.length === before, errors.slice(before).join(' | '));
        }
      }

      await page.setViewport({ width: 390, height: 800 });
      await new Promise((r) => setTimeout(r, 120));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
      check(demo + ': no horizontal overflow at 390px', overflow <= 390, 'scrollWidth ' + overflow);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\nFAIL workshop-demo-runtime: ' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nPASS workshop-demo-runtime: ' + demos.length + ' Scratch finished builds run, open their blocks and respond to touch');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
