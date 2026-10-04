#!/usr/bin/env node
/*
 * tests/arcade-game-maker-all-genres.js , A758
 *
 * Regression safety net for the Arcade Game Maker monolith. The maker has 22
 * genres (the #genreMode select at tools/arcade-game-maker.html), each a
 * bespoke Phaser scene, and until now only 3 were boot-tested. The modular
 * split in src/arcade-maker/ cannot be done safely without this gate, so this
 * test drives every genre through the real UI path (pick -> compile+boot ->
 * optional intro -> canvas) and fails if any genre throws or never boots.
 *
 * The genre list is read from the page's #genreMode select, so adding a genre
 * to the maker automatically gets it covered (no hardcoded roster to drift).
 *
 * Run: node tests/arcade-game-maker-all-genres.js
 *   JVDS_SITE=<dir>   serve a different site root (used to prove the test
 *                     catches a deliberately broken genre in a temp copy).
 *   AGM_MAKER_REL=<p> maker page path relative to the root (default
 *                     tools/arcade-game-maker.html).
 *   AGM_ALL_PORT=<n>  port to serve on (default 8981).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const MAKER_REL = process.env.AGM_MAKER_REL || 'tools/arcade-game-maker.html';
const PORT = Number(process.env.AGM_ALL_PORT || 8981);
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const results = [];
function record(name, ok, detail){ results.push({ name, ok, detail }); console.log((ok ? '  \u2713 ' : '  \u2717 ') + name + (detail ? ' , ' + detail : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Third-party / network noise that is not a game bug (fonts, analytics, CDN).
// A broken genre throws an uncaught pageerror, which is never filtered.
function isIgnorable(text){
  return /ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR_|ERR_FAILED/i.test(text)
    || /googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|gstatic\.com/i.test(text);
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !isIgnorable(m.text())) consoleErrors.push(m.text()); });

  console.log('\n\u25b8 arcade game maker: boot every genre');
  console.log('  root: ' + ROOT);
  await page.goto(BASE + MAKER_REL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 20000 });
  record('maker loads with Run button', true);

  const genreList = await page.$$eval('#genreMode option', opts => opts.map(o => o.value).filter(Boolean));
  record('genre list found (' + genreList.length + ')', genreList.length >= 20, genreList.join(','));
  if (genreList.length < 20) {
    await browser.close(); server.close();
    console.log('\n\u2717 not enough genres discovered , refusing to pass on an empty roster');
    process.exit(1);
  }

  async function resetGame(){
    await page.evaluate(() => {
      try { if (window.currentPhaserGame) window.currentPhaserGame.destroy(true); } catch (e) {}
      window.currentPhaserGame = null;
      try { document.getElementById('game-container').innerHTML = ''; } catch (e) {}
    });
    await sleep(700);
  }

  async function bootGenre(genre){
    pageErrors.length = 0;
    consoleErrors.length = 0;
    await page.evaluate(g => {
      const sel = document.getElementById('genreMode');
      sel.value = g;
      if (typeof onGenreChange === 'function') onGenreChange();
    }, genre);
    await sleep(250);
    let bootError = '';
    try {
      await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') compileAndBootEngine(); });
    } catch (e) { bootError = 'compile/boot threw: ' + (e && e.message ? e.message : String(e)); }
    // Dismiss the intro so the scene actually runs, if shown.
    try {
      await page.evaluate(() => {
        const el = document.getElementById('introOverlay');
        if (el && el.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else el.classList.remove('show'); }
      });
    } catch (e) {}
    let hasCanvas = false;
    try { await page.waitForSelector('#game-container canvas', { timeout: 8000, visible: false }); hasCanvas = true; } catch (e) {}
    await sleep(400);
    return { hasCanvas, bootError };
  }

  let failures = 0;
  for (const genre of genreList) {
    const { hasCanvas, bootError } = await bootGenre(genre);
    const clean = !bootError && pageErrors.length === 0 && consoleErrors.length === 0;
    record(genre + ' boots canvas', hasCanvas, hasCanvas ? '' : 'no #game-container canvas within 8s');
    record(genre + ' no JS errors', clean, (bootError || pageErrors[0] || consoleErrors[0] || '').slice(0, 160));
    if (!hasCanvas || !clean) failures++;
    await resetGame();
  }

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log(`${results.length - failed.length}/${results.length} checks passed across ${genreList.length} genres`);
  if (failed.length) { failed.forEach(f => console.log('  FAILED: ' + f.name + (f.detail ? ' , ' + f.detail : ''))); process.exit(1); }
  console.log('\u2713 arcade-game-maker all genres: every genre boots clean');
})().catch(e => { console.error('all-genres runner crashed:', e); process.exit(1); });
