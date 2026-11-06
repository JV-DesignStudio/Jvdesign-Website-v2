#!/usr/bin/env node
// tests/engine-python-http.js (A2604)
// The Python hub lost its whole start section (and Pip callout) after A2338
// consolidated the -canvas pages into the -workshop pages. Checks the source
// data has no dead ids, the start section points at the consolidated catch
// workshop, the page keeps one Pip and one Lumo callout, and every card is in
// the catalogue, at 390px and 1440px with no overflow or page errors.
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

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'engine-hubs.json'), 'utf8'));
const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const known = new Set(workshops.map((w) => w.id));
const python = config.engines.find((e) => e.id === 'python');
assert.ok(python, 'python engine exists in engine-hubs.json');

const sectionIds = [...new Set((python.sections || []).flatMap((s) => s.workshops || []))];
const dead = sectionIds.filter((id) => !known.has(id));
assert.deepEqual(dead, [], 'python hub has no ids missing from content/workshops.json');
assert.ok(!sectionIds.some((id) => /-canvas$/.test(id)), 'python hub no longer points at -canvas redirect stubs');
const start = (python.sections || []).find((s) => s.kind === 'start');
assert.ok(start, 'python hub has a start section');
assert.deepEqual(start.workshops, ['python-catch-workshop'], 'start section points at the consolidated catch workshop');
assert.ok(!(python.sections || []).some((s) => s.id === 'page-builds'), 'redundant page-builds section is removed');

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

      const response = await page.goto(base + '/workshops/engine-python.html', { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const q = (s) => document.querySelectorAll(s).length;
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        return {
          pip: q('.hub-say--pip'),
          lumo: q('.hub-say--lumo'),
          startSection: q('[data-hub-section][aria-labelledby="s-start"]'),
          startCards: [...document.querySelectorAll('[data-hub-section][aria-labelledby="s-start"] .course-card')].map((a) => a.getAttribute('href')),
          pageBuilds: q('[aria-labelledby="s-page-builds"]'),
          hrefs: [...document.querySelectorAll('.course-card')].map((a) => a.getAttribute('href')),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.equal(info.startSection, 1, width + 'px has one start section');
      assert.ok(info.startCards.length >= 1, width + 'px start section has a card');
      assert.ok(info.startCards.every((h) => h === 'python-catch-workshop.html'), width + 'px start card is the consolidated catch workshop');
      assert.equal(info.pip, 1, width + 'px has exactly one Pip callout');
      assert.equal(info.lumo, 1, width + 'px has exactly one Lumo callout');
      assert.equal(info.pageBuilds, 0, width + 'px has no empty page-builds section');
      for (const href of info.hrefs) {
        assert.ok(href, width + 'px card has a href');
        assert.ok(!href.startsWith('../workshops/') && !href.startsWith('workshops/'), width + 'px card does not link back to itself: ' + href);
        assert.ok(known.has(decodeURIComponent(href).replace(/\.html$/, '')), width + 'px card is in the catalogue: ' + href);
      }
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS engine-python-http: 390/1440, start section and Pip restored, 0 dead ids, no overflow or errors');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL engine-python-http: ' + error.message);
  process.exit(1);
});
