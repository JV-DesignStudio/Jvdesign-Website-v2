/* BuildLab touch transform gizmo (A1471).

   On a phone the desktop TransformControls gizmo is off, so a learner needs a
   fat, obvious on-screen handle to move and resize a selected block. This test
   drives those handles with synthetic pointer events and checks the block
   actually follows: move changes the position, the up arrow changes height,
   and the size handle grows the block.

   Run: node tests/buildlab-touch.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19257;
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

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    // ---- mobile: the gizmo appears and drives the block ----
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
    await page.evaluate(() => { try { window.closeModal('welcomeModal'); } catch(e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); const b = document.getElementById('cookie-accept'); if (b) b.click(); });
    await pause(400);

    const boot = await page.evaluate(()=>({
      isTouch: typeof window.isTouchUI === 'function' ? window.isTouchUI() : null,
      hasActive: typeof window.tgActive === 'function',
      gizmo: !!document.getElementById('touchGizmo'),
      handles: document.querySelectorAll('#touchGizmo .tg-handle').length
    }));
    check('mobile: isTouchUI() reports touch', boot.isTouch === true, String(boot.isTouch));
    check('mobile: touch gizmo overlay exists', boot.gizmo);
    check('mobile: three handles (move, up, size)', boot.handles === 3, String(boot.handles));

    // Build a model, select a block, pick the Move tool.
    const shown = await page.evaluate(async ()=>{
      window.quickBuild('robot');
      await new Promise(r=>setTimeout(r,80));
      window.setTool('move');
      const mesh = window.blocks[0];
      window.selectBlock(mesh);
      window.updateTouchGizmo();
      const grid = document.getElementById('touchGizmo');
      const move = grid.querySelector('[data-tg="move"]');
      const up = grid.querySelector('[data-tg="up"]');
      const vis = el => { if(!el) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && el.getBoundingClientRect().width > 0; };
      return {
        active: window.tgActive(),
        gridShown: getComputedStyle(grid).display !== 'none',
        moveShown: vis(move), upShown: vis(up),
        moveBox: move.getBoundingClientRect().toJSON(),
        start: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }
      };
    });
    check('mobile: gizmo is active with a block selected + Move tool', shown.active && shown.gridShown, JSON.stringify({active:shown.active,grid:shown.gridShown}));
    check('mobile: MOVE + height handles visible in Move mode', shown.moveShown && shown.upShown, JSON.stringify({move:shown.moveShown,up:shown.upShown}));

    // Helper to fire synthetic pointer events inside the page.
    const fire = (type, x, y, id) => page.evaluate((type,x,y,id)=>{
      const target = type === 'pointerdown' ? document.querySelector('#touchGizmo [data-tg="'+window.__tgHandle+'"]') : window;
      const ev = new PointerEvent(type, {bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:id, pointerType:'touch', isPrimary:true, buttons: type==='pointerup'?0:1});
      target.dispatchEvent(ev);
    }, type, x, y, id);
    await page.evaluate(()=>{ window.__tgHandle = 'move'; });

    // Drag MOVE by ~150px right and 40px down.
    const m = shown.moveBox;
    const cxm = m.x + m.width/2, cym = m.y + m.height/2;
    await fire('pointerdown', cxm, cym, 7);
    await fire('pointermove', cxm + 150, cym + 40, 7);
    await fire('pointermove', cxm + 170, cym + 60, 7);
    await fire('pointerup', cxm + 170, cym + 60, 7);
    const afterMove = await page.evaluate(()=>{
      const b = window.blocks[0]; return { x:b.position.x, y:b.position.y, z:b.position.z };
    });
    const movedDist = Math.abs(afterMove.x-shown.start.x)+Math.abs(afterMove.y-shown.start.y)+Math.abs(afterMove.z-shown.start.z);
    check('mobile: dragging MOVE repositions the block', movedDist > 0.5, JSON.stringify({start:shown.start,after:afterMove}));

    // Height handle: drag up 52px -> +2 units on the grid.
    const upC = await page.evaluate(()=>{ const el=document.querySelector('#touchGizmo [data-tg="up"]'); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; });
    await page.evaluate(()=>{ window.__tgHandle = 'up'; });
    const beforeY = await page.evaluate(()=>window.blocks[0].position.y);
    await fire('pointerdown', upC.x, upC.y, 8);
    await fire('pointermove', upC.x, upC.y - 52, 8);
    await fire('pointerup', upC.x, upC.y - 52, 8);
    const afterY = await page.evaluate(()=>window.blocks[0].position.y);
    check('mobile: height handle raises the block', afterY > beforeY + 0.4, 'before='+beforeY+' after='+afterY);

    // Resize: switch to Resize tool, drag the SIZE handle outward.
    const rs = await page.evaluate(()=>{
      window.setTool('resize');
      const mesh = window.blocks[0];
      window.selectBlock(mesh);
      window.updateTouchGizmo();
      const el = document.querySelector('#touchGizmo [data-tg="resize"]');
      const r = el.getBoundingClientRect();
      return { shown: getComputedStyle(el).display !== 'none', x:r.x+r.width/2, y:r.y+r.height/2, w: mesh.userData.w };
    });
    check('mobile: SIZE handle visible in Resize mode', rs.shown, String(rs.shown));
    await page.evaluate(()=>{ window.__tgHandle = 'resize'; });
    await fire('pointerdown', rs.x, rs.y, 9);
    await fire('pointermove', rs.x + 120, rs.y + 120, 9);
    await fire('pointermove', rs.x + 180, rs.y + 180, 9);
    await fire('pointerup', rs.x + 180, rs.y + 180, 9);
    const afterW = await page.evaluate(()=>window.blocks[0].userData.w);
    check('mobile: dragging SIZE grows the block', afterW > rs.w, 'before='+rs.w+' after='+afterW);

    // Gizmo hides when the tool is not move/resize, or when nothing is selected.
    const hidden = await page.evaluate(()=>{
      window.setTool('add');
      window.updateTouchGizmo();
      const a = getComputedStyle(document.getElementById('touchGizmo')).display;
      window.setTool('move'); window.selectBlock(window.blocks[0]); window.updateTouchGizmo();
      window.deselectBlock(); window.updateTouchGizmo();
      const b = getComputedStyle(document.getElementById('touchGizmo')).display;
      return { add:a, none:b };
    });
    check('mobile: gizmo hides in Add tool and with no selection', hidden.add === 'none' && hidden.none === 'none', JSON.stringify(hidden));

    const overflow = await page.evaluate(()=>Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    check('mobile: no horizontal overflow with the gizmo', overflow <= 2, String(overflow));
    check('mobile: zero runtime errors', errors.length === 0, errors.slice(0,2).join(' | '));
    await page.close();

    // ---- desktop: no touch gizmo ----
    const desk = await browser.newPage();
    const dErrors = [];
    desk.on('pageerror', e=>dErrors.push(e.message));
    await desk.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await desk.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await desk.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
    await desk.evaluate(() => { try { window.closeModal('welcomeModal'); } catch(e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); });
    await pause(300);
    const deskState = await desk.evaluate(()=>{
      window.quickBuild('sword');
      window.setTool('move'); window.selectBlock(window.blocks[0]); window.updateTouchGizmo();
      return { isTouch: window.isTouchUI(), active: window.tgActive(), grid: getComputedStyle(document.getElementById('touchGizmo')).display };
    });
    check('desktop: touch gizmo stays off', deskState.isTouch === false && deskState.active === false && deskState.grid === 'none', JSON.stringify(deskState));
    check('desktop: zero runtime errors', dErrors.length === 0, dErrors.slice(0,2).join(' | '));
    await desk.close();
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB TOUCH GIZMO CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
