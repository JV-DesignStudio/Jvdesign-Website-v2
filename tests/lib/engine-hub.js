#!/usr/bin/env node
// Shared checker for the per-engine hub pages. A2338 consolidated the old
// -canvas pages into the -workshop pages, so a hub that still pointed at a
// -canvas id silently lost a whole section (and its Pip callout) because
// generate-engine-hubs.js filters unknown ids. This checks the source data and
// the rendered page at 390px and 1440px so that cannot regress unseen.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..', '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function loadData() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'engine-hubs.json'), 'utf8'));
  const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
  return { config, known: new Set(workshops.map((w) => w.id)) };
}

function assertHubData(engineId, opts = {}) {
  const { config, known } = loadData();
  const engine = config.engines.find((e) => e.id === engineId);
  assert.ok(engine, engineId + ' exists in content/engine-hubs.json');

  const sections = engine.sections || [];
  const allIds = sections.flatMap((s) => s.workshops || []);
  const dead = allIds.filter((id) => !known.has(id));
  assert.deepEqual(dead, [], engineId + ' hub has no ids missing from content/workshops.json');
  const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  assert.deepEqual([...new Set(dupes)], [], engineId + ' hub lists no workshop twice');

  const start = sections.find((s) => s.kind === 'start' || s.id === 'start');
  assert.ok(start, engineId + ' hub has a start section');
  assert.ok((start.workshops || []).length >= 1, engineId + ' start section has a card');
  if (opts.expectedStart) {
    assert.deepEqual(start.workshops, [opts.expectedStart], engineId + ' start section points at the consolidated workshop');
  }
  for (const id of opts.absent || []) {
    assert.ok(!allIds.includes(id), engineId + ' hub no longer lists ' + id);
  }
  assert.ok(sections.every((s) => (s.workshops || []).length >= 1), engineId + ' every section is populated');
  return { engine, known, sections };
}

async function run(engineId, opts = {}) {
  const { known, sections } = assertHubData(engineId, opts);

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
  const pageName = 'engine-' + engineId + '.html';

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

      const response = await page.goto(base + '/workshops/' + pageName, { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const q = (s) => document.querySelectorAll(s).length;
        return {
          sections: q('[data-hub-section]'),
          startSection: q('[data-hub-section][aria-labelledby="s-start"]'),
          startCards: q('[data-hub-section][aria-labelledby="s-start"] .course-card'),
          pip: q('.hub-say--pip'),
          lumo: q('.hub-say--lumo'),
          hrefs: [...document.querySelectorAll('.course-card')].map((a) => a.getAttribute('href')),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.equal(info.sections, sections.length, width + 'px renders every populated section');
      assert.equal(info.startSection, 1, width + 'px has one start section');
      assert.ok(info.startCards >= 1, width + 'px start section has a card');
      assert.equal(info.pip, 1, width + 'px has exactly one Pip callout');
      assert.equal(info.lumo, 1, width + 'px has exactly one Lumo callout');
      for (const href of info.hrefs) {
        assert.ok(href, width + 'px card has a href');
        assert.ok(!href.startsWith('../workshops/') && !href.startsWith('workshops/'), width + 'px card does not link back to itself: ' + href);
        assert.ok(known.has(decodeURIComponent(href).replace(/\.html$/, '')), width + 'px card is in the catalogue: ' + href);
      }
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('PASS engine-' + engineId + '-http: ' + sections.length + ' sections, start + Pip restored at 390/1440, 0 dead ids, no overflow or errors');
}

module.exports = { run, assertHubData };
