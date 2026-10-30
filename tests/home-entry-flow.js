#!/usr/bin/env node
/* A2003: the homepage must offer one obvious starting point before the
   catalogue. This checks the entry flow exists, every route resolves, it sits
   above the full catalogue, and it fits 390px and 1440px without sideways
   scrolling. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const ENTRY_ROUTES = [
  '/workshops/start-here.html',
  '/browse.html',
  '/me.html',
  '/dev-tools'
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function resolveFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (clean === '' || clean.endsWith('/')) clean += 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}

(async () => {
  const server = http.createServer((req, res) => {
    const file = resolveFile(req.url || '/');
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const failures = [];
  let browser;
  try {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const entryAt = html.indexOf('class="home-entry"');
    const catalogueAt = html.indexOf('class="hub-section"');
    assert.ok(entryAt !== -1, 'index.html has no home-entry section');
    assert.ok(catalogueAt !== -1, 'index.html has no catalogue hub section');
    assert.ok(entryAt < catalogueAt, 'the entry flow sits below the full catalogue');
    assert.match(html, /<section class="home-entry" id="start-here"/, 'entry section is not anchored as #start-here');

    const cards = [...html.matchAll(/<a class="home-entry-card" href="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(cards, ENTRY_ROUTES, 'entry cards do not match the four intents: ' + cards.join(', '));
    assert.equal(new Set(cards).size, 4, 'entry cards are not four distinct routes');

    const fileFor = route => {
      const clean = route.replace(/^\//, '');
      if (fs.existsSync(path.join(root, clean))) return path.join(root, clean);
      const alias = { 'dev-tools': 'pages/dev-tools.html' }[clean];
      return alias ? path.join(root, alias) : null;
    };
    for (const route of ENTRY_ROUTES) {
      const target = fileFor(route);
      assert.ok(target && fs.existsSync(target), 'entry route does not resolve to a file: ' + route);
    }
    console.log('PASS: four entry intents, four real routes, above the catalogue');

    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 30000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
      const metrics = await page.evaluate(() => {
        const section = document.querySelector('.home-entry');
        const all = [...document.querySelectorAll('.home-entry-card')];
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          inViewport: all.filter(c => {
            const r = c.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1;
          }).length,
          total: all.length,
          beforeCatalogue: !!section && !!(section.compareDocumentPosition(document.querySelector('.hub-section')) & Node.DOCUMENT_POSITION_FOLLOWING),
          labelled: !!document.getElementById('home-entry-title') && !!document.querySelector('.home-entry[aria-labelledby="home-entry-title"]')
        };
      });
      assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, width + 'px: entry flow causes sideways scrolling (' + metrics.scrollWidth + ' > ' + metrics.innerWidth + ')');
      assert.equal(metrics.total, 4, width + 'px: expected four entry cards');
      assert.equal(metrics.inViewport, 4, width + 'px: some entry cards overflow the viewport (' + metrics.inViewport + '/4)');
      assert.equal(metrics.beforeCatalogue, true, width + 'px: entry flow is not before the catalogue');
      assert.equal(metrics.labelled, true, width + 'px: entry section is missing its accessible label');
      await page.close();
      console.log('PASS: entry flow fits ' + width + 'px with four visible cards above the catalogue');
    }
  } catch (err) {
    failures.push(err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('home entry flow test failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log('home entry flow test passed.');
})();
