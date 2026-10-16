#!/usr/bin/env node
/*
 * tests/arcade-game-maker-export-boot.js , A1541
 * Proves the ⬇ exported single-file game is self-contained: build it from the
 * maker, then open it as its OWN page with every remote request blocked and
 * check it boots (canvas + Phaser scene) with no CSP console errors and no
 * leftover inline handlers or relative asset links.
 * Run: node tests/arcade-game-maker-export-boot.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_BOOT_PORT || 8984;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.min.js':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  let exportHtml = '';
  const server = http.createServer((req,res)=>{
    const clean = decodeURIComponent(req.url.split('?')[0]);
    if (clean === '/__export.html') {
      res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
      res.end(exportHtml);
      return;
    }
    let p = clean;
    if(p.endsWith('/')) p+='index.html';
    fs.readFile(path.join(ROOT,p),(err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});

  // 1. Build the export from the maker.
  const maker = await browser.newPage();
  await maker.setViewport({width:1280,height:900});
  await maker.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await maker.waitForSelector('#runGameBtn', {timeout:15000});
  await new Promise(r=>setTimeout(r,400));
  exportHtml = await maker.evaluate(async ()=>{
    _engineData = { title:'Export Boot Test', genre:'SHOOTER', speed:200, gravity:600, jump:450, map:null };
    const built = await _buildExportHtml();
    return built ? built.html : '';
  });
  await maker.close();
  check('export builder produced HTML', exportHtml.length > 1000, 'len=' + exportHtml.length);

  // Static checks on the packed file.
  check('export keeps no relative local script src', !/<script[^>]*\bsrc=["'](?:\.\.?\/|\/(?!\/))/i.test(exportHtml));

  // 2. Open the packed game as its own page with all remote hosts blocked.
  const game = await browser.newPage();
  const cspErrors = [], jsErrors = [], remote = [];
  await game.setRequestInterception(true);
  game.on('request', r=>{
    const u = r.url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') { r.continue(); return; }
    remote.push(u); r.abort();
  });
  game.on('pageerror', e=> jsErrors.push(e.message));
  game.on('console', m=>{
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Content Security Policy|Refused to (execute|load|apply)/i.test(t)) { cspErrors.push(t); return; }
    if (/ERR_|Failed to load resource|Aborted|net::/.test(t)) return;
    jsErrors.push(t);
  });
  await game.setViewport({width:1280,height:900});
  await game.goto(BASE+'__export.html', {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,900));
  await game.evaluate(()=>{ const el=document.getElementById('introOverlay'); if(el && el.classList.contains('show')){ if(typeof closeIntro==='function') closeIntro(); else el.classList.remove('show'); } });
  await new Promise(r=>setTimeout(r,1600));

  const r = await game.evaluate(()=>{
    const gm = window._phaserGame;
    const scenes = (gm && gm.scene && gm.scene.scenes) ? gm.scene.scenes : [];
    const tex = (k)=>{ try { return !!(gm && gm.textures.exists(k)); } catch(e){ return false; } };
    const errOv = document.getElementById('gameErrorOverlay');
    return {
      exportMode: window.__exportMode === true,
      canvas: !!document.querySelector('#game-container canvas'),
      sceneCount: scenes.length,
      player: tex('player'),
      errShown: !!(errOv && errOv.style.display !== 'none' && getComputedStyle(errOv).display !== 'none'),
      handlers: document.querySelectorAll('[onclick],[oninput],[onchange],[onerror],[onload],[onsubmit],[onkeydown],[onfocus]').length,
      stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
      chrome: document.querySelectorAll('#cookie-banner,#jvds-feedback-widget,#emberGuideOverlay,#jvds-keepsake-strip,[data-ember-floating]').length
    };
  });

  check('exported page sets __exportMode', r.exportMode === true);
  check('exported game boots a canvas with no network', r.canvas === true);
  check('exported game created a Phaser scene', r.sceneCount > 0, 'scenes=' + r.sceneCount);
  check('exported game drew the player texture', r.player === true);
  check('exported game shows no asset-error overlay', r.errShown === false);
  check('exported DOM has no inline event handlers', r.handlers === 0, 'found ' + r.handlers);
  check('exported DOM has no stylesheet links (all inlined)', r.stylesheets === 0, 'found ' + r.stylesheets);
  check('exported DOM has no leftover site chrome', r.chrome === 0, 'found ' + r.chrome);
  check('no CSP console errors in the exported game', cspErrors.length === 0, cspErrors.slice(0,2).join(' | '));
  check('no uncaught JS errors in the exported game', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));
  check('no remote request attempted (fully offline)', remote.length === 0, remote.slice(0,3).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER EXPORT-BOOT CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
