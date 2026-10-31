#!/usr/bin/env node
/*
 * tests/arcade-game-maker-export-custom.js , A2172
 * Exports a Custom Sandbox game and opens the packed file offline, proving the
 * player payload carries CustomScene, the sandbox rules and the win path.
 * Run: node tests/arcade-game-maker-export-custom.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_EXPORT_CUSTOM_PORT || 8996;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

let exportHtml = '';
const server = http.createServer((req,res)=>{
  const clean = decodeURIComponent(req.url.split('?')[0]);
  if (clean === '/__custom-export.html') { res.writeHead(200,{'Content-Type':'text/html'}); res.end(exportHtml); return; }
  let p = clean;
  if(p.endsWith('/')) p+='index.html';
  fs.readFile(path.join(ROOT,p),(err,buf)=>{
    if(err){ res.writeHead(404); res.end(); return; }
    res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
    res.end(buf);
  });
});

(async()=>{
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});

  const maker = await browser.newPage();
  await maker.setViewport({width:1280,height:900});
  await maker.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await maker.waitForFunction(() => typeof window._buildExportHtml === 'function', {timeout:20000});
  const built = await maker.evaluate(async () => {
    Object.assign(liveConfig, {
      customStarTarget: 1, customEnemyCount: 0, customEnemySpeed: 0,
      customWinMode: 'collect', customWinValue: 0,
      customGoldStars: false, customFastEnemies: false,
      customVars: [],
      customRules: [{ id:'r1', enabled:true, match:'any',
        conds:[{ left:'time', op:'>=', right:0 }],
        actions:[{ type:'addScore', target:'', amount:50 }] }]
    });
    _engineData = { v:1, title:'Exported Sandbox', genre:'CUSTOM', speed:220, gravity:600, jump:450, map:null, entities:null };
    const x = await _buildExportHtml();
    return { html: x && x.html, size: x && x.html ? x.html.length : 0 };
  });
  exportHtml = built.html || '';
  await maker.close();

  check('custom export produced HTML', exportHtml.length > 1000, built.size + ' bytes');
  check('custom export is under 1.5 MB', exportHtml.length < 1500000, Math.round(exportHtml.length/1024) + 'KB');
  check('export carries the payload version', /"v":1/.test(exportHtml));

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
  await game.goto(BASE+'__custom-export.html', {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r, 900));
  await game.evaluate(() => {
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
  });
  await game.waitForFunction(() => {
    const g = window._phaserGame;
    return g && g.scene && g.scene.getScenes(true).length > 0;
  }, {timeout:20000});
  await new Promise(r=>setTimeout(r, 700));

  const r = await game.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    const star = sc.stars ? sc.stars.getChildren().find(c => c.active) : null;
    if (star) sc.actor.setPosition(star.x, star.y);
    return { scene: sc.sys.settings.key, score: sc.score, stars: sc.stars ? sc.stars.countActive(true) : 0 };
  });
  check('exported sandbox uses CustomScene', r.scene === 'CustomScene', r.scene);
  check('exported sandbox runs its rules', r.score >= 50, String(r.score));
  check('exported sandbox has the star', r.stars === 1, String(r.stars));

  await new Promise(r=>setTimeout(r, 700));
  const win = await game.evaluate(() => {
    const sc = window._phaserGame.scene.getScenes(true)[0];
    return { collected: sc._collected, done: sc._done,
      overlay: document.getElementById('goOverlay').classList.contains('show') };
  });
  check('exported sandbox can be won', win.collected === 1 && win.done === true && win.overlay === true, JSON.stringify(win));
  check('no CSP console errors', cspErrors.length === 0, cspErrors.slice(0,2).join(' | '));
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));
  check('no remote request attempted', remote.length === 0, remote.slice(0,3).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER EXPORT-CUSTOM CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
