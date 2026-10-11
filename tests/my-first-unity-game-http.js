/* Hub + series-nav checks for the Unity engine (My First Unity Game).
   Verifies the hub reaches the Stardew bar (first-15 block, progress dashboard,
   Lumo, all eight episodes linked) and that every episode carries the shared
   prev / hub / next series navigation and Lumo presence. */
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const EPISODES=[
  'unity-pong-workshop.html','unity-2d-platformer.html','unity-breakout-workshop.html',
  'unity-top-down-shooter.html','unity-3d-platformer.html','unity-action-rpg-workshop.html',
  'unity-ui-workshop.html','unity-multiplayer-workshop.html'
];
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.zip':'application/zip','.ico':'image/x-icon'};
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

    // Hub
    await page.goto(base+'/workshops/my-first-unity-game.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const hub=await page.evaluate((eps)=>({
      links:eps.filter(f=>!!document.querySelector('a[href="'+f+'"]')).length,
      firstWin:/first 15 minutes/i.test(document.body.innerText),
      progress:!!document.getElementById('unityProgText'),
      lumo:/Lumo says/i.test(document.body.innerText),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }),EPISODES);
    check('hub links all eight episodes',hub.links===EPISODES.length,'links '+hub.links);
    check('hub has the first 15 minutes block',hub.firstWin);
    check('hub has the progress dashboard',hub.progress);
    check('hub has Lumo presence',hub.lumo);
    check('hub has no dashes',hub.dashes===0,'dashes '+hub.dashes);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');
    check('hub no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    for(const file of EPISODES){
      errors.length=0;
      await page.goto(base+'/workshops/'+file,{waitUntil:'load'});
      if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
      const m=await page.evaluate(()=>({
        nav:document.querySelectorAll('.unity-series-nav a').length,
        hub:!!document.querySelector('.unity-series-nav a[href="my-first-unity-game.html"]'),
        lumo:/Lumo says/i.test(document.body.innerText),
        sw:document.documentElement.scrollWidth
      }));
      check(file+': series nav present',m.nav>=2,'links '+m.nav);
      check(file+': series nav links the hub',m.hub);
      check(file+': Lumo presence',m.lumo);
      check(file+': desktop no overflow',m.sw<=1442,m.sw+'');
      check(file+': no browser errors',errors.length===0,errors.slice(0,2).join(' | '));
      await page.setViewport({width:390,height:844,isMobile:true});
      await page.reload({waitUntil:'load'});
      const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
      check(file+': 390px no overflow',mob<=392,'scrollWidth '+mob);
      await page.setViewport({width:1440,height:900});
    }
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
