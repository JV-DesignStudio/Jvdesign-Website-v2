#!/usr/bin/env node
/*
 * tests/arcane_citadel_page-smoke.js
 *
 * Arcane Citadel is an iframe-wrapper cover page: it lazy-loads the game from
 * the iframe's data-src only when the player taps "Start Game". In the installed
 * Arcade app / home-screen PWA, game-system.js marks <html> with arc-appmode and
 * game-system.css hides .page-hero (which holds that Start button), so the game
 * could never be started there. This locks in the fix: app-mode opens straight
 * into the game, while the normal website still waits for the Start tap.
 *
 * Run: node tests/arcane_citadel_page-smoke.js
 */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.AC_PORT||8161);
const BASE=`http://127.0.0.1:${PORT}`;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
let failures=0;
const ok=(n,c,d)=>{console.log((c?'  [PASS] ':'  [FAIL] ')+n+(d?' - '+d:'')); if(!c) failures++;};
const server=http.createServer((req,res)=>{
  let rel; try{rel=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);return res.end();}
  const file=path.join(ROOT,rel);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const SNAP=()=>{
  const f=document.querySelector('.game-frame-wrap iframe');
  let canvas=0;
  try{ canvas=f&&f.contentDocument?f.contentDocument.querySelectorAll('canvas').length:0; }catch(e){}
  return {
    appmode:document.documentElement.classList.contains('arc-appmode'),
    heroDisplay:document.querySelector('.page-hero')?getComputedStyle(document.querySelector('.page-hero')).display:'none',
    iframeSrc:f?f.getAttribute('src'):null,
    playing:document.body.classList.contains('citadel-playing'),
    canvas,
  };
};
(async()=>{
  await new Promise(r=>server.listen(PORT,r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  try{
    // 1) App / installed PWA: arc-appmode hides the Start button, game must self-start.
    {
      const page=await browser.newPage();
      const errs=[]; page.on('pageerror',e=>errs.push(e.message));
      await page.evaluateOnNewDocument(()=>{ window.__JVDS_APP=true; });
      await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
      await page.goto(BASE+'/games/arcane_citadel_page.html',{waitUntil:'load',timeout:30000});
      await page.waitForSelector('body',{timeout:10000});
      await new Promise(r=>setTimeout(r,1500));
      const s=await page.evaluate(SNAP);
      ok('app-mode: html is marked arc-appmode', s.appmode, JSON.stringify(s));
      ok('app-mode: Start hero is hidden (the cause)', s.heroDisplay==='none', s.heroDisplay);
      ok('app-mode: game iframe self-loads without a tap', s.iframeSrc==='arcane_citadel.html', 'src='+s.iframeSrc);
      ok('app-mode: body enters citadel-playing', s.playing);
      ok('app-mode: game canvas is present', s.canvas>0, 'canvas '+s.canvas);
      ok('app-mode: no page errors', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }
    // 2) Normal website: must still wait for the Start tap (no eager load).
    {
      const page=await browser.newPage();
      const errs=[]; page.on('pageerror',e=>errs.push(e.message));
      await page.setViewport({width:1440,height:900});
      await page.goto(BASE+'/games/arcane_citadel_page.html',{waitUntil:'load',timeout:30000});
      await page.waitForSelector('#citadelStart',{timeout:10000});
      await new Promise(r=>setTimeout(r,600));
      const before=await page.evaluate(SNAP);
      ok('website: not app-mode', !before.appmode);
      ok('website: Start button is visible', before.heroDisplay!=='none', before.heroDisplay);
      ok('website: iframe does not load before Start', !before.iframeSrc && !before.playing, 'src='+before.iframeSrc);
      await page.click('#citadelStart');
      await new Promise(r=>setTimeout(r,1500));
      const after=await page.evaluate(SNAP);
      ok('website: Start loads the game', after.iframeSrc==='arcane_citadel.html' && after.playing, JSON.stringify(after));
      ok('website: no page errors', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
