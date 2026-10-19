// first-15-minutes.js (A1692): the arrival -> first saved creation journey.
//
// This is the automated half of the A1692 usability test. It walks the path a
// brand-new learner takes on a locked-down school device and fails when any of
// the three blockers found in the 2026-10-19 session comes back:
//   1. the primary CTA must be inside the first screen, including phones;
//   2. on a phone the mission must reveal Save/Export instead of hiding them
//      behind an unlabelled bottom-bar tab;
//   3. a profile that blocks localStorage must not throw, must not claim the
//      work was saved, and must still export a real PNG.
//   4. (A1788) on a phone Save must be visible inside the scrolling Save panel,
//      and exporting without saving must not tick "Saved".
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 19260;
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

const VIEWPORTS = [
  {name:'iPhone SE 375x667', width:375, height:667, mobile:true},
  {name:'Phone 390x844', width:390, height:844, mobile:true},
  {name:'Chromebook 1366x768', width:1366, height:768, mobile:false},
];

(async()=>{
  await new Promise(r=>server.listen(port,r));
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  try {
    // ---------- 1. Primary CTA inside the first screen ----------
    for(const vp of VIEWPORTS){
      const page = await browser.newPage();
      await page.setViewport({width:vp.width,height:vp.height,isMobile:vp.mobile,hasTouch:vp.mobile,deviceScaleFactor:1});
      await page.evaluateOnNewDocument(()=>{ try{ document.cookie='jvds-cookie-consent=accepted;path=/;max-age=31536000'; }catch(e){} });
      await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'networkidle2', timeout:60000});
      await sleep(800);
      const cta = await page.evaluate(()=>{
        const el = document.querySelector('.btn-primary');
        if(!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: el.textContent.trim(),
          top: Math.round(r.top), bottom: Math.round(r.bottom),
          shown: cs.display!=='none' && cs.visibility!=='hidden' && r.height>0,
          vh: window.innerHeight,
          inFold: r.top>=0 && r.bottom<=window.innerHeight,
        };
      });
      check(`${vp.name}: primary CTA exists`, !!cta);
      check(`${vp.name}: CTA is "${cta?cta.text:''}"`, !!cta && /make your first character/i.test(cta.text));
      check(`${vp.name}: CTA inside the first screen`, !!cta && cta.shown && cta.inFold,
        cta?`top ${cta.top}, fold ${cta.vh}`:'missing');
      await page.close();
    }

    // ---------- 2. Phone mission reveals Save and Export ----------
    const phone = await browser.newPage();
    await phone.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
    await phone.evaluateOnNewDocument(()=>{ try{ document.cookie='jvds-cookie-consent=accepted;path=/;max-age=31536000'; }catch(e){} });
    const phoneErrors = [];
    phone.on('pageerror', e=>phoneErrors.push(e.message));
    await phone.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html#first-mission`, {waitUntil:'networkidle2', timeout:60000});
    await sleep(1700);
    const canvasPt = await phone.evaluate(()=>{
      const r = document.getElementById('main-canvas').getBoundingClientRect();
      return {x:r.left+r.width/2, y:r.top+r.height/2};
    });
    await phone.touchscreen.tap(canvasPt.x, canvasPt.y);
    await sleep(800);
    const phoneState = await phone.evaluate(()=>{
      const shown = el=>{ if(!el) return false; const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); return cs.display!=='none' && cs.visibility!=='hidden' && r.height>0; };
      const png = [...document.querySelectorAll('[data-on="exportPNG"]')].filter(shown)[0];
      const saveTab = [...document.querySelectorAll('.bb-tab')].find(b=>/save/i.test(b.textContent));
      const hint = document.getElementById('fm-where');
      return {
        heading: (document.getElementById('fm-heading')||{}).textContent||'',
        activeTab: (document.querySelector('.bb-tab.on')||{}).textContent||'',
        saveTabOn: saveTab ? saveTab.classList.contains('on') : false,
        pngShown: !!png,
        pngText: png ? png.textContent.trim() : '',
        hintShown: shown(hint),
        hintText: hint ? hint.textContent.trim() : '',
      };
    });
    check('phone: drawing advances the mission to Save', /step 2/i.test(phoneState.heading), phoneState.heading);
    check('phone: the Save tab opens automatically after drawing', phoneState.saveTabOn, 'active tab: '+phoneState.activeTab);
    check('phone: Export PNG is visible without hunting', phoneState.pngShown, phoneState.pngText);
    check('phone: the mission says where Save lives', phoneState.hintShown && /save/i.test(phoneState.hintText), phoneState.hintText);
    check('phone: no runtime errors on the mission', phoneErrors.length===0, phoneErrors.slice(0,2).join(' | '));

    // A1788: Save must be inside the visible part of the scrolling Save panel,
    // and Export must not tick "Saved" when no save happened.
    const phoneSave = await phone.evaluate(()=>{
      const inPanel = el=>{
        if(!el) return null;
        const r=el.getBoundingClientRect();
        const c=document.querySelector('.bb-content');
        const cr=c?c.getBoundingClientRect():{top:0,bottom:window.innerHeight};
        const cs=getComputedStyle(el);
        const visible=cs.display!=='none'&&cs.visibility!=='hidden'&&r.height>0&&r.top>=cr.top&&r.bottom<=cr.bottom&&r.top>=0&&r.bottom<=window.innerHeight&&r.left>=0&&r.right<=window.innerWidth;
        return visible?{text:el.textContent.trim(),x:r.left+r.width/2,y:r.top+r.height/2}:null;
      };
      return {
        save: inPanel([...document.querySelectorAll('[data-on="saveProject"]')].find(el=>el.closest('#bb3'))),
        png: inPanel([...document.querySelectorAll('[data-on="exportPNG"]')].find(el=>el.closest('#bb3'))),
        savedFlag: window._projectSaved===true,
        stored:(()=>{try{return !!localStorage.getItem('jvds_pixel');}catch(e){return false;}})(),
      };
    });
    check('phone: Save is visible in the Save panel after drawing', !!phoneSave.save, phoneSave.save?phoneSave.save.text:'not in the clipped panel');
    check('phone: nothing claims a save before the learner saves', !phoneSave.savedFlag && !phoneSave.stored);
    if(phoneSave.png){
      await phone.touchscreen.tap(phoneSave.png.x, phoneSave.png.y);
      await sleep(900);
    }
    const phoneAfterExport = await phone.evaluate(()=>({
      dot2:(document.getElementById('fm-dot-2')||{}).textContent||'',
      heading:(document.getElementById('fm-heading')||{}).textContent||'',
      savedFlag: window._projectSaved===true,
      stored:(()=>{try{return !!localStorage.getItem('jvds_pixel');}catch(e){return false;}})(),
    }));
    check('phone: Export does not tick Saved when no save happened', !phoneAfterExport.savedFlag && !phoneAfterExport.stored && !/✓\s*Saved/i.test(phoneAfterExport.dot2), phoneAfterExport.dot2);
    check('phone: Export is honest that the browser copy was not saved', /not saved|blocked/i.test(phoneAfterExport.heading), phoneAfterExport.heading);
    await phone.close();

    // ---------- 3. Locked-down profile: no crash, no false "Saved" ----------
    const locked = await browser.newPage();
    await locked.setViewport({width:1366,height:768});
    await locked.evaluateOnNewDocument(()=>{
      try{ document.cookie='jvds-cookie-consent=accepted;path=/;max-age=31536000'; }catch(e){}
      const deny=()=>{ throw new DOMException('Storage disabled by policy','SecurityError'); };
      try{ Object.defineProperty(window,'localStorage',{get:deny,configurable:true}); }catch(e){}
      try{ Object.defineProperty(window,'sessionStorage',{get:deny,configurable:true}); }catch(e){}
    });
    const lockedErrors = [];
    locked.on('pageerror', e=>lockedErrors.push(e.message));
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jvds-first15-'));
    const cdp = await locked.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {behavior:'allow', downloadPath:downloadDir});
    await locked.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html#first-mission`, {waitUntil:'networkidle2', timeout:60000});
    await sleep(2000);
    const lockedCanvas = await locked.$('#main-canvas');
    const lockedBox = await lockedCanvas.boundingBox();
    await locked.mouse.click(lockedBox.x+lockedBox.width/2, lockedBox.y+lockedBox.height/2);
    await sleep(1900);
    const autoToast = await locked.$eval('#toast', el=>el.textContent).catch(()=> '');
    check('locked profile: autosave names the block, not a full disk', /block/i.test(autoToast) && !/storage full/i.test(autoToast), autoToast);
    const lockedState = await locked.evaluate(()=>{
      const before = (document.getElementById('fm-heading')||{}).textContent||'';
      let ret;
      try { ret = window.saveProject(); } catch(e) { ret = 'threw '+(e.name||e.message); }
      return {
        before,
        ret,
        blockedFlag: window._storageBlocked===true,
        dot2: (document.getElementById('fm-dot-2')||{}).textContent||'',
      };
    });
    check('locked profile: page loads with no uncaught errors', lockedErrors.length===0, lockedErrors.slice(0,3).join(' | '));
    check('locked profile: save reports failure instead of pretending', lockedState.ret===false, String(lockedState.ret));
    check('locked profile: storage block is recorded', lockedState.blockedFlag);
    check('locked profile: the Save step is not ticked', !/saved/i.test(lockedState.dot2), lockedState.dot2);

    const exported = await locked.evaluate(()=>{
      try { window.exportPNG(); return {ok:true}; } catch(e) { return {ok:false, err:String(e)}; }
    });
    await sleep(1800);
    const pngs = fs.readdirSync(downloadDir).filter(f=>/\.png$/i.test(f) && !/\.crdownload$/i.test(f));
    let pngBytes = 0;
    if(pngs.length){ try{ pngBytes = fs.statSync(path.join(downloadDir, pngs[0])).size; }catch(e){} }
    check('locked profile: Export PNG still runs', exported.ok, exported.err||'');
    check('locked profile: Export PNG produces a real file', pngs.length>0 && pngBytes>200, pngs.join(',')+' bytes='+pngBytes);
    const done = await locked.evaluate(()=>({
      heading:(document.getElementById('fm-heading')||{}).textContent||'',
      dots:[1,2,3].map(i=>(document.getElementById('fm-dot-'+i)||{}).textContent||''),
    }));
    check('locked profile: exporting finishes the mission', /done/i.test(done.heading), done.heading);
    check('locked profile: the finish never claims it saved', done.dots.every(d=>!/✓ saved/i.test(d)), done.dots.join(' | '));
    await locked.close();
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL FIRST-15-MINUTES CHECKS PASSED');
})().catch(e=>{ console.error('Harness error:', e); try{server.close();}catch(_){} process.exit(1); });
