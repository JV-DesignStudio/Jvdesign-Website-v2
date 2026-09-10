const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const root = path.join(__dirname, '..');
const port = 19252;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{let url=decodeURIComponent(req.url.split('?')[0]);if(url==='/')url='/index.html';const file=path.normalize(path.join(root,url));if(!file.startsWith(path.normalize(root))){res.writeHead(403);res.end('Forbidden');return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});res.end(data);});});
function listen(){return new Promise(resolve=>server.listen(port, resolve));}
let failures=0;function check(name, ok, detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
(async()=>{
 await listen();
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'){const text=m.text();if(!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text))errors.push('console: '+text);}});
 await page.setViewport({width:390,height:844,isMobile:true});
 await page.goto(`http://127.0.0.1:${port}/tools/particle-designer.html`,{waitUntil:'domcontentloaded',timeout:15000});
 await new Promise(r=>setTimeout(r,1000));
 const data=await page.evaluate(async()=>{
   const canvas=document.getElementById('canvas');
   const ctx=canvas.getContext('2d');
   const sample=()=>{ const d=ctx.getImageData(0,0,canvas.width,canvas.height).data; for(let i=0;i<d.length;i+=4){ if(d[i]>10 || d[i+1]>10 || d[i+2]>10) return true; } return false; };
   const downloads=[];
   const oldDownload=window.download;
   window.download=(data,name,type)=>{ downloads.push({name,type,size:data instanceof Blob ? data.size : String(data).length}); };
   sbTab('params');
   document.getElementById('pAngle').value='180';
   document.getElementById('pAngle').dispatchEvent(new Event('input',{bubbles:true}));
   document.getElementById('pRate').value='75';
   document.getElementById('pRate').dispatchEvent(new Event('input',{bubbles:true}));
   burstEmit();
   await new Promise(r=>setTimeout(r,160));
   const drew=sample();
   sbTab('saves');
   document.getElementById('saveName').value='<b>spark</b>';
   saveCurrentEffect();
   const saveText=document.getElementById('saveList').innerText;
   sbTab('export');
   document.getElementById('btnRaw').click();
   document.getElementById('btnGodot').click();
   window.download=oldDownload;
   return {
     title:document.title,
     canvasSize:canvas.width+'x'+canvas.height,
     drew,
     presetCount:document.querySelectorAll('.preset-btn').length,
     hasAngle:!!document.getElementById('pAngle') && document.getElementById('vAngle').textContent==='180',
     rateChanged:window.P ? window.P.rate===75 : true,
     saveEscaped:saveText.includes('<b>spark</b>') && !document.querySelector('#saveList b'),
     downloads:downloads.map(d=>d.name),
     cleanText:!/â|Ã|ï|�|\?\?/.test(document.body.innerText),
     scrollWidth:document.documentElement.scrollWidth,
     clientWidth:document.documentElement.clientWidth
   };
 });
 check('title loads', data.title.includes('Particle Designer'), data.title);
 check('canvas initialized', !data.canvasSize.startsWith('0x'), data.canvasSize);
 check('particles draw pixels', data.drew, JSON.stringify({canvasSize:data.canvasSize, particleCount:data.particleCount, cfg:data.cfg, samplePixels:data.samplePixels}));
 check('presets render', data.presetCount >= 6, String(data.presetCount));
 check('angle control exists and updates', data.hasAngle);
 check('save names are escaped', data.saveEscaped);
 check('raw and Godot exports trigger downloads', data.downloads.includes('particle_config.json') && data.downloads.includes('godot_particles_material.tres'), data.downloads.join(', '));
 check('visible text has no broken placeholders', data.cleanText);
 check('mobile does not overflow viewport', data.scrollWidth<=data.clientWidth+2, `${data.scrollWidth}/${data.clientWidth}`);
 check('zero runtime errors', errors.length===0, errors.join(' | '));
 await browser.close(); server.close();
 if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);} console.log('\nALL PARTICLE DESIGNER CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});



