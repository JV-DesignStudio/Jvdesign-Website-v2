// webgl-fallback.js (A1694): heavy 3D pages must degrade honestly, not break,
// when a school device has WebGL switched off.
//
// Launches Chromium with WebGL disabled and checks every 3D builder at 390 and
// 1440: the page must mark itself, show the fallback panel, offer working
// alternatives, throw no uncaught errors and not overflow. A control run with
// WebGL enabled proves the panel does not appear on capable devices.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 19262;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
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
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let failures = 0;
function check(name, ok, detail='') {
  console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));
  if(!ok) failures++;
}
function localFileExists(href){
  try{
    const u = new URL(href, 'http://site/');
    if(!u.pathname || u.pathname==='/' ) return false;
    return fs.existsSync(path.join(root, decodeURIComponent(u.pathname)));
  }catch(e){ return false; }
}

const BUILDERS = [
  'rocket-builder','robot-builder','castle-builder','fairy-tale-builder',
  'phone-stand-builder','pirate-ship-builder','pirate-cannon-builder',
  'race-car-builder','space-station-builder','steampunk-airship-builder',
  'submarine-builder',
];
const WEBGL_OFF = ['--no-sandbox','--disable-setuid-sandbox','--disable-3d-apis','--disable-webgl','--disable-webgl2'];

async function open(browser, url, vp){
  const page = await browser.newPage();
  await page.setViewport({width:vp.w,height:vp.h,isMobile:vp.m,hasTouch:vp.m,deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', e=>errors.push((e.message||'').split('\n')[0]));
  await page.goto(`http://127.0.0.1:${port}${url}`, {waitUntil:'networkidle2', timeout:60000});
  await sleep(1200);
  return {page, errors};
}

(async()=>{
  await new Promise(r=>server.listen(port,r));
  const off = await puppeteer.launch({headless:'new', args:WEBGL_OFF});
  try {
    // 1. Every WebGL builder degrades honestly at 390 and 1440.
    for(const name of BUILDERS){
      for(const vp of [{n:'390',w:390,h:844,m:true},{n:'1440',w:1440,h:900,m:false}]){
        const {page, errors} = await open(off, `/workshops/${name}.html`, vp);
        const st = await page.evaluate(()=>{
          const panel = document.getElementById('jvds-webgl-fallback');
          const shown = el=>{ if(!el) return false; const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); return cs.display!=='none' && cs.visibility!=='hidden' && r.height>0; };
          let gl=false; try{ const c=document.createElement('canvas'); gl=!!(c.getContext('webgl')||c.getContext('experimental-webgl')); }catch(e){}
          const links = panel ? [...panel.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')) : [];
          return {
            gl,
            marked: document.documentElement.classList.contains('jvds-no-webgl'),
            panelShown: shown(panel),
            framework: !!(window.THREE && window.THREE.WebGLRenderer && window.THREE.WebGLRenderer.__jvdsNoWebGL),
            links,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        check(`${name} ${vp.n}: WebGL is actually off`, st.gl===false);
        check(`${name} ${vp.n}: page marks the no-WebGL state`, st.marked);
        check(`${name} ${vp.n}: fallback panel is shown`, st.panelShown);
        check(`${name} ${vp.n}: renderer is stubbed so the page does not crash`, st.framework);
        check(`${name} ${vp.n}: offers Pixel Studio`, st.links.includes('/tools/pixel-studio.html#first-mission'));
        check(`${name} ${vp.n}: offers the 2D level designer`, st.links.includes('/tools/level-designer.html'));
        check(`${name} ${vp.n}: alternative links resolve`, localFileExists('/tools/pixel-studio.html') && localFileExists('/tools/level-designer.html'));
        check(`${name} ${vp.n}: no uncaught page errors`, errors.length===0, errors.slice(0,2).join(' | '));
        check(`${name} ${vp.n}: no horizontal overflow`, st.overflow<=0, String(st.overflow));
        await page.close();
      }
    }

    // 2. The 2D companion tools already work without WebGL.
    for(const name of ['voxel-studio','world-builder-3d']){
      const {page, errors} = await open(off, `/workshops/${name}.html`, {w:390,h:844,m:true});
      const st = await page.evaluate(()=>({
        canvas: !!document.querySelector('#vxCanvas'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check(`${name} 390: 2D canvas still renders without WebGL`, st.canvas);
      check(`${name} 390: no uncaught page errors`, errors.length===0, errors.slice(0,2).join(' | '));
      check(`${name} 390: no horizontal overflow`, st.overflow<=0, String(st.overflow));
      await page.close();
    }

    // 3. The hub is honest about the requirement and links to the fallbacks.
    const {page: hub} = await open(off, '/pages/3d-builders.html', {w:390,h:844,m:true});
    const hubState = await hub.evaluate(()=>{
      const text = document.body.innerText || '';
      const links = [...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
      return {
        mentions: /webgl/i.test(text),
        pixel: links.includes('../tools/pixel-studio.html#first-mission'),
        level: links.includes('../tools/level-designer.html'),
      };
    });
    check('3D Builders hub mentions the WebGL requirement', hubState.mentions);
    check('3D Builders hub links to Pixel Studio', hubState.pixel);
    check('3D Builders hub links to the 2D level designer', hubState.level);
    await hub.close();
  } finally {
    await off.close().catch(()=>{});
  }

  // 4. Control: a capable browser must not show the fallback.
  const on = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  try {
    const {page, errors} = await open(on, '/workshops/rocket-builder.html', {w:1440,h:900,m:false});
    const st = await page.evaluate(()=>({
      gl: (()=>{ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl')||c.getContext('experimental-webgl')); }catch(e){ return false; } })(),
      panel: !!document.getElementById('jvds-webgl-fallback'),
      marked: document.documentElement.classList.contains('jvds-no-webgl'),
    }));
    check('control: WebGL is available', st.gl===true);
    check('control: fallback panel is not shown', st.panel===false);
    check('control: page is not marked no-WebGL', st.marked===false);
    check('control: no uncaught page errors', errors.length===0, errors.slice(0,2).join(' | '));
    await page.close();
  } finally {
    await on.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }

  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL WEBGL-FALLBACK CHECKS PASSED');
})().catch(e=>{ console.error('Harness error:', e); try{server.close();}catch(_){} process.exit(1); });
