const puppeteer=require('puppeteer'), http=require('http'), fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  let p=path.join(root, decodeURIComponent(req.url.split('?')[0])); if(!path.extname(p)) p=path.join(p,'index.html');
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css'}; res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'}); res.end(d);});
});
(async()=>{
  await new Promise(r=>server.listen(8989,r));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const urls=['/workshops/rocket-builder.html','/workshops/pirate-ship-builder.html','/workshops/steampunk-airship-builder.html'];
  for(const u of urls){
    const errs=[]; page.removeAllListeners('pageerror'); page.removeAllListeners('console');
    page.on('pageerror',e=>errs.push('pageerror:'+e.message));
    page.on('console',m=>{if(m.type()==='error') errs.push('console:'+m.text())});
    console.log('---',u);
    await page.goto('http://127.0.0.1:8989'+u,{waitUntil:'domcontentloaded',timeout:15000});
    await new Promise(r=>setTimeout(r,3500));
    const hasThree=await page.evaluate(()=>typeof THREE!=='undefined');
    const hasCanvas=await page.evaluate(()=>!!document.querySelector('canvas'));
    const shipChildren=await page.evaluate(()=>{
      try{
        if(typeof shipGroup!=='undefined' && shipGroup) return shipGroup.children.length;
        if(typeof rocketGroup!=='undefined' && rocketGroup) return rocketGroup.children.length;
        if(typeof airshipGroup!=='undefined' && airshipGroup) return airshipGroup.children.length;
        return 'no group';
      }catch(e){ return 'error:'+e.message}
    });
    const canvasPixels=await page.evaluate(()=>{
      const c=document.querySelector('canvas');
      if(!c) return 0;
      try{
        const ctx=c.getContext('2d')||c.getContext('webgl')||c.getContext('webgl2');
        return c.width+'x'+c.height;
      }catch(e){ return 'err'}
    });
    console.log(' THREE',hasThree,' canvas',hasCanvas,' shipChildren',shipChildren,' canvasSize',canvasPixels,' errs',errs.slice(0,3));
  }
  await browser.close(); server.close();
})();
