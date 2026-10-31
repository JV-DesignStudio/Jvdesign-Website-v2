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
 const errors=[];
 function watchErrors(){page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'){const text=m.text();if(!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|WebGL/.test(text))errors.push('console: '+text);}});}
 watchErrors();
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.goto(`http://127.0.0.1:${port}/tools/minecraft-skin-editor.html`,{waitUntil:'domcontentloaded',timeout:15000});
 await new Promise(r=>setTimeout(r,1400));
 const data=await page.evaluate(async()=>{
   const api=window.JVDSMinecraftSkin;
   const sleep=ms=>new Promise(r=>setTimeout(r,ms));
   const downloads=[];
   window.downloadBlob=(blob,name)=>{downloads.push({name,size:blob&&blob.size});};
   const overlay=document.getElementById('msOverlay');
   const paintAt=(px,py,id=1,type='mouse')=>{
     const r=overlay.getBoundingClientRect();
     const clientX=r.left+(px+0.5)/64*r.width;
     const clientY=r.top+(py+0.5)/64*r.height;
     const opts={bubbles:true,cancelable:true,clientX,clientY,pointerId:id,pointerType:type,isPrimary:id===1,button:0};
     overlay.dispatchEvent(new PointerEvent('pointerdown',opts));
     overlay.dispatchEvent(new PointerEvent('pointerup',opts));
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

   // template thumbnails and mini player
   const templateThumbs=Array.from(document.querySelectorAll('#msTemplateGrid canvas'));
   let thumbHasPixels=false;
   if(templateThumbs[0]){
     const td2=templateThumbs[0].getContext('2d').getImageData(0,0,templateThumbs[0].width,templateThumbs[0].height).data;
     for(let k=3;k<td2.length;k+=4){ if(td2[k]>0){ thumbHasPixels=true; break; } }
   }
   const mini=document.getElementById('msMini');
   const miniData=mini.getContext('2d').getImageData(0,0,mini.width,mini.height).data;
   let miniHasPixels=false;
   for(let k=3;k<miniData.length;k+=4){ if(miniData[k]>0){ miniHasPixels=true; break; } }

   // touch targets + layout metrics
   const stage=document.getElementById('msPaintStage');
   const stageRect=stage.getBoundingClientRect();
   const view=api.getView();
   const pxPerSkinPixel=+(stageRect.width/64*view.scale).toFixed(1);
   const strip=document.getElementById('bottom-bar');
   const stripRect=strip.getBoundingClientRect();
   const stripPos=getComputedStyle(strip).position;
   const exportRect=document.getElementById('msStripExport').getBoundingClientRect();
   const stripBtns=Array.from(document.querySelectorAll('.ms-strip-btn')).map(b=>+b.getBoundingClientRect().height.toFixed(1));
   const partBtns=Array.from(document.querySelectorAll('.ms-part-btn')).map(b=>+b.getBoundingClientRect().height.toFixed(1));
   const hintFont=parseFloat(getComputedStyle(document.querySelector('.ms-hint')).fontSize);

   // template fills the whole texture
   api.applyTemplate('classic');
   const td=api.getData();
   let filled=0; for(let k=3;k<td.length;k+=4){ if(td[k]>0) filled++; }

   // legacy 64x32 import keeps the top half and mirrors the right limbs
   const legacy=await (async()=>{
     const c=document.createElement('canvas'); c.width=64; c.height=32;
     const cx=c.getContext('2d');
     cx.fillStyle='#123456'; cx.fillRect(0,0,64,32);
     cx.fillStyle='#ff0000'; cx.fillRect(44,20,4,12);
     const blob=await new Promise(r=>c.toBlob(r,'image/png'));
     const file=new File([blob],'legacy.png',{type:'image/png'});
     const dt=new DataTransfer(); dt.items.add(file);
     const input=document.getElementById('msFile'); input.files=dt.files;
     input.dispatchEvent(new Event('change',{bubbles:true}));
     await new Promise(r=>setTimeout(r,500));
     const ld=api.getData();
     const px=(x,y)=>{const i=(y*64+x)*4;return [ld[i],ld[i+1],ld[i+2],ld[i+3]];};
     return { rightArm:px(45,21), leftArm:px(38,53), body:px(21,21), lower:px(45,50) };
   })();

   // hand tool pans the view without painting
   api.applyTemplate('blank');
   api.setTool('hand');
   const viewBeforeHand=api.getView();
   const ovH=overlay.getBoundingClientRect();
   const handAt=(px,py)=>({clientX:ovH.left+(px+0.5)/64*ovH.width,clientY:ovH.top+(py+0.5)/64*ovH.height});
   const handEv=(type,id,p)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'mouse',button:0,...p});
   const h1=handAt(20,20), h2=handAt(36,30);
   overlay.dispatchEvent(handEv('pointerdown',7,h1));
   overlay.dispatchEvent(handEv('pointermove',7,h2));
   overlay.dispatchEvent(handEv('pointerup',7,h2));
   const hd=api.getData();
   let handPainted=false;
   for(let k=3;k<hd.length;k+=4){ if(hd[k]>0){ handPainted=true; break; } }
   const viewAfterHand=api.getView();
   const handPanned=viewAfterHand.panX!==viewBeforeHand.panX||viewAfterHand.panY!==viewBeforeHand.panY;
   api.setTool('pencil');
   api.focusPart('HEAD');

   // pinch (two touch pointers held together) must not paint: the first finger's
   // dot is rolled back when the second finger lands.
   api.applyTemplate('blank');
   const ovR=overlay.getBoundingClientRect();
   const at=(px,py)=>({clientX:ovR.left+(px+0.5)/64*ovR.width,clientY:ovR.top+(py+0.5)/64*ovR.height});
   const touchEv=(type,id,p)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===101,button:0,...p});
   const f1=at(8,8), f2=at(40,40);
   overlay.dispatchEvent(touchEv('pointerdown',101,f1));
   overlay.dispatchEvent(touchEv('pointerdown',102,f2));
   overlay.dispatchEvent(touchEv('pointerup',101,f1));
   overlay.dispatchEvent(touchEv('pointerup',102,f2));
   const pd=api.getData();
   const alphaAt=(x,y)=>pd[(y*64+x)*4+3];
   const pinchPainted=alphaAt(8,8)>0||alphaAt(40,40)>0;

   // export from the thumb bar saves and downloads
   document.getElementById('msStripExport').click();
   await sleep(450);
   let saved=null; try{ saved=localStorage.getItem('jvds_minecraft_skin'); }catch(e){}
   const savedOk=!!saved&&saved.indexOf('data:image/png')===0;

   // more sheet holds the hidden file/edit cards
   document.getElementById('msTabMore').click();
   await sleep(320);
   const side=document.getElementById('msSide');
   const sheetOpen=side.classList.contains('open')&&side.getBoundingClientRect().height>0;
   const exportCardVisible=document.getElementById('msExportBtn').getBoundingClientRect().height>0;
   document.getElementById('msSheetClose').click();
   await sleep(280);
   const sheetClosed=!side.classList.contains('open');

   // tapping the mini player opens the 3D preview
   document.getElementById('msMiniBtn').click();
   await sleep(350);
   const miniOpens3D=document.querySelector('.ms-main').getAttribute('data-view')==='3d'&&api.getView().threeVisible;
   document.getElementById('msTab2D').click();
   await sleep(120);

   // 3D tab shows the preview, 2D tab pauses the render loop
   document.getElementById('msTab3D').click();
   await sleep(500);
   const c3=document.getElementById('ms3D');
   const stage3=document.getElementById('ms3DStage');
   const previewVisible=!!c3&&c3.style.display!=='none'&&stage3.clientWidth>0&&api.getView().threeVisible;
   document.getElementById('msTab2D').click();
   await sleep(120);
   const pausedOn2D=api.getView().threeVisible===false;

   return {
     title:document.title,
     apiSize:api.size,
     paintCanvas:document.getElementById('msSkin').width+'x'+document.getElementById('msSkin').height,
     painted,
     filled,
     legacy,
     view,
     pxPerSkinPixel,
     pill:api.getView().part,
     stripPos,
     stripAtBottom:stripRect.bottom>=innerHeight-2&&stripRect.height>=90,
     exportVisible:exportRect.width>0&&exportRect.height>0,
     stripBtns, partBtns, hintFont,
     downloads:downloads.map(x=>x.name),
     savedOk,
     pinchPainted,
     handPainted, handPanned,
     sheetOpen, exportCardVisible, sheetClosed,
     templateCount:templateThumbs.length,
     thumbHasPixels,
     miniHasPixels,
     miniOpens3D,
     previewVisible,
     pausedOn2D,
     fallbackPresent:!!document.querySelector('.ms-prev-fallback'),
     cleanText:!/â|Ã|ï|�|\?\?/.test(document.body.innerText),
     scrollWidth:document.documentElement.scrollWidth,
     clientWidth:document.documentElement.clientWidth
   };
 });
 check('title loads', data.title.includes('Minecraft Skin Editor'), data.title);
 check('paint canvas initialized', !data.paintCanvas.startsWith('0x'), data.paintCanvas);
 check('public API exposes 64px sketch', data.apiSize===64, String(data.apiSize));
 check('mobile opens on a body part, not the whole texture', data.view.part==='HEAD' && data.view.scale>=3, JSON.stringify(data.view));
 check('each skin pixel is finger sized on mobile', data.pxPerSkinPixel>=30, data.pxPerSkinPixel+' CSS px');
 check('pencil paints the chosen colour', data.painted.r>200 && data.painted.g<60 && data.painted.b<60 && data.painted.a>200, JSON.stringify(data.painted));
 check('base template fills the texture', data.filled>1200, String(data.filled));
 check('legacy 64x32 import keeps the top half', data.legacy.body[0]===18 && data.legacy.body[1]===52 && data.legacy.body[2]===86, JSON.stringify(data.legacy.body));
 check('legacy 64x32 import mirrors the left arm', data.legacy.rightArm[0]>200 && data.legacy.leftArm[0]>200, JSON.stringify({r:data.legacy.rightArm,l:data.legacy.leftArm}));
 check('legacy 64x32 import leaves outer layers clear', data.legacy.lower[3]===0, JSON.stringify(data.legacy.lower));
 check('action bar is fixed to the bottom', data.stripPos==='fixed' && data.stripAtBottom, data.stripPos);
 check('Save and Export is always visible', data.exportVisible);
 check('primary strip targets are at least 44px', data.stripBtns.every(h=>h>=44), data.stripBtns.join(','));
 check('part buttons are at least 44px', data.partBtns.every(h=>h>=44), data.partBtns.join(','));
 check('hint text is readable at 12px or more', data.hintFont>=12, data.hintFont+'px');
 check('export downloads minecraft-skin.png', data.downloads.includes('minecraft-skin.png'), data.downloads.join(', '));
 check('save writes the skin to localStorage', data.savedOk);
 check('two-finger pinch does not paint', data.pinchPainted===false, JSON.stringify(data.pinchPainted));
 check('hand tool pans without painting', data.handPainted===false && data.handPanned===true, JSON.stringify({painted:data.handPainted,panned:data.handPanned}));
 check('base skin thumbnails render', data.templateCount===8 && data.thumbHasPixels===true, JSON.stringify({count:data.templateCount,pixels:data.thumbHasPixels}));
 check('mini player renders the current skin', data.miniHasPixels===true);
 check('mini player opens the 3D preview', data.miniOpens3D===true);
 check('More opens the controls sheet with the file card', data.sheetOpen && data.exportCardVisible, JSON.stringify({open:data.sheetOpen,card:data.exportCardVisible}));
 check('controls sheet closes', data.sheetClosed);
 check('3D preview renders when its tab is open (or shows WebGL fallback)', data.previewVisible || data.fallbackPresent, JSON.stringify({previewVisible:data.previewVisible, fallbackPresent:data.fallbackPresent}));
 check('3D render loop pauses on the 2D tab', data.pausedOn2D);
 check('visible text has no broken placeholders', data.cleanText);
 check('mobile does not overflow viewport', data.scrollWidth<=data.clientWidth+2, `${data.scrollWidth}/${data.clientWidth}`);

 // ---- desktop baseline ----
 await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
 await page.reload({waitUntil:'domcontentloaded'});
 await new Promise(r=>setTimeout(r,1400));
 const desk=await page.evaluate(async()=>{
   const api=window.JVDSMinecraftSkin;
   const downloads=[];
   window.downloadBlob=(blob,name)=>{downloads.push(name);};
   const overlay=document.getElementById('msOverlay');
   const paintAt=(px,py)=>{
     const r=overlay.getBoundingClientRect();
     const opts={bubbles:true,cancelable:true,clientX:r.left+(px+0.5)/64*r.width,clientY:r.top+(py+0.5)/64*r.height,pointerId:1,pointerType:'mouse',isPrimary:true,button:0};
     overlay.dispatchEvent(new PointerEvent('pointerdown',opts));
     overlay.dispatchEvent(new PointerEvent('pointerup',opts));
   };
   api.applyTemplate('blank');
   api.setColor('#0000ff');
   api.setTool('pencil');
   paintAt(20,20);
   const d=api.getData();
   const i=(20*64+20)*4;
   const painted={r:d[i],g:d[i+1],b:d[i+2],a:d[i+3]};
   document.getElementById('msExportBtn').click();
   await new Promise(r=>setTimeout(r,450));
   return {
     view:api.getView(),
     stageW:+document.getElementById('msPaintStage').getBoundingClientRect().width.toFixed(1),
     painted,
     downloads,
     mobileBar:getComputedStyle(document.getElementById('bottom-bar')).display,
     partStrip:getComputedStyle(document.getElementById('msPartStrip')).display,
     sheetHead:getComputedStyle(document.querySelector('.ms-sheet-head')).display,
     c3:document.getElementById('ms3D').style.display,
     scrollWidth:document.documentElement.scrollWidth,
     clientWidth:document.documentElement.clientWidth
   };
 });
 check('desktop shows the whole texture', desk.view.scale===1 && desk.view.part==='WHOLE', JSON.stringify(desk.view));
 check('desktop paint stage is 520px wide', desk.stageW===520, String(desk.stageW));
 check('desktop pencil paints the chosen colour', desk.painted.b>200 && desk.painted.r<60, JSON.stringify(desk.painted));
 check('desktop export downloads a skin', desk.downloads.includes('minecraft-skin.png'), desk.downloads.join(','));
 check('mobile-only chrome stays hidden on desktop', desk.mobileBar==='none' && desk.partStrip==='none' && desk.sheetHead==='none', JSON.stringify({bar:desk.mobileBar,part:desk.partStrip,sheet:desk.sheetHead}));
 check('desktop 3D preview stays visible', desk.c3!=='none');
 check('desktop does not overflow viewport', desk.scrollWidth<=desk.clientWidth+2, `${desk.scrollWidth}/${desk.clientWidth}`);

 // ---- phone landscape: paint and 3D side by side ----
 await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.reload({waitUntil:'domcontentloaded'});
 await new Promise(r=>setTimeout(r,1400));
 const land=await page.evaluate(async()=>{
   const api=window.JVDSMinecraftSkin;
   const disp=s=>getComputedStyle(document.querySelector(s)).display;
   const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {w:+b.width.toFixed(0),h:+b.height.toFixed(0),top:+b.top.toFixed(0),bottom:+b.bottom.toFixed(0)};};
   const overlay=document.getElementById('msOverlay');
   const r=overlay.getBoundingClientRect();
   const opts={bubbles:true,cancelable:true,clientX:r.left+(20.5/64)*r.width,clientY:r.top+(20.5/64)*r.height,pointerId:1,pointerType:'mouse',isPrimary:true,button:0};
   api.applyTemplate('blank');
   api.setColor('#0000ff');
   api.setTool('pencil');
   overlay.dispatchEvent(new PointerEvent('pointerdown',opts));
   overlay.dispatchEvent(new PointerEvent('pointerup',opts));
   const d=api.getData();
   const i=(20*64+20)*4;
   return {
     brief:disp('.ms-brief'),
     paint:disp('.ms-paintwrap'),
     preview:disp('.ms-previewwrap'),
     side:disp('#msSide'),
     bar:disp('#bottom-bar'),
     stage:rect('#msPaintStage'),
     previewStage:rect('#ms3DStage'),
     c3:document.getElementById('ms3D').style.display,
     painted:{r:d[i],g:d[i+1],b:d[i+2],a:d[i+3]},
     view:api.getView(),
     innerH:window.innerHeight,
     scrollWidth:document.documentElement.scrollWidth,
     clientWidth:document.documentElement.clientWidth
   };
 });
 check('landscape shows paint and 3D together', land.paint!=='none' && land.preview!=='none', JSON.stringify({paint:land.paint,preview:land.preview}));
 check('landscape keeps the tool rail and hides the thumb bar', land.side==='flex' && land.bar==='none', JSON.stringify({side:land.side,bar:land.bar}));
 check('landscape hides the brief', land.brief==='none', land.brief);
 check('landscape canvas fits the viewport', land.stage.w===land.previewStage.w && land.stage.w>=160 && land.stage.w<=400 && land.stage.bottom<=land.innerH, JSON.stringify({stage:land.stage,preview:land.previewStage,h:land.innerH}));
 check('landscape pencil paints', land.painted.b>200 && land.painted.r<60, JSON.stringify(land.painted));
 check('landscape does not overflow viewport', land.scrollWidth<=land.clientWidth+2, `${land.scrollWidth}/${land.clientWidth}`);
 check('zero runtime errors', errors.length===0, errors.join(' | '));

 await browser.close(); server.close();
 if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);} console.log('\nALL MINECRAFT SKIN EDITOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
