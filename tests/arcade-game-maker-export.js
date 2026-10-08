#!/usr/bin/env node
/*
 * tests/arcade-game-maker-export.js , checks the Arcade Game Maker can export
 * the current project as an editable .json file (the round-trip partner of the
 * existing Import button). Run: node tests/arcade-game-maker-export.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_EXPORT_PORT || 8981;
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
  const jsErrors=[];
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon/.test(text)) return;
    jsErrors.push(text);
  });
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  await new Promise(r=>setTimeout(r,400));

  const r = await page.evaluate(async ()=>{
    const fn = typeof exportCurrentJson === 'function';
    const buildFn = typeof _buildSaveData === 'function';
    const btn = !!document.querySelector('button[onclick="exportCurrentJson()"]');
    let text = null;
    const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL, realClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b)=>{ try { b.text().then(t=>{ text = t; }); } catch(e){} return 'blob:test'; };
    URL.revokeObjectURL = ()=>{};
    HTMLAnchorElement.prototype.click = function(){};
    try { exportCurrentJson(); } catch(e) { return { fn, buildFn, btn, error: e.message }; }
    await new Promise(res=>setTimeout(res,100));
    URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; HTMLAnchorElement.prototype.click = realClick;
    let parsed = null, keys = [];
    try { parsed = JSON.parse(text); keys = Object.keys(parsed); } catch(e) { return { fn, buildFn, btn, parseError: e.message, sample: String(text||'').slice(0,80) }; }
    return { fn, buildFn, btn, keys, genre: parsed.genre, hasLive: !!parsed.liveConfig, hasTitle: 'title' in parsed };
  });

  check('exportCurrentJson exists', r.fn === true);
  check('_buildSaveData exists', r.buildFn === true);
  check('Download JSON button is in the Save & Share row', r.btn === true);
  check('export produced blob text', !!r.keys, r.error || r.parseError || '');
  check('exported JSON has expected project keys', !!r.keys && r.hasTitle && r.hasLive && r.keys.includes('genre'), (r.keys||[]).join(','));
  check('exported JSON has a genre value', !!r.genre, String(r.genre));
  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER EXPORT CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
