#!/usr/bin/env node
/*
 * tests/arcade-game-maker-play-genres.js , A3060
 *
 * Boots every genre through the real UI, lets it run, feeds it input and checks
 * three things the boot-only test cannot:
 *   1. the scene keeps advancing (no frozen loop),
 *   2. every Arcade body is no bigger than the art it draws (the bug that made
 *      Flappy's pipes 5,486px tall and the Runner hit every lane),
 *   3. no page/console errors appear while playing.
 *
 * Run: node tests/arcade-game-maker-play-genres.js
 *   JVDS_SITE=<dir>            serve a different site root
 *   AGM_PLAY_GENRES_PORT=<n>   port to serve on (default 8987)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const PORT = Number(process.env.AGM_PLAY_GENRES_PORT || 8987);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.wav':'audio/wav' };

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  \u2713 ' : '  \u2717 ') + name + (detail ? ' , ' + detail : ''));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function isIgnorable(text) {
  return /ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR_|ERR_FAILED/i.test(text)
    || /googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|gstatic\.com/i.test(text);
}

const BODY_AUDIT = () => {
  const g = window._phaserGame || window.currentPhaserGame;
  const sc = g && g.scene && g.scene.getScenes(true)[0];
  if (!sc) return { err: 'no active scene' };
  const bad = [];
  const seen = new Set();
  const scan = (o) => {
    if (!o || seen.has(o)) return;
    seen.add(o);
    if (o.body && typeof o.body.width === 'number' && o.displayWidth > 2 && o.displayHeight > 2) {
      const rw = o.body.width / o.displayWidth, rh = o.body.height / o.displayHeight;
      if (rw > 1.25 || rh > 1.25) {
        bad.push({ key: o.texture && o.texture.key, dw: Math.round(o.displayWidth), dh: Math.round(o.displayHeight),
          bw: Math.round(o.body.width), bh: Math.round(o.body.height) });
      }
    }
    if (o.list) o.list.forEach(scan);
  };
  (sc.children && sc.children.list || []).forEach(scan);
  return { scene: sc.sys.settings.key, bad: bad.slice(0, 5), frame: (g.loop && g.loop.frame) || 0 };
};

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
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !isIgnorable(m.text())) pageErrors.push(m.text()); });
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });

  console.log('\n\u25b8 arcade game maker: play every genre');
  console.log('  root: ' + ROOT);
  await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 20000 });
  const genres = await page.$$eval('#genreMode option', opts => opts.map(o => o.value).filter(Boolean));
  record('genre list found (' + genres.length + ')', genres.length >= 20, genres.join(','));
  if (genres.length < 20) { await browser.close(); server.close(); process.exit(1); }

  const canvasPoint = async () => page.evaluate(() => {
    const c = document.querySelector('#game-container canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });

  for (const genre of genres) {
    pageErrors.length = 0;
    await page.evaluate(() => {
      try { if (window._phaserGame) window._phaserGame.destroy(true); } catch (e) {}
      window._phaserGame = null;
      const c = document.getElementById('game-container'); if (c) c.innerHTML = '';
    });
    await sleep(750);
    await page.evaluate(g => {
      document.getElementById('genreMode').value = g;
      if (typeof onGenreChange === 'function') onGenreChange();
    }, genre);
    await sleep(250);
    let bootErr = '';
    try {
      await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') compileAndBootEngine(); });
    } catch (e) { bootErr = 'boot: ' + (e.message || e); }
    await sleep(650);
    await page.evaluate(() => {
      const ov = document.getElementById('introOverlay');
      if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
      const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
      document.body.classList.remove('overlay-active');
    });
    let hasCanvas = false;
    try { await page.waitForSelector('#game-container canvas', { timeout: 8000 }); hasCanvas = true; } catch (e) {}
    await sleep(900);

    const before = await page.evaluate(BODY_AUDIT).catch(e => ({ err: String(e.message || e) }));
    await sleep(700);
    const after = await page.evaluate(BODY_AUDIT).catch(e => ({ err: String(e.message || e) }));

    // Feed a spread of inputs so the loop runs, not just the idle path.
    const pt = await canvasPoint();
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyW', 'ArrowDown'];
    for (const k of keys) {
      try { await page.keyboard.down(k); await sleep(70); await page.keyboard.up(k); } catch (e) {}
      await sleep(30);
    }
    if (pt) {
      for (let i = 0; i < 3; i++) { try { await page.mouse.click(pt.x, pt.y); } catch (e) {} await sleep(110); }
    }
    await sleep(500);

    const loopOk = !before.err && !after.err && before.frame >= 0 && after.frame > before.frame;
    const bodyOk = !before.err && !after.err && before.bad.length === 0 && after.bad.length === 0;
    const clean = !bootErr && pageErrors.length === 0;
    const detail = bootErr || (pageErrors[0] || '').slice(0, 150)
      || (before.err ? 'audit: ' + before.err : '')
      || (before.bad.length ? 'big body ' + JSON.stringify(before.bad[0]) : '');
    record(genre + ' boots a canvas', hasCanvas, hasCanvas ? '' : 'no canvas');
    record(genre + ' loop advances', loopOk, detail);
    record(genre + ' bodies fit the art', bodyOk, detail);
    record(genre + ' no JS errors', clean, detail);
  }

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + '\u2500'.repeat(52));
  console.log(`${results.length - failed.length}/${results.length} checks passed across ${genres.length} genres`);
  if (failed.length) {
    failed.forEach(f => console.log('  FAILED: ' + f.name + (f.detail ? ' , ' + f.detail : '')));
    process.exit(1);
  }
  console.log('\u2713 arcade game maker play-genres: every genre runs and fits its art');
})().catch(e => { console.error('play-genres crashed:', e); process.exit(1); });
