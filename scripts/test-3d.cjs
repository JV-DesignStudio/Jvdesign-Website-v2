
const puppeteer=require('puppeteer'), http=require('http'), fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  let p=path.join(root, decodeURIComponent(req.url.split('?')[0])); if(!path.extname(p)) p=path.join(p,'index.html');
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css'}; res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'}); res.end(d);});
});
(async()=>{
  await new Promise(r=>server.listen(8987,r));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push('pageerror:'+e.message)); page.on('console',m=>{if(m.type()==='error') errs.push('console:'+m.text())});
  const urls=['/workshops/castle-builder.html','/workshops/fairy-tale-builder.html','/workshops/phone-stand-builder.html','/workshops/rocket-builder.html','/tools/buildlab.html'];
  for(const u of urls){
    errs.length=0;
    console.log('---',u);
    await page.goto('http://127.0.0.1:8987'+u,{waitUntil:'domcontentloaded',timeout:15000});
    await new Promise(r=>setTimeout(r,2000));
    const hasThree=await page.evaluate(()=>typeof THREE!=='undefined');
    const hasCanvas=await page.evaluate(()=>!!document.querySelector('canvas'));
    console.log(' THREE',hasThree,' canvas',hasCanvas,' errs',errs.slice(0,3));
    const html=await page.content();
    console.log(' title',await page.title());
  }
  await browser.close(); server.close();
})();
