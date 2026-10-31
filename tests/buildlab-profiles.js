/* BuildLab engine export profiles (A1474).

   The BuildLab engine picker now also decides the units and up-axis baked into
   OBJ and GLB exports: Roblox studs, Unreal centimetres + Z-up, Godot/Unity
   metres. This test checks the transform maths and reads a real OBJ and GLB
   back off the page to prove the header and the numbers agree.

   Run: node tests/buildlab-profiles.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19259;
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

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    await page.setViewport({width:1440,height:900});
    await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
    await page.evaluate(() => { try { window.closeModal('welcomeModal'); } catch(e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); const b = document.getElementById('cookie-accept'); if (b) b.click(); });
    await new Promise(r=>setTimeout(r,400));
    await page.evaluate(()=>{ window.setTool('add'); window.quickBuild('robot'); });
    await new Promise(r=>setTimeout(r,200));

    // Transform maths for every engine.
    const tx = await page.evaluate(()=>{
      const out = {};
      for (const eng of ['', 'roblox', 'unreal', 'godot', 'unity']) {
        window.setEngineContext(eng);
        const p = window.currentExportProfile();
        out[eng || 'generic'] = { scale:p.scale, axis:p.axis, unitShort:p.unitShort, pt:window.profilePoint(p, 1, 2, 3) };
      }
      return out;
    });
    const near=(a,b,tol)=>Math.abs(a-b)<=tol;
    check('profile generic is metres, Y-up and 1:1', tx.generic.axis==='y'&&tx.generic.scale===1&&tx.generic.pt[0]===1&&tx.generic.pt[1]===2&&tx.generic.pt[2]===3, JSON.stringify(tx.generic));
    check('profile Roblox is studs, Y-up', tx.roblox.axis==='y'&&tx.roblox.unitShort==='studs'&&near(tx.roblox.scale,1/0.28,1e-6), JSON.stringify(tx.roblox));
    check('profile Unreal is centimetres, Z-up', tx.unreal.axis==='z'&&tx.unreal.unitShort==='cm'&&tx.unreal.scale===100, JSON.stringify(tx.unreal));
    check('profile Unreal rotates (1,2,3) to Z-up (100,-300,200)',
      near(tx.unreal.pt[0],100,1e-6)&&near(tx.unreal.pt[1],-300,1e-6)&&near(tx.unreal.pt[2],200,1e-6), JSON.stringify(tx.unreal.pt));
    check('profile Godot and Unity stay metres Y-up', tx.godot.scale===1&&tx.godot.axis==='y'&&tx.unity.scale===1&&tx.unity.axis==='y', JSON.stringify({g:tx.godot,u:tx.unity}));

    // Read the real OBJ + GLB off the page for two engines.
    const files = await page.evaluate(async ()=>{
      const origCreate = document.createElement.bind(document);
      function trap(){
        let blob = null;
        document.createElement = function(t){ const el = origCreate(t); if (String(t).toLowerCase()==='a') el.click = function(){}; return el; };
        const origURL = URL.createObjectURL;
        URL.createObjectURL = function(b){ blob = b; return 'blob:stub'; };
        return { restore(){ document.createElement = origCreate; URL.createObjectURL = origURL; }, get blob(){ return blob; } };
      }
      const out = {};
      for (const eng of ['', 'unreal']) {
        window.setEngineContext(eng);
        const t = trap();
        window.exportOBJFallback();
        out[(eng||'generic')+'_obj'] = t.blob ? await t.blob.text() : '';
        t.restore();
      }
      window.setEngineContext('unreal');
      const g = trap();
      window.exportGLTF();
      await new Promise(r=>setTimeout(r,1200));
      out.glb = g.blob ? { size:g.blob.size, type:g.blob.type } : null;
      g.restore();
      return out;
    });

    check('generic OBJ names metres in its header', /# Units: 1 block = 1 m = 1\.000 m\b/.test(files.generic_obj), (files.generic_obj||'').split('\n')[2]||'');
    check('Unreal OBJ names centimetres and Z-up', /# Units: 1 block = 1 m = 100\.000 cm, Z-up/.test(files.unreal_obj), (files.unreal_obj||'').split('\n')[3]||'');
    const peak = t => { let m=0; (t||'').split('\n').forEach(l=>{ if(l.startsWith('v ')){ l.slice(2).split(' ').forEach(n=>{ const v=Math.abs(parseFloat(n)); if(v>m)m=v; }); } }); return m; };
    const gm = peak(files.generic_obj), um = peak(files.unreal_obj);
    check('Unreal OBJ vertices are scaled to centimetres', gm>0 && um>0 && near(um/gm,100,1), 'generic='+gm.toFixed(2)+' unreal='+um.toFixed(2));
    check('exportGLTF now writes a real binary .glb', !!(files.glb && files.glb.size>100 && /gltf-binary/.test(files.glb.type)), JSON.stringify(files.glb));

    // The engine picker persists and the preview explains it.
    const ctx = await page.evaluate(()=>{
      window.setEngineContext('roblox');
      return { saved: localStorage.getItem('jvds_buildlab_engine'), label: window.currentExportProfile().label };
    });
    check('engine choice persists and drives the profile', ctx.saved==='roblox' && ctx.label==='Roblox', JSON.stringify(ctx));

    check('zero runtime errors', errors.length === 0, errors.slice(0,3).join(' | '));
    await page.close();
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB PROFILE CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
