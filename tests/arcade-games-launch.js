// arcade-games-launch.js (A1419): every public arcade catalogue card must launch
// and be playable. Loads each game in games-registry.js and fails if a card
// errors, is a placeholder, or has no interactive surface.
//
// Run: node tests/arcade-games-launch.js
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const u=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const f=path.join(root,u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('missing '+u);}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});

// Parse the registry (window.JVDS_GAMES).
const window={};
eval(fs.readFileSync(path.join(root,'games-registry.js'),'utf8'));
const games=window.JVDS_GAMES||[];

(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  try{
    check('registry has public games',games.length>0,games.length+' games');
    for(const g of games){
      check('card file exists: '+g.id,fs.existsSync(path.join(root,'games',g.file)),g.file);
    }

    const page=await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request',r=>{const u=r.url();(u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:'))?r.continue():r.abort();});

    for(const g of games){
      const errors=[];
      page.removeAllListeners('pageerror');
      page.on('pageerror',e=>errors.push(e.message));
      let status=0;
      page.removeAllListeners('response');
      page.on('response',r=>{ if(r.url().endsWith('/'+g.file)) status=r.status(); });
      await page.setViewport({width:1280,height:900});
      await page.goto(base+'/games/'+g.file,{waitUntil:'load'});
      await new Promise(r=>setTimeout(r,900));
      const info=await page.evaluate(()=>({
        canvas:document.querySelectorAll('canvas').length,
        buttons:document.querySelectorAll('button,[role="button"],a.btn,.btn').length,
        title:(document.title||'').trim(),
        body:(document.body.innerText||'').trim().length
      }));
      check(g.id+': page responds 200',status===0||status===200,'status '+status);
      check(g.id+': has a title',info.title.length>3,info.title.slice(0,40));
      check(g.id+': has an interactive surface',info.canvas>0||info.buttons>0,'canvas '+info.canvas+' buttons '+info.buttons);
      check(g.id+': has content',info.body>50,'chars '+info.body);
      check(g.id+': no page errors',errors.length===0,errors.slice(0,2).join(' | '));
    }

    // The arcade links every card to a real file
    await page.goto(base+'/arcade.html',{waitUntil:'load'});
    await new Promise(r=>setTimeout(r,700));
    const arc=await page.evaluate(()=>({
      cabs:document.querySelectorAll('#grid .cab').length,
      hrefs:[...document.querySelectorAll('#grid .cab')].map(a=>a.getAttribute('href'))
    }));
    check('arcade renders every card',arc.cabs===games.length,arc.cabs+' vs '+games.length);
    const missing=arc.hrefs.filter(h=>!h||!fs.existsSync(path.join(root,h.replace(/^\.\.\//,''))));
    check('every arcade card links a real game file',missing.length===0,missing.join(', '));
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
