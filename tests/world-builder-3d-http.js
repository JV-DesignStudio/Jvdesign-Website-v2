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
    await page.goto(base+'/workshops/world-builder-3d.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const click=(sel)=>page.evaluate(s=>{var e=document.querySelector(s); if(e) e.click();},sel);

    const st=await page.evaluate(()=>({
      tabs:document.querySelectorAll('.wbs-tab').length,
      canvas:!!document.getElementById('vxCanvas'),
      swatches:document.querySelectorAll('#gmPalette .wbs-swatch').length,
      cheat:!!document.querySelector('a[href*="godot-cheatsheet.html"]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('studio has 5 tabs',st.tabs===5,'tabs '+st.tabs);
    check('studio has the 3D canvas',st.canvas);
    check('palette has 8 pieces',st.swatches===8,'swatches '+st.swatches);
    check('studio links the Godot cheat sheet',st.cheat);
    check('studio has no dashes',st.dashes===0,'dashes '+st.dashes);
    check('studio desktop no overflow',st.sw<=1442,st.sw+'');

    await click('.wbs-tab[data-tab="scripts"]');
    const onScripts=await page.evaluate(()=>document.getElementById('panel-scripts').classList.contains('is-active'));
    check('tabs switch panels',onScripts);

    await click('.wbs-tab[data-tab="scene"]');
    await click('#vxExample');
    await new Promise(r=>setTimeout(r,150));
    const count=await page.evaluate(()=>window.WLD_count&&window.WLD_count());
    check('example builds a level',count>0,'pieces '+count);
    const obj=await page.evaluate(()=>window.WLD_buildOBJ&&window.WLD_buildOBJ());
    check('builds a real OBJ mesh',/^o level/m.test(obj)&&/^v /m.test(obj)&&/^f [\d ]+$/m.test(obj),'len '+(obj||'').length);
    const vCount=(obj.match(/^v /gm)||[]).length, fCount=(obj.match(/^f /gm)||[]).length;
    check('OBJ has vertices and faces',vCount>0&&fCount>0,vCount+'v '+fCount+'f for '+count+' pieces');
    const json=await page.evaluate(()=>window.WLD_buildLevelJson&&window.WLD_buildLevelJson());
    let parsed=null; try{parsed=JSON.parse(json);}catch(e){}
    check('builds a valid level.json',parsed&&Array.isArray(parsed.pieces)&&parsed.pieces.length===count,json?('pieces '+(parsed&&parsed.pieces&&parsed.pieces.length)):'no json');
    const names=await page.evaluate(()=>window.WLD_methodNames&&window.WLD_methodNames());
    check('lists the used pieces',Array.isArray(names)&&names.length>0,JSON.stringify(names));

    await click('.wbs-tab[data-tab="debug"]');
    await click('#gmLog .err');
    await click('#gmOptions .wbs-dbg-opt');
    const dbg=await page.evaluate(()=>({correct:!!document.querySelector('#gmOptions .is-correct'),next:document.getElementById('gmNext').style.display}));
    check('debug accepts a correct fix',dbg.correct&&dbg.next!=='none');

    check('studio no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(base+'/workshops/world-builder-3d.html',{waitUntil:'load'});
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check('studio 390px no overflow',mob<=392,'scrollWidth '+mob);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
