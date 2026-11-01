#!/usr/bin/env node
/*
 * tests/arcade-game-maker-loop.js , A1504
 * The shared game closes the loop: an exported single-file game carries the
 * creator's challenge score (shown on the intro) and a remix link, and its
 * Remix button opens the maker preloaded. Run:
 *   node tests/arcade-game-maker-loop.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
let BASE = '';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };

// A1615-style launch retry: browser suites can flake once under load.
async function launchBrowser(attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

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
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(process.env.AGM_LOOP_PORT ? Number(process.env.AGM_LOOP_PORT) : 0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await launchBrowser();
  const maker = await browser.newPage();
  const makerErrors = [];
  maker.on('pageerror', e => makerErrors.push(e.message));
  await maker.setViewport({width:1280,height:900});
  await maker.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await maker.waitForSelector('#runGameBtn', {timeout:15000});

  const built = await maker.evaluate(async ()=>{
    // Give the creator a best score so the export bakes a challenge.
    try { localStorage.setItem('jv_best_SHOOTER', '1234'); } catch (e) {}
    document.getElementById('genreMode').value = 'SHOOTER';
    if (typeof onGenreChange === 'function') onGenreChange();
    if (typeof compileAndBootEngine === 'function') compileAndBootEngine();
    await new Promise(r=>setTimeout(r,1200));
    const ov = document.getElementById('introOverlay');
    if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
    await new Promise(r=>setTimeout(r,900));
    const b = await _buildExportHtml();
    return b ? { html: b.html } : { error: 'build returned null' };
  });
  check('maker built an exportable game', !!built.html, built.error || '');
  if (!built.html) { await browser.close(); server.close(); console.log('\n1 FAILURE(S)'); process.exit(1); }
  exportedHtml = built.html;

  // Open the exported game as a friend would.
  const player = await browser.newPage();
  const jsErrors=[];
  player.on('pageerror', e=> jsErrors.push(e.message));
  await player.setViewport({width:900,height:700});
  await player.goto(BASE+'__exported_game.html', {waitUntil:'domcontentloaded'});
  await player.waitForFunction(()=>window.__exportMode===true, {timeout:20000});
  await new Promise(r=>setTimeout(r,1500));

  const r = await player.evaluate(async ()=>{
    const out = {
      remixUrl: window.__exportRemixUrl || '',
      sharedFrom: window._sharedFrom ? { name: window._sharedFrom.name, score: window._sharedFrom.score } : null,
      chalText: (document.getElementById('introChallenge')||{}).textContent || '',
      remixBtn: !!document.getElementById('goRemixCta'),
      fn: typeof _goRemixShared === 'function'
    };
    // Clicking Remix in an export opens the maker preloaded (stub window.open).
    let opened = null;
    const realOpen = window.open;
    window.open = function (u) { opened = u; return null; };
    try { if (typeof _goRemixShared === 'function') _goRemixShared(); } catch (e) { out.err = e.message; }
    window.open = realOpen;
    out.opened = opened;
    return out;
  });

  check('export bakes a remix link to the maker', /arcade-game-maker\.html\?remix=/.test(r.remixUrl), r.remixUrl.slice(0,70) + '…');
  check('export bakes the creator challenge', !!r.sharedFrom && r.sharedFrom.score === 1234, JSON.stringify(r.sharedFrom));
  check('intro shows the challenge to beat', /1,234/.test(r.chalText), r.chalText);
  check('game over has a Remix button', r.remixBtn === true);
  check('Remix opens the maker preloaded', !!r.opened && r.opened === r.remixUrl, (r.opened||'').slice(0,70) + '…');
  check('no uncaught errors in the exported game', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));
  await player.close();
  await maker.bringToFront();

  // ── A2174: Custom Sandbox core-loop choice ─────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const bootSandbox = async (loop, target) => {
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
        customVars: []
      });
      customLevelEntities = null;
      gameState.lives = liveConfig.lives;
      document.getElementById('genreMode').value = 'CUSTOM';
      onGenreChange();
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, { loop, target });
    await maker.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout: 20000 });
    await sleep(800);
  };
  const sandboxScene = () => maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return {
      loop: sc._coreLoop,
      gravity: sc.actor.body.allowGravity,
      y: sc.actor.y,
      x: sc.actor.x,
      vx: sc.actor.body.velocity.x,
      onGround: !!(sc.actor.body.blocked.down || sc.actor.body.touching.down),
      floor: !!sc._sbPlatforms,
      target: sc._target,
      collected: sc._collected,
      done: sc._done
    };
  });
  const collectOneStar = async () => {
    await maker.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const s = sc.stars.getChildren().find(c => c.active);
      if (s) sc.actor.setPosition(s.x, s.y);
    });
    await sleep(600);
  };

  const loopUi = await maker.evaluate(() => {
    document.getElementById('genreMode').value = 'CUSTOM';
    onGenreChange();
    const sel = document.getElementById('sbCoreLoop');
    const opts = Array.from(sel.options).map(o => o.value);
    sel.value = 'platformer';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = _buildSaveData().liveConfig.customCoreLoop;
    return { opts, saved, value: liveConfig.customCoreLoop, group: getComputedStyle(document.getElementById('customSandboxGroup')).display };
  });
  check('CUSTOM offers three core loops', loopUi.opts.join(',') === 'topdown,platformer,autorun', loopUi.opts.join(','));
  check('core-loop choice writes into liveConfig and save', loopUi.value === 'platformer' && loopUi.saved === 'platformer', loopUi.value + '/' + loopUi.saved);
  check('core-loop select sits in the sandbox panel', loopUi.group === 'flex', loopUi.group);

  await bootSandbox('topdown', 1);
  const top = await sandboxScene();
  await sleep(400);
  const topStay = await sandboxScene();
  check('top-down loop keeps the open arena', top.loop === 'topdown' && top.floor === false && topStay.y === top.y, JSON.stringify(topStay));
  await collectOneStar();
  const topWin = await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { collected: sc._collected, done: sc._done, overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('top-down loop wins by collecting every star', topWin.collected === 1 && topWin.done === true && topWin.overlay === true, JSON.stringify(topWin));

  await bootSandbox('platformer', 1);
  const platStart = await sandboxScene();
  await sleep(500);
  const platFall = await sandboxScene();
  check('platformer loop boots with gravity and a floor', platStart.loop === 'platformer' && platStart.gravity === true && platStart.floor === true, JSON.stringify(platStart));
  check('platformer loop settles the player on the floor', platFall.y > 350 && platFall.onGround === true, JSON.stringify(platFall));
  await collectOneStar();
  const platWin = await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { collected: sc._collected, done: sc._done, overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('platformer loop wins by collecting every star', platWin.collected === 1 && platWin.done === true && platWin.overlay === true, JSON.stringify(platWin));

  // Checkpoints use the same sandbox path on the jumping loops.
  await bootSandbox('platformer', 3);
  await collectOneStar();
  await maker.evaluate(() => window._phaserGame.scene.getScenes(true)[0]._sbCheckpoint());
  await bootSandbox('platformer', 3);
  const platNormal = await sandboxScene();
  check('platformer normal boot does not auto-resume', platNormal.collected === 0 && platNormal.done === false, JSON.stringify(platNormal));
  await maker.evaluate(() => { window.__sbResume = true; });
  await bootSandbox('platformer', 3);
  const platResume = await sandboxScene();
  check('platformer continue restores the checkpoint', platResume.loop === 'platformer' && platResume.collected === 1 && platResume.done === false, JSON.stringify(platResume));

  await bootSandbox('autorun', 1);
  const autoStart = await sandboxScene();
  await sleep(500);
  const autoMove = await sandboxScene();
  check('auto-run loop boots with gravity and a floor', autoStart.loop === 'autorun' && autoStart.gravity === true && autoStart.floor === true, JSON.stringify(autoStart));
  check('auto-run moves the player without input', autoMove.x > autoStart.x && autoMove.vx > 0, autoStart.x + ' -> ' + autoMove.x + ' at ' + autoMove.vx);
  await collectOneStar();
  const autoWin = await maker.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { collected: sc._collected, done: sc._done, overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('auto-run loop wins by collecting every star', autoWin.collected === 1 && autoWin.done === true && autoWin.overlay === true, JSON.stringify(autoWin));

  const built2 = await maker.evaluate(async () => {
    const b = await _buildExportHtml();
    return b ? b.html : null;
  });
  check('export keeps the chosen core loop', !!built2 && /"customCoreLoop":"autorun"/.test(built2), built2 ? 'payload found' : 'no export');
  if (built2) {
    exportedHtml = built2;
    const player2 = await browser.newPage();
    const jsErrors2 = [];
    player2.on('pageerror', e => jsErrors2.push(e.message));
    await player2.setViewport({ width: 900, height: 700 });
    await player2.goto(BASE + '__exported_game.html', { waitUntil: 'domcontentloaded' });
    await player2.bringToFront();
    await player2.waitForFunction(() => window.__exportMode === true, { timeout: 20000 });
    await sleep(1500);
    await player2.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    });
    await player2.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout: 20000 });
    const ex = await player2.evaluate(() => ({
      loop: window._phaserGame.scene.getScenes(true)[0]._coreLoop,
      genre: document.getElementById('genreMode').value,
      live: liveConfig.customCoreLoop
    }));
    check('exported sandbox boots the chosen core loop', ex.loop === 'autorun' && ex.genre === 'CUSTOM' && ex.live === 'autorun', JSON.stringify(ex));
    check('no uncaught errors in the exported sandbox', jsErrors2.length === 0, jsErrors2.slice(0,2).join(' | '));
    await player2.close();
  }

  check('no uncaught errors in the maker', makerErrors.length === 0, makerErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER LOOP CHECKS PASSED');
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
