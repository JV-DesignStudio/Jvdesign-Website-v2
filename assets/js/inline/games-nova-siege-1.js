(function(){
'use strict';
/* ============================ PIXEL FONT ============================
   A compact 5x7 bitmap font so the in-game HUD and title match the chunky
   green arcade type of the original. No external font needed. */
var FONT={
'A':['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
'B':['####.','#...#','#...#','####.','#...#','#...#','####.'],
'C':['.###.','#...#','#....','#....','#....','#...#','.###.'],
'D':['####.','#...#','#...#','#...#','#...#','#...#','####.'],
'E':['#####','#....','#....','####.','#....','#....','#####'],
'F':['#####','#....','#....','####.','#....','#....','#....'],
'G':['.###.','#...#','#....','#.###','#...#','#...#','.###.'],
'H':['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
'I':['#####','..#..','..#..','..#..','..#..','..#..','#####'],
'J':['..###','...#.','...#.','...#.','...#.','#..#.','.##..'],
'K':['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],
'L':['#....','#....','#....','#....','#....','#....','#####'],
'M':['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
'N':['#...#','##..#','##..#','#.#.#','#..##','#..##','#...#'],
'O':['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
'P':['####.','#...#','#...#','####.','#....','#....','#....'],
'Q':['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],
'R':['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
'S':['.####','#....','#....','.###.','....#','....#','####.'],
'T':['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
'U':['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
'V':['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
'W':['#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#'],
'X':['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
'Y':['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],
'Z':['#####','....#','...#.','..#..','.#...','#....','#####'],
'0':['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],
'1':['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
'2':['.###.','#...#','....#','...#.','..#..','.#...','#####'],
'3':['####.','....#','....#','.###.','....#','....#','####.'],
'4':['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],
'5':['#####','#....','####.','....#','....#','#...#','.###.'],
'6':['..##.','.#...','#....','####.','#...#','#...#','.###.'],
'7':['#####','....#','...#.','..#..','.#...','.#...','.#...'],
'8':['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],
'9':['.###.','#...#','#...#','.####','....#','...#.','.##..'],
' ' :['.....','.....','.....','.....','.....','.....','.....'],
'!':['..#..','..#..','..#..','..#..','..#..','.....','..#..'],
'.':['.....','.....','.....','.....','.....','.....','..#..'],
':':['.....','..#..','..#..','.....','..#..','..#..','.....'],
'-':['.....','.....','.....','#####','.....','.....','.....'],
'+':['.....','..#..','..#..','#####','..#..','..#..','.....'],
'/':['....#','...#.','...#.','..#..','.#...','.#...','#....'],
'?':['.###.','#...#','....#','...#.','..#..','.....','..#..']
};
function ptext(c,str,x,y,s,fill,outline,align){
  str=String(str).toUpperCase();
  var gw=6*s, w=str.length*gw - s;
  if(align==='right')x-=w; else if(align==='center')x-=Math.round(w/2);
  var ox=0,oy=0,dx,dy;
  function blit(col,ox,oy){c.fillStyle=col;for(var i=0;i<str.length;i++){var g=FONT[str[i]]||FONT['?'];for(var r=0;r<7;r++){for(var q=0;q<5;q++){if(g[r][q]==='#')c.fillRect(x+i*gw+q*s+ox,y+r*s+oy,s,s);}}}}
  if(outline){for(dx=-1;dx<=1;dx++)for(dy=-1;dy<=1;dy++){if(dx||dy)blit(outline,dx*s,dy*s);}}
  blit(fill,0,0);
  return w;
}
/* ============================ SPRITES ============================
   String grids with a colour legend, pre-rendered to offscreen canvases at
   one pixel per cell, then drawn scaled with smoothing off. */
function build(rows,legend){
  var map={};if(Array.isArray(legend)){for(var i=0;i<legend.length;i++)map[legend[i][0]]=legend[i][1];}else map=legend;
  var h=rows.length,w=rows[0].length,cv=document.createElement('canvas');cv.width=w;cv.height=h;
  var x=cv.getContext('2d');
  for(var r=0;r<h;r++)for(var q=0;q<w;q++){var col=map[rows[r][q]];if(col){x.fillStyle=col;x.fillRect(q,r,1,1);}}
  return cv;
}
var SHIP_LEG=[['t','#2fa9c4'],['l','#66d9ee'],['d','#12606f'],['w','#ffffff'],['c','#bfeef7'],['o','#ff8c1a'],['y','#ffd166']];
var SHIP_ROWS=[
'....llll....',
'...lttttl...',
'..lttttttl..',
'..lttttttl..',
'.ltttwwtttl.',
'.lttwwwwttl.',
'.lttwccwttl.',
'.lttwccwttl.',
'.ltttwwtttl.',
'lttttttttttl',
'lttttttttttl',
'.dtttttttd..',
'....oooo....',
'.....yy.....'];
var UFO_ROWS=[
'...ggggg...',
'..ggGGGgg..',
'.ggGGwGGgg.',
'rggGwwwGggr',
'oggGwwwGggo',
'.ggGGwGGgg.',
'..ggGGGgg..',
'...ggggg...'];
var UFO_LEG=[['r','#8b1a1a'],['g','#3fae3f'],['G','#7fe07f'],['w','#ffffff'],['o','#ff8c1a']];
var DART_ROWS=[
'....o....','...oyo...','..oyyyo..','.oyyyyyo.','oyyywyyyo','.oyyyyyo.','..oyyyo..','.bo.o.ob.','b...o...b'];
var DART_LEG=[['o','#ff9f2e'],['y','#ffd166'],['w','#ffffff'],['b','#a55a1e']];
var PURP_ROWS=['...ppp...','..pPPPp..','.pPPwPPp.','pPPPwPPPp','pPPPPPPPp','.pPPPPPp.','..ppppp..','...ppp...','....p....'];
var PURP_LEG=[['p','#c02ac0'],['P','#e96fe9'],['w','#ffffff']];
var STAR_ROWS=['.....b.....','....bBb....','...bbBbb...','..bbBwBbb..','.bbBBwBBbb.','bbBBBwBBBbb','.bbBBwBBbb.','..bbBwBbb..','...bbBbb...','....bBb....','.....b.....'];
var STAR_LEG=[['b','#1a3aa0'],['B','#4a8aff'],['w','#ffffff']];
var ORB_ROWS=['..bbbbb..','.bBBBBBb.','bBBwwwBBb','bBwwwwwBb','bBwwwwwBb','bBBwwwBBb','.bBBBBBb.','..bbbbb..'];
var ORB_LEG=[['b','#1c4fb0'],['B','#4a8aff'],['w','#ffffff']];
var PLUS_ROWS=['...ggg...','...gGg...','...gGg...','ggggggggg','gggGGGggg','ggggggggg','...gGg...','...gGg...','...ggg...'];
var PLUS_LEG=[['g','#2fbf2f'],['G','#a6ffa6']];
var BOSS_ROWS=[
'......dddddddd......','....ddrrrrrrrrd.....','...drrrrrrrrrrrd....','..drrrrRRRRrrrrd....','.drrrrRRwwRRrrrrd...','.drrrrRwwwwRrrrrd...','drrrrrRRwwRRrrrrrd..','drrrrrrrrrrrrrrrrd..','drrRRrrrrrrrrRRrrd..','drrRddrrrrrrddRrrd..','drrRddrrrrrrddRrrd..','.drrrrrrrrrrrrrrd...','..drrRRrrrrRRrrd....','...drrrrrrrrrrd.....','....ddrrrrrrdd......','......dddddd........'];
var BOSS_LEG=[['d','#3a0808'],['r','#a01818'],['R','#e04040'],['w','#ffffff'],['o','#ff8c1a']];
/* A970 new enemy types: a homing diver, a turret gunner and a splitter tank. */
var DIVER_ROWS=['....o....','...oRo...','..oRRRo..','.oRwwwRo.','oRRwwwRRo','..oR.Ro..','...o.o...'];
var DIVER_LEG=[['o','#a03010'],['R','#ff5030'],['w','#ffd166']];
var GUNNER_ROWS=['..g...g..','.gGg.gGg.','gGGGGGGGg','gGwGGGwGg','gGGGwGGGg','.gGGGGGg.','..gG.Gg..'];
var GUNNER_LEG=[['g','#1e6b4a'],['G','#4fd6a0'],['w','#ffffff']];
var SPLIT_ROWS=['..ssssss..','.sSSSSSSs.','sSSwwwwSSs','sSwWWWWwSs','sSwWWWWwSs','sSSwwwwSSs','.sSSSSSSs.','..ssssss..'];
var SPLIT_LEG=[['s','#3a3a4a'],['S','#7a7a90'],['w','#cfe0ff'],['W','#ff9ec0']];
/* A970 extra bosses: a purple spinner and a green hive. */
var BOSS2_ROWS=['.....dd.....','...ddppdd...','..dppPPPPpd..','.dpPPwwwwPPpd.','dpPPwwwwwwPPpd','dppPwwwwwwPppd','dppPwwwwwwPppd','.dpPPwwwwPPpd.','..dppPPPPpd..','...ddppdd...','.....dd.....'];
var BOSS2_LEG=[['d','#3a0850'],['p','#7a2ac0'],['P','#c060ff'],['w','#ffffff']];
var BOSS3_ROWS=['...gggggg...','..gGGGGGGg..','.gGGwwwwGGg.','gGGwGGGGwGGg','gGwGGGGGGwGg','gGwGGGGGGwGg','gGGwGGGGwGGg','.gGGwwwwGGg.','..gGGGGGGg..','...gggggg...'];
var BOSS3_LEG=[['g','#124a1e'],['G','#3fae3f'],['w','#a6ffa6']];
var HULLS=[
 {name:'Starter',t:'#2fa9c4',l:'#66d9ee',d:'#12606f',cost:0,perk:'Balanced all-rounder',bonus:{}},
 {name:'Crimson',t:'#d8388a',l:'#ff8ac4',d:'#7a1444',cost:900,perk:'+0.8 engine speed',bonus:{speed:0.8}},
 {name:'Verdant',t:'#4fc74f',l:'#a6f0a6',d:'#1e6b1e',cost:1600,perk:'+1 starting health',bonus:{health:1}},
 {name:'Royal',t:'#7a5cff',l:'#b3a0ff',d:'#3a2a99',cost:2600,perk:'+1 blaster damage',bonus:{damage:1}},
 {name:'Solaris',t:'#e0a020',l:'#ffd777',d:'#8a5a00',cost:4200,perk:'+1 extra cannon',bonus:{shots:1}}];
function shipSprite(h){
  var leg=SHIP_LEG.map(function(p){return p;});
  var l=[];for(var i=0;i<SHIP_LEG.length;i++){l.push([SHIP_LEG[i][0],SHIP_LEG[i][1]]);}
  l[0][1]=h.t;l[1][1]=h.l;l[2][1]=h.d;
  return build(SHIP_ROWS,l);
}
var SPR={ufo:build(UFO_ROWS,UFO_LEG),dart:build(DART_ROWS,DART_LEG),purp:build(PURP_ROWS,PURP_LEG),star:build(STAR_ROWS,STAR_LEG),orb:build(ORB_ROWS,ORB_LEG),plus:build(PLUS_ROWS,PLUS_LEG),boss:build(BOSS_ROWS,BOSS_LEG),diver:build(DIVER_ROWS,DIVER_LEG),gunner:build(GUNNER_ROWS,GUNNER_LEG),splitter:build(SPLIT_ROWS,SPLIT_LEG),boss2:build(BOSS2_ROWS,BOSS2_LEG),boss3:build(BOSS3_ROWS,BOSS3_LEG)};
var BOSS_SPR=[SPR.boss,SPR.boss2,SPR.boss3];
var BOSS_NAME=['GATE WARDEN','NOVA SPINNER','SWARM HIVE'];
var SHIPS=HULLS.map(shipSprite);
/* ============================ SAVE / META ============================ */
var KEY='jvds-nova-siege-v1';
function fresh(){return{credits:0,hull:0,up:{damage:0,rate:0,multishot:0,speed:0,shield:0,magnet:0,life:0},quests:{kills:0,bosses:0,waves:0,best:0,runs:0,powerups:0},completed:{},hulls:[0]};}
function loadMeta(){try{var s=JSON.parse(localStorage.getItem(KEY));if(!s||typeof s!=='object')return fresh();var f=fresh();s.up=s.up||f.up;s.quests=s.quests||f.quests;s.completed=s.completed||{};s.hulls=Array.isArray(s.hulls)&&s.hulls.length?s.hulls:[0];return s}catch(e){return fresh()}}
function saveMeta(){try{localStorage.setItem(KEY,JSON.stringify(meta))}catch(e){}}
var meta=loadMeta();
var UPGRADES=[
 {id:'damage',name:'Blaster Damage',max:5,base:120,info:'+1 damage per shot per level.',cost:function(l){return this.base+Math.round(this.base*0.8*l)}},
 {id:'rate',name:'Fire Rate',max:5,base:130,info:'Shots come out faster.',cost:function(l){return this.base+Math.round(this.base*0.85*l)}},
 {id:'multishot',name:'Extra Cannons',max:4,base:220,info:'Add a side cannon per level.',cost:function(l){return this.base+Math.round(this.base*1.0*l)}},
 {id:'speed',name:'Engine Speed',max:4,base:110,info:'Fly and dodge quicker.',cost:function(l){return this.base+Math.round(this.base*0.7*l)}},
 {id:'shield',name:'Shield Plating',max:4,base:160,info:'Start each life with a shield.',cost:function(l){return this.base+Math.round(this.base*0.9*l)}},
 {id:'magnet',name:'Credit Magnet',max:3,base:150,info:'Pull drops toward you.',cost:function(l){return this.base+Math.round(this.base*0.9*l)}},
 {id:'life',name:'Extra Health',max:3,base:280,info:'Begin with one more health.',cost:function(l){return this.base+Math.round(this.base*1.1*l)}}];
var QUESTS=[
 {id:'kills50',name:'Swatter',text:'Destroy 50 swarm ships (total)',goal:50,key:'kills',reward:200},
 {id:'waves10',name:'Holding the Line',text:'Clear 10 waves',goal:10,key:'waves',reward:180},
 {id:'boss1',name:'Gate Crasher',text:'Defeat your first boss',goal:1,key:'bosses',reward:400},
 {id:'score10k',name:'Nova Ace',text:'Reach 10,000 score in one run',goal:10000,key:'best',reward:500},
 {id:'power3',name:'Overcharged',text:'Collect 3 power stars in one run',goal:3,key:'powerups',reward:250},
 {id:'runs10',name:'Veteran Pilot',text:'Launch 10 runs',goal:10,key:'runs',reward:300}];
/* ============================ STORY + SYSTEM ============================ */
var storyRun=window.__storyRun=new StoryRun({id:'nova-siege',character:'Pip',title:'Pip and the Nova Gate',open:'The Swarm is streaming out of the Nova gate and Pip needs a pilot: fly the defence ship and hold the line.',objective:'Dodge the swarm, shoot the galactic army and bank credits to upgrade your ship.',cap:300,beats:[{at:0,text:'First wave inbound. Fly and fire!'},{at:0.4,text:'The swarm thickens and a boss is closing.'},{at:0.8,text:'The Nova gate glows: one last push to hold the line.'}],result:{success:'The gate collapses and Pip tees up a bigger ship for next time.',partial:'You hold most of the line; the swarm regroups, but the credits are banked.',fail:'The swarm breaks through this time, but your upgrades are still there for the next launch.'},onRestart:function(){startRun()}});
function storyBegin(){if(window.__storyRun&&!window.__storyRun.running)window.__storyRun.begin()}
function storyScore(){if(window.__storyRun)window.__storyRun.setScore(run.score)}
var gameSystem=null;try{gameSystem=new GameSystem('nova-siege','Nova Siege','pip');gameSystem.trackScore({xpDivisor:12,tiers:[[1,'firstLaunch'],[5000,'score5k'],[10000,'score10k']]});}catch(e){}
/* A795 shared auto-pause: backgrounding a run stops the rAF loop and the
   engine shows the standard tap-to-resume overlay (styled in game-system.css). */
try{if(typeof GameUI!=='undefined'&&GameUI.autoPause)GameUI.autoPause({pause:function(){if(typeof run==='undefined'||!run||run.over)return false;cancelAnimationFrame(raf);return true;},resume:function(){if(typeof run==='undefined'||!run||run.over)return;lastT=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}});}catch(e){}
var sfxAudio=null;
function sfx(k){try{sfxAudio=sfxAudio||new AudioEffects(0.35);if(!sfxAudio)return;if(k==='win')sfxAudio.playSuccess();else if(k==='bad')sfxAudio.playError();else if(k==='hit'&&sfxAudio.playHit)sfxAudio.playHit();else sfxAudio.playTap();}catch(e){}}
/* ============================ GAME ============================ */
var cv=document.getElementById('cv'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
var vsScale=1; // logical -> backing-store scale, set by nsFit; render() must re-apply it every frame
var LW=540,LH=960; // A986 9:16 play-field: taller, fills a portrait phone and gives more dodge room
var VS=LH/720; // vertical speed scale so a taller field keeps the original pace
var W=LW,H=LH;
/* A795 DPR fit: canvas keeps its 3:4 logical space while the backing store
   matches the displayed size times DPR (capped at 2). Uniform scale keeps
   circles circular on narrow phone widths instead of CSS-stretching. */
function nsFit(){try{var d=Math.min(window.devicePixelRatio||1,2);var wrap=cv.parentElement;var imm=document.documentElement.classList.contains('jvds-immersive');var avail=(wrap&&wrap.clientWidth)||LW;var capH=imm?Math.max(260,(wrap&&wrap.clientHeight)||window.innerHeight):Math.min(window.innerHeight*0.66,620);var cssW=Math.min(avail,LW);var cssH=cssW*LH/LW;if(cssH>capH){cssH=capH;cssW=cssH*LW/LH;}if(window.HiDPI&&HiDPI.fit){HiDPI.fit(cv,Math.round(cssW),Math.round(cssH));}else{cv.style.width=cssW+'px';cv.style.height=cssH+'px';cv.width=Math.round(cssW*d);cv.height=Math.round(cssH*d);}var s=cv.width/LW;vsScale=s;ctx.setTransform(s,0,0,s,0,0);ctx.imageSmoothingEnabled=false;}catch(e){}}
nsFit();window.addEventListener('resize',nsFit);
var STARCOL=['#ffffff','#ff6ec7','#7CFC00','#4aa8ff','#ffaa33','#66e0ff'];
/* A970 endless parallax space: three star layers, drifting nebulae and slow
   planets, each scrolling at its own speed behind the play field. */
var bg={far:[],mid:[],near:[],neb:[],planets:[]};
function newPlanet(y){var r=rnd(40,74),k=(Math.random()*3)|0;return{x:rnd(60,W-60),y:y,r:r,c:['#3a2a6a','#2a4a3a','#5a2a3a'][k],hi:['#8a7ae0','#6ad0a0','#e080a0'][k],sp:rnd(0.18,0.3),ring:Math.random()<0.5};}
function bgReset(){
  bg.far=[];bg.mid=[];bg.near=[];bg.neb=[];bg.planets=[];
  var i;
  for(i=0;i<80;i++)bg.far.push({x:Math.random()*W,y:Math.random()*H,s:1,c:STARCOL[(Math.random()*STARCOL.length)|0],sp:rnd(0.2,0.5),a:0.55});
  for(i=0;i<46;i++)bg.mid.push({x:Math.random()*W,y:Math.random()*H,s:1,c:Math.random()<0.2?'#bcdcff':'#eaf4ff',sp:rnd(0.55,0.9),a:0.8});
  for(i=0;i<22;i++)bg.near.push({x:Math.random()*W,y:Math.random()*H,s:2,c:'#ffffff',sp:rnd(1.1,1.6),a:1});
  for(i=0;i<4;i++)bg.neb.push({x:Math.random()*W,y:Math.random()*H,r:rnd(120,230),c:['#241a4d','#0f3444','#3a1436','#0e2a3a'][i%4],sp:rnd(0.1,0.2),a:0.5});
  for(i=0;i<2;i++)bg.planets.push(newPlanet(Math.random()*H-H));
}
function scrollBg(dt,mult){
  var layers=[[bg.far,4],[bg.mid,4],[bg.near,4],[bg.neb,240]];
  for(var l=0;l<layers.length;l++){var arr=layers[l][0],pad=layers[l][1];for(var i=0;i<arr.length;i++){var o=arr[i];o.y+=o.sp*mult*dt;if(o.y>H+pad){o.y=-pad-Math.random()*60;o.x=Math.random()*W;}}}
  for(var p=0;p<bg.planets.length;p++){var pl=bg.planets[p];pl.y+=pl.sp*mult*dt;if(pl.y>H+pl.r+30)bg.planets[p]=newPlanet(-pl.r-40-Math.random()*220);}
}
function drawStars(arr){for(var i=0;i<arr.length;i++){var s=arr[i];ctx.globalAlpha=s.a*(0.4+0.6*Math.min(1,s.y/H));ctx.fillStyle=s.c;ctx.fillRect(s.x|0,s.y|0,s.s,s.s);}ctx.globalAlpha=1;}
bgReset();
var run,raf,keys={},drag={active:false,sx:0,sy:0,ox:0,oy:0,tx:0,ty:0},lastT=0;
var SS=2; // sprite zoom
var powerTimer=0,powerKind=null,fireSfxT=0;
/* Closest distance from point to segment, used for swept bullet collision so
   fast shots never tunnel through a small enemy between frames. */
function segHit(x1,y1,x2,y2,px,py,r){var dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;var t=l2?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l2)):0;var cx=x1+t*dx,cy=y1+t*dy;return Math.hypot(px-cx,py-cy)<=r;}
function hullBonus(k){var h=HULLS[meta.hull]||HULLS[0];return (h.bonus&&h.bonus[k])||0}
function baseHealth(){return 3+(meta.up.life||0)+hullBonus('health')}
function hitR(sp){return sp===SPR.boss?22:9}
function startRun(){
  run={score:0,stage:1,wave:1,health:baseHealth(),credits:0,px:W/2,py:H-80,fireT:0,shield:(meta.up.shield||0)>0?1:0,inv:90,waveKills:0,waveTarget:6,kills:0,runPower:0,over:false,hint:210,combo:0,comboT:0,bestCombo:0,bossActive:false,bullets:[],enemies:[],drops:[],parts:[],floats:[],flame:0,shakeT:0,shakeMag:0};
  spawnT=36;boss=null;spawnQueue=0;
  meta.quests.runs++;saveMeta();qUpdate();
  document.getElementById('titleFont').style.display='';fireSfxT=0;
  document.getElementById('overlay').classList.add('hidden');
  cancelAnimationFrame(raf);lastT=0;raf=requestAnimationFrame(loop);
}
var spawnT=36,boss=null,spawnQueue=0;
function endRun(win){
  if(run.over)return;run.over=true;cancelAnimationFrame(raf);
  meta.credits+=run.credits;meta.quests.best=Math.max(meta.quests.best||0,run.score);saveMeta();
  if(window.GameSystem&&window.GameSystem.saveScore)window.GameSystem.saveScore('nova-siege',run.score,{level:run.stage});
  try{if(window.jvdsCheckNewBest)window.jvdsCheckNewBest()}catch(e){}
  try{if(gameSystem){gameSystem.state.score=run.score;gameSystem.recordGamePlay(Date.now());gameSystem.addCoins(run.credits);gameSystem.saveState();}}catch(e){}
  try{var pp=window.playerProfile;if(pp&&pp.addXP)pp.addXP(Math.round(run.score/12),'game:nova-siege')}catch(e){}
  qUpdate();renderUpgrades();renderCredits();
  document.getElementById('titleFont').style.display='none';
  document.getElementById('ovText').innerHTML='Score <b>'+run.score.toLocaleString()+'</b> &middot; Stage '+run.stage+' &middot; Credits banked <b>'+run.credits+'</b>.<br>Total credits: <b>'+meta.credits+'</b>. Upgrade and launch again!';
  document.getElementById('startBtn').textContent='Launch Again';
  document.getElementById('overlay').classList.remove('hidden');
  if(window.__storyRun)window.__storyRun.finish(win?'success':(run.stage>1?'partial':'fail'),run.score);
}
function rnd(a,b){return a+Math.random()*(b-a)}
function shake(m){run.shakeMag=Math.max(run.shakeMag,m);run.shakeT=12}
function burst(x,y,col,n){for(var i=0;i<(n||8);i++){var a=Math.random()*Math.PI*2,s=rnd(1,3.4);run.parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(14,28),c:col})}}
function float(x,y,t,c){run.floats.push({x:x,y:y,t:t,c:c,life:38})}
/* A991 combo: kills build a streak that multiplies score, with escalating
   feedback at milestones and a reset if the player takes a hit. */
function comboMult(){var c=run.combo||0;return 1+Math.min(2,Math.floor(c/5)*0.5);}
function addCombo(x,y){
  run.combo=(run.combo||0)+1;run.comboT=110;
  if(run.combo>(run.bestCombo||0))run.bestCombo=run.combo;
  var c=run.combo;
  if(c===5||c===10||c===20||c===40){
    var t=c>=20?3:c>=10?2:1,m=Math.round(comboMult()*10)/10;
    shake(4+t*4);
    float(x,y-26,'COMBO x'+m,t>=2?'#ffd166':'#7CFC00');
    try{navigator.vibrate&&navigator.vibrate(8*t)}catch(e){}
    sfx(t>=2?'win':'hit');
  }
  return comboMult();
}
function addCredits(n,x,y){run.credits+=n;if(x!=null)float(x,y,'+'+n,'#ffd166')}
function shieldOn(){return run.shield>0}
/* ----- spawn ----- */
function pickKind(){
  var t=Math.random(),st=run.stage;
  if(st>=5&&t>0.93)return 'splitter';
  if(st>=4&&t>0.84)return 'gunner';
  if(st>=2&&t>0.72)return 'diver';
  if(st>=3&&t>0.62)return 'purp';
  if(st>=2&&t>0.46)return 'dart';
  if(t>0.3&&Math.random()>0.6)return 'orb';
  return 'ufo';
}
function spawnEnemy(){
  var kind=pickKind();
  var pattern=kind==='diver'?'dive':(kind==='gunner'?'hover':(kind==='splitter'?'straight':(Math.random()<0.45?'sine':(Math.random()<0.5?'swoop':'straight'))));
  var hp=kind==='splitter'?4:kind==='gunner'?3:kind==='orb'?2:1;
  var vy=(kind==='diver'?rnd(1.7,2.4)+run.stage*0.12:(kind==='splitter'?rnd(0.5,0.8):rnd(0.8,1.5)+run.stage*0.1))*VS;
  var e={kind:kind,pattern:pattern,x:rnd(40,W-40),y:-30,vy:vy,t:0,hp:hp,r:kind==='splitter'?14:hitR(SPR[kind]),spr:SPR[kind],dir:Math.random()<0.5?-1:1,amp:rnd(24,60),freq:rnd(0.02,0.05),fire:rnd(50,110)};
  run.enemies.push(e);
}
function spawnBoss(){
  run.bossActive=true;
  var type=(run.stage-1)%3;
  boss={x:W/2,y:-70,vy:0.9*VS,hp:30+run.stage*16,maxhp:30+run.stage*16,t:0,dir:1,fire:70,r:22,type:type,ang:0};
  float(W/2,H/2-58,BOSS_NAME[type],'#ff4d5e');float(W/2,H/2-40,'WARNING!','#ff4d5e');sfx('bad');
}
/* ----- update ----- */
function loop(ts){raf=requestAnimationFrame(loop);if(run.over)return;if(!lastT)lastT=ts;var dt=Math.min(2.2,(ts-lastT)/16.667);lastT=ts;update(dt);render();}
function update(dt){
  var spd=3.4+(meta.up.speed||0)*0.5+hullBonus('speed');
  if(drag.active){run.px+=(drag.tx-run.px)*0.5;run.py+=(drag.ty-run.py)*0.5;}
  if(keys.left)run.px-=spd;if(keys.right)run.px+=spd;
  if(keys.up)run.py-=spd;if(keys.down)run.py+=spd;
  run.px=Math.max(20,Math.min(W-20,run.px));run.py=clampPY(run.py);
  if(run.hint>0)run.hint-=dt;if(fireSfxT>0)fireSfxT-=dt;
  if(run.combo>0){run.comboT-=dt;if(run.comboT<=0)run.combo=0;}
  run.flame=(run.flame+dt)%6;
  if(run.inv>0)run.inv-=dt;
  /* fire upward, paired orbs like the original */
  run.fireT-=dt;
  var rate=Math.max(5,10-(meta.up.rate||0)*1.0);if(powerTimer>0&&powerKind==='rapid')rate*=0.45;
  if(run.fireT<=0){
    run.fireT=rate;var dmg=1+(meta.up.damage||0)+hullBonus('damage');
    var shots=1+(meta.up.multishot||0)+hullBonus('shots')+((powerTimer>0&&powerKind==='spread')?2:0);
    for(var i=0;i<shots;i++){var off=(i-(shots-1)/2)*12;run.bullets.push({x:run.px+off,y:run.py-16,vx:off*0.05,vy:-8*VS,dmg:dmg});}
    if(fireSfxT<=0){sfx('tap');fireSfxT=9;}
  }
  if(powerTimer>0){powerTimer-=dt;if(powerTimer<=0)powerKind=null}
  for(var b=run.bullets.length-1;b>=0;b--){var sb=run.bullets[b];sb.x+=sb.vx*dt;sb.y+=sb.vy*dt;if(sb.y<-16)run.bullets.splice(b,1)}
  /* spawn */
  spawnT-=dt;
  if(!run.bossActive&&spawnT<=0&&run.waveKills<run.waveTarget){spawnEnemy();spawnT=Math.max(14,40-run.stage*3);}
  /* boss */
  if(boss){
    boss.t+=dt;
    if(boss.y<96*VS)boss.y+=boss.vy*dt;
    else{boss.x+=boss.dir*(0.9+run.stage*0.12)*dt;if(boss.x>W-60)boss.dir=-1;if(boss.x<60)boss.dir=1;}
    boss.fire-=dt;
    if(boss.fire<=0&&boss.y>=90*VS){
      if(boss.type===1){ /* Nova Spinner: rotating radial ring */
        boss.fire=Math.max(38,72-run.stage*3);boss.ang+=0.5;
        for(var rk=0;rk<8;rk++){var ra=boss.ang+rk*Math.PI/4;run.bullets.push({eb:1,x:boss.x,y:boss.y+10,vx:Math.cos(ra)*2.6*VS,vy:Math.sin(ra)*2.6*VS+0.6*VS,dmg:1});}
      }else if(boss.type===2){ /* Swarm Hive: aimed burst + minions */
        boss.fire=Math.max(26,48-run.stage*3);
        var ha=Math.atan2(run.py-boss.y,run.px-boss.x);
        for(var hk=-1;hk<=1;hk++){run.bullets.push({eb:1,x:boss.x,y:boss.y+18,vx:Math.cos(ha+hk*0.16)*3.4*VS,vy:Math.sin(ha+hk*0.16)*3.4*VS,dmg:1});}
        if(Math.random()<0.35&&run.enemies.length<10){run.enemies.push({kind:'diver',pattern:'dive',x:boss.x,y:boss.y,vy:1.8*VS,t:0,hp:1,r:hitR(SPR.diver),spr:SPR.diver,dir:1,amp:20,freq:0.03,fire:80});}
      }else{ /* Gate Warden: 3-way spread */
        boss.fire=Math.max(30,60-run.stage*3);
        for(var k=-1;k<=1;k++){run.bullets.push({eb:1,x:boss.x,y:boss.y+22,vx:k*1.6,vy:3.2*VS,dmg:1});}
      }
    }
  }
  /* enemies */
  for(var e=run.enemies.length-1;e>=0;e--){
    var en=run.enemies[e];en.t+=dt;en.y+=en.vy*dt;
    if(en.pattern==='sine')en.x+=Math.sin(en.t*en.freq)*en.amp*0.05;
    else if(en.pattern==='swoop')en.x+=en.dir*1.1*dt;
    else if(en.pattern==='dive')en.x+=Math.max(-1.9,Math.min(1.9,(run.px-en.x)*0.03))*dt;
    else if(en.pattern==='hover'){if(en.y>118*VS){en.vy=0;en.fire-=dt;if(en.fire<=0){en.fire=95;var ga=Math.atan2(run.py-en.y,run.px-en.x);run.bullets.push({eb:1,x:en.x,y:en.y+10,vx:Math.cos(ga)*3.1*VS,vy:Math.sin(ga)*3.1*VS,dmg:1});sfx('tap');}}}
    if(en.x<16||en.x>W-16)en.dir=-en.dir;
    if(en.y>H+30){run.enemies.splice(e,1);continue}
    if(run.inv<=0&&Math.hypot(en.x-run.px,en.y-run.py)<en.r+7){hurtPlayer();burst(en.x,en.y,'#ff9f2e',12);run.enemies.splice(e,1);continue}
    for(var s=run.bullets.length-1;s>=0;s--){var bb=run.bullets[s];if(bb.eb)continue;var py=bb.y-bb.vy*dt;if(segHit(bb.x-bb.vx*dt,py,bb.x,bb.y,en.x,en.y,en.r+3)){en.hp-=bb.dmg;run.bullets.splice(s,1);if(en.hp<=0)killEnemy(en,en.x,en.y);else burst(bb.x,bb.y,'#9fe6ff',4);break;}}
  }
  /* boss bullets vs boss handled via shared hit below */
  if(boss){
    for(var s2=run.bullets.length-1;s2>=0;s2--){var b2=run.bullets[s2];if(b2.eb)continue;var py2=b2.y-b2.vy*dt;if(segHit(b2.x-b2.vx*dt,py2,b2.x,b2.y,boss.x,boss.y,boss.r+3)){boss.hp-=b2.dmg;run.bullets.splice(s2,1);burst(b2.x,b2.y,'#ffd166',3)}}
    if(run.inv<=0&&Math.hypot(boss.x-run.px,boss.y-run.py)<boss.r+9)hurtPlayer();
    if(boss.hp<=0)killBoss();
  }
  /* drops */
  for(var d=run.drops.length-1;d>=0;d--){
    var dr=run.drops[d];dr.y+=1.3*VS*dt;
    if(meta.up.magnet){var mx=run.px-dr.x,my=run.py-dr.y,md=Math.hypot(mx,my);if(md<150){dr.x+=mx/md*2.2*dt;dr.y+=my/md*2.2*dt}}
    if(dr.y>H+16){run.drops.splice(d,1);continue}
    if(Math.hypot(dr.x-run.px,dr.y-run.py)<26){
      if(dr.type==='health'){run.health=Math.min(9,run.health+1);float(dr.x,dr.y,'+1 HP','#7CFC00');}
      else if(dr.type==='credit'){addCredits(dr.v,dr.x,dr.y);}
      else{if(dr.w==='shield'){run.shield=Math.max(run.shield,1);}else{powerKind=dr.w;powerTimer=440;}run.runPower++;meta.quests.powerups=Math.max(meta.quests.powerups||0,run.runPower);float(dr.x,dr.y,dr.label,dr.c);}
      sfx('win');run.drops.splice(d,1);
    }
  }
  /* the "eb" boss bullets live in run.bullets too; update all non-player ones */
  for(var eb=run.bullets.length-1;eb>=0;eb--){var ebl=run.bullets[eb];if(!ebl.eb)continue;ebl.x+=ebl.vx*dt;ebl.y+=ebl.vy*dt;if(ebl.y>H+16||ebl.x<-16||ebl.x>W+16){run.bullets.splice(eb,1);continue}if(run.inv<=0&&Math.hypot(ebl.x-run.px,ebl.y-run.py)<11){hurtPlayer();run.bullets.splice(eb,1)}}
  for(var p=run.parts.length-1;p>=0;p--){var pa=run.parts[p];pa.x+=pa.vx*dt;pa.y+=pa.vy*dt;pa.vy+=0.05*dt;pa.life-=dt;if(pa.life<=0)run.parts.splice(p,1)}
  for(var f=run.floats.length-1;f>=0;f--){var fa=run.floats[f];fa.y-=0.7*dt;fa.life-=dt;if(fa.life<=0)run.floats.splice(f,1)}
  scrollBg(dt,1+run.stage*0.04);
  if(run.shakeT>0){run.shakeT-=dt;if(run.shakeT<=0)run.shakeMag=0}
  hud();
}
function killEnemy(en,x,y){
  var idx=run.enemies.indexOf(en);if(idx>=0)run.enemies.splice(idx,1);
  var col=en.kind==='ufo'?'#7fe07f':en.kind==='dart'?'#ffd166':en.kind==='purp'?'#e96fe9':en.kind==='diver'?'#ff5030':en.kind==='gunner'?'#4fd6a0':en.kind==='splitter'?'#7a7a90':'#4a8aff';
  burst(x,y,col,en.kind==='splitter'?26:14);
  var pts=en.kind==='splitter'?150:en.kind==='gunner'?90:en.kind==='diver'?60:en.kind==='orb'?80:40;
  var gained=Math.round(pts*addCombo(x,y));run.score+=gained;float(x,y,'+'+gained,'#bfe9ff');
  addCredits(en.kind==='splitter'?22:en.kind==='orb'?14:8);
  if(en.kind==='splitter'){for(var sc=0;sc<2;sc++){run.enemies.push({kind:'ufo',pattern:'swoop',x:Math.max(24,Math.min(W-24,x+(sc?26:-26))),y:y,vy:1.4,t:0,hp:1,r:hitR(SPR.ufo),spr:SPR.ufo,dir:sc?1:-1,amp:24,freq:0.03,fire:80});}}
  meta.quests.kills++;run.waveKills++;run.kills++;
  var roll=Math.random();
  if(roll<0.12)run.drops.push({x:x,y:y,type:'health'});
  else if(roll<0.3)run.drops.push({x:x,y:y,type:'credit',v:25});
  else if(roll<0.36){var pw=[['rapid','RAPID','#ffd166'],['spread','SPREAD','#7ef27e'],['shield','SHIELD','#4cc9f0']][(Math.random()*3)|0];run.drops.push({x:x,y:y,type:'power',w:pw[0],label:pw[1],c:pw[2]});}
  qUpdate();
  if(!run.bossActive&&run.waveKills>=run.waveTarget)nextWave();
}
function nextWave(){
  run.waveKills=0;run.wave++;meta.quests.waves++;run.waveTarget=Math.min(26,6+run.stage+Math.floor(run.wave*0.5));
  if(run.wave%4===0&&!run.bossActive)spawnBoss();
  qUpdate();
}
function killBoss(){
  var bx=boss.x,by=boss.y,bt=boss.type||0;
  burst(bx,by,bt===1?'#c060ff':bt===2?'#3fae3f':'#e04040',50);addCredits(150+run.stage*60,bx,by);
  run.score+=1200+run.stage*400;float(bx,by,'BOSS DOWN!','#ffd166');
  meta.quests.bosses++;boss=null;run.bossActive=false;
  run.stage++;run.wave=1;run.waveKills=0;run.waveTarget=Math.min(26,6+run.stage);
  float(W/2,H/2,'STAGE '+run.stage,'#7CFC00');sfx('win');shake(16);qUpdate();
}
function hurtPlayer(){
  run.combo=0;
  if(shieldOn()){run.shield=0;run.inv=70;burst(run.px,run.py,'#4cc9f0',22);float(run.px,run.py,'SHIELD','#4cc9f0');try{navigator.vibrate&&navigator.vibrate(20)}catch(e){}return}
  run.health--;run.inv=110;burst(run.px,run.py,'#ff4d5e',26);shake(18);sfx('bad');try{navigator.vibrate&&navigator.vibrate(35)}catch(e){};
  if(run.health<=0)endRun(false);
}
/* ----- render ----- */
function drawSpr(sp,cx,cy){var w=sp.width*SS,h=sp.height*SS;ctx.drawImage(sp,Math.round(cx-w/2),Math.round(cy-h/2),w,h)}
function render(){
  ctx.setTransform(vsScale,0,0,vsScale,0,0);
  if(run.shakeMag)ctx.translate(rnd(-run.shakeMag,run.shakeMag),rnd(-run.shakeMag,run.shakeMag));
  ctx.fillStyle='#05070d';ctx.fillRect(-20,-20,W+40,H+40);
  for(var nb=0;nb<bg.neb.length;nb++){var ne=bg.neb[nb];ctx.globalAlpha=ne.a;ctx.fillStyle=ne.c;ctx.beginPath();ctx.arc(ne.x,ne.y,ne.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  for(var pp=0;pp<bg.planets.length;pp++){var pl=bg.planets[pp];
    if(pl.ring){ctx.globalAlpha=0.45;ctx.strokeStyle=pl.hi;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(pl.x,pl.y,pl.r*1.5,pl.r*0.5,0.5,0,Math.PI*2);ctx.stroke();}
    ctx.globalAlpha=1;ctx.fillStyle=pl.c;ctx.beginPath();ctx.arc(pl.x,pl.y,pl.r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=0.45;ctx.fillStyle=pl.hi;ctx.beginPath();ctx.arc(pl.x-pl.r*0.3,pl.y-pl.r*0.3,pl.r*0.55,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  drawStars(bg.far);drawStars(bg.mid);drawStars(bg.near);
  ctx.globalAlpha=1;
  /* drops */
  for(var d=0;d<run.drops.length;d++){var dr=run.drops[d];if(dr.type==='health')drawSpr(SPR.plus,dr.x,dr.y);else if(dr.type==='power')drawSpr(SPR.star,dr.x,dr.y);else{ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(dr.x,dr.y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7a5200';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('C',dr.x,dr.y+3)}}
  /* enemies */
  for(var e=0;e<run.enemies.length;e++){var en=run.enemies[e];drawSpr(en.spr,en.x,en.y);if(en.pattern==='hover'&&en.fire<18){ctx.globalAlpha=0.45+0.55*Math.abs(Math.sin(en.t*0.7));ctx.strokeStyle='#4fd6a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(en.x,en.y,en.r+7,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}}
  /* boss (with an attack telegraph ring in the last ~0.3s before it fires) */
  if(boss){var tel=boss.fire<18&&boss.y>=90*VS;if(tel){ctx.globalAlpha=0.45+0.55*Math.abs(Math.sin(boss.t*0.7));ctx.strokeStyle='#ff4d5e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(boss.x,boss.y,boss.r+12,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    var bsp=BOSS_SPR[boss.type||0];drawSpr(bsp,boss.x,boss.y);ctx.fillStyle='#2a0505';ctx.fillRect(boss.x-56,boss.y-52,112,8);ctx.fillStyle=(boss.type===1?'#c060ff':boss.type===2?'#3fae3f':'#ff4d5e');ctx.fillRect(boss.x-56,boss.y-52,112*Math.max(0,boss.hp/boss.maxhp),8)}
  /* player bullets: paired cyan orbs */
  for(var b=0;b<run.bullets.length;b++){var sb=run.bullets[b];if(sb.eb){ctx.fillStyle='#ff8f8f';ctx.beginPath();ctx.arc(sb.x,sb.y,5,0,Math.PI*2);ctx.fill();continue}ctx.fillStyle='#8fe6ff';ctx.beginPath();ctx.arc(sb.x-2,sb.y,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sb.x+2,sb.y,3,0,Math.PI*2);ctx.fill();}
  /* player + flame */
  if(!(run.inv>0&&Math.floor(run.inv/5)%2===0)){var fl=run.flame<3?run.py+8:run.py+11;ctx.fillStyle=run.flame<3?'#ff8c1a':'#ffd166';ctx.fillRect(run.px-4,fl,8,5);drawSpr(SHIPS[meta.hull]||SHIPS[0],run.px,run.py);}
  if(shieldOn()||run.shield>0){ctx.strokeStyle='#4cc9f0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(run.px,run.py,20,0,Math.PI*2);ctx.stroke()}
  if(run.hint>0){ctx.globalAlpha=Math.min(1,run.hint/70);ptext(ctx,'DRAG ANYWHERE TO FLY',W/2,H*0.8,2,'#bfe9ff','#04070c','center');ctx.globalAlpha=1}
  /* particles */
  for(var p=0;p<run.parts.length;p++){var pa=run.parts[p];ctx.globalAlpha=Math.max(0,pa.life/28);ctx.fillStyle=pa.c;ctx.fillRect(pa.x|0,pa.y|0,2,2)}ctx.globalAlpha=1;
  /* floats */
  for(var f=0;f<run.floats.length;f++){var fa=run.floats[f];ctx.globalAlpha=Math.max(0,fa.life/38);ptext(ctx,fa.t,fa.x,fa.y,1,fa.c,'#05070d','center')}ctx.globalAlpha=1;
  /* In-canvas HUD bar: SCORE top-left, HEALTH top-right, WAVE/STAGE below-left.
     In immersive mode this is the only HUD so the phone keeps the whole field. */
  var pad=7,s=2,sp=6*s;
  ptext(ctx,'SCORE',pad,pad,s,'#7CFC00','#04070c');
  ptext(ctx,String(run.score),pad+ptextW('SCORE',s)+sp,pad,s,'#ffffff','#04070c');
  var lw2=ptextW('HEALTH',s),nw2=ptextW(String(run.health),s),x1=W-pad-(lw2+sp+nw2);
  ptext(ctx,'HEALTH',x1,pad,s,'#7CFC00','#04070c');
  ptext(ctx,String(run.health),x1+lw2+sp,pad,s,'#ff4d5e','#04070c');
  ptext(ctx,'WAVE '+run.wave+'  STAGE '+run.stage,pad,pad+16,s,'#8fe36a','#04070c');
  if((run.combo||0)>=2){var cm=Math.round(comboMult()*10)/10;ptext(ctx,'COMBO x'+cm,W/2,pad,2,cm>=2?'#ffd166':'#7CFC00','#04070c','center')}
  ctx.setTransform(vsScale,0,0,vsScale,0,0);
}
function ptextW(str,s){return Math.max(0,String(str).length*6*s-s);}
function pnumW(v,s){return String(v).length*6*s}
function hud(){document.getElementById('hScore').textContent=run.score.toLocaleString();document.getElementById('hStage').textContent=run.stage;document.getElementById('hWave').textContent=run.wave;document.getElementById('hLives').textContent=run.health;document.getElementById('hCredits').textContent=run.credits;document.getElementById('hBest').textContent=(window.GameSystem?window.GameSystem.getBestScore('nova-siege'):0).toLocaleString();storyScore();}
/* ============================ UI ============================ */
document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.tabpane').forEach(function(x){x.classList.remove('active')});t.classList.add('active');document.getElementById('pane-'+t.dataset.tab).classList.add('active');if(t.dataset.tab==='up')renderUpgrades();if(t.dataset.tab==='quest')renderQuests();if(t.dataset.tab==='skin')renderSkins();sfx('tap');}});
function renderCredits(){document.getElementById('credBank').textContent=meta.credits.toLocaleString();if(document.getElementById('hCredits'))document.getElementById('hCredits').textContent=(run?run.credits:0);}
function renderUpgrades(){var el=document.getElementById('upList');el.innerHTML='';UPGRADES.forEach(function(u){var lvl=meta.up[u.id]||0,maxed=lvl>=u.max,cost=maxed?0:u.cost(lvl);var row=document.createElement('div');row.className='up-row';var pips='';for(var i=0;i<u.max;i++)pips+='<span class="pip '+(i<lvl?'on':'')+'"></span>';row.innerHTML='<div><b>'+u.name+'</b><small>'+u.info+'</small><div class="pips">'+pips+'</div></div>';var btn=document.createElement('button');btn.className='buy';btn.textContent=maxed?'MAX':(cost+' cr');btn.disabled=maxed||meta.credits<cost;btn.onclick=function(){if(meta.credits>=cost&&!maxed){meta.credits-=cost;meta.up[u.id]=lvl+1;saveMeta();renderUpgrades();renderCredits();sfx('win');document.getElementById('quote').textContent=u.name+' upgraded to level '+(lvl+1)+'.';}};row.appendChild(btn);el.appendChild(row);});}
function renderQuests(){var el=document.getElementById('questList');el.innerHTML='';QUESTS.forEach(function(q){var cur=Math.min(q.goal,meta.quests[q.key]||0),done=!!meta.completed[q.id]||cur>=q.goal,pct=Math.round(cur/q.goal*100);var row=document.createElement('div');row.className='quest-row '+(done?'done':'');row.innerHTML='<b>'+(done?'[X] ':'[ ] ')+q.name+'</b><small>'+q.text+'</small>'+(done?'<small>Reward banked: '+q.reward+' cr</small>':'<div class="meter"><span style="width:'+pct+'%"></span></div><small>'+cur+' / '+q.goal+'</small>');el.appendChild(row);});}
function qUpdate(){var changed=false;QUESTS.forEach(function(q){if(meta.completed[q.id])return;if((meta.quests[q.key]||0)>=q.goal){meta.completed[q.id]=true;meta.credits+=q.reward;changed=true;try{var pp=window.playerProfile;if(pp&&pp.addXP)pp.addXP(Math.round(q.reward/2),'game:nova-siege-quest');}catch(e){}if(run&&!run.over)float(W/2,140,'QUEST: '+q.name+' +'+q.reward+'cr','#7CFC00');}});if(changed){saveMeta();renderQuests();renderCredits();}}
function renderSkins(){var el=document.getElementById('skinList');el.innerHTML='';HULLS.forEach(function(h,idx){var owned=h.cost===0||meta.hulls.indexOf(idx)>=0;var d=document.createElement('div');d.className='skin '+(meta.hull===idx?'sel':'')+(owned?'':' locked');var sc=document.createElement('canvas');sc.width=SHIP_ROWS[0].length;sc.height=SHIP_ROWS.length;sc.getContext('2d').drawImage(SHIPS[idx],0,0);d.appendChild(sc);if(!owned){var c=document.createElement('span');c.className='cost';c.textContent=h.cost;d.appendChild(c);}d.title=h.name+' - '+h.perk+(owned?'':' - '+h.cost+' cr');d.onclick=function(){if(owned){meta.hull=idx;saveMeta();renderSkins();document.getElementById('skinInfo').textContent=h.name+' hull equipped. '+h.perk+'.';sfx('win');}else if(meta.credits>=h.cost){meta.credits-=h.cost;meta.hulls.push(idx);meta.hull=idx;saveMeta();renderSkins();renderCredits();document.getElementById('skinInfo').textContent=h.name+' hull unlocked and equipped! '+h.perk+'.';sfx('win');}else{document.getElementById('skinInfo').textContent='You need '+(h.cost-meta.credits)+' more credits for the '+h.name+' hull ('+h.perk+').';}};el.appendChild(d);});}
/* ============================ INPUT ============================ */
function canvasX(clientX){var r=cv.getBoundingClientRect();return (clientX-r.left)/r.width*W}
function canvasY(clientY){var r=cv.getBoundingClientRect();return (clientY-r.top)/r.height*H}
function clampPY(v){return Math.max(H*0.44,Math.min(H-34,v))}
var stage=document.querySelector('.stage-wrap');
function dragStart(e){if(e.target&&e.target.closest&&e.target.closest('button,a,input,select,textarea,label,.overlay'))return;e.preventDefault();drag.active=true;drag.sx=canvasX(e.clientX);drag.sy=canvasY(e.clientY);drag.ox=run.px;drag.oy=run.py;drag.tx=run.px;drag.ty=run.py;try{stage.setPointerCapture(e.pointerId)}catch(x){}}
function dragMove(e){if(!drag.active)return;drag.tx=Math.max(20,Math.min(W-20,drag.ox+(canvasX(e.clientX)-drag.sx)));drag.ty=clampPY(drag.oy+(canvasY(e.clientY)-drag.sy))}
function dragEnd(){drag.active=false}
stage.addEventListener('pointerdown',dragStart);
stage.addEventListener('pointermove',dragMove);
stage.addEventListener('pointerup',dragEnd);
stage.addEventListener('pointercancel',dragEnd);
window.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')keys.left=1;if(e.key==='ArrowRight')keys.right=1;if(e.key==='ArrowUp')keys.up=1;if(e.key==='ArrowDown')keys.down=1;});
window.addEventListener('keyup',function(e){if(e.key==='ArrowLeft')keys.left=0;if(e.key==='ArrowRight')keys.right=0;if(e.key==='ArrowUp')keys.up=0;if(e.key==='ArrowDown')keys.down=0});
document.getElementById('startBtn').onclick=function(){storyBegin();startRun()};
/* ============================ BOOT ============================ */
function drawTitle(){var tcanvas=document.getElementById('titleFont'),tc=tcanvas.getContext('2d');tc.clearRect(0,0,tcanvas.width,tcanvas.height);ptext(tc,'NOVA',tcanvas.width/2,6,4,'#7CFC00','#ffffff','center');ptext(tc,'SIEGE',tcanvas.width/2,42,4,'#7CFC00','#ffffff','center');ptext(tc,"PIP'S ARCADE REMASTER",tcanvas.width/2,86,1,'#8fe36a','#04070c','center');}
drawTitle();
renderUpgrades();renderQuests();renderSkins();renderCredits();
document.getElementById('hBest').textContent=(window.GameSystem?window.GameSystem.getBestScore('nova-siege'):0).toLocaleString();
run={score:0,stage:1,wave:1,health:baseHealth(),credits:0,px:W/2,py:H-80,over:true,hint:0,combo:0,comboT:0,bestCombo:0,bullets:[],enemies:[],drops:[],parts:[],floats:[],flame:0,shakeT:0,shakeMag:0,inv:0,bossActive:false,shield:0,runPower:0,kills:0,waveKills:0,waveTarget:6,fireT:0};
window.__nova={get run(){return run},get meta(){return meta},get boss(){return boss},get sprites(){return SPR},get ships(){return SHIPS},get bg(){return bg},get bossType(){return boss?boss.type:null},get enemyKinds(){return run.enemies.map(function(e){return e.kind})},get stage(){return run.stage},get scale(){return vsScale},get lw(){return LW},get lh(){return LH},get hulls(){return HULLS},get combo(){return run.combo||0},get comboMult(){return comboMult()},get bossFire(){return boss?boss.fire:null},forceBoss:function(){spawnBoss();return boss?boss.type:null},forceEnd:function(){run.health=0;hurtPlayer()}};
hud();
})();
