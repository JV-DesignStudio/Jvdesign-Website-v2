/* Browser checks for the multi-game Unity Studio (workshops/unity-studio.html).
   For every game mode: check the inspector renders, the live play preview runs
   without console errors, and the Unity export downloads. Plus hub link and
   responsive checks. */
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const GAMES=['platformer','pong','breakout','shooter','rpg','ui','multiplayer'];
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
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

    // Hub links the studio
    await page.goto(base+'/workshops/my-first-unity-game.html',{waitUntil:'load'});
    check('Unity hub links the studio',await page.evaluate(()=>!!document.querySelector('a[href="unity-studio.html"]')));

    errors.length=0;
    await page.goto(base+'/workshops/unity-studio.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const shell=await page.evaluate(()=>({games:document.querySelectorAll('.us-game-btn').length,tabs:document.querySelectorAll('.us-tab').length,download:!!document.getElementById('xDownload')}));
    check('studio lists seven games',shell.games===7,'found '+shell.games);
    check('studio has four sections',shell.tabs===4,'tabs '+shell.tabs);
    check('export button present',shell.download);

    for(const g of GAMES){
      errors.length=0;
      const info=await page.evaluate((id)=>{
        document.querySelector('.us-game-btn[data-game="'+id+'"]').click();
        return {fields:document.querySelectorAll('#usInspector input').length,blurb:(document.getElementById('usGameBlurb').textContent||'').length};
      },g);
      check(g+': inspector renders fields',info.fields>=2,'fields '+info.fields);
      check(g+': has a description',info.blurb>20,'len '+info.blurb);

      // play
      await page.evaluate(()=>document.querySelector('.us-tab[data-tab="play"]').click());
      await page.keyboard.down('ArrowRight'); await new Promise(r=>setTimeout(r,350)); await page.keyboard.up('ArrowRight');
      await page.keyboard.press('Space'); await new Promise(r=>setTimeout(r,350));
      const hud=await page.evaluate(()=>(document.getElementById('usHud').textContent||'').trim());
      check(g+': play HUD is live',hud.length>0,hud.slice(0,40));
      check(g+': no errors while playing',errors.length===0,errors.slice(0,2).join(' | '));

      // export
      errors.length=0;
      await page.evaluate(()=>{document.querySelector('.us-tab[data-tab="export"]').click();document.getElementById('xDownload').click();});
      await new Promise(r=>setTimeout(r,300));
      const msg=await page.evaluate(()=>document.getElementById('usMsg').textContent||'');
      check(g+': export reports a download',/Downloaded/.test(msg),msg.slice(0,50));
      check(g+': no errors on export',errors.length===0,errors.slice(0,2).join(' | '));
    }

    // dashes + mobile
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
