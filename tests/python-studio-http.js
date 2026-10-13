/* Python Studio checks.
   1. Node: verify every project builds as a runnable Pygame program (main.py
      imports pygame, has the game loop, flips the display) plus a README and
      requirements file, and the zip writer works. Works because
      workshops/python-studio.js exports a small node API.
   2. Browser: the studio loads, each of the five games renders its inspector,
      the live preview runs with no console errors, and export downloads. */
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const GAMES=['catch','dodge','maze','breakout','platformer'];

// ---- 1. Node structural checks ----
const ps=require(path.join(root,'workshops','python-studio.js'));
check('five games are defined',GAMES.every(g=>ps.GAMES[g]),Object.keys(ps.GAMES).join(','));
GAMES.forEach(function(id){
  const g=ps.GAMES[id], v=ps.defaultsFor(id);
  const files=ps.projectFiles(id,v,'test-game');
  const names=files.map(f=>f.name);
  check(id+': project has main.py, README and requirements',names.indexOf('main.py')>-1&&names.indexOf('README.md')>-1&&names.indexOf('requirements.txt')>-1,names.join(','));
  const py=files.find(f=>f.name==='main.py').text;
  check(id+': main.py imports pygame',py.indexOf('import pygame')>-1);
  check(id+': main.py inits pygame and loops',py.indexOf('pygame.init()')>-1&&py.indexOf('while True:')>-1);
  check(id+': main.py flips the display and ticks',py.indexOf('pygame.display.flip()')>-1&&py.indexOf('clock.tick')>-1);
  check(id+': main.py has no em or en dashes',!/[\u2013\u2014]/.test(py),'');
  check(id+': main.py is a real size',py.length>400,'len '+py.length);
  check(id+': has fields to tune',g.fields.length>=2,'fields '+g.fields.length);
  const readme=files.find(f=>f.name==='README.md').text;
  check(id+': readme explains how to run it',/pip install pygame/.test(readme)&&/python main\.py/.test(readme));
});
check('hex converts to an rgb tuple',ps.hexToTuple('#06d6a0')==='(6, 214, 160)',ps.hexToTuple('#06d6a0'));
const enc=new TextEncoder();
const zip=ps.makeZip([{name:'main.py',data:enc.encode('import pygame')},{name:'README.md',data:enc.encode('hi')}]);
check('zip starts with the PK signature',zip[0]===0x50&&zip[1]===0x4b&&zip[2]===0x03&&zip[3]===0x04);
check('zip is non-trivial size',zip.length>100,'len '+zip.length);

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

    errors.length=0;
    await page.goto(base+'/workshops/python-studio.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const shell=await page.evaluate(()=>({games:document.querySelectorAll('.py-game-btn').length,tabs:document.querySelectorAll('.py-tab').length,download:!!document.getElementById('pyDownload'),play:!!document.getElementById('pyPlay')}));
    check('studio lists five games',shell.games===5,'found '+shell.games);
    check('studio has four sections',shell.tabs===4,'tabs '+shell.tabs);
    check('export + play canvas present',shell.download&&shell.play);

    // A1511: live code editing + drag and drop world
    errors.length=0;
    const le=await page.evaluate(()=>{
      const ta=document.getElementById('pyCodeEdit'),LE=window.JVDSLiveEdit;
      const inp=document.querySelector('#pyInspector input[type=number],#pyInspector input[type=range]');
      const out={helper:!!LE,len:ta?ta.value.length:0,made:null};
      if(ta&&LE&&inp){ta.value=ta.value+'\n'+inp.id+' = '+(inp.value||'0');document.getElementById('pyCodeApply').click();out.made=document.getElementById('pyCodeMsg').textContent;}
      return out;
    });
    check('liveedit helper + code box populated',le.helper&&le.len>20,'len '+le.len);
    check('Apply numbers updates the preview',!!le.made&&/updated/i.test(le.made),JSON.stringify(le.made||'').slice(0,50));
    const wb=await page.evaluate(()=>document.getElementById('pyWorldMsg').textContent);
    const wa=await page.evaluate(()=>{const cv=document.getElementById('pyWorld'),r=cv.getBoundingClientRect(),at={bubbles:true,cancelable:true,clientX:r.left+r.width*0.85,clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse',buttons:1};['pointerdown','pointermove','pointerup'].forEach(t=>cv.dispatchEvent(new PointerEvent(t,at)));return document.getElementById('pyWorldMsg').textContent;});
    check('drag places the player in the world',wb!==wa,JSON.stringify({wb,wa}).slice(0,80));
    check('no errors during liveedit',errors.length===0,errors.slice(0,2).join(' | '));

    for(const g of GAMES){
      errors.length=0;
      const info=await page.evaluate((id)=>{
        document.querySelector('.py-game-btn[data-game="'+id+'"]').click();
        document.querySelector('.py-tab[data-tab="tune"]').click();
        return {fields:document.querySelectorAll('#pyInspector input').length,blurb:(document.getElementById('pyBlurb').textContent||'').length};
      },g);
      check(g+': inspector renders fields',info.fields>=2,'fields '+info.fields);
      check(g+': has a description',info.blurb>20,'len '+info.blurb);

      await page.evaluate(()=>document.querySelector('.py-tab[data-tab="play"]').click());
      await new Promise(r=>setTimeout(r,500));
      check(g+': no errors while playing',errors.length===0,errors.slice(0,2).join(' | '));

      errors.length=0;
      const code=await page.evaluate(()=>{document.querySelector('.py-tab[data-tab="export"]').click();return (document.getElementById('pyCode').textContent||'').length;});
      check(g+': python code preview is shown',code>400,'len '+code);

      errors.length=0;
      await page.evaluate(()=>document.getElementById('pyDownload').click());
      await new Promise(r=>setTimeout(r,200));
      const msg=await page.evaluate(()=>document.getElementById('pyMsg').textContent||'');
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
