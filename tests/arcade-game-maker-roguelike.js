#!/usr/bin/env node
/*
 * tests/arcade-game-maker-roguelike.js (A2179)
 *
 * The roguelike clears floors room by room and shows victory when the final
 * boss falls. A score/time win target must not end that run the moment a room
 * is cleared, and the Power Picks loadout must not cover the first room.
 *
 * Run: node tests/arcade-game-maker-roguelike.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_ROGUE_PORT || 8986;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async()=>{
  const server = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p.endsWith('/')) p+='index.html';
    fs.readFile(path.join(ROOT,p),(err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const jsErrors=[];
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon/.test(t)) return;
    jsErrors.push(t);
  });
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.GENRE_LIST && window.GENRE_LIST.length > 0 &&
    typeof window.compileAndBootEngine === 'function' && typeof window.onGenreChange === 'function', {timeout:20000});

  // 1. The genre default is the dungeon itself, not a score target.
  const defaults = await page.evaluate(()=>{
    document.getElementById('genreMode').value = 'ROGUELIKE';
    onGenreChange();
    const row = document.getElementById('winTargetRow');
    return {
      entry: _GENRE_WIN.ROGUELIKE,
      cond: liveConfig.winCondition,
      target: liveConfig.winTarget,
      rowVisible: !!(row && row.style.display !== 'none'),
    };
  });
  check('ROGUELIKE default win is intrinsic', defaults.entry && defaults.entry.c === 'intrinsic',
    JSON.stringify(defaults.entry));
  check('ROGUELIKE boots with no score/time win', defaults.cond === 'none', defaults.cond);
  check('ROGUELIKE hides the score-target row', defaults.rowVisible === false);

  // 2. Boot the dungeon with perks on, and an old saved score target.
  await page.evaluate(()=>{
    liveConfig.perksEnabled = true;
    liveConfig.rogueRooms = 3;
    compileAndBootEngine();
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, {timeout:20000});
  await sleep(800);

  const room0 = await page.evaluate(()=>{
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return {
      key: sc.scene.key,
      room: sc._room,
      ppOpen: !!_ppOpen,
      overlay: document.getElementById('ppOverlay') ? getComputedStyle(document.getElementById('ppOverlay')).display : 'none',
      hasBossVictory: typeof sc._killBoss === 'function',
    };
  });
  check('the roguelike scene is running', room0.key === 'RoguelikeScene', room0.key);
  check('no loadout draft covers room 1', room0.ppOpen === false && room0.overlay === 'none',
    JSON.stringify({ppOpen:room0.ppOpen, overlay:room0.overlay}));
  check('the dungeon keeps its own final-boss victory', room0.hasBossVictory === true);

  // 3. An old project can still carry winCondition=score. Clearing rooms must
  //    not trip it, even when the score passes the target.
  const oldSave = await page.evaluate(()=>{
    const sc = window._phaserGame.scene.getScenes(true)[0];
    liveConfig.winCondition = 'score';
    liveConfig.winTarget = 1000;
    sc.score = 1500;
    sc._roomCleared = true;
    _sceneCheckWin(sc, 1500);
    return { triggered: !!sc._winTriggered };
  });
  await sleep(400);
  const afterClear = await page.evaluate(()=>{
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const go = document.getElementById('goOverlay');
    return { stillActive: !!sc.scene.isActive(), triggered: !!sc._winTriggered,
      overlay: go ? go.classList.contains('show') : false };
  });
  check('a saved score win is ignored by the roguelike', oldSave.triggered === false &&
    afterClear.triggered === false && afterClear.overlay === false, JSON.stringify(afterClear));
  check('the run is still playing after the room clear', afterClear.stillActive === true);

  // 4. The loadout arrives once the learner has cleared a room and moved on.
  await page.evaluate(()=>{ window._phaserGame.scene.getScenes(true)[0]._room = 1; });
  await sleep(500);
  const draft = await page.evaluate(()=>{
    const ov = document.getElementById('ppOverlay');
    return {
      open: !!_ppOpen,
      cards: document.querySelectorAll('#ppOverlay .pp-card').length,
      heading: document.querySelector('#ppOverlay .pp-title') ? document.querySelector('#ppOverlay .pp-title').textContent : '',
    };
  });
  check('the loadout opens after room 1', draft.open === true && draft.heading === 'CHOOSE YOUR LOADOUT',
    JSON.stringify(draft));
  check('the loadout offers three distinct cards', draft.cards === 3, String(draft.cards));
  await page.evaluate(()=>{ if (_ppOpen) _ppPick(-1); });

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER ROGUELIKE CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
