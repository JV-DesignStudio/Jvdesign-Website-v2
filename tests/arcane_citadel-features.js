#!/usr/bin/env node
/*
 * tests/arcane_citadel-features.js
 *
 * Covers the A2519 depth pass for Arcane Citadel: Relic Roulette, Boss Duel,
 * boss/per-element records, run timer, run grade, streak purse, shop reroll,
 * the four new relics, the two new gate upgrades, Daily Night record, haptics,
 * pause stats, plus the fixes (double gameOver guard, HTML-safe leaderboard,
 * phased aiming, spawn boundary, Last Candle revive, daily replay guard,
 * keyboard-typing guard, modal Escape/focus) and 390/1440 layout.
 *
 * Run: node tests/arcane_citadel-features.js
 */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.AC4_PORT||8164);
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function open(browser,vp){
  const page=await browser.newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_/.test(m.text()))errs.push('console: '+m.text().slice(0,100));});
  await page.setViewport(vp||{width:1440,height:900});
  await page.goto(BASE+'/games/arcane_citadel.html',{waitUntil:'load',timeout:30000});
  await page.evaluate(()=>{try{localStorage.clear();}catch(e){}});
  await page.reload({waitUntil:'load',timeout:30000});
  await sleep(700);
  return {page,errs};
}
const clickMode=(page,label)=>page.evaluate(label=>{
  const b=[...document.querySelectorAll('#citadel-modes button')].filter(x=>x.textContent.indexOf(label)>=0)[0];
  if(!b) return false; b.click(); return true;
},label);
const startFirstSpell=async(page)=>{
  await page.evaluate(()=>{const b=document.querySelector('.rune-btn');b&&b.click();});
  await sleep(250);
  await page.evaluate(()=>{const c=document.querySelector('.spell-choice');c&&c.click();});
  await sleep(600);
};

(async()=>{
  await new Promise(r=>server.listen(PORT,r));
  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  try{
    // ── UI, content and records ──
    {
      const {page,errs}=await open(browser);
      const ui=await page.evaluate(()=>({
        buttons:[...document.querySelectorAll('#citadel-modes button')].map(b=>b.textContent),
        note:(document.getElementById('citadel-mode-note')||{}).textContent||'',
        timer:!!document.getElementById('citadel-run-timer'),
        sr:!!document.getElementById('citadel-sr'),
        hooks:!!window.__citadelFeatures,
        relics:window.eval('RELICS.map(function(r){return r.id;})'),
        universals:window.eval('UNIVERSAL_UPGRADES.map(function(u){return u.id;})')
      }));
      const labels=ui.buttons.join('|');
      ok('new mode buttons present', /Relic Roulette/.test(labels)&&/Boss Duel/.test(labels)&&/Boss Codex/.test(labels)&&/Daily Record/.test(labels), labels);
      ok('start note forecasts the gate boss and personal best', /Gate boss:/.test(ui.note)&&/Your best:/.test(ui.note), ui.note.slice(0,100));
      ok('run timer + screen-reader live region exist', ui.timer&&ui.sr);
      ok('test hooks exposed', ui.hooks);
      ok('four new relics are in the drop table', ['r_candle','r_bossbane','r_mirror','r_lucky'].every(id=>ui.relics.includes(id)), ui.relics.join(','));
      ok('two new gate upgrades are in the stall', ['wardregen','fortune'].every(id=>ui.universals.includes(id)), ui.universals.join(','));

      const cards=await page.evaluate(()=>{
        localStorage.setItem('jvds_citadel_stats',JSON.stringify({lightning:{bestWave:9,bestScore:12345}}));
        localStorage.setItem('jvds_citadel_mastery',JSON.stringify({lightning:4}));
        window.showSpellSelect();
        const card=[...document.querySelectorAll('.spell-choice')].filter(c=>/Lightning/.test(c.textContent))[0];
        return {
          best:card&&card.querySelector('.citadel-best-line')?card.querySelector('.citadel-best-line').textContent:null,
          width:card&&card.querySelector('.citadel-mastery-fill')?card.querySelector('.citadel-mastery-fill').style.width:null
        };
      });
      ok('spell card shows the element personal record', /Best: wave 9/.test(cards.best||''), cards.best);
      ok('spell card shows mastery progress', cards.width==='40%', cards.width);
      ok('no page errors (UI)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Relic Roulette ──
    {
      const {page,errs}=await open(browser);
      await clickMode(page,'Relic Roulette');
      await sleep(200);
      await page.evaluate(()=>{document.querySelector('.spell-choice').click();});
      await sleep(800);
      const r=await page.evaluate(()=>({
        mode:window.__citadelPolish.mode(), state:window.__citadelPolish.state(),
        relics:window.eval('activeRelics.map(function(x){return x.id;})'),
        shop:getComputedStyle(document.querySelector('.citadel-shop')).display,
        timer:document.getElementById('citadel-run-timer').textContent,
        inPlay:document.body.classList.contains('citadel-in-play')
      }));
      ok('Relic Roulette starts a run', r.state==='playing'&&r.mode==='roulette', JSON.stringify(r));
      ok('Relic Roulette grants two relics', Array.isArray(r.relics)&&r.relics.length>=2, JSON.stringify(r.relics));
      ok('Relic Roulette hides the stall', r.shop==='none', r.shop);
      ok('run timer appears and ticks', r.inPlay&&/⏱/.test(r.timer), r.timer);
      ok('no page errors (roulette)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Boss Duel + Boss Codex ──
    {
      const {page,errs}=await open(browser);
      await clickMode(page,'Boss Duel');
      await sleep(200);
      await page.evaluate(()=>{document.querySelector('.spell-choice').click();});
      await sleep(700);
      const started=await page.evaluate(()=>({mode:window.__citadelPolish.mode(),state:window.__citadelPolish.state(),wave:window.eval('wave'),bossWave:window.isBossWave(5)}));
      ok('Boss Duel starts on wave 5', started.mode==='duel'&&started.state==='playing'&&started.wave===5, JSON.stringify(started));
      await sleep(2100);
      const liveBoss=await page.evaluate(()=>({name:window.eval('activeBoss?activeBoss.def.name:null'),bar:getComputedStyle(document.getElementById('boss-bar-wrap')).display,ms:window.__citadelFeatures.runMs(),timer:document.getElementById('citadel-run-timer').textContent}));
      ok('the duel boss actually spawns', !!liveBoss.name, JSON.stringify(liveBoss));
      ok('run timer counts real play time', liveBoss.ms>=1500&&/⏱ 00:0[1-9]/.test(liveBoss.timer), JSON.stringify({ms:liveBoss.ms,timer:liveBoss.timer}));
      const killed=await page.evaluate(()=>window.__citadelFeatures.killBoss());
      ok('test can fell the duel boss', killed);
      await sleep(300);
      // A boss drops a relic choice, which deliberately pauses the duel for a pick.
      await page.evaluate(()=>{const skip=document.getElementById('citadel-relic-skip'); if(skip) skip.click();});
      await sleep(1500);
      const end=await page.evaluate(()=>({
        state:window.__citadelPolish.state(),
        overlay:!!document.getElementById('citadel-duel-end'),
        text:(document.getElementById('citadel-duel-end')||{}).textContent||'',
        codex:JSON.parse(localStorage.getItem('jvds_citadel_bosses')||'{}')
      }));
      ok('Boss Duel shows its own victory card', end.overlay&&/Boss Duel won/.test(end.text)&&end.state==='dead', JSON.stringify({state:end.state,overlay:end.overlay}));
      ok('Boss Codex records the felled boss', Object.keys(end.codex).length>0&&Object.values(end.codex)[0].count>=1, JSON.stringify(end.codex));
      ok('no page errors (duel)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Shop reroll, afford feedback and focus ──
    {
      const {page,errs}=await open(browser);
      await startFirstSpell(page);
      await page.evaluate(()=>{window.setCitadelMode('deep'); coins=18; window.showWaveComplete();});
      await sleep(300);
      const before=await page.evaluate(()=>({
        cards:[...document.querySelectorAll('#shop-grid .shop-card')].map(c=>c.dataset.item),
        page:window.__citadelFeatures.shopPage(),
        reroll:!!document.getElementById('citadel-shop-reroll')
      }));
      ok('Deep Night stall shows a reroll control', before.reroll&&before.cards.length>0, JSON.stringify({cards:before.cards.length,reroll:before.reroll}));
      await page.evaluate(()=>{document.getElementById('citadel-shop-reroll').click();});
      await sleep(150);
      const after=await page.evaluate(()=>({
        cards:[...document.querySelectorAll('#shop-grid .shop-card')].map(c=>c.dataset.item),
        page:window.__citadelFeatures.shopPage(), coins:window.eval('coins')
      }));
      ok('reroll costs 2 coins and rotates the pool', after.page===1&&after.coins===16&&before.cards.join()!==after.cards.join(), JSON.stringify(after));

      const afford=await page.evaluate(()=>{
        coins=0; window.eval('buildShop()');
        const poor=[...document.querySelectorAll('#shop-grid .shop-card.cant-afford')][0];
        if(!poor) return {ok:false};
        poor.click();
        return {text:document.getElementById('shop-coins-display').textContent};
      });
      ok('unaffordable card explains the shortfall', /Need .* more/.test(afford.text||''), afford.text);

      const focus=await page.evaluate(()=>{
        coins=99; window.eval('buildShop()');
        const card=[...document.querySelectorAll('#shop-grid .shop-card')].filter(c=>!c.classList.contains('cant-afford'))[0];
        if(!card) return {ok:false};
        const id=card.dataset.item; card.focus();
        card.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        const active=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.item:null;
        return {id,active};
      });
      ok('buying with the keyboard keeps focus on the item', focus.active===focus.id, JSON.stringify(focus));
      ok('no page errors (shop)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Streak purse, gate regen, aiming and spawn boundary ──
    {
      const {page,errs}=await open(browser);
      await startFirstSpell(page);
      const streak=await page.evaluate(()=>{
        coins=0; killStreak=10;
        window.update(16);
        const now=window.eval('coins');
        return {coins:now,toast:(document.getElementById('citadel-toast')||{}).textContent||''};
      });
      ok('streak purse pays at ten kills', streak.coins>=2&&/Streak purse/.test(streak.toast), JSON.stringify(streak));

      const regen=await page.evaluate(()=>{
        player.gateRegen=2; tower.hp=Math.max(0,tower.maxHp-5);
        const before=tower.hp;
        window.__citadelFeatures.regenTick(6000);
        return {before,after:tower.hp};
      });
      ok('Warding Circle mends the gate', regen.after>regen.before, JSON.stringify(regen));

      const aim=await page.evaluate(()=>{
        window.__citadelPolish.pause();
        enemies=[{x:player.x+20,y:player.y,r:10,phased:true,_dead:false,type:'wraith'},{x:player.x+70,y:player.y,r:10,type:'shade'}];
        const picked=nearestEnemy(player.x,player.y).enemy.type;
        enemies=[]; window.__citadelPolish.resume();
        return picked;
      });
      ok('auto-aim skips phased wraiths', aim==='shade', aim);

      const spawn=await page.evaluate(()=>{
        window.__citadelPolish.pause();
        window.spawnEnemy();
        const e=window.__citadelFeatures.topEnemy();
        coords={x:e.x,y:e.y,r:e.r};
        const full=e.hp===e.maxHp;
        enemies=[];
        window.__citadelPolish.resume();
        return {full,coords};
      });
      ok('a fresh spawn keeps full HP before entering the arena', spawn.full, JSON.stringify(spawn.coords));
      ok('no page errors (systems)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Grade, summary rebuild, gameOver guard, Last Candle ──
    {
      const {page,errs}=await open(browser);
      await startFirstSpell(page);
      await page.evaluate(()=>{
        score=7000; wave=12; killCount=40; window.gameOver();
      });
      await sleep(350);
      const first=await page.evaluate(()=>({
        grade:(document.getElementById('citadel-grade')||{}).textContent||'',
        echo:document.querySelectorAll('#citadel-echo').length,
        share:document.querySelectorAll('#citadel-share').length,
        scores:JSON.parse(localStorage.getItem('jvds_citadel_leaderboard')||'{}').scores||[],
        state:window.__citadelPolish.state()
      }));
      ok('run grade appears on the result screen', /Run grade A/.test(first.grade), first.grade);
      ok('result screen has exactly one Echo/share set', first.echo===1&&first.share===1, JSON.stringify({echo:first.echo,share:first.share}));
      ok('a run writes exactly one leaderboard row', first.scores.length===1, 'rows '+first.scores.length);

      await page.evaluate(()=>{window.gameOver();});
      await sleep(120);
      const twice=await page.evaluate(()=>({
        scores:(JSON.parse(localStorage.getItem('jvds_citadel_leaderboard')||'{}').scores||[]).length,
        grade:document.querySelectorAll('#citadel-grade').length
      }));
      ok('a duplicate gameOver cannot double-save', twice.scores===1, JSON.stringify(twice));

      // Restart and die again: the old summary must not be reused.
      await page.evaluate(()=>{window.restartGame();});
      await sleep(200);
      await page.evaluate(()=>{document.querySelector('.spell-choice').click();});
      await sleep(600);
      await page.evaluate(()=>{score=1500; wave=4; killCount=9; window.gameOver();});
      await sleep(350);
      const second=await page.evaluate(()=>({
        echo:document.querySelectorAll('#citadel-echo').length,
        share:document.querySelectorAll('#citadel-share').length,
        grade:document.querySelectorAll('#citadel-grade').length,
        tip:(document.getElementById('citadel-echo')||{}).textContent||''
      }));
      ok('a later death rebuilds a single fresh summary', second.echo===1&&second.share===1&&second.grade===1, JSON.stringify(second));
      ok('Echo advice reflects the latest run', /Echo:/.test(second.tip)&&!/7000/.test(second.tip), second.tip.slice(0,80));
      ok('no page errors (summary)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    {
      const {page,errs}=await open(browser);
      await startFirstSpell(page);
      const candle=await page.evaluate(()=>{
        player._candle=true; player._candleUsed=false; tower.hp=0; playerHp=0;
        window.gameOver();
        const saved={state:window.__citadelPolish.state(),hp:tower.hp,max:tower.maxHp,used:player._candleUsed};
        tower.hp=0; window.gameOver();
        saved.after=window.__citadelPolish.state();
        return saved;
      });
      ok('Last Candle revives the gate once', candle.state==='playing'&&candle.hp===Math.round(candle.max*0.4)&&candle.used===true, JSON.stringify(candle));
      ok('a spent Last Candle lets the next fall end the run', candle.after==='dead', candle.after);
      ok('no page errors (candle)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Leaderboard escaping + pause/modal accessibility ──
    {
      const {page,errs}=await open(browser);
      const lb=await page.evaluate(()=>{
        localStorage.setItem('jvds_citadel_leaderboard',JSON.stringify({scores:[{score:5,wave:2,spell:'<img src=x onerror="window.__xss=1">',mode:'<b>bold',date:1}]}));
        window.openLB();
        const rows=document.getElementById('lb-rows');
        return {imgs:rows.querySelectorAll('img').length,bolds:rows.querySelectorAll('b').length,xss:!!window.__xss,html:rows.innerHTML.slice(0,120)};
      });
      ok('leaderboard text is HTML-escaped', lb.imgs===0&&lb.bolds===0&&!lb.xss&&/&lt;/.test(lb.html), JSON.stringify({imgs:lb.imgs,bolds:lb.bolds,xss:lb.xss}));
      await page.evaluate(()=>window.closeLB());

      await startFirstSpell(page);
      await page.click('#citadel-pause');
      await sleep(200);
      const paused=await page.evaluate(()=>({
        role:document.getElementById('citadel-pause-overlay').getAttribute('role'),
        modal:document.getElementById('citadel-pause-overlay').getAttribute('aria-modal'),
        stats:(document.getElementById('citadel-pause-stats')||{}).textContent||'',
        copy:!!document.getElementById('citadel-pause-copy'),
        focus:document.activeElement&&document.activeElement.id,
        state:window.__citadelPolish.state()
      }));
      ok('pause overlay is a labelled dialog with run stats', paused.role==='dialog'&&paused.modal==='true'&&/Wave/.test(paused.stats)&&paused.copy, JSON.stringify(paused));
      ok('pause moves focus to Resume', paused.focus==='citadel-resume', paused.focus);
      await page.keyboard.press('Escape');
      await sleep(150);
      ok('Escape resumes the run', (await page.evaluate(()=>window.__citadelPolish.state()))==='playing');

      const typing=await page.evaluate(()=>{
        const t=document.createElement('textarea'); t.id='test-type'; document.body.appendChild(t); t.focus(); return true;
      });
      await page.keyboard.press('p');
      await sleep(120);
      const guard=await page.evaluate(()=>{document.getElementById('test-type').remove(); return {paused:window.__citadelPolish.isPaused(),state:window.__citadelPolish.state()};});
      ok('typing in a field never pauses the run', typing&&!guard.paused&&guard.state==='playing', JSON.stringify(guard));

      const modal=await page.evaluate(()=>{
        [...document.querySelectorAll('#citadel-modes button')].filter(b=>/Settings/.test(b.textContent))[0].click();
        return !!document.getElementById('citadel-modal');
      });
      ok('settings modal opens', modal);
      await page.keyboard.press('Escape');
      await sleep(120);
      ok('Escape closes the settings modal', (await page.evaluate(()=>!!document.getElementById('citadel-modal')))===false);
      ok('no page errors (accessibility)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Haptics setting, Daily record and Daily replay guard ──
    {
      const {page,errs}=await open(browser);
      const settings=await page.evaluate(async()=>{
        [...document.querySelectorAll('#citadel-modes button')].filter(b=>/Settings/.test(b.textContent))[0].click();
        await new Promise(r=>setTimeout(r,100));
        const e=document.getElementById('citadel-set-haptics');
        e.checked=true; e.dispatchEvent(new Event('change',{bubbles:true}));
        return JSON.parse(localStorage.getItem('jvds_citadel_settings')||'{}');
      });
      ok('haptics preference persists', settings.haptics===true, JSON.stringify(settings));
      await page.keyboard.press('Escape');
      await sleep(100);

      const daily=await page.evaluate(()=>{
        [...document.querySelectorAll('#citadel-modes button')].filter(b=>/Daily Record/.test(b.textContent))[0].click();
        return {modal:!!document.getElementById('citadel-modal'),text:(document.getElementById('citadel-modal')||{}).textContent||''};
      });
      ok('Daily Night record opens with streak/best', daily.modal&&/Streak/.test(daily.text)&&/Best score/.test(daily.text), daily.text.slice(0,90));
      await page.keyboard.press('Escape');
      await sleep(100);

      await clickMode(page,'Daily Night');
      await sleep(700);
      const dailyStarted=await page.evaluate(()=>({state:window.__citadelPolish.state(),mode:window.__citadelPolish.mode()}));
      ok('Daily Night starts', dailyStarted.state==='playing'&&dailyStarted.mode==='daily', JSON.stringify(dailyStarted));
      await page.evaluate(()=>window.restartGame());
      await sleep(250);
      const guard=await page.evaluate(()=>({
        state:window.__citadelPolish.state(),mode:window.__citadelPolish.mode(),
        start:document.getElementById('screen-start').classList.contains('hidden'),
        spell:getComputedStyle(document.getElementById('screen-spell')).display
      }));
      ok('Daily Night cannot be restarted for another attempt', guard.mode==='quick'&&guard.state==='start'&&guard.start===false&&guard.spell==='none', JSON.stringify(guard));
      ok('no page errors (daily)', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }

    // ── Phone layout ──
    {
      const {page,errs}=await open(browser,{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
      await clickMode(page,'Relic Roulette');
      await sleep(200);
      await page.evaluate(()=>{document.querySelector('.spell-choice').click();});
      await sleep(800);
      const phone=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        state:window.__citadelPolish.state(),mode:window.__citadelPolish.mode(),
        tabs:document.querySelectorAll('#citadel-modes button').length,
        timer:!!document.getElementById('citadel-run-timer')
      }));
      ok('phone: new modes are playable', phone.state==='playing'&&phone.mode==='roulette'&&phone.tabs>=9, JSON.stringify(phone));
      ok('phone: no horizontal overflow', phone.overflow<=2, 'overflow='+phone.overflow);
      ok('phone: timer present', phone.timer);
      ok('phone: no page errors', errs.length===0, errs.slice(0,2).join(' | '));
      await page.close();
    }
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
