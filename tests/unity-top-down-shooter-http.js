const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='unity-top-down-shooter.html';
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
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});
    await page.goto(base+'/workshops/'+PAGE,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    await new Promise(r=>setTimeout(r,600));
    const m=await page.evaluate(()=>({
      quizzes:document.querySelectorAll('.quiz-gate').length,
      canvas:!!document.querySelector('canvas'),
      finish:!!document.getElementById('finishBanner'),
      engine:window.WORKSHOP_KEY==='jvds-unity-top-down-v2',
      progressLink:document.querySelectorAll('a[href*="my-progress.html"]').length,
      release:!!document.querySelector('.ws-release'),
      wsFinish:!!document.querySelector('.ws-finish'),
      noInlineRelease:!document.querySelector('.ws-release [style]'),
      noInlineFinish:!document.querySelector('.ws-finish[style]'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check(PAGE+': has knowledge checks',m.quizzes>=1,'quizzes '+m.quizzes);
    check(PAGE+': live canvas present',m.canvas);
    check(PAGE+': finish banner present',m.finish);
    check(PAGE+': engine key set',m.engine);
    check(PAGE+': links to My Progress',m.progressLink>=1,'links '+m.progressLink);
    check(PAGE+': ws-release section present',m.release);
    check(PAGE+': ws-finish section present',m.wsFinish);
    check(PAGE+': ws-release has no inline styles',m.noInlineRelease);
    check(PAGE+': ws-finish container has no inline style',m.noInlineFinish);
    check(PAGE+': no dashes',m.dashes===0,'dashes '+m.dashes);
    check(PAGE+': desktop no overflow',m.sw<=1442,m.sw+'');
    check(PAGE+': no browser errors',errors.length===0,errors.slice(0,2).join(' | '));
    await page.setViewport({width:390,height:844,isMobile:true});
    await page.reload({waitUntil:'load'});
    await new Promise(r=>setTimeout(r,600));
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(PAGE+': 390px no overflow',mob<=392,'scrollWidth '+mob);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
