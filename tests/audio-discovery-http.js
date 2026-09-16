const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=process.cwd();
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml'};
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const server=http.createServer((req,res)=>{
  let u=decodeURIComponent(new URL(req.url,'http://x').pathname);
  if(u==='/'||u==='/dev-tools')u='/pages/dev-tools.html';
  let f=path.join(root,u);
  if(!fs.existsSync(f)&&fs.existsSync(f+'.html'))f=f+'.html';
  if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);return res.end('missing '+u);}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const port=server.address().port;
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  const errors=[];
  try{
    const page=await browser.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(`http://127.0.0.1:${port}/dev-tools`,{waitUntil:'networkidle0'});
    const hub=await page.evaluate(()=>{
      const routes=[...document.querySelectorAll('.audio-route-card')].map(a=>({text:a.textContent.replace(/\s+/g,' ').trim(),href:a.getAttribute('href')}));
      const search=(q)=>{const input=document.getElementById('toolSearch');input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));return [...document.querySelectorAll('[data-tool-card]')].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.querySelector('.tool-title')?.textContent.trim());};
      return {routes,sfx:search('sfx'),drum:search('drum kit'),music:search('music'),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
    });
    check('hub has three audio route cards',hub.routes.length===3,JSON.stringify(hub.routes));
    check('hub routes link to SFX, Drum and Audio Studio',hub.routes.some(r=>r.href.includes('sfx-generator'))&&hub.routes.some(r=>r.href.includes('drum-pad'))&&hub.routes.some(r=>r.href.includes('sound-studio')));
    check('search finds SFX Generator',hub.sfx.includes('SFX Generator'),hub.sfx.join(', '));
    check('search finds Drum Pad by drum kit',hub.drum.includes('Drum Pad'),hub.drum.join(', '));
    check('search finds Audio Studio by music',hub.music.includes('Audio Studio'),hub.music.join(', '));
    check('hub mobile no overflow',hub.scrollWidth<=hub.clientWidth+2,`${hub.scrollWidth}/${hub.clientWidth}`);
    const pages=[['sfx','/tools/sfx-generator.html'],['drum','/tools/drum-pad.html'],['audio','/tools/sound-studio.html']];
    for(const [name,url] of pages){
      const p=await browser.newPage();
      const pageErrors=[];p.on('pageerror',e=>pageErrors.push(e.message));
      await p.setViewport({width:390,height:844,isMobile:true});
      await p.goto(`http://127.0.0.1:${port}${url}`,{waitUntil:'domcontentloaded'});
      await new Promise(r=>setTimeout(r,800));
      const data=await p.evaluate(()=>({text:document.body.textContent.replace(/\s+/g,' '),links:[...document.querySelectorAll('a')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')})),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
      check(`${name} page has clean audio cross-links`,data.links.some(a=>/SFX Generator|Drum Pad|Audio Studio|Sound Studio/.test(a.text)));
      check(`${name} page labels are searchable/clear`,/SFX|Drum|Audio|Music|kit|sound/i.test(data.text));
      check(`${name} mobile no overflow`,data.scrollWidth<=data.clientWidth+2,`${data.scrollWidth}/${data.clientWidth}`);
      check(`${name} zero runtime errors`,pageErrors.length===0,pageErrors.join(' | '));
      await p.close();
    }
    check('hub zero runtime errors',errors.length===0,errors.join(' | '));
  } finally { await browser.close(); server.close(); }
  if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);} console.log('\nALL AUDIO DISCOVERY CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});