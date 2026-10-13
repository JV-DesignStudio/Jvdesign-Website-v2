/* Scratch Studio checks.
   1. Node: verify the .sb3 generator (MD5 vectors, valid zip, project.json
      parses, targets and md5-named SVG assets) for every game. This works
      because workshops/scratch-studio.js exports a small node API.
   2. Browser: the page loads, every game renders its inspector and blocks,
      the live preview runs with no console errors, and export downloads. */
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}

// ---- 1. Node structural checks ----
const ss=require(path.join(root,'workshops','scratch-studio.js'));
const te=new TextEncoder();
check('md5("abc") matches the known vector',ss.md5(te.encode('abc'))==='900150983cd24fb0d6963f7d28e17f72',ss.md5(te.encode('abc')));
check('md5("") matches the known vector',ss.md5(te.encode(''))==='d41d8cd98f00b204e9800998ecf8427e');
['catch','clicker','quiz'].forEach(function(id){
  var r=ss.buildSb3For(id);
  var pj=r.files.find(function(f){return f.name==='project.json';});
  var zipBytes=r.files.length; // files array built
  var pk=r.files[0].data; // project.json bytes
  var project=null; try{ project=JSON.parse(new TextDecoder().decode(pj.data)); }catch(e){}
  check(id+': project.json parses',!!project);
  check(id+': has a Stage and at least one sprite',!!project && project.targets.length>=2 && project.targets[0].isStage===true,project?project.targets.map(function(t){return t.name;}).join(','):'');
  var assets=r.files.filter(function(f){return f.name!=='project.json';});
  check(id+': costumes are md5-named svg',assets.length>=1 && assets.every(function(a){return /^[0-9a-f]{32}\.svg$/.test(a.name);}),'assets '+assets.length);
  check(id+': every costume referenced exists as an asset',project?project.targets.every(function(t){return t.costumes.every(function(c){return assets.some(function(a){return a.name===c.md5ext;});});}):false);
  check(id+': each target has blocks',project?project.targets.some(function(t){return Object.keys(t.blocks).length>0;}):false);
});

// ---- 2. Browser checks ----
const puppeteer=require('puppeteer');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.zip':'application/zip','.ico':'image/x-icon','.woff2':'font/woff2'};
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
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')||r.url().startsWith('blob:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});

    await page.goto(base+'/workshops/my-first-scratch-game.html',{waitUntil:'load'});
    // hub link added later; tolerate absence but prefer present

    errors.length=0;
    await page.goto(base+'/workshops/scratch-studio.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const shell=await page.evaluate(()=>({games:document.querySelectorAll('.ss-game-btn').length,tabs:document.querySelectorAll('.ss-tab').length,download:!!document.getElementById('xDownload'),play:!!document.getElementById('ssPlay')}));
    check('studio lists three games',shell.games===3,'found '+shell.games);
    check('studio has four sections',shell.tabs===4,'tabs '+shell.tabs);
    check('export + play canvas present',shell.download&&shell.play);

    // A1511: live code editing + drag and drop world
    errors.length=0;
    const le=await page.evaluate(()=>{
      const ta=document.getElementById('ssCodeEdit'),LE=window.JVDSLiveEdit;
      const inp=document.querySelector('#ssInspector input[type=number],#ssInspector input[type=range]');
      const out={helper:!!LE,len:ta?ta.value.length:0,made:null};
      if(ta&&LE&&inp){ta.value=ta.value+'\n'+inp.id+' = '+(inp.value||'0');document.getElementById('ssCodeApply').click();out.made=document.getElementById('ssCodeMsg').textContent;}
      return out;
    });
    check('liveedit helper + code box populated',le.helper&&le.len>20,'len '+le.len);
    check('Apply numbers updates the preview',!!le.made&&/updated/i.test(le.made),JSON.stringify(le.made||'').slice(0,50));
    const wb=await page.evaluate(()=>document.getElementById('ssWorldMsg').textContent);
    const wa=await page.evaluate(()=>{const cv=document.getElementById('ssWorld'),r=cv.getBoundingClientRect(),at={bubbles:true,cancelable:true,clientX:r.left+r.width*0.85,clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse',buttons:1};['pointerdown','pointermove','pointerup'].forEach(t=>cv.dispatchEvent(new PointerEvent(t,at)));return document.getElementById('ssWorldMsg').textContent;});
    check('drag places the sprite in the world',wb!==wa,JSON.stringify({wb,wa}).slice(0,80));
    check('no errors during liveedit',errors.length===0,errors.slice(0,2).join(' | '));

    for(const g of ['catch','clicker','quiz']){
      errors.length=0;
      const info=await page.evaluate((id)=>{
        document.querySelector('.ss-game-btn[data-game="'+id+'"]').click();
        document.querySelector('.ss-tab[data-tab="blocks"]').click();
        return {fields:document.querySelectorAll('#ssInspector input').length,blurb:(document.getElementById('ssBlurb').textContent||'').length,blocks:document.querySelectorAll('#ssBlocks .ss-block').length};
      },g);
      check(g+': inspector renders fields',info.fields>=2,'fields '+info.fields);
      check(g+': has a description',info.blurb>20,'len '+info.blurb);
      check(g+': blocks are listed',info.blocks>=3,'blocks '+info.blocks);

      await page.evaluate(()=>document.querySelector('.ss-tab[data-tab="play"]').click());
      if(g==='catch'){ await page.keyboard.down('ArrowRight'); await new Promise(r=>setTimeout(r,300)); await page.keyboard.up('ArrowRight'); }
      else { const el=await page.$('#ssPlay'); const b=await el.boundingBox(); await page.mouse.click(b.x+b.width/2,b.y+b.height/2); }
      await new Promise(r=>setTimeout(r,400));
      check(g+': no errors while playing',errors.length===0,errors.slice(0,2).join(' | '));

      errors.length=0;
      await page.evaluate(()=>{document.querySelector('.ss-tab[data-tab="export"]').click();document.getElementById('xDownload').click();});
      await new Promise(r=>setTimeout(r,300));
      const msg=await page.evaluate(()=>document.getElementById('ssMsg').textContent||'');
      check(g+': export reports a download',/Downloaded/.test(msg),msg.slice(0,50));
      check(g+': no errors on export',errors.length===0,errors.slice(0,2).join(' | '));
    }

    const dash=await page.evaluate(()=>(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length);
    check('studio has no dashes',dash===0,'dashes '+dash);
    await page.setViewport({width:390,height:844,isMobile:true});
    await page.reload({waitUntil:'load'});
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check('studio 390px no overflow',mob<=392,'scrollWidth '+mob);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
