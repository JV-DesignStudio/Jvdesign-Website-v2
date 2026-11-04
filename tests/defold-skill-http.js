#!/usr/bin/env node
// tests/defold-skill-http.js (A1884)
// Checks every Defold episode states its prerequisites, the new concept and the
// skills it reuses before the five moves, at 390px and 1440px.
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

const PAGES = [
  ['defold-pong-workshop.html', /None\. This is the first episode\./, /Input, sprites and collision/],
  ['defold-snake-workshop.html', /Pong, or basic input and collision/, /Grid logic, growth and game states/],
  ['defold-shooter-workshop.html', /Pong and Snake/, /Spawning, projectiles and enemy waves/],
  ['defold-puzzle-workshop.html', /Pong and Snake/, /Grid swapping, combinations and scoring/],
  ['defold-dungeon-workshop.html', /Pong, Snake and Puzzle/, /Tile maps, health and room transitions/],
  ['defold-platformer-workshop.html', /Pong, Snake, Shooter, Puzzle and Dungeon/, /Physics, checkpoints and level switching/]
];

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
      for (const [file, prereq, concept] of PAGES) {
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
          response = await page.goto(base + '/workshops/' + file, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
          if (!(response && response.status() === 200)) await new Promise((r) => setTimeout(r, 300));
        }
        assert.equal(response && response.status(), 200, file + ' @' + width + ' status');

        const info = await page.evaluate(() => {
          const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
          const block = document.querySelector('.ws-skill');
          const release = document.querySelector('.ws-release');
          const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
          return {
            block: !!block,
            href: block ? block.getAttribute('data-workshop-skill') : '',
            heading: text(block && block.querySelector('.ws-skill-title')),
            body: text(block),
            beforeRelease: !!(block && release && (block.compareDocumentPosition(release) & Node.DOCUMENT_POSITION_FOLLOWING)),
            duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });

        const where = file + ' @' + width;
        assert.ok(info.block, where + ' skill block');
        assert.equal(info.href, file.replace('.html', ''), where + ' skill block id');
        assert.equal(info.heading, 'Defold skills in this episode', where + ' skill heading');
        assert.ok(/Prerequisites/.test(info.body), where + ' names prerequisites');
        assert.ok(/New concept/.test(info.body), where + ' names the new concept');
        assert.ok(/Reuses/.test(info.body), where + ' names reused skills');
        assert.ok(prereq.test(info.body), where + ' prerequisite matches the series');
        assert.ok(concept.test(info.body), where + ' concept matches the episode');
        assert.ok(info.beforeRelease, where + ' skill block before five moves');
        assert.deepEqual(info.duplicateIds, [], where + ' duplicate ids');
        assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow);
        assert.deepEqual(errors, [], where + ' console or page errors: ' + errors.slice(0, 2).join(' | '));

        await page.close();
      }
    }
    console.log('PASS defold-skill-http: 6 Defold episodes at 390/1440 state prerequisites, new concept and reused skills, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL defold-skill-http: ' + error.message);
  process.exit(1);
});
