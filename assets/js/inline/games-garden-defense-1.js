(function(){
  "use strict";
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d');
  const COLS=6, ROWS=5;
  const BW=1120, BH=900;                 // logical resolution
  const CELL=BW/COLS;                    // ~186.6 wide
  const CH=BH/ROWS;                      // 180 tall
  const audio=new AudioEffects(0.6);
  let soundOn=localStorage.getItem('soundEnabled')!=='false';

  // ---- content definitions ----
  const PLANTS={
    sun:   {key:'sun',   ic:'🌻', cost:50,  hp:60,  cd:2,  fire:0,   produce:5, name:'Sunflower', unlock:0, sfx:'pop'},
    shoot: {key:'shoot', ic:'🌱', cost:75,  hp:70,  cd:2,  fire:1.4, dmg:26,   name:'Sprout', unlock:0, sfx:'shot'},
    wall:  {key:'wall',  ic:'🌰', cost:50,  hp:340, cd:4,  fire:0,   name:'Acorn Wall', unlock:0, sfx:'tap'},
    frost: {key:'frost', ic:'❄️', cost:150, hp:70,  cd:6,  fire:1.7, dmg:16, slow:.5, name:'Frost Bud', unlock:2, sfx:'zap'},
    zap:   {key:'zap',   ic:'✨', cost:125, hp:60,  cd:7,  fire:2.2, dmg:16, pierce:true, name:'Glow Bulb', unlock:3, sfx:'zap'},
    boom:  {key:'boom',  ic:'🍄', cost:125, hp:1,   cd:12, boom:true, name:'Boom Shroom', unlock:5, sfx:'level'},
    thorn: {key:'thorn', ic:'🌵', cost:100, hp:120, cd:5,  fire:0,   aura:18, name:'Thorn Vine', unlock:8, sfx:'shot'}
  };
  // speeds are px/sec on the 1120px-wide logical board (CELL ~= 186px)
  const PESTS={
    cat:    {ic:'🐛', hp:85,  spd:56,  dmg:40, pts:15, sun:0},
    hop:    {ic:'🦗', hp:70,  spd:112, dmg:35, pts:22, sun:0},
    beet:   {ic:'🪲', hp:230, spd:46,  dmg:50, pts:30, sun:0},
    snail:  {ic:'🐌', hp:480, spd:30,  dmg:60, pts:45, sun:0},
    burrow: {ic:'🪱', hp:100, spd:75,  dmg:45, pts:28, sun:0, burrow:true},
    shield: {ic:'🐞', hp:160, spd:50,  dmg:45, pts:35, sun:0, shieldHp:80},
    boss:   {ic:'🕷️', hp:2200,spd:40,  dmg:110,pts:300,sun:0,boss:true},
    moth:   {ic:'🦟', hp:1800,spd:50,  dmg:90, pts:250,sun:0,boss:true,spawns:true},
    titan:  {ic:'🐜', hp:3200,spd:28,  dmg:150,pts:400,sun:0,boss:true}
  };
  const BOSS_POOL=['boss','moth','titan'];
  const PICK_ORDER=['sun','shoot','wall','frost','zap','boom','thorn'];

  // ---- unlock persistence ----
  function loadUnlocks(){try{const s=JSON.parse(localStorage.getItem('gd_unlocks')||'{}');return{maxWave:s.maxWave||0,wins:s.wins||0};}catch(e){return{maxWave:0,wins:0};}}
  function saveUnlocks(u){try{localStorage.setItem('gd_unlocks',JSON.stringify(u));}catch(e){}}
  let unlockState=loadUnlocks();
  function isPlantUnlocked(k){return PLANTS[k].unlock<=unlockState.maxWave;}

  // lawn decor: fixed random specks per row (computed once)
  const DECOR=[];
  (function(){let s=42;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
    for(let i=0;i<90;i++)DECOR.push({x:rnd()*BW,y:rnd()*BH,w:6+rnd()*10,a:.05+rnd()*.08,d:rnd()>.5});
    // flowers: small colored dots scattered on the lawn
    window.__gdFlowers=[];
    for(let i=0;i<24;i++) window.__gdFlowers.push({x:rnd()*BW,y:rnd()*BH,c:['#fff8','#ffeb3b88','#f48fb188','#81d4fa88'][Math.floor(rnd()*4)],r:2+rnd()*3});
  })();

  // ---- persistent records ----
function loadBest(){try{var s=(window.GameSystem&&window.GameSystem.getScoreState)?window.GameSystem.getScoreState('garden-defense'):(JSON.parse(localStorage.getItem('jvds_game_garden-defense')||'null')||{});return{score:s.highScore||0,wave:(s.extra&&s.extra.bestWave)||0};}catch(e){return{score:0,wave:0};}}
  function saveBest(b){try{if(window.GameSystem&&window.GameSystem.saveScore)window.GameSystem.saveScore('garden-defense',b.score||0,{level:b.wave||1,extra:{bestWave:b.wave||0}});}catch(e){}}
  let best=loadBest();
  function showBestLine(){
    const el=document.getElementById('bestLine');
    if(best.score>0){el.style.display='inline-block';el.textContent='🏅 Best: '+best.score+' pts · Wave '+best.wave;}
  }
  showBestLine();

  // ---- state ----
  let grid, pests, shots, suns, guards, sun, waveIdx, score, running, paused,
      selected, spawnQ, betweenTimer, lastT, stats, achUnlocked, pickerEls={},
      floats, deaths, streak, lastKillT, speedMult=1, hoverCell=null, victoryShown, waveGoals,
      upgradeOpen, upgradeChoices, upgrades;
  // #8 endless, #9 stars, #10 seed, #12 daily, #19 undo, #20 auto-collect, #5 drought, #22 keyboard cursor
  let endless=false, endlessWave=0, starRating=0, gameSeed=0, dailyMode=false;
  let lastPlaced=null, undoTimer=0;
  let autoCollect=localStorage.getItem('gd_autoCollect')==='true';
  let droughtActive=false, droughtTimer=0;
  let kbCursor={col:2,row:2,active:false};
  let tutorialShown=localStorage.getItem('gd_tutDone')==='true', tutorialStep=0, tutorialOverlay=false;

  const UPGRADES=[
    {id:'sun',icon:'☀️',title:'Sunny Soil',desc:'Sunflowers produce 20% more sun.',apply:()=>{upgrades.sun++;}},
    {id:'quick',icon:'⚡',title:'Quick Roots',desc:'All plant cooldowns are 15% faster.',apply:()=>{upgrades.quick++;}},
    {id:'guard',icon:'🛡️',title:'Guard Rally',desc:'Restore one lost garden guard.',apply:()=>{const i=guards.indexOf(false);if(i>=0)guards[i]=true;else sun+=75;}},
    {id:'combo',icon:'🔥',title:'Bright Banners',desc:'All pest defeats score 10% more points.',apply:()=>{upgrades.combo++;}},
    {id:'starter',icon:'🌻',title:'Sun Cache',desc:'Begin the next wave with 90 extra sun.',apply:()=>{sun+=90;}}
  ];

  function reset(){
    grid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    pests=[]; shots=[]; suns=[]; floats=[]; deaths=[];
    guards=Array(ROWS).fill(true);
    sun=150; waveIdx=0; score=0; running=true; paused=false; victoryShown=false;
    selected=null; spawnQ=[]; betweenTimer=2.2; lastT=performance.now(); upgradeOpen=false; upgradeChoices=[];
    upgrades={sun:0,quick:0,combo:0};
    stats={killed:0,placed:0,bestBoom:0,sunCollected:0,bestStreak:0,waveStartGuards:5,waveStartSun:150,dmgDealt:0};
    waveGoals={guard:false,economy:false,streak:false};
    achUnlocked=[]; streak=0; lastKillT=-99; hoverCell=null;
    endless=false; endlessWave=0; starRating=0;
    lastPlaced=null; undoTimer=0;
    droughtActive=false; droughtTimer=0;
    kbCursor={col:2,row:2,active:false};
    tutorialStep=0; tutorialOverlay=!tutorialShown;
    window.__gdWaveClock=0;
    document.getElementById('pauseBtn').textContent='⏸';
    updateHUD(); buildPicker();
  }
  // #10 seeded random for challenge codes
  function seededRng(seed){let s=seed;return()=>{s=(s*16807+1)%2147483647;return s/2147483647;};}
  let waveRng=Math.random;

  // ---- wave generation ----
  function buildWave(n){
    const rng=waveRng;
    const q=[]; let t=0.4;
    const count=Math.round(2+n*1.8);
    const poolN=Math.min(n,10);
    const hpMult = n>10 ? 1+0.12*(n-10) : 1;
    const pool=[];
    pool.push('cat');
    if(poolN>=2) pool.push('cat');
    if(poolN>=3) pool.push('beet');
    if(poolN>=4) pool.push('hop');
    if(poolN>=5) pool.push('burrow');
    if(poolN>=6) pool.push('beet','snail');
    if(poolN>=7) pool.push('shield');
    if(poolN>=8) pool.push('snail','hop','burrow');
    if(poolN>=9) pool.push('shield','snail');
    const gap=Math.max(0.55, 2.4 - poolN*0.16);
    for(let i=0;i<count;i++){
      const type=pool[Math.floor(rng()*pool.length)];
      q.push({t, row:Math.floor(rng()*ROWS), type, hpMult});
      t += gap*(0.6+rng()*0.8);
    }
    if(n===5 || n===10){
      q.push({t:t+0.5, row:2, type:'boss', hpMult:1});
      for(let i=0;i<(n===10?6:3);i++) q.push({t:t+1+i*0.8, row:Math.floor(rng()*ROWS), type:i%2?'snail':'beet', hpMult:1});
    } else if(n>10 && n%5===0){
      const bossType=BOSS_POOL[Math.floor(rng()*BOSS_POOL.length)];
      q.push({t:t+0.5, row:Math.floor(rng()*ROWS), type:bossType, hpMult});
      for(let i=0;i<4;i++) q.push({t:t+1+i*0.7, row:Math.floor(rng()*ROWS), type:pool[Math.floor(rng()*pool.length)], hpMult});
    } else if(n>5 && n%3===0){
      const miniBoss=BOSS_POOL[Math.floor(rng()*BOSS_POOL.length)];
      q.push({t:t+0.5, row:Math.floor(rng()*ROWS), type:miniBoss, hpMult:hpMult*0.6});
    }
    return q.sort((a,b)=>a.t-b.t);
  }

  function wavePreview(n){
    const q=buildWave(Math.max(1,n)), counts={};
    q.forEach(e=>counts[e.type]=(counts[e.type]||0)+1);
    return Object.entries(counts).map(([id,count])=>PESTS[id].ic+' x'+count).join('  ');
  }
  function refreshWaveIntel(){
    const el=document.getElementById('waveIntel'); if(!el) return;
    const next=waveIdx>=5?5:Math.max(1,waveIdx+1);
    const guardsLeft=guards?guards.filter(Boolean).length:5;
    const goals=waveGoals||{};
    el.innerHTML='<span class="gd-intel-pill">Next: '+wavePreview(next)+'</span>'+
      '<span class="gd-intel-pill '+(guardsLeft>=4?'done':'warn')+'">Guards '+guardsLeft+'/5</span>'+
      '<span class="gd-intel-pill '+(goals.economy?'done':'')+'">Economy '+(goals.economy?'set':'build')+'</span>'+
      '<span class="gd-intel-pill '+(goals.streak?'done':'')+'">Streak '+(stats&&stats.bestStreak>=5?'ready':'aim 5')+'</span>';
  }
  function startWave(){
    waveIdx++;
    if(stats){stats.waveStartGuards=guards.filter(Boolean).length;stats.waveStartSun=sun;}
    if(!endless && waveIdx>5){ showVictoryChoice(); return; }
    spawnQ=buildWave(waveIdx);
    window.__gdWaveClock=0;
    if(waveIdx===1 && tutorialOverlay) showTutorial();
    if(waveIdx===1) flashHint('First wave: plant Sunflower early, then add a Sprout in the busiest lane.');
    if(waveGoals) waveGoals.guard=guards.filter(Boolean).length>=stats.waveStartGuards;
    if(waveIdx===5) banner('Wave 5 - Boss! 🕷️');
    else if(waveIdx>5) banner('Endless Wave '+waveIdx);
    else banner('Wave '+waveIdx);
    beep('wave');
    if(waveIdx>1){ sun+=40; }
    // #5 drought event: random chance after wave 3
    if(waveIdx>=3 && waveRng()>0.65){ droughtActive=true; droughtTimer=12; flashHint('Sun Drought! Fewer sky suns for a while.'); banner('☁️ Sun Drought!'); }
    else droughtActive=false;
    // #25 wave escalation sound
    if(waveIdx>=4 && soundOn) audio.playCombo(Math.min(waveIdx-2,5));
    if(waveIdx>=15 && !achUnlocked.includes('gd_wave15')){achUnlocked.push('gd_wave15');gs.unlockAchievement('gd_wave15');}
    updateHUD(); refreshWaveIntel();
  }
  // #8 endless mode: after wave 5 victory, offer continue or finish
  function showVictoryChoice(){
    if(victoryShown) return;
    victoryShown=true; paused=true;
    const el=document.getElementById('upgradeScreen');
    const gridEl=document.getElementById('upgradeGrid');
    document.querySelector('#upgradeScreen h2').textContent='Garden Saved!';
    document.querySelector('#upgradeScreen .big').textContent='🏆';
    document.querySelector('#upgradeScreen p').textContent='You held all five waves! Continue into Endless mode for more challenge and higher scores, or finish now.';
    gridEl.innerHTML='';
    const endBtn=document.createElement('button');endBtn.type='button';endBtn.className='upgrade-choice';
    endBtn.innerHTML='<span class="upgrade-icon">🏆</span><strong>Finish</strong><span>Save your score and claim victory.</span>';
    endBtn.onclick=()=>{document.querySelector('#upgradeScreen h2').textContent='Choose a garden upgrade';document.querySelector('#upgradeScreen .big').textContent='🌿';el.classList.add('hidden');paused=false;lastT=performance.now();win();};
    const goBtn=document.createElement('button');goBtn.type='button';goBtn.className='upgrade-choice';
    goBtn.innerHTML='<span class="upgrade-icon">🌀</span><strong>Endless Mode</strong><span>Waves keep coming. How long can you hold?</span>';
    goBtn.onclick=()=>{document.querySelector('#upgradeScreen h2').textContent='Choose a garden upgrade';document.querySelector('#upgradeScreen .big').textContent='🌿';el.classList.add('hidden');endless=true;paused=false;lastT=performance.now();betweenTimer=3;flashHint('Endless mode! Waves will never stop.');};
    gridEl.appendChild(goBtn); gridEl.appendChild(endBtn);
    el.classList.remove('hidden');
    beep('level');
  }

  // ---- picker ----
  let cooldowns={};
  function buildPicker(){
    const p=document.getElementById('picker'); p.innerHTML='';
    pickerEls={};
    PICK_ORDER.forEach((k,i)=>{
      const d=PLANTS[k];
      const locked=!isPlantUnlocked(k);
      const el=document.createElement('button');
      el.type='button';
      el.setAttribute('aria-label',locked?d.name+' (locked, need wave '+d.unlock+')':d.name+' plant, costs '+d.cost+' sun');
      el.setAttribute('aria-pressed','false');
      el.className='seed'+(locked?' locked':''); el.dataset.k=k;
      el.innerHTML=locked
        ?`<span class="key">${i+1}</span><div class="ic" style="filter:grayscale(1) brightness(.5)">🔒</div><div class="cost">W${d.unlock}</div><div class="cd" style="display:none"></div><canvas class="cd-arc" width="68" height="68"></canvas>`
        :`<span class="key">${i+1}</span><div class="ic">${d.ic}</div><div class="cost">☀️${d.cost}</div><div class="cd" style="display:none"></div><canvas class="cd-arc" width="68" height="68"></canvas>`;
      el.onclick=()=>{if(locked){flashHint(d.name+' unlocks at wave '+d.unlock+'!');return;}selectPlant(k);};
      p.appendChild(el); pickerEls[k]=el;
    });
    const sh=document.createElement('button');
    sh.type='button';
    sh.setAttribute('aria-label','Shovel, remove a plant (25% sun refund)');
    sh.setAttribute('aria-pressed','false');
    sh.className='seed shovel'; sh.dataset.k='shovel';
    sh.innerHTML=`<div class="ic">🧹</div><div class="cost">Dig</div>`;
    sh.onclick=()=>selectPlant('shovel');
    p.appendChild(sh); pickerEls.shovel=sh;
    cooldowns={}; for(const k in PLANTS) cooldowns[k]=0;
  }
  function selectPlant(k){
    if(k!=='shovel'){
      if(sun<PLANTS[k].cost) { flashHint('Not enough sun for '+PLANTS[k].name); return; }
      if(cooldowns[k]>0) return;
    }
    selected = (selected===k)?null:k;
    for(const id in pickerEls){
      pickerEls[id].classList.toggle('sel', id===selected);
      pickerEls[id].setAttribute('aria-pressed', id===selected ? 'true' : 'false');
    }
    beep('tap');
  }

  // ---- input ----
  function canvasPos(e){
    const r=canvas.getBoundingClientRect();
    const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
    return {x:cx/r.width*BW, y:cy/r.height*BH};
  }
  function onTap(e){
    if(!running) return;
    e.preventDefault();
    const p=canvasPos(e);
    // collect sun first
    for(let i=suns.length-1;i>=0;i--){
      const s=suns[i];
      if(Math.hypot(s.x-p.x,s.y-p.y)<CELL*0.45){ collectSun(s,i,e); return; }
    }
    const col=Math.floor(p.x/CELL), row=Math.floor(p.y/CH);
    if(col<0||col>=COLS||row<0||row>=ROWS) return;
    if(selected==='shovel'){
      if(grid[row][col]){
        const refund=Math.floor(PLANTS[grid[row][col].type].cost*0.25);
        sun+=refund; grid[row][col]=null; beep('pop');
        fxBurst(col*CELL+CELL/2,row*CH+CH/2,'💨',6);
        if(refund>0) addFloat(col*CELL+CELL/2,row*CH+CH/2,'+'+refund,'#8a6a00');
        updateHUD();
      }
      return;
    }
    if(!selected) { flashHint(waveIdx<2?'First pick Sunflower for economy or Sprout for defense.':'Pick a plant from the tray first'); return; }
    const d=PLANTS[selected];
    if(grid[row][col]){ flashHint('That tile is taken'); return; }
    if(sun<d.cost){ flashHint('Not enough sun'); return; }
    if(cooldowns[selected]>0) return;
    placePlant(selected,row,col);
  }
  canvas.addEventListener('mousedown',onTap);
  canvas.addEventListener('touchstart',onTap,{passive:false});
  canvas.addEventListener('mousemove',e=>{
    const p=canvasPos(e);
    const col=Math.floor(p.x/CELL), row=Math.floor(p.y/CH);
    hoverCell=(col>=0&&col<COLS&&row>=0&&row<ROWS)?{col,row}:null;
  });
  canvas.addEventListener('mouseleave',()=>{hoverCell=null;});

  // keyboard shortcuts with #22 arrow key cursor
  document.addEventListener('keydown',e=>{
    if(!running) return;
    const i=parseInt(e.key)-1;
    if(i>=0 && i<PICK_ORDER.length){ selectPlant(PICK_ORDER[i]); }
    else if(e.key===' '){ e.preventDefault(); togglePause(); }
    else if(e.key==='d'||e.key==='D'){ selectPlant('shovel'); }
    else if(e.key==='s'||e.key==='S'){ const sb=document.getElementById('speedBtn'); if(sb) sb.click(); }
    else if(e.key==='z'||e.key==='Z'){ undoLastPlant(); }
    else if(e.key==='ArrowUp'){e.preventDefault();kbCursor.active=true;kbCursor.row=Math.max(0,kbCursor.row-1);}
    else if(e.key==='ArrowDown'){e.preventDefault();kbCursor.active=true;kbCursor.row=Math.min(ROWS-1,kbCursor.row+1);}
    else if(e.key==='ArrowLeft'){e.preventDefault();kbCursor.active=true;kbCursor.col=Math.max(0,kbCursor.col-1);}
    else if(e.key==='ArrowRight'){e.preventDefault();kbCursor.active=true;kbCursor.col=Math.min(COLS-1,kbCursor.col+1);}
    else if(e.key==='Enter'&&kbCursor.active){
      e.preventDefault();
      if(selected==='shovel'){
        if(grid[kbCursor.row][kbCursor.col]){const refund=Math.floor(PLANTS[grid[kbCursor.row][kbCursor.col].type].cost*0.25);sun+=refund;grid[kbCursor.row][kbCursor.col]=null;beep('pop');if(refund>0)addFloat(kbCursor.col*CELL+CELL/2,kbCursor.row*CH+CH/2,'+'+refund,'#8a6a00');updateHUD();}
      } else if(selected&&!grid[kbCursor.row][kbCursor.col]&&sun>=PLANTS[selected].cost&&cooldowns[selected]<=0&&isPlantUnlocked(selected)){
        placePlant(selected,kbCursor.row,kbCursor.col);
      }
    }
  });

  function placePlant(k,row,col){
    const d=PLANTS[k];
    sun-=d.cost; cooldowns[k]=window.__gdFastCd?0.3:d.cd/((upgrades.quick||0)*.15+1);
    stats.placed++;
    if(k==='sun' && waveGoals) waveGoals.economy=true;
    if(!achUnlocked.includes('gd_firstBloom')){achUnlocked.push('gd_firstBloom');gs.unlockAchievement('gd_firstBloom');}
    if(d.boom){
      cooldowns[k]=d.cd/((upgrades.quick||0)*.15+1);
      boomBlast(row,col);
    } else {
      grid[row][col]={type:k,hp:d.hp,maxHp:d.hp,fireT:d.fire?d.fire*Math.random():0,prodT:d.produce||0,pop:1,recoil:0,sway:Math.random()*6,auraT:0};
      beep(d.sfx||'success');
      fxBurst(col*CELL+CELL/2,row*CH+CH/2,'🌱',5);
      lastPlaced={k,row,col,cost:d.cost}; undoTimer=2;
    }
    if(sun<d.cost || cooldowns[k]>0){ selected=null; for(const id in pickerEls) pickerEls[id].classList.remove('sel'); }
    updateHUD();
  }
  // #19 undo last plant
  function undoLastPlant(){
    if(!lastPlaced || undoTimer<=0) return;
    const{k,row,col,cost}=lastPlaced;
    if(grid[row][col] && grid[row][col].type===k){
      grid[row][col]=null; sun+=cost; lastPlaced=null; undoTimer=0;
      beep('pop'); flashHint('Undo! '+PLANTS[k].name+' removed.'); updateHUD();
    }
  }

  function boomBlast(row,col){
    beep('level'); ScreenShake.shake(canvas,10,320);
    const cx=col*CELL+CELL/2, cy=row*CH+CH/2;
    fxBurst(cx,cy,'💥',14);
    let hit=0;
    pests.forEach(z=>{
      if(z.row>=row-1&&z.row<=row+1 && Math.abs(z.x-cx)<CELL*1.6){ z.hp-=900; z.hitT=.2; hit++; }
    });
    stats.bestBoom=Math.max(stats.bestBoom,hit);
    if(hit>=5 && !achUnlocked.includes('gd_boomKing')){achUnlocked.push('gd_boomKing');gs.unlockAchievement('gd_boomKing');}
  }

  // ---- sun motes ----
  function spawnSkySun(){
    suns.push({x:CELL*(0.5+Math.floor(Math.random()*COLS)), y:-40, ty:CH*(0.5+Math.floor(Math.random()*ROWS)),
               val:50, life:10, vy:120, from:'sky'});
  }
  function spawnPlantSun(px,py){
    suns.push({x:px, y:py, ty:py, val:50, life:7, vy:0, from:'plant'});
  }
  function collectSun(s,i,_e){
    sun+=s.val; stats.sunCollected+=s.val;
    beep('pop');
    suns.splice(i,1); updateHUD();
    addFloat(s.x,s.y,'+'+s.val,'#8a6a00');
    try{
      const r=canvas.getBoundingClientRect();
      const px=r.left+s.x/BW*r.width, py=r.top+s.y/BH*r.height;
      const pill=document.getElementById('sunPill').getBoundingClientRect();
      const d=document.createElement('div');
      d.className='flysun'; d.textContent='☀️';
      d.style.left=px+'px'; d.style.top=py+'px';
      document.body.appendChild(d);
      d.animate([{transform:'translate(0,0) scale(1)',opacity:1},
                 {transform:`translate(${pill.left+14-px}px,${pill.top+4-py}px) scale(.5)`,opacity:.7}],
                {duration:420,easing:'cubic-bezier(.35,0,.6,1)'});
      setTimeout(()=>{d.remove();ScreenShake.pulse(document.getElementById('sunPill'),1.12,200);},400);
    }catch(err){}
    refreshPickerAfford();
    refreshWaveIntel();
  }

  // ---- floating text ----
  function addFloat(x,y,txt,col,size){
    floats.push({x,y,txt,col:col||'#fff',t:0.9,size:size||34});
  }

  // ---- loop ----
  function loop(now){
    if(!running){return;}
    let dt=(now-lastT)/1000; lastT=now;
    if(dt>0.1) dt=0.1;
    if(!paused) update(dt*speedMult);
    render();
    requestAnimationFrame(loop);
  }

  let skySunTimer=3;
  function update(dt){
    // cooldowns
    for(const k in cooldowns) if(cooldowns[k]>0) cooldowns[k]=Math.max(0,cooldowns[k]-dt*(1+(upgrades.quick||0)*.15));
    updatePickerCD();

    // #19 undo timer
    if(undoTimer>0) undoTimer=Math.max(0,undoTimer-dt);

    // #5 drought timer
    if(droughtActive){ droughtTimer-=dt; if(droughtTimer<=0) droughtActive=false; }

    // wave management
    if(spawnQ.length){
      window.__gdWaveClock+=dt;
      while(spawnQ.length && spawnQ[0].t<=window.__gdWaveClock){
        const s=spawnQ.shift(); spawnPest(s.type,s.row,s.hpMult||1);
      }
    } else if(pests.length===0){
      betweenTimer-=dt;
      if(betweenTimer<=0){
        if(waveIdx>0 && !upgradeOpen){ showUpgrade(); }
        else if(!upgradeOpen){ betweenTimer=4.5; startWave(); }
      }
    }

    // sky sun (slower during drought)
    skySunTimer-=dt;
    const sunInterval=droughtActive?12+Math.random()*4:6+Math.random()*3;
    if(skySunTimer<=0){ skySunTimer=sunInterval; spawnSkySun(); }

    // suns + #20 auto-collect
    for(let i=suns.length-1;i>=0;i--){
      const s=suns[i];
      if(s.from==='sky' && s.y<s.ty){ s.y=Math.min(s.ty,s.y+s.vy*dt); }
      else s.life-=dt;
      if(autoCollect && s.from==='sky' && s.y>=s.ty-10 && s.life>0){collectSun(s,i,null);continue;}
      if(autoCollect && s.from==='plant' && s.life<6){collectSun(s,i,null);continue;}
      if(s.life<=0){ suns.splice(i,1); }
    }

    // plants act
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const pl=grid[r][c]; if(!pl) continue;
      if(pl.pop>0) pl.pop=Math.max(0,pl.pop-dt*3);
      if(pl.recoil>0) pl.recoil=Math.max(0,pl.recoil-dt*4);
      const d=PLANTS[pl.type];
      if(d.produce){
        pl.prodT-=dt;
        if(pl.prodT<=0){ pl.prodT=d.produce/((upgrades.sun||0)*.2+1); spawnPlantSun(c*CELL+CELL/2, r*CH+CH*0.5); }
      }
      if(d.fire){
        const ahead=pests.some(z=>z.row===r && z.x>c*CELL);
        if(ahead){
          pl.fireT-=dt;
          if(pl.fireT<=0){ pl.fireT=d.fire; pl.recoil=1; fireShot(r,c,pl.type); }
        }
      }
      // #1 Thorn Vine aura damage
      if(d.aura){
        pl.auraT=(pl.auraT||0)-dt;
        if(pl.auraT<=0){
          pl.auraT=0.8;
          for(const z of pests){
            if(Math.abs(z.row-r)<=1 && Math.abs(z.x-(c*CELL+CELL/2))<CELL*1.2){
              z.hp-=d.aura; z.hitT=.1; stats.dmgDealt+=d.aura;
              addFloat(z.x+Math.random()*20-10,z.row*CH+CH*0.3,'-'+d.aura,'#66bb6a',22);
            }
          }
        }
      }
    }

    // shots with #4 frost+sprout combo bonus and #17 damage floats
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i]; s.x+=s.vx*dt;
      if(s.x>BW+30){ shots.splice(i,1); continue; }
      if(s.pierce){
        for(const z of pests){
          if(z.row===s.row && !s.hit.has(z) && Math.abs(z.x-s.x)<CELL*0.4){
            let dmg=s.dmg;
            if(z.slowT>0 && !s.slow) dmg=Math.round(dmg*1.5);
            if(z.shieldHp>0){const ab=Math.min(z.shieldHp,dmg);z.shieldHp-=ab;dmg-=ab;}
            z.hp-=dmg; z.hitT=.15; s.hit.add(z); stats.dmgDealt+=dmg;
            addFloat(z.x,z.row*CH+CH*0.25,'-'+dmg,z.slowT>0&&!s.slow?'#80d8ff':'#ff8a80',20);
          }
        }
      } else {
        let hitZ=null,hd=1e9;
        for(const z of pests){ if(z.row===s.row){ const dx=z.x-s.x; if(dx>-CELL*0.35 && dx<hd){hd=dx;hitZ=z;} } }
        if(hitZ && Math.abs(hitZ.x-s.x)<CELL*0.45){
          let dmg=s.dmg;
          if(hitZ.slowT>0 && !s.slow) dmg=Math.round(dmg*1.5);
          if(hitZ.shieldHp>0){const ab=Math.min(hitZ.shieldHp,dmg);hitZ.shieldHp-=ab;dmg-=ab;}
          hitZ.hp-=dmg; hitZ.hitT=.15; stats.dmgDealt+=dmg;
          addFloat(hitZ.x,hitZ.row*CH+CH*0.25,'-'+dmg,hitZ.slowT>0&&!s.slow?'#80d8ff':'#ff8a80',20);
          if(s.slow){ hitZ.slowT=1.6; }
          shots.splice(i,1);
        }
      }
    }

    // pests with #2 burrower and #3 shield bug behaviors
    for(let i=pests.length-1;i>=0;i--){
      const z=pests[i];
      if(!z) continue;
      if(z.hp<=0){ killPest(z,i); continue; }
      if(z.slowT>0) z.slowT-=dt;
      if(z.hitT>0) z.hitT-=dt;
      // #3 shield regeneration (slow)
      if(PESTS[z.type].shieldHp && z.shieldHp<PESTS[z.type].shieldHp){z.shieldRegenT=(z.shieldRegenT||0)+dt;if(z.shieldRegenT>4){z.shieldHp=Math.min(z.shieldHp+20,PESTS[z.type].shieldHp);z.shieldRegenT=0;}}
      const col=Math.floor(z.x/CELL);
      const blocker = (col>=0&&col<COLS)? grid[z.row][col] : null;
      // #2 burrower: skip past the first plant it meets
      if(blocker && z.burrow && !z.burrowed){
        z.burrowed=true; z.chew=false;
        z.x=col*CELL-CELL*0.1;
        addFloat(z.x,z.row*CH+CH*0.3,'Burrowed!','#a1887f',22);
      } else if(blocker && !(z.burrow && !z.burrowed)){
        z.chewT=(z.chewT||0)+dt;
        z.chew=true;
        if(z.chewT>=0.6){ z.chewT=0; blocker.hp-=z.dmg; blocker.pop=0.6; if(blocker.hp<=0){ grid[z.row][col]=null; fxBurst(col*CELL+CELL/2,z.row*CH+CH/2,'🍂',5);} }
      } else {
        z.chew=false;
        const sp=z.spd*(z.slowT>0?0.45:1);
        z.x-=sp*dt;
        if(z.x<CELL*0.15){ breach(z.row); break; }
      }
      // moth boss: spawn minions
      if(z.spawns && z.spawnT!==undefined){z.spawnT-=dt;if(z.spawnT<=0){z.spawnT=5;spawnPest('hop',z.row,1);}}
    }

    // floats & deaths
    for(let i=floats.length-1;i>=0;i--){const f=floats[i];f.t-=dt;f.y-=45*dt;if(f.t<=0)floats.splice(i,1);}
    for(let i=deaths.length-1;i>=0;i--){const d=deaths[i];d.t-=dt;d.y-=20*dt;d.rot+=dt*4;if(d.t<=0)deaths.splice(i,1);}

    // streak timeout
    if(streak>0 && (performance.now()/1000-lastKillT)>2.5) streak=0;
  }

  function spawnPest(type,row,hpMult){
    const d=PESTS[type];
    const hp=Math.round(d.hp*(hpMult||1));
    const z={type,row,x:BW+CELL*0.4+Math.random()*40, hp,maxHp:hp,spd:d.spd,dmg:d.dmg,pts:d.pts,ic:d.ic,slowT:0,chewT:0,hitT:0,wob:Math.random()*6,boss:d.boss};
    if(d.burrow) z.burrow=true;
    if(d.shieldHp){z.shieldHp=Math.round(d.shieldHp*(hpMult||1));z.maxShield=z.shieldHp;z.shieldRegenT=0;}
    if(d.spawns) z.spawns=true, z.spawnT=4;
    pests.push(z);
    if(d.boss){ banner(d.ic+' Boss incoming!'); ScreenShake.shake(canvas,8,300); }
  }
  function fireShot(r,c,ptype){
    const d=PLANTS[ptype];
    shots.push({row:r,x:c*CELL+CELL*0.75,y:r*CH+CH*0.42,vx:d.pierce?640:520,dmg:d.dmg,slow:!!d.slow,pierce:!!d.pierce,hit:d.pierce?new Set():null,src:ptype});
    // #24 per-plant sound identity
    if(d.slow) beep('zap');
    else if(d.pierce) beep('zap');
    else beep('shot');
  }
  function killPest(z,i){
    pests.splice(i,1);
    // streak multiplier: chain kills within 2.5s
    const nowS=performance.now()/1000;
    streak = (nowS-lastKillT<=2.5) ? streak+1 : 1;
    lastKillT=nowS;
    stats.bestStreak=Math.max(stats.bestStreak,streak); if(streak>=5 && waveGoals) waveGoals.streak=true;
    if(streak>=5 && !achUnlocked.includes('gd_streak5')){achUnlocked.push('gd_streak5');gs.unlockAchievement('gd_streak5');}
    const mult=(1+Math.min(streak-1,4)*0.25)*(1+(upgrades.combo||0)*.1);
    const pts=Math.round(z.pts*mult);
    score+=pts; stats.killed++;
    let gsBonus=0;
    if(z.boss){ score+=200; gsBonus+=200; fxBurst(z.x,z.y,'🎆',16); ScreenShake.shake(canvas,12,400); addFloat(z.x,z.y-40,'BOSS DOWN!','#ffd75e',44); }
    fxBurst(z.x,z.y,'⭐',5);
    deaths.push({x:z.x,y:z.row*CH+CH/2,ic:z.ic,t:0.45,rot:0});
    addFloat(z.x,z.row*CH+CH*0.3,'+'+pts,mult>1?'#ffb347':'#fff');
    if(mult>1) addFloat(z.x,z.row*CH+CH*0.3-36,'×'+mult.toFixed(2).replace(/\.?0+$/,''),'#ff7b54',26);
    if(soundOn) audio.playCombo(Math.min(streak,4));
    window.__gsScore=(window.__gsScore||0)+pts+gsBonus;
    updateHUD();
  }
  function breach(row){
    if(guards[row]){
      guards[row]=false;
      beep('level'); ScreenShake.shake(canvas,14,400);
      for(let i=pests.length-1;i>=0;i--){ if(pests[i].row===row){ const bonus=Math.floor(pests[i].pts*0.5); score+=bonus; window.__gsScore=(window.__gsScore||0)+bonus; fxBurst(pests[i].x,pests[i].y,'🐛✨',6); deaths.push({x:pests[i].x,y:row*CH+CH/2,ic:pests[i].ic,t:0.45,rot:0}); pests.splice(i,1);} }
      addFloat(CELL*1.5,row*CH+CH/2,'Lumo saves row '+(row+1)+'!','#fff6a8',30);
      flashHint('Lumo cleared row '+(row+1)+'!');
      updateHUD();
    } else {
      lose();
    }
  }

  // ---- render ----
  function render(){
    const nowMs=performance.now();
    ctx.clearRect(0,0,BW,BH);

    // ── Lawn: high-contrast alternating rows ──
    for(let r=0;r<ROWS;r++){
      const y=r*CH;
      const lg=ctx.createLinearGradient(0,y,0,y+CH);
      if(r%2===0){ lg.addColorStop(0,'#7ecf5a'); lg.addColorStop(0.5,'#6bbe48'); lg.addColorStop(1,'#5aad38'); }
      else       { lg.addColorStop(0,'#5aad38'); lg.addColorStop(0.5,'#4d9c2e'); lg.addColorStop(1,'#408c24'); }
      ctx.fillStyle=lg; ctx.fillRect(0,y,BW,CH);

      // Strong soil divider between rows
      ctx.fillStyle='rgba(70,45,20,0.35)';
      ctx.fillRect(0,y+CH-4,BW,4);
      ctx.fillStyle='rgba(255,255,220,0.15)';
      ctx.fillRect(0,y,BW,2);

      // Guard zone: bright golden strip
      if(guards[r]){
        const gg=ctx.createLinearGradient(0,y,CELL*0.45,y);
        gg.addColorStop(0,'rgba(255,230,100,0.45)'); gg.addColorStop(1,'rgba(255,230,100,0)');
        ctx.fillStyle=gg; ctx.fillRect(0,y,CELL*0.45,CH);
      }
    }

    // ── Sunlight wash ──
    const sunWash=ctx.createLinearGradient(0,0,BW,BH);
    sunWash.addColorStop(0,'rgba(255,247,177,0.22)'); sunWash.addColorStop(0.45,'rgba(255,255,255,0)'); sunWash.addColorStop(1,'rgba(20,60,30,0.15)');
    ctx.fillStyle=sunWash; ctx.fillRect(0,0,BW,BH);

    // ── Left defence path ──
    ctx.fillStyle='rgba(90,58,26,0.3)';
    roundRect(2,4,CELL*0.28,BH-8,18); ctx.fill();
    ctx.fillStyle='rgba(255,231,139,0.25)';
    roundRect(CELL*0.02,10,CELL*0.2,BH-20,14); ctx.fill();

    // ── Row labels: color-coded by threat (#14) ──
    for(let r=0;r<ROWS;r++){
      const ly=r*CH+CH/2;
      const rowPests=pests.filter(z=>z.row===r);
      const threat=rowPests.length===0?'safe':rowPests.some(z=>z.x<CELL*2)?'crit':rowPests.some(z=>z.x<CELL*3.5)?'warn':'mild';
      const bg=threat==='crit'?'rgba(239,68,68,0.7)':threat==='warn'?'rgba(255,179,71,0.7)':threat==='mild'?'rgba(255,246,100,0.5)':'rgba(255,255,255,0.55)';
      const fg=threat==='crit'?'#fff':threat==='warn'?'#5e2a00':'rgba(30,70,20,0.92)';
      ctx.fillStyle=bg;
      roundRect(CELL*0.32,ly-16,76,32,14); ctx.fill();
      ctx.fillStyle=fg; ctx.font='800 22px Fredoka, sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('ROW '+(r+1),CELL*0.32+38,ly+1);
    }

    // ── Grass texture ──
    for(const d of DECOR){
      ctx.fillStyle=d.d?`rgba(30,70,20,${d.a*1.5})`:`rgba(255,255,255,${d.a*1.2})`;
      ctx.beginPath();ctx.ellipse(d.x,d.y,d.w,d.w*0.35,0,0,Math.PI*2);ctx.fill();
    }

    // ── Flowers ──
    for(const f of (window.__gdFlowers||[])){
      ctx.fillStyle=f.c;
      ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();
    }

    // ── Right hedge (pest entrance) ──
    ctx.fillStyle='rgba(255,255,255,0.35)';
    roundRect(BW-78,10,62,BH-20,22); ctx.fill();
    ctx.fillStyle='rgba(88,62,31,0.3)';
    roundRect(BW-60,18,40,BH-36,14); ctx.fill();
    const hgr=ctx.createLinearGradient(BW-90,0,BW,0);
    hgr.addColorStop(0,'rgba(30,60,20,0)'); hgr.addColorStop(0.3,'rgba(30,60,20,0.35)');
    hgr.addColorStop(1,'rgba(15,35,12,0.9)');
    ctx.fillStyle=hgr; ctx.fillRect(BW-90,0,90,BH);
    ctx.fillStyle='rgba(50,100,35,0.25)';
    for(let y=8;y<BH;y+=20){ ctx.beginPath(); ctx.arc(BW-16,y+Math.sin(y)*3,10,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(BW-42,y+12+Math.cos(y)*3,8,0,Math.PI*2); ctx.fill(); }

    // ── Grid lines: visible dashed ──
    ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=2; ctx.setLineDash([12,8]);
    for(let c=1;c<COLS;c++){ctx.beginPath();ctx.moveTo(c*CELL,0);ctx.lineTo(c*CELL,BH);ctx.stroke();}
    ctx.setLineDash([]);
    ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=2;
    for(let r=1;r<ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*CH);ctx.lineTo(BW,r*CH);ctx.stroke();}

    // ── Danger pulse: wider, brighter ──
    for(let r=0;r<ROWS;r++){
      if(pests.some(z=>z.row===r && z.x<CELL*2)){
        const a=0.2+0.12*Math.sin(nowMs/100);
        const dg=ctx.createLinearGradient(0,0,CELL*2,0);
        dg.addColorStop(0,`rgba(220,40,40,${a})`); dg.addColorStop(1,'rgba(220,40,40,0)');
        ctx.fillStyle=dg; ctx.fillRect(0,r*CH,CELL*2,CH);
      }
    }

    // ── Hover highlight: brighter ──
    if(hoverCell && running && !paused){
      ctx.fillStyle='rgba(255,255,255,0.28)';
      roundRect(hoverCell.col*CELL+6, hoverCell.row*CH+6, CELL-12, CH-12, 16); ctx.fill();
      ctx.strokeStyle='rgba(255,246,100,0.85)'; ctx.lineWidth=5; roundRect(hoverCell.col*CELL+8, hoverCell.row*CH+8, CELL-16, CH-16, 16); ctx.stroke();
    }

    ctx.textAlign='center'; ctx.textBaseline='middle';

    // ── Keyboard cursor (#22) ──
    if(kbCursor.active && running && !paused){
      ctx.strokeStyle='rgba(255,255,100,0.9)'; ctx.lineWidth=4; ctx.setLineDash([8,4]);
      roundRect(kbCursor.col*CELL+3,kbCursor.row*CH+3,CELL-6,CH-6,12); ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Placement ghost + #15 range preview ──
    if(hoverCell && selected && selected!=='shovel' && running && !paused){
      const {col,row}=hoverCell;
      const ok=!grid[row][col] && sun>=PLANTS[selected].cost && cooldowns[selected]<=0 && isPlantUnlocked(selected);
      ctx.fillStyle=ok?'rgba(100,200,60,0.4)':'rgba(220,50,50,0.35)';
      roundRect(col*CELL+4,row*CH+4,CELL-8,CH-8,10); ctx.fill();
      ctx.globalAlpha=0.6;
      ctx.font='80px serif'; ctx.fillText(PLANTS[selected].ic,col*CELL+CELL/2,row*CH+CH/2+4);
      ctx.globalAlpha=1;
      // #15 range preview
      if(ok && PLANTS[selected].fire){
        ctx.fillStyle='rgba(255,255,100,0.12)';
        ctx.fillRect(col*CELL+CELL,row*CH,BW-col*CELL-CELL,CH);
        ctx.strokeStyle='rgba(255,246,100,0.3)'; ctx.lineWidth=2; ctx.setLineDash([6,4]);
        ctx.beginPath();ctx.moveTo(col*CELL+CELL,row*CH);ctx.lineTo(BW,row*CH);ctx.moveTo(col*CELL+CELL,row*CH+CH);ctx.lineTo(BW,row*CH+CH);ctx.stroke();
        ctx.setLineDash([]);
      }
      if(ok && PLANTS[selected].aura){
        ctx.fillStyle='rgba(100,200,100,0.15)';
        for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
          const ar=row+dr,ac=col+dc;
          if(ar>=0&&ar<ROWS&&ac>=0&&ac<COLS) ctx.fillRect(ac*CELL,ar*CH,CELL,CH);
        }
      }
    } else if(hoverCell && selected==='shovel' && running && !paused){
      const {col,row}=hoverCell;
      ctx.fillStyle='rgba(140,90,50,0.35)';
      roundRect(col*CELL+4,row*CH+4,CELL-8,CH-8,10); ctx.fill();
      if(grid[row][col]){
        const refund=Math.floor(PLANTS[grid[row][col].type].cost*0.25);
        ctx.font='600 18px Fredoka, sans-serif'; ctx.fillStyle='#fff';
        ctx.fillText('+'+refund+' ☀️',col*CELL+CELL/2,row*CH+CH-18);
      }
    }

    // ── Guards (Lumo fireflies): brighter glow ──
    for(let r=0;r<ROWS;r++){
      if(guards[r]){
        const gy=r*CH+CH*0.5+Math.sin(nowMs/450+r)*5;
        const glow=ctx.createRadialGradient(CELL*0.14,gy,4,CELL*0.14,gy,50);
        glow.addColorStop(0,'rgba(255,240,120,0.7)'); glow.addColorStop(0.4,'rgba(255,240,120,0.3)');
        glow.addColorStop(1,'rgba(255,240,120,0)');
        ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(CELL*0.14,gy,50,0,Math.PI*2); ctx.fill();
        const pa=0.5+0.3*Math.sin(nowMs/250);
        ctx.fillStyle=`rgba(255,240,120,${pa})`;
        ctx.beginPath(); ctx.arc(CELL*0.14,gy,18,0,Math.PI*2); ctx.fill();
        ctx.font='48px serif';
        ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=8; ctx.lineJoin='round';
        ctx.strokeText('🐛', CELL*0.14, gy);
        ctx.fillText('🐛', CELL*0.14, gy);
      }
    }

    // ── Plants: solid bg disc, bigger emoji, thicker outlines ──
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const pl=grid[r][c]; if(!pl) continue;
      const d=PLANTS[pl.type];
      const x=c*CELL+CELL/2, y=r*CH+CH/2;
      const sway=Math.sin(nowMs/600+pl.sway)*0.04;
      const sc=1+(pl.pop>0?pl.pop*0.2:0)+(d.produce&&pl.prodT<1?0.08*Math.sin(nowMs/90):0);
      const rx=pl.recoil>0?-pl.recoil*10:0;

      // Soil mound
      const mound=ctx.createRadialGradient(x,y+26,6,x,y+26,58);
      mound.addColorStop(0,'rgba(90,55,25,0.4)'); mound.addColorStop(0.5,'rgba(100,70,35,0.2)'); mound.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=mound; ctx.beginPath(); ctx.ellipse(x,y+28,52,20,0,0,Math.PI*2); ctx.fill();

      // Plant bg disc for contrast
      ctx.fillStyle='rgba(255,255,240,0.55)';
      ctx.beginPath(); ctx.arc(x,y,CELL*0.3,0,Math.PI*2); ctx.fill();

      // Plant-type glow (stronger)
      if(d.produce){
        const sg=ctx.createRadialGradient(x,y,6,x,y,55);
        sg.addColorStop(0,'rgba(255,207,63,0.35)'); sg.addColorStop(1,'rgba(255,207,63,0)');
        ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(x,y,55,0,Math.PI*2); ctx.fill();
      }
      if(d.pierce){
        const g=ctx.createRadialGradient(x,y,6,x,y,55);
        g.addColorStop(0,'rgba(140,255,230,0.45)'); g.addColorStop(1,'rgba(140,255,230,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,55,0,Math.PI*2); ctx.fill();
      }
      if(d.slow){
        const fg=ctx.createRadialGradient(x,y,6,x,y,48);
        fg.addColorStop(0,'rgba(160,210,255,0.35)'); fg.addColorStop(1,'rgba(160,210,255,0)');
        ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(x,y,48,0,Math.PI*2); ctx.fill();
      }
      if(d.aura){
        const tg=ctx.createRadialGradient(x,y,10,x,y,CELL*1.1);
        tg.addColorStop(0,'rgba(76,175,80,0.25)'); tg.addColorStop(0.6,'rgba(76,175,80,0.08)'); tg.addColorStop(1,'rgba(76,175,80,0)');
        ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(x,y,CELL*1.1,0,Math.PI*2); ctx.fill();
      }

      ctx.save(); ctx.translate(x+rx,y); ctx.rotate(sway); ctx.scale(sc,sc);
      ctx.font='80px serif';
      ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=9; ctx.lineJoin='round'; ctx.strokeText(d.ic,0,4);
      ctx.fillText(d.ic,0,4);
      ctx.restore();

      // HP bar: taller, outlined
      if(pl.hp<pl.maxHp){
        const bx=x-CELL*0.34, by=y+CH*0.32, bw=CELL*0.68, bh=12;
        ctx.fillStyle='rgba(0,0,0,0.5)';
        roundRect(bx,by,bw,bh,6); ctx.fill();
        const pct=Math.max(0,pl.hp/pl.maxHp);
        const hc=pct>0.5?'#5ee04a':pct>0.25?'#eed83a':'#ef4444';
        ctx.fillStyle=hc;
        roundRect(bx,by,bw*pct,bh,6); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=1.5;
        roundRect(bx,by,bw,bh,6); ctx.stroke();
      }
    }

    // ── Suns: bigger, brighter ──
    for(const s of suns){
      const wob=Math.sin(nowMs/200+s.x)*3;
      const fade=s.life<1.5?Math.max(0.3,s.life/1.5):1;
      const g=ctx.createRadialGradient(s.x,s.y+wob,6,s.x,s.y+wob,52);
      g.addColorStop(0,`rgba(255,226,100,${0.65*fade})`); g.addColorStop(0.4,`rgba(255,226,100,${0.2*fade})`);
      g.addColorStop(1,'rgba(255,226,100,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s.x,s.y+wob,52,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(255,255,180,${0.4*fade})`; ctx.lineWidth=2;
      const sr=20+4*Math.sin(nowMs/140+s.x);
      ctx.beginPath(); ctx.arc(s.x,s.y+wob,sr,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=fade;
      ctx.font='60px serif'; ctx.fillText('☀️',s.x,s.y+wob);
      ctx.globalAlpha=1;
    }

    // ── Shots: thicker trails, bigger glow ──
    for(const s of shots){
      const col=s.pierce?'#9ff5e2':(s.slow?'#bfe8ff':'#b8e986');
      const core=s.pierce?'#e8fffa':(s.slow?'#eaf7ff':'#e4ffc7');
      const tg=ctx.createLinearGradient(s.x-80,s.y,s.x,s.y);
      tg.addColorStop(0,'rgba(255,255,255,0)'); tg.addColorStop(0.4,col+'88'); tg.addColorStop(1,col+'dd');
      ctx.strokeStyle=tg; ctx.lineWidth=s.pierce?12:8; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(s.x-80,s.y); ctx.lineTo(s.x-6,s.y); ctx.stroke();
      const g=ctx.createRadialGradient(s.x,s.y,2,s.x,s.y,s.pierce?22:16);
      g.addColorStop(0,core); g.addColorStop(0.4,col); g.addColorStop(1,col+'00');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s.x,s.y,s.pierce?22:16,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.pierce?4:3,0,Math.PI*2); ctx.fill();
    }

    // ── Pests: bigger plates, thicker outlines, larger HP bars ──
    let boss=null;
    for(const z of pests){
      if(z.boss) boss=z;
      const y=z.row*CH+CH/2 + Math.sin(nowMs/160+z.wob)*4;
      const big=z.boss?1.5:1;
      const chewSq=z.chew?1+0.12*Math.sin(nowMs/70):1;
      // Shadow
      ctx.fillStyle='rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(z.x,y+26*big,20*big,7*big,0,0,Math.PI*2); ctx.fill();
      // Target plate: solid, high contrast
      ctx.save();
      ctx.fillStyle=z.boss?'#3a1548':'#fff5cc';
      ctx.strokeStyle=z.boss?'#e880ff':'#cc3333';
      ctx.lineWidth=z.boss?7:5;
      ctx.beginPath(); ctx.arc(z.x,y,44*big,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();
      // Pest body
      ctx.save(); ctx.translate(z.x,y); ctx.scale(-big*chewSq,big*(2-chewSq));
      ctx.font='82px serif'; ctx.lineWidth=7; ctx.strokeStyle='rgba(30,20,10,.95)';
      ctx.strokeText(z.ic,0,4); ctx.fillText(z.ic,0,4);
      ctx.restore();
      // Hit flash
      if(z.hitT>0){
        ctx.strokeStyle=`rgba(255,255,255,${z.hitT/0.15})`;
        ctx.lineWidth=6; ctx.beginPath(); ctx.arc(z.x,y,44*big,0,Math.PI*2); ctx.stroke();
      }
      // HP bar with numbers (#13)
      if(z.hp<z.maxHp && !z.boss){
        const bx=z.x-CELL*0.32, by=y-CH*0.36, bw=CELL*0.64, bh=18;
        ctx.fillStyle='rgba(20,15,10,0.8)';
        roundRect(bx,by,bw,bh,6); ctx.fill();
        const pct=Math.max(0,z.hp/z.maxHp);
        const hc=z.slowT>0?'#48a9e8':'#ef4444';
        ctx.fillStyle=hc;
        roundRect(bx,by,bw*pct,bh,6); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2;
        roundRect(bx,by,bw,bh,6); ctx.stroke();
        ctx.fillStyle='#fff'; ctx.font='700 12px Fredoka, sans-serif';
        ctx.fillText(Math.ceil(z.hp),z.x,by+bh/2+1);
      }
      // #3 shield bar for shield bugs
      if(z.shieldHp>0 && z.maxShield){
        const sx=z.x-CELL*0.28, sy=y-CH*0.44, sw=CELL*0.56, sh=8;
        ctx.fillStyle='rgba(30,136,229,0.6)';
        roundRect(sx,sy,sw*(z.shieldHp/z.maxShield),sh,4); ctx.fill();
        ctx.strokeStyle='rgba(100,180,255,.8)'; ctx.lineWidth=1.5;
        roundRect(sx,sy,sw,sh,4); ctx.stroke();
      }
    }

    // ── Death poofs ──
    for(const d of deaths){
      ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.globalAlpha=Math.max(0,d.t/0.45);
      ctx.font='58px serif';ctx.fillText(d.ic,0,0);ctx.restore();
    }
    ctx.globalAlpha=1;

    // ── Boss health banner: taller ──
    if(boss){
      const w=BW*0.55, x=(BW-w)/2, y=20;
      ctx.fillStyle='rgba(0,0,0,0.65)'; roundRect(x-18,y-16,w+36,42,18); ctx.fill();
      bar(x,y,w,16,boss.hp/boss.maxHp,'#c95cff');
      ctx.fillStyle='#fff';ctx.font='700 24px Fredoka, sans-serif';
      ctx.fillText('🕷️ Boss',x+w/2,y+26);
    }

    // ── Next-wave countdown: bigger ──
    if(running && !paused && spawnQ.length===0 && pests.length===0 && betweenTimer<4.4){
      ctx.fillStyle='rgba(0,0,0,0.55)'; roundRect(BW/2-180,BH/2-44,360,88,22); ctx.fill();
      ctx.fillStyle='#fff';ctx.font='700 40px Fredoka, sans-serif';
      ctx.fillText('Next wave in '+Math.ceil(betweenTimer)+'…',BW/2,BH/2+2);
    }

    // ── Floating texts: thicker outlines ──
    for(const f of floats){
      const a=Math.min(1,f.t/0.9*1.4);
      ctx.globalAlpha=a;
      ctx.font='900 '+(f.size+4)+'px Fredoka, sans-serif';
      ctx.strokeStyle='rgba(0,0,0,0.7)';ctx.lineWidth=7;ctx.lineJoin='round';ctx.strokeText(f.txt,f.x,f.y);
      ctx.fillStyle=f.col;ctx.fillText(f.txt,f.x,f.y);
      ctx.globalAlpha=1;
    }

    // ── Vignette ──
    const vg=ctx.createRadialGradient(BW/2,BH/2,BW*0.3,BW/2,BH/2,BW*0.75);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.15)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,BW,BH);

    // ── Drought overlay (#5) ──
    if(droughtActive){
      ctx.fillStyle='rgba(80,60,30,0.12)'; ctx.fillRect(0,0,BW,BH);
      ctx.fillStyle='rgba(255,200,50,0.6)'; ctx.font='700 20px Fredoka, sans-serif';
      ctx.fillText('☁️ Sun Drought',BW-120,40);
    }

    // ── Undo hint (#19) ──
    if(undoTimer>0 && lastPlaced){
      ctx.fillStyle='rgba(0,0,0,0.5)'; roundRect(BW/2-90,BH-50,180,36,12); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='600 18px Fredoka, sans-serif';
      ctx.fillText('Press Z to undo ('+Math.ceil(undoTimer)+'s)',BW/2,BH-32);
    }

    // ── Paused veil ──
    if(paused && !upgradeOpen && !victoryShown){
      ctx.fillStyle='rgba(8,30,18,0.7)';ctx.fillRect(0,0,BW,BH);
      ctx.fillStyle='#fff';ctx.font='700 72px Fredoka, sans-serif';
      ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=6;ctx.strokeText('⏸ Paused',BW/2,BH/2-20);
      ctx.fillText('⏸ Paused',BW/2,BH/2-20);
      ctx.font='600 30px Fredoka, sans-serif';
      ctx.fillText('Tap ⏸ or press Space',BW/2,BH/2+44);
    }
  }
  // #16 cooldown arc on picker buttons
  function drawCooldownArcs(){
    for(const k in PLANTS){
      const el=pickerEls[k]; if(!el) continue;
      const arc=el.querySelector('.cd-arc'); if(!arc) continue;
      const pct=cooldowns[k]>0?cooldowns[k]/(PLANTS[k].cd/((upgrades.quick||0)*.15+1)):0;
      if(pct<=0){arc.style.opacity='0';continue;}
      arc.style.opacity='1';
      const ac=arc.getContext('2d'); ac.clearRect(0,0,68,68);
      ac.beginPath(); ac.moveTo(34,34); ac.arc(34,34,30,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);
      ac.closePath(); ac.fillStyle='rgba(0,0,0,0.45)'; ac.fill();
      ac.beginPath(); ac.arc(34,34,30,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);
      ac.strokeStyle='rgba(255,246,100,0.8)'; ac.lineWidth=3; ac.stroke();
    }
  }
  function bar(x,y,w,h,pct,col){
    ctx.fillStyle='rgba(0,0,0,0.25)'; roundRect(x,y,w,h,4); ctx.fill();
    ctx.fillStyle=col; roundRect(x,y,w*Math.max(0,pct),h,4); ctx.fill();
  }
  function roundRect(x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }

  // ---- fx / hud helpers ----
  function fxBurst(cx,cy,emoji,n){
    const r=canvas.getBoundingClientRect();
    const px=r.left+cx/BW*r.width, py=r.top+cy/BH*r.height;
    ParticleSystem.burst(px,py,emoji,n);
  }
  function beep(t){
    if(!soundOn) return;
    if(t==='tap')audio.playTap(700);
    else if(t==='success')audio.playSuccess(900);
    else if(t==='pop')audio.playPop();
    else if(t==='shot')audio.playTap(1200);
    else if(t==='zap')audio.playTap(1600);
    else if(t==='level')audio.playLevelUp();
    else if(t==='wave')audio.playCombo(2);
    else if(t==='err')audio.playError();
  }
  let hintTimer=null;
  function flashHint(msg){
    const h=document.getElementById('hint'); h.textContent=msg;
    clearTimeout(hintTimer);
    hintTimer=setTimeout(()=>{h.textContent='Pick a plant, then tap a tile. Tap ☀️ to collect sun.';},2200);
  }
  function gdAnnounce(txt){
    const el=document.getElementById('gdLive');
    if(el) el.textContent=txt;
  }
  function banner(txt){
    const b=document.getElementById('banner'), t=document.getElementById('bannerTxt');
    t.textContent=txt; b.style.display='block';
    t.style.animation='none'; void t.offsetWidth; t.style.animation='';
    setTimeout(()=>{b.style.display='none';},1700);
    gdAnnounce(txt);
  }
  function updateHUD(){
    document.getElementById('sunV').textContent=Math.floor(sun);
    document.getElementById('guardsV').textContent=guards.filter(Boolean).length;
    if(!running){
      document.getElementById('waveLbl').textContent=guards.every(Boolean)?'Garden saved':'Garden overrun';
      document.getElementById('waveFill').style.width='100%';
    } else {
      document.getElementById('waveLbl').textContent='Wave '+Math.max(1,Math.min(waveIdx,5))+' / 5';
      document.getElementById('waveFill').style.width=(Math.max(1,Math.min(waveIdx,5))/5*100)+'%';
    }
    refreshPickerAfford();
    if(window.__storyRun) window.__storyRun.setScore(score);
  }
  function refreshPickerAfford(){
    for(const k in PLANTS){
      const el=pickerEls[k]; if(!el) continue;
      el.classList.toggle('cant', sun<PLANTS[k].cost);
    }
  }
  function updatePickerCD(){
    for(const k in PLANTS){
      const el=pickerEls[k]; if(!el) continue;
      const cd=el.querySelector('.cd');
      if(cooldowns[k]>0){ cd.style.display='flex'; cd.textContent=Math.ceil(cooldowns[k]); }
      else cd.style.display='none';
    }
    drawCooldownArcs();
  }
  function showUpgrade(){
    upgradeOpen=true; paused=true;
    const gridEl=document.getElementById('upgradeGrid');
    upgradeChoices=[...UPGRADES].sort(()=>Math.random()-.5).slice(0,3);
    gridEl.innerHTML='';
    upgradeChoices.forEach((u,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='upgrade-choice';
      b.innerHTML=`<span class="upgrade-icon">${u.icon}</span><strong>${u.title}</strong><span>${u.desc}</span>`;
      b.onclick=()=>chooseUpgrade(i); gridEl.appendChild(b);
    });
    document.getElementById('upgradeScreen').classList.remove('hidden');
    gdAnnounce('Choose a garden upgrade before wave '+(waveIdx+1)+'.');
  }
  function chooseUpgrade(index){
    const u=upgradeChoices[index]; if(!u) return;
    u.apply(); upgradeOpen=false; paused=false; betweenTimer=1.2; lastT=performance.now();
    document.getElementById('upgradeScreen').classList.add('hidden');
    flashHint(u.title+' chosen! '+u.desc);
    updateHUD();
  }
  function togglePause(){
    if(!running || upgradeOpen) return;
    paused=!paused;
    document.getElementById('pauseBtn').textContent=paused?'▶':'⏸';
    document.getElementById('pauseBtn').setAttribute('aria-label',paused?'Resume game':'Pause game');
    if(!paused) lastT=performance.now();
  }

  // ---- end states ----
  function win(){ finish(true); }
  function lose(){ finish(false); }
  function finish(won){
    running=false;
    beep(won?'level':'err');
    window.__gsBestRun=Math.max(window.__gsBestRun||0, score);

    // #9 star rating
    if(won){
      const gl=guards.filter(Boolean).length;
      starRating=gl===5?3:gl>=3?2:1;
    } else starRating=0;

    // update unlock state
    const reachedWave=endless?waveIdx:won?5:Math.min(waveIdx,5);
    if(reachedWave>unlockState.maxWave){unlockState.maxWave=reachedWave;saveUnlocks(unlockState);}
    if(won){unlockState.wins++;saveUnlocks(unlockState);}

    // achievements
    if(won && !achUnlocked.includes('gd_victory')){achUnlocked.push('gd_victory');gs.unlockAchievement('gd_victory');}
    if(won && guards.every(Boolean) && !achUnlocked.includes('gd_flawless')){achUnlocked.push('gd_flawless');gs.unlockAchievement('gd_flawless');}
    if(waveIdx>=5 && !achUnlocked.includes('gd_wave5')){achUnlocked.push('gd_wave5');gs.unlockAchievement('gd_wave5');}
    if(endless && waveIdx>=10 && !achUnlocked.includes('gd_endless10')){achUnlocked.push('gd_endless10');gs.unlockAchievement('gd_endless10');}
    try{ gs.recordGamePlay(Date.now()); gs.saveState(); }catch(e){}
    const newBest = score>best.score;
    if(score>best.score||reachedWave>best.wave){
      best={score:Math.max(best.score,score),wave:Math.max(best.wave,reachedWave)};
      saveBest(best); showBestLine();
    }

    document.getElementById('endEmoji').textContent = won?'🏆':'🐛';
    const starStr=starRating>0?(' '+'⭐'.repeat(starRating)):'';
    const endTitleTxt = won?(endless?'Endless Run Over!':'Garden Saved!'+starStr):'Garden Overrun!';
    document.getElementById('endTitle').textContent = endTitleTxt;
    document.getElementById('endMsg').textContent = won
      ? (endless?`You survived ${waveIdx} waves in Endless mode!${newBest?' New best! 🎉':''}`:`You held all five waves with ${guards.filter(Boolean).length} guard(s) to spare.${starRating===3?' Perfect run!':''} The garden is safe!${newBest?' New best score! 🎉':''}`)
      : `The pests broke through on wave ${Math.min(waveIdx,99)}. Replant and try again!${newBest?' New best score! 🎉':''}`;
    gdAnnounce(endTitleTxt+', final score '+score+'.');
    const challengeBonus=(waveGoals&&waveGoals.guard?150:0)+(waveGoals&&waveGoals.economy?150:0)+(waveGoals&&waveGoals.streak?200:0);
    if(challengeBonus){score+=challengeBonus; window.__gsScore=(window.__gsScore||0)+challengeBonus;}
    if(window.__storyRun) window.__storyRun.finish(won?'success':'fail', score);
    // #10 seed display
    const seedStr=gameSeed?' | Seed: '+gameSeed:'';
    document.getElementById('endStats').innerHTML=
      `<div class="sbox"><div class="v">${score}</div><div class="l">Score</div></div>`+
      `<div class="sbox"><div class="v">${reachedWave}</div><div class="l">Wave</div></div>`+
      `<div class="sbox"><div class="v">${stats.killed}</div><div class="l">Pests</div></div>`+
      `<div class="sbox"><div class="v">${stats.placed}</div><div class="l">Planted</div></div>`+
      `<div class="sbox"><div class="v">${stats.bestStreak}</div><div class="l">Best Streak</div></div>`+
      `<div class="sbox"><div class="v">${stats.bestBoom}</div><div class="l">Best Boom</div></div>`+
      `<div class="sbox"><div class="v">${challengeBonus}</div><div class="l">Challenge Bonus</div></div>`+
      (starRating>0?`<div class="sbox"><div class="v">${'⭐'.repeat(starRating)}</div><div class="l">Stars</div></div>`:'')+
      (seedStr?`<div class="sbox"><div class="v" style="font-size:.8rem">${gameSeed}</div><div class="l">Seed</div></div>`:'');

    // Shared engine juice: score counts up, depth medal stamps (one short run).
    GameUI.countUp(document.querySelector('#endStats .sbox .v'), score);
    const medalWave = reachedWave;
    GameUI.showMedal(document.getElementById('endStats'), medalWave,
      [[3,'\uD83E\uDD49','Sprout Guardian'],[6,'\uD83E\uDD48','Bloom Warden'],[10,'\uD83C\uDFC6','Garden Legend']]);
    const names={gd_firstBloom:'🌱 First Bloom',gd_wave5:'🌿 Wave 5',gd_victory:'🏆 Garden Saved',gd_flawless:'💎 Flawless',gd_boomKing:'💥 Boom King',gd_streak5:'🔥 Streak ×5',};
    document.getElementById('endAchs').innerHTML=achUnlocked.map(a=>`<span class="a">${names[a]||a}</span>`).join('');
        if(won) ParticleSystem.confetti(window.innerWidth/2, window.innerHeight/2, 24);
    document.getElementById('endScreen').classList.remove('hidden');
  }

  // ---- #21 tutorial ----
  function showTutorial(){
    tutorialOverlay=true; paused=true;
    const el=document.getElementById('tutorialOverlay');
    if(!el) return;
    el.classList.remove('hidden');
    el.innerHTML=`<div class="panel" style="max-width:420px">
      <div class="big">🌱</div>
      <h2>How to Play</h2>
      <p><b>1.</b> Pick a plant from the tray (or press 1-7).</p>
      <p><b>2.</b> Tap a tile to place it. Sunflowers make ☀️ sun.</p>
      <p><b>3.</b> Tap falling ☀️ to collect (or enable auto-collect).</p>
      <p><b>4.</b> Shooters fire automatically at pests in their row.</p>
      <p><b>5.</b> Use arrow keys + Enter for keyboard play.</p>
      <p><b>6.</b> Press Z to undo a plant within 2 seconds.</p>
      <p style="margin-top:8px;font-size:.8rem;color:#666">Tip: Frost Bud slows pests - Sprout shots deal 50% more to slowed targets!</p>
      <button class="btn" id="tutCloseBtn">Got it!</button>
    </div>`;
    document.getElementById('tutCloseBtn').onclick=()=>{
      el.classList.add('hidden'); tutorialOverlay=false; paused=false; lastT=performance.now();
      tutorialShown=true; localStorage.setItem('gd_tutDone','true');
    };
  }

  // ---- #18 wave preview popup ----
  function showWavePreview(){
    const next=endless?waveIdx+1:Math.min(waveIdx+1,5);
    if(next>5&&!endless) return;
    const preview=buildWave(next);
    const counts={};
    preview.forEach(e=>{const n=PESTS[e.type]?.ic||e.type;counts[n]=(counts[n]||0)+1;});
    const txt=Object.entries(counts).map(([ic,c])=>ic+' x'+c).join('  ');
    flashHint('Next wave: '+txt);
  }

  // ---- #12 daily challenge ----
  function getDailySeed(){
    const d=new Date();
    return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
  }

  // ---- boot ----
  function begin(opts){
    opts=opts||{};
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('endScreen').classList.add('hidden');
    reset();
    // #10 seed / #12 daily
    if(opts.daily){
      dailyMode=true; gameSeed=getDailySeed();
      waveRng=seededRng(gameSeed);
      flashHint('Daily Challenge! Seed: '+gameSeed);
    } else if(opts.seed){
      gameSeed=opts.seed; waveRng=seededRng(gameSeed);
      flashHint('Challenge Seed: '+gameSeed);
    } else {
      gameSeed=Math.floor(Math.random()*99999)+1;
      waveRng=seededRng(gameSeed);
      dailyMode=false;
    }
    if(window.__storyRun && !window.__storyRun.running) window.__storyRun.begin();
    betweenTimer=5;
    const m=location.hash.match(/^#w(\d+)$/);
    const seedMatch=location.hash.match(/^#seed(\d+)$/);
    window.__gdFastCd=!!m;
    if(m){ waveIdx=Math.max(0,parseInt(m[1])-1); sun=2000; updateHUD(); }
    if(seedMatch){ gameSeed=parseInt(seedMatch[1]); waveRng=seededRng(gameSeed); }
    requestAnimationFrame((t)=>{lastT=t;loop(t);});
  }
  document.getElementById('startBtn').onclick=()=>{ if(audio.audioContext&&audio.audioContext.state==='suspended')audio.audioContext.resume(); begin(); };
  document.getElementById('againBtn').onclick=()=>begin();
  const dailyBtn=document.getElementById('dailyBtn');
  if(dailyBtn) dailyBtn.onclick=()=>{if(audio.audioContext&&audio.audioContext.state==='suspended')audio.audioContext.resume();begin({daily:true});};
  const seedInput=document.getElementById('seedInput');
  const seedGoBtn=document.getElementById('seedGoBtn');
  if(seedGoBtn&&seedInput) seedGoBtn.onclick=()=>{const s=parseInt(seedInput.value);if(s>0){if(audio.audioContext&&audio.audioContext.state==='suspended')audio.audioContext.resume();begin({seed:s});}};
  document.getElementById('pauseBtn').onclick=togglePause;
  document.getElementById('speedBtn').onclick=function(){ speedMult=speedMult===1?2:1; this.textContent=speedMult+'×'; this.setAttribute('aria-label','Game speed: '+(speedMult===1?'normal':'fast')); beep('tap'); };
  document.getElementById('soundBtn').textContent=soundOn?'🔊':'🔇';
  document.getElementById('soundBtn').setAttribute('aria-label',soundOn?'Sound on':'Sound off');
  document.getElementById('soundBtn').onclick=function(){ soundOn=!soundOn; this.textContent=soundOn?'🔊':'🔇'; this.setAttribute('aria-label',soundOn?'Sound on':'Sound off'); localStorage.setItem('soundEnabled',soundOn?'true':'false'); };
  // #20 auto-collect toggle
  const acBtn=document.getElementById('autoCollectBtn');
  if(acBtn){acBtn.textContent=autoCollect?'Auto ☀️: ON':'Auto ☀️: OFF';acBtn.onclick=function(){autoCollect=!autoCollect;this.textContent=autoCollect?'Auto ☀️: ON':'Auto ☀️: OFF';localStorage.setItem('gd_autoCollect',autoCollect?'true':'false');beep('tap');};}
  // #23 pinch-to-zoom: CSS-based viewport
  let zoomed=false;
  canvas.addEventListener('dblclick',e=>{e.preventDefault();zoomed=!zoomed;canvas.style.transform=zoomed?'scale(1.5)':'';canvas.style.transformOrigin='center';});

  // expose for integration script + lightweight read-only debug snapshot
  window.__gd={
    get score(){return score;},
    get sun(){return sun;},
    get wave(){return waveIdx;},
    get guards(){return guards.filter(Boolean).length;},
    get pests(){return pests.length;},
    get speed(){return speedMult;},
    get paused(){return paused;},
    occupied(row,col){return !!(grid[row]&&grid[row][col]);},
    empties(){const e=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(!grid[r][c])e.push([c,r]);return e;}
  };

  // GameSystem instance (referenced by placePlant etc.)
  window.gs = new GameSystem('garden-defense','Lumo\'s Garden Defense','lumo');

  const storyRun = window.__storyRun = new StoryRun({
    id: 'garden-defense',
    character: 'Lumo',
    title: "Lumo's Garden Defense",
    open: "Lumo's garden is under attack and the sprouts need you at the fence.",
    objective: 'Grow sunflowers and hold five waves of pests without losing a row.',
    cap: 300,
    gameSystem: gs,
    beats: [
      { at: 0, text: 'The first pests creep toward the fence.' },
      { at: 0.4, text: 'The waves thicken and the sunlight runs short.' },
      { at: 0.8, text: 'Last stand: hold every row until dawn.' }
    ],
    result: {
      success: 'Dawn arrives, the garden still glows and Lumo leaves the gate open for another defence.',
      partial: 'The battle ends with the garden holding most rows and Lumo grateful for the help.',
      fail: 'The pests break through, but Lumo saves the seeds and calls you back at first light.'
    },
    onRestart: () => { begin(); }
  });

  // pause when tab hidden
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && running && !paused){ togglePause(); } });

  // build an idle picker on load so the tray is visible behind the start screen
  buildPicker();
  refreshWaveIntel();
})();
