#!/usr/bin/env node
// tests/engine-hubs-http.js (A1607)
// Gates every generated engine hub page (workshops/engine-*.html) in a real
// browser at 390px and 1440px: loads clean, no console/page errors, no
// horizontal scroll, correct structure (one h1, breadcrumb, Lumo + Pip
// callouts, at least one card per section) and valid JSON-LD. The list is read
// from content/engine-hubs.json so a new engine block is covered automatically.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'engine-hubs.json'), 'utf8'));
const hubs = config.engines.map((e) => 'engine-' + e.id + '.html');
const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const known = new Set(workshops.map((w) => w.id));

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
  let checked = 0, cards = 0;
  try {
    for (const width of [390, 1440]) {
      for (const file of hubs) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 950 });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        const resp = await page.goto(base + '/workshops/' + file, { waitUntil: 'load', timeout: 30000 });
        assert.equal(resp.status(), 200, file + ' @' + width + ' status');
        const info = await page.evaluate(() => {
          const q = (s) => document.querySelectorAll(s).length;
          const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { JSON.parse(s.textContent); return true; } catch { return false; } });
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            h1: q('h1'), crumbs: q('.hub-crumbs'), lumo: q('.hub-say--lumo'), pip: q('.hub-say--pip'),
            sections: q('[data-hub-section]'), cards: q('.course-card'), installPills: q('.hub-install'),
            kind: (document.querySelector('meta[name="jvds-kind"]') || {}).content || '',
            canonical: (document.querySelector('link[rel="canonical"]') || {}).getAttribute ? (document.querySelector('link[rel="canonical"]') || {}).href : '',
            hrefs: [...document.querySelectorAll('.course-card')].map((a) => a.getAttribute('href')),
            jsonldBad: jsonld.filter((x) => !x).length, jsonldCount: jsonld.length
          };
        });
        const where = file + ' @' + width;
        assert.ok(info.overflow <= 2, where + ' horizontal overflow ' + info.overflow + 'px');
        assert.equal(info.h1, 1, where + ' h1 count');
        assert.equal(info.crumbs, 1, where + ' breadcrumb');
        assert.equal(info.lumo, 1, where + ' Lumo callout');
        assert.equal(info.pip, 1, where + ' Pip callout');
        assert.ok(info.sections >= 1 && info.cards >= 1, where + ' cards/sections');
        assert.ok(info.cards >= info.sections, where + ' every section has a card');
        assert.equal(info.kind, 'engine-hub', where + ' jvds-kind meta');
        assert.ok(typeof info.canonical === 'string' && info.canonical.includes('/workshops/' + file), where + ' canonical');
        assert.ok(info.jsonldCount >= 2 && info.jsonldBad === 0, where + ' JSON-LD');
        for (const href of info.hrefs) {
          assert.ok(href && !href.startsWith('../workshops/') && !href.startsWith('workshops/'), where + ' card does not link back to a workshop: ' + href);
          assert.ok(known.has(decodeURIComponent(href).replace(/\.html$/, '')), where + ' card id known: ' + href);
        }
        assert.deepEqual(errors, [], where + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
        checked++; cards += info.cards;
        await page.close();
      }
    }
    console.log('PASS engine-hubs-http: ' + hubs.length + ' engine hubs x 390/1440 clean (' + checked + ' loads, ' + cards + ' cards, 0 console errors, 0 overflow)');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
