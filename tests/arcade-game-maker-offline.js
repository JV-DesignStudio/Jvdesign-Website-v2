#!/usr/bin/env node
/*
 * tests/arcade-game-maker-offline.js , A1468
 * Proves a game made with NO imported art boots with the network fully blocked:
 * default sprites are drawn on-device, nothing reaches labs.phaser.io, and the
 * asset-error overlay never appears. Run: node tests/arcade-game-maker-offline.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_OFFLINE_PORT || 8983;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

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
  const jsErrors = [], remote = [];
  await page.setRequestInterception(true);
  page.on('request', r=>{
    const u = r.url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u === 'about:blank') { r.continue(); return; }
    remote.push(u);
    r.abort(); // blocked: the game must not need any of these
  });
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_|Failed to load resource|Aborted|net::/.test(t)) return; // blocked-resource noise
    jsErrors.push(t);
  });

  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  await new Promise(r=>setTimeout(r,400));

  // Exercise the default-art path: no imported sprites at all.
  await page.evaluate(()=>{
    try { customSpriteDataUrl=null; customEnemyDataUrl=null; customBulletDataUrl=null; customBlockDataUrl=null; } catch(e){}
    const g = document.getElementById('genreMode'); if(g){ g.value='SHOOTER'; if(typeof onGenreChange==='function') onGenreChange(); }
  });
  await page.evaluate(()=>{ if(typeof compileAndBootEngine==='function') compileAndBootEngine(); });
  await new Promise(r=>setTimeout(r,900));
  await page.evaluate(()=>{ const el=document.getElementById('introOverlay'); if(el && el.classList.contains('show')){ if(typeof closeIntro==='function') closeIntro(); else el.classList.remove('show'); } });
  await new Promise(r=>setTimeout(r,1600));

  const r = await page.evaluate(()=>{
    const gm = window._phaserGame;
    const scenes = (gm && gm.scene && gm.scene.scenes) ? gm.scene.scenes : [];
    const tex = (k)=>{ try { return !!(gm && gm.textures.exists(k)); } catch(e){ return false; } };
    const errOv = document.getElementById('gameErrorOverlay');
    return {
      canvas: !!document.querySelector('#game-container canvas'),
      scene: scenes.length > 0,
      sceneCount: scenes.length,
      player: tex('player'), enemy: tex('enemy'), laser: tex('laser'), block: tex('block'),
      errShown: !!(errOv && errOv.style.display !== 'none' && getComputedStyle(errOv).display !== 'none')
    };
  });

  const labs = remote.filter(u=>u.includes('labs.phaser.io'));
  check('maker loaded with every remote host blocked', true, remote.length + ' remote request(s) blocked');
  check('no request to labs.phaser.io', labs.length === 0, labs.slice(0,3).join(' | '));
  check('game boots a canvas with no network', r.canvas === true);
  check('a Phaser scene was created', r.scene === true, 'scenes=' + (r.sceneCount||0));
  check('player texture generated on-device', r.player === true);
  check('enemy texture generated on-device', r.enemy === true);
  check('laser texture generated on-device', r.laser === true);
  check('block texture generated on-device', r.block === true);
  check('no asset-error overlay', r.errShown === false);
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER OFFLINE CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
