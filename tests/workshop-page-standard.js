#!/usr/bin/env node
// tests/workshop-page-standard.js (A2191)
// Guards the reference implementation of the workshop page standard on
// workshops/js-snake-workshop.html: the outcome panel, the "Stuck? Try this"
// recovery block, the creative extension field and the next-step link, at
// 390px and 1440px with no overflow and no page errors.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'workshops/my-first-browser-game.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const raw = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
for (const marker of ['WS-OUTCOME:START', 'WS-OUTCOME:END', 'WS-STUCK:START', 'WS-STUCK:END', 'WS-NEXT:START', 'WS-NEXT:END']) {
  assert.ok(raw.includes(marker), PAGE + ' missing ' + marker);
}
for (const marker of ['WS-STUCK:START', 'WS-NEXT:START']) {
  assert.equal(raw.split(marker).length - 1, 1, PAGE + ' must carry exactly one ' + marker);
}

for (const href of ['js-flappy-workshop.html', 'engine-javascript.html', 'js-cheatsheet.html']) {
  assert.ok(fs.existsSync(path.join(ROOT, 'workshops', href)), 'next-step link target missing: ' + href);
}

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
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()));
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const resp = await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
      const where = PAGE + ' @' + width;
      assert.equal(resp && resp.status(), 200, where + ' status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const outcome = document.querySelector('.ws-outcome');
        const stuck = document.querySelector('.ws-stuck');
        const next = document.querySelector('.next-route[data-workshop-next]');
        const items = stuck ? [...stuck.querySelectorAll('details.ws-stuck-item')] : [];
        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
        const unnamedImages = [...document.querySelectorAll('.ws-outcome img, .ws-stuck img')]
          .filter((img) => !img.hasAttribute('alt'));
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          outcomeVisible: !!outcome && outcome.getBoundingClientRect().height > 20,
          outcomeLabels: outcome ? [...outcome.querySelectorAll('dt')].map((d) => d.textContent.trim()) : [],
          outcomeText: text(outcome),
          stuckVisible: !!stuck && stuck.getBoundingClientRect().height > 20,
          stuckText: text(stuck),
          stuckItems: items.map((el) => text(el)),
          stuckHeadings: items.map((el) => text(el.querySelector('summary'))),
          nextVisible: !!next && next.getBoundingClientRect().height > 20,
          nextHref: next ? (next.querySelector('a.next-route-inner') || {}).getAttribute?.('href') : null,
          nextText: text(next),
          duplicateIds,
          unnamedImages: unnamedImages.length
        };
      });

      assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow + 'px');
      assert.ok(info.outcomeVisible, where + ' outcome panel visible');
      assert.deepEqual(info.outcomeLabels, ['Your project', "You'll learn", 'Finish with', 'Then extend it'], where + ' outcome labels');
      assert.ok(info.outcomeText.length > 80, where + ' outcome text too short');

      assert.ok(info.stuckVisible, where + ' Stuck? Try this block visible');
      assert.ok(/Stuck\? Try this/.test(info.stuckText), where + ' recovery heading');
      assert.ok(info.stuckItems.length >= 3, where + ' at least three recovery items, got ' + info.stuckItems.length);
      for (const item of info.stuckItems) {
        assert.ok(/What you'll see:/.test(item), where + ' recovery item names the symptom: ' + item.slice(0, 60));
        assert.ok(/Fix:/.test(item), where + ' recovery item names the fix: ' + item.slice(0, 60));
      }

      assert.ok(info.nextVisible, where + ' next-step block visible');
      assert.equal(info.nextHref, 'js-flappy-workshop.html', where + ' next-step href');
      assert.ok(/Up next in the series/.test(info.nextText), where + ' next-step kicker');

      assert.deepEqual(info.duplicateIds, [], where + ' duplicate element ids');
      assert.equal(info.unnamedImages, 0, where + ' character images without alt');
      assert.deepEqual(errors.filter((e) => !/Failed to load resource|net::ERR_FAILED/i.test(e)), [], where + ' console/page errors');

      await page.close();
    }
    console.log('PASS workshop-page-standard: my-first-browser-game.html at 390/1440 carries outcome, Stuck? Try this, extension and next step, 0 errors, no overflow');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAIL workshop-page-standard: ' + e.message); process.exit(1); });
