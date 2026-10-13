/* BuildLab environment presets (A1488).

   The scene-look presets change background, fog, ambient/directional light and
   the reflection map in one tap. This test drives each preset on desktop and
   mobile and reads the live scene back through envState() to prove the values
   actually changed, plus that the choice persists and the mobile drawer offers
   the same controls.

   Run: node tests/buildlab-presets.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19261;
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

const EXPECT = {
  studio:  { bg:'1a1a2e', amb:0.6,  dir:0.8 },
  day:     { bg:'8ecae6', amb:0.85, dir:1.35 },
  sunset:  { bg:'2a1a2e', amb:0.55, dir:1.10 },
  night:   { bg:'0b0f1e', amb:0.40, dir:0.55 },
  cartoon: { bg:'ffe9b8', amb:1.05, dir:0.60 }
};

async function ready(page){
  await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
  await page.evaluate(() => { try { window.closeModal('welcomeModal'); } catch(e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); const b = document.getElementById('cookie-accept'); if (b) b.click(); });
  await pause(500);
}

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    // ---- desktop ----
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    await page.setViewport({width:1440,height:900});
    await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await ready(page);

    const boot = await page.evaluate(()=>({
      hasFn: typeof window.applyEnvPreset === 'function' && typeof window.envState === 'function',
      btns: document.querySelectorAll('#envPresetRow .scene-preset-btn').length
    }));
    check('desktop: env preset API exposed', boot.hasFn);
    check('desktop: five scene-look buttons', boot.btns === 5, String(boot.btns));

    for (const [id, exp] of Object.entries(EXPECT)) {
      const st = await page.evaluate((id)=>{ window.applyEnvPreset(id); return window.envState(); }, id);
      const bgOk = (st.bg||'').replace('#','').toLowerCase() === exp.bg;
      const lightOk = Math.abs((st.amb||-1)-exp.amb)<0.001 && Math.abs((st.dir||-1)-exp.dir)<0.001;
      check('desktop: '+id+' applies background + lights', st.preset===id && bgOk && lightOk, JSON.stringify(st));
      check('desktop: '+id+' sets fog', st.fog>0, 'fog='+st.fog);
    }

    const sync = await page.evaluate(()=>{
      window.applyEnvPreset('night');
      return { ambText: (document.getElementById('ambLightVal')||{}).textContent, dirText: (document.getElementById('dirLightVal')||{}).textContent,
               active: Array.from(document.querySelectorAll('#envPresetRow .scene-preset-btn')).filter(b=>b.dataset.env==='night' && b.style.background).length,
               saved: localStorage.getItem('buildlab_env') };
    });
    check('desktop: sliders and highlight follow the preset', sync.ambText==='0.4' && sync.dirText==='0.6' && sync.active===1, JSON.stringify(sync));    check('desktop: choice is saved', sync.saved==='night', sync.saved);

    const fb = await page.evaluate(()=>{ window.applyEnvPreset('nonsense'); return window.envState().preset; });
    check('desktop: unknown preset falls back to studio', fb==='studio', fb);

    // Persistence across reload.
    await page.evaluate(()=>window.applyEnvPreset('cartoon'));
    await page.reload({waitUntil:'domcontentloaded'});
    await ready(page);
    await pause(900);
    const restored = await page.evaluate(()=>window.envState().preset);
    check('desktop: chosen scene look restores on reload', restored==='cartoon', restored);

    const overflow = await page.evaluate(()=>Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    check('desktop: no horizontal overflow', overflow <= 2, String(overflow));
    check('desktop: zero runtime errors', errors.length === 0, errors.slice(0,3).join(' | '));
    await page.close();

    // ---- mobile ----
    const mob = await browser.newPage();
    const mErrors = [];
    mob.on('pageerror', e=>mErrors.push('pageerror: '+e.message));
    await mob.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await mob.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
    await ready(mob);
    await mob.evaluate(()=>{ window.mobTab && window.mobTab('tools'); });
    await pause(400);
    const mobState = await mob.evaluate(()=>{
      const vis = el => { if(!el) return false; const cs=getComputedStyle(el); return cs.display!=='none' && el.getBoundingClientRect().width>0; };
      const btns = Array.from(document.querySelectorAll('#mobDrawer .scene-preset-btn'));
      const before = window.envState().preset;
      const sunset = btns.find(b=>b.dataset.env==='sunset');
      if (sunset) sunset.click();
      return { count: btns.length, anyVisible: btns.some(vis), before, after: window.envState().preset, fog: window.envState().fog };
    });
    check('mobile: scene-look buttons live in the drawer', mobState.count===5 && mobState.anyVisible, JSON.stringify(mobState));
    check('mobile: tapping a scene look changes the scene', mobState.after==='sunset', JSON.stringify(mobState));
    check('mobile: fog stays lighter on the phone budget', mobState.fog>0 && mobState.fog<0.030, 'fog='+mobState.fog);

    const mOverflow = await mob.evaluate(()=>Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    check('mobile: no horizontal overflow', mOverflow <= 2, String(mOverflow));
    check('mobile: zero runtime errors', mErrors.length === 0, mErrors.slice(0,3).join(' | '));
    await mob.close();
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB PRESET CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
