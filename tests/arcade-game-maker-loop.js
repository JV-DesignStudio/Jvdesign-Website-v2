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
const PORT = process.env.AGM_LOOP_PORT || 8993;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };

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
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const maker = await browser.newPage();
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

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER LOOP CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
