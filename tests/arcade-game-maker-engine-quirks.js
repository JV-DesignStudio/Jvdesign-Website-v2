#!/usr/bin/env node
/*
 * tests/arcade-game-maker-engine-quirks.js
 * Covers four Arcade Game Maker engine fixes:
 *   A2671 clamp the Phaser delta after a background tab is throttled
 *   A2672 resume the audio context on canvas input
 *   A2674 drop input listeners when a scene shuts down
 *   A2679 colourblind-safe physics debug colours
 * Run: node tests/arcade-game-maker-engine-quirks.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_QUIRKS_PORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
  await page.setViewport({ width:1280, height:900 });

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout:15000 });
    await page.waitForFunction(() => typeof window._buildPhaserConfig === 'function', { timeout:15000 });

    // Boot one real game so Phaser, a canvas and an active scene all exist.
    await sleep(800);
    await page.evaluate(() => {
      document.getElementById('genreMode').value = 'SHOOTER';
      if (typeof onGenreChange === 'function') onGenreChange();
    });
    await sleep(300);
    await page.evaluate(() => compileAndBootEngine());
    await sleep(1200);
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    });
    await page.waitForFunction(() => !!window._phaserGame, { timeout:20000 });
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout:20000 });

    // A2671: config carries the clamp, and the live loop enforces it.
    const cfg = await page.evaluate(() => {
      const c = _buildPhaserConfig({ genre:'SHOOTER', title:'Quirks', speed:200, gravity:600, jump:450, map:null });
      return {
        maxDelta: c.maxDelta,
        panicMax: c.fps && c.fps.panicMax,
        smoothStep: c.fps && c.fps.smoothStep,
        body: c.physics.arcade.debugBodyColor,
        staticBody: c.physics.arcade.debugStaticBodyColor,
        velocity: c.physics.arcade.debugVelocityColor
      };
    });
    check('config declares maxDelta 50', cfg.maxDelta === 50, String(cfg.maxDelta));
    check('config raises panicMax to 50', cfg.panicMax === 50 && cfg.smoothStep === true, JSON.stringify({ panicMax: cfg.panicMax, smoothStep: cfg.smoothStep }));

    const delta = await page.evaluate(() => {
      const loop = window._phaserGame.loop;
      const out = loop.smoothDelta(1000);
      return { clamped: loop.__agmDeltaClamped === true, out };
    });
    check('live loop is clamped', delta.clamped === true && Number.isFinite(delta.out) && delta.out <= 50, JSON.stringify(delta));

    // A2672: a suspended audio context resumes on the next canvas input.
    const audio = await page.evaluate(() => {
      window.__resumeCalls = 0;
      const fake = { state:'suspended', resume:function(){ window.__resumeCalls++; fake.state = 'running'; return Promise.resolve(); } };
      GameAudio.getCtx = function(){ return fake; };
      const canvas = document.querySelector('#game-container canvas');
      const bound = !!(canvas && canvas.__agmAudioResumeBound);
      if (canvas) canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true }));
      return { bound, calls: window.__resumeCalls };
    });
    check('audio resume is bound to the canvas', audio.bound === true);
    check('suspended audio context resumes on pointerdown', audio.calls > 0, String(audio.calls));

    // A2679: debug colours are magenta bodies and cyan velocity.
    check('config uses magenta bodies', cfg.body === 0xFF00FF, String(cfg.body));
    check('config uses magenta static bodies', cfg.staticBody === 0xFF00FF, String(cfg.staticBody));
    check('config uses cyan velocity', cfg.velocity === 0x00FFFF, String(cfg.velocity));

    const dbg = await page.evaluate(() => {
      _togglePhysicsDebug();
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const w = sc.physics.world;
      const out = {
        drawDebug: w.drawDebug,
        body: w.defaults.bodyDebugColor,
        staticBody: w.defaults.staticBodyDebugColor,
        velocity: w.defaults.velocityDebugColor,
        graphic: !!w.debugGraphic
      };
      _togglePhysicsDebug();
      return out;
    });
    check('debug toggle draws with the new colours', dbg.drawDebug === true && dbg.graphic === true, JSON.stringify({ drawDebug: dbg.drawDebug, graphic: dbg.graphic }));
    check('debug defaults are magenta and cyan', dbg.body === 0xFF00FF && dbg.staticBody === 0xFF00FF && dbg.velocity === 0x00FFFF, JSON.stringify(dbg));

    // A2674: shutdown removes keyboard and pointer listeners.
    const listeners = await page.evaluate(async () => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const noop = function(){};
      sc.input.keyboard.on('keydown', noop);
      sc.input.on('pointerdown', noop);
      const before = { keyboard: sc.input.keyboard.eventNames().length, input: sc.input.eventNames().length };
      sc.scene.stop();
      await new Promise(r => setTimeout(r, 250));
      return { before, afterKeyboard: sc.input.keyboard.eventNames().length, afterInput: sc.input.eventNames().length };
    });
    check('listeners exist before shutdown', listeners.before.keyboard > 0, JSON.stringify(listeners.before));
    check('keyboard listeners removed on shutdown', listeners.afterKeyboard === 0, String(listeners.afterKeyboard));
    check('pointer listeners removed on shutdown', listeners.afterInput === 0, String(listeners.afterInput));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker engine quirks: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
