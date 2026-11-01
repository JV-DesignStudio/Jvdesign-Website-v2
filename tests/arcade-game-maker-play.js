#!/usr/bin/env node
/*
 * tests/arcade-game-maker-play.js
 * The end-to-end "the engine actually runs" proof: build a game in the maker,
 * export the self-contained single-file HTML, serve that exact file back, open
 * it as a player would and confirm it really plays - Phaser boots, a canvas
 * renders, the loop advances frame by frame and the scene is live.
 * Run: node tests/arcade-game-maker-play.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_PLAY_PORT || 8989;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let exportedHtml = null;
let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const server = http.createServer((req,res)=>{
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/__exported_game.html') {
      if (!exportedHtml) { res.writeHead(404); return res.end(); }
      res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
      return res.end(exportedHtml);
    }
    let file = p;
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});

  // ── 1. Build + export in the maker ──────────────────────────────────────────
  const maker = await browser.newPage();
  const makerErrors = [];
  maker.on('pageerror', e=> makerErrors.push(e.message));
  await maker.setViewport({width:1280,height:900});
  await maker.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await maker.waitForSelector('#runGameBtn', {timeout:15000});
  const built = await maker.evaluate(async ()=>{
    document.getElementById('genreMode').value = 'SHOOTER';
    if (typeof onGenreChange === 'function') onGenreChange();
    if (typeof compileAndBootEngine === 'function') compileAndBootEngine();
    await new Promise(r=>setTimeout(r,1200));
    const ov = document.getElementById('introOverlay');
    if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
    await new Promise(r=>setTimeout(r,900));
    if (typeof _buildExportHtml !== 'function') return { error: 'no _buildExportHtml' };
    const b = await _buildExportHtml();
    if (!b) return { error: 'build returned null' };
    return { html: b.html, filename: b.filename, title: b.title };
  });
  check('maker built an exportable game', !!built.html, built.error || ('title ' + built.title));
  if (!built.html) { await browser.close(); server.close(); console.log('\n1 FAILURE(S)'); process.exit(1); }
  exportedHtml = built.html;
  check('exported file inlines Phaser', /phaser/i.test(exportedHtml) && exportedHtml.length > 1000000, (exportedHtml.length/1024/1024).toFixed(2) + ' MB');

  // ── 1b. Power Picks is opt-in (off by default, on from the panel) ───────────
  const perks = await maker.evaluate(()=>{
    const t = document.getElementById('perksEnabledToggle');
    const row = document.getElementById('perkInfoRow');
    const snap = () => ({ enabled: liveConfig.perksEnabled, checked: !!(t && t.checked), rowShown: !!(row && row.style.display !== 'none') });
    const before = snap();
    if (t) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); }
    const on = snap();
    if (t) { t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); }
    return { before, on, off: snap() };
  });
  check('Power Picks defaults off', perks.before.enabled === false && perks.before.checked === false && perks.before.rowShown === false, JSON.stringify(perks.before));
  check('Power Picks enables from the panel', perks.on.enabled === true && perks.on.rowShown === true, JSON.stringify(perks.on));
  check('Power Picks can be turned back off', perks.off.enabled === false, JSON.stringify(perks.off));

  // ── 2. Play the exported file as a friend would ─────────────────────────────
  const player = await browser.newPage();
  const playerErrors = [];
  player.on('pageerror', e=> playerErrors.push(e.message));
  player.on('console', m=>{
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon|net::/.test(t)) return;
    playerErrors.push(t);
  });
  await player.setViewport({width:900,height:700});
  await player.goto(BASE+'__exported_game.html', {waitUntil:'domcontentloaded'});
  await player.waitForFunction(()=>window.__exportMode===true, {timeout:20000});
  check('exported game boots in export mode', true);

  // Start the game (title screen -> play), then let the loop run.
  await player.evaluate(()=>{
    const ov = document.getElementById('introOverlay');
    if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
  });
  await player.waitForFunction(()=>!!window._phaserGame, {timeout:20000}).catch(()=>{});
  await player.waitForSelector('#game-container canvas', {timeout:20000}).catch(()=>{});

  const snap = await player.evaluate(()=>({
    game: !!window._phaserGame,
    canvas: !!document.querySelector('#game-container canvas'),
    canvasW: (document.querySelector('#game-container canvas')||{}).width || 0,
    scenes: (window._phaserGame && window._phaserGame.scene && window._phaserGame.scene.scenes) ? window._phaserGame.scene.scenes.length : 0,
    frame: (window._phaserGame && window._phaserGame.loop) ? window._phaserGame.loop.frame : -1
  }));
  await new Promise(r=>setTimeout(r,900));
  const frame2 = await player.evaluate(()=> (window._phaserGame && window._phaserGame.loop) ? window._phaserGame.loop.frame : -1);

  check('Phaser game instance created', snap.game === true);
  check('game canvas rendered', snap.canvas === true && snap.canvasW > 0, 'width ' + snap.canvasW);
  check('a scene is present', snap.scenes >= 1, 'scenes ' + snap.scenes);
  check('game loop is advancing (engine is running)', snap.frame >= 0 && frame2 > snap.frame, 'frame ' + snap.frame + ' -> ' + frame2);
  check('no uncaught errors while playing', playerErrors.length === 0, playerErrors.slice(0,2).join(' | '));

  // ── 3. A2176 accessibility: captions, reduced motion, one-button assist ────
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // The player page was opened last, so the maker tab is throttled in the
  // background. Bring it forward or Phaser stops stepping the sandbox.
  await maker.bringToFront();
  await sleep(300);
  const a11yUi = await maker.evaluate(() => {
    const ids = ['a11yCaptionsToggle', 'a11yReducedMotionToggle', 'a11yAssistToggle'];
    const found = ids.map(id => !!document.getElementById(id));
    const set = (id, v) => { const el = document.getElementById(id); if (!el) return null; el.checked = v; el.dispatchEvent(new Event('change', { bubbles: true })); return el.checked; };
    const cap = set('a11yCaptionsToggle', true);
    const motion = set('a11yReducedMotionToggle', true);
    const assist = set('a11yAssistToggle', true);
    return { found, checked: [cap, motion, assist], live: { captions: liveConfig.a11yCaptions, motion: liveConfig.a11yReducedMotion, assist: liveConfig.a11yAssist } };
  });
  check('maker shows the three accessibility toggles', a11yUi.found.every(Boolean), JSON.stringify(a11yUi.found));
  check('accessibility toggles write into liveConfig', a11yUi.checked.every(Boolean) && a11yUi.live.captions === true && a11yUi.live.motion === true && a11yUi.live.assist === true, JSON.stringify(a11yUi.live));

  const bootSandbox = async (loop, target, opts = {}) => {
    await sleep(800); // compileAndBootEngine has a 700ms re-entry guard
    await maker.evaluate((o) => {
      Object.assign(liveConfig, {
        customCoreLoop: o.loop,
        customStarTarget: o.target,
        customEnemyCount: 0,
        customEnemySpeed: 0,
        customWinMode: 'collect',
        customWinValue: 0,
        customGoldStars: false,
        customFastEnemies: false,
        customRules: [],
        customVars: [],
        a11yCaptions: true,
        a11yReducedMotion: o.reducedMotion === true,
        a11yAssist: o.assist === true
      });
      customLevelEntities = null;
      gameState.lives = liveConfig.lives;
      document.getElementById('genreMode').value = 'CUSTOM';
      onGenreChange();
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, { loop, target, reducedMotion: opts.reducedMotion, assist: opts.assist });
    await maker.waitForFunction(() => {
      const g = window._phaserGame;
      const sc = g && g.scene && g.scene.getScene && g.scene.getScene('CustomScene');
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 });
    await sleep(800);
  };
  const probeEffects = () => maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('CustomScene');
    const before = sc.children.list.length;
    let shakes = 0;
    const orig = sc.cameras.main.shake;
    sc.cameras.main.shake = function () { shakes++; };
    const canvas = document.querySelector('#gameWrap canvas');
    if (canvas) canvas.style.filter = 'brightness(1.5)';
    _burst(100, 100, 0xff0000, 8);
    _spawnParticles(sc, 100, 100, { count: 8 });
    _zoomPulse(1.1, 100);
    _shake(8, 200);
    _chromaFlash(1);
    const res = {
      particles: sc.children.list.length - before,
      shakes,
      filter: canvas ? canvas.style.filter : '',
      reduced: _a11yReducedMotion()
    };
    sc.cameras.main.shake = orig;
    if (canvas) canvas.style.filter = '';
    return res;
  });

  await bootSandbox('topdown', 3, { reducedMotion: true });
  const rmOn = await probeEffects();
  check('reduced motion suppresses particles, shake and flash', rmOn.particles === 0 && rmOn.shakes === 0 && rmOn.filter === 'brightness(1.5)', JSON.stringify(rmOn));

  await bootSandbox('topdown', 3, { reducedMotion: false });
  const rmOff = await probeEffects();
  check('effects still run when reduced motion is off', rmOff.particles > 0 && rmOff.shakes > 0 && rmOff.filter !== 'brightness(1.5)', JSON.stringify(rmOff));

  await bootSandbox('topdown', 2, { reducedMotion: true });
  const capStart = await maker.evaluate(() => {
    const el = document.getElementById('sbCaptions');
    return { text: el ? el.textContent : '', live: el ? el.getAttribute('aria-live') : '' };
  });
  check('captions are a polite live region', capStart.live === 'polite', capStart.live);
  check('start caption names the goal', /Collect 2 stars/.test(capStart.text), capStart.text);
  await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('CustomScene');
    const s = sc.stars.getChildren().find(c => c.active);
    if (s) {
      sc.actor.setPosition(s.x, s.y);
      if (sc.actor.body && sc.actor.body.reset) sc.actor.body.reset(s.x, s.y);
    }
  });
  await sleep(600);
  const capStar = await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('CustomScene');
    return {
      text: document.getElementById('sbCaptions').textContent,
      collected: sc._collected
    };
  });
  check('collecting a star names the event in the caption', capStar.collected === 1 && /Star 1 of 2/.test(capStar.text), JSON.stringify(capStar));
  const capCheckpoint = await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('CustomScene');
    sc._sbCheckpoint();
    return document.getElementById('sbCaptions').textContent;
  });
  check('saving a checkpoint names the event', /Checkpoint saved/.test(capCheckpoint), capCheckpoint);

  await bootSandbox('platformer', 1, { assist: true, reducedMotion: true });
  await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('CustomScene');
    const t = sc._sbAssistTarget();
    if (t) t.setPosition(60, 80);
  });
  await sleep(300);
  const assistBefore = await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('CustomScene');
    return { x: sc.actor.x, starX: (sc._sbAssistTarget() || {}).x, assist: liveConfig.a11yAssist };
  });
  await maker.bringToFront();
  await maker.keyboard.down('Space');
  await sleep(1000);
  const assistHeld = await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('CustomScene');
    return { x: sc.actor.x, collected: sc._collected };
  });
  await maker.keyboard.up('Space');
  await sleep(450);
  const assistReleased = await maker.evaluate(() => window._phaserGame.scene.getScene('CustomScene').actor.x);
  await sleep(450);
  const assistStill = await maker.evaluate(() => window._phaserGame.scene.getScene('CustomScene').actor.x);
  check('assist mode is on for the running game', assistBefore.assist === true);
  check('one button moves the player toward the star', assistHeld.x < assistBefore.x - 5 || assistHeld.collected > 0, JSON.stringify({ before: assistBefore, held: assistHeld }));
  check('releasing the one button stops the player', Math.abs(assistStill - assistReleased) < 3, assistReleased + ' -> ' + assistStill);

  const exportedA11y = await maker.evaluate(async () => {
    liveConfig.a11yCaptions = true;
    liveConfig.a11yReducedMotion = true;
    liveConfig.a11yAssist = true;
    const b = await _buildExportHtml();
    return b ? b.html : null;
  });
  check('export keeps the accessibility settings', !!exportedA11y && /"a11yCaptions":true/.test(exportedA11y) && /"a11yReducedMotion":true/.test(exportedA11y) && /"a11yAssist":true/.test(exportedA11y));
  check('export keeps the caption live region', !!exportedA11y && /id="sbCaptions"[^>]*aria-live="polite"/.test(exportedA11y));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER PLAY CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
