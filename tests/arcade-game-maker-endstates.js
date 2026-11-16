#!/usr/bin/env node
/*
 * tests/arcade-game-maker-endstates.js , A3065
 *
 * Losing should be reachable. For every genre that runs the shared base scene
 * (it has _onHit and an actor), force the last hit and require the game-over
 * overlay. Genres with their own lose rules are reported as genre-specific.
 *
 * Run: node tests/arcade-game-maker-endstates.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_ENDSTATE_PORT || 8997);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#runGameBtn', { timeout: 20000 });
  const genres = await page.$$eval('#genreMode option', opts => opts.map(o => o.value).filter(Boolean));

  console.log('\n▸ arcade game maker: lose every base-scene genre');
  const results = {};
  const FORCE = ['SHOOTER','PLATFORMER','DODGE','RUNNER','FLAPPY','INVADERS','ASTEROIDS','ROGUELIKE','CUSTOM'];
  for (const genre of genres) {
    errors.length = 0;
    await page.evaluate(g => {
      try { if (window._phaserGame) window._phaserGame.destroy(true); } catch (e) {}
      window._phaserGame = null; window.currentPhaserGame = null;
      const c = document.getElementById('game-container'); if (c) c.innerHTML = '';
      const ov = document.getElementById('goOverlay'); if (ov) ov.classList.remove('show');
      document.getElementById('genreMode').value = g;
      if (typeof onGenreChange === 'function') onGenreChange();
    }, genre);
    await sleep(850);
    await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') compileAndBootEngine(); });
    await sleep(750);
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
      const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
      document.body.classList.remove('overlay-active');
    });
    await page.waitForFunction(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 }).catch(() => {});
    await sleep(350);

    const hasOnHit = await page.evaluate(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && typeof sc._onHit === 'function' && sc.actor);
    });
    if (!FORCE.includes(genre) || !hasOnHit) { results[genre] = 'genre-specific'; console.log(`  - ${genre}: own lose rule`); continue; }

    await page.evaluate(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      try {
        liveConfig.rewindEnabled = false;
        gameState.lives = 1;
        sc._invincible = false;
        sc._puShield = false;
        sc._dead = false;
        sc._onHit(sc.actor);
      } catch (e) {}
    });
    const shown = await page.waitForFunction(() => {
      const ov = document.getElementById('goOverlay');
      return !!(ov && ov.classList.contains('show'));
    }, { timeout: 6000 }).then(() => true).catch(() => false);
    results[genre] = shown ? true : false;
    check(genre + ' reaches game over from the last hit', shown === true, shown ? '' : 'overlay did not show');
    if (errors.length) check(genre + ' no errors on the lose path', false, errors.slice(0, 1).join(''));
  }

  await browser.close();
  server.close();
  const tested = Object.values(results).filter(v => v === true).length;
  const skipped = Object.values(results).filter(v => v === 'genre-specific').length;
  console.log(`\n${tested} genres reached game over, ${skipped} use their own lose rule.`);
  console.log('\nRESULT_JSON ' + JSON.stringify(results));
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER END-STATE CHECKS PASSED');
})().catch(e => { console.error('end-state test crashed:', e); process.exit(1); });
