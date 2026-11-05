#!/usr/bin/env node
// tests/my-first-series-http.js (A2503)
// Guards the shared "My First" shell on my-first-series: one stylesheet, the data-mf
// theme, the hero, outcome panel and .series-grid content, with no overflow or errors
// at 390px and 1440px.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'workshops/my-first-series.html';
const SLUG = 'series';
const CORE = '.series-grid';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.zip': 'application/zip'
};

(async () => {
  const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  assert.ok(html.includes('style-workshop-my-first.css'), PAGE + ' loads the shared my-first stylesheet');
  assert.ok(html.includes('data-mf="' + SLUG + '"'), PAGE + ' sets data-mf=' + SLUG);
  const noNav = html.replace(/<!-- BUILD:nav-content -->[\s\S]*?<!-- \/BUILD:nav-content -->/, '');
  const inlineSource = (noNav.match(/style="/g) || []).length;
  assert.ok(inlineSource <= 15, 'inline style attributes ' + inlineSource + ' (expected <= 15)');

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
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
        if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push(m.text());
      });

      const response = await page.goto(base + '/' + PAGE, { waitUntil: 'load', timeout: 30000 });
      assert.equal(response && response.status(), 200, width + 'px status');

      const info = await page.evaluate((slug, core) => {
        const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href') || '');
        return {
          dataMf: document.documentElement.getAttribute('data-mf'),
          accent: getComputedStyle(document.documentElement).getPropertyValue('--mf-accent').trim(),
          sharedCss: links.some((href) => href.includes('style-workshop-my-first.css')),
          hero: !!document.querySelector('.hero h1, .hero-title'),
          core: !!document.querySelector(core),
          outcome: !!document.querySelector('.ws-outcome'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      }, SLUG, CORE);

      assert.equal(info.dataMf, SLUG, width + 'px data-mf theme');
      assert.ok(info.accent, width + 'px --mf-accent resolves');
      assert.ok(info.sharedCss, width + 'px shared my-first stylesheet');
      assert.ok(info.hero, width + 'px hero heading');
      assert.ok(info.core, width + 'px ' + CORE + ' content');
      assert.ok(info.outcome, width + 'px outcome panel');
      assert.ok(info.overflow <= 2, width + 'px horizontal overflow ' + info.overflow);
      assert.deepEqual(errors, [], width + 'px console or page errors: ' + errors.slice(0, 2).join(' | '));

      await page.close();
    }
    console.log('PASS my-first-series-http: 390/1440, shared my-first stylesheet, data-mf theme, hero, outcome and .series-grid, <=15 inline styles, 0 errors, no overflow');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL my-first-series-http: ' + error.message);
  process.exit(1);
});
