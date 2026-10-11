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
    await page.goto(base+'/workshops/roblox-mod-studio.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');

    const st=await page.evaluate(()=>({
      tabs:document.querySelectorAll('.rbxs-tab').length,
      cells:document.querySelectorAll('#rbBoard .rbxs-cell').length,
      swatches:document.querySelectorAll('#rbPalette .rbxs-swatch').length,
      scripts:document.querySelectorAll('#rbScriptList input[type=checkbox]').length,
      log:!!document.getElementById('rbLog'),
      exportBtn:!!document.getElementById('rbDownload'),
      cheat:!!document.querySelector('a[href*="roblox-studio-cheatsheet.html"]'),
      hub:!!document.querySelector('a[href*="my-first-roblox-studio-game.html"]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('studio has 5 tabs',st.tabs===5,'tabs '+st.tabs);
    check('studio grid has 24 cells',st.cells===24,'cells '+st.cells);
    check('palette has 10 blocks',st.swatches===10,'swatches '+st.swatches);
    check('script list has 5 scripts',st.scripts===5,'scripts '+st.scripts);
    check('studio has the Output console',st.log);
    check('studio has the download button',st.exportBtn);
    check('studio links the cheat sheet',st.cheat);
    check('studio links back to the series hub',st.hub);
    check('studio has no dashes',st.dashes===0,'dashes '+st.dashes);
    check('studio desktop no overflow',st.sw<=1442,st.sw+'');

    // tab switching
    await page.click('.rbxs-tab[data-tab="scripts"]');
    const onScripts=await page.evaluate(()=>document.getElementById('panel-scripts').classList.contains('is-active'));
    check('tabs switch panels',onScripts);

    // example level + real model build
    await page.click('.rbxs-tab[data-tab="level"]');
    await page.click('#rbExample');
    const model=await page.evaluate(()=>window.RBXS_buildRbxm&&window.RBXS_buildRbxm());
    check('builds a real .rbxm model',/^<roblox /.test(model)&&/class="Part"/.test(model),'len '+(model||'').length);
    check('model includes a SpawnLocation',/class="SpawnLocation"/.test(model));
    check('model includes placed blocks',(model.match(/<Item class="Part"/g)||[]).length>=4);
    const scripts=await page.evaluate(()=>window.RBXS_scriptNames&&window.RBXS_scriptNames());
    check('writes Lua script files',Array.isArray(scripts)&&scripts.includes('kill_brick.lua')&&scripts.includes('win_pad.lua'),JSON.stringify(scripts));

    // debug: pick the correct fix
    await page.click('.rbxs-tab[data-tab="debug"]');
    await page.click('#rbLog .err');
    await page.click('#rbOptions .rbxs-dbg-opt');
    const dbg=await page.evaluate(()=>({correct:!!document.querySelector('#rbOptions .is-correct'),next:document.getElementById('rbNext').style.display}));
    check('debug accepts a correct fix',dbg.correct&&dbg.next!=='none');

    check('studio no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    // mobile
    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(base+'/workshops/roblox-mod-studio.html',{waitUntil:'load'});
    const mob=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
    check('studio 390px no overflow',mob.sw<=392,'scrollWidth '+mob.sw);

    // the hub links the studio
    await page.setViewport({width:1440,height:900});
    await page.goto(base+'/workshops/my-first-roblox-studio-game.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const hub=await page.evaluate(()=>({
      studioLink:!!document.querySelector('a[href="roblox-mod-studio.html"]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('hub links the Roblox Mod Studio',hub.studioLink);
    check('hub has no dashes',hub.dashes===0,'dashes '+hub.dashes);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');

    // an episode carries the studio handoff
    await page.goto(base+'/workshops/roblox-obby-workshop.html',{waitUntil:'load'});
    const ep=await page.evaluate(()=>({handoff:/Make it in our Roblox Studio too/.test(document.body.innerHTML),dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,sw:document.documentElement.scrollWidth}));
    check('episode links the Roblox Mod Studio',ep.handoff);
    check('episode has no dashes',ep.dashes===0,'dashes '+ep.dashes);
    check('episode desktop no overflow',ep.sw<=1442,ep.sw+'');
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
