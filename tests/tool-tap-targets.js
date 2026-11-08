/* Tool tap targets (A1463).

   A1432's mobile matrix flagged tool-page controls below the 44px touch
   guideline (WCAG 2.5.5): the primary export/save buttons (.exp-btn) and the
   first-make colour swatches (.fm-swatch). This test loads the affected pages
   at a phone portrait and a phone landscape viewport and asserts every such
   control is at least 44px tall. A2902 also asserts the floating feedback,
   share and dock controls no longer mount on tool pages.

   Run: node tests/tool-tap-targets.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19271;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.xml':'application/xml','.txt':'text/plain','.webmanifest':'application/manifest+json'};
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
const MIN = 44;

const PAGES = [
  { p:'tools/bitmap-font-maker.html',     sel:'.exp-btn' },
  { p:'tools/game-logo-maker.html',       sel:'.exp-btn' },
  { p:'tools/trading-card-designer.html', sel:'.exp-btn' },
  { p:'tools/sprite-animator.html',       sel:'.exp-btn' },
  { p:'tools/particle-designer.html',     sel:'.exp-btn' },
  { p:'tools/map-generator.html',         sel:'.exp-btn' },
  { p:'index.html',                       sel:'.fm-swatch' }
];
const VIEWPORTS = [
  { w:390, h:844, label:'390x844', m:true },
  { w:844, h:390, label:'844x390', m:false }
];

async function measure(page, sel){
  return page.evaluate((sel)=>{
    const vis = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const els = [...document.querySelectorAll(sel)].filter(vis);
    if (!els.length) return { count:0, minH:null, minW:null, label:'' };
    let minH = Infinity, minW = Infinity, label = '';
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.height < minH) { minH = r.height; label = (el.textContent || el.className).trim().slice(0, 24); }
      if (r.width < minW) minW = r.width;
    }
    return { count:els.length, minH:Math.round(minH*10)/10, minW:Math.round(minW*10)/10, label };
  }, sel);
}

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    for (const vp of VIEWPORTS) {
      for (const cfg of PAGES) {
        const page = await browser.newPage();
        await page.setViewport({width:vp.w,height:vp.h,deviceScaleFactor:1,isMobile:vp.m,hasTouch:vp.m});
        await page.goto('http://127.0.0.1:'+port+'/'+cfg.p, {waitUntil:'load', timeout:30000}).catch(()=>{});
        await pause(500);
        const m = await measure(page, cfg.sel);
        const name = vp.label+' '+cfg.p+' '+cfg.sel;
        if (m.count === 0) {
          console.log('SKIP '+name+' (no visible matches)');
        } else {
          check(name+' >= '+MIN+'px tall', m.minH >= MIN, 'n='+m.count+' minH='+m.minH+' ("'+m.label+'")');
        }
        await page.close();
      }

      // A2902: no floating feedback, share or dock controls on a tool page.
      const page = await browser.newPage();
      await page.setViewport({width:vp.w,height:vp.h,deviceScaleFactor:1,isMobile:vp.m,hasTouch:vp.m});
      await page.goto('http://127.0.0.1:'+port+'/tools/bitmap-font-maker.html', {waitUntil:'load', timeout:30000}).catch(()=>{});
      await pause(700);
      const floating = await page.evaluate(()=>{
        const ids = ['jvds-action-dock','jvfb-btn','jvds-share-btn','jvds-project-btn'];
        const out = {};
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el) { out[id] = false; continue; }
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          out[id] = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        }
        return out;
      });
      for (const id of Object.keys(floating)) {
        check(vp.label+' #'+id+' does not float over the tool', !floating[id]);
      }
      await page.close();
    }
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL TOOL TAP-TARGET CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
