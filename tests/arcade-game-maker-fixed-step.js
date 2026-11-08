#!/usr/bin/env node
// tests/arcade-game-maker-fixed-step.js (A2694)
// Physics runs a fixed 1/60 step, so a recorded input replay lands in the same
// place no matter what the render refresh rate is. Rendering interpolates with
// smoothStep instead of capping the display at 60.
// Run: node tests/arcade-game-maker-fixed-step.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_STEP_PORT || 19258;
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
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    liveConfig.customCoreLoop = 'topdown';
    liveConfig.customStarTarget = 1;
    liveConfig.customEnemyCount = 0;
    compileAndBootEngine();
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, { timeout: 20000 });
  await sleep(700);

  const cfg = await page.evaluate(() => {
    const g = window._phaserGame;
    const arcade = g && g.config && g.config.physics && g.config.physics.arcade;
    return {
      fps: arcade && arcade.fps,
      fixedStep: arcade && arcade.fixedStep,
      targetFps: g && g.loop && g.loop.targetFps,
      smoothStep: g && g.loop && g.loop.smoothStep
    };
  });
  check('physics is configured for a fixed 1/60 step', cfg.fps === 60 && cfg.fixedStep === true, JSON.stringify(cfg));
  check('render loop targets 60 with smoothStep interpolation', cfg.targetFps === 60 && cfg.smoothStep === true, JSON.stringify(cfg));

  // A fixed-step replay: the same start and input must land in the same place.
  const replay = await page.evaluate(() => {
    const g = window._phaserGame;
    const sc = g.scene.getScenes(true)[0];
    const w = sc.physics.world;
    sc.scene.pause();
    w.isPaused = false;
    sc.actor.body.setAllowGravity(false);
    sc.actor.body.setAcceleration(0, 0);
    sc.actor.body.setDrag(0, 0);
    const run = () => {
      w._elapsed = 0;
      sc.actor.body.reset(100, 100);
      sc.actor.body.setVelocity(60, 0);
      for (let i = 0; i < 60; i++) w.step(1 / 60);
      return {
        x: Math.round(sc.actor.body.position.x * 1000) / 1000,
        y: Math.round(sc.actor.body.position.y * 1000) / 1000
      };
    };
    const first = run();
    const second = run();
    const frameTime = w._frameTime;
    sc.scene.resume();
    return {
      first, second, frameTime,
      same: first.x === second.x && first.y === second.y,
      moved: first.x > 100
    };
  });
  check('fixed-step replay is deterministic', replay.same && replay.moved && Math.abs(replay.frameTime - 1 / 60) < 1e-9, JSON.stringify(replay));

  check('no uncaught JS errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER FIXED-STEP CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
