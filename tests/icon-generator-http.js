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
const pause = ms => new Promise(r=>setTimeout(r, ms));
const URL_BASE = 'http://127.0.0.1:'+port+'/tools/icon-generator.html';

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    for (const vp of [{name:'mobile',w:390,h:844,m:true},{name:'desktop',w:1440,h:900,m:false}]) {
      const page = await browser.newPage();
      page.on('dialog', d => d.dismiss().catch(()=>{}));
      const errors = [];
      page.on('pageerror', e=>errors.push('pageerror: '+e.message));
      page.on('console', m=>{
        if(m.type() !== 'error') return;
        const text = m.text();
        if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ERR_FAILED/i.test(text)) return;
        errors.push('console: '+text);
      });
      await page.setViewport({width:vp.w,height:vp.h,deviceScaleFactor:1,isMobile:vp.m,hasTouch:vp.m});
      await page.goto(URL_BASE, {waitUntil:'domcontentloaded', timeout:30000});
      await page.waitForSelector('#cvMain', {timeout:20000}).catch(()=>{});
      await pause(700);
      await page.evaluate(()=>{ try{ closeStart(); }catch(e){} });
      await pause(200);

      const shell = await page.evaluate(()=>({
        title: document.title,
        skipLinks: document.querySelectorAll('.skip-link').length,
        headers: document.querySelectorAll('header.site-header').length,
        footers: document.querySelectorAll('.jvds-tools-footer').length,
        canvases: document.querySelectorAll('#app canvas').length,
        brief: !!document.querySelector('.icon-brief'),
        stepCount: document.querySelectorAll('.brief-steps li').length,
        controls: document.querySelectorAll('.ctrl-section').length,
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      }));
      check(vp.name+': title is Icon Generator', /Icon Generator/i.test(shell.title), shell.title);
      check(vp.name+': single skip link', shell.skipLinks === 1, String(shell.skipLinks));
      check(vp.name+': single shared header', shell.headers === 1, String(shell.headers));
      check(vp.name+': single tools footer', shell.footers === 1, String(shell.footers));
      check(vp.name+': three live preview canvases', shell.canvases === 3, String(shell.canvases));
      check(vp.name+': workflow brief present', shell.brief && shell.stepCount === 4, 'brief='+shell.brief+' steps='+shell.stepCount);
      check(vp.name+': no horizontal overflow', shell.overflow <= 2, String(shell.overflow));

      // A936: on phones the live preview must come before the controls and stay pinned
      if (vp.name === 'mobile') {
        const layout = await page.evaluate(()=>{
          const p = document.getElementById('preview-wrap').getBoundingClientRect();
          const c = document.getElementById('controls').getBoundingClientRect();
          return { previewTop: Math.round(p.top), controlsTop: Math.round(c.top), sticky: getComputedStyle(document.getElementById('preview-wrap')).position };
        });
        check('mobile: live preview sits above the controls', layout.previewTop < layout.controlsTop, JSON.stringify(layout));
        check('mobile: preview is pinned while scrolling', layout.sticky === 'sticky', layout.sticky);
      }

      // A936: Help must open the how-it-works overlay with no error
      errors.length = 0;
      await page.evaluate(()=>document.querySelector('.brief-help').click());
      await pause(250);
      const help = await page.evaluate(()=>({ shown: document.getElementById('ig-overlay').classList.contains('show') }));
      check(vp.name+': Help opens the guide', help.shown);
      check(vp.name+': Help raises no runtime error', !errors.some(e=>/EmberGuide/.test(e)), errors.join(' | '));
      await page.evaluate(()=>closeStart());
      await pause(150);

      // A936: canvas actually paints pixels (so export produces a real image)
      const painted = await page.evaluate(()=>{
        const cv=document.getElementById('cvMain'), ctx=cv.getContext('2d');
        const d=ctx.getImageData(0,0,cv.width,cv.height).data;
        let opaque=0; for(let i=3;i<d.length;i+=4){ if(d[i]>0) opaque++; }
        return opaque;
      });
      check(vp.name+': preview canvas paints pixels', painted > 1000, String(painted));

      // A936: Share Link round-trips the whole design on a fresh load
      await page.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} });
      await page.evaluate(()=>{
        document.querySelector('.symbol-btn[data-id="skull"]').click();
        const pal=document.querySelector('.palette-chip[data-id="neon"]'); if(pal) pal.click();
      });
      await pause(300);
      const palOn = await page.evaluate(()=>document.querySelector('.palette-chip.on')?.dataset.id);
      check(vp.name+': selecting a palette highlights it', palOn === 'neon', String(palOn));
      const hash = await page.evaluate(()=>{ copyIconShareLink(); return location.hash; });
      check(vp.name+': share link carries payload', /^#icon=.{40,}/.test(hash), hash.slice(0,40));
      await page.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} });
      await page.goto(URL_BASE + hash, {waitUntil:'domcontentloaded', timeout:30000});
      await pause(700);
      const shared = await page.evaluate(()=>({
        symbol: document.querySelector('.symbol-btn.on')?.dataset.id,
        palette: document.querySelector('.palette-chip.on')?.dataset.id,
        accent: document.getElementById('inAccent').value,
        overlay: document.getElementById('ig-overlay').classList.contains('show')
      }));
      check(vp.name+': shared link restores the design', shared.symbol === 'skull' && shared.palette === 'neon' && shared.accent === '#00d4aa', JSON.stringify(shared));
      check(vp.name+': shared link skips the welcome overlay', shared.overlay === false, String(shared.overlay));

      // A936: autosave persists and undo works
      await page.evaluate(()=>{ document.querySelector('.symbol-btn[data-id="crown"]').click(); });
      await pause(900);
      await page.goto(URL_BASE, {waitUntil:'domcontentloaded', timeout:30000});
      await pause(700);
      const persisted = await page.evaluate(()=>document.querySelector('.symbol-btn.on')?.dataset.id);
      check(vp.name+': design autosaves across reloads', persisted === 'crown', String(persisted));
      const undone = await page.evaluate(()=>{
        document.querySelector('.symbol-btn[data-id="heart"]').click();
        undo();
        return document.querySelector('.symbol-btn.on')?.dataset.id;
      });
      check(vp.name+': undo restores the previous symbol', undone === 'crown', String(undone));

      check(vp.name+': zero runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL ICON GENERATOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
