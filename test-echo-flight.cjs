const http=require('http');const fs=require('fs');const path=require('path');
const port=8982;const root='F:/Website/Jvdesign-Website-v2';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split('?')[0]); if(u.endsWith('/')) u+='index.html';
  const f=path.join(root,u);
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404);return res.end('404');}
    res.writeHead(200,{'Content-Type':mime[path.extname(f).toLowerCase()]||'text/plain'});
    res.end(d);
  });
});
server.listen(port,async()=>{
  const puppeteer=require('puppeteer');
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  async function check(width){
    const page=await browser.newPage();
    await page.setViewport({width,height:900});
    const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto('http://localhost:'+port+'/games/echos-flight.html',{waitUntil:'load',timeout:15000});
    await new Promise(r=>setTimeout(r,1200));
    const info=await page.evaluate(()=>{
      const w=document.documentElement.scrollWidth, inner=window.innerWidth;
      const routeModal=document.getElementById('routeModal');
      const flightStrip=document.getElementById('flightStrip');
      const loadouts=document.getElementById('flightLoadouts');
      return {
        scrollWidth:w, innerWidth:inner, overflow:w>inner,
        routeModalExists:!!routeModal,
        routeModalRole:routeModal?routeModal.getAttribute('role'):null,
        flightStripText: flightStrip? flightStrip.textContent.slice(0,60):'',
        loadoutsCount: loadouts? loadouts.children.length:0,
        journal: document.getElementById('flightJournal')? document.getElementById('flightJournal').textContent.slice(0,80):'',
        startModal: document.getElementById('startModal')? getComputedStyle(document.getElementById('startModal')).display:''
      };
    });
    // test journal persistence
    await page.evaluate(()=>{localStorage.setItem('jvds_echo_expeditions_v1', JSON.stringify({bestGates:12,fish:5,routes:['reef','storm'],kit:'guard'}));});
    await page.reload({waitUntil:'load'});
    await new Promise(r=>setTimeout(r,1000));
    const after=await page.evaluate(()=>{
      try{return JSON.parse(localStorage.getItem('jvds_echo_expeditions_v1')||'{}');}catch{return {};}
    });
    // test keyboard trap
    await page.evaluate(()=>{ if(window.beginExpedition) beginExpedition(); });
    await new Promise(r=>setTimeout(r,500));
    const trap=await page.evaluate(()=>{
      const modal=document.getElementById('routeModal');
      // force open route modal
      if(window.openFlightRoutes) try{openFlightRoutes();}catch(e){}
      return document.getElementById('routeModal').classList.contains('show');
    });
    await page.close();
    return {width,info,after,trap,errs};
  }
  const r390=await check(390);
  const r1440=await check(1440);
  console.log(JSON.stringify({r390,r1440},null,2));
  await browser.close(); server.close();
});
