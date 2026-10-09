const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const EPISODES=[
  'stardew-world-ep1-setup.html','stardew-world-ep2-mods-folder.html','stardew-world-ep3-first-tile.html',
  'stardew-world-ep4-layers.html','stardew-world-ep5-tile-properties.html','stardew-world-ep6-build-and-decorate.html',
  'stardew-world-ep7-warps.html','stardew-world-ep8-new-area.html','stardew-world-ep9-package-mod.html',
  'stardew-world-ep10-troubleshoot.html'
];
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

    // Hub
    await page.goto(base+'/workshops/stardew-world-workshop.html',{waitUntil:'load'});
    const hub=await page.evaluate(()=>({
      studioLinks:document.querySelectorAll('a[href*="stardew-mod-studio.html"]').length,
      episodes:document.querySelectorAll('a[href*="stardew-world-ep"]').length,
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('hub links to the Mod Studio',hub.studioLinks>=2,'links '+hub.studioLinks);
    check('hub lists the episode links',hub.episodes>=10,'links '+hub.episodes);
    check('hub has no dashes',hub.dashes===0);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');

    // Episodes
    for(const file of EPISODES){
      errors.length=0;
      await page.goto(base+'/workshops/'+file,{waitUntil:'load'});
      if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
      const m=await page.evaluate(()=>({
        steps:document.querySelectorAll('.step-card').length,
        quizzes:document.querySelectorAll('.quiz-gate').length,
        firstOpen:!!document.querySelector('.step-card.open'),
        engine:!!window.WORKSHOP_KEY,
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        sw:document.documentElement.scrollWidth
      }));
      check(file+': 6 steps',m.steps===6,'steps '+m.steps);
      check(file+': 6 quiz gates',m.quizzes===6,'quizzes '+m.quizzes);
      check(file+': first step open',m.firstOpen);
      check(file+': engine key set',m.engine);
      check(file+': no dashes',m.dashes===0,'dashes '+m.dashes);
      check(file+': no browser errors',errors.length===0,errors.slice(0,2).join(' | '));
      check(file+': desktop no overflow',m.sw<=1442,m.sw+'');
      await page.setViewport({width:390,height:844,isMobile:true});
      await page.reload({waitUntil:'load'});
      const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
      check(file+': 390px no overflow',mob<=392,'scrollWidth '+mob);
      await page.setViewport({width:1440,height:900});
    }

    // Cheat sheet
    errors.length=0;
    await page.goto(base+'/workshops/stardew-modding-cheatsheet.html',{waitUntil:'load'});
    const cs=await page.evaluate(()=>({blocks:document.querySelectorAll('.code-block').length,dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
    check('cheat sheet has code blocks',cs.blocks>=6,'blocks '+cs.blocks);
    check('cheat sheet has no dashes',cs.dashes===0);
    check('cheat sheet no browser errors',errors.length===0,errors.slice(0,2).join(' | '));
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
