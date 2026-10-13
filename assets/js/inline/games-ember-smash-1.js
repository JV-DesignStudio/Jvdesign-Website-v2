(()=>{
const C=document.getElementById('canvas'),ctx=C.getContext('2d'),$=id=>document.getElementById(id);
const audio=window.AudioEffects?new AudioEffects(.45):null;
const sys=window.GameSystem?new GameSystem('ember-smash','Ember Smash','ember'):null;
const W=900,H=600;
let last=performance.now(),idx=0,score=0,lives=3,playing=true,shake=0;
const keys={left:false,right:false};
const paddle={x:W/2,y:H-40,w:130,h:16};
const ball={x:W/2,y:H-90,vx:0,vy:0,r:11,stuck:true};
let bricks=[];

const LEVELS=[
  {n:'First Spark',rows:['111111111','111111111','111111111']},
  {n:'Forge Row',rows:['011111110','111222111','011111110']},
  {n:'Ember Grid',rows:['222222222','111111111','111111111','111111111']},
  {n:'Coal Stack',rows:['111111111','1.......1','1.22222.1','1.......1','111111111']},
  {n:'Molten Zigzag',rows:['1.1.1.1.1','.1.1.1.1.','2.2.2.2.2','.1.1.1.1.','1.1.1.1.1']},
  {n:'Brick Forge Finale',rows:['222222222','211111112','212222212','211111112','222222222']}
];

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
  onFinish:()=>{playing=false;},
  onRestart:()=>{restartAll();}
}):null);

function fit(){const r=C.getBoundingClientRect(),d=window.devicePixelRatio||1;C.width=Math.round(r.width*d);C.height=Math.round(r.height*d);ctx.setTransform(C.width/W,0,0,C.height/H,0,0);}
addEventListener('resize',fit);setTimeout(fit,50);

function s(n){try{audio?.[n]?.();}catch(e){}}
function toast(m,g=1){const t=$('toast');t.textContent=m;t.className='toast show '+(g?'good':'bad');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1100);}

function buildBricks(){
  bricks=[];
  const cols=9,bw=72,bh=26,gx=8,gy=10,startX=(W-(cols*bw+(cols-1)*gx))/2,startY=84;
  LEVELS[idx].rows.forEach((row,r)=>{
    for(let c=0;c<cols;c++){
      const ch=row[c]||'.';
      if(ch!=='1'&&ch!=='2')continue;
      const hp=ch==='2'?2:1;
      bricks.push({x:startX+c*(bw+gx),y:startY+r*(bh+gy),w:bw,h:bh,hp,max:hp,alive:true,row:r});
    }
  });
}
function resetBall(){ball.stuck=true;ball.x=paddle.x;ball.y=paddle.y-ball.r-8;ball.vx=0;ball.vy=0;}
function serve(){if(!ball.stuck||!playing)return;ball.stuck=false;const dir=Math.random()<.5?-1:1;ball.vx=dir*170;ball.vy=-400;s('playTap');}
function bricksLeft(){return bricks.filter(b=>b.alive).length;}
function hud(){
  $('score').textContent=score;
  $('level').textContent=(idx+1)+'/'+LEVELS.length;
  $('lives').textContent='♥'.repeat(Math.max(0,lives))+'♡'.repeat(Math.max(0,3-lives));
  $('bricks').textContent=bricksLeft();
  $('levelName').textContent=LEVELS[idx].n;
  storyRun?.setScore(score);
}
function loadLevel(){paddle.x=W/2;buildBricks();resetBall();playing=true;clearTimeout(loadLevel.t);hud();}

function levelCleared(){
  const bonus=150+lives*60;
  score+=bonus;
  toast('Forge clear +'+bonus);
  s('playSuccess');
  if(storyRun)storyRun.setScore(score);
  sys?.addScore?.(score);
  if(idx<LEVELS.length-1){idx++;loadLevel();}
  else complete(true);
}
function loseLife(){
  lives--;shake=.2;s('playError');
  if(lives<=0){complete(false);}
  else{resetBall();toast('Missed. '+lives+' left');hud();}
}
function complete(win){
  playing=false;
  if(storyRun){hud();storyRun.finish(win?'success':'fail',score);return;}
  $('complete').innerHTML='<h2>'+(win?'Forge cleared!':'Out of lives')+'</h2><p>Score '+score+'</p><button id="goNext">'+(win?'Play again':'Try again')+'</button>';
  $('complete').classList.add('show');
  $('goNext').onclick=restartAll;
  sys?.saveState?.();
}
function nextLevel(){idx=Math.min(idx+1,LEVELS.length-1);loadLevel();}
function restartAll(){idx=0;score=0;lives=3;playing=true;shake=0;$('complete').classList.remove('show');loadLevel();}

function step(dt){
  if(!playing)return;
  if(keys.left)paddle.x-=560*dt;
  if(keys.right)paddle.x+=560*dt;
  paddle.x=Math.max(paddle.w/2,Math.min(W-paddle.w/2,paddle.x));
  if(ball.stuck){ball.x=paddle.x;ball.y=paddle.y-ball.r-8;return;}
  ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
  if(ball.x<ball.r){ball.x=ball.r;ball.vx=Math.abs(ball.vx);}
  if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx);}
  if(ball.y<ball.r){ball.y=ball.r;ball.vy=Math.abs(ball.vy);}
  if(ball.vy>0&&ball.y+ball.r>=paddle.y-paddle.h/2&&ball.y-ball.r<=paddle.y+paddle.h/2&&ball.x>=paddle.x-paddle.w/2-ball.r&&ball.x<=paddle.x+paddle.w/2+ball.r){
    const rel=Math.max(-1,Math.min(1,(ball.x-paddle.x)/(paddle.w/2)));
    const speed=Math.min(780,Math.hypot(ball.vx,ball.vy)*1.02||470);
    const ang=rel*1.05;
    ball.vx=Math.sin(ang)*speed;ball.vy=-Math.abs(Math.cos(ang)*speed);
    ball.y=paddle.y-paddle.h/2-ball.r-1;
    s('playPop');
  }
  if(ball.y-ball.r>H){loseLife();return;}
  for(let i=0;i<bricks.length;i++){
    const b=bricks[i];if(!b.alive)continue;
    const nx=Math.max(b.x,Math.min(ball.x,b.x+b.w)),ny=Math.max(b.y,Math.min(ball.y,b.y+b.h));
    const dx=ball.x-nx,dy=ball.y-ny;
    if(dx*dx+dy*dy<=ball.r*ball.r){
      const cx=b.x+b.w/2,cy=b.y+b.h/2;
      const ox=(ball.r+b.w/2)-Math.abs(ball.x-cx),oy=(ball.r+b.h/2)-Math.abs(ball.y-cy);
      if(ox<oy){ball.vx=-ball.vx;ball.x+=ball.vx>0?ox:-ox;}
      else{ball.vy=-ball.vy;ball.y+=ball.vy>0?oy:-oy;}
      b.hp--;score+=50;shake=Math.max(shake,.08);s('playPop');
      if(b.hp<=0){b.alive=false;score+=100;s('playSuccess');}
      break;
    }
  }
  if(bricksLeft()===0){levelComplete();}
  hud();
}
function levelComplete(){if(complete.guard)return;complete.guard=true;setTimeout(()=>{complete.guard=false;levelCleared();},0);}

function draw(){
  ctx.save();
  ctx.clearRect(0,0,W,H);
  if(shake>0){shake-=.016;ctx.translate((Math.random()-.5)*9,(Math.random()-.5)*7);}
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#3a0f22');g.addColorStop(.6,'#241019');g.addColorStop(1,'#12060d');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(240,86,122,.14)';
  for(let i=0;i<14;i++){ctx.beginPath();ctx.arc(i*72+30,H-46,52,0,7);ctx.fill();}
  ctx.fillStyle='#5a1230';ctx.fillRect(0,H-44,W,44);
  bricks.forEach(b=>{
    if(!b.alive)return;
    const col=(b.max===2&&b.hp===1)?'#ff7a59':(b.hp>=2?'#ffcf5c':'#f0567a');
    ctx.fillStyle=col;
    ctx.beginPath();
    const r=7,x=b.x,y=b.y,w=b.w,h=b.h;
    ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.28)';
    ctx.fillRect(x+6,y+5,w-12,4);
  });
  const pg=ctx.createLinearGradient(0,paddle.y-8,0,paddle.y+8);
  pg.addColorStop(0,'#ffcf5c');
  pg.addColorStop(.5,'#f0567a');
  pg.addColorStop(1,'#b13057');
  ctx.fillStyle=pg;
  ctx.beginPath();
  const pr=9,px=paddle.x-paddle.w/2,py=paddle.y-paddle.h/2,pw=paddle.w,ph=paddle.h;
  ctx.moveTo(px+pr,py);ctx.arcTo(px+pw,py,px+pw,py+ph,pr);ctx.arcTo(px+pw,py+ph,px,py+ph,pr);ctx.arcTo(px,py+ph,px,py,pr);ctx.arcTo(px,py,px+pw,py,pr);ctx.closePath();ctx.fill();
  ctx.font='20px system-ui';ctx.textAlign='center';ctx.fillText('🐯',paddle.x,paddle.y+7);
  const bg=ctx.createRadialGradient(ball.x,ball.y,2,ball.x,ball.y,ball.r+7);
  bg.addColorStop(0,'#fff6d8');bg.addColorStop(.5,'#ffcf5c');bg.addColorStop(1,'rgba(240,86,122,0)');
  ctx.fillStyle=bg;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r+7,0,7);ctx.fill();
  ctx.font='20px system-ui';ctx.fillText('🔥',ball.x,ball.y+7);
  if(ball.stuck&&playing){ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='700 20px Inter,system-ui,sans-serif';ctx.fillText('Click or press Space to serve',W/2,paddle.y-70);}
  ctx.restore();
}
function loop(n){
  const dt=Math.min(.05,(n-last)/1000);last=n;
  step(dt);draw();
  requestAnimationFrame(loop);
}

function pointerX(e){const r=C.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return (p.clientX-r.left)/r.width*W;}
function movePaddleTo(x){paddle.x=Math.max(paddle.w/2,Math.min(W-paddle.w/2,x));}
C.addEventListener('pointermove',e=>{if(playing)movePaddleTo(pointerX(e));});
C.addEventListener('pointerdown',e=>{if(!playing)return;movePaddleTo(pointerX(e));serve();});
addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keys.left=true;
  else if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keys.right=true;
  else if(e.key===' '||e.key==='Spacebar'){serve();e.preventDefault();}
});
addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keys.left=false;
  else if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keys.right=false;
});
$('reset').onclick=restartAll;
$('retry').onclick=restartAll;
$('next').onclick=nextLevel;

window.__emberSmash={state:()=>({score:score,lives:lives,playing:playing,stuck:ball.stuck,bx:ball.x,by:ball.y,alive:bricks.filter(b=>b.alive).length,level:idx+1,paddleX:paddle.x})};
storyRun?.begin();
loadLevel();
requestAnimationFrame(loop);
})();
