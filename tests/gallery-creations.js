#!/usr/bin/env node
/*
 * tests/gallery-creations.js
 * A2805: the public gallery has a moderated creations lane for non-game work.
 *   - gallery-creations.json renders
 *   - each card shows the picture, author, tool and an Open link that carries #art=
 *   - the sample image loads and the lane fits 390px
 * Run: node tests/gallery-creations.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.GALLERYCREATIONS_PORT || 8153;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  try {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${PORT}/pages/gallery.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('#creationsGrid article.gl-card').length >= 1, { timeout: 15000 });

    const view = await page.evaluate(() => {
      const section = document.getElementById('creationsSection');
      const card = document.querySelector('#creationsGrid article.gl-card');
      const img = card ? card.querySelector('.gl-art img') : null;
      const open = card ? card.querySelector('a.gl-play') : null;
      return {
        shown: section ? !section.hidden : false,
        text: card ? card.innerText.replace(/\s+/g, ' ') : '',
        imgSrc: img ? img.getAttribute('src') : '',
        imgLoaded: img ? img.complete && img.naturalWidth > 0 : false,
        href: open ? open.getAttribute('href') : '',
        target: open ? open.getAttribute('target') : '',
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    check('the creations lane is shown', view.shown, '');
    check('the sample card renders', /Ember's sample sprite/.test(view.text) && /JVDS crew/.test(view.text) && /Pixel Studio/.test(view.text), view.text.slice(0, 120));
    check('the card shows the picture', /\/assets\/creations\/ember-sample\.png$/.test(view.imgSrc) && view.imgLoaded, view.imgSrc);
    check('Open carries the creation link', /#art=/.test(view.href) && view.target === '_blank', view.href.slice(0, 60));
    check('the lane fits 390px', !view.overflow, '');
    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? 'FAILURES PRESENT (' + failures + ')' : 'ALL GALLERY CREATIONS CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
