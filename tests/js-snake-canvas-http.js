const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='js-snake-canvas.html';
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

    // Click Start building to render the step cards
    const startBtn=await page.$('[data-action="start"], button');
    const btns=await page.$$('button');
    for(const b of btns){
      const t=await b.evaluate(el=>el.textContent);
      if(t&&t.includes('Start building')){await b.click();break;}
    }
    await new Promise(r=>setTimeout(r,400));

    const m=await page.evaluate(()=>{
      // Fresh state: no Show Solution on load (attempts=0 for all steps)
      const showOnLoad=document.querySelectorAll('[data-cw="showSolution"]').length;
      const applyBtns=document.querySelectorAll('[data-cw="checkStep"]').length;
      // Simulate 2 fails on step 1
      const ed=document.getElementById('editor-1');
      if(ed) ed.value='wrong code that wont match checks';
      if(window.CW){CW.checkStep(1);CW.checkStep(1);}
      const showAfter2=document.querySelectorAll('[data-cw="showSolution"]').length;
      // Check localStorage persistence
      let stored={};
      try{stored=JSON.parse(localStorage.getItem('jvds-js-snake-canvas')||'{}');}catch(e){}
      const attemptsStored=stored.attempts&&stored.attempts[1]>=2;
      // Click Show Solution and verify solutionSeen
      const btn=document.querySelector('[data-cw="showSolution"]');
      if(btn)btn.click();
      let stored2={};
      try{stored2=JSON.parse(localStorage.getItem('jvds-js-snake-canvas')||'{}');}catch(e){}
      const solutionSeenStored=!!(stored2.solutionSeen&&stored2.solutionSeen[1]);
      const dashes=(document.body.innerText.match(/[–—]/g)||[]).length;
      const sw=document.documentElement.scrollWidth;
      return {showOnLoad,applyBtns,showAfter2,attemptsStored,solutionSeenStored,dashes,sw};
    });
    check(PAGE+': no Show Solution on fresh load',m.showOnLoad===0,'found '+m.showOnLoad);
    check(PAGE+': Apply buttons present',m.applyBtns>=1,'found '+m.applyBtns);
    check(PAGE+': Show Solution appears after 2 fails',m.showAfter2>=1,'found '+m.showAfter2);
    check(PAGE+': attempts persisted to localStorage',m.attemptsStored);
    check(PAGE+': solutionSeen persisted to localStorage',m.solutionSeenStored);
    check(PAGE+': no dashes',m.dashes===0,'dashes '+m.dashes);
    check(PAGE+': desktop no overflow',m.sw<=1442,m.sw+'');
    check(PAGE+': no browser errors',errors.length===0,errors.slice(0,2).join(' | '));
    await page.setViewport({width:390,height:844,isMobile:true});
    await page.reload({waitUntil:'load'});
    await new Promise(r=>setTimeout(r,600));
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check(PAGE+': 390px no overflow',mob<=392,'scrollWidth '+mob);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
