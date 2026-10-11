const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
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
    await page.goto(base+'/workshops/godot-mod-studio.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');

    const st=await page.evaluate(()=>({
      tabs:document.querySelectorAll('.gms-tab').length,
      cells:document.querySelectorAll('#gmBoard .gms-cell').length,
      swatches:document.querySelectorAll('#gmPalette .gms-swatch').length,
      scripts:document.querySelectorAll('#gmScriptList input[type=checkbox]').length,
      log:!!document.getElementById('gmLog'),
      exportBtn:!!document.getElementById('gmDownload'),
      cheat:!!document.querySelector('a[href*="godot-cheatsheet.html"]'),
      hub:!!document.querySelector('a[href*="godot-world-workshop.html"]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('studio has 5 tabs',st.tabs===5,'tabs '+st.tabs);
    check('studio grid has 24 cells',st.cells===24,'cells '+st.cells);
    check('palette has 6 objects',st.swatches===6,'swatches '+st.swatches);
    check('script list has 5 scripts',st.scripts===5,'scripts '+st.scripts);
    check('studio has the Output console',st.log);
    check('studio has the download button',st.exportBtn);
    check('studio links the cheat sheet',st.cheat);
    check('studio links back to the series hub',st.hub);
    check('studio has no dashes',st.dashes===0,'dashes '+st.dashes);
    check('studio desktop no overflow',st.sw<=1442,st.sw+'');

    await page.click('.gms-tab[data-tab="scripts"]');
    const onScripts=await page.evaluate(()=>document.getElementById('panel-scripts').classList.contains('is-active'));
    check('tabs switch panels',onScripts);

    await page.click('.gms-tab[data-tab="scene"]');
    await page.click('#gmExample');
    const scene=await page.evaluate(()=>window.GMS_buildScene&&window.GMS_buildScene());
    check('builds a real Godot scene',/^\[gd_scene/.test(scene)&&/CharacterBody2D/.test(scene)&&/Area2D/.test(scene),'len '+(scene||'').length);
    const proj=await page.evaluate(()=>window.GMS_buildProject&&window.GMS_buildProject());
    check('builds a project.godot',/run\/main_scene="res:\/\/Main\.tscn"/.test(proj));
    const scripts=await page.evaluate(()=>window.GMS_scriptNames&&window.GMS_scriptNames());
    check('writes GDScript files',Array.isArray(scripts)&&scripts.includes('player.gd')&&scripts.includes('coin.gd'),JSON.stringify(scripts));

    await page.click('.gms-tab[data-tab="debug"]');
    await page.click('#gmLog .err');
    await page.click('#gmOptions .gms-dbg-opt');
    const dbg=await page.evaluate(()=>({correct:!!document.querySelector('#gmOptions .is-correct'),next:document.getElementById('gmNext').style.display}));
    check('debug accepts a correct fix',dbg.correct&&dbg.next!=='none');

    check('studio no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(base+'/workshops/godot-mod-studio.html',{waitUntil:'load'});
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check('studio 390px no overflow',mob<=392,'scrollWidth '+mob);

    // hub + episode link the studio
    await page.setViewport({width:1440,height:900});
    await page.goto(base+'/workshops/godot-world-workshop.html',{waitUntil:'load'});
    const hub=await page.evaluate(()=>({studioLink:!!document.querySelector('a[href="godot-mod-studio.html"]'),sw:document.documentElement.scrollWidth}));
    check('hub links the Godot Mod Studio',hub.studioLink);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');
    await page.goto(base+'/workshops/godot_tutorial.html',{waitUntil:'load'});
    const ep=await page.evaluate(()=>({handoff:/Build it in our Godot Studio too/.test(document.body.innerHTML),dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
    check('episode links the Godot Mod Studio',ep.handoff);
    check('episode has no dashes',ep.dashes===0,'dashes '+ep.dashes);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
