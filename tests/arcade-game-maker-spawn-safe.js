#!/usr/bin/env node
/*
 * tests/arcade-game-maker-spawn-safe.js , A2711
 * A hazard or enemy painted on the Start flag must not kill the player on spawn.
 * Checks the safe-zone helper, a Platformer tilemap with hazards on spawn and a
 * Custom Sandbox with enemies on spawn.
 * Run: node tests/arcade-game-maker-spawn-safe.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_SAFE_PORT || 0);
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

  async function boot(genre) {
    jsErrors.length = 0;
    await sleep(800);
    await page.evaluate((o) => {
      if (o.genre === 'PLATFORMER') {
        const map = Array(20 * 15).fill(0);
        // Hazards painted on and beside the Start flag (cells 4,5 / 5,5 / 6,5).
        map[5 * 20 + 4] = 2; map[5 * 20 + 5] = 2; map[5 * 20 + 6] = 2;
        map[6 * 20 + 5] = 1; // a floor tile under the spawn
        customLevelMap = map;
        customLevelEntities = { spawn:[5, 5], enemies:[[5, 5], [4, 5]], coins:[], goal:null };
      } else {
        Object.assign(liveConfig, {
          customCoreLoop:'topdown', customStarTarget:1, customEnemyCount:4, customEnemySpeed:0,
          customWinMode:'collect', customWinValue:0, customGoldStars:false, customFastEnemies:false,
          customRules:[], customVars:[]
        });
        customLevelMap = null;
        customLevelEntities = { spawn:[5, 5], enemies:[[5, 5], [4, 5], [5, 6], [9, 9]], coins:[], goal:null };
      }
      try { document.getElementById('levelDesignerGrid').value = ''; } catch (e) {}
      const g = document.getElementById('genreMode');
      g.value = o.genre;
      if (typeof onGenreChange === 'function') onGenreChange();
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, { genre });
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout:20000 });
    await sleep(1100); // let a lethal spawn hit land if the guard is missing
    return page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0] || window._phaserGame.scene.getScenes(false)[0];
      const colOf = (x) => Math.floor(x / (GW / 20));
      const rowOf = (y) => Math.floor(y / (GH / 15));
      const spawn = sc._sbPlacement && sc._sbPlacement.spawn
        ? [Math.floor(sc._sbPlacement.spawn.x / (GW / 20)), Math.floor(sc._sbPlacement.spawn.y / (GH / 15))]
        : (typeof customLevelEntities !== 'undefined' && customLevelEntities && customLevelEntities.spawn) || null;
      const safe = sc._sbPlacement ? sc._sbPlacement.safeSkipped || 0 : 0;
      const hazards = (sc.hazards && sc.hazards.getChildren) ? sc.hazards.getChildren().map(h => [colOf(h.x), rowOf(h.y)]) : [];
      const enemies = (sc.enemies && sc.enemies.getChildren) ? sc.enemies.getChildren().map(e => [colOf(e.x), rowOf(e.y)]) : [];
      return {
        key: sc.sys.settings.key,
        alive: sc.actor ? sc.actor.active !== false : true,
        spawn,
        safe,
        hazards,
        enemies
      };
    });
  }

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window.compileAndBootEngine === 'function' && typeof window._sbInSafeZone === 'function', { timeout:15000 });

    const unit = await page.evaluate(() => ({
      onSpawn: _sbInSafeZone(5, 5, [5, 5]),
      edge: _sbInSafeZone(7, 7, [5, 5]),
      outside: _sbInSafeZone(8, 5, [5, 5]),
      noSpawn: _sbInSafeZone(5, 5, null)
    }));
    check('safe zone covers 2 cells around spawn', unit.onSpawn === true && unit.edge === true && unit.outside === false && unit.noSpawn === false, JSON.stringify(unit));

    // Platformer tilemap: hazards painted on and around the Start flag.
    const platform = await boot('PLATFORMER');
    check('PLATFORMER spawn survives the first second', platform.alive === true && jsErrors.length === 0, JSON.stringify(platform) + ' ' + jsErrors.slice(0,1).join(' | '));
    const unsafeHazards = platform.hazards.filter(([c, r]) => platform.spawn && Math.abs(c - platform.spawn[0]) <= 2 && Math.abs(r - platform.spawn[1]) <= 2);
    check('PLATFORMER hazards inside the safe zone are skipped', unsafeHazards.length === 0, 'hazards=' + JSON.stringify(platform.hazards) + ' spawn=' + JSON.stringify(platform.spawn));

    // Custom Sandbox: enemies painted on the Start flag get nudged out.
    const sandbox = await boot('CUSTOM');
    const unsafeEnemies = sandbox.enemies.filter(([c, r]) => sandbox.spawn && Math.abs(c - sandbox.spawn[0]) <= 2 && Math.abs(r - sandbox.spawn[1]) <= 2);
    check('CUSTOM sandbox spawn survives the first second', sandbox.alive === true && jsErrors.length === 0, JSON.stringify(sandbox) + ' ' + jsErrors.slice(0,1).join(' | '));
    check('CUSTOM enemies inside the safe zone are nudged out', unsafeEnemies.length === 0, 'enemies=' + JSON.stringify(sandbox.enemies) + ' spawn=' + JSON.stringify(sandbox.spawn));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker spawn safe: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
