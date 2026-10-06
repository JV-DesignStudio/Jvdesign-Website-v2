#!/usr/bin/env node
// A672 engine contract: every arcade game that loads the engine must expose the
// versioned API, and the engine itself must satisfy boot/score/save/restart with
// no uncaught errors. Run: node tests/engine-contract.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const ENGINE_VERSION = '2.0.0';
const MAX_GAMES = 8;

const games = fs.readdirSync(GAMES_DIR)
  .filter(f => f.endsWith('.html'))
  .filter(f => fs.readFileSync(path.join(GAMES_DIR, f), 'utf8').includes('game-system.js'))
  .sort()
  .slice(0, MAX_GAMES);

const NOISE = /ServiceWorker|MIME type|Failed to load resource|net::ERR|ERR_FAILED|ERR_ABORTED|favicon/i;

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, b) => { res.writeHead(e ? 404 : 200); res.end(e ? '' : b); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  let failures = 0;
  const check = (n, c, d) => { console.log(`${c ? '✓' : '✗'} ${n}${d ? ' - ' + d : ''}`); if (!c) failures++; };

  async function open(rel) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => { const m = String(e.message || e); if (!NOISE.test(m)) errors.push(m); });
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      if (u.startsWith('http://127.0.0.1:') || u.startsWith('data:') || u === 'about:blank') r.continue();
      else r.abort();
    });
    await page.goto(base + rel, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    return { page, errors };
  }

  try {
    // 1. Boot contract + versioned API on real games.
    for (const f of games) {
      const { page, errors } = await open('/games/' + f);
      const api = await page.evaluate(() => ({
        hasEngine: !!(window.JVDSEngine && window.JVDSEngine.score && window.JVDSEngine.save),
        version: (window.JVDSEngine && window.JVDSEngine.version) || null,
        arcadeEngine: !!(window.JVDSArcade && window.JVDSArcade.engine),
        hasGameSystem: typeof window.GameSystem === 'function'
      }));
      check('boot ' + f + ': engine + score/save API present', api.hasEngine && api.arcadeEngine);
      check('boot ' + f + ': engine version ' + ENGINE_VERSION, api.version === ENGINE_VERSION, api.version || 'none');
      check('boot ' + f + ': GameSystem exposed', api.hasGameSystem);
      check('boot ' + f + ': no uncaught errors', errors.length === 0, errors[0] || '');
      await page.close();
    }

    // 2. Engine behaviour contract (score / save / restart), on a game page.
    const { page, errors } = await open('/games/' + games[0]);
    const r = await page.evaluate((ver) => {
      const id = 'engine-contract-test';
      const key = 'jvds_game_' + id;
      localStorage.removeItem(key);
      const gs = new window.GameSystem(id, 'Contract Test');
      gs.state.score = 0; gs.state.highScore = 0; gs.state.totalScore = 0;
      const a = gs.addScore(10);
      const b = gs.addScore(5);
      const lv = gs.addXP(1000);
      const coins = gs.addCoins(7);
      gs.saveState();
      const reload = new window.GameSystem(id, 'Contract Test');
      const persisted = reload.loadState();
      gs.beginRun();
      return {
        a, b, lv, coins,
        saved: persisted && persisted.score,
        high: persisted && persisted.highScore,
        total: persisted && persisted.totalScore,
        level: persisted && persisted.level,
        afterRestart: gs.state.score,
        ver: window.JVDSArcade.engine.version
      };
    }, ENGINE_VERSION);
    check('score: addScore accumulates (10,15)', r.a === 10 && r.b === 15, r.a + ',' + r.b);
    check('score: high score tracked', r.high === 15, r.high);
    check('score: totalScore accumulates', r.total === 15, r.total);
    check('progression: addXP levels up at 1000', r.lv && r.lv.levelUp === true && r.lv.level === 2, JSON.stringify(r.lv));
    check('progression: addCoins adds', r.coins === 7, r.coins);
    check('save: state persists across instances', r.saved === 15, r.saved);
    check('restart: beginRun resets the run score', r.afterRestart === 0, r.afterRestart);
    check('contract: no uncaught errors', errors.length === 0, errors[0] || '');
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n✗ engine contract: ${failures} check(s) failed` : '\n✓ engine contract: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('✗ engine contract: ' + e.message); process.exit(1); });
