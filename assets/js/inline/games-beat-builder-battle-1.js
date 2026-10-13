const GID='beat-builder-battle',MK='jvds_bbb_meta';
const GS_SYS=new GameSystem(GID,'Beat Builder Battle','music');
const storyRun = window.__storyRun || (window.__storyRun = new StoryRun({
  id:'beat-builder-battle', gameSystem:GS_SYS,
  title:'Pip and the Tiny Night Show', character:'Pip',
  open:'Pip needs a beat to open the tiny night show and your timing is the only thing that can carry it.',
  objective:'Build an 8-step beat, then hit the falling notes to win the round.',
  beats:[{at:0,text:'Compose your 8-step loop.'},{at:0.35,text:'The rival drops their pattern.'},{at:0.75,text:'Final bars, keep the combo alive.'}],
  cap:300,
  result:{
    success:'The crowd shouts your name and the next venue opens.',
    partial:'The set lands, one note slips, and the show still goes on.',
    fail:'The night show waits, but Pip saves the beat for another try.'
  },
  onRestart:function(){ startBattle(); }
}));
const LANES=[
  {n:'Kick',  k:'a',c:'#ff6b9d',f:80, t:'sine'},
  {n:'Snare', k:'s',c:'#fbbf24',f:220,t:'square'},
  {n:'Hi-hat',k:'d',c:'#34d399',f:440,t:'sawtooth'},
  {n:'Synth', k:'f',c:'#60a5fa',f:660,t:'triangle'},
];
const RIVALS=[
  {n:'Static Kid',hp:55,hit:5,bpm:115,venue:'Garage Set',unlock:'syncopate',desc:'Simple 4-on-the-floor. Good warmup.'},
  {n:'Glitch Wave',hp:85,hit:9,bpm:130,venue:'Rooftop Jam',unlock:'finale',desc:'Faster tempo. Off-beat surprises.'},
  {n:'Neon Echo',hp:120,hit:13,bpm:148,venue:'Neon Club',unlock:null,desc:'Dense doubles. Keep your combo up.'},
  {n:'Void Pulse',hp:165,hit:18,bpm:165,venue:'Void Stage',unlock:null,desc:'Maximum speed. No room for misses.'}
];
const RIVAL_PATS=[
  [[0,0],[2,2],[0,4],[2,6],[1,3],[3,5]],
  [[0,0],[1,1],[2,2],[3,3],[0,4],[1,5],[2,6],[3,7]],
  [[0,0],[0,2],[1,1],[1,3],[2,0],[2,4],[3,2],[3,6],[1,7],[3,5]],
  [[0,0],[1,0],[2,1],[3,1],[0,2],[1,3],[2,3],[3,2],[0,4],[1,5],[2,4],[3,5],[0,6],[2,6],[1,7],[3,7]],
];
const GOAL_DEFS=[
  ['perf10','Land 10 Perfect hits in one battle',m=>m.perfects>=10],
  ['combo20','Reach a 20× combo',               m=>m.maxCombo>=20],
  ['win1',  'Beat your first rival',             m=>m.beaten>=1],
  ['winall','Defeat all 4 rivals',               m=>m.beaten>=4],
  ['alllanes','Compose notes in all 4 lanes',    m=>m.allLanes],
];
const CW=540,CH=480,LW=CW/4,HIT_Y=CH-90,HIT_WIN=52,PERF_WIN=20;

let meta=readMeta(),beat=presetBeat('starter'),gs=null,animId=null,audioCtx=null;
let prevInt=null,prevBeat=0;

function emptyBeat(){return Array.from({length:4},()=>Array(8).fill(false))}
function presetBeat(name){const b=emptyBeat(),sets={starter:[[0,0],[0,4],[1,2],[1,6],[2,1],[2,3],[2,5],[2,7],[3,6]],dance:[[0,0],[0,2],[0,4],[0,6],[1,2],[1,6],[2,1],[2,3],[2,5],[2,7],[3,0],[3,4]],boss:[[0,0],[1,0],[2,1],[3,2],[0,3],[1,4],[2,4],[3,5],[0,6],[1,7],[2,7]],syncopate:[[0,0],[2,1],[1,2],[3,3],[0,4],[2,5],[1,6],[3,7],[2,7]],finale:[[0,0],[1,0],[2,1],[3,1],[0,2],[1,3],[2,4],[3,4],[0,5],[1,6],[2,6],[3,7]]};(sets[name]||sets.starter).forEach(([r,c])=>b[r][c]=true);return b}
function beatStats(){const notes=beat.flat().filter(Boolean).length,lanes=beat.filter(row=>row.some(Boolean)).length;return {notes,lanes}}
function renderCareer(){const idx=meta.beaten%RIVALS.length,r=RIVALS[idx]||RIVALS[0],fans=meta.fans||0;const ct=document.getElementById('career-title'),cx=document.getElementById('career-text'),cb=document.getElementById('career-badges');if(ct)ct.textContent=r.venue+' · '+r.n;if(cx)cx.textContent='Fans: '+fans+' · Beat rivals to unlock new beat packs and bigger stages.';if(cb)cb.innerHTML=['starter','dance','boss','syncopate','finale'].map(k=>'<span class="career-badge '+(meta.unlocks&&meta.unlocks[k]?'on':'')+'">'+(meta.unlocks&&meta.unlocks[k]?'✓ ':'○ ')+k+'</span>').join('');const hf=document.getElementById('h-fans'),hv=document.getElementById('h-venue');if(hf)hf.textContent=fans;if(hv)hv.textContent=r.venue}
function renderBeatCoach(){renderCareer();document.querySelectorAll('[data-beat]').forEach(b=>{const unlocked=meta.unlocks&&meta.unlocks[b.dataset.beat];b.disabled=!unlocked;b.title=unlocked?'Loaded beat pack':'Unlock this beat pack by winning rivals';b.style.opacity=unlocked?'1':'.45'});const st=beatStats(),el=document.getElementById('beat-coach');if(!el)return;el.textContent=st.notes<4?'Add a few more notes before battle.':st.lanes<4?'Try using all four lanes for a richer pattern.':st.notes>14?'Dense beat loaded. Great score ceiling, harder timing.':'Balanced beat ready. Preview it, then battle.'}
function readMeta(){try{return JSON.parse(localStorage.getItem(MK))??defMeta()}catch{return defMeta()}}
function defMeta(){return{best:0,goals:{},beaten:0,perfects:0,maxCombo:0,allLanes:false,fans:0,unlocks:{starter:true,dance:true,boss:true}}}
function saveMeta(){localStorage.setItem(MK,JSON.stringify(meta))}
function hexRgb(h){return`${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`}

// ── AUDIO ──
function audio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx}
function ping(lane){
  try{const c=audio(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);
  o.type=LANES[lane].t;o.frequency.value=LANES[lane].f;
  g.gain.setValueAtTime(.35,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.2);
  o.start();o.stop(c.currentTime+.22)}catch{}}

// ── COMPOSE GRID ──
function buildGrid(){
  renderBeatCoach();
  const el=document.getElementById('cgrid');el.innerHTML='';
  for(let r=0;r<4;r++){
    const row=document.createElement('div');row.className='compose-row';
    const lbl=document.createElement('div');lbl.className='lane-label';
    lbl.textContent=LANES[r].n;lbl.style.color=LANES[r].c;row.appendChild(lbl);
    for(let c=0;c<8;c++){
      const cell=document.createElement('div');cell.className='beat-cell';
      if(beat[r][c]){cell.style.background=LANES[r].c;cell.style.border='2px solid transparent';}
      cell.dataset.r=r;cell.dataset.c=c;row.appendChild(cell);
    }
    el.appendChild(row);
  }
}
document.getElementById('cgrid').addEventListener('click',e=>{
  const cell=e.target.closest('.beat-cell');if(!cell)return;
  const r=+cell.dataset.r,c=+cell.dataset.c;
  beat[r][c]=!beat[r][c];
  cell.style.background=beat[r][c]?LANES[r].c:'';
  cell.style.border=beat[r][c]?'2px solid transparent':'2px solid #2a1a5a';
  if(beat[r][c])ping(r);
  renderBeatCoach();
});
document.getElementById('btn-prev').addEventListener('click',()=>{
  if(prevInt){clearInterval(prevInt);prevInt=null;document.getElementById('btn-prev').textContent='▶ Preview';return}
  document.getElementById('btn-prev').textContent='⏹ Stop';prevBeat=0;
  prevInt=setInterval(()=>{for(let r=0;r<4;r++)if(beat[r][prevBeat])ping(r);prevBeat=(prevBeat+1)%8},280);
});
document.getElementById('btn-clear').addEventListener('click',()=>{beat=emptyBeat();buildGrid()});
document.querySelectorAll('[data-beat]').forEach(b=>b.addEventListener('click',()=>{if(!(meta.unlocks&&meta.unlocks[b.dataset.beat]))return;beat=presetBeat(b.dataset.beat);buildGrid();renderBeatCoach()}));
document.getElementById('btn-fight').addEventListener('click',()=>{
  if(prevInt){clearInterval(prevInt);prevInt=null;document.getElementById('btn-prev').textContent='▶ Preview'}
  startBattle();
});
document.getElementById('btn-back').addEventListener('click',()=>{stopBattle();showCompose()});
document.getElementById('btn-restart').addEventListener('click',()=>{stopBattle();startBattle()});

// ── BATTLE ──
function beatToPat(){
  const evts=[];
  for(let r=0;r<4;r++)for(let c=0;c<8;c++)if(beat[r][c])evts.push({lane:r,beat:c});
  return evts.length?evts:[{lane:0,beat:0},{lane:2,beat:2},{lane:1,beat:4},{lane:3,beat:6}];
}
function startBattle(){
  const idx=meta.beaten%RIVALS.length,rival=RIVALS[idx];
  const beatMs=60000/rival.bpm;
  const noteSpeed=HIT_Y/800*(1+idx*.12); // px/ms
  const travelMs=HIT_Y/noteSpeed;
  const allLanes=beat.every(row=>row.some(v=>v));
  if(allLanes)meta.allLanes=true;

  const pat=beatToPat(),rPat=RIVAL_PATS[idx];
  const LOOPS=3;
  const events=[];
  for(let loop=0;loop<LOOPS;loop++){
    pat.forEach(e=>events.push({lane:e.lane,tMs:(loop*8+e.beat)*beatMs,spawned:false}));
    rPat.forEach(([l,b])=>events.push({lane:l,tMs:(loop*8+b)*beatMs+beatMs*.3,spawned:false,rival:true}));
  }
  events.sort((a,b)=>a.tMs-b.tMs);
  // Shift all events forward so the first note has a full travel window before hitting
  const startDelay=travelMs+beatMs;
  events.forEach(e=>e.tMs+=startDelay);
  const endMs=LOOPS*8*beatMs+startDelay;

  gs={rival,idx,beatMs,noteSpeed,travelMs,
    events,eIdx:0,
    rHp:rival.hp,rMax:rival.hp,
    pHp:80,pMax:80,
    score:0,combo:0,maxCombo:0,perfects:0,
    notes:[],parts:[],texts:[],
    t0:null,elapsed:0,
    flash:[0,0,0,0],
    lastDmg:0,
    done:false,won:false,
    endMs,
  };
  document.getElementById('r-name').textContent=rival.n;
  document.getElementById('r-desc').textContent=rival.desc;
  document.getElementById('r-hp').style.width='100%';
  document.getElementById('phase-compose').style.display='none';
  document.getElementById('phase-battle').style.display='block';
  document.getElementById('result-box').className='result-box';
  refreshHud();
  if(!storyRun.running)storyRun.begin();

  const canvas=document.getElementById('gc');
  if(animId)cancelAnimationFrame(animId);
  let last=performance.now();
  function loop(now){
    const dt=now-last;last=now;
    tick(now,dt);
    draw();
    if(!gs.done)animId=requestAnimationFrame(loop);
    else finishBattle();
  }
  animId=requestAnimationFrame(loop);
}
function stopBattle(){if(animId){cancelAnimationFrame(animId);animId=null}}
function showCompose(){
  document.getElementById('phase-compose').style.display='';
  document.getElementById('phase-battle').style.display='none';
}

function tick(now,dt){
  if(!gs)return;
  if(gs.t0===null)gs.t0=now;
  gs.elapsed=now-gs.t0;

  // spawn notes
  while(gs.eIdx<gs.events.length){
    const e=gs.events[gs.eIdx];
    if(gs.elapsed>=e.tMs-gs.travelMs){
      gs.notes.push({lane:e.lane,rival:!!e.rival,tMs:e.tMs,hit:false,missed:false});
      gs.eIdx++;
    }else break;
  }

  // update y from timing
  gs.notes.forEach(n=>{
    n.y=(gs.elapsed-(n.tMs-gs.travelMs))*gs.noteSpeed;
  });

  // auto-miss
  gs.notes.forEach(n=>{
    if(!n.hit&&!n.missed&&n.y>HIT_Y+HIT_WIN+24){
      n.missed=true;
      if(!n.rival){
        gs.combo=0;
        gs.pHp=Math.max(0,gs.pHp-6);
        addText(n.lane,HIT_Y-10,'MISS','#ff4444');
        burst(n.lane,HIT_Y,'#ff4444',false);
      }
    }
  });

  // rival periodic attack
  if(gs.elapsed-gs.lastDmg>gs.beatMs*8&&gs.elapsed>gs.beatMs*2){
    gs.lastDmg=gs.elapsed;
    const shield=Math.min(12,Math.floor(gs.combo/4)*2);
    const dmg=Math.max(0,gs.rival.hit-shield);
    if(dmg>0){gs.pHp=Math.max(0,gs.pHp-dmg);addText(0,180,'-'+dmg+' HP','#ff6b9d')}
  }

  // particles / texts
  gs.parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.25;p.life-=3});
  gs.parts=gs.parts.filter(p=>p.life>0);
  gs.texts.forEach(t=>{t.y-=1.4;t.life-=2});
  gs.texts=gs.texts.filter(t=>t.life>0);
  gs.flash=gs.flash.map(f=>Math.max(0,f-5));

  // end conditions
  if(gs.rHp<=0){gs.done=true;gs.won=true}
  if(gs.pHp<=0){gs.done=true;gs.won=false}
  if(gs.elapsed>gs.endMs+gs.travelMs+600&&!gs.done){gs.done=true;gs.won=false}
}

function timingMessage(txt,col){const el=document.getElementById('timing-readout');if(el){el.textContent=txt;el.style.borderColor=col;el.style.color=col}}
function tapLane(lane){
  if(!gs||gs.done)return;
  ping(lane);
  gs.flash[lane]=100;
  let best=null,bestDist=Infinity;
  gs.notes.forEach(n=>{
    if(n.lane===lane&&!n.rival&&!n.hit&&!n.missed){
      const d=Math.abs(n.y-HIT_Y);
      if(d<bestDist){bestDist=d;best=n}
    }
  });
  if(best&&bestDist<=HIT_WIN){
    best.hit=true;
    const perf=bestDist<=PERF_WIN;
    gs.combo++;gs.maxCombo=Math.max(gs.maxCombo,gs.combo);
    if(perf){gs.perfects++;gs.score+=150;addText(lane,HIT_Y-45,'PERFECT!','#ffd700');timingMessage('Perfect hit. Keep the combo alive.','#ffd700')}
    else{gs.score+=80;addText(lane,HIT_Y-45,'GOOD','#34d399');timingMessage('Good hit. Aim for the centre of the ring.','#34d399')}
    const dmg=(perf?22:13)+Math.floor(gs.combo/5)*5;
    gs.rHp=Math.max(0,gs.rHp-dmg);
    burst(lane,HIT_Y,LANES[lane].c,true);
    refreshHud();
  }else if(best){
    const msg=best.y<HIT_Y?'Too early. Wait for the ring.':'Too late. Tap sooner.';
    addText(lane,HIT_Y-45,best.y<HIT_Y?'EARLY':'LATE','#888');timingMessage(msg,'#a78bfa');
  }else{timingMessage('No note in this lane yet. Watch the falling pattern.','#a78bfa')}
}

function addText(lane,y,txt,col){
  gs.texts.push({x:LW*lane+LW/2,y,txt,col,life:75});
}
function burst(lane,y,col,big){
  const cx=LW*lane+LW/2,n=big?14:5;
  for(let i=0;i<n;i++){
    const a=Math.PI*2*i/n+Math.random()*.4,sp=big?(3+Math.random()*4):(1.5+Math.random()*2);
    gs.parts.push({x:cx,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3,col,life:55+Math.random()*20,r:2.5+Math.random()*3});
  }
}

function draw(){
  const canvas=document.getElementById('gc'),ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,CW,CH);

  // lane backgrounds
  for(let i=0;i<4;i++){
    if(gs.flash[i]>0){
      ctx.fillStyle=`rgba(${hexRgb(LANES[i].c)},${gs.flash[i]/500})`;
    }else{
      ctx.fillStyle=i%2?'#100a26':'#0d0820';
    }
    ctx.fillRect(i*LW,0,LW,CH);
  }
  // dividers
  ctx.strokeStyle='#2a1a5a';ctx.lineWidth=1;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(i*LW,0);ctx.lineTo(i*LW,CH);ctx.stroke()}

  // hit zone glow
  for(let i=0;i<4;i++){
    const rgb=hexRgb(LANES[i].c);
    const grd=ctx.createLinearGradient(i*LW,HIT_Y-40,i*LW,HIT_Y+HIT_WIN);
    grd.addColorStop(0,`rgba(${rgb},0)`);
    grd.addColorStop(1,`rgba(${rgb},0.18)`);
    ctx.fillStyle=grd;
    ctx.fillRect(i*LW,HIT_Y-40,LW,HIT_WIN+40);
  }
  // hit line
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,HIT_Y+HIT_WIN);ctx.lineTo(CW,HIT_Y+HIT_WIN);ctx.stroke();

  // target rings
  for(let i=0;i<4;i++){
    const cx=i*LW+LW/2,a=gs.flash[i]/100;
    ctx.shadowBlur=a*20;ctx.shadowColor=LANES[i].c;
    ctx.strokeStyle=LANES[i].c;ctx.lineWidth=3;
    ctx.globalAlpha=.55+a*.45;
    ctx.beginPath();ctx.arc(cx,HIT_Y,24,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    ctx.fillStyle=LANES[i].c;ctx.font='bold 13px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(LANES[i].k.toUpperCase(),cx,HIT_Y+5);
  }

  // notes
  gs.notes.forEach(n=>{
    if(n.hit||n.missed)return;
    const cx=n.lane*LW+LW/2,r=20;
    ctx.shadowBlur=18;ctx.shadowColor=LANES[n.lane].c;
    if(!n.rival){
      ctx.fillStyle=LANES[n.lane].c;
      ctx.beginPath();ctx.arc(cx,n.y,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 13px Inter,sans-serif';ctx.textAlign='center';
      ctx.fillText(['K','S','H','♪'][n.lane],cx,n.y+5);
    }else{
      ctx.globalAlpha=.35;ctx.fillStyle=LANES[n.lane].c;
      ctx.beginPath();ctx.arc(cx,n.y,r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.strokeStyle=LANES[n.lane].c;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(cx,n.y,r,0,Math.PI*2);ctx.stroke();
    }
    ctx.shadowBlur=0;
  });

  // particles
  gs.parts.forEach(p=>{
    ctx.globalAlpha=p.life/75;ctx.fillStyle=p.col;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  });ctx.globalAlpha=1;

  // floating texts
  gs.texts.forEach(t=>{
    ctx.globalAlpha=t.life/75;ctx.fillStyle=t.col;
    ctx.font='bold 17px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(t.txt,t.x,t.y);
  });ctx.globalAlpha=1;

  // player HP bar bottom
  const bw=CW-20;
  ctx.fillStyle='#2a1a5a';ctx.beginPath();ctx.roundRect(10,CH-20,bw,10,5);ctx.fill();
  const pct=Math.max(0,gs.pHp/gs.pMax);
  ctx.fillStyle=pct>.5?'#34d399':pct>.25?'#fbbf24':'#ff4444';
  ctx.beginPath();ctx.roundRect(10,CH-20,bw*pct,10,5);ctx.fill();

  // lane name labels top
  for(let i=0;i<4;i++){
    ctx.fillStyle=LANES[i].c;ctx.font='bold 11px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(LANES[i].n,i*LW+LW/2,18);
  }

  // rival HP bar
  document.getElementById('r-hp').style.width=Math.max(0,gs.rHp/gs.rMax*100)+'%';
  // combo overlay
  if(gs.combo>=3){
    ctx.fillStyle='rgba(255,255,255,0.07)';
    ctx.font=`bold ${Math.min(80,24+gs.combo*2)}px Inter,sans-serif`;
    ctx.textAlign='center';ctx.fillText(gs.combo+'×',CW/2,CH/2+20);
  }
}

function refreshHud(){
  renderCareer();
  if(!gs)return;
  document.getElementById('h-score').textContent=gs.score;
  document.getElementById('h-combo').textContent=gs.combo+'×';
  document.getElementById('h-rival').textContent=gs.rival.n;
  document.getElementById('h-best').textContent=meta.best;
  storyRun.setScore(gs.score);
}

function finishBattle(){
  stopBattle();
  if(gs.maxCombo>meta.maxCombo)meta.maxCombo=gs.maxCombo;
  meta.perfects+=gs.perfects;
  let rewardFans=0, unlocked='';
  if(gs.won){meta.beaten=Math.max(meta.beaten,gs.idx+1);rewardFans=40+gs.idx*35+Math.floor(gs.maxCombo/2)+gs.perfects;meta.fans=(meta.fans||0)+rewardFans;if(gs.rival.unlock){meta.unlocks=meta.unlocks||{};if(!meta.unlocks[gs.rival.unlock]){meta.unlocks[gs.rival.unlock]=true;unlocked=gs.rival.unlock}}}
  const final=gs.score+(gs.won?600:0)+gs.maxCombo*12+rewardFans;
  if(final>meta.best)meta.best=final;
  GOAL_DEFS.forEach(([id,,fn])=>{if(fn(meta))meta.goals[id]=true});
  saveMeta();
  try{GS_SYS.saveState({best:meta.best})}catch{}
  window.jvdsCheckNewBest&&window.jvdsCheckNewBest();
  document.getElementById('h-best').textContent=meta.best;
  const box=document.getElementById('result-box');
  box.className='result-box';
  box.innerHTML=gs.won
    ?`<b style="color:#34d399">⚡ Victory!</b> Defeated ${gs.rival.n}! Score: ${final}. Combo: ${gs.maxCombo}×. Perfects: ${gs.perfects}. Fans +${rewardFans}.${unlocked?' Unlocked '+unlocked+' beat pack.':''}${gs.idx<RIVALS.length-1?' Next venue is stronger - remix your beat!':' All rivals defeated!'}`
    :`<b style="color:#ff6b9d">💥 Defeated.</b> Score: ${final}. Max combo: ${gs.maxCombo}×. ${gs.rival.n} hit too hard. Try placing more notes!`;
  renderGoals();renderCareer();refreshHud();
  const outcome=gs.won?'success':(gs.pHp>0?'partial':'fail');
  storyRun.finish(outcome,final);
}

// ── INPUT ──
document.addEventListener('keydown',e=>{
  if(!gs||gs.done)return;
  const i=['a','s','d','f'].indexOf(e.key.toLowerCase());
  if(i>=0){e.preventDefault();tapLane(i)}
});
const canvas=document.getElementById('gc');
canvas.addEventListener('click',e=>{
  if(!gs||gs.done)return;
  const r=canvas.getBoundingClientRect();
  tapLane(Math.min(3,Math.floor((e.clientX-r.left)*(CW/r.width)/LW)));
});
canvas.addEventListener('touchstart',e=>{
  if(!gs||gs.done)return;
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  Array.from(e.changedTouches).forEach(t=>{
    tapLane(Math.min(3,Math.floor((t.clientX-r.left)*(CW/r.width)/LW)));
  });
},{passive:false});

// ── GOALS ──
function renderGoals(){
  document.getElementById('goals').innerHTML=GOAL_DEFS.map(([id,label])=>
    `<div class="goal ${meta.goals[id]?'done':''}"><b>${meta.goals[id]?'✓':'○'}</b><span>${label}</span></div>`
  ).join('');
}

// ── INIT ──
buildGrid();
renderGoals();
document.getElementById('h-best').textContent=meta.best;
