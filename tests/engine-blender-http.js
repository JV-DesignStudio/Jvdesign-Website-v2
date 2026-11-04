#!/usr/bin/env node
// tests/engine-blender-http.js (A1925)
// Checks the Blender hub presents one five-stage path, that every stage names
// the workshop and the skill it expects, and that the "ready for the next
// course?" checkpoint recommends the right next workshop. Runs at 390 and
// 1440 with no overflow or page errors.
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

  const expectedStages = [
    ['blender-workshop.html', 'Start here'],
    ['blender-character-workshop.html', 'Beginner'],
    ['blender-rigging-workshop.html', 'Improver'],
    ['blender-scene-workshop.html', 'Advanced'],
    ['blender-world-workshop.html', 'Capstone']
  ];

  try {
    for (const width of [390, 1440]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
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

      const response = await page.goto(base + '/workshops/engine-blender.html', { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');
      await page.waitForSelector('[data-engine-check]');
      await page.waitForFunction(() => !!window.__jvdsBlenderPath, { timeout: 5000 });

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const ladder = [...document.querySelectorAll('.hub-ladder li')].map((li) => ({
          title: text(li.querySelector('a')),
          level: text(li.querySelector('.hub-ladder-level')),
          note: text(li.querySelector('.hub-ladder-note')),
          href: (li.querySelector('a') || {}).getAttribute ? li.querySelector('a').getAttribute('href') : ''
        }));
        return {
          ladderTitle: text(document.querySelector('.hub-ladder h2')),
          ladder,
          checks: document.querySelectorAll('[data-engine-check] [data-skill]').length,
          nextText: text(document.querySelector('[data-next-text]')),
          nextHref: (document.querySelector('[data-next-link]') || {}).getAttribute
            ? document.querySelector('[data-next-link]').getAttribute('href') : '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.equal(info.ladderTitle, 'Your Blender path', width + 'px ladder title');
      assert.equal(info.ladder.length, 5, width + 'px five stages');
      expectedStages.forEach(([href, level], i) => {
        assert.equal(info.ladder[i].href, href, width + 'px stage ' + (i + 1) + ' href');
        assert.equal(info.ladder[i].level, level, width + 'px stage ' + (i + 1) + ' level');
        assert.ok(info.ladder[i].title.length > 0, width + 'px stage ' + (i + 1) + ' title');
        assert.ok(info.ladder[i].note.length > 20, width + 'px stage ' + (i + 1) + ' note');
      });
      assert.ok(/move, rotate and scale/i.test(info.ladder[1].note), width + 'px stage 2 names its prerequisite');
      assert.ok(/bones/i.test(info.ladder[2].note), width + 'px stage 3 names rigging');
      assert.ok(/materials/i.test(info.ladder[3].note), width + 'px stage 4 names materials');
      assert.ok(/brief/i.test(info.ladder[4].note), width + 'px stage 5 names the brief');

      assert.equal(info.checks, 7, width + 'px checkpoint has seven skills');
      assert.equal(info.nextHref, 'blender-workshop.html', width + 'px checkpoint starts at stage 1');
      assert.ok(/Stage 1/i.test(info.nextText), width + 'px checkpoint names stage 1');

      await page.evaluate(() => {
        [0, 1].forEach((i) => {
          const c = document.querySelector('[data-skill="' + i + '"]');
          c.checked = true;
          c.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
      await new Promise((r) => setTimeout(r, 60));
      const afterTwo = await page.evaluate(() => ({
        text: document.querySelector('[data-next-text]').textContent.replace(/\s+/g, ' ').trim(),
        href: document.querySelector('[data-next-link]').getAttribute('href'),
        stored: (() => { try { return !!localStorage.getItem('jvds-blender-path-v1'); } catch (e) { return false; } })()
      }));
      assert.equal(afterTwo.href, 'blender-rigging-workshop.html', width + 'px next after modelling');
      assert.ok(/Episode 3/i.test(afterTwo.text), width + 'px next text after modelling');
      assert.ok(afterTwo.stored, width + 'px checkpoint saves to this device');

      await page.evaluate(() => {
        [2, 3, 4, 5, 6].forEach((i) => {
          const c = document.querySelector('[data-skill="' + i + '"]');
          c.checked = true;
          c.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
      await new Promise((r) => setTimeout(r, 60));
      const afterAll = await page.evaluate(() => ({
        text: document.querySelector('[data-next-text]').textContent.replace(/\s+/g, ' ').trim(),
        href: document.querySelector('[data-next-link]').getAttribute('href')
      }));
      assert.equal(afterAll.href, 'blender-world-workshop.html', width + 'px next after all skills');
      assert.ok(/independent/i.test(afterAll.text), width + 'px next text after all skills');

      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-engine-check]');
      await page.waitForFunction(() => !!window.__jvdsBlenderPath, { timeout: 5000 });
      const restored = await page.evaluate(() => ({
        checked: document.querySelectorAll('[data-engine-check] [data-skill]:checked').length,
        href: document.querySelector('[data-next-link]').getAttribute('href')
      }));
      assert.equal(restored.checked, 7, width + 'px checkpoint restores the ticks');
      assert.equal(restored.href, 'blender-world-workshop.html', width + 'px checkpoint restores the recommendation');

      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await context.close();
    }
    console.log('PASS engine-blender-http: five-stage path, checkpoint recommendation, 390/1440, no overflow or errors');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL engine-blender-http: ' + error.message);
  process.exit(1);
});
