/* BuildLab first-run guided start (A1489).

   On a first visit with nothing saved, BuildLab should open a clear 3-step
   "Make your first thing" welcome with a starter gallery, and picking a starter
   should land the learner on a real, grounded model. A returning visitor must
   not be interrupted again.

   Run: node tests/buildlab-onboarding.js
*/
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19263;
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
    for (const vp of [{name:'mobile',w:390,h:844,m:true},{name:'desktop',w:1440,h:900,m:false}]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e=>errors.push('pageerror: '+e.message));
      await page.setViewport({width:vp.w,height:vp.h,deviceScaleFactor:1,isMobile:vp.m,hasTouch:vp.m});

      // Establish origin, then clear storage for a genuine first run.
      await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
      await page.evaluate(()=>{ try { localStorage.clear(); } catch(e) {} });
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
      await pause(1100);

      const fresh = await page.evaluate(()=>{
        const m = document.getElementById('welcomeModal');
        const vis = el => { if(!el) return false; const cs=getComputedStyle(el); return cs.display!=='none' && el.getBoundingClientRect().width>0; };
        return {
          open: !!m && (m.classList.contains('open') || getComputedStyle(m).display !== 'none'),
          steps: !!document.querySelector('#welcomeModal') && /Make your first thing in 3 steps/.test(m.textContent),
          starters: document.querySelectorAll('#starterGallery button').length,
          startersVisible: vis(document.getElementById('starterGallery'))
        };
      });
      check(vp.name+': first run opens the welcome guide', fresh.open, JSON.stringify(fresh));
      check(vp.name+': guide shows the 3-step start', fresh.steps);
      check(vp.name+': starter gallery has 7 choices', fresh.starters === 7, String(fresh.starters));
      check(vp.name+': starter gallery is on screen', fresh.startersVisible);

      // Pick a starter -> modal closes and a real, grounded model appears.
      const picked = await page.evaluate(async ()=>{
        const btn = document.querySelector('#starterGallery button');
        if (btn) btn.click();
        await new Promise(r=>setTimeout(r,250));
        const m = document.getElementById('welcomeModal');
        const b = window.blocks || [];
        let minY = Infinity;
        b.forEach(x=>{ const bottom = x.position.y - (x.userData.h||1)/2; if (bottom < minY) minY = bottom; });
        return { closed: !m || (!m.classList.contains('open') && getComputedStyle(m).display==='none'), count: b.length, minY: Number.isFinite(minY)?minY:null };
      });
      check(vp.name+': picking a starter closes the guide and builds', picked.closed && picked.count > 0 && Math.abs(picked.minY) <= 0.05, JSON.stringify(picked));

      // Returning visitor is not interrupted again.
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
      await pause(1000);
      const again = await page.evaluate(()=>{
        const m = document.getElementById('welcomeModal');
        return { open: !!m && (m.classList.contains('open') || getComputedStyle(m).display !== 'none'), seen: localStorage.getItem('jvds_buildlab_seen_v1') };
      });
      check(vp.name+': returning visitor is not re-interrupted', !again.open && again.seen === '1', JSON.stringify(again));

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
  console.log('\nALL BUILDLAB ONBOARDING CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
