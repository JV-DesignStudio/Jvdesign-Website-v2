const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const EPISODES=[
  'blender-cube-workshop.html','blender-character-workshop.html','blender-rigging-workshop.html',
  'blender-animation-workshop.html','blender-materials-workshop.html','blender-lighting-workshop.html',
  'blender-scene-workshop.html','blender-workshop.html'
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
    page.on('request',r=>{const u=r.url();(u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:'))?r.continue():r.abort();});
    await page.setViewport({width:1440,height:1200});
    await page.goto(base+'/workshops/blender-world-workshop.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');

    const hub=await page.evaluate(()=>({
      cards:document.querySelectorAll('a.bl-ep').length,
      episodeLinks:document.querySelectorAll('a[href$="-workshop.html"]').length,
      hero:!!document.getElementById('blHero'),
      studio:document.querySelectorAll('a[href*="buildlab.html"]').length,
      prog:!!document.getElementById('blProgText'),
      badge:!!document.getElementById('blProgBadge'),
      cheat:!!document.querySelector('a[href*="blender-cheatsheet.html"]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('hub lists all 8 episodes',hub.cards>=8,'cards '+hub.cards);
    check('hub links the episode pages',hub.episodeLinks>=8,'links '+hub.episodeLinks);
    check('hub has the live wireframe hero',hub.hero);
    check('hub links the 3D BuildLab studio',hub.studio>=2,'links '+hub.studio);
    check('hub has the progress dashboard',hub.prog&&hub.badge);
    check('hub links the cheat sheet',hub.cheat);
    check('hub has no dashes',hub.dashes===0);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');

    // hero animates
    const a1=await page.$eval('#blHero',c=>c.toDataURL());
    await new Promise(r=>setTimeout(r,240));
    const a2=await page.$eval('#blHero',c=>c.toDataURL());
    check('hero wireframe animates',a1!==a2);

    // the 3D studio it points at (BuildLab) exists and is indexable
    check('BuildLab (the 3D studio) exists',fs.existsSync(path.join(root,'tools','buildlab.html')));
    check('BuildLab is a real 3D builder',/GLTFExporter|three\/addons/.test(fs.readFileSync(path.join(root,'tools','buildlab.html'),'utf8')));

    check('hub no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    // episodes load and are consistent
    for(const file of EPISODES){
      errors.length=0;
      await page.goto(base+'/workshops/'+file,{waitUntil:'load'});
      if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
      const ep=await page.evaluate(()=>({
        steps:document.querySelectorAll('.step-card').length,
        handoff:/Make it in our 3D engine too/.test(document.body.innerHTML),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        sw:document.documentElement.scrollWidth
      }));
      check(file+': has workshop steps',ep.steps>=6,'steps '+ep.steps);
      check(file+': links our 3D engine for guidance',ep.handoff);
      check(file+': no dashes',ep.dashes===0,'dashes '+ep.dashes);
      check(file+': desktop no overflow',ep.sw<=1442,ep.sw+'');
      await page.setViewport({width:390,height:844,isMobile:true});
      await page.reload({waitUntil:'load'});
      const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
      check(file+': 390px no overflow',mob<=392,'scrollWidth '+mob);
      await page.setViewport({width:1440,height:900});
    }

    // cheat sheet
    errors.length=0;
    await page.goto(base+'/workshops/blender-cheatsheet.html',{waitUntil:'load'});
    const cs=await page.evaluate(()=>({blocks:document.querySelectorAll('pre, .code-block, code').length,dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
    check('cheat sheet has code',cs.blocks>=6,'blocks '+cs.blocks);
    check('cheat sheet has no dashes',cs.dashes===0);

    // mobile hub
    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(base+'/workshops/blender-world-workshop.html',{waitUntil:'load'});
    const mh=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
    check('hub 390px no overflow',mh.sw<=392,'scrollWidth '+mh.sw);
    check('hub 390px no dashes',mh.dashes===0);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
