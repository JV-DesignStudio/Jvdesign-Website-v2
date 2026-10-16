#!/usr/bin/env node
/*
 * tests/arcade-level-handoff.js
 * A1586: a level painted in World Builder (level-designer) must arrive in the
 * Arcade Game Maker playable, keeping coins, enemies, the player spawn and the
 * goal flag, not just collision geometry.
 * Run: node tests/arcade-level-handoff.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.ALH_PORT || 8995;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // ── 1. Paint the starter level in World Builder and send it ────────────────
  const ld = await browser.newPage();
  await ld.setViewport({ width: 1440, height: 900 });
  await ld.goto(BASE + 'tools/level-designer.html', { waitUntil: 'domcontentloaded' });
  // Wait until the app is initialised (the start overlay is shown), then pick the
  // "First platformer" template the way a learner would.
  await ld.waitForSelector('#start-overlay.show', { timeout: 15000 });
  await ld.$eval('#start-overlay [data-on="applyTemplate"][data-on-arg="starter"]', el => el.click());
  await new Promise(r => setTimeout(r, 300));
  const payload = await ld.evaluate(() => {
    sendToGameMaker();
    return JSON.parse(localStorage.getItem('jvds_level_autosave') || '{}');
  });
  const ent = payload.entities || {};
  check('handoff payload includes a collision map', Array.isArray((payload.layers||[])[0] && payload.layers[0].data) && payload.layers[0].data.some(v => v > 0));
  check('handoff keeps coins', (ent.coins || []).length >= 3, 'coins=' + (ent.coins || []).length);
  check('handoff keeps enemies', (ent.enemies || []).length >= 1, 'enemies=' + (ent.enemies || []).length);
  check('handoff keeps the player spawn', Array.isArray(ent.spawn), 'spawn=' + JSON.stringify(ent.spawn));
  check('handoff keeps the goal flag', Array.isArray(ent.goal), 'goal=' + JSON.stringify(ent.goal));

  // ── 2. Import in the Arcade Game Maker and boot a platformer ───────────────
  const arc = await browser.newPage();
  const errs = [];
  arc.on('pageerror', e => errs.push(e.message));
  await arc.setViewport({ width: 1440, height: 900 });
  await arc.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded' });
  await arc.waitForSelector('#runGameBtn', { timeout: 20000 });
  const applied = await arc.evaluate(() => {
    const g = document.getElementById('genreMode'); g.value = 'PLATFORMER'; if (typeof onGenreChange === 'function') onGenreChange();
    importLevelFromDesigner();
    const map = (typeof customLevelMap !== 'undefined') ? customLevelMap : null;
    const e = (typeof customLevelEntities !== 'undefined') ? customLevelEntities : null;
    return {
      mapLen: (map || []).length,
      coins: e ? (e.coins || []).length : -1,
      enemies: e ? (e.enemies || []).length : -1,
      spawn: e ? !!e.spawn : false,
      goal: e ? !!e.goal : false
    };
  });
  check('arcade receives the collision map', applied.mapLen === 300, 'len=' + applied.mapLen);
  check('arcade receives coins', applied.coins >= 3, 'coins=' + applied.coins);
  check('arcade receives enemies', applied.enemies >= 1, 'enemies=' + applied.enemies);
  check('arcade receives the spawn', applied.spawn === true);
  check('arcade receives the goal', applied.goal === true);

  await arc.evaluate(() => {
    if (typeof compileAndBootEngine === 'function') compileAndBootEngine();
  });
  await new Promise(r => setTimeout(r, 900));
  await arc.evaluate(() => {
    const ov = document.getElementById('introOverlay');
    if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
  });
  await new Promise(r => setTimeout(r, 1200));
  const scene = await arc.evaluate(() => {
    const gm = window._phaserGame;
    const s = gm && gm.scene && gm.scene.scenes ? gm.scene.scenes[0] : null;
    return {
      canvas: !!document.querySelector('#game-container canvas'),
      coins: s && s._coinGrp ? s._coinGrp.getLength() : -1,
      hazards: s && s.hazards ? s.hazards.getLength() : -1,
      goal: !!(s && s._tmGoal),
      spawnFromFlag: !!(s && s._tmSpawnX)
    };
  });
  check('imported level boots a canvas', scene.canvas === true);
  check('imported coins are placed', scene.coins >= 3, 'coins=' + scene.coins);
  check('imported enemies are placed', scene.hazards >= 1, 'hazards=' + scene.hazards);
  check('imported goal is placed', scene.goal === true);
  check('no uncaught JS errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // ── 3. The same round trip at 390px ───────────────────────────────────────
  await arc.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mobile = await arc.evaluate(() => {
    importLevelFromDesigner();
    const e = (typeof customLevelEntities !== 'undefined') ? customLevelEntities : null;
    return {
      coins: e ? (e.coins || []).length : -1,
      goal: e ? !!e.goal : false,
      noScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    };
  });
  check('390px: entities still arrive', mobile.coins >= 3 && mobile.goal === true, JSON.stringify(mobile));
  check('390px: no horizontal scroll', mobile.noScroll === true);

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE LEVEL HANDOFF CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
