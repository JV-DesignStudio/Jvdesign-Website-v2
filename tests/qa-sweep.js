#!/usr/bin/env node
/* qa-sweep.js — measures weight, timing, DOM size, requests, console/page errors
   and inline-script bloat across key site pages. Ground truth for the audit. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = 'F:/Website/Jvdesign-Website-v2';
const PORT = 8979;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

const PAGES = [
  'index.html',
  'pages/games.html',
  'games/gem_match.html',
  'games/arcane_citadel_page.html',
  'games/critter-whack-page.html',
  'arcade.html',
  'pages/workshop.html',
  'workshops/scratch-catch-workshop.html',
  'workshops/my-first-video-game.html',
  'workshops/my-progress.html',
  'pages/learn-hub.html',
  'workshops/tiny-learners.html',
  'workshops/learning-lab.html',
  'workshops/learn.html',
  'pages/dev-tools.html',
  'tools/music-maker.html',
  'tools/character-designer.html',
  'pages/books.html',
  'books/Pip_and_the_night_sky.html',
  'pages/about.html',
  'pages/faq.html',
  'pages/search.html',
  'pages/devlog.html',
];

(async () => {
  let servedBytes = 0;
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      servedBytes += buf.length;
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  // Mobile emulation pass for half the pages
  console.log('page | dcl_ms | kb | domNodes | inlineKB | extJS | err | warn | failed');
  const rows = [];
  for (const rel of PAGES) {
    const mob = /gem_match|critter|arcade|tiny-learners|music-maker/.test(rel);
    const page = await browser.newPage();
    if (mob) await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
    else await page.setViewport({ width: 1366, height: 850 });

    const errors = [], warns = [], pageErrors = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 80));
      else if (m.type() === 'warning') warns.push(m.text().slice(0, 60));
    });
    page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 80)));

    servedBytes = 0;
    const t0 = Date.now();
    try {
      await page.goto(`http://localhost:${PORT}/${rel}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) { errors.push('LOAD_FAIL ' + String(e.message).slice(0, 50)); }
    const dclMs = Date.now() - t0;
    // external requests (fonts/gtag) still run; give them a beat, then sample
    await new Promise(r => setTimeout(r, 1200));

    const stats = await page.evaluate(() => ({
      dom: document.getElementsByTagName('*').length,
      inlineCss: [...document.querySelectorAll('style')].reduce((n, s) => n + s.textContent.length, 0),
      extJs: document.querySelectorAll('script[src]').length,
    })).catch(() => ({ dom: -1, inlineCss: 0, extJs: -1 }));
    rows.push({ rel, dclMs, kbLocal: Math.round(servedBytes / 1024), ...stats, errors, warns, pageErrors });

    console.log(`${rel} | ${dclMs} | ${Math.round(servedBytes / 1024)} | ${stats.dom} | ${Math.round(stats.inlineCss / 1024)} | ${stats.extJs} | ${errors.length + pageErrors.length} | ${warns.length} | 0`);
    if (errors.length || pageErrors.length) {
      [...pageErrors.slice(0, 3), ...errors.slice(0, 3)].forEach(e => console.log('    ↳ ' + e));
    }
    await page.close();
  }
  fs.writeFileSync(path.join(__dirname, 'qa-results.json'), JSON.stringify(rows, null, 2));
  await browser.close();
  server.close();
})();
