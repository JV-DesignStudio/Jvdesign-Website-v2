const gameSystem=new GameSystem('pips-cozy-cove',"Pip's Cozy Cove",'pip');
let audioFx;try{audioFx=new AudioEffects(.65);if(localStorage.getItem('soundEnabled')==='false')audioFx.setMasterVolume(0);}catch(e){}
const KEY='pips_cozy_cove_v2';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const W=900,H=1100,WATER_TOP=360,DOCK_TOP=950,ROD_BASE={x:430,y:1060};

/* ---- data ---- */
const FISH=[
  {name:'Minnow',emoji:'🐟',pts:50,wait:[1.5,3.5],reel:7,esc:1.4,drain:1.1,col:'#7dd3fc',shadowR:14},
  {name:'Perch',emoji:'🐠',pts:120,wait:[2,5],reel:11,esc:1.1,drain:1.8,col:'#fb923c',shadowR:20},
  {name:'Bass',emoji:'🐡',pts:250,wait:[2.5,6],reel:17,esc:0.9,drain:2.6,col:'#4ade80',shadowR:28},
  {name:'Golden Carp',emoji:'🌟',pts:600,wait:[3.5,8],reel:24,esc:1.6,drain:3.4,col:'#fbbf24',shadowR:38},
];
const LEGENDARY={name:'Dragon Koi',emoji:'🐲',pts:2000,wait:[0.8,1.8],reel:30,esc:0.6,drain:4.8,col:'#c084fc',shadowR:52,legendary:true};
const SIZE_TABLE={small:{pts:0.6,reel:0.7,label:'Small'},normal:{pts:1,reel:1,label:''},trophy:{pts:2,reel:1.4,label:'Trophy'}};

/* rod tiers - #7 rod upgrades */
const RODS=[
  {name:'Willow Rod',emoji:'🎣',castMult:1,reelMult:1,rareMult:1,reqCatches:0,desc:'Your trusty starter rod'},
  {name:'Carbon Rod',emoji:'🏆',castMult:1.2,reelMult:1.15,rareMult:1.1,reqCatches:10,desc:'Longer casts, faster reel'},
  {name:'Master Rod',emoji:'⚜️',castMult:1.4,reelMult:1.3,rareMult:1.25,reqCatches:25,desc:'Cast further, reel steadier'},
];

const BAITS=[
  {name:'Worm',emoji:'🪱',desc:'Attracts all fish',waitMult:1,bias:0,maxUses:4},
  {name:'Lure',emoji:'🎣',desc:'Bigger fish, longer wait',waitMult:1.3,bias:1,maxUses:3},
  {name:'Bread',emoji:'🍞',desc:'Fast bites, common fish',waitMult:0.65,bias:-1,maxUses:5},
];
const LEVELS=[
  {name:'Morning Cove',target:3,fishPool:[0,0,0,1],
   hotspots:[{x:290,y:580,r:60},{x:540,y:470,r:55},{x:680,y:620,r:65}],
   pal:{sky0:'#bfdbfe',sky1:'#dbeafe',water0:'#1d4ed8',water1:'#3b82f6',haze:'#93c5fd',trees:'#064e3b'},dec:'morning'},
  {name:'Lily Pad Bay',target:4,fishPool:[0,1,1,2],
   hotspots:[{x:220,y:540,r:55},{x:490,y:450,r:60},{x:710,y:510,r:55}],
   pal:{sky0:'#d1fae5',sky1:'#ecfdf5',water0:'#065f46',water1:'#059669',haze:'#6ee7b7',trees:'#14532d'},dec:'lily'},
  {name:'Rocky Channel',target:4,fishPool:[1,2,2,3],
   hotspots:[{x:310,y:490,r:55},{x:620,y:530,r:65}],
   pal:{sky0:'#e0e7ff',sky1:'#eef2ff',water0:'#312e81',water1:'#4338ca',haze:'#a5b4fc',trees:'#1e1b4b'},dec:'rocky'},
  {name:'Golden Pool',target:5,fishPool:[1,2,3,3],
   hotspots:[{x:450,y:468,r:80}],
   pal:{sky0:'#fef3c7',sky1:'#fffbeb',water0:'#78350f',water1:'#b45309',haze:'#fcd34d',trees:'#422006'},dec:'golden'},
];
const TIPS=[
  {t:'Cast Near Ripples',d:'Subtle disturbances mark where fish hide. Cast close for a faster bite!'},
  {t:'Reel Steady',d:'Tap quickly but watch the tension bar - reel too fast and the line snaps!'},
  {t:'Follow the Arrow',d:'When the arrow flashes during reeling, swipe that way or the fish pulls harder.'},
  {t:'Shake to Reel',d:'On mobile, shaking the phone counts as a reel tap! Use it in a panic.'},
  {t:'Trophy Fish',d:'Long casts with the Lure bait can hook a trophy-size fish worth double points!'},
  {t:'Combo Bonus',d:'Catch fish back-to-back within 20 seconds to build a chain bonus.'},
  {t:'Dragon Koi',d:'Cast into a glowing hotspot for a chance to hook the legendary Dragon Koi!'},
  {t:'Rod Upgrades',d:'Catch 10 fish total to unlock the Carbon Rod - longer casts, faster reeling!'},
  {t:'Streak Bonus',d:'Catch 5 in a row without losing a fish to earn a free bait refill!'},
  {t:'Photo Mode',d:'Tap the camera button to save a screenshot of your best catch!'},
];
let tipIdx=0;

/* ---- daily challenge ---- */
function getDailyChallenge(){
  const d=new Date(),key=d.toDateString();
  const seed=d.getDate()+d.getMonth()*31;
  const types=['catch_fish','catch_trophy','catch_legendary','catch_combo','chain_catch'];
  const type=types[seed%types.length];
  if(type==='catch_fish'){const f=FISH[seed%4];return{key,type,target:f.name,label:'Catch 3 '+f.emoji+' '+f.name,goal:3,prog:'fishCount'};}
  if(type==='catch_trophy'){return{key,label:'Land a trophy catch',goal:1,type:'trophy',prog:'trophyCount'};}
  if(type==='catch_legendary'){return{key,label:'Hook the Dragon Koi',goal:1,type:'legendary',prog:'legendaryCount'};}
  if(type==='catch_combo'){return{key,label:'Reach a x3 combo',goal:3,type:'combo',prog:'maxCombo'};}
  return{key,label:'Chain 3 catches in a row',goal:3,type:'chain',prog:'chainCount'};
}

/* ---- seasonal fish - #8 ---- */
function getSeasonalFish(){
  const mo=new Date().getMonth();
  if(mo===11||mo===0||mo===1)return{name:'Frost Trout',emoji:'🐟',pts:180,wait:[2,4.5],reel:13,esc:1.2,drain:2,col:'#bfdbfe',shadowR:22,seasonal:true};
  if(mo>=2&&mo<=4)return{name:'Blossom Dace',emoji:'🌸',pts:160,wait:[1.8,4],reel:12,esc:1.3,drain:1.6,col:'#fbcfe8',shadowR:18,seasonal:true};
  if(mo>=5&&mo<=7)return{name:'Summer Roach',emoji:'🌊',pts:140,wait:[1.5,3.5],reel:10,esc:1.1,drain:1.4,col:'#6ee7b7',shadowR:16,seasonal:true};
  return{name:'Autumn Chub',emoji:'🍂',pts:170,wait:[2,4],reel:14,esc:1.0,drain:1.9,col:'#fcd34d',shadowR:20,seasonal:true};
}

/* ---- state ---- */
let sv,lv,score,caught,combo;
let st='idle';
let drag=null,chargeT=0,charging=false;
let bob={x:450,y:600,show:false,dip:0};
let fly={t:0,dur:0.75,x0:490,y0:750,x1:450,y1:580};
let cur=null;
let castT=0,casting=false;
let particles=[],weatherPtx=[],bubbles=[],bgJumps=[],floatTexts=[];
let last=0,playing=false;
let bait=0,weather='clear',lossStreak=0;
let catchLog=[];
let revealData=null,revealT=0;
let reelSwipeStart=null;
let screenFlash={alpha:0,col:'#fff'};
let chainTimer=0,chainCount=0;
let legendaryEvent=null;
let dailyChallenge=null,dailyProg={fishCount:{},trophyCount:0,legendaryCount:0,maxCombo:0,chainCount:0};
let dailyDone=false;

/* new state for improvements */
let rodLevel=0;                  /* #7 rod tier */
let baitUses=[4,3,5];            /* #12 bait durability */
let catchStreak=0;               /* #10 streak bonus */
let luckyCharm=false;            /* #14 lucky charm */
let photoMode=false;             /* #25 photo mode */
let jumpReveal=null;             /* #19 catch jump animation */
let catchJumpT=0;
let nibBobs=0,nibBobTarget=0;    /* #4 multi-bob anticipation */
let ambientNode=null;            /* #21 ambient audio */
let tensionBeepT=0;              /* #23 tension sound */

function loadSv(){try{return Object.assign({best:0,bestLevel:0,stars:{},total:0,log:[],bestiary:{},daily:{},bests:{},rodLevel:0,charm:false,dailyBoard:[]},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return{best:0,bestLevel:0,stars:{},total:0,log:[],bestiary:{},daily:{},bests:{},rodLevel:0,charm:false,dailyBoard:[]};}}
function storeSv(){try{localStorage.setItem(KEY,JSON.stringify(sv))}catch{}}

function rollWeather(){
  const r=Math.random();
  weather=r<0.55?'clear':r<0.82?'rain':'storm';
  weatherPtx=[];
}

/* #17 time-of-day: returns 0-1 based on real clock hour */
function getTimeOfDay(){
  const h=new Date().getHours()+(new Date().getMinutes()/60);
  if(h<6)return 0;   // night
  if(h<9)return(h-6)/3*0.25;    // dawn
  if(h<17)return 0.25+(h-9)/8*0.5; // day
  if(h<20)return 0.75+(h-17)/3*0.2; // dusk
  return 0.95+(h-20)/4*0.05;    // evening
}

/* #20 seasonal: returns decor type based on month */
function getSeason(){
  const m=new Date().getMonth();
  if(m===11||m===0||m===1)return'winter';
  if(m>=2&&m<=4)return'spring';
  if(m>=5&&m<=7)return'summer';
  return'autumn';
}

function startLevel(i){
  lv=Math.max(0,Math.min(i,LEVELS.length-1));
  score=0;caught=0;combo=0;chainTimer=0;chainCount=0;catchStreak=0;
  st='idle';drag=null;bob.show=false;bob.dip=0;cur=null;particles=[];bubbles=[];bgJumps=[];floatTexts=[];
  casting=false;charging=false;chargeT=0;legendaryEvent=null;screenFlash.alpha=0;jumpReveal=null;
  playing=true;
  rollWeather();
  dailyChallenge=getDailyChallenge();
  const savedDaily=sv.daily||{};
  dailyDone=savedDaily[dailyChallenge.key]===true;
  rodLevel=sv.rodLevel||0;
  luckyCharm=sv.charm||false;
  baitUses=BAITS.map(b=>b.maxUses);
  setStatus('Flick upward from the bottom to cast your line! 🎣');
  hideModal();updateUI();
  rotateTip();buildBaitUI();buildPhotoBtn();
  startAmbient();
}

function cfg(){return LEVELS[lv];}
function rotateTip(){tipIdx=(tipIdx+1)%TIPS.length;const tp=TIPS[tipIdx];document.getElementById('tipTitle').textContent=tp.t;document.getElementById('tipDetail').textContent=tp.d;}

/* #12 bait durability - consume on cast */
function consumeBait(){
  baitUses[bait]=Math.max(0,baitUses[bait]-1);
  if(baitUses[bait]===0){
    spawnFloatText(BAITS[bait].name+' used up!',W/2,WATER_TOP+80,'#f59e0b');
    // auto-switch to a bait with uses left
    for(let i=0;i<BAITS.length;i++){if(baitUses[i]>0){bait=i;break;}}
  }
  buildBaitUI();
}

function buildBaitUI(){
  let el=document.getElementById('baitBar');
  if(!el){
    el=document.createElement('div');
    el.id='baitBar';
    el.style.cssText='display:flex;gap:5px;margin-top:10px;';
    const m=document.querySelector('.mission');
    if(m)m.after(el);
  }
  el.innerHTML='';
  BAITS.forEach((b,i)=>{
    const uses=baitUses[i];
    const btn=document.createElement('button');
    btn.className='ghost';
    const sel=i===bait;
    btn.style.cssText='flex:1;padding:7px 2px;font-size:11px;margin-top:0;border-radius:11px;position:relative;'+(sel?'background:#14b8a6;color:#fff;border-color:#14b8a6':'')+(uses===0?'opacity:0.4;':'');
    btn.innerHTML=b.emoji+' '+b.name+'<span style="display:block;font-size:9px;opacity:0.7">'+('|'.repeat(uses))+'</span>';
    btn.title=b.desc+' ('+uses+' uses left)';
    btn.disabled=uses===0;
    btn.onclick=()=>{if(st==='idle'){bait=i;buildBaitUI();}};
    el.appendChild(btn);
  });
  buildRodUI();
  buildDailyUI();
  buildLogUI();
  buildLeaderboardUI();
}

/* #7 rod upgrade UI */
function buildRodUI(){
  let el=document.getElementById('rodCard');
  if(!el){
    el=document.createElement('div');
    el.id='rodCard';
    el.className='cove-last';
    el.style='margin-top:10px;border-left:3px solid #92400e;';
    const bar=document.getElementById('baitBar');
    if(bar)bar.after(el);
  }
  const rod=RODS[rodLevel];
  const next=RODS[rodLevel+1];
  const total=sv.total||0;
  el.innerHTML=`<p>Rod</p><div style="font-weight:700;font-size:13px">${rod.emoji} ${rod.name}</div><div style="font-size:11px;color:#94a3b8;margin:2px 0">${rod.desc}</div>`+(next?`<div style="font-size:11px;color:#f59e0b;margin-top:3px">Next: ${next.name} at ${next.reqCatches} catches (${total}/${next.reqCatches})</div>`:`<div style="font-size:11px;color:#22c55e;margin-top:3px">Max rod equipped!</div>`);
  if(luckyCharm){el.innerHTML+=`<div style="font-size:11px;color:#c084fc;margin-top:4px">🍀 Lucky Charm active (+15% rare fish)</div>`;}
}

function buildDailyUI(){
  let el=document.getElementById('dailyCard');
  if(!el){
    el=document.createElement('div');
    el.id='dailyCard';
    el.className='cove-last';
    el.style='margin-top:10px;border-left:3px solid #f59e0b;';
    const rod=document.getElementById('rodCard');
    if(rod)rod.after(el);
  }
  if(!dailyChallenge){el.innerHTML='';return;}
  const done=dailyDone;
  el.innerHTML=`<p>Daily Challenge${done?' <span style="color:#22c55e">Done!</span>':''}</p><div style="font-size:13px;font-weight:700;margin:4px 0">${dailyChallenge.label}</div>${done?'<div style="color:#22c55e;font-size:12px">+500 bonus pts earned!</div>':'<div style="color:#94a3b8;font-size:11px">Complete for +500 bonus pts</div>'}`;
}

/* #9 personal best per species in bestiary */
function buildLogUI(){
  let el=document.getElementById('catchLogCard');
  if(!el){
    el=document.createElement('div');
    el.id='catchLogCard';
    el.className='cove-last';
    el.style='margin-top:10px;';
    const daily=document.getElementById('dailyCard');
    if(daily)daily.after(el);
  }
  const bestiary=sv.bestiary||{};
  const bests=sv.bests||{};
  const allFish=[...FISH,LEGENDARY,getSeasonalFish()];
  const rows=allFish.map(f=>{
    const c=bestiary[f.name]||0;
    const pb=bests[f.name]?` <span style="color:#fbbf24;font-size:10px">PB:${bests[f.name]}</span>`:'';
    return`<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:2px 0;border-bottom:.5px solid rgba(0,0,0,.08);opacity:${c>0?1:0.35}"><span>${f.emoji} ${f.name}${f.seasonal?'<span style="color:#f59e0b;font-size:9px"> seasonal</span>':''}</span><span style="display:flex;align-items:center;gap:4px"><b style="color:${f.legendary?'#c084fc':f.seasonal?'#f59e0b':'#0d9488'}">${c>0?c:'?'}</b>${pb}</span></div>`;
  }).join('');
  el.innerHTML='<p>Bestiary</p>'+rows;
}

/* #24 daily leaderboard */
function buildLeaderboardUI(){
  let el=document.getElementById('leaderCard');
  if(!el){
    el=document.createElement('div');
    el.id='leaderCard';
    el.className='cove-last';
    el.style='margin-top:10px;';
    const log=document.getElementById('catchLogCard');
    if(log)log.after(el);
  }
  const board=sv.dailyBoard||[];
  const today=new Date().toDateString();
  const todayScores=board.filter(e=>e.date===today).sort((a,b)=>b.score-a.score).slice(0,5);
  if(!todayScores.length){el.innerHTML='<p>Today\'s Best</p><div style="font-size:11px;color:#94a3b8">No scores yet today</div>';return;}
  const rows=todayScores.map((e,i)=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span>${['🥇','🥈','🥉','4.','5.'][i]} ${e.level}</span><b style="color:#fbbf24">${e.score}</b></div>`).join('');
  el.innerHTML='<p>Today\'s Best</p>'+rows;
}

/* #25 photo mode button */
function buildPhotoBtn(){
  if(document.getElementById('photoBtn'))return;
  const btn=document.createElement('button');
  btn.id='photoBtn';
  btn.className='ghost';
  btn.style.cssText='margin-top:8px;width:100%;font-size:13px;';
  btn.textContent='📷 Save Photo';
  btn.onclick=savePhoto;
  const wrap=document.querySelector('.stage-wrap');
  if(wrap)wrap.appendChild(btn);
}

function savePhoto(){
  try{
    const link=document.createElement('a');
    link.download='pips-cozy-cove-'+Date.now()+'.png';
    link.href=canvas.toDataURL('image/png');
    link.click();
    spawnFloatText('Photo saved!',W/2,WATER_TOP+60,'#22c55e');
  }catch(e){spawnFloatText('Photo failed',W/2,WATER_TOP+60,'#ef4444');}
}

function toCanvas(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}

canvas.addEventListener('pointerdown',e=>{
  if(st==='bite'||st==='reeling'){handleReel();reelSwipeStart=toCanvas(e);canvas.setPointerCapture(e.pointerId);return;}
  if(st!=='idle')return;
  const p=toCanvas(e);
  if(p.y<DOCK_TOP-120)return;
  drag={sx:p.x,sy:p.y,cx:p.x,cy:p.y};
  charging=true;chargeT=0;
  canvas.setPointerCapture(e.pointerId);
  setStatus('Hold for power, flick up to cast!');
});
canvas.addEventListener('pointermove',e=>{
  if(drag){const p=toCanvas(e);drag.cx=p.x;drag.cy=p.y;}
  if(reelSwipeStart&&(st==='bite'||st==='reeling')&&cur?.direction){
    const p=toCanvas(e),dx=p.x-reelSwipeStart.x;
    if(Math.abs(dx)>45){
      const dir=dx>0?'right':'left';
      if(dir===cur.direction){
        cur.reelProg=Math.min(cur.fish.reel*cur.sizeM.reel,(cur.reelProg||0)+0.9);
        spawnFloatText('+boost',bob.x,bob.y-50,'#22c55e');
      }else{
        cur.reelProg=Math.max(0,(cur.reelProg||0)-2.2);
        spawnFloatText('wrong way!',bob.x,bob.y-50,'#ef4444');
      }
      reelSwipeStart=p;
    }
  }
});
canvas.addEventListener('pointerup',e=>{
  reelSwipeStart=null;
  if(!drag)return;
  const dx=drag.cx-drag.sx,dy=drag.sy-drag.cy;
  charging=false;drag=null;
  if(dy<55){setStatus('Flick upward to cast the line!');chargeT=0;return;}
  doCast(dx,dy);
});

/* shake to reel */
let lastShakeMs=0;
(function initShake(){
  if(typeof DeviceMotionEvent==='undefined')return;
  const handler=e=>{const a=e.accelerationIncludingGravity;if(!a)return;const mag=Math.hypot(a.x||0,a.y||0,a.z||0),now=performance.now();if(mag>22&&now-lastShakeMs>160&&(st==='bite'||st==='reeling')){lastShakeMs=now;handleReel();}};
  if(typeof DeviceMotionEvent.requestPermission==='function'){document.addEventListener('click',function req(){DeviceMotionEvent.requestPermission().then(r=>{if(r==='granted')window.addEventListener('devicemotion',handler);});document.removeEventListener('click',req);},{once:true});}
  else{window.addEventListener('devicemotion',handler);}
})();

function doCast(dx,dy){
  if(st!=='idle')return;
  const rod=RODS[rodLevel];
  const flickPow=Math.min(1,Math.hypot(dx,dy)/340),chargePow=Math.min(1,chargeT/1.4);
  const power=Math.min(1,(flickPow*0.65+chargePow*0.45)*rod.castMult);chargeT=0;
  const side=Math.max(-1,Math.min(1,dx/270));
  const depth=Math.max(0.08,Math.min(0.9,0.15+power*0.8));
  const landX=Math.max(90,Math.min(810,450+side*300));
  const landY=WATER_TOP+30+(1-depth)*(DOCK_TOP-WATER_TOP-110);
  const near=cfg().hotspots.find(h=>Math.hypot(landX-h.x,landY-h.y)<h.r+20);
  fly={t:0,dur:0.65+power*0.3,x0:490,y0:750,x1:landX,y1:landY};
  bob.x=landX;bob.y=landY;bob.show=false;bob.dip=0;
  casting=true;castT=0;st='flying';
  if(near&&Math.random()<0.10&&!legendaryEvent){legendaryEvent={x:landX,y:landY,timer:12,pulse:0,triggered:false};}
  if(near)setStatus(legendaryEvent?'The water glows... something stirs!':'Great cast! Near a fish spot');
  consumeBait();
  try{audioFx&&audioFx.playPop();}catch{}
}

function handleReel(){
  const now=performance.now();
  if(st==='bite'){
    if(cur&&cur.escTimer){clearTimeout(cur.escTimer);cur.escTimer=null;}
    st='reeling';
    if(cur){cur.reelProg=1.5;cur.direction=null;cur.dirTimer=1.5+Math.random();cur.tension=0;cur.lastTapMs=now;}
    setStatus('Reel it in! Watch the tension!');updateUI();
  }
  if(st==='reeling'&&cur){
    const interval=now-(cur.lastTapMs||now);cur.lastTapMs=now;
    if(interval<190)cur.tension=Math.min(1,(cur.tension||0)+0.2);
    if(cur.tension>=1){snapLine();return;}
    const rod=RODS[rodLevel];
    cur.reelProg=(cur.reelProg||0)+rod.reelMult;
    try{audioFx&&audioFx.playPop();}catch{}
    updateUI();
    if(cur.reelProg>=cur.fish.reel*cur.sizeM.reel)fishCaught();
  }
}

function snapLine(){
  lossStreak++;combo=0;chainTimer=0;catchStreak=0;
  spawnSplash(bob.x,bob.y+bob.dip,'escape','');
  spawnFloatText('SNAP!',bob.x,bob.y-60,'#ef4444');
  setStatus('The line snapped! Reel slower...');
  document.getElementById('lastFish').textContent='Line snapped...';
  document.getElementById('lastPts').textContent='';
  try{audioFx&&audioFx.playError();}catch{}
  st='done';updateUI();setTimeout(resetCast,1300);
}

function fishCaught(){
  st='catchReveal';revealT=0;
  caught++;combo++;lossStreak=0;catchStreak++;
  const hasChain=chainTimer>0;
  if(hasChain)chainCount++;
  chainTimer=20;
  const mult=Math.min(4,combo);
  const chainMult=hasChain?1.5:1;
  const pts=Math.round(cur.fish.pts*cur.sizeM.pts*mult*chainMult);
  score+=pts;
  sv.total=(sv.total||0)+1;
  sv.bestiary=sv.bestiary||{};sv.bestiary[cur.fish.name]=(sv.bestiary[cur.fish.name]||0)+1;

  /* #9 personal best per species */
  sv.bests=sv.bests||{};
  if(!sv.bests[cur.fish.name]||pts>sv.bests[cur.fish.name]){sv.bests[cur.fish.name]=pts;}

  const entry={name:cur.fish.name,emoji:cur.fish.emoji,size:cur.sizeM.label,pts,legendary:cur.fish.legendary};
  catchLog.unshift(entry);catchLog=catchLog.slice(0,8);sv.log=catchLog;
  revealData={fish:cur.fish,sizeM:cur.sizeM,pts,mult,chainMult,hasChain,x:bob.x,y:bob.y+bob.dip};
  document.getElementById('lastFish').textContent=cur.fish.emoji+' '+cur.fish.name+(cur.sizeM.label?' ('+cur.sizeM.label+')':'');
  document.getElementById('lastPts').textContent=pts+' pts'+(mult>1?' (x'+mult+')':'');

  if(cur.fish.legendary){screenFlash={alpha:1,col:'#c084fc'};}
  else if(cur.sizeM===SIZE_TABLE.trophy){screenFlash={alpha:0.7,col:'#fbbf24'};}

  /* #19 catch jump animation */
  jumpReveal={x:bob.x,y:bob.y+bob.dip,fish:cur.fish,t:0};catchJumpT=0;

  if(dailyChallenge&&!dailyDone){trackDaily(cur.fish,cur.sizeM,combo,hasChain);}
  legendaryEvent=null;
  checkRodUpgrade();     /* #7 */
  checkStreakBonus();    /* #10 */
  checkLuckyCharm();     /* #14 */
  rotateTip();
  playCatchSound(cur.fish); /* #22 */
  updateUI();
  spawnSplash(bob.x,bob.y+bob.dip,'caught',cur.fish.emoji);
}

/* #7 rod upgrade check */
function checkRodUpgrade(){
  const total=sv.total||0;
  const nextRod=RODS[rodLevel+1];
  if(nextRod&&total>=nextRod.reqCatches){
    rodLevel++;sv.rodLevel=rodLevel;
    storeSv();
    spawnFloatText('ROD UPGRADE! '+RODS[rodLevel].name,W/2,WATER_TOP+100,'#92400e');
    buildRodUI();
  }
}

/* #10 streak bonus */
function checkStreakBonus(){
  if(catchStreak>0&&catchStreak%5===0){
    // refill lowest bait
    let lowestIdx=0;
    for(let i=1;i<BAITS.length;i++){if(baitUses[i]<baitUses[lowestIdx])lowestIdx=i;}
    baitUses[lowestIdx]=BAITS[lowestIdx].maxUses;
    spawnFloatText('STREAK x'+catchStreak+'! Bait refilled!',W/2,WATER_TOP+140,'#22c55e');
    buildBaitUI();
  }
}

/* #14 lucky charm - unlocked at 20 total catches */
function checkLuckyCharm(){
  if(!luckyCharm&&(sv.total||0)>=20){
    luckyCharm=true;sv.charm=true;
    storeSv();
    spawnFloatText('Lucky Charm found! +15% rare fish',W/2,WATER_TOP+120,'#c084fc');
    buildRodUI();
  }
}

function trackDaily(fish,sizeM,combo,hasChain){
  if(!dailyChallenge)return;
  const ch=dailyChallenge;
  if(ch.type==='catch_fish'&&fish.name===ch.target){dailyProg.fishCount[fish.name]=(dailyProg.fishCount[fish.name]||0)+1;if(dailyProg.fishCount[fish.name]>=ch.goal){completeDailyChallenge();}}
  if(ch.type==='trophy'&&sizeM.label==='Trophy'){dailyProg.trophyCount++;if(dailyProg.trophyCount>=ch.goal){completeDailyChallenge();}}
  if(ch.type==='legendary'&&fish.legendary){completeDailyChallenge();}
  if(ch.type==='combo'){dailyProg.maxCombo=Math.max(dailyProg.maxCombo,combo);if(dailyProg.maxCombo>=ch.goal){completeDailyChallenge();}}
  if(ch.type==='chain'&&hasChain){dailyProg.chainCount++;if(dailyProg.chainCount>=ch.goal){completeDailyChallenge();}}
}

function completeDailyChallenge(){
  if(dailyDone)return;
  dailyDone=true;score+=500;
  sv.daily=sv.daily||{};sv.daily[dailyChallenge.key]=true;
  storeSv();
  spawnFloatText('DAILY DONE! +500',W/2,WATER_TOP+120,'#f59e0b');
  buildDailyUI();
}

function fishEscaped(){
  if(st!=='bite'&&st!=='reeling')return;
  lossStreak++;combo=0;chainTimer=0;catchStreak=0;
  spawnSplash(bob.x,bob.y,'escape','');
  spawnFloatText(lossStreak>=3?'SO CLOSE...':'Got away!',bob.x,bob.y-50,'#94a3b8');
  setStatus(lossStreak>=3?'Three in a row... something big is coming!':'The fish got away! Try again');
  document.getElementById('lastFish').textContent='Got away...';
  document.getElementById('lastPts').textContent='';
  try{audioFx&&audioFx.playError();}catch{}
  legendaryEvent=null;st='done';updateUI();setTimeout(resetCast,1200);
}

function resetCast(){
  st='idle';bob.show=false;bob.dip=0;cur=null;drag=null;casting=false;charging=false;chargeT=0;reelSwipeStart=null;jumpReveal=null;
  document.getElementById('reelWrap').style.display='none';
  buildLogUI();
  setStatus(lossStreak>=3?'Something legendary is out there... cast now!':'Flick upward to cast again!');
  updateUI();
}

/* ---- simulation ---- */
function step(dt){
  if(charging)chargeT+=dt;
  if(casting){castT+=dt;if(castT>0.55)casting=false;}
  if(chainTimer>0)chainTimer=Math.max(0,chainTimer-dt);
  screenFlash.alpha=Math.max(0,screenFlash.alpha-dt*2.5);

  if(weather==='rain'||weather==='storm'){const rate=weather==='storm'?5:2;for(let i=0;i<rate;i++)weatherPtx.push({x:Math.random()*W,y:-8,vy:weather==='storm'?16:11,vx:(Math.random()-0.5)*1.5,life:1});}
  weatherPtx.forEach(p=>{p.x+=p.vx;p.y+=p.vy*dt*55;p.life-=dt*1.4;});
  weatherPtx=weatherPtx.filter(p=>p.life>0&&p.y<DOCK_TOP);

  if(bob.show&&Math.random()<0.06){
    const bx=bob.x+(Math.random()-0.5)*60,by=bob.y+(Math.random()-0.5)*20;
    bubbles.push({x:bx,y:by,r:1.5+Math.random()*3,vy:-(15+Math.random()*25),life:1});
  }
  bubbles.forEach(b=>{b.y+=b.vy*dt;b.x+=(Math.random()-0.5)*0.8;b.life-=dt*0.8;});
  bubbles=bubbles.filter(b=>b.life>0&&b.y>WATER_TOP);

  if(playing&&Math.random()<dt*0.015&&bgJumps.length<2){
    const jx=100+Math.random()*(W-200),jy=WATER_TOP+(Math.random()*0.3)*(DOCK_TOP-WATER_TOP);
    bgJumps.push({x:jx,y:jy,t:0,fish:FISH[Math.floor(Math.random()*3)]});
  }
  bgJumps.forEach(j=>j.t+=dt);
  bgJumps=bgJumps.filter(j=>j.t<1.4);

  if(legendaryEvent){
    legendaryEvent.timer-=dt;legendaryEvent.pulse+=dt*4;
    if(legendaryEvent.timer<=0){legendaryEvent=null;}
  }

  floatTexts.forEach(ft=>{ft.y-=dt*85;ft.life-=dt*0.9;});
  floatTexts=floatTexts.filter(ft=>ft.life>0);

  /* #19 jump reveal animation */
  if(jumpReveal){catchJumpT+=dt;jumpReveal.t=catchJumpT;}

  if(st==='flying'){
    fly.t+=dt;
    if(fly.t>=fly.dur){
      bob.show=true;st='waiting';
      spawnSplash(bob.x,bob.y,'splash','');
      spawnWaterRings(bob.x,bob.y);
      setStatus('Waiting for a bite...');
      const near=cfg().hotspots.find(h=>Math.hypot(bob.x-h.x,bob.y-h.y)<h.r);
      let f,sizeKey,sizeM;
      if(legendaryEvent&&!legendaryEvent.triggered&&Math.hypot(bob.x-legendaryEvent.x,bob.y-legendaryEvent.y)<80){
        legendaryEvent.triggered=true;f=LEGENDARY;sizeKey='normal';sizeM=SIZE_TABLE.normal;
        setStatus('THE WATER IS TREMBLING...');
      } else {
        let pool=[...cfg().fishPool];
        if(near)pool=[...pool,...pool.slice(-2)];
        if(bait===1)pool=pool.map(x=>Math.min(x+1,FISH.length-1));
        if(bait===2)pool=pool.map(x=>Math.max(0,x-1));
        /* #8 seasonal fish: 10% chance to swap lowest fish for seasonal */
        const rod=RODS[rodLevel];
        /* #14 lucky charm boosts rare index */
        if(luckyCharm&&Math.random()<0.15)pool=pool.map(x=>Math.min(x+1,FISH.length-1));
        let fi=lossStreak>=3?Math.max(...cfg().fishPool):pool[Math.floor(Math.random()*pool.length)];
        /* 10% seasonal fish chance */
        if(Math.random()<0.10){f=getSeasonalFish();}
        else{f=FISH[fi];}
        const sr=Math.random();
        sizeKey=sr<0.2?'small':sr>0.85?'trophy':'normal';
        sizeM=SIZE_TABLE[sizeKey];
      }
      const wt=(f.wait[0]+Math.random()*(f.wait[1]-f.wait[0]))*BAITS[bait].waitMult*(weather==='rain'?0.75:weather==='storm'?0.55:1)*(near?0.65:1);
      /* #4 multi-bob: 2-3 bobs before reel triggers */
      nibBobs=0;nibBobTarget=2+Math.floor(Math.random()*2);
      cur={fish:f,waitLeft:wt,nibLeft:0,reelProg:0,escTimer:null,direction:null,dirTimer:0,tension:0,lastTapMs:0,size:sizeKey,sizeM,shadowDist:260,shadowAngle:Math.random()*Math.PI*2};
    }
  }

  if(st==='waiting'&&cur){
    cur.waitLeft-=dt;
    cur.shadowDist=Math.max(0,cur.shadowDist-dt*48);
    cur.shadowAngle+=dt*(0.6+cur.fish.shadowR*0.012);
    if(cur.waitLeft<=0.6&&cur.waitLeft>0&&cur.shadowDist<60){setStatus('Get ready...');}
    if(cur.waitLeft<=0){st='nibble';cur.nibLeft=0.4+Math.random()*0.4;setStatus('Something is nibbling...');}
  }

  if(st==='nibble'&&cur){
    cur.nibLeft-=dt;
    /* #4 multi-bob: each bob cycle adds a count */
    bob.dip=Math.abs(Math.sin(performance.now()/110))*14;
    const bobPhase=Math.floor(performance.now()/320)%2;
    if(bobPhase===0&&cur._lastBobPhase===1){nibBobs++;cur._lastBobPhase=0;}
    else if(bobPhase===1){cur._lastBobPhase=1;}
    if(cur.nibLeft<=0.25&&cur.nibLeft>0){setStatus('INCOMING - GET READY!');}
    if(cur.nibLeft<=0){
      if(nibBobs<nibBobTarget){
        // extra bob - reset nibble timer
        cur.nibLeft=0.3+Math.random()*0.3;
        setStatus('Almost... get ready!');
        return;
      }
      st='bite';setStatus('BITE! Tap to reel in!');bob.dip=22;
      try{audioFx&&audioFx.playPop();}catch{}
      const escMs=(cur.fish.esc*1000+400)*(weather==='storm'?0.6:weather==='rain'?0.8:1);
      cur.escTimer=setTimeout(fishEscaped,escMs);
    }
  }

  if(st==='reeling'&&cur){
    cur.reelProg=Math.max(0,(cur.reelProg||0)-cur.fish.drain*dt);
    if(cur.reelProg<=0){fishEscaped();return;}
    cur.tension=Math.max(0,(cur.tension||0)-dt*0.35);
    cur.dirTimer-=dt;
    if(cur.dirTimer<=0){cur.direction=Math.random()<0.5?'left':'right';cur.dirTimer=1.0+Math.random()*1.6;}
    /* #23 tension sound */
    if(cur.tension>0.75){tensionBeepT+=dt;if(tensionBeepT>0.3){playTensionBeep();tensionBeepT=0;}}
    else{tensionBeepT=0;}
  }

  if(st==='catchReveal'){
    revealT+=dt;
    if(revealT>2.6){
      st='done';
      /* #24 record score to leaderboard */
      saveDailyScore();
      if(caught>=cfg().target)setTimeout(levelComplete,300);
      else setTimeout(resetCast,300);
    }
  }

  for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=0.09;p.life-=dt*(p.dec||0.7);}
}

/* #24 save to daily board */
function saveDailyScore(){
  const board=sv.dailyBoard||[];
  board.push({date:new Date().toDateString(),score,level:cfg().name,time:Date.now()});
  // keep last 50
  board.sort((a,b)=>b.score-a.score);
  sv.dailyBoard=board.slice(0,50);
  storeSv();
}

/* #22 fish-specific catch sound */
function playCatchSound(fish){
  try{
    if(!audioFx)return;
    if(fish.legendary){audioFx.playLevelUp();audioFx.playLevelUp();}
    else if(fish.pts>=600){audioFx.playLevelUp();}
    else if(fish.pts>=250){audioFx.playLevelUp();}
    else{audioFx.playPop();audioFx.playPop();}
  }catch{}
}

/* #23 tension beep using Web Audio API */
function playTensionBeep(){
  try{
    const ctx2=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx2.createOscillator();const g=ctx2.createGain();
    osc.connect(g);g.connect(ctx2.destination);
    osc.frequency.value=880;g.gain.value=0.08;
    osc.start();osc.stop(ctx2.currentTime+0.06);
    g.gain.exponentialRampToValueAtTime(0.001,ctx2.currentTime+0.06);
  }catch{}
}

/* #21 ambient soundscape - gentle procedural tones */
function startAmbient(){
  stopAmbient();
  try{
    const actx=new(window.AudioContext||window.webkitAudioContext)();
    function chirp(){
      if(!playing)return;
      const o=actx.createOscillator(),g=actx.createGain();
      o.connect(g);g.connect(actx.destination);
      o.frequency.value=800+Math.random()*400;
      o.type='sine';
      g.gain.value=0;
      const start=actx.currentTime;
      g.gain.linearRampToValueAtTime(0.03,start+0.05);
      g.gain.linearRampToValueAtTime(0,start+0.3);
      o.start(start);o.stop(start+0.35);
      setTimeout(chirp,2000+Math.random()*4000);
    }
    setTimeout(chirp,1500);
    ambientNode=actx;
  }catch{}
}
function stopAmbient(){
  try{if(ambientNode){ambientNode.close();ambientNode=null;}}catch{}
}

/* ---- drawing ---- */
function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);}
window.addEventListener('resize',resize);

function draw(){
  if(lv===undefined)return;
  resize();
  const cw=canvas.clientWidth,ch=canvas.clientHeight,sx=cw/W,sy=ch/H;
  ctx.clearRect(0,0,cw,ch);
  ctx.save();ctx.scale(sx,sy);
  drawScene();
  drawWeather();
  drawBgJumps();
  if(st==='waiting'||st==='nibble')drawFishShadow();
  drawBubbles();
  if(bob.show)drawFishingLine();
  if(st==='flying')drawFlyingBobber();
  if(bob.show)drawBobber();
  drawRod();
  if(drag&&(st==='idle'||charging))drawAimArc();
  if(legendaryEvent&&!legendaryEvent.triggered)drawLegendaryEvent();
  if(st==='bite'||st==='reeling')drawReelPhase();
  /* #19 jump reveal */
  if(jumpReveal&&jumpReveal.t<0.55)drawJumpReveal();
  if(st==='catchReveal'&&revealData)drawCatchReveal();
  drawChainTimer();
  drawFloatTexts();
  drawParticles();
  if(screenFlash.alpha>0)drawScreenFlash();
  ctx.restore();
}

/* #17 time-of-day sky tint */
function drawTimeOfDayTint(){
  const tod=getTimeOfDay();
  let tintCol=null,tintAlpha=0;
  if(tod<0.1){tintCol='#0f172a';tintAlpha=0.35;}        // night
  else if(tod<0.25){tintCol='#f97316';tintAlpha=(0.25-tod)/0.15*0.18;} // dawn
  else if(tod>0.9){tintCol='#312e81';tintAlpha=(tod-0.9)/0.1*0.25;}    // evening
  else if(tod>0.75){tintCol='#f97316';tintAlpha=(tod-0.75)/0.15*0.12;} // dusk
  if(tintCol&&tintAlpha>0.01){
    ctx.save();ctx.globalAlpha=tintAlpha;ctx.fillStyle=tintCol;ctx.fillRect(0,0,W,H);ctx.restore();
  }
}

/* #20 seasonal dock decoration */
function drawSeasonalDecor(){
  const season=getSeason();
  const t=performance.now()/1000;
  if(season==='winter'){
    // snowflakes on dock
    ctx.save();ctx.fillStyle='rgba(255,255,255,0.7)';
    for(let i=0;i<18;i++){const sx=(i*57+Math.sin(i*1.9+t*0.08)*18)%W,sy=DOCK_TOP+5+Math.sin(i*2.3)*12;ctx.globalAlpha=0.4+Math.sin(i+t*0.2)*0.3;ctx.beginPath();ctx.arc(sx,sy,2+Math.sin(i)*1,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }else if(season==='autumn'){
    // falling leaves
    ctx.save();
    const leaves=['🍂','🍁'];
    for(let i=0;i<6;i++){const lx=(i*155+t*18*(0.5+i*0.1))%W,ly=WATER_TOP-80+(Math.sin(t*0.4+i)*40),la=0.4+Math.sin(i+t*0.5)*0.3;
      ctx.globalAlpha=la;ctx.font='14px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(leaves[i%2],lx,ly);}
    ctx.restore();
  }else if(season==='spring'){
    // petals
    ctx.save();
    for(let i=0;i<8;i++){const px=(i*120+t*22*(0.4+i*0.08))%W,py=WATER_TOP-60+(Math.sin(t*0.5+i*1.3)*30);
      ctx.globalAlpha=0.35+Math.sin(i+t*0.4)*0.2;ctx.font='12px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('🌸',px,py);}
    ctx.restore();
  }
}

function drawScene(){
  const pal=cfg().pal;
  const skyG=ctx.createLinearGradient(0,0,0,WATER_TOP+40);skyG.addColorStop(0,pal.sky0);skyG.addColorStop(1,pal.sky1);
  ctx.fillStyle=skyG;ctx.fillRect(0,0,W,WATER_TOP+40);
  if(cfg().dec==='morning'){ctx.save();const sg=ctx.createRadialGradient(720,80,0,720,80,96);sg.addColorStop(0,'rgba(255,245,100,1)');sg.addColorStop(0.38,'rgba(255,220,50,0.65)');sg.addColorStop(1,'rgba(255,210,0,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(720,80,96,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.88;ctx.fillStyle='#fef08a';ctx.beginPath();ctx.arc(720,80,38,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(cfg().dec==='golden'){ctx.save();const sg=ctx.createRadialGradient(760,90,0,760,90,110);sg.addColorStop(0,'rgba(249,115,22,1)');sg.addColorStop(0.4,'rgba(234,88,12,0.55)');sg.addColorStop(1,'rgba(234,88,12,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(760,90,110,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.85;ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(760,90,46,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(cfg().dec==='morning'||cfg().dec==='lily')drawClouds();
  drawTrees(pal.trees);
  const waterG=ctx.createLinearGradient(0,WATER_TOP,0,DOCK_TOP);waterG.addColorStop(0,pal.water0);waterG.addColorStop(1,pal.water1);
  ctx.fillStyle=waterG;ctx.fillRect(0,WATER_TOP-10,W,DOCK_TOP-WATER_TOP+20);
  ctx.save();const sheenG=ctx.createLinearGradient(0,WATER_TOP-4,0,WATER_TOP+52);sheenG.addColorStop(0,'rgba(255,255,255,0.22)');sheenG.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=sheenG;ctx.fillRect(0,WATER_TOP-4,W,56);ctx.restore();
  ctx.save();ctx.globalAlpha=0.28;const hazeG=ctx.createLinearGradient(0,WATER_TOP-20,0,WATER_TOP+70);hazeG.addColorStop(0,pal.haze);hazeG.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=hazeG;ctx.fillRect(0,WATER_TOP-20,W,90);ctx.restore();
  drawRipples(pal);
  if(cfg().dec==='lily')drawLilyPads();
  else if(cfg().dec==='rocky')drawRocks();
  else if(cfg().dec==='golden')drawGoldenShimmer();
  drawHotspots(pal);
  drawDock();
  drawSeasonalDecor();  /* #20 */
  drawTimeOfDayTint();  /* #17 */
  if(weather==='storm'){ctx.save();ctx.globalAlpha=0.12;ctx.fillStyle='#312e81';ctx.fillRect(0,0,W,H);ctx.restore();}
}

function drawClouds(){
  const t=performance.now()/1000;
  const clouds=[{x:120,y:60,w:140,h:45,spd:3.5},{x:380,y:40,w:110,h:38,spd:5},{x:600,y:75,w:90,h:32,spd:2.8}];
  ctx.save();ctx.fillStyle='rgba(255,255,255,0.72)';
  for(const c of clouds){const cx=((c.x+t*c.spd)%(W+200))-100;ctx.beginPath();ctx.ellipse(cx,c.y,c.w/2,c.h/2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(cx+c.w*0.22,c.y-c.h*0.2,c.w*0.35,c.h*0.6,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(cx-c.w*0.2,c.y-c.h*0.1,c.w*0.3,c.h*0.5,0,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function drawTrees(col){
  ctx.save();
  // Back row - distant, smaller, lighter
  for(let i=0;i<30;i++){const x=i*32+10+Math.sin(i*2.1)*7,h=32+Math.abs(Math.sin(i*1.3))*26;ctx.fillStyle=col;ctx.globalAlpha=0.28+Math.sin(i*1.9)*0.07;ctx.beginPath();ctx.moveTo(x,WATER_TOP-2);ctx.lineTo(x+15,WATER_TOP-h*0.5);ctx.lineTo(x+3,WATER_TOP-h);ctx.lineTo(x-10,WATER_TOP-h*0.5);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(x+3,WATER_TOP-h*1.28);ctx.lineTo(x+10,WATER_TOP-h*0.65);ctx.lineTo(x-7,WATER_TOP-h*0.65);ctx.closePath();ctx.fill();}
  // Front row
  for(let i=0;i<22;i++){const x=i*43+5+Math.sin(i*1.7)*8,h=55+Math.abs(Math.sin(i*0.9))*45;ctx.fillStyle=col;ctx.globalAlpha=0.65+Math.sin(i*1.3)*0.15;ctx.beginPath();ctx.moveTo(x,WATER_TOP-2);ctx.lineTo(x+22,WATER_TOP-h*0.5);ctx.lineTo(x+5,WATER_TOP-h);ctx.lineTo(x-12,WATER_TOP-h*0.5);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(x+5,WATER_TOP-h*1.3);ctx.lineTo(x+16,WATER_TOP-h*0.65);ctx.lineTo(x-8,WATER_TOP-h*0.65);ctx.closePath();ctx.fill();}
  ctx.restore();
}

function drawRipples(pal){
  const t=performance.now()/1000;ctx.save();ctx.lineWidth=1.5;
  for(let i=0;i<9;i++){const y=WATER_TOP+25+i*68,spd=18+(i%3)*8,ph=i*0.6,a=0.13+Math.sin(t*0.7+i*0.5)*0.05+(i<3?0.12:0);ctx.strokeStyle=`rgba(255,255,255,${a})`;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=W;x+=14)ctx.lineTo(x,y+Math.sin(x*0.035+t*spd+ph)*5);ctx.stroke();}
  for(let i=0;i<20;i++){const sx=45+i*47+Math.sin(i*2.3+t*0.35)*28,sy=WATER_TOP+10+Math.sin(i*1.7+t*0.55)*9,sp=Math.sin(t*2.8+i*1.1)*0.5+0.5;if(sp>0.6){ctx.globalAlpha=sp*0.6;ctx.fillStyle='rgba(255,255,255,0.9)';ctx.beginPath();ctx.arc(sx,sy,1.4+sp,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
}

function drawHotspots(pal){
  const t=performance.now()/1000;
  for(const h of cfg().hotspots){
    const pulse=0.08+Math.sin(t*1.4+h.x*0.01)*0.05;
    ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle=pal.haze;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(h.x,h.y,h.r,h.r*0.38,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=pulse*0.4;ctx.beginPath();ctx.ellipse(h.x,h.y,h.r*0.6,h.r*0.24,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    ctx.save();ctx.globalAlpha=0.07+Math.sin(t*0.8+h.x)*0.04;ctx.fillStyle='#1e293b';
    for(let j=0;j<3;j++){const fx=h.x+Math.sin(t*0.6+j*2.1)*h.r*0.5,fy=h.y+Math.cos(t*0.4+j*1.7)*h.r*0.2;ctx.beginPath();ctx.ellipse(fx,fy,10,5,Math.sin(t+j)*0.4,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
}

function drawLilyPads(){
  const pads=[{x:195,y:530},{x:360,y:490},{x:505,y:565},{x:685,y:508},{x:755,y:582},{x:280,y:600},{x:620,y:450}];
  for(const p of pads){ctx.save();ctx.globalAlpha=0.88;ctx.fillStyle='#15803d';ctx.beginPath();ctx.arc(p.x,p.y,22,0.15,Math.PI*2-0.15);ctx.closePath();ctx.fill();ctx.fillStyle='#166534';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,22,0,0.15);ctx.closePath();ctx.fill();ctx.fillStyle='#f9a8d4';ctx.beginPath();ctx.arc(p.x+5,p.y-6,6,0,Math.PI*2);ctx.fill();ctx.restore();}
}

function drawRocks(){
  const rocks=[{x:95,y:600,rx:50,ry:28},{x:800,y:570,rx:58,ry:32},{x:155,y:445,rx:30,ry:18},{x:770,y:425,rx:38,ry:22},{x:400,y:650,rx:28,ry:14}];
  for(const r of rocks){ctx.save();ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(r.x+5,r.y+8,r.rx,r.ry*0.55,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4b5563';ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx,r.ry,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6b7280';ctx.beginPath();ctx.ellipse(r.x-r.rx*0.2,r.y-r.ry*0.3,r.rx*0.65,r.ry*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();}
}

function drawGoldenShimmer(){
  const t=performance.now()/1000;ctx.save();ctx.globalAlpha=0.1+Math.sin(t*1.2)*0.06;
  const g=ctx.createRadialGradient(450,480,20,450,480,200);g.addColorStop(0,'#fbbf24');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.fillRect(0,WATER_TOP,W,DOCK_TOP-WATER_TOP);
  ctx.globalAlpha=0.4+Math.sin(t*3)*0.2;ctx.fillStyle='#fef08a';
  for(let i=0;i<5;i++){const sx=350+Math.sin(t*0.7+i*1.3)*120,sy=430+Math.cos(t*0.5+i*2.1)*80;ctx.beginPath();ctx.arc(sx,sy,2+Math.sin(t*2+i)*1.2,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function drawDock(){
  ctx.fillStyle='#78350f';ctx.fillRect(0,DOCK_TOP,W,H-DOCK_TOP);
  for(let i=0;i<13;i++){ctx.fillStyle=i%2===0?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)';ctx.fillRect(i*75,DOCK_TOP,74,H-DOCK_TOP);}
  ctx.strokeStyle='#92400e';ctx.lineWidth=2.5;for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(0,DOCK_TOP+i*17);ctx.lineTo(W,DOCK_TOP+i*17);ctx.stroke();}
  ctx.strokeStyle='#451a03';ctx.lineWidth=1.5;for(let i=0;i<13;i++){ctx.beginPath();ctx.moveTo(i*75,DOCK_TOP);ctx.lineTo(i*75,H);ctx.stroke();}
  ctx.save();const sh=ctx.createLinearGradient(0,DOCK_TOP-18,0,DOCK_TOP+8);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,0.35)');ctx.fillStyle=sh;ctx.fillRect(0,DOCK_TOP-18,W,26);ctx.restore();
}

function drawWeather(){
  if(!weatherPtx.length)return;
  ctx.save();ctx.strokeStyle=weather==='storm'?'rgba(180,200,255,0.55)':'rgba(170,210,255,0.4)';ctx.lineWidth=weather==='storm'?2:1.5;
  for(const p of weatherPtx){ctx.globalAlpha=Math.max(0,p.life)*0.9;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.vx*2,p.y-5);ctx.stroke();}ctx.restore();
}

function drawBgJumps(){
  for(const j of bgJumps){
    if(j.t>1.2)continue;
    const jy=j.y-Math.sin(Math.min(1,j.t/0.8)*Math.PI)*70;
    const alpha=j.t<0.6?1:1-(j.t-0.6)/0.6;
    ctx.save();ctx.globalAlpha=alpha*0.5;ctx.font='24px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(j.fish.emoji,j.x,jy);
    if(j.t<0.1||Math.abs(j.t-0.8)<0.05){ctx.font='14px system-ui,sans-serif';ctx.fillText('💧',j.x+8,j.y+5);}
    ctx.restore();
  }
}

function drawBubbles(){
  ctx.save();
  for(const b of bubbles){
    const a=Math.max(0,b.life)*0.45;
    ctx.globalAlpha=a;ctx.strokeStyle='rgba(180,220,255,0.9)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=a*0.2;ctx.fillStyle='rgba(200,240,255,1)';ctx.beginPath();ctx.arc(b.x-b.r*0.3,b.y-b.r*0.3,b.r*0.4,0,Math.PI*2);ctx.fill();
  }ctx.restore();
}

function drawFishShadow(){
  if(!cur||!bob.show)return;
  const t=performance.now()/1000;
  const dist=cur.shadowDist||0;
  if(dist>240)return;
  const alpha=Math.max(0,Math.min(0.4,(240-dist)/180));
  const sx=bob.x+Math.cos(cur.shadowAngle||0)*dist*0.6;
  const sy=bob.y+Math.sin(cur.shadowAngle||0)*dist*0.25;
  const r=cur.fish.shadowR*(cur.sizeM?.reel||1)*0.9;
  ctx.save();
  if(cur.fish.legendary){ctx.shadowColor='#c084fc';ctx.shadowBlur=18;}
  ctx.globalAlpha=alpha;ctx.fillStyle=cur.fish.legendary?'rgba(192,132,252,0.5)':'rgba(0,10,30,0.7)';
  ctx.beginPath();ctx.ellipse(sx,sy,r*1.8,r*0.75,Math.sin(t*0.4)*0.3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx-r*1.4,sy,r*0.5,r*0.3,Math.sin(t*2)*0.4,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawLegendaryEvent(){
  if(!legendaryEvent)return;
  const t=performance.now()/1000;
  const {x,y,pulse}=legendaryEvent;
  const pAlpha=0.3+Math.sin(pulse)*0.25;
  ctx.save();
  ctx.globalAlpha=pAlpha;ctx.strokeStyle='#c084fc';ctx.lineWidth=3;
  for(let i=0;i<3;i++){const r=50+i*22+Math.sin(pulse+i)*8;ctx.beginPath();ctx.ellipse(x,y,r,r*0.4,0,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=pAlpha*0.5;ctx.fillStyle='#c084fc';
  for(let i=0;i<6;i++){const angle=i*Math.PI/3+t,r=48+Math.sin(t*2+i)*6;ctx.beginPath();ctx.arc(x+Math.cos(angle)*r,y+Math.sin(angle)*r*0.4,3,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=pAlpha;ctx.fillStyle='#e9d5ff';ctx.font='bold 15px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('LEGENDARY WATERS',x,y-62);
  ctx.restore();
}

function drawChainTimer(){
  if(chainTimer<=0||st==='catchReveal')return;
  const frac=chainTimer/20;
  const cx=W-70,cy=WATER_TOP-30;
  ctx.save();ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.arc(cx,cy,22,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=frac>0.4?'#22c55e':'#ef4444';ctx.beginPath();ctx.arc(cx,cy,22,-Math.PI/2,-Math.PI/2+frac*Math.PI*2,false);ctx.stroke();
  ctx.globalAlpha=0.9;ctx.fillStyle='#fff';ctx.font='bold 13px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('CHAIN',cx,cy-6);ctx.fillText(Math.ceil(chainTimer)+'s',cx,cy+9);
  ctx.restore();
}

/* #19 fish jump-out celebration before reveal card */
function drawJumpReveal(){
  if(!jumpReveal)return;
  const q=Math.min(1,jumpReveal.t/0.5);
  const jy=jumpReveal.y-Math.sin(q*Math.PI)*180;
  const jx=jumpReveal.x+(W/2-jumpReveal.x)*q*0.3;
  ctx.save();
  ctx.globalAlpha=Math.sin(q*Math.PI)*0.95;
  ctx.font=Math.round(40+q*20)+'px system-ui,sans-serif';
  ctx.textAlign='center';
  ctx.fillText(jumpReveal.fish.emoji,jx,jy);
  // splash rings at origin
  if(q<0.3){const rr=q/0.3;ctx.globalAlpha=(1-rr)*0.5;ctx.strokeStyle='#93c5fd';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(jumpReveal.x,jumpReveal.y,rr*60,rr*20,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

function rodTip(){
  if(casting){const q=Math.min(1,castT/0.5),whip=Math.sin(q*Math.PI);return{x:488+whip*55,y:748-whip*140};}
  if(st==='reeling'&&cur){const tension=Math.max(0,1-(cur.reelProg||0)/(cur.fish.reel*cur.sizeM.reel));return{x:488-tension*30,y:748+tension*88};}
  if(st==='bite')return{x:472,y:802};
  if(charging){const p=Math.min(1,chargeT/1.4);return{x:488-p*12,y:748+p*30};}
  return{x:488,y:748};
}

function drawRod(){
  const tip=rodTip(),base=ROD_BASE;
  ctx.save();ctx.globalAlpha=0.28;ctx.strokeStyle='#000';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base.x+6,base.y+6);ctx.lineTo(tip.x+6,tip.y+6);ctx.stroke();ctx.restore();
  const sections=[{t:0,e:0.4,w:14},{t:0.4,e:0.72,w:8},{t:0.72,e:1,w:3.5}];
  for(const s of sections){
    const x0=base.x+(tip.x-base.x)*s.t,y0=base.y+(tip.y-base.y)*s.t,x1=base.x+(tip.x-base.x)*s.e,y1=base.y+(tip.y-base.y)*s.e;
    const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#92400e');g.addColorStop(1,'#c8a97e');
    ctx.strokeStyle=g;ctx.lineWidth=s.w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
  }
  /* #7 pro rod glow */
  if(rodLevel>=2){ctx.save();ctx.globalAlpha=0.25;ctx.strokeStyle='#c084fc';ctx.lineWidth=14;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.restore();}
  if(charging&&chargeT>0.3){const p=Math.min(1,chargeT/1.4);ctx.save();ctx.globalAlpha=p*0.5;ctx.strokeStyle='#38bdf8';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.restore();}
  ctx.strokeStyle='#e2e8f0';ctx.lineWidth=2.5;for(let i=0;i<4;i++){const q=0.3+i*0.17,rx=base.x+(tip.x-base.x)*q,ry=base.y+(tip.y-base.y)*q,rr=5-i;ctx.beginPath();ctx.arc(rx,ry,rr,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#1c0a00';ctx.beginPath();ctx.roundRect(base.x-14,base.y-32,28,72,8);ctx.fill();
  ctx.fillStyle='#2d1200';for(let i=0;i<6;i++){ctx.beginPath();ctx.roundRect(base.x-13,base.y-26+i*10,26,6,3);ctx.fill();}
  ctx.fillStyle='#374151';ctx.beginPath();ctx.arc(base.x,base.y+18,17,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#6b7280';ctx.beginPath();ctx.arc(base.x,base.y+18,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9ca3af';ctx.beginPath();ctx.arc(base.x,base.y+18,4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#9ca3af';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(base.x+10,base.y+18);ctx.lineTo(base.x+22,base.y+8);ctx.stroke();
  ctx.fillStyle='#d1d5db';ctx.beginPath();ctx.arc(base.x+22,base.y+8,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#d4a07a';ctx.beginPath();ctx.ellipse(base.x+6,base.y+48,23,13,0.25,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(base.x-5,base.y+60,23,12,-0.2,0,Math.PI*2);ctx.fill();
}

function drawFishingLine(){
  if(!bob.show)return;
  const tip=rodTip(),bx=bob.x,by=bob.y+bob.dip;
  const taut=st==='reeling'&&cur?Math.max(0,1-(cur.reelProg||0)/(cur.fish.reel*cur.sizeM.reel)):0;
  ctx.save();ctx.strokeStyle=`rgba(210,210,210,${0.55+taut*0.3})`;ctx.lineWidth=1.5+taut*2;
  ctx.beginPath();ctx.moveTo(tip.x,tip.y);const mx=(tip.x+bx)/2+8*(1-taut),my=(tip.y+by)/2+25*(1-taut);ctx.quadraticCurveTo(mx,my,bx,by);ctx.stroke();ctx.restore();
}

function drawFlyingBobber(){
  const q=Math.min(1,fly.t/fly.dur),eq=q<0.5?2*q*q:(1-Math.pow(-2*q+2,2)/2);
  const bx=fly.x0+(fly.x1-fly.x0)*eq;
  const dist=Math.hypot(fly.x1-fly.x0,fly.y1-fly.y0),arcH=Math.min(320,dist*0.6+100);
  const by=fly.y0+(fly.y1-fly.y0)*eq-Math.sin(q*Math.PI)*arcH;
  const tip=rodTip();
  ctx.save();ctx.strokeStyle='rgba(200,200,200,0.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(tip.x,tip.y);ctx.lineTo(bx,by);ctx.stroke();ctx.restore();
  drawBobberAt(bx,by,0,false);
}

function drawBobber(){
  if(!bob.show)return;
  const t=performance.now();
  const wobble=st==='waiting'?Math.sin(t/420)*2.5:0;
  const nibWobble=st==='nibble'?Math.sin(t/80)*12:0;
  const reelWobble=st==='reeling'?Math.sin(t/55)*9+(Math.random()<0.03?-14:0):0;
  const biteDip=st==='bite'?Math.sin(t/70)*8:0;
  drawBobberAt(bob.x,bob.y+bob.dip+wobble+nibWobble+reelWobble+biteDip,bob.dip,true);
  if(st==='reeling'&&Math.random()<0.07)spawnSplash(bob.x+(Math.random()-0.5)*20,bob.y+bob.dip,'splash','');
}

function drawBobberAt(x,y,dip,inWater){
  if(inWater){
    ctx.save();ctx.globalAlpha=0.28+Math.sin(performance.now()/350)*0.09;ctx.strokeStyle='#93c5fd';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y+2,22,8,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=0.12;ctx.beginPath();ctx.ellipse(x,y+2,38,13,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  ctx.save();ctx.globalAlpha=0.22;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x+3,y+7,9,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle='#dc2626';ctx.beginPath();ctx.arc(x,y+4,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(x,y-2,9,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-9,y+1);ctx.lineTo(x+9,y+1);ctx.stroke();
  ctx.strokeStyle='#78350f';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y-11);ctx.lineTo(x,y-28);ctx.stroke();
  ctx.fillStyle='#dc2626';ctx.beginPath();ctx.arc(x,y-28,3.5,0,Math.PI*2);ctx.fill();
  if(st==='nibble'){const f=0.5+Math.sin(performance.now()/75)*0.45;ctx.save();ctx.globalAlpha=f;ctx.strokeStyle='#fb923c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(st==='bite'){const f=0.5+Math.sin(performance.now()/75)*0.45;ctx.save();ctx.globalAlpha=f;ctx.strokeStyle='#fbbf24';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.stroke();ctx.restore();}
}

function drawAimArc(){
  if(!drag)return;
  const dx=drag.cx-drag.sx,dy=drag.sy-drag.cy;if(dy<30)return;
  const rod=RODS[rodLevel];
  const flickPow=Math.min(1,Math.hypot(dx,dy)/340),chargePow=Math.min(1,chargeT/1.4);
  const power=Math.min(1,(flickPow*0.65+chargePow*0.45)*rod.castMult);
  const side=Math.max(-1,Math.min(1,dx/270));
  const depth=Math.max(0.08,Math.min(0.9,0.15+power*0.8));
  const lx=Math.max(90,Math.min(810,450+side*300)),ly=WATER_TOP+30+(1-depth)*(DOCK_TOP-WATER_TOP-110);
  const tip=rodTip(),dist=Math.hypot(lx-tip.x,ly-tip.y),arcH=Math.min(320,dist*0.6+100);
  ctx.save();ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=2.5;ctx.setLineDash([10,8]);
  ctx.beginPath();
  for(let i=0;i<=22;i++){const q=i/22,eq=q<0.5?2*q*q:(1-Math.pow(-2*q+2,2)/2);const px=tip.x+(lx-tip.x)*eq,py=tip.y+(ly-tip.y)*eq-Math.sin(q*Math.PI)*arcH;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}
  ctx.stroke();ctx.setLineDash([]);
  ctx.globalAlpha=0.5+power*0.35;ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(lx,ly,28+power*14,11+power*5,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=0.15+power*0.1;ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.ellipse(lx,ly,28+power*14,11+power*5,0,0,Math.PI*2);ctx.fill();
  const rawPow=flickPow*0.65+chargePow*0.45;
  const label=(charging&&chargeT>0.2?'! ':'')+(Math.round(rawPow*100))+'%'+(rodLevel>0?' '+RODS[rodLevel].emoji:'');
  ctx.globalAlpha=0.95;ctx.fillStyle=charging&&chargePow>0.5?'#38bdf8':'#fff';ctx.font='bold 20px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(label,lx,ly-20);
  ctx.restore();
}

function drawReelPhase(){
  if(!cur)return;
  const prog=Math.min(1,Math.max(0,(cur.reelProg||0)/(cur.fish.reel*cur.sizeM.reel)));
  const tension=cur.tension||0;
  const t=performance.now()/1000;
  ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,WATER_TOP,W,DOCK_TOP-WATER_TOP);ctx.restore();
  const bx=145,by=800,bw=610,bh=46;
  const fillX=bx+bw*prog;
  ctx.save();ctx.globalAlpha=0.4;ctx.fillStyle='rgba(0,0,0,0.5)';ctx.beginPath();ctx.roundRect(bx+4,by+4,bw,bh,23);ctx.fill();ctx.restore();
  ctx.save();ctx.globalAlpha=0.88;ctx.fillStyle='rgba(15,20,30,0.75)';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,23);ctx.fill();
  if(prog>0.01){
    const col=prog>0.6?'#22c55e':prog>0.3?'#f59e0b':'#ef4444';
    ctx.save();ctx.beginPath();ctx.roundRect(bx,by,bw,bh,23);ctx.clip();
    ctx.fillStyle=col;ctx.fillRect(bx,by,bw*prog,bh);
    ctx.globalAlpha=0.22+Math.sin(t*6)*0.1;ctx.fillStyle='#fff';ctx.fillRect(bx,by+8,bw*prog,6);
    ctx.restore();
  }
  ctx.globalAlpha=0.6;ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,23);ctx.stroke();ctx.restore();
  const fishBob=Math.sin(t*9)*6+(cur.fish.legendary?Math.sin(t*20)*4:0);
  const fishFaceX=Math.max(bx+20,Math.min(bx+bw-20,fillX+10));
  ctx.save();ctx.font=(cur.fish.legendary?42:34)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(cur.fish.emoji,fishFaceX,by+bh/2+12+fishBob);
  if(cur.fish.legendary){ctx.globalAlpha=0.4+Math.sin(t*4)*0.3;ctx.strokeStyle='#c084fc';ctx.lineWidth=3;ctx.beginPath();ctx.arc(fishFaceX,by+bh/2+fishBob,24,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  const tbx=bx+40,tbw=bw-80,tbh=10,tby=by-26;
  ctx.save();ctx.globalAlpha=0.7;ctx.fillStyle='rgba(0,0,0,0.4)';ctx.beginPath();ctx.roundRect(tbx,tby,tbw,tbh,5);ctx.fill();
  const tCol=tension>0.75?'#ef4444':tension>0.45?'#f59e0b':'#22c55e';
  ctx.fillStyle=tCol;ctx.beginPath();ctx.roundRect(tbx,tby,tbw*tension,tbh,5);ctx.fill();
  if(tension>0.8){const snap=0.6+Math.sin(t*18)*0.4;ctx.globalAlpha=snap*0.8;ctx.font='bold 14px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='#ef4444';ctx.fillText('EASE UP!',bx+bw/2,tby-6);}
  else{ctx.globalAlpha=0.5;ctx.font='11px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('LINE TENSION',bx+bw/2,tby-5);}
  ctx.restore();
  if(st==='reeling'&&cur.direction){
    const ap=0.75+Math.sin(t*8)*0.25;ctx.save();ctx.globalAlpha=ap;ctx.fillStyle='#fbbf24';ctx.font='bold 52px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(cur.direction==='left'?'<--':'-->',W/2,by+bh+70);ctx.font='bold 16px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.8)';ctx.fillText('SWIPE '+cur.direction.toUpperCase(),W/2,by+bh+92);ctx.restore();
  }
  const lbl=st==='bite'?'TAP!':'REEL!';
  const lblFlash=0.78+Math.sin(t*(st==='bite'?10:5))*0.22;
  ctx.save();ctx.globalAlpha=lblFlash;ctx.fillStyle=cur.fish.legendary?'#c084fc':st==='bite'?'#fbbf24':'#ffffff';ctx.font='bold 44px system-ui,sans-serif';ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=8;ctx.fillText(lbl,W/2,by-50);ctx.restore();
  const sizeLbl=cur.sizeM.label?' · '+cur.sizeM.label:'';
  ctx.save();ctx.globalAlpha=0.65;ctx.fillStyle=cur.fish.legendary?'#e9d5ff':'#e2e8f0';ctx.font='bold 18px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(cur.fish.emoji+' '+cur.fish.name+sizeLbl,W/2,by+bh+22);ctx.restore();
  if(prog<0.3&&bob.show){const danger=0.5+Math.sin(t*12)*0.4;ctx.save();ctx.globalAlpha=danger*0.7;ctx.strokeStyle='#ef4444';ctx.lineWidth=4;ctx.beginPath();ctx.arc(bob.x,bob.y+bob.dip,32,0,Math.PI*2);ctx.stroke();ctx.restore();}
}

function drawCatchReveal(){
  if(!revealData)return;
  const t=revealT,W2=W/2,H2=H/2;
  const isLegendary=revealData.fish.legendary;
  ctx.save();ctx.globalAlpha=Math.min(0.72,t*2)*0.72;ctx.fillStyle=isLegendary?'rgba(10,0,20,0.9)':'rgba(0,15,8,0.8)';ctx.fillRect(0,0,W,H);ctx.restore();
  if(t<0.6){
    const q=Math.min(1,t/0.5),eq=1-Math.pow(1-q,3);
    const fx=revealData.x+(W2-revealData.x)*eq,fy=revealData.y+(H2-100-revealData.y)*eq-Math.sin(q*Math.PI)*200;
    const scale=0.8+eq*0.8;
    ctx.save();ctx.font=Math.round(40*scale)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(revealData.fish.emoji,fx,fy);
    for(let i=0;i<(isLegendary?6:3);i++){const sx=fx+Math.cos(t*8+i*2.1)*40*q,sy=fy+Math.sin(t*8+i*2.1)*30*q;ctx.globalAlpha=q*0.8;ctx.font='18px system-ui,sans-serif';ctx.fillText(isLegendary?'✨':'💧',sx,sy);}
    ctx.restore();return;
  }
  const cardQ=Math.min(1,(t-0.55)/0.4);
  const cardW=460,cardH=isLegendary?330:290;
  const cx=W2-cardW/2,cy=H2-cardH/2-20;
  ctx.save();ctx.globalAlpha=cardQ;
  const cardG=ctx.createLinearGradient(cx,cy,cx+cardW,cy+cardH);
  if(isLegendary){cardG.addColorStop(0,'#1e0533');cardG.addColorStop(1,'#2d0a4a');}
  else{cardG.addColorStop(0,'#0f2d1a');cardG.addColorStop(1,'#1a4a2a');}
  ctx.fillStyle=cardG;ctx.beginPath();ctx.roundRect(cx,cy,cardW,cardH,24);ctx.fill();
  ctx.strokeStyle=isLegendary?'rgba(192,132,252,0.4)':'rgba(255,255,255,0.15)';ctx.lineWidth=isLegendary?2:1.5;ctx.beginPath();ctx.roundRect(cx,cy,cardW,cardH,24);ctx.stroke();
  if(isLegendary){const glow=ctx.createRadialGradient(W2,cy+cardH/2,10,W2,cy+cardH/2,180);glow.addColorStop(0,'rgba(192,132,252,0.15)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(cx,cy,cardW,cardH);}
  ctx.font='72px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(revealData.fish.emoji,W2,cy+90);
  ctx.fillStyle=isLegendary?'#e9d5ff':'#ffffff';ctx.font='bold 26px system-ui,sans-serif';ctx.fillText(revealData.fish.name,W2,cy+130);
  if(revealData.sizeM.label){ctx.fillStyle='#fbbf24';ctx.font='bold 18px system-ui,sans-serif';ctx.fillText(revealData.sizeM.label,W2,cy+156);}
  if(isLegendary){ctx.fillStyle='#c084fc';ctx.font='bold 15px system-ui,sans-serif';ctx.fillText('LEGENDARY CATCH',W2,cy+180);}
  /* #9 personal best indicator */
  const pb=sv.bests&&sv.bests[revealData.fish.name];
  const isPB=pb&&revealData.pts>=pb;
  if(isPB){ctx.fillStyle='#fbbf24';ctx.font='bold 13px system-ui,sans-serif';ctx.fillText('NEW PERSONAL BEST!',W2,cy+(isLegendary?200:188));}
  let ptsLine='+'+revealData.pts+' pts';
  if(revealData.mult>1)ptsLine='x'+revealData.mult+' COMBO  '+ptsLine;
  if(revealData.hasChain)ptsLine='CHAIN!  '+ptsLine;
  ctx.fillStyle=isLegendary?'#c084fc':'#4ade80';ctx.font='bold 22px system-ui,sans-serif';ctx.fillText(ptsLine,W2,cy+(isLegendary?225:215));
  /* streak display */
  if(catchStreak>=3){ctx.fillStyle='#22c55e';ctx.font='bold 14px system-ui,sans-serif';ctx.fillText('STREAK x'+catchStreak+(catchStreak%5===0?' - BAIT BONUS!':''),W2,cy+(isLegendary?250:238));}
  ctx.globalAlpha=cardQ*0.08;ctx.strokeStyle='#fff';ctx.lineWidth=1;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(cx,cy+i*46);ctx.lineTo(cx+cardW,cy+i*46);ctx.stroke();}
  ctx.restore();
}

function drawScreenFlash(){
  ctx.save();ctx.globalAlpha=screenFlash.alpha*0.6;ctx.fillStyle=screenFlash.col;ctx.fillRect(0,0,W,H);ctx.restore();
}

function drawFloatTexts(){
  ctx.save();
  for(const ft of floatTexts){
    if(ft.life<=0)continue;
    ctx.globalAlpha=Math.max(0,ft.life);ctx.fillStyle=ft.col||'#fff';
    ctx.font='bold '+ft.sz+'px system-ui,sans-serif';ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=4;
    ctx.fillText(ft.text,ft.x,ft.y);
  }ctx.restore();
}

function drawParticles(){
  ctx.save();
  for(const p of particles){
    if(p.life<=0)continue;
    if(p.ring){
      ctx.globalAlpha=Math.max(0,p.life)*0.4;ctx.strokeStyle=p.c;ctx.lineWidth=1.5;
      const r=p.r+(1-p.life)*p.dr;
      ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*0.38,0,0,Math.PI*2);ctx.stroke();
      continue;
    }
    ctx.globalAlpha=Math.max(0,p.life);ctx.font=(p.sz||22)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle=p.c||'#fff';ctx.fillText(p.t,p.x,p.y);
  }ctx.restore();
  for(const p of particles){p.x+=p.vx;p.y+=p.vy;if(!p.ring){p.vy+=0.09;}p.life-=1/60*(p.dec||0.7);}
  particles=particles.filter(p=>p.life>0);
}

function spawnFloatText(text,x,y,col,sz=22){floatTexts.push({text,x,y,col,sz,life:1.3});}

function spawnSplash(x,y,type,extra){
  if(type==='splash'){
    for(let i=0;i<4;i++){const a=Math.random()*Math.PI*2,s=1.2+Math.random()*2.2;particles.push({t:'🌊',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,life:1,c:'#7dd3fc',sz:14+Math.random()*8|0,dec:0.9});}
  }else if(type==='caught'){
    for(let i=0;i<6;i++)particles.push({t:['✨','⭐','🌟'][i%3],x:x+(Math.random()-0.5)*70,y:y-15,vx:(Math.random()-0.5)*2.5,vy:-2.5-Math.random()*2,life:1.1,c:'#fbbf24',sz:18+Math.random()*12|0,dec:0.6});
    if(extra)particles.push({t:extra,x,y:y-10,vx:0,vy:-4,life:1.4,c:'#fff',sz:40,dec:0.5});
  }else if(type==='escape'){
    particles.push({t:'💨',x,y,vx:1.5,vy:-3,life:1,c:'#94a3b8',sz:30,dec:0.7});
    particles.push({t:'...',x:x+10,y:y-30,vx:0,vy:-1,life:0.8,c:'#94a3b8',sz:22,dec:0.8});
  }
}

function spawnWaterRings(x,y){
  for(let i=0;i<3;i++)particles.push({t:'',x,y,vx:0,vy:0,life:0.9-i*0.15,ring:true,r:8+i*18,dr:120+i*60,c:'#93c5fd',sz:0,dec:0.9+i*0.1});
}

function setStatus(msg){const el=document.getElementById('statusMsg');if(el)el.textContent=msg;}

function updateUI(){
  document.getElementById('scoreVal').textContent=score;
  document.getElementById('catchVal').textContent=caught;
  document.getElementById('comboVal').textContent=combo>1?'x'+combo:'-';
  document.getElementById('bestVal').textContent=sv.best;
  document.getElementById('levelName').textContent=cfg().name+(weather==='rain'?' (rain)':(weather==='storm'?' (storm)':''));
  document.getElementById('starsBank').textContent='* '+Object.values(sv.stars||{}).reduce((a,b)=>a+b,0);
  document.getElementById('missionTitle').textContent='Catch '+cfg().target+' fish';
  document.getElementById('goalFill').style.width=Math.min(100,caught/cfg().target*100)+'%';
  document.getElementById('reelWrap').style.display='none';
  const map=document.getElementById('levelMap');map.innerHTML='';
  LEVELS.forEach((l,i)=>{const bt=document.createElement('button');bt.className='planet '+(i===lv?'active':'')+(i<=(sv.bestLevel||0)?' unlocked':'');bt.textContent=((sv.stars||{})[i]||0)>0?'*'.repeat((sv.stars||{})[i]):i+1;bt.disabled=i>(sv.bestLevel||0);bt.onclick=()=>startLevel(i);map.appendChild(bt);});
}

function levelComplete(){
  playing=false;
  stopAmbient();
  sv.best=Math.max(sv.best,score);
  sv.bestLevel=Math.max(sv.bestLevel||0,Math.min(lv+1,LEVELS.length-1));
  const stars=caught>=cfg().target?3:caught>=Math.ceil(cfg().target*0.65)?2:1;
  sv.stars=sv.stars||{};sv.stars[lv]=Math.max(sv.stars[lv]||0,stars);
  storeSv();gameSystem.saveState();
  gameSystem.unlockAchievement('firstCatch');
  if(sv.total>=10)gameSystem.unlockAchievement('anglerPro');
  showModal('🎣','Spot Complete!','You caught '+caught+' fish at '+cfg().name+'!',[['Score',score],['Fish',caught],['Stars','*'.repeat(stars)],['Rod',RODS[rodLevel].name]],lv===LEVELS.length-1?'Play Again':'Next Spot',()=>{startLevel(lv===LEVELS.length-1?lv:lv+1);});
}

function showModal(e,t,txt,stats,btn,act){
  document.getElementById('modalEmoji').textContent=e;document.getElementById('modalTitle').textContent=t;document.getElementById('modalText').textContent=txt;
  document.getElementById('modalStats').innerHTML=stats.map(s=>'<div><span>'+s[0]+'</span><b>'+s[1]+'</b></div>').join('');
  document.getElementById('modalPrimary').textContent=btn;document.getElementById('modalPrimary').onclick=act;
  document.getElementById('modal').classList.add('show');
}
function hideModal(){document.getElementById('modal').classList.remove('show');}

function frame(t){
  const dt=Math.min(0.05,(t-last)/1000||0.016);last=t;
  if(playing)step(dt);
  draw();
  requestAnimationFrame(frame);
}

document.getElementById('helpBtn').onclick=()=>showModal('🎣','How to Fish',
  'Flick up from the bottom to cast. Hold for a power charge. When the bobber dips - TAP to reel in. Watch the tension bar above the reel bar: reel too fast and the line snaps. Swipe left or right to follow the fish direction. Catch within 20 seconds of your last catch for a CHAIN bonus! Catch 5 in a row for a bait refill streak bonus.',
  [['Hotspot','Faster bites, rarer fish'],['Dragon Koi','1-in-10 legendary event'],['Chain','Catch within 20s for 1.5x pts'],['Streak x5','Free bait refill!'],['Rod Upgrade','10 catches = Carbon Rod']],
  playing?'Resume':'Start Fishing',()=>hideModal());
document.getElementById('restartBtn').onclick=()=>startLevel(lv);
resize();
sv=loadSv();catchLog=sv.log||[];
showModal('🎣',"Pip's Cozy Cove",
  'Cast into the cove and reel in a catch! Flick up to cast, hold for more power. Tap fast when the bobber dips - but watch the tension!',
  [['Spots',LEVELS.length],['Best',sv.best],['Caught',(sv.total||0)+' total'],['Rod',RODS[sv.rodLevel||0].name]],'Start Fishing',()=>startLevel(sv.bestLevel||0));
requestAnimationFrame(frame);
