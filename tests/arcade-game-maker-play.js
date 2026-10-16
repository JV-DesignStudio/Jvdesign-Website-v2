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

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER PLAY CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
