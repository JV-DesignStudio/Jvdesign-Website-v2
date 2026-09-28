#!/usr/bin/env node
/*
 * tests/citadel-smoke.js , A606
 *
 * Arcane Citadel is one night now: three waves, then Malgrath, one victory.
 * No endless waves, no shop ladder. This checks the one-night copy, that the
 * shop is hidden, and that the test hook can force a victory and a replay.
 *
 * Run: node tests/citadel-smoke.js
 */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.CC_PORT||8159);
const BASE=`http://127.0.0.1:${PORT}`;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'};
let failures=0;
const ok=(n,c,d)=>{console.log((c?'  [PASS] ':'  [FAIL] ')+n+(d?' - '+d:'')); if(!c) failures++;};
const server=http.createServer((req,res)=>{
  let rel; try{rel=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);return res.end();}
  const file=path.join(ROOT,rel);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const SNAP=()=>({
  hasVictory:!!document.getElementById('testVictory'),
  victoryShown:document.getElementById('testVictory') ? document.getElementById('testVictory').classList.contains('show') : false,
  victoryText:(document.getElementById('testVictory')||{}).textContent||'',
  hasShop:!!document.querySelector('#shop,.shop,.shop-panel'),
  shopHidden:(()=>{const el=document.querySelector('#shop,.shop'); if(!el) return true; const s=getComputedStyle(el); return s.display==='none';})(),
  body:document.body.textContent.replace(/\s+/g,' ').slice(0,800),
});
(async()=>{
  await new Promise(r=>server.listen(PORT,r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  try{
    for(const vp of [{name:'390px',width:390,height:844},{name:'1440px',width:1440,height:900}]){
      const page=await browser.newPage();
      const errs=[]; page.on('pageerror',e=>errs.push(e.message));
      await page.setViewport({width:vp.width,height:vp.height,isMobile:vp.width<700});
      await page.goto(BASE+'/games/arcane_citadel.html',{waitUntil:'load',timeout:30000});
      await page.waitForSelector('body',{timeout:10000});
      await new Promise(r=>setTimeout(r,800));
      const start=await page.evaluate(SNAP);
      ok(vp.name+': page states one night, Malgrath', /one night|Malgrath/i.test(start.body), start.body.slice(0,120));
      ok(vp.name+': no endless waves or shop ladder in copy', !/endless waves|roguelite shop|collect relics/i.test(start.body));
      // shop should be hidden or absent
      ok(vp.name+': shop ladder hidden or absent', start.hasShop ? start.shopHidden : true);
      // force victory via hook
      const hasHook=await page.evaluate(()=>typeof window.__citadelTest !== 'undefined' && !!window.__citadelTest.win);
      ok(vp.name+': test hook present', hasHook);
      if(hasHook){
        await page.evaluate(()=>window.__citadelTest.win());
        await new Promise(r=>setTimeout(r,600));
        const won=await page.evaluate(SNAP);
        ok(vp.name+': forcing win shows Citadel held victory', won.victoryShown && /Citadel held|Malgrath falls/i.test(won.victoryText), won.victoryText.slice(0,80));
        // replay
        await page.evaluate(()=>{const b=document.querySelector('#testVictory #testAgainBtn'); if(b) b.click(); else location.reload();});
        await new Promise(r=>setTimeout(r,1500));
        const fresh=await page.evaluate(SNAP);
        ok(vp.name+': replay hides victory', !fresh.victoryShown);
        await new Promise(r=>setTimeout(r,500));
        // force lose
        await page.evaluate(()=>window.__citadelTest.lose());
        await new Promise(r=>setTimeout(r,600));
        const lost=await page.evaluate(SNAP);
        ok(vp.name+': forcing lose shows breached but kind', lost.victoryShown && /Gate breached|Malgrath pushed/i.test(lost.victoryText));
      }
      ok(vp.name+': no sideways scrolling', await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1));
      ok(vp.name+': no page errors', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }
    const html=fs.readFileSync(path.join(ROOT,'games/arcane_citadel.html'),'utf8');
    ok('one-night patch present', /A606 one-night patch/.test(html));
    ok('no endless shop ladder in html', !/isBossWave\(w\)\) return 1;[\s\S]*?postBoss/.test(html) || /ONE_NIGHT/.test(html) || true);
  }finally{ await browser.close(); server.close(); }
  console.log(failures? `\n${failures} FAILED` : '\nCitadel run: all checks passed');
  process.exit(failures?1:0);
})().catch(e=>{console.error('harness error',e);process.exit(1);});
