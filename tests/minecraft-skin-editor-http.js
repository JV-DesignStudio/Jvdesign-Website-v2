const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const root = path.join(__dirname, '..');
const port = 19271;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'};
const server = http.createServer((req,res)=>{let url=decodeURIComponent(req.url.split('?')[0]);if(url==='/')url='/index.html';const file=path.normalize(path.join(root,url));if(!file.startsWith(path.normalize(root))){res.writeHead(403);res.end('Forbidden');return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});res.end(data);});});
function listen(){return new Promise(resolve=>server.listen(port, resolve));}
let failures=0;function check(name, ok, detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
(async()=>{
 await listen();
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'){const text=m.text();if(!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR/.test(text))errors.push('console: '+text);}});
 await page.setViewport({width:390,height:844,isMobile:true});
 await page.goto(`http://127.0.0.1:${port}/tools/minecraft-skin-editor.html`,{waitUntil:'domcontentloaded',timeout:15000});
 await new Promise(r=>setTimeout(r,1200));
 const data=await page.evaluate(async()=>{
   const api=window.JVDSMinecraftSkin;
   const downloads=[];
   window.downloadBlob=(blob,name)=>{downloads.push({name,size:blob&&blob.size});};
   const paintAt=(px,py)=>{
     const c=document.getElementById('msOverlay');
     const r=c.getBoundingClientRect();
     const clientX=r.left+(px+0.5)/64*r.width;
     const clientY=r.top+(py+0.5)/64*r.height;
     const opts={bubbles:true,cancelable:true,clientX,clientY,pointerId:1,pointerType:'mouse',isPrimary:true};
     c.dispatchEvent(new PointerEvent('pointerdown',opts));
     c.dispatchEvent(new PointerEvent('pointerup',opts));
   };
   // deterministic state: blank base, red pencil, 1px
   api.applyTemplate('blank');
   api.setColor('#ff0000');
   api.setTool('pencil');
   api.setBrush(1);
   paintAt(10,10);
   const d=api.getData();
   const i=(10*64+10)*4;
   const painted={r:d[i],g:d[i+1],b:d[i+2],a:d[i+3]};
   // template fills the whole texture
   api.applyTemplate('classic');
   const td=api.getData();
   let filled=0; for(let k=3;k<td.length;k+=4){ if(td[k]>0) filled++; }
   // export
   document.getElementById('msExportBtn').click();
   await new Promise(r=>setTimeout(r,400));
   // explicit save
   document.getElementById('msSaveBtn').click();
   let saved=null; try{ saved=localStorage.getItem('jvds_minecraft_skin'); }catch(e){}
   const c3=document.getElementById('ms3D');
   const fallback=document.querySelector('.ms-prev-fallback');
   const stage=document.getElementById('ms3DStage');
   return {
     title:document.title,
     apiSize:api.size,
     paintCanvas:document.getElementById('msSkin').width+'x'+document.getElementById('msSkin').height,
     painted,
     filled,
     downloads:downloads.map(x=>x.name),
     savedOk:!!saved && saved.indexOf('data:image/png')===0,
     previewVisible:!!c3 && c3.style.display!=='none' && !!(stage&&stage.clientWidth),
     fallbackPresent:!!fallback,
     cleanText:!/â|Ã|ï|�|\?\?/.test(document.body.innerText),
     scrollWidth:document.documentElement.scrollWidth,
     clientWidth:document.documentElement.clientWidth
   };
 });
 check('title loads', data.title.includes('Minecraft Skin Editor'), data.title);
 check('paint canvas initialized', !data.paintCanvas.startsWith('0x'), data.paintCanvas);
 check('public API exposes 64px sketch', data.apiSize===64, String(data.apiSize));
 check('pencil paints the chosen colour', data.painted.r>200 && data.painted.g<60 && data.painted.b<60 && data.painted.a>200, JSON.stringify(data.painted));
 check('base template fills the texture', data.filled>1200, String(data.filled));
 check('export triggers a minecraft-skin.png download', data.downloads.includes('minecraft-skin.png'), data.downloads.join(', '));
 check('save writes the skin to localStorage', data.savedOk);
 check('3D preview renders (or shows WebGL fallback)', data.previewVisible || data.fallbackPresent, JSON.stringify({previewVisible:data.previewVisible, fallbackPresent:data.fallbackPresent}));
 check('visible text has no broken placeholders', data.cleanText);
 check('mobile does not overflow viewport', data.scrollWidth<=data.clientWidth+2, `${data.scrollWidth}/${data.clientWidth}`);
 check('zero runtime errors', errors.length===0, errors.join(' | '));
 await browser.close(); server.close();
 if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);} console.log('\nALL MINECRAFT SKIN EDITOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
