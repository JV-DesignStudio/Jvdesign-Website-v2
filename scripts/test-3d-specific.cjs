const puppeteer=require('puppeteer'), http=require('http'), fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  let p=path.join(root, decodeURIComponent(req.url.split('?')[0])); if(!path.extname(p)) p=path.join(p,'index.html');
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css'}; res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'}); res.end(d);});
});
(async()=>{
  await new Promise(r=>server.listen(8988,r));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const urls=['/workshops/rocket-builder.html','/workshops/pirate-ship-builder.html','/workshops/steampunk-airship-builder.html','/workshops/pirate-cannon-builder.html'];
  for(const u of urls){
    const errs=[]; page.removeAllListeners('pageerror'); page.removeAllListeners('console');
    page.on('pageerror',e=>errs.push('pageerror:'+e.message));
    page.on('console',m=>{if(m.type()==='error') errs.push('console:'+m.text())});
    console.log('---',u);
    await page.goto('http://127.0.0.1:8988'+u,{waitUntil:'domcontentloaded',timeout:15000});
    await new Promise(r=>setTimeout(r,2500));
    const hasThree=await page.evaluate(()=>typeof THREE!=='undefined');
    const hasCanvas=await page.evaluate(()=>!!document.querySelector('canvas'));
    const bodyText=await page.evaluate(()=>document.body.innerText.slice(0,300));
    console.log(' THREE',hasThree,' canvas',hasCanvas,' errs',errs.slice(0,5));
    console.log(' body snippet',bodyText.slice(0,200).replace(/\n/g,' '));
    const content=await page.content();
    const hasErrorBanner=content.includes('THREE is not defined') || content.includes('Failed to load');
    console.log(' hasErrorBanner',hasErrorBanner);
  }
  await browser.close(); server.close();
})();
