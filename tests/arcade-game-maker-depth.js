#!/usr/bin/env node
// tests/arcade-game-maker-depth.js (A2714)
// One documented render order is used by the sandbox and platformer scenes:
// background <= 0, hazard 1, collectible 2, player 10, HUD 100 and camera-fixed.
// Run: node tests/arcade-game-maker-depth.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_DEPTH_PORT || 19257;
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

  // Sandbox
  await page.evaluate(() => {
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    liveConfig.customCoreLoop = 'topdown';
    liveConfig.customStarTarget = 5;
    liveConfig.customEnemyCount = 3;
    liveConfig.customEnemySpeed = 0;
    compileAndBootEngine();
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, { timeout: 20000 });
  await sleep(700);
  const sb = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const stars = sc.stars ? sc.stars.getChildren().filter((c) => c.active) : [];
    const enemies = sc.enemies ? sc.enemies.getChildren().filter((c) => c.active) : [];
    return {
      key: sc.scene.key,
      player: sc.actor && sc.actor.depth,
      star: stars[0] && stars[0].depth,
      enemy: enemies[0] && enemies[0].depth,
      score: sc.scoreText && sc.scoreText.depth,
      sx: sc.scoreText && sc.scoreText.scrollFactorX,
      sy: sc.scoreText && sc.scoreText.scrollFactorY,
      stars: stars.length,
      enemies: enemies.length
    };
  });
  check('sandbox player sits above collectibles and hazards',
    sb.key === 'CustomScene' && sb.player === 10 && sb.star === 2 && sb.enemy === 1, JSON.stringify(sb));
  check('sandbox HUD is camera-fixed at UI depth',
    sb.score === 100 && sb.sx === 0 && sb.sy === 0, JSON.stringify({ score: sb.score, sx: sb.sx, sy: sb.sy }));

  // Platformer
  await sleep(800);
  await page.evaluate(() => {
    document.getElementById('genreMode').value = 'PLATFORMER';
    onGenreChange();
    compileAndBootEngine();
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, { timeout: 20000 });
  await sleep(900);
  const pl = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const haz = sc.hazards ? sc.hazards.getChildren().filter((c) => c.active) : [];
    const coins = sc._coinGrp ? sc._coinGrp.getChildren().filter((c) => c.active) : [];
    return {
      key: sc.scene.key,
      player: sc.actor && sc.actor.depth,
      hazard: haz[0] && haz[0].depth,
      coin: coins[0] && coins[0].depth,
      score: sc.scoreText && sc.scoreText.depth,
      sx: sc.scoreText && sc.scoreText.scrollFactorX,
      sy: sc.scoreText && sc.scoreText.scrollFactorY,
      hazards: haz.length,
      coins: coins.length
    };
  });
  check('platformer player sits above hazards and collectibles',
    pl.key === 'PlatformerScene' && pl.player === 10 &&
    (pl.hazard == null || pl.hazard === 1) && (pl.coin == null || pl.coin === 2), JSON.stringify(pl));
  check('platformer HUD is camera-fixed at UI depth',
    pl.score === 100 && pl.sx === 0 && pl.sy === 0, JSON.stringify({ score: pl.score, sx: pl.sx, sy: pl.sy }));
  check('platformer has entities to check', pl.hazards > 0 || pl.coins > 0, JSON.stringify({ hazards: pl.hazards, coins: pl.coins }));
  check('no uncaught JS errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER DEPTH CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
