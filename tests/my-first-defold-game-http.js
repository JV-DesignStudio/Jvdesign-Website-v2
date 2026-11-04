#!/usr/bin/env node
// tests/my-first-defold-game-http.js (A1883)
// Checks the Defold series start page has a setup panel before Episode 1 with
// install, starter project, preview, test-project and cheat-sheet links. Runs
// at 390px and 1440px.
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
  '.ico': 'image/x-icon', '.zip': 'application/zip'
};

(async () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'downloads/defold-starter-project.zip')), 'starter zip exists');

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

      const response = await page.goto(base + '/workshops/my-first-defold-game.html', { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate(() => {
        const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const setup = document.querySelector('.ws-setup');
        const links = setup ? [...setup.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          download: a.hasAttribute('download'),
          target: a.getAttribute('target')
        })) : [];
        const episodes = document.querySelector('.episodes');
        return {
          setup: !!setup,
          setupBeforeEpisodes: !!(setup && episodes && (setup.compareDocumentPosition(episodes) & Node.DOCUMENT_POSITION_FOLLOWING)),
          heading: text(setup && setup.querySelector('h2')),
          steps: setup ? setup.querySelectorAll('.ws-setup-steps li').length : 0,
          body: text(setup),
          links,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });

      assert.ok(info.setup, width + 'px setup panel');
      assert.ok(info.setupBeforeEpisodes, width + 'px setup panel before episodes');
      assert.equal(info.heading, 'Set up Defold before Episode 1', width + 'px setup heading');
      assert.ok(info.steps >= 5, width + 'px setup steps');
      assert.ok(/defold\.com\/download/.test(JSON.stringify(info.links)), width + 'px install link');
      assert.ok(/\/downloads\/defold-starter-project\.zip/.test(JSON.stringify(info.links)), width + 'px starter link');
      assert.ok(/\/tools\/defold-cheatsheet\.html/.test(JSON.stringify(info.links)), width + 'px cheat sheet link');
      assert.ok(info.links.some((l) => l.href === '/downloads/defold-starter-project.zip' && l.download), width + 'px starter downloads');
      assert.ok(/F5|Build and Launch/.test(info.body), width + 'px preview instructions');
      assert.ok(/Game initialized/.test(info.body), width + 'px tiny test instructions');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS my-first-defold-game-http: 390/1440, setup panel before Episode 1, starter zip, cheat sheet, preview and test steps, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL my-first-defold-game-http: ' + error.message);
  process.exit(1);
});
