#!/usr/bin/env node
/*
 * tests/cards-smoke.js , A607
 *
 * Call of the Cards is one fortress now: storm the Fortress with 6 Power
 * for 2 VP, first to take it wins the crown. No shop, no queue.
 */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.CC_PORT||8160);
const BASE=`http://127.0.0.1:${PORT}`;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
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
  hasVictory:!!document.getElementById('cardsVictory'),
  victoryShown:document.getElementById('cardsVictory') ? document.getElementById('cardsVictory').classList.contains('show') : false,
  victoryText:(document.getElementById('cardsVictory')||{}).textContent||'',
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
      await page.goto(BASE+'/games/call_of_the_cards.html',{waitUntil:'load',timeout:30000});
      await page.waitForSelector('body',{timeout:10000});
      await new Promise(r=>setTimeout(r,800));
      const start=await page.evaluate(SNAP);
      ok(vp.name+': page states one fortress, Storm the Fortress', /Storm the Fortress|one fortress/i.test(start.body), start.body.slice(0,120));
      ok(vp.name+': no 5 VP ladder or shop in copy', !/race to 5 VP|3-slot|replacement queue/i.test(start.body));
      const hasHook=await page.evaluate(()=>typeof window.__cardsTest !== 'undefined' && !!window.__cardsTest.win);
      ok(vp.name+': test hook present', hasHook);
      if(hasHook){
        await page.evaluate(()=>window.__cardsTest.win());
        await new Promise(r=>setTimeout(r,600));
        const won=await page.evaluate(SNAP);
        ok(vp.name+': win shows Crown taken', won.victoryShown && /Crown taken|Stormed the Fortress/i.test(won.victoryText), won.victoryText.slice(0,80));
        await page.evaluate(()=>{const b=document.querySelector('#cardsVictory [data-test="cardsAgain"]'); if(b) b.click(); else location.reload();});
        await new Promise(r=>setTimeout(r,1200));
        const fresh=await page.evaluate(SNAP);
        ok(vp.name+': replay hides', !fresh.victoryShown);
        await page.evaluate(()=>window.__cardsTest.lose());
        await new Promise(r=>setTimeout(r,600));
        const lost=await page.evaluate(SNAP);
        ok(vp.name+': lose shows Rival takes it', lost.victoryShown && /Rival takes it|Rival Power/i.test(lost.victoryText));
      }
      ok(vp.name+': no sideways scrolling', await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1));
      ok(vp.name+': no page errors', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }
    const html=fs.readFileSync(path.join(ROOT,'games/call_of_the_cards.html'),'utf8');
    ok('one-fortress patch present', /A607 one-fortress/.test(html));
  }finally{ await browser.close(); server.close(); }
  console.log(failures? `\n${failures} FAILED` : '\nCards run: all checks passed');
  process.exit(failures?1:0);
})().catch(e=>{console.error('harness error',e);process.exit(1);});
