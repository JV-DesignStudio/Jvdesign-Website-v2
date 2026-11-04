const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='pages/dev-tools.html';
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff'};
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
    await page.goto(base+'/'+PAGE,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    await new Promise(r=>setTimeout(r,400));
    const m=await page.evaluate(()=>{
      const proj=document.querySelector('.hub-project');
      const links=[...document.querySelectorAll('.hub-project-step-link')];
      const altLink=document.querySelector('.hub-project-alt');
      const kicker=document.querySelector('.hub-project-kicker');
      const steps=document.querySelectorAll('.hub-project-step');
      const pixelLink=links.find(a=>a.href.includes('pixel-studio'));
      const soundLink=links.find(a=>a.href.includes('sound-studio'));
      const arcadeLink=links.find(a=>a.href.includes('arcade-game-maker'));
      const times=[...document.querySelectorAll('.hub-project-step-time')].map(el=>el.textContent.trim());
      const sw=document.documentElement.scrollWidth;
      const dashes=(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length;
      return {
        present:!!proj,
        stepCount:steps.length,
        hasPixelLink:!!pixelLink,
        hasSoundLink:!!soundLink,
        hasArcadeLink:!!arcadeLink,
        altLinkText:altLink?altLink.textContent.trim():null,
        kickerText:kicker?kicker.textContent.trim():null,
        timesCount:times.filter(t=>t.includes('min')).length,
        sw,dashes
      };
    });
    check(PAGE+': hub-project section present',m.present);
    check(PAGE+': shows 3 steps',m.stepCount===3,'found '+m.stepCount);
    check(PAGE+': links to Pixel Studio',m.hasPixelLink);
    check(PAGE+': links to Audio Studio',m.hasSoundLink);
    check(PAGE+': links to Arcade Game Maker',m.hasArcadeLink);
    check(PAGE+': has browse-all fallback link',!!m.altLinkText,'text: '+m.altLinkText);
    check(PAGE+': all steps show time estimate',m.timesCount===3,'found '+m.timesCount);
    check(PAGE+': no dashes',m.dashes===0,'dashes '+m.dashes);
    check(PAGE+': desktop no overflow',m.sw<=1442,m.sw+'');
    check(PAGE+': no browser errors',errors.length===0,errors.slice(0,2).join(' | '));
    await page.setViewport({width:390,height:844,isMobile:true});
    await page.reload({waitUntil:'load'});
    await new Promise(r=>setTimeout(r,400));
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(PAGE+': 390px no overflow',mob<=392,'scrollWidth '+mob);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
