#!/usr/bin/env node
/*
 * tests/arcade-game-maker-starters.js , A1472
 * Every genre must have a starter template exposed in the starter grid, so a
 * newcomer never starts from a bare default. Run:
 *   node tests/arcade-game-maker-starters.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_STARTER_PORT || 8984;
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
    const t = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon/.test(t)) return;
    jsErrors.push(t);
  });
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  // Wait for the deferred module to publish GENRE_LIST and the grid to render.
  await page.waitForFunction(() => document.querySelectorAll('#starterGrid button').length > 0, {timeout:10000});

  const r = await page.evaluate(()=>{
    const list = window.GENRE_LIST || [];
    const missing = list.filter(g => !(_STARTERS[g] && _TEMPLATES[_STARTERS[g]]));
    const badKey = list.filter(g => _STARTERS[g] && !_TEMPLATES[_STARTERS[g]]);
    const buttons = Array.from(document.querySelectorAll('#starterGrid button'));
    const coveredByButtons = new Set(buttons.map(b => (b.getAttribute('onclick')||'').match(/_loadTemplate\('([^']+)'\)/)?.[1]).filter(Boolean));
    const btnMissing = list.filter(g => !coveredByButtons.has(_STARTERS[g]));
    const genresWithStarter = list.filter(g => _STARTERS[g]).length;
    return { total: list.length, genresWithStarter, missing, badKey, buttons: buttons.length, btnMissing };
  });

  check('GENRE_LIST is available', r.total > 0, r.total + ' genres');
  check('every genre maps to a starter template', r.missing.length === 0, r.missing.join(','));
  check('every starter key exists in _TEMPLATES', r.badKey.length === 0, r.badKey.join(','));
  check('starter grid renders a button per genre', r.buttons === r.total, r.buttons + '/' + r.total);
  check('every genre has a button in the grid', r.btnMissing.length === 0, r.btnMissing.join(','));

  // Picking a previously-uncovered genre's starter loads the right genre + title.
  const picked = await page.evaluate(()=>{
    _loadTemplate('brick_blitz');
    return { genre: document.getElementById('genreMode').value, title: document.getElementById('gameTitle').value };
  });
  check('BREAKER starter loads the BREAKER genre', picked.genre === 'BREAKER', picked.genre);
  check('starter sets a title', !!picked.title && picked.title !== 'My Game', picked.title);

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER STARTER CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
