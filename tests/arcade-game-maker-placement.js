#!/usr/bin/env node
/*
 * tests/arcade-game-maker-placement.js , A2178
 * Entity placement and checkpoints used to live only in CUSTOM. This gate
 * proves the shared placement model reaches the ten genres that already had
 * free enemy/pickup lists, keeps the same {coins, enemies, spawn, goal} shape
 * through save and export, and that an old saved project (no entities) still
 * loads and plays through the v1 migration path.
 *
 * Run: node tests/arcade-game-maker-placement.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_PLACEMENT_PORT || 8997;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.wav':'audio/wav' };

const PLACEMENT_GENRES = ['SHOOTER','PLATFORMER','RUNNER','DODGE','INVADERS','ASTEROIDS','ROGUELIKE','WAVESURVIVAL','BEAT','DEFENSE'];
const ENTITIES = { coins:[[2,3]], enemies:[[5,6]], spawn:[6,2], goal:[10,10] };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async()=>{
  const server = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT,p),(err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, r));

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof window.compileAndBootEngine === 'function' &&
    typeof window._sbNormaliseEntities === 'function', {timeout:20000});

  // 1. Every listed genre shows the entity tools; a genre outside the list does not.
  const ui = await page.evaluate((gens) => {
    const out = {};
    gens.concat(['BREAKER','RACING']).forEach(g => {
      document.getElementById('genreMode').value = g;
      onGenreChange();
      out[g] = {
        tools: getComputedStyle(document.getElementById('tmCustomTools')).display,
        hint: getComputedStyle(document.getElementById('tmCustomHint')).display
      };
    });
    return out;
  }, PLACEMENT_GENRES);
  PLACEMENT_GENRES.forEach(g => check(g + ' shows entity tools', ui[g].tools === 'flex' && ui[g].hint !== 'none',
    JSON.stringify(ui[g])));
  check('BREAKER stays out of placement', ui.BREAKER.tools === 'none', ui.BREAKER.tools);
  check('RACING stays out of placement', ui.RACING.tools === 'none', ui.RACING.tools);

  // 2. Painting works in every listed genre and keeps one state shape.
  const painted = await page.evaluate((gens) => {
    const out = {};
    gens.forEach(g => {
      document.getElementById('genreMode').value = g;
      onGenreChange();
      customLevelEntities = null;
      tmSetEntity('star');  _paintEntity(3 * 20 + 2);
      tmSetEntity('enemy'); _paintEntity(4 * 20 + 5);
      tmSetEntity('spawn'); _paintEntity(1 * 20 + 1);
      tmSetEntity('goal');  _paintEntity(10 * 20 + 10);
      const e = customLevelEntities || {};
      out[g] = {
        coins: (e.coins||[]).length, enemy: (e.enemies||[]).length,
        spawn: e.spawn && e.spawn.join(','), goal: e.goal && e.goal.join(','),
        saved: !!(_buildSaveData().entities && _buildSaveData().entities.coins)
      };
    });
    return out;
  }, PLACEMENT_GENRES);
  PLACEMENT_GENRES.forEach(g => {
    const p = painted[g];
    check(g + ' painting keeps the shared shape',
      p.coins === 1 && p.enemy === 1 && p.spawn === '1,1' && p.goal === '10,10' && p.saved,
      JSON.stringify(p));
  });

  // 3. Migration: a v-less project with no entities normalises to v1 and an
  // empty placement, and its genre still boots and plays.
  const migrated = await page.evaluate(() => {
    const m = _migrateProjectPayload({ title:'Old project', genre:'SHOOTER', speed:200, gravity:600, jump:450 });
    const p = _sbNormaliseEntities(m.entities);
    return { v: m.v, hasEntities: m.entities !== undefined, empty: _sbPlacementHas(p) === false,
      coins: p.coins.length, enemies: p.enemies.length, spawn: p.spawn, goal: p.goal };
  });
  check('old project migrates to schema v1', migrated.v === 1, String(migrated.v));
  check('old project has no entities to migrate', migrated.hasEntities === false);
  check('missing entities normalise to an empty placement', migrated.empty === true &&
    migrated.coins === 0 && migrated.enemies === 0 && migrated.spawn === null && migrated.goal === null,
    JSON.stringify(migrated));

  async function boot(genre, oldProject, entities) {
    pageErrors.length = 0;
    await sleep(800); // compileAndBootEngine has a 700ms re-entry guard
    await page.evaluate((o) => {
      if (o.old) {
        _applyLoadData({ title:'Old ' + o.genre, genre:o.genre, speed:200, gravity:600, jump:450 }, { skipBoot: true });
      } else {
        customLevelEntities = o.entities;
        document.getElementById('genreMode').value = o.genre;
        onGenreChange();
      }
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, { genre, old: !!oldProject, entities: entities || null });
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout: 20000 });
    await sleep(700);
    return page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      return {
        key: sc.sys.settings.key,
        enemies: sc._sbPlacedEnemies ? sc._sbPlacedEnemies.countActive(true) : 0,
        pickups: sc._sbPlacedPickups ? sc._sbPlacedPickups.countActive(true) : 0,
        x: sc.actor ? Math.round(sc.actor.x) : null,
        y: sc.actor ? Math.round(sc.actor.y) : null,
        spawn: sc._sbPlacement && sc._sbPlacement.spawn ? sc._sbPlacement.spawn : null,
        gw: GW, gh: GH,
        alive: !!(sc.sys && sc.sys.isActive && sc.sys.isActive())
      };
    });
  }

  for (const genre of PLACEMENT_GENRES) {
    // 3a. Old project (no entities) must load and play.
    const old = await boot(genre, true);
    check(genre + ' old project boots and plays without entities',
      old.alive && old.enemies === 0 && old.pickups === 0 && pageErrors.length === 0,
      JSON.stringify(old) + ' ' + pageErrors.slice(0,1).join(' | '));

    // 3b. Same genre with placed entities seeds the shared layer.
    const placed = await boot(genre, false, ENTITIES);
    const wantX = (6 + 0.5) * placed.gw / 20;
    const wantY = (2 + 0.5) * placed.gh / 15;
    const spawnOk = !!placed.spawn && Math.abs(placed.spawn.x - wantX) <= 1 && Math.abs(placed.spawn.y - wantY) <= 1;
    check(genre + ' boots with placed enemies and pickups',
      placed.alive && placed.enemies === 1 && placed.pickups === 1 && spawnOk && pageErrors.length === 0,
      JSON.stringify(placed) + ' ' + pageErrors.slice(0,1).join(' | '));
  }

  // 4. Checkpoints save and restore across all three CUSTOM core loops.
  const loops = ['topdown', 'platformer', 'autorun'];
  for (const loop of loops) {
    await sleep(800);
    await page.evaluate((l) => {
      Object.assign(liveConfig, {
        customCoreLoop: l, customStarTarget: 3, customEnemyCount: 0, customEnemySpeed: 0,
        customWinMode: 'collect', customWinValue: 0, customGoldStars: false,
        customFastEnemies: false, customRules: [], customVars: []
      });
      customLevelEntities = null;
      gameState.lives = liveConfig.lives;
      document.getElementById('genreMode').value = 'CUSTOM';
      onGenreChange();
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, loop);
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout: 20000 });
    await sleep(800);
    const saved = await page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const s = sc.stars.getChildren().find(c => c.active);
      if (s) sc.actor.setPosition(s.x, s.y);
      return true;
    });
    await sleep(600);
    const cp = await page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      sc._sbCheckpoint();
      const d = JSON.parse(localStorage.getItem('jv_sandbox_checkpoint'));
      return { loop: sc._coreLoop, collected: d.collected, stars: d.stars.length, enemies: d.enemies.length };
    });
    await sleep(800);
    await page.evaluate((l) => {
      window.__sbResume = true;
      Object.assign(liveConfig, { customCoreLoop: l, customStarTarget: 3, customEnemyCount: 0,
        customEnemySpeed: 0, customWinMode: 'collect', customWinValue: 0,
        customGoldStars: false, customFastEnemies: false, customRules: [], customVars: [] });
      document.getElementById('genreMode').value = 'CUSTOM';
      onGenreChange();
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, loop);
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout: 20000 });
    await sleep(800);
    const resumed = await page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      return { loop: sc._coreLoop, collected: sc._collected, stars: sc.stars.countActive(true), enemies: sc.enemies.countActive(true) };
    });
    check(loop + ' checkpoint saves a live run', cp.collected >= 1 && cp.enemies === 0, JSON.stringify(cp));
    check(loop + ' continue restores the run', resumed.loop === cp.loop && resumed.collected === cp.collected &&
      resumed.enemies === 0, JSON.stringify({ saved: cp, resumed }));
  }

  check('no uncaught JS errors', pageErrors.length === 0, pageErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER PLACEMENT CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
