#!/usr/bin/env node
/* A1616: the 11 retired 3D builder pages are redirect stubs for the shell.

   Every old /workshops/<id>-builder.html URL must:
     - stay on disk as a noindex redirect (so old links, search results and
       bookmarks keep working),
     - point at /workshops/3d-builder.html?preset=<id>,
     - actually land on the shell with that preset mounted and selected,
       at phone and desktop widths,
     - keep the clean-URL route in 404.html and the production _redirects
       line in sync.

   Run: node tests/3d-builder-redirects.js
*/
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const SHELL = '/workshops/3d-builder.html';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const builders = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', '3d-builders.json'), 'utf8')).builders || [];
const presets = builders.map((b) => b.id.replace(/-builder$/, ''));
assert.equal(presets.length, 11, 'content/3d-builders.json lists 11 builders');

const routes = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');

for (const id of presets) {
  const rel = 'workshops/' + id + '-builder.html';
  const file = path.join(ROOT, rel);
  assert.ok(fs.existsSync(file), rel + ' still exists');

  const html = fs.readFileSync(file, 'utf8');
  const target = '3d-builder.html?preset=' + id;
  const canonical = 'https://jvdesignstudio.co.uk/workshops/3d-builder.html?preset=' + id;
  assert.match(html, /<meta name="robots" content="noindex, follow">/, rel + ' is noindex, follow');
  assert.ok(html.includes('<link rel="canonical" href="' + canonical + '">'), rel + ' canonical points at the preset');
  assert.ok(html.includes('<meta http-equiv="refresh" content="0; url=' + target + '">'), rel + ' meta-refresh points at the preset');
  assert.ok(html.includes('location.replace("' + target + '"'), rel + ' script redirect points at the preset');

  assert.ok(routes.includes("'/workshops/" + id + "-builder':         '/workshops/3d-builder.html?preset=" + id + "'"), rel + ' has a 404 clean-URL route');
  assert.ok(new RegExp('^/workshops/' + id + '-builder\\.html /workshops/3d-builder\\.html\\?preset=' + id + ' 301$', 'm').test(redirects), rel + ' has a production _redirects line');
}

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

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      for (const id of presets) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message.split('\n')[0].slice(0, 140)));
        page.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy/.test(m.text())) errors.push(m.text()); });
        await page.setViewport({ width, height: 900 });
        await page.goto(base + '/workshops/' + id + '-builder.html', { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction((pid) => {
          const u = new URL(location.href);
          return u.pathname === '/workshops/3d-builder.html' && u.searchParams.get('preset') === pid &&
            typeof window._builderGetState === 'function' && !!document.querySelector('#bsHost .bs-stage');
        }, { timeout: 20000 }, id);
        const st = await page.evaluate((pid) => ({
          path: location.pathname,
          preset: new URL(location.href).searchParams.get('preset'),
          chip: !!Array.prototype.find.call(document.querySelectorAll('#bsChips .bs-chip'), (b) => b.dataset.id === pid && b.classList.contains('on')),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          state: typeof window._builderGetState
        }), id);
        assert.equal(st.path, SHELL, width + ': ' + id + ' lands on the shell');
        assert.equal(st.preset, id, width + ': ' + id + ' keeps its preset');
        assert.ok(st.chip, width + ': ' + id + ' selects its preset chip');
        assert.equal(st.state, 'function', width + ': ' + id + ' mounts a live module');
        assert.ok(st.overflow <= 2, width + ': ' + id + ' has no horizontal overflow (' + st.overflow + ')');
        assert.deepEqual(errors, [], width + ': ' + id + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
        console.log('PASS ' + width + ' ' + id + '-builder.html -> ?preset=' + id);
        await page.close();
      }
    }
    console.log('PASS 3d-builder-redirects: 11 stubs, 404 routes, _redirects and live preset landing at 390/1440');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
