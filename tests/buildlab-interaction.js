/* BuildLab move + resize interaction (A2932).

   Regression cover for the canvas controls:
   - Resize tool switches the desktop gizmo to scale, Move switches to translate.
   - Clicking a gizmo axis never deselects the block under it.
   - Grid snap Off keeps finite positions (old snap() divided by zero).
   - Dragging a block with Move updates the position panel and autosaves.
   - Touch MOVE stays on the floor plane and never changes Y.
   - Touch SIZE grows the block from its base and keeps it grounded.
   - Baking a gizmo scale anchors the block base instead of sinking it.

   Run: node tests/buildlab-interaction.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19283;
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

    const toolModes = await page.evaluate(()=>{
      window.clearAll(true);
      const m = window.addBlock(0,0,0,2,2,2,'#3366cc','box');
      window.setTool('resize');
      window.selectBlock(m);
      const resizeMode = window.transformControls.mode;
      window.setTool('move');
      window.selectBlock(m);
      const moveMode = window.transformControls.mode;
      return {resizeMode, moveMode, tool: window.currentTool};
    });
    check('desktop: Resize tool shows scale handles', toolModes.resizeMode === 'scale', toolModes.resizeMode);
    check('desktop: Move tool shows translate handles', toolModes.moveMode === 'translate', toolModes.moveMode);

    const gizmoClick = await page.evaluate(()=>{
      const m = window.blocks[0];
      window.setTool('resize');
      window.selectBlock(m);
      window.transformControls.axis = 'X';
      const canvas = window.renderer.domElement;
      const r = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, button:0, clientX:r.left+r.width/2, clientY:r.top+r.height/2}));
      const stillSelected = window.selectedBlock === m;
      window.transformControls.axis = null;
      return {stillSelected};
    });
    check('desktop: clicking a gizmo axis keeps the block selected', gizmoClick.stillSelected, String(gizmoClick.stillSelected));

    const snapOff = await page.evaluate(()=>{
      const m = window.blocks[0];
      window.setTool('move');
      window.setGridSize('0');
      window.selectBlock(m);
      window.updatePosition('x', 2.345);
      window.updatePosition('z', -1.678);
      return {x:m.position.x, z:m.position.z, finite: Number.isFinite(m.position.x) && Number.isFinite(m.position.z), grid: document.getElementById('gridSizeVal').textContent};
    });
    check('desktop: grid Off keeps finite X/Z positions', snapOff.finite && Math.abs(snapOff.x-2.345)<0.002 && Math.abs(snapOff.z+1.678)<0.002, JSON.stringify(snapOff));

    const moved = await page.evaluate(async ()=>{
      window.clearAll(true);
      const m = window.addBlock(0,0,0,2,2,2,'#3366cc','box');
      window.setTool('move');
      window.frameAll(true);
      window.selectBlock(m);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const canvas = window.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const v = new window.THREE.Vector3(m.position.x, m.position.y, m.position.z).project(window.camera);
      const sx = rect.left + (v.x*0.5+0.5)*rect.width;
      const sy = rect.top + (-v.y*0.5+0.5)*rect.height;
      window.transformControls.axis = null;
      const before = {x:m.position.x, y:m.position.y, z:m.position.z};
      canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
      canvas.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, cancelable:true, button:0, clientX:sx+150, clientY:sy+90}));
      document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, cancelable:true, button:0, clientX:sx+150, clientY:sy+90}));
      const after = {x:m.position.x, y:m.position.y, z:m.position.z};
      const propX = parseFloat(document.getElementById('propX').value);
      await new Promise(r=>setTimeout(r, 1100));
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('buildlab_autosave') || 'null'); } catch(e) {}
      const savedBlock = saved && Array.isArray(saved.blocks) ? saved.blocks[0] : null;
      return {
        before, after, propX,
        finite: Number.isFinite(after.x) && Number.isFinite(after.z),
        dist: Math.abs(after.x-before.x) + Math.abs(after.z-before.z),
        propMatches: Math.abs(propX-after.x) <= 0.15,
        autosaveX: savedBlock ? savedBlock.x : null,
        autosaveMatches: savedBlock ? Math.abs(savedBlock.x-after.x) <= 0.02 : false
      };
    });
    check('desktop: dragging Move repositions the block', moved.dist > 0.5 && moved.finite, JSON.stringify({before:moved.before,after:moved.after}));
    check('desktop: Move keeps the block height', Math.abs(moved.after.y-moved.before.y) < 1e-6, 'y='+moved.after.y);
    check('desktop: Move updates the position panel', moved.propMatches, 'propX='+moved.propX);
    check('desktop: Move is committed to autosave', moved.autosaveMatches, 'savedX='+moved.autosaveX);

    const baked = await page.evaluate(()=>{
      window.clearAll(true);
      const m = window.addBlock(0,0,0,2,2,2,'#3366cc','box');
      window.setTool('resize');
      window.selectBlock(m);
      const baseBefore = m.position.y - m.userData.h/2;
      m.scale.set(1,2,1);
      window.bakeGizmoTransform();
      return {
        h:m.userData.h, scaleY:m.scale.y,
        baseBefore, baseAfter:m.position.y - m.userData.h/2
      };
    });
    check('desktop: scale bake grows the block height', Math.abs(baked.h-4) < 0.01 && Math.abs(baked.scaleY-1) < 1e-6, JSON.stringify(baked));
    check('desktop: scale bake keeps the block on its base', Math.abs(baked.baseAfter-baked.baseBefore) < 0.01, JSON.stringify({before:baked.baseBefore,after:baked.baseAfter}));

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

    const mobileMove = await mob.evaluate(async ()=>{
      window.quickBuild('robot');
      await new Promise(r=>setTimeout(r,100));
      window.setGridSize('0');
      window.setTool('move');
      const m = window.blocks[0];
      window.selectBlock(m);
      window.updateTouchGizmo();
      const el = document.querySelector('#touchGizmo [data-tg="move"]');
      const r = el.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const before = {x:m.position.x, y:m.position.y, z:m.position.z};
      const fire = (type, cx, cy) => {
        const target = type === 'pointerdown' ? el : window;
        target.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, clientX:cx, clientY:cy, pointerId:41, pointerType:'touch', isPrimary:true, buttons:type==='pointerup'?0:1}));
      };
      fire('pointerdown', x, y);
      fire('pointermove', x+140, y+70);
      fire('pointerup', x+140, y+70);
      return {
        before, after:{x:m.position.x,y:m.position.y,z:m.position.z},
        finite: Number.isFinite(m.position.x) && Number.isFinite(m.position.y) && Number.isFinite(m.position.z),
        dist: Math.abs(m.position.x-before.x) + Math.abs(m.position.z-before.z),
        dy: Math.abs(m.position.y-before.y)
      };
    });
    check('mobile: MOVE handle moves the block', mobileMove.dist > 0.4 && mobileMove.finite, JSON.stringify({before:mobileMove.before,after:mobileMove.after}));
    check('mobile: MOVE handle never changes height', mobileMove.dy < 1e-6, 'dy='+mobileMove.dy);
    check('mobile: grid Off keeps the moved block finite', mobileMove.finite, JSON.stringify(mobileMove.after));

    const mobileResize = await mob.evaluate(async ()=>{
      window.setTool('resize');
      const m = window.blocks[0];
      window.selectBlock(m);
      window.updateTouchGizmo();
      const el = document.querySelector('#touchGizmo [data-tg="resize"]');
      const r = el.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const before = {w:m.userData.w, h:m.userData.h, base:m.position.y - m.userData.h/2};
      const fire = (type, cx, cy) => {
        const target = type === 'pointerdown' ? el : window;
        target.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, clientX:cx, clientY:cy, pointerId:42, pointerType:'touch', isPrimary:true, buttons:type==='pointerup'?0:1}));
      };
      fire('pointerdown', x, y);
      fire('pointermove', x+150, y+150);
      fire('pointerup', x+150, y+150);
      const after = {w:m.userData.w, h:m.userData.h, base:m.position.y - m.userData.h/2};
      return {before, after, finite:Number.isFinite(after.w)&&Number.isFinite(after.h)};
    });
    check('mobile: SIZE handle grows the block', mobileResize.after.w > mobileResize.before.w && mobileResize.after.h > mobileResize.before.h && mobileResize.finite, JSON.stringify(mobileResize));
    check('mobile: SIZE keeps the block base on the floor', Math.abs(mobileResize.after.base-mobileResize.before.base) < 0.01, JSON.stringify({before:mobileResize.before.base,after:mobileResize.after.base}));

    const mOverflow = await mob.evaluate(()=>Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    check('mobile: no horizontal overflow', mOverflow <= 2, String(mOverflow));
    check('mobile: zero runtime errors', mErrors.length === 0, mErrors.slice(0,3).join(' | '));
    await mob.close();
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB INTERACTION CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
