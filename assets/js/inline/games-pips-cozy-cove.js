const gameSystem=new GameSystem('pips-cozy-cove',"Pip's Cozy Cove",'pip');
let audioFx;try{audioFx=new AudioEffects(.65);if(localStorage.getItem('soundEnabled')==='false')audioFx.setMasterVolume(0);}catch(e){}
const KEY='pips_cozy_cove_v1';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');

const W=900,H=1100,WATER_TOP=360,DOCK_TOP=950;
const ROD_BASE={x:430,y:1060};

const FISH=[
  {name:'Minnow',emoji:'🐟',pts:50,wait:[1.5,3.5],reel:7,esc:1.4,drain:1.1,col:'#7dd3fc',shadowR:14},
  {name:'Perch',emoji:'🐠',pts:120,wait:[2,5],reel:11,esc:1.1,drain:1.8,col:'#fb923c',shadowR:20},
  {name:'Bass',emoji:'🐡',pts:250,wait:[2.5,6],reel:17,esc:0.9,drain:2.6,col:'#4ade80',shadowR:28},
  {name:'Golden Carp',emoji:'🌟',pts:600,wait:[3.5,8],reel:24,esc:1.6,drain:3.4,col:'#fbbf24',shadowR:38},
];

const SIZE_TABLE={small:{pts:0.6,reel:0.7,label:'Small'},normal:{pts:1,reel:1,label:''},trophy:{pts:2,reel:1.4,label:'Trophy 🏆'}};

const BAITS=[
  {name:'Worm',emoji:'🪱',desc:'Attracts all fish',waitMult:1,bias:0},
  {name:'Lure',emoji:'🎣',desc:'Bigger fish, longer wait',waitMult:1.3,bias:1},
  {name:'Bread',emoji:'🍞',desc:'Fast bites, common fish',waitMult:0.65,bias:-1},
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

let sv,lv,score,caught,combo;
let st='idle'; // idle|charging|flying|waiting|nibble|bite|reeling|catchReveal|done
let drag=null,chargeT=0,charging=false;
let bob={x:450,y:600,show:false,dip:0};
let fly={t:0,dur:0.75,x0:490,y0:750,x1:450,y1:580};
let cur=null; // {fish,waitLeft,nibLeft,reelProg,escTimer,direction,dirTimer,tension,lastTapMs,size,sizeM,shadowDist,shadowAngle}
let castT=0,casting=false;
let particles=[],weatherPtx=[];
let last=0,playing=false;
let bait=0,weather='clear',lossStreak=0;
let catchLog=[];
let revealData=null,revealT=0;
let reelSwipeStart=null;

const TIPS=[
  {t:'Cast Near Ripples',d:'Subtle disturbances mark where fish hide. Cast close for a faster bite!'},
  {t:'Reel Steady',d:'Tap quickly but watch the tension bar - reel too fast and the line snaps!'},
  {t:'Follow the Arrow',d:'When the arrow flashes during reeling, swipe that way or the fish pulls harder.'},
  {t:'Shake to Reel',d:'On mobile, shaking the phone counts as a reel tap! Use it in a panic.'},
  {t:'Trophy Fish',d:'Long casts with the Lure bait can hook a trophy-size fish worth double points!'},
  {t:'Combo Bonus',d:'Catch fish back-to-back to build a ×4 combo multiplier.'},
  {t:'Storm Fishing',d:'Stormy weather speeds up bites but fish escape faster - high risk, high reward!'},
];
let tipIdx=0;

function loadSv(){try{return Object.assign({best:0,bestLevel:0,stars:{},total:0,log:[]},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return{best:0,bestLevel:0,stars:{},total:0,log:[]}}}
function storeSv(){try{localStorage.setItem(KEY,JSON.stringify(sv))}catch{}}

function rollWeather(){
  const r=Math.random();
  weather=r<0.55?'clear':r<0.82?'rain':'storm';
  weatherPtx=[];
}

function startLevel(i){
  lv=Math.max(0,Math.min(i,LEVELS.length-1));
  score=0;caught=0;combo=0;
  st='idle';drag=null;bob.show=false;bob.dip=0;cur=null;particles=[];casting=false;charging=false;chargeT=0;
  playing=true;
  rollWeather();
  setStatus('Flick upward from the bottom to cast your line! 🎣');
  hideModal();updateUI();
  rotateTip();buildBaitUI();
}

function cfg(){return LEVELS[lv];}
function rotateTip(){tipIdx=(tipIdx+1)%TIPS.length;const tp=TIPS[tipIdx];document.getElementById('tipTitle').textContent=tp.t;document.getElementById('tipDetail').textContent=tp.d;}

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
    const btn=document.createElement('button');
    btn.className='ghost';
    btn.style.cssText='flex:1;padding:7px 2px;font-size:11px;margin-top:0;border-radius:11px;'+(i===bait?'background:#14b8a6;color:#fff;border-color:#14b8a6':'');
    btn.textContent=b.emoji+' '+b.name;
    btn.title=b.desc;
    btn.onclick=()=>{if(st==='idle'){bait=i;buildBaitUI();}};
    el.appendChild(btn);
  });
  buildLogUI();
}

function buildLogUI(){
  let el=document.getElementById('catchLogCard');
  if(!el){
    el=document.createElement('div');
    el.id='catchLogCard';
    el.className='cove-last';
    el.style='margin-top:10px;';
    const bar=document.getElementById('baitBar');
    if(bar)bar.after(el);
  }
  if(!catchLog.length){el.innerHTML='<p>Last 5 catches</p><div style="color:#94a3b8;font-size:12px;padding:4px 0">Nothing yet!</div>';return;}
  el.innerHTML='<p>Catch log</p>'+catchLog.slice(0,5).map(c=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;border-bottom:.5px solid rgba(0,0,0,.08)"><span>${c.emoji} ${c.name}${c.size?' <small style="color:#0d9488">('+c.size+')</small>':''}</span><b style="color:#0d9488">${c.pts}</b></div>`).join('');
}

function toCanvas(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}

canvas.addEventListener('pointerdown',e=>{
  if(st==='bite'||st==='reeling'){
    handleReel();
    reelSwipeStart=toCanvas(e);
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if(st!=='idle')return;
  const p=toCanvas(e);
  if(p.y<DOCK_TOP-120)return;
  drag={sx:p.x,sy:p.y,cx:p.x,cy:p.y};
  charging=true;chargeT=0;
  canvas.setPointerCapture(e.pointerId);
  setStatus('Hold for power, flick up to cast ↑');
});

canvas.addEventListener('pointermove',e=>{
  if(drag){const p=toCanvas(e);drag.cx=p.x;drag.cy=p.y;}
  if(reelSwipeStart&&(st==='bite'||st==='reeling')&&cur?.direction){
    const p=toCanvas(e);
    const dx=p.x-reelSwipeStart.x;
    if(Math.abs(dx)>45){
      const dir=dx>0?'right':'left';
      if(dir===cur.direction){
        cur.reelProg=Math.min(cur.fish.reel*cur.sizeM.reel,(cur.reelProg||0)+0.8);
        spawnPop('↗',bob.x,bob.y-40,'#22c55e');
      }else{
        cur.reelProg=Math.max(0,(cur.reelProg||0)-2);
        spawnPop('✗',bob.x,bob.y-40,'#ef4444');
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
  if(dy<55){setStatus('Flick upward to cast the line ↑');chargeT=0;return;}
  doCast(dx,dy);
});

// --- shake to reel ---
let lastShakeMs=0;
(function initShake(){
  if(typeof DeviceMotionEvent==='undefined')return;
  const handler=e=>{
    const a=e.accelerationIncludingGravity;
    if(!a)return;
    const mag=Math.hypot(a.x||0,a.y||0,a.z||0);
    const now=performance.now();
    if(mag>22&&now-lastShakeMs>160&&(st==='bite'||st==='reeling')){
      lastShakeMs=now;handleReel();
    }
  };
  if(typeof DeviceMotionEvent.requestPermission==='function'){
    document.addEventListener('click',function req(){
      DeviceMotionEvent.requestPermission().then(r=>{if(r==='granted')window.addEventListener('devicemotion',handler);});
      document.removeEventListener('click',req);
    },{once:true});
  }else{window.addEventListener('devicemotion',handler);}
})();

function doCast(dx,dy){
  if(st!=='idle')return;
  const flickPow=Math.min(1,Math.hypot(dx,dy)/340);
  const chargePow=Math.min(1,chargeT/1.4);
  const power=Math.min(1,flickPow*0.65+chargePow*0.45);
  chargeT=0;
  const side=Math.max(-1,Math.min(1,dx/270));
  const depth=Math.max(0.08,Math.min(0.9,0.15+power*0.8));
  const landX=Math.max(90,Math.min(810,450+side*300));
  const landY=WATER_TOP+30+(1-depth)*(DOCK_TOP-WATER_TOP-110);
  const near=cfg().hotspots.find(h=>Math.hypot(landX-h.x,landY-h.y)<h.r+20);
  if(near)setStatus('Great cast! Near a fish spot 🐟');
  fly={t:0,dur:0.65+power*0.3,x0:490,y0:750,x1:landX,y1:landY};
  bob.x=landX;bob.y=landY;bob.show=false;bob.dip=0;
  casting=true;castT=0;st='flying';
  try{audioFx&&audioFx.playPop();}catch{}
}

function handleReel(){
  const now=performance.now();
  if(st==='bite'){
    if(cur&&cur.escTimer){clearTimeout(cur.escTimer);cur.escTimer=null;}
    st='reeling';
    if(cur){cur.reelProg=1.5;cur.direction=null;cur.dirTimer=1.5+Math.random();cur.tension=0;cur.lastTapMs=now;}
    setStatus('Reel it in! Watch the tension! 🎣');
    updateUI();
  }
  if(st==='reeling'&&cur){
    const interval=now-(cur.lastTapMs||now);
    cur.lastTapMs=now;
    if(interval<190)cur.tension=Math.min(1,(cur.tension||0)+0.2);
    if(cur.tension>=1){snapLine();return;}
    cur.reelProg=(cur.reelProg||0)+1;
    try{audioFx&&audioFx.playPop();}catch{}
    updateUI();
    if(cur.reelProg>=cur.fish.reel*cur.sizeM.reel)fishCaught();
  }
}

function snapLine(){
  lossStreak++;combo=0;
  spawnSplash(bob.x,bob.y+bob.dip,'escape','💔');
  spawnPop('SNAP!',bob.x,bob.y-50,'#ef4444');
  setStatus('The line snapped! Reel slower…');
  document.getElementById('lastFish').textContent='Line snapped…';
  document.getElementById('lastPts').textContent='';
  try{audioFx&&audioFx.playError();}catch{}
  st='done';updateUI();setTimeout(resetCast,1300);
}

function fishCaught(){
  st='catchReveal';revealT=0;
  caught++;combo++;lossStreak=0;
  const mult=Math.min(4,combo);
  const pts=Math.round(cur.fish.pts*cur.sizeM.pts*mult);
  score+=pts;
  sv.total=(sv.total||0)+1;
  const entry={name:cur.fish.name,emoji:cur.fish.emoji,size:cur.sizeM.label,pts,spot:cfg().name};
  catchLog.unshift(entry);catchLog=catchLog.slice(0,8);sv.log=catchLog;
  revealData={fish:cur.fish,sizeM:cur.sizeM,pts,mult,x:bob.x,y:bob.y+bob.dip};
  document.getElementById('lastFish').textContent=cur.fish.emoji+' '+cur.fish.name+(cur.sizeM.label?' ('+cur.sizeM.label+')':'');
  document.getElementById('lastPts').textContent=pts+' pts'+(mult>1?' (×'+mult+')':'');
  rotateTip();
  try{audioFx&&audioFx.playLevelUp();}catch{}
  updateUI();
}

function fishEscaped(){
  if(st!=='bite'&&st!=='reeling')return;
  lossStreak++;combo=0;
  spawnSplash(bob.x,bob.y,'escape','💨');
  setStatus(lossStreak>=3?'Three in a row… something big is coming! ✨':'The fish got away! Try again 🎣');
  document.getElementById('lastFish').textContent='Got away…';
  document.getElementById('lastPts').textContent='';
  try{audioFx&&audioFx.playError();}catch{}
  st='done';updateUI();setTimeout(resetCast,1200);
}

function resetCast(){
  st='idle';bob.show=false;bob.dip=0;cur=null;drag=null;casting=false;charging=false;chargeT=0;reelSwipeStart=null;
  document.getElementById('reelWrap').style.display='none';
  buildLogUI();
  setStatus(lossStreak>=3?'Something legendary is out there… cast now! ✨':'Flick upward to cast again! 🎣');
  updateUI();
}

// --- simulation ---
function step(dt){
  if(charging)chargeT+=dt;
  if(casting){castT+=dt;if(castT>0.55)casting=false;}

  if(weather==='rain'||weather==='storm'){
    const rate=weather==='storm'?5:2;
    for(let i=0;i<rate;i++)weatherPtx.push({x:Math.random()*W,y:-8,vy:weather==='storm'?16:11,vx:(Math.random()-0.5)*1.5,life:1});
  }
  weatherPtx.forEach(p=>{p.x+=p.vx;p.y+=p.vy*dt*55;p.life-=dt*1.4;});
  weatherPtx=weatherPtx.filter(p=>p.life>0&&p.y<DOCK_TOP);

  if(st==='flying'){
    fly.t+=dt;
    if(fly.t>=fly.dur){
      bob.show=true;st='waiting';
      spawnSplash(bob.x,bob.y,'splash','💧');
      setStatus('Waiting for a bite…');
      const near=cfg().hotspots.find(h=>Math.hypot(bob.x-h.x,bob.y-h.y)<h.r);
      let pool=[...cfg().fishPool];
      if(near)pool=[...pool,...pool.slice(-2)];
      if(bait===1)pool=pool.map(x=>Math.min(x+1,FISH.length-1));
      if(bait===2)pool=pool.map(x=>Math.max(0,x-1));
      let fi=lossStreak>=3?Math.max(...cfg().fishPool):pool[Math.floor(Math.random()*pool.length)];
      const f=FISH[fi];
      const sr=Math.random();
      const sizeKey=sr<0.2?'small':sr>0.85?'trophy':'normal';
      const sizeM=SIZE_TABLE[sizeKey];
      const wt=(f.wait[0]+Math.random()*(f.wait[1]-f.wait[0]))*BAITS[bait].waitMult*(weather==='rain'?0.75:weather==='storm'?0.55:1)*(near?0.65:1);
      cur={fish:f,waitLeft:wt,nibLeft:0,reelProg:0,escTimer:null,direction:null,dirTimer:0,tension:0,lastTapMs:0,size:sizeKey,sizeM,shadowDist:260,shadowAngle:Math.random()*Math.PI*2};
    }
  }

  if(st==='waiting'&&cur){
    cur.waitLeft-=dt;
    cur.shadowDist=Math.max(0,cur.shadowDist-dt*48);
    cur.shadowAngle+=dt*(0.6+cur.fish.shadowR*0.012);
    if(cur.waitLeft<=0){st='nibble';cur.nibLeft=0.4+Math.random()*0.6;setStatus("Something's nibbling… 🎣");}
  }

  if(st==='nibble'&&cur){
    cur.nibLeft-=dt;
    bob.dip=Math.abs(Math.sin(performance.now()/110))*14;
    if(cur.nibLeft<=0){
      st='bite';setStatus('🎣 BITE! Tap to reel in!');bob.dip=22;
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
    if(cur.dirTimer<=0){
      cur.direction=Math.random()<0.5?'left':'right';
      cur.dirTimer=1.0+Math.random()*1.6;
    }
  }

  if(st==='catchReveal'){
    revealT+=dt;
    if(revealT>2.4){
      st='done';
      if(caught>=cfg().target)setTimeout(levelComplete,300);
      else setTimeout(resetCast,300);
    }
  }

  for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=0.09;p.life-=dt*(p.dec||0.7);}
}

// --- drawing ---
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
  if(st==='waiting'||st==='nibble')drawFishShadow();
  if(bob.show)drawFishingLine();
  if(st==='flying')drawFlyingBobber();
  if(bob.show)drawBobber();
  drawRod();
  if(drag&&(st==='idle'||charging))drawAimArc();
  if(st==='bite'||st==='reeling')drawReelPhase();
  if(st==='catchReveal'&&revealData)drawCatchReveal();
  drawParticles();
  ctx.restore();
}

function drawScene(){
  const pal=cfg().pal;
  const skyG=ctx.createLinearGradient(0,0,0,WATER_TOP+40);
  skyG.addColorStop(0,pal.sky0);skyG.addColorStop(1,pal.sky1);
  ctx.fillStyle=skyG;ctx.fillRect(0,0,W,WATER_TOP+40);
  if(cfg().dec==='morning'){ctx.save();ctx.globalAlpha=0.7;ctx.fillStyle='#fef08a';ctx.beginPath();ctx.arc(720,80,42,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.25;ctx.beginPath();ctx.arc(720,80,62,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(cfg().dec==='golden'){ctx.save();ctx.globalAlpha=0.6;ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(760,90,52,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.2;ctx.beginPath();ctx.arc(760,90,78,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(cfg().dec==='morning'||cfg().dec==='lily')drawClouds();
  drawTrees(pal.trees);
  const waterG=ctx.createLinearGradient(0,WATER_TOP,0,DOCK_TOP);
  waterG.addColorStop(0,pal.water0);waterG.addColorStop(1,pal.water1);
  ctx.fillStyle=waterG;ctx.fillRect(0,WATER_TOP-10,W,DOCK_TOP-WATER_TOP+20);
  ctx.save();ctx.globalAlpha=0.28;
  const hazeG=ctx.createLinearGradient(0,WATER_TOP-20,0,WATER_TOP+70);
  hazeG.addColorStop(0,pal.haze);hazeG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=hazeG;ctx.fillRect(0,WATER_TOP-20,W,90);ctx.restore();
  drawRipples(pal);
  if(cfg().dec==='lily')drawLilyPads();
  else if(cfg().dec==='rocky')drawRocks();
  else if(cfg().dec==='golden')drawGoldenShimmer();
  drawHotspots(pal);
  drawDock();
  // Weather overlay
  if(weather==='storm'){ctx.save();ctx.globalAlpha=0.12;ctx.fillStyle='#312e81';ctx.fillRect(0,0,W,H);ctx.restore();}
}

function drawClouds(){
  const clouds=[{x:120,y:60,w:140,h:45},{x:380,y:40,w:110,h:38},{x:600,y:75,w:90,h:32}];
  ctx.save();ctx.fillStyle='rgba(255,255,255,0.72)';
  for(const c of clouds){ctx.beginPath();ctx.ellipse(c.x,c.y,c.w/2,c.h/2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(c.x+c.w*0.22,c.y-c.h*0.2,c.w*0.35,c.h*0.6,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(c.x-c.w*0.2,c.y-c.h*0.1,c.w*0.3,c.h*0.5,0,0,Math.PI*2);ctx.fill();}ctx.restore();
}

function drawTrees(col){
  ctx.save();
  for(let i=0;i<22;i++){const x=i*43+5+Math.sin(i*1.7)*8,h=55+Math.abs(Math.sin(i*0.9))*45;ctx.fillStyle=col;ctx.globalAlpha=0.65+Math.sin(i*1.3)*0.15;ctx.beginPath();ctx.moveTo(x,WATER_TOP-2);ctx.lineTo(x+22,WATER_TOP-h*0.5);ctx.lineTo(x+5,WATER_TOP-h);ctx.lineTo(x-12,WATER_TOP-h*0.5);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(x+5,WATER_TOP-h*1.3);ctx.lineTo(x+16,WATER_TOP-h*0.65);ctx.lineTo(x-8,WATER_TOP-h*0.65);ctx.closePath();ctx.fill();}
  ctx.restore();
}

function drawRipples(pal){
  const t=performance.now()/1000;ctx.save();ctx.strokeStyle='rgba(255,255,255,0.11)';ctx.lineWidth=1.5;
  for(let i=0;i<9;i++){const y=WATER_TOP+25+i*68,spd=18+(i%3)*8,ph=i*0.6;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=W;x+=14)ctx.lineTo(x,y+Math.sin(x*0.035+t*spd+ph)*3.5);ctx.stroke();}ctx.restore();
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
  for(let i=0;i<5;i++){const sx=350+Math.sin(t*0.7+i*1.3)*120,sy=430+Math.cos(t*0.5+i*2.1)*80;ctx.beginPath();ctx.arc(sx,sy,2+Math.sin(t*2+i)*1.2,0,Math.PI*2);ctx.fill();}ctx.restore();
}

function drawDock(){
  ctx.fillStyle='#78350f';ctx.fillRect(0,DOCK_TOP,W,H-DOCK_TOP);
  ctx.strokeStyle='#92400e';ctx.lineWidth=2.5;for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(0,DOCK_TOP+i*17);ctx.lineTo(W,DOCK_TOP+i*17);ctx.stroke();}
  ctx.strokeStyle='#451a03';ctx.lineWidth=1.5;for(let i=0;i<13;i++){ctx.beginPath();ctx.moveTo(i*75,DOCK_TOP);ctx.lineTo(i*75,H);ctx.stroke();}
  ctx.save();const sh=ctx.createLinearGradient(0,DOCK_TOP-18,0,DOCK_TOP+8);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,0.35)');ctx.fillStyle=sh;ctx.fillRect(0,DOCK_TOP-18,W,26);ctx.restore();
}

function drawWeather(){
  if(!weatherPtx.length)return;
  ctx.save();ctx.strokeStyle=weather==='storm'?'rgba(180,200,255,0.55)':'rgba(170,210,255,0.4)';ctx.lineWidth=weather==='storm'?2:1.5;
  for(const p of weatherPtx){
    ctx.globalAlpha=Math.max(0,p.life)*0.9;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.vx*2,p.y-5);ctx.stroke();
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
  ctx.globalAlpha=alpha;ctx.fillStyle='rgba(0,10,30,0.7)';
  ctx.beginPath();ctx.ellipse(sx,sy,r*1.8,r*0.75,Math.sin(t*0.4)*0.3,0,Math.PI*2);ctx.fill();
  // Tail fin hint
  const ang=Math.sin(t*2)*0.4;
  ctx.beginPath();ctx.ellipse(sx-r*1.4,sy,r*0.5,r*0.3,ang,0,Math.PI*2);ctx.fill();
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
    const x0=base.x+(tip.x-base.x)*s.t,y0=base.y+(tip.y-base.y)*s.t;
    const x1=base.x+(tip.x-base.x)*s.e,y1=base.y+(tip.y-base.y)*s.e;
    const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#92400e');g.addColorStop(1,'#c8a97e');
    ctx.strokeStyle=g;ctx.lineWidth=s.w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
  }
  // Charge glow on rod
  if(charging&&chargeT>0.3){
    const p=Math.min(1,chargeT/1.4);
    ctx.save();ctx.globalAlpha=p*0.5;ctx.strokeStyle='#38bdf8';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.restore();
  }
  ctx.strokeStyle='#e2e8f0';ctx.lineWidth=2.5;
  for(let i=0;i<4;i++){const q=0.3+i*0.17,rx=base.x+(tip.x-base.x)*q,ry=base.y+(tip.y-base.y)*q,rr=5-i;ctx.beginPath();ctx.arc(rx,ry,rr,0,Math.PI*2);ctx.stroke();}
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
  ctx.beginPath();ctx.moveTo(tip.x,tip.y);
  const mx=(tip.x+bx)/2+8*(1-taut),my=(tip.y+by)/2+25*(1-taut);
  ctx.quadraticCurveTo(mx,my,bx,by);ctx.stroke();ctx.restore();
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
  if(st==='bite'){const flash=0.5+Math.sin(performance.now()/75)*0.45;ctx.save();ctx.globalAlpha=flash;ctx.strokeStyle='#fbbf24';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.stroke();ctx.restore();}
}

function drawAimArc(){
  if(!drag)return;
  const dx=drag.cx-drag.sx,dy=drag.sy-drag.cy;
  if(dy<30)return;
  const flickPow=Math.min(1,Math.hypot(dx,dy)/340);
  const chargePow=Math.min(1,chargeT/1.4);
  const power=Math.min(1,flickPow*0.65+chargePow*0.45);
  const side=Math.max(-1,Math.min(1,dx/270));
  const depth=Math.max(0.08,Math.min(0.9,0.15+power*0.8));
  const lx=Math.max(90,Math.min(810,450+side*300));
  const ly=WATER_TOP+30+(1-depth)*(DOCK_TOP-WATER_TOP-110);
  const tip=rodTip();
  const dist=Math.hypot(lx-tip.x,ly-tip.y),arcH=Math.min(320,dist*0.6+100);
  ctx.save();ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=2.5;ctx.setLineDash([10,8]);
  ctx.beginPath();
  for(let i=0;i<=22;i++){const q=i/22,eq=q<0.5?2*q*q:(1-Math.pow(-2*q+2,2)/2);const px=tip.x+(lx-tip.x)*eq,py=tip.y+(ly-tip.y)*eq-Math.sin(q*Math.PI)*arcH;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}
  ctx.stroke();ctx.setLineDash([]);
  ctx.globalAlpha=0.5+power*0.35;ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(lx,ly,28+power*14,11+power*5,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=0.15+power*0.1;ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.ellipse(lx,ly,28+power*14,11+power*5,0,0,Math.PI*2);ctx.fill();
  // Power + charge label
  const label=charging&&chargeT>0.2?'⚡ '+Math.round(power*100)+'%':Math.round(power*100)+'%';
  ctx.globalAlpha=0.95;ctx.fillStyle=charging&&chargePow>0.5?'#38bdf8':'#fff';ctx.font='bold 20px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(label,lx,ly-20);
  ctx.restore();
}

function drawReelPhase(){
  if(!cur)return;
  const prog=Math.min(1,Math.max(0,(cur.reelProg||0)/(cur.fish.reel*cur.sizeM.reel)));
  const tension=cur.tension||0;
  const t=performance.now()/1000;

  ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,WATER_TOP,W,DOCK_TOP-WATER_TOP);ctx.restore();

  // Tug-of-war bar
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

  // Fish fighting
  const fishBob=Math.sin(t*9)*6+(st==='bite'?Math.sin(t*20)*3:0);
  const fishFaceX=Math.max(bx+20,Math.min(bx+bw-20,fillX+10));
  ctx.save();ctx.font='34px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(cur.fish.emoji,fishFaceX,by+bh/2+12+fishBob);ctx.restore();

  // Tension bar above reel
  const tbx=bx+40,tbw=bw-80,tbh=10,tby=by-26;
  ctx.save();ctx.globalAlpha=0.7;ctx.fillStyle='rgba(0,0,0,0.4)';ctx.beginPath();ctx.roundRect(tbx,tby,tbw,tbh,5);ctx.fill();
  const tCol=tension>0.75?'#ef4444':tension>0.45?'#f59e0b':'#22c55e';
  ctx.fillStyle=tCol;ctx.beginPath();ctx.roundRect(tbx,tby,tbw*tension,tbh,5);ctx.fill();
  if(tension>0.8){const snap=0.6+Math.sin(t*18)*0.4;ctx.globalAlpha=snap*0.8;ctx.font='bold 14px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='#ef4444';ctx.fillText('⚠ EASE UP!',bx+bw/2,tby-6);}
  else{ctx.globalAlpha=0.5;ctx.font='11px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('LINE TENSION',bx+bw/2,tby-5);}
  ctx.restore();

  // Direction arrow
  if(st==='reeling'&&cur.direction){
    const arrowPulse=0.75+Math.sin(t*8)*0.25;
    ctx.save();ctx.globalAlpha=arrowPulse;
    ctx.fillStyle='#fbbf24';ctx.font='bold 52px system-ui,sans-serif';ctx.textAlign='center';
    ctx.fillText(cur.direction==='left'?'←':'→',W/2,by+bh+70);
    ctx.font='bold 16px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,0.8)';
    ctx.fillText('SWIPE '+cur.direction.toUpperCase(),W/2,by+bh+92);
    ctx.restore();
  }

  // TAP / REEL label
  const lbl=st==='bite'?'TAP!':'REEL!';
  const lblFlash=0.78+Math.sin(t*(st==='bite'?10:5))*0.22;
  ctx.save();ctx.globalAlpha=lblFlash;ctx.fillStyle=st==='bite'?'#fbbf24':'#ffffff';ctx.font='bold 44px system-ui,sans-serif';ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=8;ctx.fillText(lbl,W/2,by-50);ctx.restore();

  // Fish name + size
  const sizeLbl=cur.sizeM.label?` · ${cur.sizeM.label}`:'';
  ctx.save();ctx.globalAlpha=0.65;ctx.fillStyle='#e2e8f0';ctx.font='bold 18px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(cur.fish.emoji+' '+cur.fish.name+sizeLbl,W/2,by+bh+22);ctx.restore();

  // Danger pulse
  if(prog<0.3&&bob.show){const danger=0.5+Math.sin(t*12)*0.4;ctx.save();ctx.globalAlpha=danger*0.7;ctx.strokeStyle='#ef4444';ctx.lineWidth=4;ctx.beginPath();ctx.arc(bob.x,bob.y+bob.dip,32,0,Math.PI*2);ctx.stroke();ctx.restore();}
}

function drawCatchReveal(){
  if(!revealData)return;
  const t=revealT;
  const progress=Math.min(1,t/0.5);
  const W2=W/2,H2=H/2;

  // Darken
  ctx.save();ctx.globalAlpha=Math.min(0.72,t*2)*0.72;ctx.fillStyle='rgba(0,15,8,0.8)';ctx.fillRect(0,0,W,H);ctx.restore();

  // Fish arc-fly from bobber to center
  if(t<0.6){
    const q=Math.min(1,t/0.5);
    const eq=1-Math.pow(1-q,3);
    const fx=revealData.x+(W2-revealData.x)*eq;
    const fy=revealData.y+(H2-100-revealData.y)*eq-Math.sin(q*Math.PI)*200;
    const scale=0.8+eq*0.8;
    ctx.save();ctx.font=Math.round(40*scale)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(revealData.fish.emoji,fx,fy);ctx.restore();
    // Sparkles
    for(let i=0;i<3;i++){const sx=fx+Math.cos(t*8+i*2.1)*40*q,sy=fy+Math.sin(t*8+i*2.1)*30*q;ctx.save();ctx.globalAlpha=q*0.8;ctx.font='18px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('✨',sx,sy);ctx.restore();}
    return;
  }

  // Card reveal
  const cardQ=Math.min(1,(t-0.55)/0.4);
  const cardW=460,cardH=270;
  const cx=W2-cardW/2,cy=H2-cardH/2-20;

  ctx.save();
  ctx.globalAlpha=cardQ;
  // Card bg
  const cardG=ctx.createLinearGradient(cx,cy,cx+cardW,cy+cardH);
  cardG.addColorStop(0,'#0f2d1a');cardG.addColorStop(1,'#1a4a2a');
  ctx.fillStyle=cardG;ctx.beginPath();ctx.roundRect(cx,cy,cardW,cardH,24);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(cx,cy,cardW,cardH,24);ctx.stroke();

  // Fish emoji big
  ctx.font='72px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(revealData.fish.emoji,W2,cy+90);

  // Name + size
  ctx.fillStyle='#ffffff';ctx.font='bold 26px system-ui,sans-serif';ctx.fillText(revealData.fish.name,W2,cy+130);
  if(revealData.sizeM.label){ctx.fillStyle='#fbbf24';ctx.font='bold 18px system-ui,sans-serif';ctx.fillText(revealData.sizeM.label,W2,cy+156);}

  // Points
  const ptsLbl=(revealData.mult>1?'×'+revealData.mult+' COMBO  ':'')+'+ '+revealData.pts+' pts';
  ctx.fillStyle='#4ade80';ctx.font='bold 22px system-ui,sans-serif';ctx.fillText(ptsLbl,W2,cy+200);

  // Shimmer lines
  ctx.globalAlpha=cardQ*0.08;ctx.strokeStyle='#fff';ctx.lineWidth=1;
  for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(cx,cy+i*46);ctx.lineTo(cx+cardW,cy+i*46);ctx.stroke();}
  ctx.restore();
}

function drawParticles(){
  ctx.save();
  for(const p of particles){if(p.life<=0)continue;ctx.globalAlpha=Math.max(0,p.life);ctx.font=(p.sz||22)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle=p.c||'#fff';ctx.fillText(p.t,p.x,p.y);}
  ctx.restore();
  particles=particles.filter(p=>p.life>0);
}

function spawnPop(t,x,y,c){particles.push({t,x,y,vx:0,vy:-2.5,life:1.1,c,sz:24,dec:0.6});}

function spawnSplash(x,y,type,extra){
  if(type==='splash'){
    for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2,s=1.2+Math.random()*2.2;particles.push({t:'💧',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2.5,life:1,c:'#7dd3fc',sz:14+Math.random()*8|0,dec:0.9});}
  }else if(type==='caught'){
    for(let i=0;i<5;i++)particles.push({t:['✨','⭐','🌟'][i%3],x:x+(Math.random()-0.5)*70,y:y-15,vx:(Math.random()-0.5)*2.5,vy:-2.5-Math.random()*2,life:1.1,c:'#fbbf24',sz:18+Math.random()*12|0,dec:0.6});
    if(extra)particles.push({t:extra,x,y:y-10,vx:0,vy:-4,life:1.4,c:'#fff',sz:36,dec:0.5});
  }else if(type==='escape'){
    particles.push({t:'💨',x,y,vx:1.5,vy:-3,life:1,c:'#94a3b8',sz:30,dec:0.7});
    particles.push({t:'…',x:x+10,y:y-30,vx:0,vy:-1,life:0.8,c:'#94a3b8',sz:22,dec:0.8});
  }
}

function setStatus(msg){const el=document.getElementById('statusMsg');if(el)el.textContent=msg;}

function updateUI(){
  document.getElementById('scoreVal').textContent=score;
  document.getElementById('catchVal').textContent=caught;
  document.getElementById('comboVal').textContent=combo>1?'x'+combo:'-';
  document.getElementById('bestVal').textContent=sv.best;
  document.getElementById('levelName').textContent=cfg().name+(weather==='rain'?' 🌧':(weather==='storm'?' ⛈':''));
  document.getElementById('starsBank').textContent='⭐ '+Object.values(sv.stars||{}).reduce((a,b)=>a+b,0);
  document.getElementById('missionTitle').textContent='Catch '+cfg().target+' fish';
  document.getElementById('goalFill').style.width=Math.min(100,caught/cfg().target*100)+'%';
  document.getElementById('reelWrap').style.display='none';
  const map=document.getElementById('levelMap');map.innerHTML='';
  LEVELS.forEach((l,i)=>{const bt=document.createElement('button');bt.className='planet '+(i===lv?'active':'')+(i<=(sv.bestLevel||0)?' unlocked':'');bt.textContent=(sv.stars||{})[i]?'⭐'.repeat((sv.stars||{})[i]):i+1;bt.disabled=i>(sv.bestLevel||0);bt.onclick=()=>startLevel(i);map.appendChild(bt);});
}

function levelComplete(){
  playing=false;
  sv.best=Math.max(sv.best,score);
  sv.bestLevel=Math.max(sv.bestLevel||0,Math.min(lv+1,LEVELS.length-1));
  const stars=caught>=cfg().target?3:caught>=Math.ceil(cfg().target*0.65)?2:1;
  sv.stars=sv.stars||{};sv.stars[lv]=Math.max(sv.stars[lv]||0,stars);
  storeSv();gameSystem.saveState();
  gameSystem.unlockAchievement('firstCatch');
  if(sv.total>=10)gameSystem.unlockAchievement('anglerPro');
  showModal('🎣','Spot Complete!','You caught '+caught+' fish at '+cfg().name+'!',[['Score',score],['Fish',caught],['Stars','⭐'.repeat(stars)]],lv===LEVELS.length-1?'Play Again':'Next Spot',()=>{startLevel(lv===LEVELS.length-1?lv:lv+1);});
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
  'Flick up from the bottom to cast. Hold longer for a more powerful cast. When the bobber dips - TAP (or SHAKE the phone!) to reel in. Watch the tension bar above the reel bar: reel too fast and the line snaps. Swipe left or right to follow the fish\'s direction.',
  [['Hotspot','Faster bites, rarer fish'],['Combo','Up to ×4 score bonus'],['Trophy','2× points, harder reel']],
  playing?'Resume':'Start Fishing',()=>hideModal());
document.getElementById('restartBtn').onclick=()=>startLevel(lv);
resize();
sv=loadSv();
catchLog=sv.log||[];
showModal('🎣',"Pip's Cozy Cove",
  'Cast into the cove and reel in a catch! Flick up to cast, hold for more power. Tap fast when the bobber dips - but watch the tension!',
  [['Spots',LEVELS.length],['Best',sv.best],['Caught',(sv.total||0)+' total']],'Start Fishing',()=>startLevel(sv.bestLevel||0));
requestAnimationFrame(frame);
