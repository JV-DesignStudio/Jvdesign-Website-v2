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
    sun:   {key:'sun',   ic:'🌻', cost:50,  hp:60,  cd:2,  fire:0,   produce:5, name:'Sunflower'},
    shoot: {key:'shoot', ic:'🌱', cost:75,  hp:70,  cd:2,  fire:1.4, dmg:26,   name:'Sprout'},
    wall:  {key:'wall',  ic:'🌰', cost:50,  hp:340, cd:4,  fire:0,   name:'Acorn Wall'},
    frost: {key:'frost', ic:'❄️', cost:150, hp:70,  cd:6,  fire:1.7, dmg:16, slow:.5, name:'Frost Bud'},
    zap:   {key:'zap',   ic:'✨', cost:125, hp:60,  cd:7,  fire:2.2, dmg:16, pierce:true, name:'Glow Bulb'},
    boom:  {key:'boom',  ic:'🍄', cost:125, hp:1,   cd:12, boom:true, name:'Boom Shroom'}
  };
  // speeds are px/sec on the 1120px-wide logical board (CELL ~= 186px)
  const PESTS={
    cat:  {ic:'🐛', hp:85,  spd:56,  dmg:40, pts:15, sun:0},
    hop:  {ic:'🦗', hp:70,  spd:112, dmg:35, pts:22, sun:0},
    beet: {ic:'🪲', hp:230, spd:46,  dmg:50, pts:30, sun:0},
    snail:{ic:'🐌', hp:480, spd:30,  dmg:60, pts:45, sun:0},
    boss: {ic:'🕷️', hp:2200,spd:40,  dmg:110,pts:300,sun:0,boss:true}
  };
  const PICK_ORDER=['sun','shoot','wall','frost','zap','boom'];

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
    stats={killed:0,placed:0,bestBoom:0,sunCollected:0,bestStreak:0,waveStartGuards:5,waveStartSun:150};
    waveGoals={guard:false,economy:false,streak:false};
    achUnlocked=[]; streak=0; lastKillT=-99; hoverCell=null;
    window.__gdWaveClock=0;
    document.getElementById('pauseBtn').textContent='⏸';
    updateHUD(); buildPicker();
  }

  // ---- wave generation ----
  function buildWave(n){
    const q=[]; let t=0.4;
    const count=Math.round(2+n*1.8);
    const poolN=Math.min(n,10);
    const hpMult = n>10 ? 1+0.12*(n-10) : 1;      // later waves hit harder
    const pool=[];
    pool.push('cat');
    if(poolN>=2) pool.push('cat');
    if(poolN>=3) pool.push('beet');
    if(poolN>=4) pool.push('hop');
    if(poolN>=6) pool.push('beet','snail');
    if(poolN>=8) pool.push('snail','hop');
    const gap=Math.max(0.55, 2.4 - poolN*0.16);
    for(let i=0;i<count;i++){
      const type=pool[Math.floor(Math.random()*pool.length)];
      q.push({t, row:Math.floor(Math.random()*ROWS), type, hpMult});
      t += gap*(0.6+Math.random()*0.8);
    }
    if(n===10){
      // boss finale
      q.push({t:t+0.5, row:2, type:'boss', hpMult:1});
      for(let i=0;i<6;i++) q.push({t:t+1+i*0.8, row:Math.floor(Math.random()*ROWS), type:i%2?'snail':'beet', hpMult:1});
    } else if(n>10 && n%5===0){
      // the wave 5 boss
      q.push({t:t+0.5, row:Math.floor(Math.random()*ROWS), type:'boss', hpMult});
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
    if(waveIdx>5){ win(); return; }
    spawnQ=buildWave(waveIdx);
    window.__gdWaveClock=0;
    if(waveIdx===1) flashHint('First wave: plant Sunflower early, then add a Sprout in the busiest lane.');
    if(waveGoals) waveGoals.guard=guards.filter(Boolean).length>=stats.waveStartGuards;
    if(waveIdx===5) banner('Wave 5 , Boss! 🕷️');
    else banner('Wave '+waveIdx);
    beep('wave');
    if(waveIdx>1){ sun+=40; } // small breather bonus
    if(waveIdx>=15 && !achUnlocked.includes('gd_wave15')){achUnlocked.push('gd_wave15');gs.unlockAchievement('gd_wave15');}
    updateHUD();
  }

  // ---- picker ----
  let cooldowns={};
  function buildPicker(){
    const p=document.getElementById('picker'); p.innerHTML='';
    pickerEls={};
    PICK_ORDER.forEach((k,i)=>{
      const d=PLANTS[k];
      const el=document.createElement('button');
      el.type='button';
      el.setAttribute('aria-label',d.name+' plant, costs '+d.cost+' sun');
      el.setAttribute('aria-pressed','false');
      el.className='seed'; el.dataset.k=k;
      el.innerHTML=`<span class="key">${i+1}</span><div class="ic">${d.ic}</div><div class="cost">☀️${d.cost}</div><div class="cd" style="display:none"></div>`;
      el.onclick=()=>selectPlant(k);
      p.appendChild(el); pickerEls[k]=el;
    });
    const sh=document.createElement('button');
    sh.type='button';
    sh.setAttribute('aria-label','Shovel, remove a plant');
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
      if(grid[row][col]){ grid[row][col]=null; beep('pop'); fxBurst(col*CELL+CELL/2,row*CH+CH/2,'💨',6); }
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

  // keyboard shortcuts
  document.addEventListener('keydown',e=>{
    if(!running) return;
    const i=parseInt(e.key)-1;
    if(i>=0 && i<PICK_ORDER.length){ selectPlant(PICK_ORDER[i]); }
    else if(e.key===' '){ e.preventDefault(); togglePause(); }
    else if(e.key==='d'||e.key==='D'){ selectPlant('shovel'); }
    else if(e.key==='s'||e.key==='S'){ const sb=document.getElementById('speedBtn'); if(sb) sb.click(); }
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
      grid[row][col]={type:k,hp:d.hp,maxHp:d.hp,fireT:d.fire?d.fire*Math.random():0,prodT:d.produce||0,pop:1,recoil:0,sway:Math.random()*6};
      beep('success');
      fxBurst(col*CELL+CELL/2,row*CH+CH/2,'🌱',5);
    }
    if(sun<d.cost || cooldowns[k]>0){ selected=null; for(const id in pickerEls) pickerEls[id].classList.remove('sel'); }
    updateHUD();
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
  function collectSun(s,i,e){
    sun+=s.val; stats.sunCollected+=s.val;
    beep('pop');
    suns.splice(i,1); updateHUD();
    addFloat(s.x,s.y,'+'+s.val,'#8a6a00');
    // fly-to-HUD animation
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

    // sky sun
    skySunTimer-=dt;
    if(skySunTimer<=0){ skySunTimer=6+Math.random()*3; spawnSkySun(); }

    // suns
    for(let i=suns.length-1;i>=0;i--){
      const s=suns[i];
      if(s.from==='sky' && s.y<s.ty){ s.y=Math.min(s.ty,s.y+s.vy*dt); }
      else s.life-=dt;
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
    }

    // shots
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i]; s.x+=s.vx*dt;
      if(s.x>BW+30){ shots.splice(i,1); continue; }
      if(s.pierce){
        for(const z of pests){
          if(z.row===s.row && !s.hit.has(z) && Math.abs(z.x-s.x)<CELL*0.4){
            z.hp-=s.dmg; z.hitT=.15; s.hit.add(z);
          }
        }
      } else {
        let hitZ=null,hd=1e9;
        for(const z of pests){ if(z.row===s.row){ const dx=z.x-s.x; if(dx>-CELL*0.35 && dx<hd){hd=dx;hitZ=z;} } }
        if(hitZ && Math.abs(hitZ.x-s.x)<CELL*0.45){
          hitZ.hp-=s.dmg; hitZ.hitT=.15;
          if(s.slow){ hitZ.slowT=1.6; }
          shots.splice(i,1);
        }
      }
    }

    // pests
    for(let i=pests.length-1;i>=0;i--){
      const z=pests[i];
      if(!z) continue; // array may have shrunk mid-loop (breach row sweep)
      if(z.hp<=0){ killPest(z,i); continue; }
      if(z.slowT>0) z.slowT-=dt;
      if(z.hitT>0) z.hitT-=dt;
      const col=Math.floor(z.x/CELL);
      const blocker = (col>=0&&col<COLS)? grid[z.row][col] : null;
      if(blocker){
        z.chewT=(z.chewT||0)+dt;
        z.chew=true;
        if(z.chewT>=0.6){ z.chewT=0; blocker.hp-=z.dmg; blocker.pop=0.6; if(blocker.hp<=0){ grid[z.row][col]=null; fxBurst(col*CELL+CELL/2,z.row*CH+CH/2,'🍂',5);} }
      } else {
        z.chew=false;
        const sp=z.spd*(z.slowT>0?0.45:1);
        z.x-=sp*dt;
        // breach() sweeps the whole row out of pests[] (including z), so stop
        // iterating this frame , remaining pests update next frame
        if(z.x<CELL*0.15){ breach(z.row); break; }
      }
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
    pests.push({type,row,x:BW+CELL*0.4+Math.random()*40, hp,maxHp:hp,spd:d.spd,dmg:d.dmg,pts:d.pts,ic:d.ic,slowT:0,chewT:0,hitT:0,wob:Math.random()*6,boss:d.boss});
    if(d.boss){ banner('🕷️ Boss incoming!'); ScreenShake.shake(canvas,8,300); }
  }
  function fireShot(r,c,ptype){
    const d=PLANTS[ptype];
    shots.push({row:r,x:c*CELL+CELL*0.75,y:r*CH+CH*0.42,vx:d.pierce?640:520,dmg:d.dmg,slow:!!d.slow,pierce:!!d.pierce,hit:d.pierce?new Set():null});
    beep(d.pierce?'zap':'shot');
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

    // ── Row labels: bigger, solid bg ──
    for(let r=0;r<ROWS;r++){
      const ly=r*CH+CH/2;
      ctx.fillStyle='rgba(255,255,255,0.55)';
      roundRect(CELL*0.32,ly-16,76,32,14); ctx.fill();
      ctx.fillStyle='rgba(30,70,20,0.92)'; ctx.font='800 22px Fredoka, sans-serif';
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

    // ── Placement ghost: stronger ──
    if(hoverCell && selected && selected!=='shovel' && running && !paused){
      const {col,row}=hoverCell;
      const ok=!grid[row][col] && sun>=PLANTS[selected].cost && cooldowns[selected]<=0;
      ctx.fillStyle=ok?'rgba(100,200,60,0.4)':'rgba(220,50,50,0.35)';
      roundRect(col*CELL+4,row*CH+4,CELL-8,CH-8,10); ctx.fill();
      ctx.globalAlpha=0.6;
      ctx.font='80px serif'; ctx.fillText(PLANTS[selected].ic,col*CELL+CELL/2,row*CH+CH/2+4);
      ctx.globalAlpha=1;
    } else if(hoverCell && selected==='shovel' && running && !paused){
      const {col,row}=hoverCell;
      ctx.fillStyle='rgba(140,90,50,0.35)';
      roundRect(col*CELL+4,row*CH+4,CELL-8,CH-8,10); ctx.fill();
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
      // HP bar: bigger
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

    // ── Paused veil ──
    if(paused){
      ctx.fillStyle='rgba(8,30,18,0.7)';ctx.fillRect(0,0,BW,BH);
      ctx.fillStyle='#fff';ctx.font='700 72px Fredoka, sans-serif';
      ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=6;ctx.strokeText('⏸ Paused',BW/2,BH/2-20);
      ctx.fillText('⏸ Paused',BW/2,BH/2-20);
      ctx.font='600 30px Fredoka, sans-serif';
      ctx.fillText('Tap ⏸ or press Space',BW/2,BH/2+44);
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
    // achievements
    if(won && !achUnlocked.includes('gd_victory')){achUnlocked.push('gd_victory');gs.unlockAchievement('gd_victory');}
    if(won && guards.every(Boolean) && !achUnlocked.includes('gd_flawless')){achUnlocked.push('gd_flawless');gs.unlockAchievement('gd_flawless');}
    if(waveIdx>=5 && !achUnlocked.includes('gd_wave5')){achUnlocked.push('gd_wave5');gs.unlockAchievement('gd_wave5');}
    try{ gs.recordGamePlay(Date.now()); gs.saveState(); }catch(e){}

    // best records
    const reachedWave=won?5:Math.min(waveIdx,5);
    const newBest = score>best.score;
    if(score>best.score||reachedWave>best.wave){
      best={score:Math.max(best.score,score),wave:Math.max(best.wave,reachedWave)};
      saveBest(best); showBestLine();
    }

    document.getElementById('endEmoji').textContent = won?'🏆':'🐛';
    const endTitleTxt = won?'Garden Saved!':'Garden Overrun!';
    document.getElementById('endTitle').textContent = endTitleTxt;
    document.getElementById('endMsg').textContent = won
      ? `You held all five waves with ${guards.filter(Boolean).length} guard(s) to spare. The garden is safe!${newBest?' New best score! 🎉':''}`
      : `The pests broke through on wave ${Math.min(waveIdx,10)}. Replant and try again!${newBest?' New best score! 🎉':''}`;
    gdAnnounce(endTitleTxt+', final score '+score+'.');
    const challengeBonus=(waveGoals&&waveGoals.guard?150:0)+(waveGoals&&waveGoals.economy?150:0)+(waveGoals&&waveGoals.streak?200:0);
    if(challengeBonus){score+=challengeBonus; window.__gsScore=(window.__gsScore||0)+challengeBonus;}
    if(window.__storyRun) window.__storyRun.finish(won?'success':'fail', score);
    document.getElementById('endStats').innerHTML=
      `<div class="sbox"><div class="v">${score}</div><div class="l">Score</div></div>`+
      `<div class="sbox"><div class="v">${reachedWave}</div><div class="l">Wave</div></div>`+
      `<div class="sbox"><div class="v">${stats.killed}</div><div class="l">Pests</div></div>`+
      `<div class="sbox"><div class="v">${stats.placed}</div><div class="l">Planted</div></div>`+
      `<div class="sbox"><div class="v">${stats.bestStreak}</div><div class="l">Best Streak</div></div>`+
      `<div class="sbox"><div class="v">${stats.bestBoom}</div><div class="l">Best Boom</div></div>`+
      `<div class="sbox"><div class="v">${challengeBonus}</div><div class="l">Challenge Bonus</div></div>`;

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

  // ---- boot ----
  function begin(){
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('endScreen').classList.add('hidden');
    reset();
    if(window.__storyRun && !window.__storyRun.running) window.__storyRun.begin();
    betweenTimer=5; // setup window before the first wave
    // hidden debug: #w9 style hash starts at a later wave with extra sun + fast placement (for testing)
    const m=location.hash.match(/^#w(\d+)$/);
    window.__gdFastCd=!!m;
    if(m){ waveIdx=Math.max(0,parseInt(m[1])-1); sun=2000; updateHUD(); }
    requestAnimationFrame((t)=>{lastT=t;loop(t);});
  }
  document.getElementById('startBtn').onclick=()=>{ if(audio.audioContext&&audio.audioContext.state==='suspended')audio.audioContext.resume(); begin(); };
  document.getElementById('againBtn').onclick=begin;
  document.getElementById('pauseBtn').onclick=togglePause;
  document.getElementById('speedBtn').onclick=function(){ speedMult=speedMult===1?2:1; this.textContent=speedMult+'×'; this.setAttribute('aria-label','Game speed: '+(speedMult===1?'normal':'fast')); beep('tap'); };
  document.getElementById('soundBtn').textContent=soundOn?'🔊':'🔇';
  document.getElementById('soundBtn').setAttribute('aria-label',soundOn?'Sound on':'Sound off');
  document.getElementById('soundBtn').onclick=function(){ soundOn=!soundOn; this.textContent=soundOn?'🔊':'🔇'; this.setAttribute('aria-label',soundOn?'Sound on':'Sound off'); localStorage.setItem('soundEnabled',soundOn?'true':'false'); };

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
