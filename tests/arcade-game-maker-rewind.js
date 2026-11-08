#!/usr/bin/env node
// tests/arcade-game-maker-rewind.js (A2710)
// Flappy and Platformer keep the last 60 frames of player state. A fatal hit
// opens Echo's rewind prompt instead of the hard game over; rewinding restores
// the player, score and lives. The liveConfig toggle turns it off again.
// Run: node tests/arcade-game-maker-rewind.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_REWIND_PORT || 19261;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.compileAndBootEngine === 'function', { timeout: 20000 });

  await page.evaluate(() => {
    document.getElementById('genreMode').value = 'PLATFORMER';
    onGenreChange();
    compileAndBootEngine();
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScene('PlatformerScene');
  }, { timeout: 20000 });
  await sleep(1000);

  const ui = await page.evaluate(() => {
    const cb = document.getElementById('a11yRewindToggle');
    return { exists: !!cb, defaultOn: liveConfig.rewindEnabled !== false };
  });
  check('rewind toggle exists and defaults on', ui.exists && ui.defaultOn, JSON.stringify(ui));

  const filled = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('PlatformerScene');
    return { frames: Array.isArray(sc._rewindBuf) ? sc._rewindBuf.length : -1 };
  });
  check('rewind buffer fills and is capped at 60 frames', filled.frames > 5 && filled.frames <= 60, JSON.stringify(filled));

  // Fatal hit -> prompt, not game over.
  const prompt = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('PlatformerScene');
    gameState.lives = 1;
    sc._onHit(sc.actor);
    return { pending: sc._rewindPending };
  });
  await sleep(250);
  const shown = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('PlatformerScene');
    const ov = document.getElementById('rewindOverlay');
    return {
      pending: sc._rewindPending,
      overlay: !!(ov && ov.classList.contains('show')),
      go: document.getElementById('goOverlay').classList.contains('show'),
      snap: sc._rewindBuf && sc._rewindBuf[0] ? { x: sc._rewindBuf[0].x, y: sc._rewindBuf[0].y, score: sc._rewindBuf[0].score, lives: sc._rewindBuf[0].lives } : null
    };
  });
  check('fatal hit opens the rewind prompt instead of game over',
    shown.pending === true && shown.overlay === true && shown.go === false && !!shown.snap,
    JSON.stringify(shown));

  // Rewind restores the player, score and lives.
  const restored = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('PlatformerScene');
    const snap = sc._rewindBuf[0];
    sc.actor.body.reset(10, 10);
    _arcRewindNow();
    return {
      x: Math.round(sc.actor.x * 10) / 10,
      y: Math.round(sc.actor.y * 10) / 10,
      snapX: Math.round(snap.x * 10) / 10,
      snapY: Math.round(snap.y * 10) / 10,
      score: sc.score,
      snapScore: snap.score,
      lives: gameState.lives,
      pending: sc._rewindPending,
      overlay: document.getElementById('rewindOverlay').classList.contains('show')
    };
  });
  check('rewind restores the player position',
    restored.x === restored.snapX && restored.y === restored.snapY, JSON.stringify(restored));
  check('rewind restores score and lives and closes the prompt',
    restored.score === restored.snapScore && restored.lives >= 1 && restored.pending === false && restored.overlay === false,
    JSON.stringify(restored));

  // Toggle off -> the normal game over comes back.
  await sleep(800);
  const off = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('PlatformerScene');
    liveConfig.rewindEnabled = false;
    gameState.lives = 1;
    sc._onHit(sc.actor);
    return { pending: sc._rewindPending };
  });
  await sleep(400);
  const offShown = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('PlatformerScene');
    liveConfig.rewindEnabled = true;
    return {
      pending: sc._rewindPending,
      go: document.getElementById('goOverlay').classList.contains('show'),
      rewind: document.getElementById('rewindOverlay').classList.contains('show')
    };
  });
  check('toggle off returns the normal game over',
    off.pending === false && offShown.pending === false && offShown.go === true && offShown.rewind === false,
    JSON.stringify(offShown));

  check('no uncaught JS errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER REWIND CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
