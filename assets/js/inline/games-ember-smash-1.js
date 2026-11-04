(()=>{
const C=document.getElementById('canvas'),ctx=C.getContext('2d'),$=id=>document.getElementById(id);
const audio=window.AudioEffects?new AudioEffects(.45):null;
const sys=window.GameSystem?new GameSystem('ember-smash','Ember Smash','ember'):null;
const motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
let reduceMotion=!!(motionQuery&&motionQuery.matches);
function clearDecorativeFX(){particles.length=0;debris.length=0;trail.length=0;shake=0;flash=0;paddle.squash=0;}
if(motionQuery){const syncMotion=e=>{if(localStorage.getItem('jvds_ember_motion'))return;reduceMotion=e.matches;if(reduceMotion)clearDecorativeFX();else if(embers.length===0)for(let i=0;i<46;i++)embers.push(newEmber({}));};try{motionQuery.addEventListener('change',syncMotion);}catch(e){if(motionQuery.addListener)motionQuery.addListener(syncMotion);}}
const W0=900,H0=600;
let W=W0,H=H0;
let last=performance.now(),idx=0,score=0,lives=3,playing=true,shake=0;
const keys={left:false,right:false};
const paddle={x:W/2,y:H-40,w:130,h:16,squash:0};
const ball={x:W/2,y:H-90,vx:0,vy:0,r:11,stuck:true};
let bricks=[];
let particles=[],pops=[],trail=[],embers=[],debris=[],drops=[],fxT=0,banner={t:0,text:'',sub:''};
let combo=0,flash=0,paused=false,forgeLoop=0;
let mode='campaign',endless=false,cleared=false,runRecorded=false;
let dailyRowsCache=null,dailyValue=0;
let runHistory=[],unlockedForge=1;
const stats={hits:0,misses:0,smashed:0,bestCombo:0,forgeStarted:0,forgeElapsed:0,speedBonuses:0};
const hudCache={};
const effects={wide:0,slow:0,magnet:0,fire:0};
let perks={paddle:0,luck:false,blast:false,shield:0};
function resetPerks(){perks={paddle:0,luck:false,blast:false,shield:0};}
function dropChance(){return perks.luck?.26:.13;}
const DROPS={wide:{col:'#7ee0a6',glow:'rgba(126,224,166,',icon:'↔',label:'Wide paddle'},slow:{col:'#7cc9ff',glow:'rgba(124,201,255,',icon:'❄',label:'Slow spark'},life:{col:'#ff8a5c',glow:'rgba(255,138,92,',icon:'♥',label:'Extra life'},magnet:{col:'#b79cff',glow:'rgba(183,156,255,',icon:'🧲',label:'Spark magnet'},fire:{col:'#ffb56b',glow:'rgba(255,181,107,',icon:'🔥',label:'Fire spark'}};
function newEmber(o){o=o||{};o.x=Math.random()*W;o.y=Math.random()*H;o.r=.8+Math.random()*2.2;o.sp=10+Math.random()*28;o.a=.12+Math.random()*.4;o.ph=Math.random()*6.283;return o;}
if(!reduceMotion)for(let i=0;i<46;i++)embers.push(newEmber({}));

function readStore(key,fallback){try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw);}catch(e){return fallback;}}
function writeStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}
function todayISO(){return new Date().toISOString().slice(0,10);}
function loadProgress(){
  const p=readStore('jvds_ember_progress',{})||{};
  unlockedForge=Math.max(1,Math.min(LEVELS.length,Number(p.unlocked)||1));
  runHistory=Array.isArray(p.runs)?p.runs.slice(0,5):[];
  dailyValue=(p.daily&&p.daily.date===todayISO())?(Number(p.daily.value)||0):0;
}
function saveProgress(){
  writeStore('jvds_ember_progress',{unlocked:unlockedForge,runs:runHistory.slice(0,5),daily:{date:todayISO(),value:dailyValue}});
}
function resetRunStats(){stats.hits=0;stats.misses=0;stats.smashed=0;stats.bestCombo=0;stats.forgeStarted=performance.now();stats.forgeElapsed=0;stats.speedBonuses=0;}
function announce(msg){const el=$('srStatus');if(el)el.textContent=msg;}
function syncMotionBtn(){const b=$('motionBtn');if(!b)return;b.textContent='Motion: '+(reduceMotion?'reduced':'full');b.setAttribute('aria-pressed',String(reduceMotion));}
function applyMotionPref(){
  const stored=localStorage.getItem('jvds_ember_motion');
  reduceMotion=stored==='reduce'?true:stored==='full'?false:!!(motionQuery&&motionQuery.matches);
  if(reduceMotion){clearDecorativeFX();embers.length=0;}
  else if(embers.length===0){for(let i=0;i<46;i++)embers.push(newEmber({}));}
  syncMotionBtn();
}
function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function brickPalette(b){if(b.max>=3)return b.hp<=1?{a:'#e6edf5',b:'#a8b8c8',c:'#5f6f80'}:{a:'#d3dee9',b:'#93a6b9',c:'#4e5e6e'};if(b.max===2&&b.hp<=1)return{a:'#ffb088',b:'#ff7a59',c:'#bb4327'};if(b.hp>=2)return{a:'#ffe79a',b:'#ffcf5c',c:'#c08a1f'};return{a:'#ff9ab2',b:'#f0567a',c:'#a92b52'};}
function spawnBurst(x,y,col,n,pow){if(reduceMotion)return;pow=pow||1;for(let i=0;i<n;i++){const a=Math.random()*6.283,sp=(50+Math.random()*210)*pow;particles.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,g:520,life:.42+Math.random()*.5,max:.92,size:1.5+Math.random()*3,col:col});}if(particles.length>260)particles.splice(0,particles.length-260);}
function addPop(x,y,text,col){pops.push({x:x,y:y,text:text,col:col,life:.9,max:.9});if(pops.length>24)pops.splice(0,pops.length-24);}
function comboMul(){return Math.min(5,1+Math.floor(combo/3));}
function paddleW(){const wide=W<800?210:190,base=W<800?160:130;return (effects.wide>0?wide:base)+perks.paddle*35;}
function dropKind(){const r=Math.random();const maxed=lives>=5;if(r<.34)return 'wide';if(r<.6)return 'slow';if(!maxed&&r<.78)return 'life';return Math.random()<.5?'fire':'magnet';}
function spawnDrop(x,y,kind){if(drops.length>5)return;drops.push({x:x,y:y,vy:120,kind:kind||dropKind(),ph:Math.random()*6.283});}
function spawnDebris(b){if(reduceMotion)return;const p=brickPalette(b);for(let i=0;i<8;i++)debris.push({x:b.x+Math.random()*b.w,y:b.y+Math.random()*b.h,w:7+Math.random()*16,h:5+Math.random()*9,vx:(Math.random()-.5)*280,vy:-140-Math.random()*200,rot:Math.random()*6.283,vr:(Math.random()-.5)*12,life:.65+Math.random()*.5,max:1.15,col:p.b});if(debris.length>110)debris.splice(0,debris.length-110);}
function applyDrop(kind){const k=DROPS[kind];if(!k)return;if(kind==='life'){if(lives>=5){score+=150;addPop(paddle.x,paddle.y-70,'Full hearts +150','#ffcf5c');}else lives=Math.min(5,lives+1);}else if(kind==='wide'){effects.wide=12;}else if(kind==='slow'){effects.slow=8;}else if(kind==='magnet'){effects.magnet=10;}else if(kind==='fire'){effects.fire=7;}spawnBurst(paddle.x,paddle.y-12,k.col,16,1.3);addPop(paddle.x,paddle.y-42,k.label,k.col);toast(k.label,1);announce(k.label+' collected');s('playSuccess');}

const LEVELS=[
  {n:'First Spark',bg:['#3a0f22','#241019','#12060d'],ember:'#ffb56b',rows:['111111111','111111111','111111111']},
  {n:'Forge Row',bg:['#1c1638','#140f2a','#0a0716'],ember:'#b79cff',rows:['011111110','111222111','011111110']},
  {n:'Ember Grid',bg:['#3a0f1a','#240a12','#120408'],ember:'#ff8a6b',rows:['222222222','111111111','111111111','111111111']},
  {n:'Coal Stack',bg:['#1b1b22','#131318','#0a0a0e'],ember:'#c3c3d6',rows:['111111111','1.......1','1.23332.1','1.......1','111111111']},
  {n:'Molten Zigzag',bg:['#3a2208','#241405','#120a02'],ember:'#ffcf5c',rows:['1.1.1.1.1','.1.1.1.1.','2.2.2.2.2','.1.1.1.1.','1.1.1.1.1']},
  {n:'Brick Forge Finale',bg:['#3a2a08','#241a05','#120d02'],ember:'#ffd77a',rows:['222222222','211111112','212333212','211111112','222222222']}
];
const STARTER_FORGE=['111111111','111111111','111111111','222222222','111111111'];
let levels=LEVELS,customMode=false;

const storyRun=window.__storyRun||(window.StoryRun?window.__storyRun=new StoryRun({
  id:'ember-smash',
  gameSystem:sys,
  title:'Ember Smash: Brick Forge',
  character:'Ember',
  open:'Ember has fired up the brick forge and the spark is ready on her paddle.',
  objective:'Bounce the spark into every brick and clear each forge.',
  beats:[
    {at:0,text:'First spark. Line up the paddle and serve.'},
    {at:.4,text:'The forge tightens up and the gold bricks appear.'},
    {at:.8,text:'Last bricks standing. One clean bounce finishes the wall.'}
  ],
  cap:300,
  result:{
    success:'The last brick bursts, embers fly and Ember cheers for a rerun.',
    partial:'The forge still glows, but Ember already sees the better angle.',
    fail:'The spark went cold this time, and Ember is ready to relight it.'
  },
  onFinish:(outcome)=>{playing=false;recordRun(outcome==='success');showBest();},
  onRestart:()=>{restartAll();}
}):null);

function setWorld(portrait){
  const nw=portrait?720:W0,nh=portrait?1000:H0;
  if(nw===W&&nh===H)return;
  const oldW=W,oldH=H;
  W=nw;H=nh;
  relayoutWorld(oldW,oldH);
  for(const e of embers){e.x*=(W/oldW);e.y*=(H/oldH);}
  for(const d of drops){d.x*=(W/oldW);d.y*=(H/oldH);}
  for(const p of particles){p.x*=(W/oldW);p.y*=(H/oldH);}
  for(const d of debris){d.x*=(W/oldW);d.y*=(H/oldH);}
  for(const p of pops){p.x*=(W/oldW);p.y*=(H/oldH);}
}
function relayoutWorld(oldW,oldH){
  const prev=bricks.map(b=>({alive:b.alive,hp:b.hp}));
  paddle.w=paddleW();
  paddle.y=H-40;
  const rx=Math.max(0,Math.min(1,paddle.x/oldW));
  paddle.x=Math.max(paddle.w/2,Math.min(W-paddle.w/2,rx*W));
  buildBricks(prev);
  ball.x=Math.max(ball.r,Math.min(W-ball.r,ball.x/oldW*W));
  ball.y=Math.max(ball.r,Math.min(H-90,ball.y/oldH*H));
  if(ball.stuck){ball.x=paddle.x;ball.y=paddle.y-ball.r-8;}
  trail.length=0;
}
function fit(){
  const d=Math.min(window.devicePixelRatio||1,2);
  const imm=document.documentElement.classList.contains('jvds-immersive');
  let cssW,cssH;
  if(imm){
    const wrap=C.parentElement;
    const availW=(wrap&&wrap.clientWidth)||window.innerWidth;
    const availH=Math.max(220,(wrap&&wrap.clientHeight)||window.innerHeight);
    setWorld(availH>availW*1.08);
    cssW=availW;cssH=cssW*H/W;
    if(cssH>availH){cssH=availH;cssW=cssH*W/H;}
    C.style.width=Math.round(cssW)+'px';
    C.style.height=Math.round(cssH)+'px';
  }else{
    setWorld(window.innerHeight>window.innerWidth*1.08);
    C.style.width='';C.style.height='';C.style.aspectRatio=W+'/'+H;
    cssW=C.getBoundingClientRect().width||W;cssH=cssW*H/W;
  }
  C.width=Math.max(1,Math.round(cssW*d));C.height=Math.max(1,Math.round(cssH*d));
  ctx.setTransform(C.width/W,0,0,C.height/H,0,0);
}
addEventListener('resize',fit);setTimeout(fit,50);addEventListener('load',fit);

function s(n){try{audio?.[n]?.();}catch(e){}}
function toast(m,g=1){const t=$('toast');t.textContent=m;t.className='toast show '+(g?'good':'bad');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1100);}

function buildBricks(prev){
  const portrait=W<800;
  const cols=9,gx=portrait?7:8,gy=10,bh=26,bw=portrait?64:72;
  const startX=(W-(cols*bw+(cols-1)*gx))/2,startY=portrait?96:84;
  const out=[];
  let i=0;
  levels[idx].rows.forEach((row,r)=>{
    for(let c=0;c<cols;c++){
      const ch=row[c]||'.';
      if(ch!=='1'&&ch!=='2'&&ch!=='3')continue;
      const hp=ch==='3'?3:ch==='2'?2:1;
      const old=prev&&prev[i];
      out.push({x:startX+c*(bw+gx),y:startY+r*(bh+gy),w:bw,h:bh,hp:old?old.hp:hp,max:hp,alive:old?old.alive:true,row:r,hit:0});
      i++;
    }
  });
  bricks=out;
}
function resetBall(){ball.stuck=true;ball.x=paddle.x;ball.y=paddle.y-ball.r-8;ball.vx=0;ball.vy=0;trail.length=0;}
function serve(){if(!ball.stuck||!playing||paused)return;wake();ball.stuck=false;const dir=Math.random()<.5?-1:1;const boost=1+forgeLoop*.18;ball.vx=dir*170*boost;ball.vy=-400*boost;s('playTap');}
function bricksLeft(){return bricks.filter(b=>b.alive).length;}
function blastNeighbours(b){
  const bx=b.x+b.w/2,by=b.y+b.h/2;
  for(const o of bricks){
    if(!o.alive||o===b)continue;
    const dx=Math.abs(o.x+o.w/2-bx),dy=Math.abs(o.y+o.h/2-by);
    if(dx<=b.w+14&&dy<=b.h+14)damageBrick(o,false);
  }
}
function damageBrick(b,chain){
  const cx=b.x+b.w/2,cy=b.y+b.h/2,mul=comboMul(),pal=brickPalette(b);
  b.hp--;if(!reduceMotion)b.hit=1;
  spawnBurst(cx,cy,pal.b,6,1);
  if(b.hp<=0){
    b.alive=false;
    stats.smashed++;
    const pts=100*mul;score+=pts;
    s('playSuccess');spawnBurst(cx,cy,pal.b,16,1.5);spawnDebris(b);addPop(cx,cy,'+'+pts,'#ffd77a');
    if(Math.random()<dropChance())spawnDrop(cx,cy);
    if(mul>1)addPop(cx,cy-26,'x'+mul,'#ffcf5c');
    if(chain&&perks.blast)blastNeighbours(b);
  }else{
    const pts=50*mul;score+=pts;addPop(cx,cy,'+'+pts,'#ffb0c4');
    if(mul>1)addPop(cx,cy-26,'x'+mul,'#ffcf5c');
  }
}
function setHudText(id,value){if(hudCache[id]===value)return;hudCache[id]=value;const el=$(id);if(el)el.textContent=value;}
function fmtClock(sec){sec=Math.max(0,Math.floor(sec));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');}
function accuracy(){const tries=stats.hits+stats.misses;return tries?Math.round((stats.hits/tries)*100):100;}
function hud(){
  setHudText('score',String(score));
  setHudText('level',(idx+1)+'/'+levels.length+(forgeLoop>0?' ×'+(forgeLoop+1):''));
  setHudText('lives','♥'.repeat(Math.max(0,lives))+'♡'.repeat(Math.max(0,3-lives)));
  setHudText('bricks',String(bricksLeft()));
  setHudText('levelName',levels[idx].n+(forgeLoop>0?' (loop '+(forgeLoop+1)+')':''));
  setHudText('timer',fmtClock(stats.forgeElapsed));
  setHudText('runStats','Accuracy '+accuracy()+'% · Best combo x'+Math.min(5,1+Math.floor(stats.bestCombo/3))+' · '+stats.smashed+' smashed');
  storyRun?.setScore(score);
}
function loadLevel(){paddle.x=W/2;paddle.w=paddleW();paddle.squash=0;buildBricks();resetBall();playing=true;combo=0;cleared=false;drops.length=0;debris.length=0;effects.wide=0;effects.slow=0;effects.magnet=0;effects.fire=0;stats.forgeStarted=performance.now();stats.forgeElapsed=0;pops.length=0;particles.length=0;trail.length=0;const next=$('next');if(next)next.hidden=true;clearTimeout(loadLevel.t);banner={t:1.5,text:levels[idx].n,sub:'Forge '+(idx+1)+' of '+levels.length};hud();}

function forgeTarget(){return 45+idx*8;}
function levelCleared(){
  cleared=true;
  const bonus=150+lives*60;
  score+=bonus;
  const speed=stats.forgeElapsed<=forgeTarget();
  if(speed){score+=200;stats.speedBonuses++;}
  if(!reduceMotion)flash=1;
  toast('Forge clear +'+bonus+(speed?' · speed +200':''));
  for(let i=0;i<5;i++)spawnBurst(W/2+(i-2)*130,H*.42,['#ffcf5c','#ff7a59','#f0567a'][i%3],14,1.5);
  addPop(W/2,H*.42,'FORGE CLEAR','#ffd77a');
  if(speed)addPop(W/2,H*.32,'SPEED BONUS +200','#7ee0a6');
  s('playSuccess');
  announce('Forge cleared. Score '+score);
  if(storyRun)storyRun.setScore(score);
  if(mode==='campaign'&&idx+1<LEVELS.length){unlockedForge=Math.max(unlockedForge,Math.min(LEVELS.length,idx+2));saveProgress();renderForgeSelect();}
  showBest();
  hud();
  const next=$('next');if(next)next.hidden=false;
  if(idx<levels.length-1){
    if(customMode){idx++;loadLevel();}
    else{playing=false;setTimeout(openUpgrades,650);}
  }
  else if(endless&&!customMode){
    forgeLoop++;idx=0;
    banner={t:2.5,text:'FORGE LOOP '+(forgeLoop+1),sub:'Sparks burn hotter now!'};
    loadLevel();
  }
  else if(storyRun){complete(true);}
  else{forgeLoop++;idx=0;banner={t:2.5,text:'FORGE LOOP '+(forgeLoop+1),sub:'Sparks burn hotter now!'};loadLevel();}
}
function loseLife(){
      if(perks.shield>0){perks.shield--;if(!reduceMotion)shake=.2;combo=0;resetBall();toast('Forge shield saved the spark',1);announce('Forge shield saved the spark');s('playSuccess');hud();return;}
  lives--;stats.misses++;if(!reduceMotion)shake=.2;combo=0;effects.wide=0;effects.slow=0;effects.magnet=0;effects.fire=0;drops.length=0;s('playError');
  if(lives<=0){complete(false);}
  else{resetBall();toast('Missed. '+lives+' left');announce('Spark missed. '+lives+' lives left');hud();}
}
function recordRun(win){
  if(runRecorded)return;
  runRecorded=true;
  if(score>0){
    runHistory.push({v:score,m:mode,d:todayISO(),win:!!win});
    runHistory.sort((a,b)=>b.v-a.v);
    runHistory=runHistory.slice(0,5);
  }
  if(mode==='daily'&&score>dailyValue)dailyValue=score;
  saveProgress();renderRuns();renderDaily();
}
function complete(win){
  playing=false;
  closeUpgrades();
  hidePause();
  recordRun(win);
  if(storyRun){hud();storyRun.finish(win?'success':'fail',score);showBest();sys?.saveState?.();return;}
  sys?.addScore?.(score);
  $('complete').innerHTML='<h2>'+(win?'Forge cleared!':'Out of lives')+'</h2><p>Score '+score+'</p><button id="goNext">'+(win?'Play again':'Try again')+'</button>';
  $('complete').classList.add('show');
  $('goNext').onclick=restartAll;
  showBest();
  sys?.saveState?.();
}
function nextLevel(){if(!cleared)return;idx=Math.min(idx+1,levels.length-1);loadLevel();}
function resetRunClock(){if(!storyRun)return;if(!storyRun.running){storyRun.begin();}else{storyRun.elapsed=0;storyRun.setScore(0);}}
function restartAll(){
  idx=0;score=0;lives=3;playing=true;shake=0;forgeLoop=0;runRecorded=false;
  resetPerks();resetRunStats();closeUpgrades();hidePause();
  $('complete').classList.remove('show');
  resetRunClock();
  loadLevel();
}

const UPGRADES=[
  {id:'paddle',icon:'↔',name:'Wider paddle',desc:'Ember widens the paddle by a third. Stacks twice.',can:()=>perks.paddle<2,apply:()=>{perks.paddle++;}},
  {id:'life',icon:'♥',name:'Extra heart',desc:'Add one life now, up to five.',can:()=>lives<5,apply:()=>{lives=Math.min(5,lives+1);}},
  {id:'luck',icon:'🍀',name:'Ember luck',desc:'Drops fall twice as often for the rest of the run.',can:()=>!perks.luck,apply:()=>{perks.luck=true;}},
  {id:'blast',icon:'💥',name:'Blast bricks',desc:'Every smashed brick cracks the bricks next to it.',can:()=>!perks.blast,apply:()=>{perks.blast=true;}},
  {id:'shield',icon:'🛡',name:'Forge shield',desc:'Save the spark once when it falls. Stacks twice.',can:()=>perks.shield<2,apply:()=>{perks.shield++;}}
];
let upgradeChoices=[];
function pickUpgrades(){
  const pool=UPGRADES.filter(u=>u.can());
  const picks=[];
  while(picks.length<3&&pool.length)picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  while(picks.length<3){
    const n=picks.length+1,amount=250*n;
    picks.push({id:'bonus-'+n,icon:'✨',name:'Spark cache '+n,desc:'Add '+amount+' points to this run right now.',can:()=>true,apply:()=>{score+=amount;}});
  }
  return picks;
}
function openUpgrades(){
  if(playing||customMode||idx>=levels.length-1)return;
  upgradeChoices=pickUpgrades();
  const wrap=$('upgradeChoices');if(!wrap)return;
  wrap.innerHTML='';
  upgradeChoices.forEach(u=>{
    const b=document.createElement('button');
    b.type='button';b.className='upgrade-choice';b.dataset.id=u.id;
    const ic=document.createElement('span');ic.className='ic';ic.textContent=u.icon;
    const txt=document.createElement('span');
    const t=document.createElement('b');t.textContent=u.name;
    const d=document.createElement('em');d.textContent=u.desc;
    txt.appendChild(t);txt.appendChild(d);
    b.appendChild(ic);b.appendChild(txt);
    b.onclick=()=>chooseUpgrade(u);
    wrap.appendChild(b);
  });
  $('upgradeMsg').textContent='';
  $('upgradeOverlay').classList.add('show');
  if(wrap.firstChild)setTimeout(()=>wrap.firstChild.focus(),40);
  announce('Forge clear. Choose a spark upgrade.');
  s('playSuccess');
}
function chooseUpgrade(u){
  u.apply();
  closeUpgrades();
  paused=false;last=performance.now();
  idx++;
  loadLevel();
  renderForgeSelect();
  toast(u.name+' ready');
  announce(u.name+' ready');
}
function closeUpgrades(){
  upgradeChoices=[];
  const el=$('upgradeOverlay');if(el)el.classList.remove('show');
}

function forgePattern(){
  const m=/[#&?]forge=([0-9]{45})/.exec(location.hash)||/[?&]forge=([0-9]{45})/.exec(location.search);
  return m?m[1]:'';
}
function rowsFromPattern(p){
  if(!p||p.length!==45||/[^012]/.test(p)||!/[12]/.test(p))return null;
  const rows=[];
  for(let r=0;r<5;r++)rows.push(p.slice(r*9,r*9+9).replace(/0/g,'.'));
  return rows;
}
function patternFromRows(rows){
  let s='';
  for(let r=0;r<5;r++){const row=(rows[r]||'.........').replace(/[^12.]/g,'.').slice(0,9).padEnd(9,'.');s+=row.replace(/\./g,'0');}
  return s;
}
function forgeHash(pattern){
  try{history.replaceState(null,'',location.pathname+location.search+(pattern?'#forge='+pattern:''));}catch(e){}
}
function setStartCopy(title,text){
  const t=document.querySelector('.start-card h2'),p=document.querySelector('.start-card p');
  if(t)t.textContent=title;
  if(p)p.textContent=text;
}
function useCustom(rows,kind){
  mode=kind||'custom';
  customMode=true;
  levels=[{n:mode==='daily'?'Daily Forge':'Your Forge',bg:['#3a0f22','#241019','#12060d'],ember:'#ffb56b',rows:rows.slice(0,5)}];
  idx=0;score=0;lives=3;forgeLoop=0;playing=true;shake=0;runRecorded=false;
  resetPerks();resetRunStats();closeUpgrades();hidePause();
  $('complete').classList.remove('show');
  setStartCopy(mode==='daily'?'Daily Forge':'Your Forge',mode==='daily'?'A fresh wall for today. Clear it to set today\'s daily score.':'You are playing a wall built in the forge. Serve the spark and clear every brick you painted.');
  resetRunClock();
  loadLevel();
}
function startCampaign(startAt){
  const start=Math.max(0,Math.min(LEVELS.length-1,Number(startAt)||0));
  mode='campaign';customMode=false;levels=LEVELS;idx=start;score=0;lives=3;forgeLoop=0;playing=true;shake=0;runRecorded=false;
  resetPerks();resetRunStats();closeUpgrades();hidePause();
  forgeHash('');
  setStartCopy('Ember Smash',"Bounce the spark off Ember's paddle and smash every glowing brick. Clear all six forges to finish the run.");
  $('complete').classList.remove('show');
  resetRunClock();
  loadLevel();renderForgeSelect();
}
function savedForge(){
  try{return rowsFromPattern(localStorage.getItem('jvds_ember_forge')||'')||null;}catch(e){return null;}
}
const forge={brush:'1',rows:STARTER_FORGE.slice()};
const forgeCells=[];
const forgeEl=$('forgeEditor');
let forgePainting=false,forgePointerPainted=false;
let forgeHistory=[],forgeFuture=[];
function forgeCellRows(){return (customMode&&levels[0]&&levels[0].rows)?levels[0].rows:STARTER_FORGE;}
function syncForgeButtons(){const u=$('forgeUndo'),r=$('forgeRedo');if(u)u.disabled=!forgeHistory.length;if(r)r.disabled=!forgeFuture.length;}
function pushForgeHistory(){forgeHistory.push(forge.rows.slice());if(forgeHistory.length>60)forgeHistory.shift();forgeFuture.length=0;syncForgeButtons();}
function syncForgeCell(r,c){
  const ch=(forge.rows[r]||'.........')[c]||'.';
  const b=forgeCells[r*9+c];if(!b)return;
  b.classList.toggle('brick',ch==='1');
  b.classList.toggle('gold',ch==='2');
  b.setAttribute('aria-pressed',ch==='.'?'false':'true');
  b.setAttribute('aria-label','Row '+(r+1)+', column '+(c+1)+', '+(ch==='2'?'gold brick':ch==='1'?'brick':'empty'));
}
function setGridTabStop(r,c){
  for(let i=0;i<forgeCells.length;i++){
    const cell=forgeCells[i];
    cell.tabIndex=(Math.floor(i/9)===r&&i%9===c)?0:-1;
  }
}
function buildForgeGrid(){
  if(!forgeEl||forgeCells.length)return;
  for(let r=0;r<5;r++){
    for(let c=0;c<9;c++){
      const b=document.createElement('button');
      b.type='button';b.className='forge-cell';b.dataset.r=r;b.dataset.c=c;
      b.tabIndex=(r===0&&c===0)?0:-1;
      b.addEventListener('pointerdown',e=>{e.preventDefault();forgePainting=true;pushForgeHistory();paintForge(r,c);forgePointerPainted=true;});
      b.addEventListener('pointerenter',()=>{if(forgePainting)paintForge(r,c);});
      b.addEventListener('click',()=>{if(forgePointerPainted){forgePointerPainted=false;return;}pushForgeHistory();paintForge(r,c);});
      $('forgeGrid').appendChild(b);forgeCells.push(b);
    }
  }
  $('forgeGrid').addEventListener('keydown',e=>{
    const cell=e.target.closest&&e.target.closest('.forge-cell');
    if(!cell)return;
    let r=Number(cell.dataset.r),c=Number(cell.dataset.c);
    if(e.key==='ArrowLeft')c=(c+8)%9;
    else if(e.key==='ArrowRight')c=(c+1)%9;
    else if(e.key==='ArrowUp')r=(r+4)%5;
    else if(e.key==='ArrowDown')r=(r+1)%5;
    else if(e.key==='Home')c=0;
    else if(e.key==='End')c=8;
    else return;
    e.preventDefault();
    setGridTabStop(r,c);
    forgeCells[r*9+c].focus();
  });
}
function paintForge(r,c){
  let ch=forge.brush;
  if(ch==='checker')ch=(r+c)%2?'1':'2';
  else if(ch==='random')ch=['1','1','1','2','.'][Math.floor(Math.random()*5)];
  const row=(forge.rows[r]||'.........').split('');
  row[c]=ch;
  forge.rows[r]=row.join('');
  syncForgeCell(r,c);
  setGridTabStop(r,c);
  const msg=$('forgeMsg');if(msg)msg.textContent='';
}
function setForgeBrush(v){
  forge.brush=v;
  document.querySelectorAll('.forge-tools [data-brush]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.brush===v?'true':'false'));
}
function renderForge(rows){
  forge.rows=rows.map(r=>(r||'.........').replace(/[^12.]/g,'.').slice(0,9).padEnd(9,'.'));
  for(let r=0;r<5;r++)for(let c=0;c<9;c++)syncForgeCell(r,c);
}
function openForge(){
  buildForgeGrid();setForgeBrush('1');
  renderForge(customMode?forgeCellRows():(savedForge()||forgeCellRows()));
  forgeHistory.length=0;forgeFuture.length=0;syncForgeButtons();
  setGridTabStop(0,0);
  $('forgeCampaign').hidden=!customMode;
  $('forgeMsg').textContent='';
  forgeEl.classList.add('show');
  if(forgeCells[0])setTimeout(()=>forgeCells[0].focus(),40);
}
function closeForge(){forgeEl.classList.remove('show');}
function playForge(){
  const pattern=patternFromRows(forge.rows);
  if(!/[12]/.test(pattern)){$('forgeMsg').textContent='Add at least one brick before you play.';return;}
  try{localStorage.setItem('jvds_ember_forge',pattern);}catch(e){}
  forgeHash(pattern);
  closeForge();wake();
  useCustom(rowsFromPattern(pattern));
  if(window.JVDSGameShell&&window.JVDSGameShell.enter)window.JVDSGameShell.enter();
}
function shareForge(){
  const pattern=patternFromRows(forge.rows);
  try{localStorage.setItem('jvds_ember_forge',pattern);}catch(e){}
  const url=location.href.split('#')[0]+'#forge='+pattern;
  const ok=()=>{const m=$('forgeMsg');if(m)m.textContent='Link copied. Send it to a friend.';};
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(ok).catch(()=>prompt('Copy this link',url));
    else prompt('Copy this link',url);
  }catch(e){prompt('Copy this link',url);}
}
document.addEventListener('pointerup',()=>{forgePainting=false;});
$('forgeOpenStart').onclick=openForge;
$('forgeHud').onclick=openForge;
$('forgeClose').onclick=closeForge;
$('forgePlay').onclick=playForge;
$('forgeShare').onclick=shareForge;
$('forgeCampaign').onclick=()=>{closeForge();startCampaign();wake();};
$('forgeClear').onclick=()=>{pushForgeHistory();renderForge(['.........','.........','.........','.........','.........']);};
$('forgeStarter').onclick=()=>{pushForgeHistory();renderForge(STARTER_FORGE.slice());};
$('forgeUndo').onclick=()=>{if(!forgeHistory.length)return;forgeFuture.push(forge.rows.slice());renderForge(forgeHistory.pop());syncForgeButtons();};
$('forgeRedo').onclick=()=>{if(!forgeFuture.length)return;forgeHistory.push(forge.rows.slice());renderForge(forgeFuture.pop());syncForgeButtons();};
document.querySelectorAll('.forge-tools [data-brush]').forEach(b=>b.onclick=()=>setForgeBrush(b.dataset.brush));
addEventListener('keydown',e=>{if(e.key==='Escape'&&forgeEl.classList.contains('show')){e.stopPropagation();closeForge();}},true);

function hitBricks(fire){
  for(let i=0;i<bricks.length;i++){
    const b=bricks[i];if(!b.alive)continue;
    const nx=Math.max(b.x,Math.min(ball.x,b.x+b.w)),ny=Math.max(b.y,Math.min(ball.y,b.y+b.h));
    const dx=ball.x-nx,dy=ball.y-ny;
    if(dx*dx+dy*dy<=ball.r*ball.r){
      const cx=b.x+b.w/2,cy=b.y+b.h/2;
      if(!fire){
        const ox=(ball.r+b.w/2)-Math.abs(ball.x-cx),oy=(ball.r+b.h/2)-Math.abs(ball.y-cy);
        if(ox<oy){ball.vx=-ball.vx;ball.x+=ball.vx>0?ox:-ox;}
        else{ball.vy=-ball.vy;ball.y+=ball.vy>0?oy:-oy;}
      }
      combo++;stats.hits++;stats.bestCombo=Math.max(stats.bestCombo,combo);
      if(combo===5||combo===10||combo===15||combo===20){
        const bonus=combo*25;score+=bonus;
        addPop(ball.x,ball.y-30,'COMBO +'+bonus,'#7ee0a6');
        toast('Combo x'+combo+' +'+bonus,1);
      }
      if(!reduceMotion)shake=Math.max(shake,.08);s('playPop');
      damageBrick(b,true);
      if(!fire)break;
    }
  }
}
function advanceBall(dt,slow){
  ball.x+=ball.vx*dt*slow;ball.y+=ball.vy*dt*slow;
  if(ball.x<ball.r){ball.x=ball.r;ball.vx=Math.abs(ball.vx);spawnBurst(ball.x,ball.y,'#ffcf5c',3,.6);}
  if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx);spawnBurst(ball.x,ball.y,'#ffcf5c',3,.6);}
  if(ball.y<ball.r){ball.y=ball.r;ball.vy=Math.abs(ball.vy);spawnBurst(ball.x,ball.y,'#ffcf5c',3,.6);}
  if(ball.vy>0&&ball.y+ball.r>=paddle.y-paddle.h/2&&ball.y-ball.r<=paddle.y+paddle.h/2&&ball.x>=paddle.x-paddle.w/2-ball.r&&ball.x<=paddle.x+paddle.w/2+ball.r){
    const rel=Math.max(-1,Math.min(1,(ball.x-paddle.x)/(paddle.w/2)));
    const speed=Math.min(780,Math.hypot(ball.vx,ball.vy)*1.02||470);
    const ang=rel*1.05;
    ball.vx=Math.sin(ang)*speed;ball.vy=-Math.abs(Math.cos(ang)*speed);
    ball.y=paddle.y-paddle.h/2-ball.r-1;
    if(!reduceMotion)paddle.squash=1;combo=0;
    spawnBurst(ball.x,ball.y,'#ffcf5c',5,.8);s('playPop');
  }
  if(ball.y-ball.r>H){loseLife();return false;}
  hitBricks(effects.fire>0);
  if(Math.abs(ball.vy)<45)ball.vy=ball.vy<0?-45:45;
  return true;
}
function step(dt){
  if(!playing||paused)return;
  stats.forgeElapsed+=dt;
  paddle.w=paddleW();
  if(keys.left)paddle.x-=560*dt;
  if(keys.right)paddle.x+=560*dt;
  paddle.x=Math.max(paddle.w/2,Math.min(W-paddle.w/2,paddle.x));
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];
    if(effects.magnet>0){d.x+=(paddle.x-d.x)*Math.min(1,dt*8);d.x=Math.max(12,Math.min(W-12,d.x));}
    if(d.y>=paddle.y-paddle.h-8&&d.y<=paddle.y+paddle.h+12&&Math.abs(d.x-paddle.x)<paddle.w/2+(effects.magnet>0?90:22)){applyDrop(d.kind);drops.splice(i,1);}
  }
  if(ball.stuck){ball.x=paddle.x;ball.y=paddle.y-ball.r-8;return;}
  const slow=effects.slow>0?.66:1;
  const dist=Math.hypot(ball.vx,ball.vy)*slow*dt;
  const steps=Math.max(1,Math.min(10,Math.ceil(dist/8)));
  const slice=dt/steps;
  let alive=true;
  for(let i=0;i<steps;i++){if(!advanceBall(slice,slow)){alive=false;break;}}
  if(!reduceMotion){trail.push({x:ball.x,y:ball.y});if(trail.length>14)trail.shift();}
  if(!alive)return;
  if(bricksLeft()===0){levelComplete();}
  hud();
}
function levelComplete(){if(complete.guard)return;complete.guard=true;setTimeout(()=>{complete.guard=false;levelCleared();},0);}

function updateFX(dt){
  fxT+=dt;
  if(!reduceMotion)for(const e of embers){e.y-=e.sp*dt;e.x+=Math.sin(fxT*1.3+e.ph)*12*dt;if(e.y<-12)newEmber(e);}
  if(!reduceMotion)for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
  for(let i=pops.length-1;i>=0;i--){if(!reduceMotion)pops[i].y-=36*dt;pops[i].life-=dt;if(pops[i].life<=0)pops.splice(i,1);}
  for(const b of bricks)if(b.hit>0)b.hit=Math.max(0,b.hit-dt*4);
  if(!reduceMotion)for(let i=debris.length-1;i>=0;i--){const d=debris[i];d.vy+=760*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.vr*dt;d.life-=dt;if(d.life<=0||d.y>H+40)debris.splice(i,1);}
  for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.y+=d.vy*dt;if(d.y>H+30)drops.splice(i,1);}
  for(const key in effects)if(effects[key]>0)effects[key]=Math.max(0,effects[key]-dt);
  if(paddle.squash>0)paddle.squash=Math.max(0,paddle.squash-dt*5);
  if(flash>0)flash=Math.max(0,flash-dt*2.2);
  if(banner.t>0)banner.t=Math.max(0,banner.t-dt);
}

function draw(){
  ctx.save();
  ctx.clearRect(0,0,W,H);
  if(!reduceMotion&&shake>0){shake-=.016;ctx.translate((Math.random()-.5)*9,(Math.random()-.5)*7);}
  const th=levels[idx].bg,emberCol=levels[idx].ember;
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,th[0]);g.addColorStop(.6,th[1]);g.addColorStop(1,th[2]);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const pulse=reduceMotion?.5:.5+.5*Math.sin(fxT*2);
  const fg=ctx.createRadialGradient(W/2,H,10,W/2,H,380);
  fg.addColorStop(0,'rgba(255,157,46,'+(0.16+0.09*pulse)+')');fg.addColorStop(1,'rgba(255,157,46,0)');
  ctx.fillStyle=fg;ctx.fillRect(0,H-300,W,300);
  if(!reduceMotion)for(const e of embers){ctx.globalAlpha=e.a*(0.6+0.4*Math.sin(fxT*3+e.ph));ctx.fillStyle=emberCol;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,7);ctx.fill();}
  ctx.globalAlpha=1;
  if(lives===1){const dp=reduceMotion?.5:.5+.5*Math.sin(fxT*3);const dv=ctx.createRadialGradient(W/2,H/2,H*.16,W/2,H/2,H*.72);dv.addColorStop(0,'rgba(200,20,40,0)');dv.addColorStop(1,'rgba(200,20,40,'+(0.14+0.16*dp)+')');ctx.fillStyle=dv;ctx.fillRect(0,0,W,H);}
  ctx.fillStyle='rgba(240,86,122,.12)';
  for(let i=0;i<14;i++){ctx.beginPath();ctx.arc(i*72+30,H-46,52,0,7);ctx.fill();}
  ctx.fillStyle='#5a1230';ctx.fillRect(0,H-44,W,44);
  ctx.fillStyle='rgba(255,207,92,.12)';ctx.fillRect(0,H-44,W,3);
  bricks.forEach(b=>{
    if(!b.alive)return;
    const p=brickPalette(b),x=b.x,y=b.y,w=b.w,h=b.h,r=7;
    ctx.fillStyle='rgba(0,0,0,.34)';roundRect(x+2,y+3,w,h,r);ctx.fill();
    const lg=ctx.createLinearGradient(0,y,0,y+h);
    lg.addColorStop(0,p.a);lg.addColorStop(.52,p.b);lg.addColorStop(1,p.c);
    ctx.fillStyle=lg;roundRect(x,y,w,h,r);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.34)';roundRect(x+6,y+4,w-12,5,3);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=2;roundRect(x+1,y+1,w-2,h-2,r-1);ctx.stroke();
    if(b.max>=2&&b.hp<b.max){
      ctx.strokeStyle='rgba(90,20,10,.45)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x+w*.34,y+4);ctx.lineTo(x+w*.46,y+h-5);ctx.moveTo(x+w*.62,y+3);ctx.lineTo(x+w*.52,y+h-4);ctx.stroke();
    }
    if(b.hit>0){ctx.fillStyle='rgba(255,255,255,'+(b.hit*.7)+')';roundRect(x,y,w,h,r);ctx.fill();}
  });
  if(!reduceMotion)for(const d of debris){const a=Math.max(0,d.life/d.max);ctx.globalAlpha=a;ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=d.col;ctx.fillRect(-d.w/2,-d.h/2,d.w,d.h);ctx.restore();}
  ctx.globalAlpha=1;
  for(const d of drops){const k=DROPS[d.kind],pl=reduceMotion?.5:.5+.5*Math.sin(fxT*4+d.ph);ctx.save();ctx.translate(d.x,d.y);ctx.globalAlpha=.4+.35*pl;ctx.fillStyle=k.glow+'1)';ctx.beginPath();ctx.arc(0,0,26,0,7);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=k.col;roundRect(-16,-13,32,26,9);ctx.fill();ctx.fillStyle='rgba(20,6,12,.5)';ctx.font='700 17px system-ui';ctx.textAlign='center';ctx.fillText(k.icon,0,6);ctx.restore();}
  ctx.globalAlpha=1;
  if(!reduceMotion)for(const p of particles){const a=Math.max(0,p.life/p.max);ctx.globalAlpha=a;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.size*a+0.5,0,7);ctx.fill();}
  ctx.globalAlpha=1;
  const padGlow=ctx.createRadialGradient(paddle.x,paddle.y,4,paddle.x,paddle.y,92);
  padGlow.addColorStop(0,'rgba(255,207,92,.34)');padGlow.addColorStop(1,'rgba(255,207,92,0)');
  ctx.fillStyle=padGlow;ctx.beginPath();ctx.arc(paddle.x,paddle.y,92,0,7);ctx.fill();
  const sq=paddle.squash||0,pw=paddle.w*(1+.14*sq),ph=paddle.h*(1-.4*sq);
  const pg=ctx.createLinearGradient(0,paddle.y-ph,0,paddle.y+ph);
  pg.addColorStop(0,'#ffe79a');pg.addColorStop(.5,'#f0567a');pg.addColorStop(1,'#8f2246');
  ctx.fillStyle=pg;
  const pr=9,px=paddle.x-pw/2,py=paddle.y-ph/2;
  roundRect(px,py,pw,ph,pr);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)';roundRect(px+8,py+2,pw-16,3,2);ctx.fill();
  ctx.font='20px system-ui';ctx.textAlign='center';ctx.fillText('🐯',paddle.x,paddle.y+7);
  if(!reduceMotion)for(let i=0;i<trail.length;i++){const t=trail[i],k=i/trail.length;ctx.globalAlpha=k*.5;ctx.fillStyle='#ffcf5c';ctx.beginPath();ctx.arc(t.x,t.y,ball.r*k+2,0,7);ctx.fill();}
  ctx.globalAlpha=1;
  const bg2=ctx.createRadialGradient(ball.x,ball.y,2,ball.x,ball.y,ball.r+9);
  bg2.addColorStop(0,'#fff6d8');bg2.addColorStop(.5,'#ffcf5c');bg2.addColorStop(1,'rgba(240,86,122,0)');
  ctx.fillStyle=bg2;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r+9,0,7);ctx.fill();
  ctx.font='20px system-ui';ctx.fillText('🔥',ball.x,ball.y+7);
  for(const p of pops){const a=Math.max(0,p.life/p.max);ctx.globalAlpha=a;ctx.font='800 22px Inter,system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillText(p.text,p.x+1,p.y+1);ctx.fillStyle=p.col;ctx.fillText(p.text,p.x,p.y);}
  ctx.globalAlpha=1;
  if(combo>=2){const mul=comboMul(),pu=reduceMotion?.5:.5+.5*Math.sin(fxT*6);ctx.textAlign='left';ctx.font='900 '+(23+4*pu)+'px Inter,system-ui,sans-serif';ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillText('🔥 x'+mul,27,45);ctx.fillStyle='#ffd77a';ctx.fillText('🔥 x'+mul,25,43);ctx.textAlign='center';}
  let chipY=34;
  for(const key in effects){if(effects[key]>0){const k=DROPS[key];if(!k)continue;ctx.textAlign='left';ctx.font='800 15px Inter,system-ui,sans-serif';const lab=k.icon+' '+Math.ceil(effects[key])+'s',wch=ctx.measureText(lab).width+22;ctx.fillStyle='rgba(0,0,0,.42)';roundRect(W-wch-16,chipY-20,wch,28,14);ctx.fill();ctx.fillStyle=k.col;ctx.fillText(lab,W-wch-5,chipY);ctx.textAlign='center';chipY+=34;}}
  if(perks.shield>0){ctx.textAlign='left';ctx.font='800 15px Inter,system-ui,sans-serif';const lab='🛡 x'+perks.shield,wch=ctx.measureText(lab).width+22;ctx.fillStyle='rgba(0,0,0,.42)';roundRect(W-wch-16,chipY-20,wch,28,14);ctx.fill();ctx.fillStyle='#7ee0a6';ctx.fillText(lab,W-wch-5,chipY);ctx.textAlign='center';}
  if(ball.stuck&&playing){const a=reduceMotion?1:.62+.38*Math.sin(fxT*4);ctx.globalAlpha=a;ctx.fillStyle='#fff';ctx.font='700 20px Inter,system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('Click or press Space to serve',W/2,paddle.y-70);ctx.globalAlpha=1;}
  if(banner.t>0){
    const appear=reduceMotion?1:Math.min(1,(1.5-banner.t)/.3),fade=reduceMotion?1:Math.min(1,banner.t/.5),a=Math.max(0,Math.min(appear,fade));
    ctx.globalAlpha=a;ctx.textAlign='center';
    ctx.fillStyle='rgba(18,6,12,.6)';roundRect(W/2-200,H*.46-58,400,86,18);ctx.fill();
    ctx.strokeStyle='rgba(255,207,92,.5)';ctx.lineWidth=2;roundRect(W/2-200,H*.46-58,400,86,18);ctx.stroke();
    ctx.fillStyle='#ffcf5c';ctx.font='900 38px Inter,system-ui,sans-serif';ctx.fillText(banner.text,W/2,H*.46-6);
    ctx.fillStyle='#ffb0c4';ctx.font='800 17px Inter,system-ui,sans-serif';ctx.fillText(banner.sub,W/2,H*.46+22);
    ctx.globalAlpha=1;
  }
  if(!reduceMotion&&flash>0){ctx.fillStyle='rgba(255,244,220,'+(flash*.45)+')';ctx.fillRect(0,0,W,H);}
  ctx.restore();
}
function loop(n){
  const dt=Math.min(.05,(n-last)/1000);last=n;
  step(dt);updateFX(dt);draw();
  requestAnimationFrame(loop);
}

function pointerX(e){const r=C.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return (p.clientX-r.left)/r.width*W;}
function movePaddleTo(x){paddle.x=Math.max(paddle.w/2,Math.min(W-paddle.w/2,x));}
function startVisible(){const o=$('startOverlay');return !!o&&!o.classList.contains('hide');}
function showPause(){
  if(paused||!playing||startVisible())return;
  if(($('upgradeOverlay')&&$('upgradeOverlay').classList.contains('show'))||forgeEl.classList.contains('show'))return;
  paused=true;
  const o=$('pauseOverlay');if(o)o.classList.add('show');
  const r=$('pauseResume');if(r)setTimeout(()=>r.focus(),30);
  announce('Paused');
}
function hidePause(){if(!paused)return;paused=false;last=performance.now();const o=$('pauseOverlay');if(o)o.classList.remove('show');}
function togglePause(){if(paused)hidePause();else showPause();}
C.addEventListener('pointermove',e=>{if(playing&&!paused)movePaddleTo(pointerX(e));});
C.addEventListener('pointerdown',e=>{if(!playing||paused)return;movePaddleTo(pointerX(e));serve();});
addEventListener('keydown',e=>{
  if(e.key==='p'||e.key==='P'){if(!e.repeat)togglePause();e.preventDefault();return;}
  if(e.key==='Escape'&&paused){hidePause();e.preventDefault();return;}
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keys.left=true;
  else if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keys.right=true;
  else if(e.key===' '||e.key==='Spacebar'){
    if(startVisible()){e.preventDefault();wake();return;}
    serve();e.preventDefault();
  }
  else if(e.key==='Enter'&&startVisible()){wake();}
});
addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keys.left=false;
  else if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keys.right=false;
});
$('reset').onclick=restartAll;
$('retry').onclick=restartAll;
$('next').onclick=nextLevel;
$('pause').onclick=togglePause;
$('pauseResume').onclick=hidePause;
$('pauseRestart').onclick=()=>{hidePause();restartAll();wake();};
// Auto-pause on tab switch (and the shared arcade-menu pause button).
try{if(typeof GameUI!=='undefined'&&GameUI.autoPause)GameUI.autoPause({pause:()=>{if(!playing||paused)return false;paused=true;return true;},resume:()=>{paused=false;last=performance.now();}});}catch(e){}

function wake(){const o=$('startOverlay');if(o)o.classList.add('hide');try{C.focus({preventScroll:true});}catch(e){}}
function showBest(){const el=$('startBest');if(!el)return;const saved=(sys&&sys.state&&sys.state.highScore)||0;const b=Math.max(saved,score);el.textContent=(typeof b.toLocaleString==='function')?b.toLocaleString():String(b);}
const playBtn=$('playBtn');if(playBtn)playBtn.onclick=()=>{wake();s('playTap');};
const soundBtn=$('soundBtn');
function syncSound(){if(soundBtn)soundBtn.textContent=localStorage.getItem('jvds_sound')==='0'?'🔇':'🔊';}
if(soundBtn)soundBtn.onclick=()=>{const muted=localStorage.getItem('jvds_sound')==='0';localStorage.setItem('jvds_sound',muted?'1':'0');syncSound();s('playTap');};
syncSound();

function setEndless(on){endless=!!on;const b=$('endlessBtn');if(b){b.textContent='Endless: '+(endless?'on':'off');b.setAttribute('aria-pressed',String(endless));}}
function renderForgeSelect(){
  const wrap=$('forgeSelect');if(!wrap)return;
  wrap.innerHTML='';
  for(let i=0;i<LEVELS.length;i++){
    const b=document.createElement('button');
    b.type='button';b.className='start-forge-btn';
    b.textContent=(i+1)+'. '+LEVELS[i].n;
    b.disabled=(i+1)>unlockedForge;
    b.setAttribute('aria-pressed',String(mode==='campaign'&&idx===i));
    b.onclick=()=>{wake();startCampaign(i);s('playTap');};
    wrap.appendChild(b);
  }
}
function renderRuns(){
  const list=$('runList');if(!list)return;
  list.innerHTML='';
  if(!runHistory.length){
    const li=document.createElement('li'),s=document.createElement('span');
    s.textContent='No runs yet';li.appendChild(s);list.appendChild(li);return;
  }
  for(const r of runHistory.slice(0,5)){
    const li=document.createElement('li');
    const b=document.createElement('b');b.textContent=Number(r.v||0).toLocaleString();
    const s=document.createElement('span');
    s.textContent=(r.m==='daily'?'Daily':r.m==='custom'?'Your forge':'Campaign')+(r.win?' · clear':'');
    li.appendChild(b);li.appendChild(s);list.appendChild(li);
  }
}
function renderDaily(){const el=$('dailyBest');if(el)el.textContent=String(dailyValue||0);}
function hash32(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function dailyRows(date){
  const key=typeof date==='string'?date:new Date(date||Date.now()).toISOString().slice(0,10);
  if(dailyRowsCache&&dailyRowsCache.key===key)return dailyRowsCache.rows.slice();
  const rnd=mulberry32(hash32('ember-daily-'+key));
  const rows=[];
  for(let r=0;r<5;r++){
    let row='';
    for(let c=0;c<9;c++){const v=rnd();row+=v<.16?'2':v<.6?'1':'.';}
    rows.push(row);
  }
  rows[0]=rows[0].replace(/[.2]/g,'1');
  if(!/[12]/.test(rows.join('')))rows[2]='111111111';
  dailyRowsCache={key:key,rows:rows};
  return rows.slice();
}
function startDaily(){
  const rows=dailyRows(todayISO());
  forgeHash('');
  closeUpgrades();hidePause();closeForge();wake();
  useCustom(rows,'daily');
  renderForgeSelect();renderRuns();renderDaily();
  announce('Daily forge loaded');
  s('playTap');
}
if($('endlessBtn'))$('endlessBtn').onclick=()=>{setEndless(!endless);announce('Endless mode '+(endless?'on':'off'));};
if($('dailyBtn'))$('dailyBtn').onclick=startDaily;
if($('motionBtn'))$('motionBtn').onclick=()=>{
  reduceMotion=!reduceMotion;
  localStorage.setItem('jvds_ember_motion',reduceMotion?'reduce':'full');
  if(reduceMotion){clearDecorativeFX();embers.length=0;}
  else if(embers.length===0){for(let i=0;i<46;i++)embers.push(newEmber({}));}
  syncMotionBtn();announce('Motion '+(reduceMotion?'reduced':'full'));
};

window.__emberSmash={
  state:()=>({
    score:score,lives:lives,playing:playing,stuck:ball.stuck,bx:ball.x,by:ball.y,vx:ball.vx,vy:ball.vy,
    alive:bricks.filter(b=>b.alive).length,level:idx+1,paddleX:paddle.x,paddleW:paddle.w,
    combo:combo,drops:drops.length,forgeLoop:forgeLoop,custom:customMode,reducedMotion:reduceMotion,
    particles:particles.length,debris:debris.length,embers:embers.length,shake:shake,
    upgrades:{paddle:perks.paddle,luck:perks.luck,blast:perks.blast,shield:perks.shield},
    choices:upgradeChoices.map(u=>u.id),mode:mode,endless:endless,cleared:cleared,
    timer:stats.forgeElapsed,stats:{hits:stats.hits,misses:stats.misses,smashed:stats.smashed,bestCombo:stats.bestCombo,speedBonuses:stats.speedBonuses},
    effects:{wide:effects.wide,slow:effects.slow,magnet:effects.magnet,fire:effects.fire},
    runs:runHistory.slice(0,5),unlocked:unlockedForge,dailyValue:dailyValue,paused:paused,
    best:(sys&&sys.state&&sys.state.highScore)||0
  }),
  wake:()=>wake(),
  clearWall:()=>{for(const b of bricks)b.alive=false;levelComplete();},
  startAt:(i)=>{wake();startCampaign(i);},
  setBall:(o)=>{Object.assign(ball,o||{});},
  setEffect:(name,sec)=>{if(name in effects)effects[name]=Math.max(0,Number(sec)||0);},
  forceDrop:(kind)=>{spawnDrop(paddle.x,paddle.y-30,kind);const d=drops[drops.length-1];if(d)d.y=paddle.y-2;},
  setPerks:(p)=>{if(p&&typeof p==='object')Object.assign(perks,p);},
  setLives:(n)=>{lives=Math.max(0,Math.min(5,Number(n)||0));hud();},
  dailyRows:(d)=>dailyRows(d||todayISO()),
  endRun:(win)=>complete(!!win),
  loseLife:()=>loseLife(),
  bricks:()=>bricks.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,hp:b.hp,max:b.max,alive:b.alive})),
  openForge:()=>openForge(),
  closeForge:()=>closeForge(),
  startDaily:()=>startDaily(),
  resetProgress:()=>{unlockedForge=1;runHistory=[];dailyValue=0;saveProgress();renderForgeSelect();renderRuns();renderDaily();}
};
loadProgress();
setEndless(false);
renderForgeSelect();renderRuns();renderDaily();
applyMotionPref();
storyRun?.begin();
const sharedForge=rowsFromPattern(forgePattern());
if(sharedForge)useCustom(sharedForge);else loadLevel();
showBest();
setTimeout(()=>{if(startVisible()&&playBtn)playBtn.focus();},80);
requestAnimationFrame(loop);
})();
