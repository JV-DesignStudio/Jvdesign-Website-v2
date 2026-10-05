const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');const puppeteer=require(ROOT+'/node_modules/puppeteer');const results=[];const OUT=process.env.ARCADE_QA_OUT||path.join(require('os').tmpdir(),'jvds-arcade-qa');fs.mkdirSync(OUT,{recursive:true});
const server=http.createServer((req,res)=>{const p=path.resolve(ROOT,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}fs.readFile(p,(err,buf)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(p)]||'application/octet-stream');res.end(buf);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')||r.url().startsWith('data:')?r.continue():r.abort());
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});const url='http://127.0.0.1:'+server.address().port+'/games/echos-flight.html';await page.goto(url,{waitUntil:'networkidle0'});
 async function check(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL '+name+': '+e.message);}}
 await check('Five lagoon levels and gate mission',async()=>assert(await page.evaluate(()=>document.querySelectorAll('#levelMap button').length===5&&/gate/i.test(document.getElementById('missionTitle').textContent))));
 await page.screenshot({path:path.join(OUT,'flight-hangar.png')});
 await check('Starting swim resets run with gates',async()=>{assert(await page.evaluate(()=>{start();playing=false;dead=false;reset();return gates.length===5&&passed===0&&score===0&&!!echo&&document.getElementById('gateVal').textContent.includes('/');}));});
 await check('Swim gives upward velocity',async()=>{assert(await page.evaluate(()=>{reset();playing=true;dead=false;echo.vy=0;swim();return echo.vy<0;}));});
 await check('Gates drift left while swimming',async()=>{assert(await page.evaluate(()=>{reset();playing=true;dead=false;const x=gates[0].x;step(0.016);return gates[0].x<x;}));});
 await check('Clearing a lagoon banks stars and progress',async()=>{assert(await page.evaluate(()=>{reset();playing=true;dead=false;collected=cfg().bubbles;bestCombo=cfg().goal;complete();return dead===true&&playing===false&&(save.stars[level]||0)>=1;}));});
 await page.screenshot({path:path.join(OUT,'flight-routes.png')});
 await check('Crash ends run safely',async()=>{assert(await page.evaluate(()=>{reset();playing=true;dead=false;crash('test bump');return dead===true&&playing===false;}));});
 await check('Restart after crash swims again',async()=>{assert(await page.evaluate(()=>{start();const ok=playing===true&&dead===false;playing=false;return ok;}));});
 await check('Run persists best across reload',async()=>{const best=await page.evaluate(()=>{save.best=Math.max(save.best||0,1234);store();return save.best;});assert(best>=1234);await page.reload({waitUntil:'networkidle0'});assert(await page.evaluate(()=>{try{return (JSON.parse(localStorage.getItem('echo_swim_flappy_v1'))||{}).best>=1234;}catch(e){return false;}}));});
 await check('320px and landscape stay reachable',async()=>{for(const size of [{width:320,height:568},{width:844,height:390}]){await page.setViewport(size);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1&&!!document.getElementById('levelMap')));}});
 await check('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
 fs.writeFileSync(path.join(OUT,'flight-results.json'),JSON.stringify({results,errors},null,2));
 }finally{await browser.close();server.close();}if(results.some(r=>!r.pass))process.exitCode=1;})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
