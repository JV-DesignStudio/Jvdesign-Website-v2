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
    await page.goto(base+'/workshops/python-mod-studio.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');

    const st=await page.evaluate(()=>({
      tabs:document.querySelectorAll('.pms-tab').length,
      cells:document.querySelectorAll('#pyBoard .pms-cell').length,
      swatches:document.querySelectorAll('#pyPalette .pms-swatch').length,
      features:document.querySelectorAll('#pyScriptList input[type=checkbox]').length,
      log:!!document.getElementById('pyLog'),
      exportBtn:!!document.getElementById('pyDownload'),
      cheat:!!document.querySelector('a[href*="python-cheatsheet.html"]'),
      hub:!!document.querySelector('a[href*="python-world-workshop.html"]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('studio has 5 tabs',st.tabs===5,'tabs '+st.tabs);
    check('studio grid has 32 cells',st.cells===32,'cells '+st.cells);
    check('palette has 6 objects',st.swatches===6,'swatches '+st.swatches);
    check('feature list has 5 features',st.features===5,'features '+st.features);
    check('studio has the traceback console',st.log);
    check('studio has the download button',st.exportBtn);
    check('studio links the cheat sheet',st.cheat);
    check('studio links back to the series hub',st.hub);
    check('studio has no dashes',st.dashes===0,'dashes '+st.dashes);
    check('studio desktop no overflow',st.sw<=1442,st.sw+'');

    await page.click('.pms-tab[data-tab="scripts"]');
    const onScripts=await page.evaluate(()=>document.getElementById('panel-scripts').classList.contains('is-active'));
    check('tabs switch panels',onScripts);

    await page.click('.pms-tab[data-tab="level"]');
    await page.click('#pyExample');
    const code=await page.evaluate(()=>window.PMS_buildMain&&window.PMS_buildMain());
    check('builds a real main.py',/^import pygame/.test(code)&&/pygame\.Rect\(/.test(code)&&/while running:/.test(code)&&/pygame\.draw\.rect/.test(code),'len '+(code||'').length);
    check('main.py has a player and coins',/player = pygame\.Rect/.test(code)&&/coins = \[/.test(code));
    const feats=await page.evaluate(()=>window.PMS_featureNames&&window.PMS_featureNames());
    check('writes chosen features',Array.isArray(feats)&&feats.includes('move')&&feats.includes('coin'),JSON.stringify(feats));

    await page.click('.pms-tab[data-tab="debug"]');
    await page.click('#pyLog .err');
    await page.click('#pyOptions .pms-dbg-opt');
    const dbg=await page.evaluate(()=>({correct:!!document.querySelector('#pyOptions .is-correct'),next:document.getElementById('pyNext').style.display}));
    check('debug accepts a correct fix',dbg.correct&&dbg.next!=='none');

    check('studio no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(base+'/workshops/python-mod-studio.html',{waitUntil:'load'});
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check('studio 390px no overflow',mob<=392,'scrollWidth '+mob);

    await page.setViewport({width:1440,height:900});
    await page.goto(base+'/workshops/python-world-workshop.html',{waitUntil:'load'});
    const hub=await page.evaluate(()=>({studioLink:!!document.querySelector('a[href="python-mod-studio.html"]'),sw:document.documentElement.scrollWidth}));
    check('hub links the Python Mod Studio',hub.studioLink);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');
    await page.goto(base+'/workshops/python-catch-workshop.html',{waitUntil:'load'});
    const ep=await page.evaluate(()=>({handoff:/Build it in our Python Studio too/.test(document.body.innerHTML),dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
    check('episode links the Python Mod Studio',ep.handoff);
    check('episode has no dashes',ep.dashes===0,'dashes '+ep.dashes);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
