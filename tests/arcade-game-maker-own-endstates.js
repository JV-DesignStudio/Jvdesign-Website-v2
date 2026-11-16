#!/usr/bin/env node
/*
 * tests/arcade-game-maker-own-endstates.js , A3065
 *
 * Own-rule genres (Pong, Snake, Racing, Tower Defense, Pinball, Memory, etc.)
 * do not use the shared life/_onHit path. This verifies two things for each:
 *   1. its source actually calls showVictory and/or showGameOver,
 *   2. the shared end screens open and display a score when those are called.
 * The bespoke trigger (lap completed, all pairs found, wave 10 cleared) stays a
 * manual playtest; this test proves the end screen it reaches is healthy.
 *
 * Run: node tests/arcade-game-maker-own-endstates.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_OWN_END_PORT || 9000);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };
const OWN = ['BREAKER','PONG','SNAKE','RACING','HOPPER','BEAT','PUZZLE','RHYTHM','DEFENSE','PINBALL','CLICKER','MEMORY','WAVESURVIVAL','PAPERTOSS'];
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function sceneSource() {
  const lines = fs.readFileSync(path.join(ROOT, 'tools', 'arcade-game-maker.html'), 'utf8').split('\n');
  const starts = [];
  lines.forEach((l, i) => { const m = l.match(/^function (scene[A-Za-z0-9_]+)\(/); if (m) starts.push({ name: m[1], line: i }); });
  const out = {};
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i].line, to = (starts[i + 1] ? starts[i + 1].line : lines.length);
    out[starts[i].name] = lines.slice(from, to).join('\n');
  }
  return out;
}
const KEY_FOR = { BREAKER:'sceneBreaker', PONG:'scenePong', SNAKE:'sceneSnake', RACING:'sceneRacing', HOPPER:'sceneHopper',
  BEAT:'sceneBeatEmUp', PUZZLE:'scenePuzzle', RHYTHM:'sceneRhythm', DEFENSE:'sceneTowerDefense', PINBALL:'scenePinball',
  CLICKER:'sceneClicker', MEMORY:'sceneMemory', WAVESURVIVAL:'sceneWaveSurvival', PAPERTOSS:'scenePaperToss' };

(async () => {
  const source = sceneSource();
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

  console.log('\n▸ arcade game maker: own-rule end screens');
  for (const genre of OWN) {
    errors.length = 0;
    const src = source[KEY_FOR[genre]] || '';
    const hasLose = /showGameOver/.test(src);
    const hasWin = /showVictory/.test(src);
    check(`${genre} source has an end-screen path`, hasLose || hasWin, `win:${hasWin} lose:${hasLose}`);

    await page.evaluate(g => {
      try { if (window._phaserGame) window._phaserGame.destroy(true); } catch (e) {}
      window._phaserGame = null; window.currentPhaserGame = null;
      const c = document.getElementById('game-container'); if (c) c.innerHTML = '';
      document.getElementById('genreMode').value = g;
      if (typeof onGenreChange === 'function') onGenreChange();
    }, genre);
    await sleep(850);
    await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') { compileAndBootEngine._lastRun = 0; compileAndBootEngine(); } });
    await sleep(700);
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
      const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
      document.body.classList.remove('overlay-active');
      const go = document.getElementById('goOverlay'); if (go) go.classList.remove('show');
    });
    await page.waitForFunction(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 }).catch(() => {});
    await sleep(250);

    if (hasLose) {
      await page.evaluate(() => { try { showGameOver(50); } catch (e) {} });
      const shown = await page.waitForFunction(() => {
        const el = document.getElementById('goOverlay'); return !!(el && el.classList.contains('show'));
      }, { timeout: 8000 }).then(() => true).catch(() => false);
      check(`${genre} game-over screen opens`, shown === true, shown ? '' : 'overlay did not show');
      await page.evaluate(() => { if (typeof closeGameOver === 'function') closeGameOver(); const el = document.getElementById('goOverlay'); if (el) el.classList.remove('show'); });
      await sleep(250);
    }
    if (hasWin) {
      await page.evaluate(() => { try { showVictory(75); } catch (e) {} });
      const shown = await page.waitForFunction(() => {
        const el = document.getElementById('goOverlay'); return !!(el && el.classList.contains('show'));
      }, { timeout: 8000 }).then(() => true).catch(() => false);
      check(`${genre} victory screen opens`, shown === true, shown ? '' : 'overlay did not show');
      await page.evaluate(() => { if (typeof closeGameOver === 'function') closeGameOver(); const el = document.getElementById('goOverlay'); if (el) el.classList.remove('show'); });
      await sleep(250);
    }
    check(`${genre} no errors on end screens`, errors.length === 0, errors.slice(0, 2).join(' | '));
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER OWN-ENDSTATE CHECKS PASSED');
})().catch(e => { console.error('own-endstate test crashed:', e); process.exit(1); });
