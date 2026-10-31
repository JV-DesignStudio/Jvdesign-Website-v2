#!/usr/bin/env node
/*
 * tests/arcane_citadel-smoke.js
 *
 * Flagship polish checks for Arcane Citadel: Ember first-run coach, recommended
 * Quick Night + Calm mode toggle, pause (button + auto-pause on tab hide),
 * keyboard play, boss charge telegraph, run summary with Echo next-step and
 * share, and persistent element mastery. Also confirms a full run still starts
 * and plays with no page errors at 390px and 1440px.
 *
 * Run: node tests/arcane_citadel-smoke.js
 */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.AC2_PORT||8162);
const BASE=`http://127.0.0.1:${PORT}`;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg'};
let failures=0;
const ok=(n,c,d)=>{console.log((c?'  [PASS] ':'  [FAIL] ')+n+(d?' - '+d:'')); if(!c) failures++;};
const server=http.createServer((req,res)=>{
  let rel; try{rel=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);return res.end();}
  const file=path.join(ROOT,rel);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});

async function newPage(browser,vp,errs){
  const page=await browser.newPage();
  page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_/.test(m.text()))errs.push('console: '+m.text().slice(0,80));});
  await page.setViewport(vp);
  return page;
}
const open=async(page)=>page.goto(BASE+'/games/arcane_citadel.html',{waitUntil:'load',timeout:30000});

(async()=>{
  await new Promise(r=>server.listen(PORT,r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  try{
    // ── Desktop feature checks ──
    {
      const errs=[]; const page=await newPage(browser,{width:1440,height:900},errs);
      await open(page); await new Promise(r=>setTimeout(r,700));
      const ui=await page.evaluate(()=>({
        coach:!!document.getElementById('citadel-coach'),
        recommended:!!document.querySelector('.citadel-recommended'),
        calmRow:!!document.getElementById('citadel-calm'),
        pauseBtn:!!document.getElementById('citadel-pause'),
        warn:!!document.getElementById('citadel-charge-warn'),
        hasHooks:!!window.__citadelPolish,
        reduced:window.__citadelPolish&&window.__citadelPolish.reducedMotion(),
      }));
      ok('Ember first-run coach shows', ui.coach);
      ok('Quick Night marked Recommended', ui.recommended);
      ok('Calm mode toggle present', ui.calmRow);
      ok('Pause button present', ui.pauseBtn);
      ok('Boss charge warning element present', ui.warn);
      ok('polish hooks exposed', ui.hasHooks);

      const menu=await page.evaluate(()=>{
        const vis=a=>{const b=document.querySelector('#arcade-menu [data-arcade-action="'+a+'"]');return b?!b.hidden:null;};
        return {pause:vis('pause'),restart:vis('restart'),sound:vis('sound'),help:vis('help')};
      });
      ok('arcade menu exposes pause/restart/sound/help', menu.pause&&menu.restart&&menu.sound&&menu.help, JSON.stringify(menu));

      // calm toggle flips the flag + persists
      await page.click('#citadel-calm');
      await new Promise(r=>setTimeout(r,150));
      const calmOn=await page.evaluate(()=>({calm:window.__citadelPolish.calm(),ls:localStorage.getItem('jvds_citadel_calm')}));
      ok('Calm mode toggles on and persists', calmOn.calm===true&&calmOn.ls==='1', JSON.stringify(calmOn));
      await page.click('#citadel-calm');

      // keyboard: choose element with "1" then game starts
      await page.evaluate(()=>{document.querySelector('.rune-btn').click();}); // open spell select
      await new Promise(r=>setTimeout(r,300));
      const gridOpen=await page.evaluate(()=>document.getElementById('screen-spell').style.display!=='none');
      ok('spell select opens', gridOpen);
      const spellA11y=await page.evaluate(()=>{
        const c=document.querySelector('.spell-choice');
        return {tab:c?c.tabIndex:null,role:c?c.getAttribute('role'):null,label:c?c.getAttribute('aria-label'):null};
      });
      ok('spell cards are keyboard focusable', spellA11y.tab===0&&spellA11y.role==='button'&&/Choose/.test(spellA11y.label||''), JSON.stringify(spellA11y));
      await page.keyboard.press('1');
      await new Promise(r=>setTimeout(r,500));
      const started=await page.evaluate(()=>({state:window.__citadelPolish.state(),spell:document.getElementById('spell-name-hud').textContent}));
      ok('number key picks element and starts the game', started.state==='playing'&&started.spell.length>1, JSON.stringify(started));

      // The arena must be the whole viewport. The StoryRun card and one-night
      // banner once sat in normal flow and pushed the canvas down, clipping the
      // bottom of the play area.
      const arena=await page.evaluate(()=>{
        const c=document.getElementById('gameCanvas').getBoundingClientRect();
        const run=document.querySelector('.storyrun:not(.sr-modal)');
        const story=run&&run.querySelector('.sr-story');
        const banner=document.getElementById('oneNightBanner');
        return {top:Math.round(c.top),bottom:Math.round(c.bottom),cw:Math.round(c.width),vw:innerWidth,vh:innerHeight,
          storyPos:run?getComputedStyle(run).position:null,
          storyDisplay:story?getComputedStyle(story).display:null,
          bannerVisibility:banner?getComputedStyle(banner).visibility:null};
      });
      ok('desktop: arena fills the viewport (nothing clipped)', arena.top===0&&Math.abs(arena.bottom-arena.vh)<=1&&Math.abs(arena.cw-arena.vw)<=1, JSON.stringify(arena));
      ok('desktop: story-run overlay takes no layout space', arena.storyPos==='fixed'&&arena.storyDisplay==='none', JSON.stringify(arena));
      ok('desktop: one-night banner is hidden during play', arena.bannerVisibility==='hidden', arena.bannerVisibility);

      const shopModes=await page.evaluate(()=>{
        const shop=()=>document.querySelector('.citadel-shop');
        window.setCitadelMode('quick');
        window.showWaveComplete();
        const quick=shop()?getComputedStyle(shop()).display:null;
        window.startNextWave();
        window.setCitadelMode('deep');
        window.showWaveComplete();
        const deep=shop()?getComputedStyle(shop()).display:null;
        const card=document.querySelector('.shop-card');
        window.startNextWave();
        window.setCitadelMode('quick');
        return {quick,deep,cardTab:card?card.tabIndex:null,cardRole:card?card.getAttribute('role'):null};
      });
      ok('Quick Night hides the shop; Deep Night shows it', shopModes.quick==='none'&&shopModes.deep!=='none', JSON.stringify(shopModes));
      ok('shop cards are keyboard focusable', shopModes.cardTab===0&&shopModes.cardRole==='button', JSON.stringify(shopModes));

      await page.click('#arcade-menu .arcade-menu-trigger');
      await page.click('#arcade-menu [data-arcade-action="pause"]');
      await new Promise(r=>setTimeout(r,150));
      const menuPaused=await page.evaluate(()=>window.__citadelPolish.isPaused());
      ok('arcade menu pause action works', menuPaused);
      await page.evaluate(()=>window.__citadelPolish.resume());
      await new Promise(r=>setTimeout(r,100));

      // pause via button, then resume
      await page.click('#citadel-pause');
      await new Promise(r=>setTimeout(r,150));
      const paused=await page.evaluate(()=>({paused:window.__citadelPolish.isPaused(),state:window.__citadelPolish.state(),overlay:document.getElementById('citadel-pause-overlay').classList.contains('show')}));
      ok('pause button pauses the run', paused.paused&&paused.state==='paused'&&paused.overlay, JSON.stringify(paused));
      await page.click('#citadel-resume');
      await new Promise(r=>setTimeout(r,150));
      const resumed=await page.evaluate(()=>window.__citadelPolish.state());
      ok('resume returns to playing', resumed==='playing', resumed);

      // auto-pause on tab hide
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      await new Promise(r=>setTimeout(r,150));
      const autoPaused=await page.evaluate(()=>window.__citadelPolish.isPaused());
      ok('auto-pauses when the tab is hidden', autoPaused);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});window.__citadelPolish.resume();});

      // boss charge telegraph
      const tele=await page.evaluate(()=>{
        window.__citadelPolish.setActiveBossForTest({isCharging:false,chargeTimer:10,chargeSpeed:1,chargeInterval:1});
        window.update(16);
        const on=window.__citadelPolish.warnVisible();
        window.__citadelPolish.setActiveBossForTest({isCharging:false,chargeTimer:999,chargeSpeed:1,chargeInterval:1});
        window.update(16);
        const off=window.__citadelPolish.warnVisible();
        window.__citadelPolish.setActiveBossForTest(null);
        return {on,off};
      });
      ok('boss telegraph shows before a charge and hides otherwise', tele.on&&!tele.off, JSON.stringify(tele));

      // mastery: mark an element, reopen spell select, expect a Mastered badge
      const mastered=await page.evaluate(()=>{
        window.__citadelPolish.markMastery('lightning');
        window.showSpellSelect();
        return [...document.querySelectorAll('.citadel-mastered')].length;
      });
      ok('mastered element shows a badge on the spell card', mastered>0, 'badges '+mastered);

      // run summary: force game over, expect Echo + share
      await page.evaluate(()=>{window.__citadelPolish.resume();window.gameOver();});
      await new Promise(r=>setTimeout(r,300));
      const summary=await page.evaluate(()=>({echo:!!document.getElementById('citadel-echo'),share:!!document.getElementById('citadel-share'),maker:!!(document.querySelector('#citadel-echo a')||{}).href}));
      ok('run summary shows Echo next-step and share', summary.echo&&summary.share&&summary.maker, JSON.stringify(summary));

      const card=await page.evaluate(()=>({
        btn:!!document.getElementById('citadel-card'),
        data:(window.__citadelPolish.runCardDataURL()||'').slice(0,22)
      }));
      ok('run summary offers a PNG run card', card.btn&&card.data==='data:image/png;base64,', JSON.stringify(card));

      ok('desktop: no page errors', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Phone: plays with no errors ──
    {
      const errs=[]; const page=await newPage(browser,{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2},errs);
      await open(page); await new Promise(r=>setTimeout(r,700));
      await page.evaluate(()=>{document.querySelector('.rune-btn').click();});
      await new Promise(r=>setTimeout(r,250));
      await page.evaluate(()=>{document.querySelector('.spell-choice').click();});
      await new Promise(r=>setTimeout(r,900));
      const st=await page.evaluate(()=>{
        const c=document.getElementById('gameCanvas').getBoundingClientRect();
        const cv=document.getElementById('gameCanvas');
        return {state:window.__citadelPolish.state(),canvas:document.querySelectorAll('canvas').length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          top:Math.round(c.top),bottom:Math.round(c.bottom),cw:Math.round(c.width),vw:innerWidth,vh:innerHeight,
          px:cv.width,dpr:window.devicePixelRatio};
      });
      ok('phone: game starts', st.state==='playing', JSON.stringify(st));
      ok('phone: canvas present', st.canvas>0);
      ok('phone: arena fills the viewport (nothing clipped)', st.top===0&&Math.abs(st.bottom-st.vh)<=1&&Math.abs(st.cw-st.vw)<=1, JSON.stringify(st));
      ok('phone: canvas renders at device pixel ratio', st.px===Math.round(st.vw*Math.min(st.dpr,2))&&st.dpr>1, JSON.stringify({px:st.px,dpr:st.dpr,vw:st.vw}));
      ok('phone: no horizontal overflow', st.overflow<=2, 'overflow='+st.overflow);
      const mute=await page.evaluate(()=>{
        document.getElementById('mute-btn').click();
        return {muted:window.__citadelPolish.muted(),ls:localStorage.getItem('jvds_citadel_muted'),pressed:document.getElementById('mute-btn').getAttribute('aria-pressed')};
      });
      ok('phone: mute toggles and persists', mute.muted===true&&mute.ls==='1'&&mute.pressed==='true', JSON.stringify(mute));
      await page.reload({waitUntil:'load',timeout:30000});
      await page.waitForSelector('#mute-btn',{timeout:10000});
      await new Promise(r=>setTimeout(r,500));
      const muteAfter=await page.evaluate(()=>({muted:window.__citadelPolish.muted(),label:document.getElementById('mute-btn').textContent}));
      ok('phone: mute preference survives a reload', muteAfter.muted===true, JSON.stringify(muteAfter));
      ok('phone: no page errors', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
