const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const HUB='my-first-unreal-game.html';
const PAGE='unreal-cheatsheet.html';
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.zip':'application/zip','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  const u=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const f=path.join(root,u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('missing '+u);}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});

    await page.goto(base+'/workshops/'+HUB,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const hub=await page.evaluate(()=>({
      episodes:document.querySelectorAll('a[href*="unreal-"][href$=".html"]').length,
      prog:!!document.getElementById('unrealProgText'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('hub links the episode pages',hub.episodes>=8,'links '+hub.episodes);
    check('hub has the progress dashboard',hub.prog);
    check('hub has no dashes',hub.dashes===0,'dashes '+hub.dashes);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');
    check('hub no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    errors.length=0;
    await page.goto(base+'/workshops/'+PAGE,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    await new Promise(r=>setTimeout(r,400));
    const m=await page.evaluate(()=>({
      h1:(document.querySelector('h1')||{}).textContent||'',
      codeBlocks:document.querySelectorAll('.sheet-card pre, .code-block').length,
      parsons:document.querySelectorAll('.parsons-problem').length,
      print:!!document.querySelector('.btn-print-big'),
      hubLink:document.querySelectorAll('a[href*="my-first-unreal-game.html"]').length,
      studioLink:document.querySelectorAll('a[href*="unreal-studio.html"]').length,
      workshopLink:document.querySelectorAll('a[href="/workshop"]').length,
      lumo:/Lumo/.test(document.body.innerText),
      noInstall:/nothing to install/i.test(document.body.innerText),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check(PAGE+': has the cheat sheet heading',/Cheat Sheet/i.test(m.h1),m.h1);
    check(PAGE+': has reference cards with code',m.codeBlocks>=6,'blocks '+m.codeBlocks);
    check(PAGE+': has a parsons problem',m.parsons>=1,'parsons '+m.parsons);
    check(PAGE+': has a print button',m.print);
    check(PAGE+': links back to the series hub',m.hubLink>=1,'links '+m.hubLink);
    check(PAGE+': links to the Unreal Studio',m.studioLink>=1,'links '+m.studioLink);
    check(PAGE+': links to All workshops',m.workshopLink>=1,'links '+m.workshopLink);
    check(PAGE+': Lumo present',m.lumo);
    check(PAGE+': states nothing to install',m.noInstall);
    check(PAGE+': no dashes',m.dashes===0,'dashes '+m.dashes);
    check(PAGE+': desktop no overflow',m.sw<=1442,m.sw+'');
    check(PAGE+': no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    await page.setViewport({width:390,height:844,isMobile:true});
    await page.reload({waitUntil:'load'});
    await new Promise(r=>setTimeout(r,400));
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(PAGE+': 390px no overflow',mob<=392,'scrollWidth '+mob);
    await page.setViewport({width:1440,height:900});
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
