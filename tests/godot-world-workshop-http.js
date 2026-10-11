const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const EPISODES=['godot_tutorial.html','godot-gdscript-essentials.html','godot-racing-workshop.html','godot-racing-workshop-2.html','godot-gatekeeper-3d-part1.html','godot-gatekeeper-3d-part2.html','godot_templates.html'];
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
    page.on('request',r=>{const u=r.url();(u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:'))?r.continue():r.abort();});
    await page.setViewport({width:1440,height:1200});
    await page.goto(base+'/workshops/godot-world-workshop.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');

    const hub=await page.evaluate(()=>({
      cards:document.querySelectorAll('a.gd-ep').length,
      episodeLinks:Array.from(document.querySelectorAll('a.gd-ep')).filter(a=>/\.html$/.test(a.getAttribute('href')||'')).length,
      hero:!!document.getElementById('gdHero'),
      studio:document.querySelectorAll('a[href*="godot-mod-studio.html"]').length,
      prog:!!document.getElementById('gdProgText'),
      badge:!!document.getElementById('gdProgBadge'),
      cheat:!!document.querySelector('a[href*="godot-cheatsheet.html"]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('hub lists all 7 episodes',hub.cards>=7,'cards '+hub.cards);
    check('hub links the episode pages',hub.episodeLinks>=7,'links '+hub.episodeLinks);
    check('hub has the live scene hero',hub.hero);
    check('hub links the Godot Mod Studio',hub.studio>=2,'links '+hub.studio);
    check('hub has the progress dashboard',hub.prog&&hub.badge);
    check('hub links the cheat sheet',hub.cheat);
    check('hub has no dashes',hub.dashes===0,'dashes '+hub.dashes);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');

    const a1=await page.$eval('#gdHero',c=>c.toDataURL());
    await new Promise(r=>setTimeout(r,240));
    const a2=await page.$eval('#gdHero',c=>c.toDataURL());
    check('hero scene animates',a1!==a2);

    check('hub no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    for(const file of EPISODES){
      errors.length=0;
      const exists=fs.existsSync(path.join(root,'workshops',file));
      check(file+' exists',exists);
      if(!exists)continue;
      await page.goto(base+'/workshops/'+file,{waitUntil:'load'});
      if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
      const ep=await page.evaluate(()=>({
        handoff:/Build it in our Godot Studio too/.test(document.body.innerHTML),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        sw:document.documentElement.scrollWidth
      }));
      check(file+': links the Godot Studio for guidance',ep.handoff);
      check(file+': no dashes',ep.dashes===0,'dashes '+ep.dashes);
      check(file+': desktop no overflow',ep.sw<=1442,ep.sw+'');
      await page.setViewport({width:390,height:844,isMobile:true});
      await page.reload({waitUntil:'load'});
      const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
      check(file+': 390px no overflow',mob<=392,'scrollWidth '+mob);
      await page.setViewport({width:1440,height:900});
    }

    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(base+'/workshops/godot-world-workshop.html',{waitUntil:'load'});
    const mh=await page.evaluate(()=>document.documentElement.scrollWidth);
    check('hub 390px no overflow',mh<=392,'scrollWidth '+mh);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
