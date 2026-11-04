#!/usr/bin/env node
// tests/engine-hubs-checkpoint-http.js (A2431)
// Every engine hub that has a skill ladder must also render the "Ready for the
// next course?" checkpoint: one skill per ladder stage, a next-step link that
// advances as skills are ticked, per-engine localStorage save and restore, and
// no overflow or console errors at 390 and 1440. Runs against the generated
// pages in workshops/engine-<id>.html.
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

function camel(value) {
  return String(value || '').replace(/(^|-)([a-z0-9])/g, (_, _sep, ch) => ch.toUpperCase());
}

const hubs = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'engine-hubs.json'), 'utf8'))
  .engines.filter((engine) => engine.checkpoint);

(async () => {
  assert.ok(hubs.length >= 5, 'expected at least five engine hubs with a checkpoint');

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
      for (const engine of hubs) {
        const cp = engine.checkpoint;
        const api = '__jvds' + camel(engine.id) + 'Path';
        const key = 'jvds-' + engine.id + '-path-v1';
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

        const label = engine.id + ' ' + width + 'px';
        const response = await page.goto(base + '/workshops/engine-' + engine.id + '.html', {
          waitUntil: 'load', timeout: 30000
        });
        assert.equal(response && response.status(), 200, label + ' status');
        await page.waitForSelector('[data-engine-check]');
        await page.waitForFunction((name) => !!window[name], { timeout: 5000 }, api);

        const info = await page.evaluate(() => ({
          checks: document.querySelectorAll('[data-engine-check] [data-skill]').length,
          nextHref: document.querySelector('[data-next-link]').getAttribute('href'),
          nextText: document.querySelector('[data-next-text]').textContent.replace(/\s+/g, ' ').trim(),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }));

        assert.equal(info.checks, cp.skills.length, label + ' skill checkboxes');
        assert.equal(info.nextHref, cp.steps[0].href, label + ' starts at the first step');
        assert.ok(info.nextText.length > 20, label + ' next step names the skill');
        assert.ok(info.overflow <= 2, label + ' horizontal overflow ' + info.overflow);

        await page.evaluate(() => {
          const c = document.querySelector('[data-skill="0"]');
          c.checked = true;
          c.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await new Promise((r) => setTimeout(r, 60));

        const afterOne = await page.evaluate((storageKey) => ({
          href: document.querySelector('[data-next-link]').getAttribute('href'),
          stored: (() => { try { return !!localStorage.getItem(storageKey); } catch (e) { return false; } })()
        }), key);
        assert.equal(afterOne.href, cp.steps[1].href, label + ' advances after one skill');
        assert.ok(afterOne.stored, label + ' saves to this device');

        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-engine-check]');
        await page.waitForFunction((name) => !!window[name], { timeout: 5000 }, api);
        const restored = await page.evaluate(() => ({
          checked: document.querySelectorAll('[data-engine-check] [data-skill]:checked').length,
          href: document.querySelector('[data-next-link]').getAttribute('href')
        }));
        assert.equal(restored.checked, 1, label + ' restores the tick');
        assert.equal(restored.href, cp.steps[1].href, label + ' restores the recommendation');

        await page.evaluate(() => {
          document.querySelectorAll('[data-engine-check] [data-skill]').forEach((c) => {
            if (!c.checked) {
              c.checked = true;
              c.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        });
        await new Promise((r) => setTimeout(r, 60));
        const afterAll = await page.evaluate(() => ({
          href: document.querySelector('[data-next-link]').getAttribute('href')
        }));
        assert.equal(afterAll.href, cp.steps[cp.steps.length - 1].href, label + ' finishes at the last step');

        assert.deepEqual(errors, [], label + ' console or page errors: ' + errors.slice(0, 2).join(' | '));
        await context.close();
      }
    }
    console.log('PASS engine-hubs-checkpoint-http: ' + hubs.length + ' hubs x 390/1440, skills, save and restore, no overflow or errors');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL engine-hubs-checkpoint-http: ' + error.message);
  process.exit(1);
});
