#!/usr/bin/env node
/*
 * tests/gallery-share-buttons.js
 * A2805: a saved creation in the tool gallery can be shared and reopened.
 *   - a Pixel Studio keepsake with a share link renders Share and Open buttons
 *   - Share asks before copying, then copies the exact creation link
 *   - Open opens the exact creation link
 * Run: node tests/gallery-share-buttons.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.GALLERYSHARE_PORT || 8151;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
  const SHARE = 'http://127.0.0.1:' + PORT + '/tools/pixel-studio.html#art=AbC123def456ghi789jkl012mno345pqr';

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.evaluateOnNewDocument((png, share) => {
    window.__copied = [];
    window.__opened = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: function (t) { window.__copied.push(t); return Promise.resolve(); } }
    });
    window.open = function (u) { window.__opened.push(u); return null; };
    try {
      localStorage.clear();
      localStorage.setItem('jvds_pixel_keepsake', JSON.stringify([{ id: 1, title: 'My Hero', date: '2026-11-08', thumb: png, project: '{}', share: share }]));
    } catch (e) {}
  }, PNG, SHARE);

  try {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${PORT}/tools/gallery.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('#grid article.card').length >= 1, { timeout: 15000 });

    const card = await page.evaluate(() => {
      const c = document.querySelector('#grid article.card');
      const share = c && c.querySelector('[data-share]');
      const open = c && c.querySelector('[data-open]');
      return {
        text: (c ? c.innerText : '').replace(/\s+/g, ' '),
        share: share ? share.getAttribute('data-share') : '',
        open: open ? open.getAttribute('data-open') : ''
      };
    });

    check('a keepsake with a link shows Share and Open', card.share === SHARE && card.open === SHARE, card.text);
    check('the card still shows the creation', /My Hero/.test(card.text), card.text);

    // Share: warning first, nothing copied, then confirm and copy the exact link.
    await page.evaluate(() => document.querySelector('[data-share]').click());
    await new Promise(r => setTimeout(r, 300));
    const warned = await page.evaluate(() => ({ dialog: !!document.getElementById('jvds-share-warn'), copied: window.__copied.length }));
    check('Share warns before copying a public link', warned.dialog && warned.copied === 0, JSON.stringify(warned));
    if (warned.dialog) {
      await page.evaluate(() => document.querySelector('.jvds-share-warn-go').click());
      await new Promise(r => setTimeout(r, 300));
    }
    const copied = await page.evaluate(() => window.__copied);
    check('confirming copies the exact creation link', copied.length === 1 && copied[0] === SHARE, JSON.stringify(copied));

    // Open: exact link.
    await page.evaluate(() => document.querySelector('[data-open]').click());
    await new Promise(r => setTimeout(r, 200));
    const opened = await page.evaluate(() => window.__opened);
    check('Open opens the exact creation link', opened.length === 1 && opened[0] === SHARE, JSON.stringify(opened));

    check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? 'FAILURES PRESENT (' + failures + ')' : 'ALL GALLERY SHARE BUTTON CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
