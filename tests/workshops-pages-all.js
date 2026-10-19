#!/usr/bin/env node
// tests/workshops-pages-all.js (A1734)
// Bulk gate for every non-canvas page in workshops/ (engine hubs, cheatsheets,
// blueprints, Blender/Unity/Unreal/Defold/GDScript series, 3D builders). The
// interactive build-alongs (workshops/*-canvas.html) have their own bulk gate
// (tests/canvas-workshops-all.js), and the quizzes are covered by
// validate-workshops.js. These pages previously leaned on validate-workshops.js
// alone, so a broken canonical, a runtime error or a mobile overflow could ship
// unnoticed. This loads every page in a real browser at 390px and 1440px and
// asserts status 200, a canonical link, no console/page errors and no
// horizontal scroll. Legacy redirect stubs (noindex + meta refresh) are checked
// statically instead, since they navigate away on load.
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const WIDTHS = process.env.WORKSHOP_WIDTHS ? process.env.WORKSHOP_WIDTHS.split(',').map(Number) : [390, 1440];

const all = fs.readdirSync(path.join(ROOT, 'workshops'))
  .filter((f) => f.endsWith('.html') && !/-canvas\.html$/.test(f))
  .sort();

const pages = [];
const fails = [];
for (const f of all) {
  const rel = 'workshops/' + f;
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const isStub = /<meta\s+http-equiv="refresh"/i.test(src) || /location\.replace\(/.test(src);
  if (isStub) {
    if (!/<link\s+rel="canonical"/i.test(src)) fails.push(rel + ' redirect stub has no canonical');
    if (!/name="robots"\s+content="[^"]*noindex/i.test(src)) fails.push(rel + ' redirect stub is not noindex');
  } else {
    pages.push(rel);
  }
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
  let loads = 0;
  try {
    for (const width of WIDTHS) {
      for (const rel of pages) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 900 });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        const where = rel + ' @' + width;
        try {
          const resp = await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 30000 });
          if (resp.status() !== 200) { fails.push(where + ' status ' + resp.status()); await page.close(); continue; }
          const info = await page.evaluate(() => {
            const canonical = document.querySelector('link[rel="canonical"]');
            return {
              canonical: canonical ? canonical.getAttribute('href') : '',
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
            };
          });
          if (!info.canonical || !info.canonical.includes(rel)) fails.push(where + ' canonical missing: ' + info.canonical);
          if (info.overflow > 2) fails.push(where + ' horizontal overflow ' + info.overflow + 'px');
          if (errors.length) fails.push(where + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
          loads++;
        } catch (e) {
          fails.push(where + ' threw: ' + e.message);
        }
        await page.close();
      }
    }
    const stubs = all.length - pages.length;
    if (fails.length) {
      console.error('FAIL workshops-pages-all: ' + fails.length + ' issue(s) across ' + all.length + ' pages (' + pages.length + ' browser + ' + stubs + ' stub) x ' + WIDTHS.join('/'));
      for (const f of fails.slice(0, 40)) console.error('  [FAIL] ' + f);
      process.exitCode = 1;
    } else {
      console.log('PASS workshops-pages-all: ' + all.length + ' workshop pages (' + pages.length + ' browser + ' + stubs + ' redirect stubs) x ' + WIDTHS.join('/') + ' clean (' + loads + ' loads, 0 console errors, 0 overflow)');
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
