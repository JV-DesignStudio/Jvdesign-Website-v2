(()=>{
const $=id=>document.getElementById(id);
const C=$('canvas'),ctx=C.getContext('2d');
const audio=window.AudioEffects?new AudioEffects(.45):null;
const sys=window.GameSystem?new GameSystem('star-connect','PiP Star Connect','pip'):null;
const W=820,H=620;
const STARS=[[.45,.18],[.55,.18],[.51,.34],[.43,.40],[.51,.45],[.59,.40],[.40,.72],[.62,.72]];
const PATH=[0,2,1,2,3,4,5,2,4,6,4,7];
const NAME='Orion';
const HINT='Look for three bright stars in a short straight line. That belt of stars is the middle of Orion.';
const FACT='Orion is one of the easiest constellations to find. Three bright stars make the belt, two stars mark the shoulders, and two more are the feet, so the hunter stands tall across the winter sky.';
let stars=[],bg=[],nextStep=0,lines=[],score=0,best=(sys&&sys.state&&sys.state.highScore)||0,wrong=0,startT=Date.now(),revealed=false,paused=false,rating=0,flash=-1,flashT=0;
function s(n,arg){try{if(audio&&typeof audio[n]==='function')audio[n](arg);}catch(e){}}
function motionOK(){try{return!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return true;}}
function toast(m,g=1){let t=$('toast');t.textContent=m;t.className='toast show '+(g?'good':'bad');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1400);}
function starTxt(n){return '\u2605'.repeat(n)+'\u2606'.repeat(3-n);}
(function seedBg(){let seed=1337;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};for(let i=0;i<140;i++)bg.push({x:rnd()*W,y:rnd()*H,r:.6+rnd()*1.4,a:.25+rnd()*.5});})();
function toStars(){stars=STARS.map((p,n)=>({x:p[0]*W,y:p[1]*H,i:n}));}
function reset(){nextStep=0;lines=[];score=0;wrong=0;revealed=false;paused=false;rating=0;flash=-1;startT=Date.now();$('reveal').classList.remove('show');$('pauseOverlay').classList.remove('show');$('pause').innerHTML='&#10074;&#10074;';toStars();hud();}
function hud(){$('score').textContent=score;$('level').textContent=revealed?'Found':'1/1';$('rating').textContent=rating+'/3';$('best').textContent=best;$('targetName').textContent=revealed?NAME:'Mystery sky shape';$('targetHint').textContent=revealed?'Sky fact unlocked':HINT;$('tip').textContent=revealed?'Trace again for a cleaner run and more stars.':(nextStep===0?'Tap star 1 to begin tracing.':'Next: tap star '+(PATH[nextStep]+1)+'.');$('book').innerHTML='<div class="entry '+(revealed?'on':'')+'"><b>'+(revealed?NAME:'???')+'</b><span>'+(revealed?FACT:'Trace the glowing route to open this page of the sky book.')+'</span></div>';}
function fit(){const r=C.getBoundingClientRect();if(!r.width)return;const d=window.devicePixelRatio||1;C.width=Math.round(r.width*d);C.height=Math.round(r.height*d);ctx.setTransform(C.width/W,0,0,C.height/H,0,0);}
function draw(){if(!ctx)return;const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#050816');g.addColorStop(.55,'#0b1a38');g.addColorStop(1,'#1b122e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle='#dbeafe';bg.forEach(b=>{ctx.globalAlpha=b.a;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();});ctx.globalAlpha=1;ctx.lineCap='round';lines.forEach(l=>{const a=stars[l[0]],b=stars[l[1]];if(!a||!b)return;ctx.strokeStyle='rgba(147,197,253,.92)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});const need=revealed?-1:PATH[nextStep];const now=Date.now();stars.forEach(st=>{const isNeed=st.i===need;const glow=isNeed?(motionOK()?7+Math.sin(now/300)*2:8):6;if(isNeed){ctx.beginPath();ctx.fillStyle='rgba(253,230,138,.22)';ctx.arc(st.x,st.y,glow+11,0,7);ctx.fill();}ctx.beginPath();ctx.fillStyle=st.i===flash?'#f87171':(isNeed?'#fde68a':'#e0e7ff');ctx.arc(st.x,st.y,glow,0,7);ctx.fill();ctx.fillStyle='rgba(224,231,255,.72)';ctx.font='bold 14px Inter,sans-serif';ctx.fillText(String(st.i+1),st.x+12,st.y-9);});}
function nearest(mx,my){let bestI=-1,bd=1e9;stars.forEach(st=>{const d=Math.hypot(st.x-mx,st.y-my);if(d<bd){bd=d;bestI=st.i;}});return{bestI,bd};}
function tap(mx,my){if(revealed||paused)return;const n=nearest(mx,my);if(n.bd>46)return;const st=stars[n.bestI];if(n.bestI!==PATH[nextStep]){wrong++;flash=n.bestI;flashT=Date.now();s('playError');toast('Almost. Follow the glow to the next star.',0);draw();return;}if(nextStep>0)lines.push([PATH[nextStep-1],PATH[nextStep]]);nextStep++;score+=25;s('playTap');try{if(window.ParticleSystem&&motionOK())ParticleSystem.burst(C.getBoundingClientRect().left+st.x/W*C.getBoundingClientRect().width,C.getBoundingClientRect().top+st.y/H*C.getBoundingClientRect().height,'\u2728',4);}catch(e){}if(nextStep>=PATH.length)complete();hud();draw();}
function complete(){revealed=true;const elapsed=(Date.now()-startT)/1000;rating=wrong===0&&elapsed<12?3:(wrong<=2?2:1);const timeBonus=Math.max(0,Math.round((45-elapsed)*8));score+=400+timeBonus+rating*100;if(score>best)best=score;try{if(sys){if(sys.addScore)sys.addScore(score);if(sys.saveState)sys.saveState();if(sys.recordGamePlay)sys.recordGamePlay();}}catch(e){}try{if(window.ParticleSystem&&motionOK())ParticleSystem.confetti(window.innerWidth/2,window.innerHeight*.35,18);}catch(e){}s('playSuccess');$('revealName').textContent=NAME;$('revealFact').textContent=FACT+' '+starTxt(rating)+' Score '+score+(wrong===0?' with no wrong taps.':'.');$('reveal').classList.add('show');toast('You found '+NAME+'!');hud();}
function undo(){if(revealed||paused)return;if(nextStep<=0||lines.length===0){toast('Nothing to undo yet.',0);return;}lines.pop();nextStep--;score=Math.max(0,score-25);s('playTap');hud();draw();}
function hint(){if(revealed||paused)return;const need=PATH[nextStep];wrong+=1;flash=need;flashT=Date.now();s('playCombo',2);toast('PiP points to star '+(need+1)+'.');draw();hud();}
function togglePause(){if(revealed)return;paused=!paused;if(paused){$('pauseOverlay').classList.add('show');$('pause').innerHTML='&#9654;';}else{$('pauseOverlay').classList.remove('show');$('pause').innerHTML='&#10074;&#10074;';}}
function loop(){const now=Date.now();if(flash>=0&&now-flashT>340)flash=-1;draw();requestAnimationFrame(loop);}
C.addEventListener('pointerdown',e=>{const r=C.getBoundingClientRect();if(!r.width)return;const mx=(e.clientX-r.left)*(W/r.width),my=(e.clientY-r.top)*(H/r.height);tap(mx,my);});
addEventListener('resize',()=>{fit();draw();});
$('reset').onclick=reset;$('hint').onclick=hint;$('undo').onclick=undo;$('pause').onclick=togglePause;const _r=$('resume');if(_r)_r.onclick=togglePause;$('next').onclick=reset;
reset();fit();draw();loop();
})();
