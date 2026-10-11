/* PICO-8 Studio checks.
   1. Node: verify every cart builds as real .p8 text (header, __lua__, _init,
      _update, _draw) and the zip writer produces a valid archive. Works because
      workshops/pico8-studio.js exports a small node API.
   2. Browser: the studio loads, each of the six games renders its inspector,
      the live preview runs with no console errors, and export downloads. */
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const GAMES=['pong','snake','platformer','shooter','dungeon','match3'];

// ---- 1. Node structural checks ----
const ps=require(path.join(root,'workshops','pico8-studio.js'));
check('palette has 16 colours',ps.PALETTE.length===16,'p '+ps.PALETTE.length);
check('six games are defined',GAMES.every(g=>ps.GAMES[g]),Object.keys(ps.GAMES).join(','));
GAMES.forEach(function(id){
  const g=ps.GAMES[id], v=ps.defaultsFor(id);
  const cart=ps.buildCart(id,v,'test cart');
  check(id+': cart has the pico-8 header',/^pico-8 cartridge/.test(cart));
  check(id+': cart has a __lua__ section',cart.indexOf('__lua__')>-1);
  check(id+': lua has _init, _update and _draw',cart.indexOf('function _init')>-1&&cart.indexOf('function _update')>-1&&cart.indexOf('function _draw')>-1);
  check(id+': cart has no em or en dashes',!/[\u2013\u2014]/.test(cart),'');
  check(id+': cart is a real size',cart.length>300,'len '+cart.length);
  check(id+': has fields to tune',g.fields.length>=2,'fields '+g.fields.length);
  const readme=ps.buildReadme(id,v,'test cart');
  check(id+': readme explains how to open the cart',/PICO-8/.test(readme)&&/\.p8/.test(readme));
});
const enc=new TextEncoder();
const zip=ps.makeZip([{name:'a.p8',data:enc.encode('pico-8')},{name:'READ_ME.txt',data:enc.encode('hello')}]);
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
    await page.goto(base+'/workshops/pico8-studio.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const shell=await page.evaluate(()=>({games:document.querySelectorAll('.ps-game-btn').length,tabs:document.querySelectorAll('.ps-tab').length,download:!!document.getElementById('psDownload'),play:!!document.getElementById('psPlay'),pal:document.querySelectorAll('#psPalette .ps-sw').length}));
    check('studio lists six games',shell.games===6,'found '+shell.games);
    check('studio has four sections',shell.tabs===4,'tabs '+shell.tabs);
    check('export + play canvas present',shell.download&&shell.play);
    check('palette shows all 16 colours',shell.pal===16,'swatches '+shell.pal);

    for(const g of GAMES){
      errors.length=0;
      const info=await page.evaluate((id)=>{
        document.querySelector('.ps-game-btn[data-game="'+id+'"]').click();
        document.querySelector('.ps-tab[data-tab="tune"]').click();
        return {fields:document.querySelectorAll('#psInspector input, #psInspector select').length,blurb:(document.getElementById('psBlurb').textContent||'').length};
      },g);
      check(g+': inspector renders fields',info.fields>=2,'fields '+info.fields);
      check(g+': has a description',info.blurb>20,'len '+info.blurb);

      await page.evaluate(()=>document.querySelector('.ps-tab[data-tab="play"]').click());
      await new Promise(r=>setTimeout(r,500));
      check(g+': no errors while playing',errors.length===0,errors.slice(0,2).join(' | '));

      errors.length=0;
      const code=await page.evaluate(()=>{document.querySelector('.ps-tab[data-tab="export"]').click();return (document.getElementById('psCode').textContent||'').length;});
      check(g+': cart code preview is shown',code>300,'len '+code);

      errors.length=0;
      await page.evaluate(()=>document.getElementById('psDownload').click());
      await new Promise(r=>setTimeout(r,200));
      const msg=await page.evaluate(()=>document.getElementById('psMsg').textContent||'');
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
