#!/usr/bin/env node
/*
 * tests/arcade-game-maker-first-paint.js , A2704
 * Proves the maker loads no game engine and no genre asset until the learner
 * presses Play, brands the wait as Ember, and shows a real retry (not a stuck
 * spinner) when the engine cannot be fetched.
 * Run: node tests/arcade-game-maker-first-paint.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_FIRST_PAINT_PORT || 8998;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

function serve(){
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);
}

const isPhaser = u => /phaser-arcade-physics\.min\.js/i.test(u);
const isGenreAsset = u => /\/assets\/(game-art|audio)\//i.test(u) || /\.(mp3|ogg|wav|m4a)(\?|$)/i.test(u);
const spinnerDisplay = () => getComputedStyle(document.getElementById('gameLoadingSpinner')).display;

(async () => {
  const server = serve();

  // ── 1. Count what the page fetches before and after Play ──────────────────
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
  const before = [], after = [];
  let playing = false;
  await page.setRequestInterception(true);
  page.on('request', async req => {
    (playing ? after : before).push({ url: req.url(), type: req.resourceType() });
    // Hold the engine briefly so the Ember loading state is observable.
    if (playing && isPhaser(req.url())) await new Promise(r => setTimeout(r, 700));
    req.continue();
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.compileAndBootEngine === 'function', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 800));

  const phaserBefore = before.filter(r => isPhaser(r.url)).length;
  const genreBefore = before.filter(r => isGenreAsset(r.url)).length;
  check('A2704 no Phaser request on first paint', phaserBefore === 0, phaserBefore + ' request(s)');
  check('A2704 no genre audio or atlas on first paint', genreBefore === 0, genreBefore + ' request(s)');

  const copy = await page.evaluate(() => ({
    label: (document.getElementById('gameLoadingLabel') || {}).textContent || '',
    spinner: getComputedStyle(document.getElementById('gameLoadingSpinner')).display
  }));
  check('A2704 loading state is Ember branded', /ember/i.test(copy.label), copy.label.trim());
  check('A2704 spinner is hidden before Play', copy.spinner === 'none', copy.spinner);

  // Show the title screen, then press Start (the path that loads Phaser).
  playing = true;
  await page.evaluate(() => compileAndBootEngine());
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => {
    if (typeof closeIntro === 'function') closeIntro();
    else document.getElementById('introOverlay').classList.remove('show');
  });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('gameLoadingSpinner')).display === 'flex', { timeout: 4000 }).catch(() => {});
  const spinnerDuring = await page.evaluate(() => getComputedStyle(document.getElementById('gameLoadingSpinner')).display);
  check('A2704 spinner appears while the level builds', spinnerDuring === 'flex', spinnerDuring);

  await page.waitForSelector('#game-container canvas', { timeout: 25000 });
  await new Promise(r => setTimeout(r, 1000));
  const hiddenAfter = await page.evaluate(() => getComputedStyle(document.getElementById('gameLoadingSpinner')).display);
  const phaserAfter = after.filter(r => isPhaser(r.url)).length;
  const genreAfter = after.filter(r => isGenreAsset(r.url)).length;
  check('A2704 engine loads exactly once on Play', phaserAfter === 1, phaserAfter + ' request(s)');
  check('A2704 selecting a genre fetches no extra atlas or audio', genreAfter === 0, genreAfter + ' request(s)');
  check('A2704 spinner clears when the scene is ready', hiddenAfter === 'none', hiddenAfter);
  console.log(`  [counts] first paint ${before.length} request(s), after Play ${after.length} request(s), phaser ${phaserAfter}, genre assets ${genreAfter}`);
  await page.close();

  // ── 2. A blocked engine shows a retry, not a stuck spinner ───────────────
  const blockedBrowser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const blocked = await blockedBrowser.newPage();
  await blocked.setCacheEnabled(false);
  if (blocked.setBypassServiceWorker) await blocked.setBypassServiceWorker(true);
  let blockPhaser = true;
  await blocked.setRequestInterception(true);
  blocked.on('request', req => {
    if (blockPhaser && isPhaser(req.url())) return req.abort();
    req.continue();
  });
  await blocked.setViewport({ width: 390, height: 844 });
  await blocked.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await blocked.waitForFunction(() => typeof window.compileAndBootEngine === 'function', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 800));
  await blocked.evaluate(() => compileAndBootEngine());
  await new Promise(r => setTimeout(r, 900));
  await blocked.evaluate(() => {
    if (typeof closeIntro === 'function') closeIntro();
    else document.getElementById('introOverlay').classList.remove('show');
  });
  await blocked.waitForFunction(() => {
    const o = document.getElementById('gameErrorOverlay');
    return o && getComputedStyle(o).display !== 'none';
  }, { timeout: 15000 });
  const failure = await blocked.evaluate(() => ({
    overlay: getComputedStyle(document.getElementById('gameErrorOverlay')).display,
    retry: getComputedStyle(document.getElementById('gameErrRetry')).display,
    spinner: getComputedStyle(document.getElementById('gameLoadingSpinner')).display,
    msg: document.getElementById('gameErrMsg').textContent
  }));
  check('A2704 failed engine shows the error overlay', failure.overlay !== 'none', failure.msg);
  check('A2704 failed engine offers a retry button', failure.retry !== 'none', failure.retry);
  check('A2704 failed engine does not leave a stuck spinner', failure.spinner === 'none', failure.spinner);

  await new Promise(r => setTimeout(r, 900)); // clear the 700ms re-run throttle
  blockPhaser = false;
  await blocked.evaluate(() => document.getElementById('gameErrRetry').click());
  await new Promise(r => setTimeout(r, 500));
  await blocked.evaluate(() => {
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await blocked.waitForSelector('#game-container canvas', { timeout: 25000 });
  const recovered = await blocked.evaluate(() => getComputedStyle(document.getElementById('gameErrorOverlay')).display);
  check('A2704 retry boots the game after the engine returns', recovered === 'none', recovered);

  const overflow = await blocked.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('A2704 still fits at 390px', overflow <= 1, overflow + 'px');

  await blockedBrowser.close();
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
