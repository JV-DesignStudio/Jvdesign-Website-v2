const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/blender-workshop.html';
const ZIP='/blender-beginners-starter.zip';
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
    await page.goto(base+PAGE,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    const info=await page.evaluate(()=>{
      const links=[...document.querySelectorAll('a')].filter(a=>(a.getAttribute('href')||'').includes('blender-beginners-starter.zip'));
      return {
        links:links.map(a=>({href:a.getAttribute('href'),download:a.getAttribute('download'),text:a.textContent.trim(),visible:!!a.getClientRects().length})),
        banner:!!document.querySelector('.starter-banner'),
        bannerText:(document.querySelector('.starter-banner')||{}).textContent||'',
        steps:document.querySelectorAll('.step-card').length,
        count:(document.getElementById('progressCount')||{}).textContent||'',
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('hero and banner link to the starter zip',info.links.length===2,JSON.stringify(info.links.map(l=>l.text)));
    check('both links are plain relative zip hrefs',info.links.every(l=>l.href==='../blender-beginners-starter.zip'));
    check('both links carry the download attribute',info.links.every(l=>l.download===''));
    check('links labelled Starter Template and Download Free',info.links.some(l=>/Starter Template/.test(l.text))&&info.links.some(l=>/Download Free/.test(l.text)));
    check('starter banner is on the page',info.banner&&/finished snowman/.test(info.bannerText));
    check('workshop steps still present',info.steps>=9,'steps '+info.steps);
    check('progress counter still reads 0 / 9 steps',/0 \/ 9 steps/.test(info.count),info.count);
    check('page has no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1440+2,info.scrollWidth+'');
    const zipRes=await fetch(base+ZIP);
    check('starter zip returns 200',zipRes.status===200,'status '+zipRes.status);
    const buf=Buffer.from(await zipRes.arrayBuffer());
    check('starter zip is a real zip over http',buf.length>10000&&buf[0]===0x50&&buf[1]===0x4b,'bytes '+buf.length);
    const body=buf.toString('latin1');
    for(const entry of ['BlenderBeginnersStarter/README.md','BlenderBeginnersStarter/CHECKLIST.md','BlenderBeginnersStarter/reference/finished-snowman.obj','BlenderBeginnersStarter/reference/finished-snowman.mtl','BlenderBeginnersStarter/reference/practice-cube.obj','BlenderBeginnersStarter/scripts/01_interface_and_view.py','BlenderBeginnersStarter/scripts/06_snowman_builder.py','BlenderBeginnersStarter/scripts/08_keyframe_spin.py']){
      check('zip contains '+entry,body.includes(entry));
    }
    check('zip top-level folder keeps the starter self contained',body.startsWith('PK')&&body.includes('BlenderBeginnersStarter/'));
    for(const width of [390,320]){
      await page.setViewport({width,height:844,isMobile:true});
      await page.goto(base+PAGE,{waitUntil:'load'});
      const over=await page.evaluate(()=>document.documentElement.scrollWidth);
      check('no overflow at '+width+'px',over<=width+2,over+'');
    }
    check('zero runtime errors',errors.length===0,errors.join(' | '));
  }finally{await browser.close();server.close();}
  if(failures){console.log('\n'+failures+' FAILURE(S)');process.exit(1);}
  console.log('\nALL BLENDER WORKSHOP CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
