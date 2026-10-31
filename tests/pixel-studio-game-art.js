#!/usr/bin/env node
/*
 * tests/pixel-studio-game-art.js
 * Game-art pipeline checks for the 10 Pixel Studio audit fixes (A2131).
 * Run: node tests/pixel-studio-game-art.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PSGA_PORT || 8129;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};

let failures = 0;
const check = (name, ok, detail) => { console.log((ok?'PASS ':'FAIL ')+name+(detail?' ['+detail+']':'')); if(!ok) failures++; };

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('jvds_pixel_seen','1'); } catch(e){} });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 900));

  // 1. Ctrl+C / Ctrl+V and buttons
  const cp = await page.evaluate(() => {
    setCanvasSize(16,16,false);
    frames=[[new ImageData(16,16)]]; frameMeta=[{clip:'default',hold:1}]; currentFrame=0; currentLayer=0;
    setTool('pencil'); setFg('#ff0000');
    pushUndo(); paintPx(getID(),1,1,'#ff0000',false); renderAll();
    selection={x0:1,y0:1,x1:1,y1:1};
    copySelection();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true}));
    const d=getID().data, i=(2*16+2)*4;
    return {clipW:selClipboard&&selClipboard.w, r:d[i], a:d[i+3]};
  });
  check('Ctrl+V pastes the copied pixels', cp.clipW===1 && cp.r===255 && cp.a===255);
  check('Copy/Paste buttons exist', await page.evaluate(()=>!!document.querySelector('[data-on="copySelection"]') && !!document.querySelector('[data-on="pasteSelection"]')));

  // 2. Rotate undo must restore every frame
  const rot = await page.evaluate(() => {
    setCanvasSize(8,4,false);
    frames=[[new ImageData(8,4)],[new ImageData(8,4)],[new ImageData(8,4)]];
    frameMeta=[{clip:'default',hold:1},{clip:'default',hold:1},{clip:'default',hold:1}];
    frames[0][0].data[(0*8+0)*4+3]=255;
    frames[1][0].data[(0*8+1)*4+3]=255;
    frames[2][0].data[(0*8+2)*4+3]=255;
    currentFrame=0; currentLayer=0; renderAll();
    rotateFrame();
    const after={w:cW,h:cH};
    undo();
    const restored=frames.map(f=>f[0]?Array.from(f[0].data).filter((v,i)=>i%4===3&&v>0).length:0);
    return {after,w:cW,h:cH,restored,frameCount:frames.length};
  });
  check('Rotate swaps canvas dimensions', rot.after.w===4 && rot.after.h===8);
  check('Rotate undo restores every frame', rot.w===8 && rot.h===4 && rot.frameCount===3 && rot.restored.every(n=>n===1), JSON.stringify(rot));

  // 3. Native 1x export and explicit scales
  const exp = await page.evaluate(() => {
    setCanvasSize(16,16,false);
    frames=[[new ImageData(16,16)]]; frameMeta=[{clip:'default',hold:1}];
    setExportScale(1);
    const s1=buildSheet();
    setExportScale(2);
    const s2=buildSheet();
    setExportScale(1);
    return {fw1:s1.fw,fw2:s2.fw,pad:s1.pad,sheetW:s1.canvas.width,hint:document.getElementById('exportSizeHint').textContent};
  });
  check('1x export is native (16px frame)', exp.fw1===16 && exp.fw2===32);
  check('Sheet has 1px padding', exp.pad===1 && exp.sheetW===18);
  check('Export hint shows native size', /16×16/.test(exp.hint) && !/NaN/.test(exp.hint), exp.hint);

  // 4. Freehand interpolation
  const stroke = await page.evaluate(() => {
    setCanvasSize(32,32,false);
    frames=[[new ImageData(32,32)]]; frameMeta=[{clip:'default',hold:1}]; currentFrame=0; currentLayer=0;
    lastPaint=[0,0];
    strokeTo(getID(),10,10,'#00ff00',false);
    const d=getID().data, at=(x,y)=>d[(y*32+x)*4+3]>0;
    return {start:at(0,0),mid:at(5,5),end:at(10,10)};
  });
  check('Freehand stroke interpolates between samples', stroke.start && stroke.mid && stroke.end, JSON.stringify(stroke));

  // 5. Pixel-clean character stamp
  const stamp = await page.evaluate(() => {
    setCanvasSize(32,32,false);
    frames=[[new ImageData(32,32)]]; frameMeta=[{clip:'default',hold:1}]; currentFrame=0; currentLayer=0;
    layers=[{name:'Layer 1',visible:true,opacity:100}];
    if(typeof renderCharacter==='function') renderCharacter();
    if(typeof renderCharacterUnified==='function') renderCharacterUnified();
    stampToCanvas();
    const d=frames[0][0].data, alphas=new Set();
    for(let i=3;i<d.length;i+=4) alphas.add(d[i]);
    return {alphas:Array.from(alphas).sort((a,b)=>a-b)};
  });
  check('Stamped character has hard alpha only', stamp.alphas.includes(255) && stamp.alphas.every(a=>a===0||a===255), JSON.stringify(stamp.alphas));

  // 6. Atlas metadata, pivot, padding
  const atlas = await page.evaluate(() => {
    setCanvasSize(16,16,false);
    frames=[[new ImageData(16,16)],[new ImageData(16,16)]];
    frameMeta=[{clip:'idle',hold:1},{clip:'idle',hold:2}];
    setExportOrigin(7);
    const a=buildAtlas().atlas;
    return {scale:a.meta.scale,padding:a.meta.padding,pivot:a.meta.pivot,f0:a.frames.frame_0,dur:a.frames.frame_1.duration};
  });
  check('Atlas metadata is internally consistent', atlas.scale===1 && atlas.padding===1 && atlas.pivot.y===1);
  check('Atlas sourceSize matches frame size', atlas.f0.sourceSize.w===16 && atlas.f0.frame.w===16);
  check('Atlas carries per-frame duration', atlas.dur===250, String(atlas.dur));

  // 7. Named clips, holds and loop flag
  const clips = await page.evaluate(() => {
    setCanvasSize(16,16,false);
    frames=[[new ImageData(16,16)],[new ImageData(16,16)],[new ImageData(16,16)]];
    frameMeta=[{clip:'idle',hold:1},{clip:'idle',hold:2},{clip:'attack',hold:1}];
    const s=buildSheet();
    const files=_enginePackFiles({sheetW:s.canvas.width,sheetH:s.canvas.height,cW:cW,cH:cH,sc:s.sc,fps:8,count:3,positions:s.positions,name:'hero',frameMeta:frameMeta,loop:false,origin:7,pad:s.pad});
    const godot=files['godot/SpriteFrames.tres'];
    return {hasIdle:godot.includes('&"idle"'),hasAttack:godot.includes('&"attack"'),loopFalse:godot.includes('"loop": false'),readme:files['README.txt']};
  });
  check('Engine pack exports named clips', clips.hasIdle && clips.hasAttack);
  check('Engine pack honours the loop flag', clips.loopFalse);
  check('README documents clips', /Clips: idle/.test(clips.readme));

  // 8. Layer/frame reorder and opacity
  const order = await page.evaluate(() => {
    setCanvasSize(8,8,false);
    layers=[{name:'A',visible:true,opacity:100},{name:'B',visible:true,opacity:100}];
    frames=[[new ImageData(8,8),new ImageData(8,8)]]; frameMeta=[{clip:'default',hold:1}];
    currentFrame=0; currentLayer=0;
    moveLayer(1);
    const layerOrder=layers.map(l=>l.name).join(',');
    setLayerOpacity(40);
    const op=layers[currentLayer].opacity;
    frames.push([new ImageData(8,8),new ImageData(8,8)]);
    frameMeta.push({clip:'default',hold:1});
    currentFrame=0; moveFrame(1);
    return {layerOrder,op,frameCount:frames.length,frameIdx:currentFrame};
  });
  check('Layers reorder', order.layerOrder==='B,A', order.layerOrder);
  check('Layer opacity applies', order.op===40);
  check('Frames reorder', order.frameIdx===1 && order.frameCount===2);
  const ui = await page.evaluate(() => {
    const btn = arg => [...document.querySelectorAll('[data-on="moveLayer"]')].find(b => b.getAttribute('data-on-arg') === arg);
    return {
      down: btn('-1').textContent.trim(),
      up: btn('1').textContent.trim(),
      clipEvent: document.getElementById('frameClip').getAttribute('data-on-event'),
      holdEvent: document.getElementById('frameHold').getAttribute('data-on-event')
    };
  });
  check('Layer arrows match their direction', ui.down==='↓' && ui.up==='↑', JSON.stringify(ui));
  check('Clip/hold commit on change, not every keystroke', ui.clipEvent==='change' && ui.holdEvent==='change');

  // 9. Palette import (.hex)
  const pal = await page.evaluate(async () => {
    const file=new File(['#112233\n#445566\n'],'p.hex',{type:'text/plain'});
    handlePaletteFile({files:[file],value:''});
    await new Promise(r=>setTimeout(r,120));
    return {len:PAL.length,first:PAL[0],second:PAL[1]};
  });
  check('Palette import reads .hex', pal.len===2 && pal.first==='#112233' && pal.second==='#445566', JSON.stringify(pal));

  // 10. .aseprite round-trip
  const ase = await page.evaluate(async () => {
    setCanvasSize(8,8,false);
    layers=[{name:'Base',visible:true,opacity:100},{name:'Top',visible:true,opacity:60}];
    frames=[[new ImageData(8,8),new ImageData(8,8)]];
    frameMeta=[{clip:'idle',hold:1}];
    frames[0][0].data[(0*8+0)*4+3]=255;
    frames[0][1].data[(0*8+1)*4+3]=255;
    const bytes=await buildAsepriteBytes();
    const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const u16=o=>dv.getUint16(o,true),u32=o=>dv.getUint32(o,true);
    const declared=u32(0), magic=u16(4), nFrames=u16(6);
    let off=128, sum=0;
    for(let i=0;i<nFrames;i++){const fs=u32(off);sum+=fs;off+=fs;}
    await importAsepriteBytes(bytes);
    return {magic,declared,actual:bytes.length,sum,frameCount:nFrames,w:cW,h:cH,layers:layers.map(l=>l.name).join(','),frames:frames.length,op:layers[1].opacity};
  });
  check('Aseprite export has the right magic', ase.magic===0xA5E0);
  check('Aseprite header size and frame sizes are consistent', ase.declared===ase.actual && ase.sum===ase.actual-128, JSON.stringify({declared:ase.declared,actual:ase.actual,sum:ase.sum}));
  check('Aseprite round-trip keeps canvas and frames', ase.w===8 && ase.h===8 && ase.frames===1);
  check('Aseprite round-trip keeps layers', ase.layers==='Base,Top', ase.layers);
  check('Aseprite round-trip keeps layer opacity', ase.op===60, String(ase.op));

  // 11. Wheel zoom
  const zoom = await page.evaluate(() => {
    zoomLevel=8; resizeCanvases(); renderAll();
    const before=zoomLevel;
    document.getElementById('main-canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));
    return {before,after:zoomLevel};
  });
  check('Wheel zooms the canvas', zoom.after>zoom.before, JSON.stringify(zoom));

  // 12. Space pans, Enter plays
  const keys = await page.evaluate(() => {
    isPlaying=false; window.isPlaying=false;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
    document.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
    const afterSpace=isPlaying;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    const afterEnter=isPlaying;
    if(isPlaying) togglePlay();
    return {afterSpace,afterEnter};
  });
  check('Space no longer toggles play', keys.afterSpace===false);
  check('Enter toggles play', keys.afterEnter===true);

  // 13. Right-click erase option
  const rc = await page.evaluate(() => {
    setRightClickErase(true); const on=rightClickErase;
    setRightClickErase(false); const off=rightClickErase;
    return {on,off,checkbox:!!document.getElementById('rightErase')};
  });
  check('Right-click erase option works', rc.on===true && rc.off===false && rc.checkbox);

  check('no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PIXEL STUDIO GAME-ART CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
