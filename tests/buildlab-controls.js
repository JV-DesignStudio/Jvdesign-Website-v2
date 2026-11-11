/* BuildLab learner controls (A2932).

   Covers the ten improvements added after the move/resize fix:
   auto-selected templates + selection bar, camera pan/help, drag paint and
   delete, hover outline/chip, drop/stack helpers, touch rotate, template coach,
   export preview thumbnail + dimensions, fast mode, and keyboard nudge/escape.

   Run: node tests/buildlab-controls.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19284;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  let url = decodeURIComponent(req.url.split('?')[0]);
  if(url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if(!file.startsWith(path.normalize(root))){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
});
function listen(){return new Promise(resolve=>server.listen(port, resolve));}
let failures = 0;
function check(name, ok, detail=''){
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if(!ok) failures++;
}
const pause = ms => new Promise(r=>setTimeout(r, ms));

async function ready(page, mobile){
  await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
  await pause(500);
  await page.evaluate((mobile) => {
    try { localStorage.removeItem('buildlab_fastmode'); localStorage.removeItem('buildlab_autosave'); } catch(e) {}
    try { window.closeModal && window.closeModal('welcomeModal'); } catch(e) {}
    const w = document.getElementById('welcomeModal');
    if (w) w.classList.remove('open');
    document.body.classList.remove('bl-modal-open');
    const b = document.getElementById('cookie-accept');
    if (b) b.click();
    if (mobile && typeof window.mobTab === 'function') window.mobTab('tools');
  }, mobile);
  await pause(250);
}

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    // ---------------- desktop ----------------
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    page.on('console', m=>{ if(m.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(m.text())) errors.push('console: '+m.text()); });
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await ready(page, false);

    const template = await page.evaluate(async ()=>{
      window.quickBuild('robot');
      await new Promise(r=>setTimeout(r,150));
      return {
        blocks: window.blocks.length,
        selected: window.selectedBlocks.length,
        bar: document.getElementById('selectionBar').classList.contains('show'),
        count: document.getElementById('selectionBarCount').textContent,
        coach: document.getElementById('quickCoach').classList.contains('show')
      };
    });
    check('template loads with the whole model selected', template.selected === template.blocks && template.blocks > 1, JSON.stringify(template));
    check('selection bar appears for a template', template.bar && /blocks/.test(template.count), JSON.stringify(template));
    check('template coach appears after loading', template.coach, String(template.coach));

    const nudge = await page.evaluate(()=>{
      window.setGridSize('1');
      const before = window.blocks.map(b=>b.position.x);
      window.selectionNudge(1,0,0);
      return { moved: window.blocks.every((b,i)=>Math.abs((b.position.x-before[i])-1)<1e-6), count: window.blocks.length };
    });
    check('selection bar nudge moves every part', nudge.moved && nudge.count > 1, JSON.stringify(nudge));

    const dup = await page.evaluate(()=>{
      const before = window.blocks.length;
      window.selectionDuplicate();
      const after = window.blocks.length;
      window.selectionDelete();
      return { before, after, final: window.blocks.length, selected: window.selectedBlocks.length };
    });
    check('selection bar duplicates the whole selection', dup.after === dup.before * 2, JSON.stringify(dup));
    check('selection bar deletes the duplicate copy', dup.final === dup.before && dup.selected === 0, JSON.stringify(dup));

    const helpers = await page.evaluate(()=>{
      window.clearAll(true);
      const base = window.addBlock(0,0,0,1,1,1,'#999999');
      const top = window.addBlock(0,3,0,1,1,1,'#e94560');
      window.selectBlock(top);
      window.selectionDropToGround();
      const droppedBase = top.position.y - top.userData.h/2;
      top.position.y = 3.5;
      window.selectBlock(top);
      window.selectionStack();
      const stackedBase = top.position.y - top.userData.h/2;
      return { droppedBase, stackedBase, baseTop: base.position.y + base.userData.h/2 };
    });
    check('Drop to floor grounds the selection', Math.abs(helpers.droppedBase) < 0.01, JSON.stringify(helpers));
    check('Stack helper lands on the block below', Math.abs(helpers.stackedBase - helpers.baseTop) < 0.01, JSON.stringify(helpers));

    const paint = await page.evaluate(async ()=>{
      window.clearAll(true);
      window.setGridSize('1');
      window.setCustomColour('#00d4aa');
      window.setTool('paint');
      const a = window.addBlock(0,0,0,1,1,1,'#e94560');
      const b = window.addBlock(2,0,0,1,1,1,'#e94560');
      window.frameAll(true);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const canvas = window.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const project = (m)=>{ const v = new window.THREE.Vector3(m.position.x,m.position.y,m.position.z).project(window.camera); return {x:rect.left+(v.x*.5+.5)*rect.width, y:rect.top+(-v.y*.5+.5)*rect.height}; };
      const pa = project(a), pb = project(b);
      canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true,button:0,clientX:pa.x,clientY:pa.y}));
      canvas.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,cancelable:true,button:0,clientX:pb.x,clientY:pb.y}));
      document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true,button:0,clientX:pb.x,clientY:pb.y}));
      return { a:a.userData.colour, b:b.userData.colour };
    });
    check('drag paint repaints every block under the cursor', paint.a.toLowerCase()==='#00d4aa' && paint.b.toLowerCase()==='#00d4aa', JSON.stringify(paint));

    const del = await page.evaluate(async ()=>{
      window.clearAll(true);
      window.setTool('delete');
      const a = window.addBlock(0,0,0,1,1,1,'#e94560');
      const b = window.addBlock(2,0,0,1,1,1,'#e94560');
      window.frameAll(true);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const canvas = window.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const project = (m)=>{ const v = new window.THREE.Vector3(m.position.x,m.position.y,m.position.z).project(window.camera); return {x:rect.left+(v.x*.5+.5)*rect.width, y:rect.top+(-v.y*.5+.5)*rect.height}; };
      const pa = project(a), pb = project(b);
      canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true,button:0,clientX:pa.x,clientY:pa.y}));
      canvas.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,cancelable:true,button:0,clientX:pb.x,clientY:pb.y}));
      document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true,button:0,clientX:pb.x,clientY:pb.y}));
      return { left: window.blocks.length };
    });
    check('drag delete removes every block under the cursor', del.left === 0, JSON.stringify(del));

    const hover = await page.evaluate(async ()=>{
      window.clearAll(true);
      window.setTool('select');
      const m = window.addBlock(0,0,0,2,1,1,'#3366cc');
      window.frameAll(true);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const canvas = window.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const v = new window.THREE.Vector3(m.position.x,m.position.y,m.position.z).project(window.camera);
      canvas.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,cancelable:true,button:0,clientX:rect.left+(v.x*.5+.5)*rect.width, clientY:rect.top+(-v.y*.5+.5)*rect.height}));
      await new Promise(r=>setTimeout(r,80));
      const chip = document.getElementById('hoverChip');
      return { outline: !!window.hoverHighlight.visible, chip: chip.style.display, text: chip.textContent };
    });
    check('hovering shows an outline and block info', hover.outline && hover.chip === 'block' && /Block/.test(hover.text), JSON.stringify(hover));

    const keys = await page.evaluate(()=>{
      window.clearAll(true);
      window.setGridSize('1');
      const m = window.addBlock(0,0,0,1,1,1,'#e94560');
      window.selectBlock(m);
      const start = m.position.x;
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', code:'ArrowRight', bubbles:true}));
      const afterOne = m.position.x;
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', code:'ArrowRight', shiftKey:true, bubbles:true}));
      const afterShift = m.position.x;
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', code:'Escape', bubbles:true}));
      return { start, afterOne, afterShift, selected: !!window.selectedBlock };
    });
    check('Arrow keys nudge and Shift makes a bigger step', Math.abs(keys.afterOne-keys.start-1)<1e-6 && Math.abs(keys.afterShift-keys.afterOne-5)<1e-6, JSON.stringify(keys));
    check('Escape clears the selection', keys.selected === false, JSON.stringify(keys));

    const fast = await page.evaluate(()=>{
      window.applyFastMode(false, true);
      const before = { ratio: window.renderer.getPixelRatio(), shadows: window.renderer.shadowMap.enabled };
      window.toggleFastMode();
      const on = { ratio: window.renderer.getPixelRatio(), shadows: window.renderer.shadowMap.enabled, stored: localStorage.getItem('buildlab_fastmode'), pressed: document.getElementById('fastModeBtn').getAttribute('aria-pressed') };
      window.toggleFastMode();
      const off = { ratio: window.renderer.getPixelRatio(), shadows: window.renderer.shadowMap.enabled, stored: localStorage.getItem('buildlab_fastmode') };
      return { before, on, off };
    });
    check('Fast mode drops shadows and render scale', fast.on.ratio === 0.75 && fast.on.shadows === false && fast.on.stored === '1' && fast.on.pressed === 'true', JSON.stringify(fast));
    check('Fast mode turns back off cleanly', fast.off.ratio === 1 && fast.off.shadows === true && fast.off.stored === '0', JSON.stringify(fast));

    const camera = await page.evaluate(async ()=>{
      window.deselectBlock();
      const help = document.getElementById('cameraHelp');
      window.toggleCameraHelp(true);
      const shown = help.classList.contains('show') && getComputedStyle(help).display !== 'none';
      window.toggleCameraHelp(false);
      const hidden = !help.classList.contains('show');
      const canvas = window.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const before = window.camera.position.clone();
      document.dispatchEvent(new KeyboardEvent('keydown', {key:' ', code:'Space', bubbles:true}));
      canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true,button:0,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2}));
      canvas.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,cancelable:true,button:0,clientX:rect.left+rect.width/2+90,clientY:rect.top+rect.height/2+30}));
      document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true,button:0,clientX:rect.left+rect.width/2+90,clientY:rect.top+rect.height/2+30}));
      document.dispatchEvent(new KeyboardEvent('keyup', {key:' ', code:'Space', bubbles:true}));
      const moved = window.camera.position.distanceTo(before);
      return { shown, hidden, moved };
    });
    check('Camera help opens and closes', camera.shown && camera.hidden, JSON.stringify(camera));
    check('Space + drag pans the camera', camera.moved > 0.01, 'moved='+camera.moved);

    const exportPreview = await page.evaluate(async ()=>{
      window.clearAll(true);
      window.addBlock(0,0,0,2,2,2,'#3366cc');
      window.showExportPreview('obj', ()=>{});
      await new Promise(r=>setTimeout(r,500));
      const content = document.getElementById('exportPreviewContent').textContent;
      const img = document.getElementById('exportPreviewThumb');
      const result = { size: /Build size:/.test(content), hasImg: !!img, shown: !!img && img.style.display !== 'none', hasSrc: !!img && /^blob:/.test(img.src || '') };
      window.closeModal('exportPreviewModal');
      return result;
    });
    check('Export preview shows the build size', exportPreview.size, JSON.stringify(exportPreview));
    check('Export preview renders a thumbnail', exportPreview.hasImg && exportPreview.shown && exportPreview.hasSrc, JSON.stringify(exportPreview));

    const coach = await page.evaluate(async ()=>{
      window.quickBuild('house');
      await new Promise(r=>setTimeout(r,120));
      window.setTool('paint');
      window.setCustomColour('#123456');
      const m = window.blocks[0];
      window.frameAll(true);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const canvas = window.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const v = new window.THREE.Vector3(m.position.x,m.position.y,m.position.z).project(window.camera);
      const px = rect.left+(v.x*.5+.5)*rect.width, py = rect.top+(-v.y*.5+.5)*rect.height;
      canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true,button:0,clientX:px,clientY:py}));
      document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true,button:0,clientX:px,clientY:py}));
      window.setTool('select');
      window.selectBlock(m);
      window.updateProp('h', (m.userData.h || 1) + 1);
      window.showExportPreview('obj', ()=>{});
      await new Promise(r=>setTimeout(r,250));
      const promise = document.getElementById('exportPreviewConfirm').click();
      await new Promise(r=>setTimeout(r,100));
      return {
        shown: document.getElementById('quickCoach').classList.contains('show'),
        paint: document.querySelector('.qc-step[data-qc="paint"]').classList.contains('done'),
        resize: document.querySelector('.qc-step[data-qc="resize"]').classList.contains('done'),
        export: document.querySelector('.qc-step[data-qc="export"]').classList.contains('done')
      };
    });
    check('Template coach tracks paint, resize and export', coach.shown && coach.paint && coach.resize && coach.export, JSON.stringify(coach));

    const overflow = await page.evaluate(()=>Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    check('desktop: no horizontal overflow', overflow <= 2, String(overflow));
    check('desktop: zero runtime errors', errors.length === 0, errors.slice(0,3).join(' | '));
    await page.close();

    // ---------------- mobile ----------------
    const mob = await browser.newPage();
    const mErrors = [];
    mob.on('pageerror', e=>mErrors.push('pageerror: '+e.message));
    await mob.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await mob.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await ready(mob, true);

    const mobTemplate = await mob.evaluate(async ()=>{
      window.quickBuild('robot');
      await new Promise(r=>setTimeout(r,120));
      return {
        blocks: window.blocks.length,
        selected: window.selectedBlocks.length,
        bar: document.getElementById('selectionBar').classList.contains('show'),
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      };
    });
    check('mobile: template is auto-selected', mobTemplate.selected === mobTemplate.blocks && mobTemplate.blocks > 1, JSON.stringify(mobTemplate));
    check('mobile: selection bar is visible', mobTemplate.bar, JSON.stringify(mobTemplate));
    check('mobile: selection bar causes no overflow', mobTemplate.overflow <= 2, String(mobTemplate.overflow));

    const mobRotate = await mob.evaluate(async ()=>{
      window.setTool('move');
      const m = window.blocks[0];
      window.selectedBlocks.length = 0;
      window.selectBlock(m);
      window.updateTouchGizmo();
      const el = document.querySelector('#touchGizmo [data-tg="rotate"]');
      const r = el.getBoundingClientRect();
      const x = r.left+r.width/2, y = r.top+r.height/2;
      const before = m.userData.rot || 0;
      const fire = (type, cx, cy) => {
        const target = type === 'pointerdown' ? el : window;
        target.dispatchEvent(new PointerEvent(type, {bubbles:true,cancelable:true,clientX:cx,clientY:cy,pointerId:51,pointerType:'touch',isPrimary:true,buttons:type==='pointerup'?0:1}));
      };
      fire('pointerdown', x, y);
      fire('pointermove', x+96, y);
      fire('pointerup', x+96, y);
      return { before, after: m.userData.rot || 0, shown: getComputedStyle(el).display !== 'none' };
    });
    check('mobile: TURN handle rotates the block', mobRotate.shown && Math.abs(mobRotate.after-mobRotate.before) > 10, JSON.stringify(mobRotate));

    const mOverflow = await mob.evaluate(()=>Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    check('mobile: no horizontal overflow', mOverflow <= 2, String(mOverflow));
    check('mobile: zero runtime errors', mErrors.length === 0, mErrors.slice(0,3).join(' | '));
    await mob.close();
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB CONTROL CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
