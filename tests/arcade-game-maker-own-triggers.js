#!/usr/bin/env node
/*
 * tests/arcade-game-maker-own-triggers.js , A3065
 *
 * Own-rule genres do not use the shared _onHit path. This drives their real
 * win/lose conditions (last brick, final set, last lap, KO round, solved crates,
 * final wave, drain, miss limit) and requires the correct end screen.
 * Genres whose state is private in a closure (Clicker, Memory) stay manual and
 * are not asserted here.
 *
 * Run: node tests/arcade-game-maker-own-triggers.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_OWN_TRIG_PORT || 9002);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SCENE_KEYS = { WAVESURVIVAL:'WaveSurvivalScene', BREAKER:'BreakerScene', PONG:'PongScene', SNAKE:'SnakeScene', RACING:'RacingScene', HOPPER:'HopperScene', BEAT:'BeatScene', PUZZLE:'PuzzleScene', RHYTHM:'RhythmScene', DEFENSE:'TDScene', PINBALL:'PinballScene', PAPERTOSS:'PaperTossScene', CLICKER:'ClickerScene', MEMORY:'MemoryScene' };

const TRIGGERS = {
  BREAKER: {
    lose: () => { const sc = window._phaserGame.scene.getScene('BreakerScene'); gameState.lives = 1; sc._invincible = false; sc._ballLost(); },
    win: () => {
      const sc = window._phaserGame.scene.getScene('BreakerScene');
      sc.wave = 5; sc._invincible = false;
      const bricks = sc.bricks.getChildren().filter(b => b && b.active);
      bricks.slice(1).forEach(b => b.destroy());
      const last = bricks[0];
      if (last) { last.setData('hp', 1); sc.ball.setPosition(last.x, last.y); sc.ball.setVelocity(0, 0); }
    },
  },
  PONG: {
    lose: () => { const sc = window._phaserGame.scene.getScene('PongScene'); sc._aSets = 1; sc._pSets = 0; sc.aScore = 4; sc._gameEnded = false; sc.ball.x = -20; sc.ball.y = (typeof GH === 'number' ? GH : 400) / 2; },
    win: () => { const sc = window._phaserGame.scene.getScene('PongScene'); sc._pSets = 1; sc._aSets = 0; sc.pScore = 4; sc._gameEnded = false; sc.ball.x = (typeof GW === 'number' ? GW : 640) + 20; sc.ball.y = (typeof GH === 'number' ? GH : 400) / 2; },
  },
  SNAKE: {
    lose: () => { const sc = window._phaserGame.scene.getScene('SnakeScene'); gameState.lives = 1; sc._invincible = false; sc._die(); },
  },
  RACING: {
    win: () => { const sc = window._phaserGame.scene.getScene('RacingScene'); sc._lap = sc._totalLaps - 1; sc._raceStarted = true; sc._raceFinished = false; sc._lapStartTime = performance.now() - 1000; sc._bestLap = 99999; sc._completeLap(performance.now()); },
  },
  HOPPER: {
    lose: () => { const sc = window._phaserGame.scene.getScene('HopperScene'); sc._lives = 1; sc._invincible = false; sc._hitPlayer(); },
  },
  BEAT: {
    lose: () => { const sc = window._phaserGame.scene.getScene('BeatScene'); sc._p1.hp = 0; sc._p2.hp = 10; sc._p1Wins = 0; sc._p2Wins = 2; sc._roundOver = false; sc._checkRound(); },
    win: () => { const sc = window._phaserGame.scene.getScene('BeatScene'); sc._p1.hp = 10; sc._p2.hp = 0; sc._p1Wins = 2; sc._p2Wins = 0; sc._roundOver = false; sc._checkRound(); },
  },
  PUZZLE: {
    win: () => { const sc = window._phaserGame.scene.getScene('PuzzleScene'); sc._map = sc._map.map(v => v === 3 ? 4 : v); sc._px = 1; sc._py = 1; sc._tryMove(1, 0); },
  },
  RHYTHM: {
    win: () => { const sc = window._phaserGame.scene.getScene('RhythmScene'); sc.score = (liveConfig.rhythmWinScore || 2000) + 10; },
    lose: async () => {
      const sc = window._phaserGame.scene.getScene('RhythmScene');
      await new Promise(r => setTimeout(r, 2600));
      sc._miss = Math.max(1, (liveConfig.rhythmMisses || 25) - 1);
      const key = (sc._noteTex && sc._noteTex[0]) || 'block';
      const n = sc.notes.create(100, (typeof GH === 'number' ? GH : 400) + 50, key);
      if (n) n.setData('lane', 0);
    },
  },
  DEFENSE: {
    win: () => {
      const sc = window._phaserGame.scene.getScene('TDScene');
      sc._wave = (liveConfig.tdWinWave || 10);
      sc._waveActive = true;
      (sc._enemies || []).forEach(e => { if (e && e.sprite) e.sprite.destroy(); });
      sc._enemies = [];
    },
    lose: () => {
      const sc = window._phaserGame.scene.getScene('TDScene');
      sc._lives = 1;
      if (typeof sc._spawnEnemy === 'function') sc._spawnEnemy();
      const e = sc._enemies && sc._enemies[sc._enemies.length - 1];
      if (e) e.pathIdx = sc._pathPts.length - 1;
    },
  },
  PAPERTOSS: {
    lose: () => {
      const sc = window._phaserGame.scene.getScene('PaperTossScene');
      sc._misses = Math.max(0, (sc._maxMisses || 3) - 1);
      sc._throwBall(0, 1, 200);
    },
    win: () => {
      const sc = window._phaserGame.scene.getScene('PaperTossScene');
      sc.score = (liveConfig.winTarget || 500) + 10;
      sc._tickBase(sc.score);
    },
  },
  WAVESURVIVAL: {
    lose: () => {
      const sc = window._phaserGame.scene.getScene('WaveSurvivalScene');
      const st = sc._wsState;
      st.setHp(1);
      sc._wsSpawnWave(1);
      const es = sc._wsEnemies();
      if (es) es.forEach(e => { e.y = (typeof GH === 'number' ? GH : 400) + 60; });
    },
    win: () => {
      const sc = window._phaserGame.scene.getScene('WaveSurvivalScene');
      const st = sc._wsState;
      liveConfig.wsSurviveWaves = 1;
      st.setWave(1);
      st.setWaveClear(false);
      st.setBetween(false);
      const es = sc._wsEnemies();
      if (es) es.length = 0;
    },
  },
  PINBALL: {
    lose: () => { const sc = window._phaserGame.scene.getScene('PinballScene'); sc._lives = 1; sc._drainCooldown = 0; sc.ball.y = (typeof GH === 'number' ? GH : 400) + 40; sc.ball.setVelocity(0, 0); },
  },
  CLICKER: {
    win: () => {
      const sc = window._phaserGame.scene.getScene('ClickerScene');
      if (typeof sc._testSetPoints === 'function') sc._testSetPoints(100000);
    },
  },
  MEMORY: {
    win: () => {
      const sc = window._phaserGame.scene.getScene('MemoryScene');
      const cards = sc._testCards || [];
      const groups = {};
      cards.forEach(c => { (groups[c.emoji] = groups[c.emoji] || []).push(c); });
      Object.keys(groups).forEach(emoji => {
        groups[emoji].forEach(c => { if (c.bg) c.bg.emit('pointerdown'); });
      });
    },
  },
};

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

  async function boot(genre) {
    // A fresh page per trigger prevents a delayed victory/restart callback from
    // the previous genre racing this boot.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 20000 });
    await page.waitForFunction(() => typeof compileAndBootEngine === 'function', { timeout: 20000 }).catch(() => {});
    await page.evaluate(g => {
      try { if (window._phaserGame) window._phaserGame.destroy(true); } catch (e) {}
      window._phaserGame = null; window.currentPhaserGame = null;
      const c = document.getElementById('game-container'); if (c) c.innerHTML = '';
      const ov = document.getElementById('goOverlay'); if (ov) ov.classList.remove('show');
      document.getElementById('genreMode').value = g;
      if (typeof onGenreChange === 'function') onGenreChange();
    }, genre);
    await sleep(850);
    await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') { compileAndBootEngine._lastRun = 0; compileAndBootEngine(); } });
    await sleep(750);
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
      const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
      document.body.classList.remove('overlay-active');
      const ov = document.getElementById('goOverlay'); if (ov) ov.classList.remove('show');
    });
    await page.waitForFunction(key => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScene && g.scene.getScene(key);
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 }, SCENE_KEYS[genre]).catch(() => {});
    if (genre === 'BEAT') {
      await page.waitForFunction(() => {
        const g = window._phaserGame; const sc = g && g.scene && g.scene.getScene && g.scene.getScene('BeatScene');
        return !!(sc && sc._p1 && sc._p2);
      }, { timeout: 8000 }).catch(() => {});
    }
    await sleep(600);
  }

  for (const [genre, kinds] of Object.entries(TRIGGERS)) {
    for (const kind of ['lose', 'win']) {
      const fn = kinds[kind];
      if (!fn) continue;
      errors.length = 0;
      await boot(genre);
      let triggerErr = '';
      try {
        await page.evaluate(async (f) => { await (0, eval)('(' + f + ')')(); }, fn.toString());
      } catch (e) { triggerErr = e && e.message ? e.message : String(e); }
      const shown = await page.waitForFunction(() => {
        const ov = document.getElementById('goOverlay');
        return !!(ov && ov.classList.contains('show'));
      }, { timeout: 9000 }).then(() => true).catch(() => false);
      const state = await page.evaluate(() => ({
        title: (document.getElementById('goTitle') || {}).textContent || '',
        winClass: !!(document.getElementById('goOverlay') || {}).classList && document.getElementById('goOverlay').classList.contains('win')
      }));
      const isWin = /YOU WIN/i.test(state.title) || state.winClass;
      check(`${genre} ${kind} reaches ${kind === 'win' ? 'victory' : 'game over'}`,
        shown === true && !triggerErr && (kind === 'win' ? isWin : !isWin),
        JSON.stringify({ shown, triggerErr, ...state }));
      if (errors.length) check(`${genre} ${kind} no errors`, false, errors.slice(0, 1).join(''));
      await page.evaluate(() => {
        const el = document.getElementById('goOverlay'); if (el) el.classList.remove('show');
        document.body.classList.remove('overlay-active');
      });
      await sleep(600);
    }
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER OWN-TRIGGER CHECKS PASSED');
})().catch(e => { console.error('own-trigger test crashed:', e); process.exit(1); });
