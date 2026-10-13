/* BuildLab shape library + per-part materials + parts list (A1476).

   BuildLab places box, cylinder, sphere, cone, pyramid, wedge and plate, and
   each part carries its own roughness/metalness/opacity. The outliner lists
   the parts so a learner can select, rename and duplicate them, and the
   OBJ + MTL export writes those material values out.

   Run: node tests/buildlab-shapes.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19267;
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

const SHAPES = ['box','cylinder','sphere','cone','pyramid','wedge','flat'];

async function ready(page){
  await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
  await page.evaluate(() => { try { window.closeModal('welcomeModal'); } catch(e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); const b = document.getElementById('cookie-accept'); if (b) b.click(); });
  await pause(400);
}

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    for (const vp of [{name:'desktop',w:1440,h:900,m:false},{name:'mobile',w:390,h:844,m:true}]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e=>errors.push('pageerror: '+e.message));
      page.on('console', m=>{ if(m.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(m.text())) errors.push('console: '+m.text()); });
      await page.setViewport({width:vp.w,height:vp.h,deviceScaleFactor:1,isMobile:vp.m,hasTouch:vp.m});
      await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
      await ready(page);

      // -- shape gallery: 7 options incl pyramid on both grids --
      const grid = await page.evaluate(()=>({
        desk: document.querySelectorAll('#shapeGrid .shape-btn').length,
        mob: document.querySelectorAll('#mob-panel-shape .mob-shape-btn').length,
        deskPyramid: !!document.querySelector('#shapeGrid [data-shape="pyramid"]'),
        mobPyramid: !!document.querySelector('#mob-panel-shape [data-mob-shape="pyramid"]'),
        deskCodes: Array.from(document.querySelectorAll('#shapeGrid .shape-btn')).map(b=>b.getAttribute('data-shape'))
      }));
      check(vp.name+': desktop shape grid offers 7 shapes', grid.desk === 7, String(grid.desk));
      check(vp.name+': mobile shape grid offers 7 shapes', grid.mob === 7, String(grid.mob));
      check(vp.name+': pyramid is in the desktop shape grid', grid.deskPyramid);
      check(vp.name+': pyramid is in the mobile shape grid', grid.mobPyramid);
      const missingShapes = SHAPES.filter(s=>!grid.deskCodes.includes(s));
      check(vp.name+': every shape is placeable from the grid', missingShapes.length===0, missingShapes.join(','));

      // -- each shape builds a real, correctly sized geometry --
      const built = await page.evaluate((shapes)=>{
        window.clearAll(true);
        const out = {};
        for (const s of shapes) {
          window.setShape(s);
          window.addBlock(0, 0.5, 0, 2, 2, 2, '#3366cc', s);
          const m = window.blocks[window.blocks.length-1];
          m.geometry.computeBoundingBox();
          const bb = m.geometry.boundingBox;
          const pos = m.geometry.attributes.position;
          out[s] = {
            shape: m.userData.shape,
            verts: pos ? pos.count : 0,
            sx: bb ? +(bb.max.x - bb.min.x).toFixed(3) : null,
            sy: bb ? +(bb.max.y - bb.min.y).toFixed(3) : null,
            finite: pos ? Array.from({length: pos.count}).every((_,i)=>Number.isFinite(pos.getX(i))&&Number.isFinite(pos.getY(i))&&Number.isFinite(pos.getZ(i))) : false
          };
        }
        return out;
      }, SHAPES);
      for (const s of SHAPES) {
        const b = built[s];
        check(vp.name+' '+s+': builds a real geometry', b.shape===s && b.verts>0 && b.finite, JSON.stringify(b));
      }
      check(vp.name+' pyramid: square base spans width=2 and height=2', Math.abs(built.pyramid.sx-2)<0.001 && Math.abs(built.pyramid.sy-2)<0.001, JSON.stringify({sx:built.pyramid.sx,sy:built.pyramid.sy}));
      check(vp.name+' pyramid: apex geometry has 18 vertices (6 tris)', built.pyramid.verts===18, String(built.pyramid.verts));

      // -- per-part material controls write to the part AND the export --
      const mat = await page.evaluate(()=>{
        window.clearAll(true);
        window.setShape('box');
        window.addBlock(0, 0.5, 0, 1, 1, 1, '#123456', 'box');
        const m = window.blocks[window.blocks.length-1];
        window.selectBlock(m);
        window.updateMaterial('metallic', 0.8);
        window.updateMaterial('roughness', 0.1);
        window.updateMaterial('opacity', 0.4);
        const afterSliders = { mt:m.material.metalness, rh:m.material.roughness, op:m.material.opacity, ud:{ mt:m.userData.metalness, rh:m.userData.roughness, op:m.userData.opacity } };
        window.applyPreset('metal');
        const afterPreset = { mt:m.material.metalness, rh:m.material.roughness, op:m.material.opacity };
        return { afterSliders, afterPreset };
      });
      const s1 = mat.afterSliders;
      check(vp.name+': material sliders set the part finish', s1.mt===0.8 && s1.rh===0.1 && s1.op===0.4, JSON.stringify(s1));
      check(vp.name+': material sliders are stored on the part', s1.ud.mt===0.8 && s1.ud.rh===0.1 && s1.ud.op===0.4, JSON.stringify(s1.ud));
      check(vp.name+': material preset applies to the part', mat.afterPreset.mt===1 && mat.afterPreset.rh===0.2 && mat.afterPreset.op===1, JSON.stringify(mat.afterPreset));

      // -- parts list: select, rename, duplicate --
      const parts = await page.evaluate(()=>{
        window.clearAll(true);
        window.setShape('box');
        window.addBlock(0, 0.5, 0, 1, 1, 1, '#aa3355', 'box');
        window.addBlock(2, 0.5, 0, 1, 1, 1, '#33aa55', 'box');
        window.renderOutliner();
        const rowsBefore = document.querySelectorAll('#outlinerList [data-block-id]').length;
        const first = window.blocks[0];
        window.selectBlock(first);
        window.updateBlockName('Roof Panel');
        const named = first.userData.blockName;
        const before = window.blocks.length;
        window.duplicateSingleBlock(first.userData.blockId);
        const after = window.blocks.length;
        window.renderOutliner();
        const rowsAfter = document.querySelectorAll('#outlinerList [data-block-id]').length;
        return { rowsBefore, named, before, after, rowsAfter };
      });
      check(vp.name+': parts list lists every part', parts.rowsBefore===2, String(parts.rowsBefore));
      check(vp.name+': a part can be renamed from the list', parts.named==='Roof Panel', parts.named);
      check(vp.name+': a part can be duplicated from the list', parts.after===parts.before+1 && parts.rowsAfter===3, JSON.stringify({before:parts.before,after:parts.after,rowsAfter:parts.rowsAfter}));

      // -- OBJ + MTL export carries metalness, roughness and opacity --
      const mtl = await page.evaluate(async ()=>{
        window.clearAll(true);
        window.setShape('cone');
        window.addBlock(0, 0.5, 0, 2, 2, 2, '#7fd0ff', 'cone');
        const m = window.blocks[window.blocks.length-1];
        window.selectBlock(m);
        window.updateMaterial('metallic', 1);
        window.updateMaterial('roughness', 0.2);
        window.updateMaterial('opacity', 0.5);

        const blobs = [];
        const origCreate = document.createElement.bind(document);
        const origURL = URL.createObjectURL;
        document.createElement = function(t){ const el = origCreate(t); if (String(t).toLowerCase()==='a') el.click = function(){}; return el; };
        URL.createObjectURL = function(b){ blobs.push(b); return 'blob:stub'; };
        try { window.exportOBJWithMTL(); } finally { document.createElement = origCreate; URL.createObjectURL = origURL; }
        const obj = blobs[0] ? await blobs[0].text() : '';
        const mtl = blobs[1] ? await blobs[1].text() : '';
        return { obj, mtl };
      });
      check(vp.name+': OBJ references a material', /usemtl mat_\d+/.test(mtl.obj), (mtl.obj||'').split('\n').filter(l=>/usemtl/.test(l)).join(' | '));
      check(vp.name+': MTL carries metalness (Pm)', /(^|\n)Pm 1\.000/.test(mtl.mtl), (mtl.mtl||'').split('\n').filter(l=>/^Pm/.test(l)).join(' | '));
      check(vp.name+': MTL carries roughness (Pr)', /(^|\n)Pr 0\.200/.test(mtl.mtl), (mtl.mtl||'').split('\n').filter(l=>/^Pr/.test(l)).join(' | '));
      check(vp.name+': MTL carries opacity (d)', /(^|\n)d 0\.500/.test(mtl.mtl), (mtl.mtl||'').split('\n').filter(l=>/^d /.test(l)).join(' | '));
      check(vp.name+': MTL no longer abuses Tr for metalness', !/(^|\n)Tr /.test(mtl.mtl), (mtl.mtl||'').split('\n').filter(l=>/^Tr/.test(l)).join(' | ') || 'no Tr token');

      const overflow = await page.evaluate(()=>Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
      check(vp.name+': no horizontal overflow', overflow <= 2, String(overflow));
      check(vp.name+': zero runtime errors', errors.length === 0, errors.slice(0,3).join(' | '));

      await page.close();
    }
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB SHAPE & MATERIAL CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
