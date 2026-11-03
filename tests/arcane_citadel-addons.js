#!/usr/bin/env node
/*
 * tests/arcane_citadel-addons.js
 *
 * Regression checks for the A2380 Citadel addon module: mode buttons, settings,
 * grouped shop, relic choice, Calm tuning, mid-run resume, Daily Night,
 * Practice Gate, Boss Rush, save export/import and richer leaderboard entries.
 *
 * Run: node tests/arcane_citadel-addons.js
 */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.AC3_PORT||8163);
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

async function open(browser,vp){
  const page=await browser.newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_/.test(m.text()))errs.push('console: '+m.text().slice(0,100));});
  await page.setViewport(vp||{width:1440,height:900});
  await page.goto(BASE+'/games/arcane_citadel.html',{waitUntil:'load',timeout:30000});
  await page.evaluate(()=>{try{localStorage.clear();}catch(e){}});
  await page.reload({waitUntil:'load',timeout:30000});
  await new Promise(r=>setTimeout(r,600));
  return {page,errs};
}
const startFirstSpell=async(page)=>{
  await page.evaluate(()=>{const b=document.querySelector('.rune-btn');b&&b.click();});
  await new Promise(r=>setTimeout(r,200));
  await page.evaluate(()=>{const c=document.querySelector('.spell-choice');c&&c.click();});
  await new Promise(r=>setTimeout(r,500));
};
const clickMode=async(page,label)=>{
  return page.evaluate((label)=>{
    const b=[...document.querySelectorAll('#citadel-modes button')].filter(x=>x.textContent.indexOf(label)>=0)[0];
    if(!b) return false;
    b.click(); return true;
  },label);
};

(async()=>{
  await new Promise(r=>server.listen(PORT,r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  try{
    // ── UI + settings ──
    {
      const {page,errs}=await open(browser);
      const ui=await page.evaluate(()=>({
        modes:document.querySelectorAll('#citadel-modes button').length,
        daily:[...document.querySelectorAll('#citadel-modes button')].some(b=>/Daily Night/.test(b.textContent)),
        practice:[...document.querySelectorAll('#citadel-modes button')].some(b=>/Practice Gate/.test(b.textContent)),
        rush:[...document.querySelectorAll('#citadel-modes button')].some(b=>/Boss Rush/.test(b.textContent)),
        codex:[...document.querySelectorAll('#citadel-modes button')].some(b=>/Relic Codex/.test(b.textContent)),
        settings:[...document.querySelectorAll('#citadel-modes button')].some(b=>/Settings/.test(b.textContent)),
        note:(document.getElementById('citadel-mode-note')||{}).textContent||''
      }));
      ok('extra mode buttons are present', ui.modes>=5&&ui.daily&&ui.practice&&ui.rush&&ui.codex&&ui.settings, JSON.stringify(ui));
      ok('start screen explains Daily Night and mastery', /Daily Night today/.test(ui.note)&&/Mastery clears/.test(ui.note), ui.note.slice(0,90));

      const settings=await page.evaluate(async()=>{
        const meta=[...document.querySelectorAll('#citadel-modes button')].filter(b=>/Settings/.test(b.textContent))[0];
        meta.click();
        await new Promise(r=>setTimeout(r,100));
        const modal=!!document.querySelector('.citadel-modal');
        const toggle=(id)=>{const e=document.getElementById(id);e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));};
        toggle('citadel-set-contrast'); toggle('citadel-set-markers'); toggle('citadel-set-bigtext');
        const body=document.body;
        return {modal,contrast:body.classList.contains('citadel-contrast'),markers:!!JSON.parse(localStorage.getItem('jvds_citadel_settings')||'{}').markers,
          bigtext:body.classList.contains('citadel-bigtext'),stored:JSON.parse(localStorage.getItem('jvds_citadel_settings')||'{}')};
      });
      ok('settings panel opens', settings.modal);
      ok('accessibility settings apply and persist', settings.contrast&&settings.markers&&settings.bigtext&&settings.stored.contrast, JSON.stringify(settings.stored));

      const save=await page.evaluate(()=>{
        localStorage.setItem('jvds_citadel_mastery',JSON.stringify({lightning:4}));
        const code=window.__citadelPolish.exportCode();
        localStorage.removeItem('jvds_citadel_mastery');
        const bad=window.__citadelPolish.importCode('not-a-code');
        const good=window.__citadelPolish.importCode(code);
        return {code,prefix:code.slice(0,5),bad,good,restored:localStorage.getItem('jvds_citadel_mastery')};
      });
      ok('save export produces a CIT1 code', save.prefix==='CIT1-'&&save.code.length>20, save.prefix);
      ok('save import rejects junk and restores a code', save.bad===false&&save.good===true&&/lightning/.test(save.restored||''), JSON.stringify({bad:save.bad,good:save.good,restored:save.restored}));
      ok('no page errors (UI/settings)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── gameplay: shop, relic choice, calm ──
    {
      const {page,errs}=await open(browser);
      await startFirstSpell(page);
      const shop=await page.evaluate(()=>{
        window.setCitadelMode('deep'); window.showWaveComplete();
        return {groups:document.querySelectorAll('#shop-grid .shop-group').length,levels:document.querySelectorAll('#shop-grid .sc-lv').length,cards:document.querySelectorAll('#shop-grid .shop-card').length};
      });
      ok('shop groups universal and element upgrades', shop.groups>=1&&shop.cards>0, JSON.stringify(shop));
      ok('shop cards show the owned level', shop.levels>0, JSON.stringify(shop));

      const relic=await page.evaluate(async()=>{
        window.startNextWave();
        wave=3;
        activeRelics=[]; window.__citadelPolish.clearResume();
        window.tryDropRelic({type:'megaboss',x:120,y:120});
        await new Promise(r=>setTimeout(r,80));
        const overlay=document.getElementById('citadel-relic-overlay');
        const cards=overlay?overlay.querySelectorAll('.citadel-relic-card').length:0;
        const first=overlay&&overlay.querySelector('.citadel-relic-card');
        if(first) first.click();
        await new Promise(r=>setTimeout(r,80));
        return {cards,after:activeRelics.length,overlayGone:!document.getElementById('citadel-relic-overlay'),state:window.__citadelPolish.state()};
      });
      ok('relic drop opens a three-card choice', relic.cards===3, JSON.stringify(relic));
      ok('choosing a relic applies it and resumes play', relic.after===1&&relic.overlayGone&&relic.state==='playing', JSON.stringify(relic));

      const calm=await page.evaluate(()=>{
        window.__citadelPolish.setCalm(false);
        const before=tower.maxHp;
        window.__citadelPolish.setCalm(true);
        const after=tower.maxHp;
        window.__citadelPolish.setCalm(false);
        return {before,after,ratio:(after-before)/before};
      });
      ok('Calm gives a 25% gate bonus, not 60%', Math.abs(calm.ratio-0.25)<0.02, JSON.stringify(calm));
      ok('no page errors (gameplay)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── resume ──
    {
      const {page,errs}=await open(browser);
      await startFirstSpell(page);
      const saved=await page.evaluate(()=>{
        wave=3; coins=12; score=4321; window.__citadelPolish.saveSnapshot&&window.__citadelPolish.saveSnapshot();
        const snap=window.__citadelPolish.snapshot();
        return snap;
      });
      ok('a run snapshot is written', !!saved&&saved.wave===3&&saved.coins===12, JSON.stringify(saved));
      await page.reload({waitUntil:'load',timeout:30000});
      await new Promise(r=>setTimeout(r,600));
      const hasResume=await page.evaluate(()=>[...document.querySelectorAll('#citadel-modes button')].some(b=>/Resume wave/.test(b.textContent)));
      ok('start screen offers Resume after a reload', hasResume);
      await clickMode(page,'Resume wave');
      await new Promise(r=>setTimeout(r,600));
      const restored=await page.evaluate(()=>({state:window.__citadelPolish.state(),wave:window.eval('wave'),coins:window.eval('coins'),score:window.eval('score'),mode:window.__citadelPolish.mode()}));
      ok('Resume restores the saved wave, coins and score', restored.wave===3&&restored.coins>=12&&restored.score>=4321&&restored.state==='playing', JSON.stringify(restored));
      ok('no page errors (resume)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Daily Night ──
    {
      const {page,errs}=await open(browser);
      const started=await page.evaluate(async()=>{
        const b=[...document.querySelectorAll('#citadel-modes button')].filter(x=>/Daily Night/.test(x.textContent))[0];
        b.click();
        await new Promise(r=>setTimeout(r,500));
        return {state:window.__citadelPolish.state(),mode:window.__citadelPolish.mode(),played:window.__citadelPolish.dailyPlayed(),spell:(document.getElementById('spell-name-hud')||{}).textContent,daily:JSON.parse(localStorage.getItem('jvds_citadel_daily')||'{}')};
      });
      ok('Daily Night starts a run with the day element', started.state==='playing'&&started.mode==='daily'&&started.spell.length>1, JSON.stringify(started));
      ok('Daily Night records the attempt', started.played===true&&started.daily.date===new Date().toISOString().slice(0,10), JSON.stringify(started.daily));
      ok('no page errors (daily)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Practice Gate ──
    {
      const {page,errs}=await open(browser);
      await page.evaluate(()=>{[...document.querySelectorAll('#citadel-modes button')].filter(x=>/Practice Gate/.test(x.textContent))[0].click();});
      await new Promise(r=>setTimeout(r,200));
      await page.evaluate(()=>{document.querySelector('.spell-choice').click();});
      await new Promise(r=>setTimeout(r,500));
      const practice=await page.evaluate(()=>({mode:window.__citadelPolish.mode(),state:window.__citadelPolish.state(),bounty:!!document.getElementById('citadel-bounty'),shopHidden:getComputedStyle(document.querySelector('.citadel-shop')).display==='none'}));
      ok('Practice Gate runs with no score pressure', practice.mode==='practice'&&practice.state==='playing', JSON.stringify(practice));
      ok('Practice hides the bounty and keeps the shop', !practice.bounty&&!practice.shopHidden, JSON.stringify(practice));
      ok('no page errors (practice)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Boss Rush ──
    {
      const {page,errs}=await open(browser);
      await page.evaluate(()=>localStorage.setItem('jvds_citadel_clears',JSON.stringify(['lightning','fire'])));
      await page.reload({waitUntil:'load',timeout:30000});
      await new Promise(r=>setTimeout(r,600));
      const unlocked=await page.evaluate(()=>{
        const b=[...document.querySelectorAll('#citadel-modes button')].filter(x=>/Boss Rush/.test(x.textContent))[0];
        return {disabled:!!b.disabled,title:b.title};
      });
      ok('Boss Rush unlocks after two element clears', unlocked.disabled===false, JSON.stringify(unlocked));
      await page.evaluate(()=>{[...document.querySelectorAll('#citadel-modes button')].filter(x=>/Boss Rush/.test(x.textContent))[0].click();});
      await new Promise(r=>setTimeout(r,200));
      await page.evaluate(()=>{document.querySelector('.spell-choice').click();});
      await new Promise(r=>setTimeout(r,700));
      const rush=await page.evaluate(()=>({mode:window.__citadelPolish.mode(),state:window.__citadelPolish.state(),wave:window.eval('wave'),boss:window.isBossWave(5),level:document.getElementById('hud-wave').textContent}));
      ok('Boss Rush starts on the first boss wave', rush.mode==='rush'&&rush.wave===5&&rush.boss, JSON.stringify(rush));
      ok('no page errors (rush)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── leaderboard keeps the build ──
    {
      const {page,errs}=await open(browser);
      await startFirstSpell(page);
      await page.evaluate(()=>{wave=4; killCount=17; window.gameOver();});
      await new Promise(r=>setTimeout(r,250));
      const entry=await page.evaluate(()=>{
        const st=JSON.parse(localStorage.getItem('jvds_citadel_leaderboard')||'{}');
        return (st.scores||[])[0]||null;
      });
      ok('leaderboard entry records kills, relics and mode', entry&&entry.kills===17&&Array.isArray(entry.relics)&&entry.mode==='quick', JSON.stringify(entry));
      ok('no page errors (leaderboard)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
