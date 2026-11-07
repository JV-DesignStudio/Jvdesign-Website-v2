#!/usr/bin/env node
/*
 * tests/arcade-game-maker-fsm.js , A2686
 * The reusable ArcadeFSM class must run enter/update/exit transitions, and the
 * sandbox enemies must run on it (idle at zero speed, chase when they move).
 * Run: node tests/arcade-game-maker-fsm.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_FSM_PORT || 0);
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
  await page.setViewport({ width:1280, height:900 });

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window.ArcadeFSM === 'function' && typeof window.compileAndBootEngine === 'function', { timeout:15000 });

    const unit = await page.evaluate(() => {
      const log = [];
      const fsm = new ArcadeFSM({ hp: 1 });
      fsm.add('idle', {
        enter() { log.push('enter:idle'); },
        update(owner, dt) { log.push('update:idle:' + dt); },
        exit() { log.push('exit:idle'); }
      }).add('chase', {
        enter() { log.push('enter:chase'); },
        update(owner, dt, ctx) { log.push('update:chase:' + (ctx.speed || 0)); },
        exit() { log.push('exit:chase'); }
      });
      const started = fsm.change('idle');
      fsm.update(16, { speed:0 });
      const toChase = fsm.change('chase');
      fsm.update(16, { speed:42 });
      const noRepeat = fsm.change('chase');
      return { log, started, toChase, noRepeat, name:fsm.name, exposed: typeof window.ArcadeFSM };
    });
    check('FSM class is exposed', unit.exposed === 'function', unit.exposed);
    check('FSM enter and update fire', unit.started === true && unit.log[0] === 'enter:idle' && unit.log[1] === 'update:idle:16', JSON.stringify(unit.log));
    check('FSM exit then enter on a transition', unit.toChase === true && unit.log[2] === 'exit:idle' && unit.log[3] === 'enter:chase', JSON.stringify(unit.log));
    check('FSM ignores a same-state change', unit.noRepeat === false && unit.name === 'chase', JSON.stringify({ noRepeat:unit.noRepeat, name:unit.name }));
    check('FSM update passes state context', unit.log[4] === 'update:chase:42', JSON.stringify(unit.log));

    // Sandbox enemies run on the FSM: idle at zero speed, chase when moving.
    await page.evaluate(() => {
      Object.assign(liveConfig, {
        customCoreLoop:'platformer', customStarTarget:1, customEnemyCount:1, customEnemySpeed:0,
        customWinMode:'collect', customWinValue:0, customGoldStars:false, customFastEnemies:false,
        customRules:[], customVars:[]
      });
      customLevelEntities = null;
      document.getElementById('genreMode').value = 'CUSTOM';
      if (typeof onGenreChange === 'function') onGenreChange();
      compileAndBootEngine._lastRun = 0;
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    });
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout:20000 });
    await sleep(700);
    const idle = await page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const e = sc.enemies.getChildren()[0];
      return { has:e && !!e._fsm, name:e && e._fsm && e._fsm.name, speed:sc._enemySpeed };
    });
    check('sandbox enemy has an FSM in idle', idle.has === true && idle.name === 'idle', JSON.stringify(idle));

    const chase = await page.evaluate(async () => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const e = sc.enemies.getChildren()[0];
      sc._enemySpeed = 50;
      e.setData('speed', 50);
      await new Promise(r => setTimeout(r, 250));
      return { name:e._fsm && e._fsm.name, vx:e.body ? Math.round(e.body.velocity.x) : null };
    });
    check('sandbox enemy transitions to chase and moves', chase.name === 'chase' && chase.vx !== 0, JSON.stringify(chase));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker fsm: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
