const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19253;
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

const TEMPLATES = ['robot','creature','house','car','tower','tree','sword','chest','chair','spaceship','castle','dinosaur','rocket','pizza','pickaxe'];

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
  try {
    for (const vp of [{name:'mobile',w:390,h:844,m:true},{name:'desktop',w:1440,h:900,m:false}]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e=>errors.push('pageerror: '+e.message));
      page.on('console', m=>{
        if(m.type() !== 'error') return;
        const text = m.text();
        if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
        errors.push('console: '+text);
      });
      await page.setViewport({width:vp.w,height:vp.h,deviceScaleFactor:1,isMobile:vp.m,hasTouch:vp.m});
      await page.goto('http://127.0.0.1:'+port+'/tools/buildlab.html', {waitUntil:'domcontentloaded', timeout:30000});
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', {timeout:20000}).catch(()=>{});
      await new Promise(r=>setTimeout(r,600));
      // First visit shows the welcome modal; dismiss it as a learner would.
      await page.evaluate(() => { try { window.closeModal('welcomeModal'); } catch(e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); });
      await new Promise(r=>setTimeout(r,200));

      const shell = await page.evaluate(()=>({
        title: document.title,
        skipLinks: document.querySelectorAll('.skip-link').length,
        headers: document.querySelectorAll('header.site-header').length,
        footers: document.querySelectorAll('.jvds-tools-footer').length,
        canvas: !!document.querySelector('#viewport canvas'),
        engineError: !!document.querySelector('#viewport.engine-error'),
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        metaCsp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '',
        mobToolbar: document.querySelectorAll('.mob-toolbar .mob-tab').length,
        deskButtons: document.querySelectorAll('.template-grid .tmpl-btn').length,
        mobButtons: document.querySelectorAll('.mob-quick-grid [onclick^="quickBuild("]').length,
        engineStatus: (document.getElementById('engineStatus')?.textContent || '').trim(),
        exportModal: !!document.getElementById('exportPreviewModal'),
        photoExport: !!document.querySelector('[onclick*="exportScreenshot"]'),
        wiredTypes: Array.from(document.querySelectorAll('[onclick^="quickBuild("]')).map(b=>b.getAttribute('onclick').match(/quickBuild\('([a-z]+)'\)/)?.[1]).filter(Boolean)
      }));
      check(vp.name+': title is BuildLab', /BuildLab/i.test(shell.title), shell.title);
      check(vp.name+': single skip link', shell.skipLinks === 1, String(shell.skipLinks));
      check(vp.name+': single shared header', shell.headers === 1, String(shell.headers));
      check(vp.name+': single tools footer', shell.footers === 1, String(shell.footers));
      check(vp.name+': canvas or helpful error state', shell.canvas || shell.engineError, 'canvas='+shell.canvas+' error='+shell.engineError);
      check(vp.name+': no horizontal overflow', shell.overflow <= 2, String(shell.overflow));
      check(vp.name+': CSP allows blob scripts for the import-map polyfill', /script-src[^;]*\bblob:/.test(shell.metaCsp));
      check(vp.name+': 15 desktop template buttons', shell.deskButtons === 15, String(shell.deskButtons));
      check(vp.name+': mobile quick-grid exposes templates', shell.mobButtons >= 15, String(shell.mobButtons));
      const missing = TEMPLATES.filter(t=>!shell.wiredTypes.includes(t));
      check(vp.name+': every template is wired to quickBuild', missing.length === 0, missing.join(','));
      check(vp.name+': mobile tab bar uses .mob-tab (swipe fix)', shell.mobToolbar === 5, String(shell.mobToolbar));
      check(vp.name+': engine leaves the loading state (ready or clear error)', /ready|error|could not|failed|webgl|startup|refresh/i.test(shell.engineStatus), shell.engineStatus || '(empty)');
      check(vp.name+': export preview modal present', shell.exportModal);
      check(vp.name+': screenshot export control present', shell.photoExport);

      for (const type of TEMPLATES) {
        const r = await page.evaluate(async (t)=>{
          if (typeof window.quickBuild !== 'function') return {ok:false, reason:'quickBuild missing'};
          window.quickBuild(t);
          await new Promise(res=>setTimeout(res, 90));
          const b = window.blocks || [];
          let minY = Infinity, maxY = -Infinity, bad = 0, outside = 0;
          b.forEach(x=>{
            const h = x.userData.h || 1, w = x.userData.w || 1;
            if (!Number.isFinite(x.position.x) || !Number.isFinite(x.position.y) || !Number.isFinite(x.position.z)) bad++;
            const bottom = x.position.y - h/2, top = x.position.y + h/2;
            if (bottom < minY) minY = bottom;
            if (top > maxY) maxY = top;
            if (Math.abs(x.position.y) > 400 || Math.abs(x.position.x) > 200) outside++;
          });
          return {ok:true, count:b.length, minY, maxY, bad, outside, name: document.getElementById('buildNameInput')?.value || ''};
        }, type);
        if (!r.ok) { check(vp.name+' '+type+': builds', false, r.reason); continue; }
        const grounded = Math.abs(r.minY) <= 0.02;
        check(vp.name+' '+type+': builds grounded blocks', r.count>0 && grounded && r.bad===0 && r.outside===0,
          'blocks='+r.count+' minY='+(r.minY==null?'null':r.minY.toFixed(3))+' bad='+r.bad+' outside='+r.outside);
      }

      if (vp.name === 'mobile') {
        const pause = ms => new Promise(r=>setTimeout(r, ms));
        const cookie = await page.evaluate(() => {
          const b = document.getElementById('cookie-banner');
          if (!b) return { present:false };
          const tb = document.getElementById('mobToolbar');
          return { present:true, toolbarVisible: !!(tb && getComputedStyle(tb).display !== 'none') };
        });
        check('mobile: cookie banner shows on first load', cookie.present);
        check('mobile: cookie banner does not bury the toolbar', cookie.present && !cookie.toolbarVisible, 'toolbarVisible='+cookie.toolbarVisible);
        await page.evaluate(() => document.getElementById('cookie-accept') && document.getElementById('cookie-accept').click());
        await pause(250);

        const companion = await page.evaluate(() => {
          const c = document.querySelector('.mascot-companion'), tb = document.getElementById('mobToolbar');
          if (!c || !tb) return null;
          const cb = c.getBoundingClientRect(), tbb = tb.getBoundingClientRect();
          return { display: getComputedStyle(c).display, bottom: Math.round(cb.bottom), toolbarTop: Math.round(tbb.top) };
        });
        check('mobile: Ember companion clears the toolbar', !!(companion && companion.display !== 'none' && companion.bottom <= companion.toolbarTop + 2), JSON.stringify(companion));

        await page.evaluate(() => window.mobTab('tools'));
        await pause(300);
        const drawer = await page.evaluate(() => {
          const vis = el => { if(!el) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && el.getBoundingClientRect().width > 0; };
          const d = document.getElementById('mobDrawer');
          const add = document.querySelector('#mob-panel-tools .mob-tool-btn');
          const db = d.getBoundingClientRect(), ab = add ? add.getBoundingClientRect() : {top:0,bottom:0};
          return { open:d.classList.contains('open'), bodyClass:document.body.classList.contains('bl-drawer-open'), keepsake:vis(document.getElementById('jvds-keepsake-strip')), feedback:vis(document.getElementById('jvfb-btn')), share:vis(document.getElementById('jvds-share-btn')), companion:vis(document.querySelector('.mascot-companion')), addVisible:vis(add), addInside:!!add && ab.top >= db.top-1 && ab.bottom <= db.bottom+1 };
        });
        check('mobile: tool drawer opens', drawer.open && drawer.bodyClass, JSON.stringify(drawer));
        check('mobile: drawer hides keepsake strip', !drawer.keepsake);
        check('mobile: drawer hides feedback button', !drawer.feedback);
        check('mobile: drawer hides share button', !drawer.share);
        check('mobile: drawer hides Ember companion', !drawer.companion);
        check('mobile: tools panel visible (not covered)', drawer.addVisible && drawer.addInside, JSON.stringify(drawer));

        await page.evaluate(() => { window.mobClose(); window.openNameModal(); });
        await pause(300);
        const modal = await page.evaluate(() => {
          const vis = el => { if(!el) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && el.getBoundingClientRect().width > 0; };
          return { open:!!document.querySelector('.modal-overlay.open'), bodyClass:document.body.classList.contains('bl-modal-open'), keepsake:vis(document.getElementById('jvds-keepsake-strip')), feedback:vis(document.getElementById('jvfb-btn')), share:vis(document.getElementById('jvds-share-btn')) };
        });
        check('mobile: modal opens', modal.open && modal.bodyClass, JSON.stringify(modal));
        check('mobile: modal hides floating widgets', !modal.keepsake && !modal.feedback && !modal.share);
        await page.evaluate(() => window.closeModal('nameModal'));
      }

      const cspViolation = errors.some(e=>/Content Security Policy|violates/i.test(e));
      check(vp.name+': no CSP violations', !cspViolation, errors.filter(e=>/Content Security Policy|violates/i.test(e))[0] || '');
      check(vp.name+': zero runtime errors', errors.length === 0, errors.slice(0,2).join(' | '));

      await page.close();
    }
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BUILDLAB CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
