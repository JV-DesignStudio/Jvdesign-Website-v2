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
'?':['.###.','#...#','....#','...#.','..#..','.....','..#..'],
',' :['.....','.....','.....','.....','..#..','.#...','#....'],
'=' :['.....','.....','#####','.....','#####','.....','.....'],
'\u00b7':['.....','.....','.....','..#..','.....','.....','.....']
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
/* A1629 a bomber that drifts down and drops drifting mines. */
var BOMBER_ROWS=['..ooooo..','.oBBBBBo.','oBBBBBBBo','oBBOOOBBo','oBBBBBBBo','.bBBBBBb.','..o...o..'];
var BOMBER_LEG=[['o','#5a3208'],['B','#c88a2a'],['O','#ffd166'],['b','#ff8c1a']];
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
var SPR={ufo:build(UFO_ROWS,UFO_LEG),dart:build(DART_ROWS,DART_LEG),purp:build(PURP_ROWS,PURP_LEG),star:build(STAR_ROWS,STAR_LEG),orb:build(ORB_ROWS,ORB_LEG),plus:build(PLUS_ROWS,PLUS_LEG),boss:build(BOSS_ROWS,BOSS_LEG),diver:build(DIVER_ROWS,DIVER_LEG),gunner:build(GUNNER_ROWS,GUNNER_LEG),splitter:build(SPLIT_ROWS,SPLIT_LEG),bomber:build(BOMBER_ROWS,BOMBER_LEG),boss2:build(BOSS2_ROWS,BOSS2_LEG),boss3:build(BOSS3_ROWS,BOSS3_LEG)};
var BOSS_SPR=[SPR.boss,SPR.boss2,SPR.boss3];
var BOSS_NAME=['GATE WARDEN','NOVA SPINNER','SWARM HIVE'];
var SHIPS=HULLS.map(shipSprite);
/* ============================ SAVE / META ============================ */
var KEY='jvds-nova-siege-v1';
function fresh(){return{credits:0,hull:0,up:{damage:0,rate:0,multishot:0,speed:0,shield:0,magnet:0,life:0},quests:{kills:0,bosses:0,waves:0,best:0,runs:0,powerups:0},completed:{},hulls:[0],tutDone:false,cb:prefersContrast()};}
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
/* A987 roguelike: run-only upgrades. These are drafted mid-run (never bought
   with permanent credits) and reset every launch, so each run builds a
   different ship. `rarity` weights how often a card is offered. */
var RUN_UPGRADES=[
 {id:'damage',name:'Overcharge',desc:'+1 blaster damage',rarity:'common',max:8},
 {id:'rate',name:'Rapid Fire',desc:'Shots fire faster',rarity:'common',max:6},
 {id:'multishot',name:'Wing Cannons',desc:'+1 cannon per volley',rarity:'rare',max:5},
 {id:'speed',name:'Thrusters',desc:'Fly and dodge quicker',rarity:'common',max:5},
 {id:'shield',name:'Aegis Cell',desc:'+1 shield charge (absorbs a hit)',rarity:'rare',max:4},
 {id:'magnet',name:'Tractor Beam',desc:'Pull drops toward you',rarity:'common',max:3},
 {id:'life',name:'Hull Patch',desc:'+1 health now',rarity:'rare',max:4},
 {id:'pierce',name:'Photon Lance',desc:'Shots pierce +1 enemy',rarity:'epic',max:3},
 {id:'crit',name:'Targeting Chip',desc:'+15% chance to crit for x2',rarity:'rare',max:4},
 {id:'homing',name:'Seeker Rounds',desc:'Shots curve toward enemies',rarity:'epic',max:2},
 {id:'drone',name:'Wingman Drone',desc:'An orbiting drone fires for you',rarity:'epic',max:3},
 {id:'explosive',name:'Explosive Rounds',desc:'Kills blast nearby enemies',rarity:'rare',max:3},
 {id:'vampire',name:'Leech Core',desc:'Kills can repair your hull',rarity:'rare',max:3},
 {id:'luck',name:'Salvage Scanner',desc:'Enemies drop pickups more often',rarity:'common',max:3}];
/* A987 station shop: spend credits earned THIS run for instant upgrades. */
var SHOP_POOL=[
 {id:'heal',name:'Repair Kit',desc:'+1 health now',cost:35},
 {id:'shield',name:'Shield Cell',desc:'+1 shield charge',cost:50},
 {id:'damage',name:'Weapon Core',desc:'+1 blaster damage',cost:60},
 {id:'rate',name:'Coolant Coil',desc:'Shots fire faster',cost:60},
 {id:'multishot',name:'Wing Mount',desc:'+1 cannon per volley',cost:95},
 {id:'life',name:'Hull Plating',desc:'+1 health now',cost:85},
 {id:'magnet',name:'Tractor Coil',desc:'+1 credit magnet',cost:45},
 {id:'pierce',name:'Lance Rounds',desc:'Shots pierce +1 enemy',cost:110},
 {id:'crit',name:'Targeting Suite',desc:'+15% crit chance',cost:70},
 {id:'drone',name:'Drone Bay',desc:'+1 orbiting wingman',cost:115},
 {id:'explosive',name:'Blast Rounds',desc:'Kills blast nearby enemies',cost:85},
 {id:'vampire',name:'Leech Core',desc:'Kills can repair your hull',cost:75},
 {id:'luck',name:'Salvage Scanner',desc:'Enemies drop pickups more often',cost:55}];
var QUESTS=[
 {id:'kills50',name:'Swatter',text:'Destroy 50 swarm ships (total)',goal:50,key:'kills',reward:200},
 {id:'waves10',name:'Holding the Line',text:'Clear 10 waves',goal:10,key:'waves',reward:180},
 {id:'boss1',name:'Gate Crasher',text:'Defeat your first boss',goal:1,key:'bosses',reward:400},
 {id:'score10k',name:'Nova Ace',text:'Reach 10,000 score in one run',goal:10000,key:'best',reward:500},
 {id:'power3',name:'Overcharged',text:'Collect 3 power stars in one run',goal:3,key:'powerups',reward:250},
 {id:'runs10',name:'Veteran Pilot',text:'Launch 10 runs',goal:10,key:'runs',reward:300}];
/* ============================ WAVE MODIFIERS ============================ */
var WAVE_MODS=[
 {id:'bonus',name:'BONUS WAVE',tag:'2x CREDITS',col:'#ffd166'},
 {id:'elite',name:'ELITE WAVE',tag:'BUFFED ENEMIES',col:'#ff4d5e'},
 {id:'dark',name:'DARK ZONE',tag:'NO HEALTH DROPS',col:'#c060ff'},
 {id:'rush',name:'RUSH WAVE',tag:'FASTER SPAWNS',col:'#ff9f2e'}];
/* ============================ STORY + SYSTEM ============================ */
var storyRun=window.__storyRun=new StoryRun({id:'nova-siege',character:'Pip',title:'Pip and the Nova Gate',open:'The Swarm is streaming out of the Nova gate and Pip needs a pilot: fly the defence ship and hold the line.',objective:'Dodge the swarm, shoot the galactic army and bank credits to upgrade your ship.',cap:300,beats:[{at:0,text:'First wave inbound. Fly and fire!'},{at:0.4,text:'The swarm thickens and a boss is closing.'},{at:0.8,text:'The Nova gate glows: one last push to hold the line.'}],result:{success:'The gate collapses and Pip tees up a bigger ship for next time.',partial:'You hold most of the line; the swarm regroups, but the credits are banked.',fail:'The swarm breaks through this time, but your upgrades are still there for the next launch.'},onBeat:function(b){if(typeof run!=='undefined'&&run){run.beat=b.text;run.beatT=170;}},onRestart:function(){startRun()}});
function storyBegin(){if(window.__storyRun&&!window.__storyRun.running)window.__storyRun.begin()}
function storyScore(){if(window.__storyRun)window.__storyRun.setScore(run.score)}
var gameSystem=null;try{gameSystem=new GameSystem('nova-siege','Nova Siege','pip');gameSystem.trackScore({xpDivisor:12,tiers:[[1,'firstLaunch'],[5000,'score5k'],[10000,'score10k']]});}catch(e){}
/* A795 shared auto-pause: backgrounding a run stops the rAF loop and the
   engine shows the standard tap-to-resume overlay (styled in game-system.css). */
try{if(typeof GameUI!=='undefined'&&GameUI.autoPause)GameUI.autoPause({pause:function(){if(typeof run==='undefined'||!run||run.over||run.paused)return false;cancelAnimationFrame(raf);return true;},resume:function(){if(typeof run==='undefined'||!run||run.over||run.paused)return;lastT=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}});}catch(e){}
var sfxAudio=null;
function sfx(k){try{sfxAudio=sfxAudio||new AudioEffects(0.35);if(!sfxAudio)return;if(k==='win')sfxAudio.playSuccess();else if(k==='bad')sfxAudio.playError();else if(k==='boss')sfxAudio.playLevelUp();else if(k==='kill')sfxAudio.playTap(520+Math.min(12,(typeof run!=='undefined'&&run?run.combo:0)||0)*70);else if(k==='hit'&&sfxAudio.playHit)sfxAudio.playHit();else sfxAudio.playTap();}catch(e){}}
/* ============================ GAME ============================ */
var cv=document.getElementById('cv'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
var vsScale=1; // logical -> backing-store scale, set by nsFit; render() must re-apply it every frame
var cssScale=1; // logical -> CSS-pixel scale, so on-screen text can clear the Exit control
var LW=540,LH=960; // A986/A1612 play-field: the logical width is fixed, the height adapts to the screen
var VS=LH/720; // vertical speed scale so a taller field keeps the original pace
var W=LW,H=LH;
/* A1612 fullscreen app-in-app: the logical field fills the available stage.
   Width stays fixed at 540 so horizontal gameplay is identical on every device;
   the height is chosen from the stage aspect (clamped to a portrait range) so a
   phone fills the screen edge to edge and a desktop gets a bigger field. VS is
   recomputed so the original vertical pace is kept however tall the field is. */
function nsFit(){try{var d=Math.min(window.devicePixelRatio||1,2);var wrap=cv.parentElement;var availW=Math.max(200,(wrap&&wrap.clientWidth)||LW);var availH=Math.max(260,(wrap&&wrap.clientHeight)||window.innerHeight);var h=Math.round(LW*(availH/availW));h=Math.max(680,Math.min(1400,h));W=LW;H=h;VS=H/720;var s=Math.min(availW/LW,availH/H);var cssW=LW*s,cssH=H*s;if(window.HiDPI&&HiDPI.fit){HiDPI.fit(cv,Math.round(cssW),Math.round(cssH));}else{cv.style.width=cssW+'px';cv.style.height=cssH+'px';cv.width=Math.round(cssW*d);cv.height=Math.round(cssH*d);}cv.height=Math.round(cv.width*H/LW);cssScale=cssW/LW;vsScale=cv.width/LW;ctx.setTransform(vsScale,0,0,vsScale,0,0);ctx.imageSmoothingEnabled=false;}catch(e){}}
nsFit();window.addEventListener('resize',nsFit);
var STARCOL=['#ffffff','#ff6ec7','#7CFC00','#4aa8ff','#ffaa33','#66e0ff'];
var nowMs=0; // A1612 frame clock for star twinkle
function hexA(h,a){var n=parseInt(h.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}
/* A970 endless parallax space: three star layers, drifting nebulae and slow
   planets, each scrolling at its own speed behind the play field. A1612 layers
   on a denser brighter field, twinkling stars and soft gradient nebulae. */
var bg={far:[],mid:[],near:[],neb:[],planets:[],comets:[]};
var NEB_COLS=['#3a1f7e','#12504f','#5a1828','#103a57','#2a1a62','#1e4a2a','#4a280a','#3a0a3a','#0a2a4a','#1f3a1f'];
function newPlanet(y){var r=rnd(40,82),k=(Math.random()*5)|0;return{x:rnd(60,W-60),y:y,r:r,c:['#3a2a6a','#2a4a3a','#5a2a3a','#2a3a5a','#4a3a1a'][k],hi:['#8a7ae0','#6ad0a0','#e080a0','#6ab0e0','#d0a840'][k],sp:rnd(0.14,0.28),ring:Math.random()<0.6};}
function newComet(){return{x:rnd(-40,W+40),y:rnd(-80,-20),vx:rnd(-1.2,1.2),vy:rnd(10,22),life:rnd(22,44),maxLife:44,len:rnd(28,64),c:STARCOL[(Math.random()*STARCOL.length)|0]};}
function bgReset(){
  bg.far=[];bg.mid=[];bg.near=[];bg.neb=[];bg.planets=[];bg.comets=[];
  var i;
  for(i=0;i<200;i++)bg.far.push({x:Math.random()*W,y:Math.random()*H,s:1,c:STARCOL[(Math.random()*STARCOL.length)|0],sp:rnd(0.2,0.5),a:0.7,ph:Math.random()*6.28});
  for(i=0;i<110;i++)bg.mid.push({x:Math.random()*W,y:Math.random()*H,s:1,c:Math.random()<0.25?'#bcdcff':'#eaf4ff',sp:rnd(0.55,0.9),a:0.9,ph:Math.random()*6.28});
  for(i=0;i<55;i++)bg.near.push({x:Math.random()*W,y:Math.random()*H,s:2,c:'#ffffff',sp:rnd(1.1,1.8),a:1,ph:Math.random()*6.28});
  for(i=0;i<10;i++)bg.neb.push({x:Math.random()*W,y:Math.random()*H,r:rnd(180,360),c:NEB_COLS[i%NEB_COLS.length],sp:rnd(0.08,0.18),a:rnd(0.45,0.72)});
  for(i=0;i<4;i++)bg.planets.push(newPlanet(Math.random()*H-H));
}
function scrollBg(dt,mult){
  var layers=[[bg.far,4],[bg.mid,4],[bg.near,4],[bg.neb,280]];
  for(var l=0;l<layers.length;l++){var arr=layers[l][0],pad=layers[l][1];for(var i=0;i<arr.length;i++){var o=arr[i];o.y+=o.sp*mult*dt;if(o.y>H+pad){o.y=-pad-Math.random()*60;o.x=Math.random()*W;}}}
  for(var p=0;p<bg.planets.length;p++){var pl=bg.planets[p];pl.y+=pl.sp*mult*dt;if(pl.y>H+pl.r+30)bg.planets[p]=newPlanet(-pl.r-40-Math.random()*220);}
  /* occasional shooting stars */
  if(!reduceMotion&&Math.random()<0.004*dt)bg.comets.push(newComet());
  for(var ci=bg.comets.length-1;ci>=0;ci--){var cm=bg.comets[ci];cm.x+=cm.vx*dt;cm.y+=cm.vy*dt;cm.life-=dt;if(cm.life<=0)bg.comets.splice(ci,1);}
}
function drawStars(arr){for(var i=0;i<arr.length;i++){var s=arr[i];var a=s.a*(0.4+0.6*Math.min(1,s.y/H))*(reduceMotion?1:(0.7+0.3*Math.sin(nowMs*0.004+s.ph)));ctx.globalAlpha=a;ctx.fillStyle=s.c;ctx.fillRect(s.x|0,s.y|0,s.s,s.s);}ctx.globalAlpha=1;}
bgReset();
var run,raf,keys={},drag={active:false,sx:0,sy:0,ox:0,oy:0,tx:0,ty:0},lastT=0;
var SS=3; // A1612 sprite zoom: ship and enemies read bigger on a phone
/* A1617/A1629 accessibility: honour reduced motion (live, so a mid-session OS
   change applies) and a high-contrast preference for the colourblind bullet
   shapes. */
var reduceMotion=false;
try{if(window.matchMedia){var rmq=window.matchMedia('(prefers-reduced-motion: reduce)');reduceMotion=rmq.matches;if(rmq.addEventListener)rmq.addEventListener('change',function(e){reduceMotion=e.matches;});}}catch(e){}
function prefersContrast(){try{return !!(window.matchMedia&&(window.matchMedia('(prefers-contrast: more)').matches||window.matchMedia('(forced-colors: active)').matches));}catch(e){return false;}}
var LASTKEY='jvds-nova-last-run';
var powerTimer=0,powerKind=null,fireSfxT=0,killSfxT=0,a11yT=0;
/* Closest distance from point to segment, used for swept bullet collision so
   fast shots never tunnel through a small enemy between frames. */
function segHit(x1,y1,x2,y2,px,py,r){var dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;var t=l2?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l2)):0;var cx=x1+t*dx,cy=y1+t*dy;return Math.hypot(px-cx,py-cy)<=r;}
function hullBonus(k){var h=HULLS[meta.hull]||HULLS[0];return (h.bonus&&h.bonus[k])||0}
function baseHealth(){return 3+(meta.up.life||0)+hullBonus('health')}
/* A987 run-only stat readers: permanent meta + hull + drafted run upgrades. */
function upLv(id){return (run&&run.runUps&&run.runUps[id])||0}
function runDamage(){return 1+(meta.up.damage||0)+hullBonus('damage')+upLv('damage')}
function runRate(){return Math.max(4,10-(meta.up.rate||0)-upLv('rate'))}
function runShots(){return 1+(meta.up.multishot||0)+hullBonus('shots')+upLv('multishot')+(hasEvo('spread')?2:0)}
function runSpeed(){return 3.4+((meta.up.speed||0)+upLv('speed'))*0.5+hullBonus('speed')}
function runMagnet(){return (meta.up.magnet||0)+upLv('magnet')}
function runCrit(){return upLv('crit')*0.15}
function runPierce(){return upLv('pierce')}
/* A1617 evolutions: taking certain run upgrades together unlocks a stronger
   synergy. Each one is a real mechanical change, announced once per run. */
var RUN_ABBR={damage:'DMG',rate:'RATE',multishot:'CAN',speed:'SPD',shield:'SHD',magnet:'MAG',life:'HP',pierce:'PRC',crit:'CRT',homing:'HOM',drone:'DRN',explosive:'EXP',vampire:'LCH',luck:'LCK'};
var EVOLUTIONS=[
 {id:'spread',name:'Nova Spread',info:'Cannons fan out (+2 shots)',need:function(){return upLv('multishot')>=3&&upLv('rate')>=2;}},
 {id:'nova',name:'Nova Blast',info:'Explosions are bigger',need:function(){return upLv('pierce')>=2&&upLv('explosive')>=1;}},
 {id:'swarm',name:'Drone Swarm',info:'Wingmen fire much faster',need:function(){return upLv('drone')>=2;}},
 {id:'guard',name:'Aegis Field',info:'Shields absorb two hits',need:function(){return upLv('shield')>=2;}}];
function hasEvo(id){return !!(run&&run.evos&&run.evos.indexOf(id)>=0)}
function shieldMax(){return hasEvo('guard')?2:1}
function buildLabel(){
  if(!run||!run.runUps)return'';
  var out=[],id;for(id in run.runUps){if(run.runUps[id]>0)out.push((RUN_ABBR[id]||id.toUpperCase())+run.runUps[id]);}
  if(run.evos&&run.evos.length)out.push('EVO'+run.evos.length);
  return out.join(' ');
}
function checkEvolutions(){
  if(!run||!run.evos)return;
  for(var i=0;i<EVOLUTIONS.length;i++){var ev=EVOLUTIONS[i];
    if(run.evos.indexOf(ev.id)<0&&ev.need()){run.evos.push(ev.id);float(W/2,H*0.5,'EVOLUTION: '+ev.name,'#4cc9f0');shake(10);sfx('win');}}
}
function hitR(sp){return sp===SPR.boss?33:14}
function startRun(){
  run={score:0,stage:1,wave:1,health:baseHealth(),credits:0,px:W/2,py:H-80,fireT:0,shield:(meta.up.shield||0)>0?1:0,inv:90,waveKills:0,waveTarget:6,kills:0,runPower:0,over:false,hint:210,combo:0,comboT:0,bestCombo:0,bossActive:false,bullets:[],enemies:[],drops:[],parts:[],floats:[],flame:0,shakeT:0,shakeMag:0,runUps:{},evos:[],tut:(meta.tutDone?0:330),beat:'',beatT:0,introMain:'',introSub:'',introT:0,paused:false,drones:[],level:1,blasts:[],rings:[],waveMod:null,laserT:0};
  spawnT=36;boss=null;spawnQueue=0;shopStock=[];shopRerolled=0;killSfxT=0;
  document.getElementById('shopOverlay').classList.add('hidden');
  showMenuMain();var rcb=document.getElementById('runCardBtn');if(rcb)rcb.style.display='none';
  updatePauseBtn();
  meta.quests.runs++;saveMeta();qUpdate();
  document.getElementById('titleFont').style.display='';fireSfxT=0;
  document.getElementById('overlay').classList.add('hidden');
  cancelAnimationFrame(raf);lastT=0;raf=requestAnimationFrame(loop);
}
var spawnT=36,boss=null,spawnQueue=0,uidc=1,shopStock=[],shopRerolled=0;
function endRun(win){
  if(run.over)return;  run.over=true;cancelAnimationFrame(raf);run.paused=false;
  document.getElementById('shopOverlay').classList.add('hidden');
  showMenuMain();
  updatePauseBtn();
  meta.credits+=run.credits;meta.quests.best=Math.max(meta.quests.best||0,run.score);saveMeta();
  if(window.GameSystem&&window.GameSystem.saveScore)window.GameSystem.saveScore('nova-siege',run.score,{level:run.stage});
  try{if(window.jvdsCheckNewBest)window.jvdsCheckNewBest()}catch(e){}
  try{if(gameSystem){gameSystem.state.score=run.score;if(run.score>(gameSystem.state.highScore||0))gameSystem.state.highScore=run.score;gameSystem.recordGamePlay(Date.now());gameSystem.addCoins(run.credits);gameSystem.saveState();}}catch(e){}
  try{var pp=window.playerProfile;if(pp&&pp.addXP)pp.addXP(Math.round(run.score/12),'game:nova-siege')}catch(e){}
  qUpdate();renderUpgrades();renderCredits();
  document.getElementById('titleFont').style.display='none';
  document.getElementById('ovText').innerHTML=runReportHTML(win?'success':(run.stage>1?'partial':'fail'));
  document.getElementById('startBtn').textContent='Launch Again';
  var rcb=document.getElementById('runCardBtn');if(rcb)rcb.style.display='';
  saveLastRun();renderTitleStats();
  document.getElementById('overlay').classList.remove('hidden');
  /* A1617: the game's own end screen (with the run report and run card) is the
     death screen, so the shared story modal would only duplicate it. Show the
     story result inside the report and drop the modal. */
  if(window.__storyRun){window.__storyRun.finish(win?'success':(run.stage>1?'partial':'fail'),run.score);var sm=document.querySelector('.storyrun.sr-modal');if(sm&&sm.parentNode)sm.parentNode.removeChild(sm);}
}
function rnd(a,b){return a+Math.random()*(b-a)}
/* A1617 run report, saved run summary and shareable run card. */
function runUpsText(){var out=[];for(var uk in run.runUps){if(run.runUps[uk]>0){var ur=null;for(var uq=0;uq<RUN_UPGRADES.length;uq++)if(RUN_UPGRADES[uq].id===uk)ur=RUN_UPGRADES[uq];out.push((ur?ur.name:uk)+' x'+run.runUps[uk]);}}return out.join(', ');}
function runEvosText(){var out=[];for(var i=0;i<EVOLUTIONS.length;i++)if(hasEvo(EVOLUTIONS[i].id))out.push(EVOLUTIONS[i].name);return out.join(', ');}
function bestScore(){try{return (window.GameSystem&&window.GameSystem.getBestScore)?window.GameSystem.getBestScore('nova-siege'):0}catch(e){return 0}}
function runReportHTML(outcome){
  var hull=(HULLS[meta.hull]||HULLS[0]).name,ups=runUpsText(),evos=runEvosText(),story='';
  try{if(window.__storyRun&&window.__storyRun.result)story=window.__storyRun.result[outcome]||'';}catch(e){}
  return '<b>Run report</b><br>Score <b>'+run.score.toLocaleString()+'</b> &middot; Stage '+run.stage+' &middot; Wave '+run.wave+' &middot; Level '+(run.level||1)+'<br>Hull '+hull+' &middot; Credits banked <b>'+run.credits+'</b> &middot; Total <b>'+meta.credits+'</b>'+(ups?'<br>Upgrades: '+ups+'.':'')+(evos?'<br>Evolutions: <b>'+evos+'</b>.':'')+(story?'<br><em>'+story+'</em>':'')+'<br>Best '+(Number(bestScore())||0).toLocaleString()+'.';
}
function saveLastRun(){try{localStorage.setItem(LASTKEY,JSON.stringify({score:run.score,stage:run.stage,wave:run.wave,level:run.level||1,hull:(HULLS[meta.hull]||HULLS[0]).name,credits:run.credits,evos:run.evos.slice(),ups:run.runUps,date:new Date().toISOString()}));}catch(e){}}
function renderTitleStats(){var el=document.getElementById('titleStats');if(!el)return;el.textContent='Best '+(Number(bestScore())||0).toLocaleString()+'  \u00b7  Credits '+meta.credits.toLocaleString()+'  \u00b7  Hulls '+meta.hulls.length+'/'+HULLS.length;}
function makeRunCard(){
  var cw=540,ch=760,c=document.createElement('canvas');c.width=cw;c.height=ch;var g=c.getContext('2d');
  var grd=g.createLinearGradient(0,0,0,ch);grd.addColorStop(0,'#0b1c34');grd.addColorStop(1,'#05070d');g.fillStyle=grd;g.fillRect(0,0,cw,ch);
  for(var i=0;i<170;i++){g.globalAlpha=0.3+Math.random()*0.6;g.fillStyle=STARCOL[(Math.random()*STARCOL.length)|0];var sz=Math.random()<0.15?2:1;g.fillRect((Math.random()*cw)|0,(Math.random()*ch)|0,sz,sz);}
  g.globalAlpha=1;g.strokeStyle='#1e3a52';g.lineWidth=2;g.strokeRect(16,16,cw-32,ch-32);
  ptext(g,'NOVA',cw/2,50,7,'#7CFC00','#04120a','center');
  ptext(g,'SIEGE',cw/2,112,7,'#7CFC00','#04120a','center');
  ptext(g,'RUN REPORT',cw/2,190,2,'#8fe36a','#04120a','center');
  ptext(g,'SCORE',cw/2,236,2,'#8fe36a','#04120a','center');
  ptext(g,String(run.score),cw/2,266,6,'#ffffff','#04120a','center');
  ptext(g,'STAGE '+run.stage+'   WAVE '+run.wave+'   LVL '+(run.level||1),cw/2,360,2,'#bfe9ff','#04120a','center');
  ptext(g,'HULL '+((HULLS[meta.hull]||HULLS[0]).name),cw/2,398,2,'#bfe9ff','#04120a','center');
  g.drawImage(SHIPS[meta.hull]||SHIPS[0],cw/2-50,430,100,116);
  var ups=runUpsText(),evos=runEvosText(),yy=596;
  if(evos){ptext(g,'EVOLUTIONS: '+evos,cw/2,yy,2,'#4cc9f0','#04120a','center');yy+=34;}
  if(ups){ptext(g,'BUILD: '+ups,cw/2,yy,1,'#8fe36a','#04120a','center');}
  ptext(g,'JVDesignStudio  \u00b7  '+new Date().toLocaleDateString(),cw/2,ch-48,1,'#6f93a8','#04120a','center');
  return c;
}
function downloadRunCard(){try{var c=makeRunCard(),a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='nova-siege-run-'+run.score+'.png';document.body.appendChild(a);a.click();document.body.removeChild(a);}catch(e){}}
function shake(m){run.shakeMag=Math.max(run.shakeMag,m);run.shakeT=12}
function deathRing(x,y,col,size){if(run.rings)run.rings.push({x:x,y:y,r:4,maxR:size||40,col:col,life:18,maxLife:18});}
function burst(x,y,col,n){for(var i=0;i<(n||8);i++){var a=Math.random()*Math.PI*2,s=rnd(1.5,5.5);run.parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(20,42),c:col})}}
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
  if(st>=6&&t>0.965)return 'bomber';
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
  var pattern=kind==='diver'?'dive':(kind==='gunner'?'hover':(kind==='bomber'?'bomber':(kind==='splitter'?'straight':(Math.random()<0.45?'sine':(Math.random()<0.5?'swoop':'straight')))));
  var hp=(kind==='splitter'?4:kind==='gunner'?3:kind==='bomber'?3:kind==='orb'?2:1)+(run.waveMod&&run.waveMod.id==='elite'?1:0);
  var vy=(kind==='diver'?rnd(1.7,2.4)+run.stage*0.12:(kind==='splitter'?rnd(0.5,0.8):(kind==='bomber'?rnd(0.6,0.9):rnd(0.8,1.5)+run.stage*0.1)))*VS;
  var e={kind:kind,pattern:pattern,x:rnd(40,W-40),y:-30,vy:vy,t:0,hp:hp,r:kind==='splitter'?21:hitR(SPR[kind]),spr:SPR[kind],dir:Math.random()<0.5?-1:1,amp:rnd(24,60),freq:rnd(0.02,0.05),fire:rnd(50,110)};
  run.enemies.push(e);
}
function makeEnemy(x,y){
  var kind=pickKind();
  var pattern=kind==='diver'?'dive':(kind==='gunner'?'hover':(kind==='bomber'?'bomber':(kind==='splitter'?'straight':(Math.random()<0.45?'sine':(Math.random()<0.5?'swoop':'straight')))));
  var hp=(kind==='splitter'?4:kind==='gunner'?3:kind==='bomber'?3:kind==='orb'?2:1)+(run.waveMod&&run.waveMod.id==='elite'?1:0);
  var vy=(kind==='diver'?rnd(1.7,2.4)+run.stage*0.12:(kind==='splitter'?rnd(0.5,0.8):(kind==='bomber'?rnd(0.6,0.9):rnd(0.8,1.5)+run.stage*0.1)))*VS;
  return{kind:kind,pattern:pattern,x:x,y:y,vy:vy,t:0,hp:hp,r:kind==='splitter'?21:hitR(SPR[kind]),spr:SPR[kind],dir:Math.random()<0.5?-1:1,amp:rnd(24,60),freq:rnd(0.02,0.05),fire:rnd(50,110)};
}
var FORMATIONS=['v','line','pincer','arrow'];
var nextFormation=0,formationCooldown=0;
function spawnFormation(){
  var type=FORMATIONS[nextFormation%FORMATIONS.length];nextFormation++;
  var cx=rnd(W*0.2,W*0.8),pts=[];
  if(type==='v'){pts=[[cx,0],[cx-50,35],[cx+50,35],[cx-100,70],[cx+100,70]];}
  else if(type==='line'){for(var i=0;i<6;i++)pts.push([W*0.1+i*(W*0.8/5),-20]);}
  else if(type==='pincer'){for(var i=0;i<3;i++)pts.push([W*0.06+i*42,-i*28]);for(var i=0;i<3;i++)pts.push([W*0.94-i*42,-i*28]);}
  else{pts=[[cx,-10],[cx-44,-40],[cx+44,-40],[cx-88,-70],[cx+88,-70],[cx,-70]];}
  float(W/2,H*0.32,type.toUpperCase()+' FORMATION','#8fe36a');
  for(var i=0;i<pts.length;i++){var e=makeEnemy(pts[i][0],pts[i][1]);run.enemies.push(e);run.waveKills++;}/* count toward wave so we don't over-spawn */
  run.waveKills=Math.max(0,run.waveKills-pts.length);/* actually subtract so formation kills count */
}
function spawnBoss(){
  run.bossActive=true;
  var type=(run.stage-1)%3;
  boss={x:W/2,y:-70,vy:0.9*VS,hp:30+run.stage*16,maxhp:30+run.stage*16,t:0,dir:1,fire:70,r:22,type:type,ang:0};
  float(W/2,H/2-58,BOSS_NAME[type],'#ff4d5e');float(W/2,H/2-40,'WARNING!','#ff4d5e');sfx('boss');
}
/* ----- update ----- */
function loop(ts){raf=requestAnimationFrame(loop);nowMs=ts||nowMs;if(run.over)return;if(run.paused){render();return;}if(!lastT)lastT=ts;var dt=Math.min(2.2,(ts-lastT)/16.667);lastT=ts;update(dt);render();}
function update(dt){
  var spd=runSpeed();
  if(drag.active){run.px+=(drag.tx-run.px)*0.5;run.py+=(drag.ty-run.py)*0.5;}
  if(keys.left)run.px-=spd;if(keys.right)run.px+=spd;
  if(keys.up)run.py-=spd;if(keys.down)run.py+=spd;
  run.px=Math.max(20,Math.min(W-20,run.px));run.py=clampPY(run.py);
  if(run.hint>0)run.hint-=dt;if(fireSfxT>0)fireSfxT-=dt;if(killSfxT>0)killSfxT-=dt;
  if(run.tut>0){run.tut-=dt;if(run.tut<=0){meta.tutDone=true;saveMeta();}}
  if(run.beatT>0)run.beatT-=dt;if(run.introT>0)run.introT-=dt;
  if(run.combo>0){run.comboT-=dt;if(run.comboT<=0)run.combo=0;}
  run.flame=(run.flame+dt)%6;
  if(run.inv>0)run.inv-=dt;
  /* fire upward, paired orbs like the original */
  run.fireT-=dt;
  var rate=runRate();if(powerTimer>0&&powerKind==='rapid')rate*=0.45;
  if(run.fireT<=0){
    run.fireT=rate;var dmg=runDamage();
    var shots=runShots()+((powerTimer>0&&powerKind==='spread')?2:0);
    var pr=runPierce();
    for(var i=0;i<shots;i++){var off=(i-(shots-1)/2)*16;run.bullets.push({x:run.px+off,y:run.py-24,vx:off*0.05,vy:-8*VS,dmg:dmg,pierce:pr,hit:{}});}
    if(fireSfxT<=0){sfx('tap');fireSfxT=9;}
  }
  if(powerTimer>0){powerTimer-=dt;if(powerTimer<=0)powerKind=null}
  for(var b=run.bullets.length-1;b>=0;b--){var sb=run.bullets[b];
    if(!sb.eb&&upLv('homing')){var ht=nearestTarget(sb.x,sb.y);if(ht){var hd=Math.atan2(ht.y-sb.y,ht.x-sb.x),hc=Math.atan2(sb.vy,sb.vx),dd=Math.atan2(Math.sin(hd-hc),Math.cos(hd-hc)),tn=0.05*upLv('homing')*dt;hc+=Math.max(-tn,Math.min(tn,dd));var hs=Math.hypot(sb.vx,sb.vy)||8;sb.vx=Math.cos(hc)*hs;sb.vy=Math.sin(hc)*hs;}}
    sb.x+=sb.vx*dt;sb.y+=sb.vy*dt;if(sb.y<-16||sb.y>H+40||sb.x<-40||sb.x>W+40)run.bullets.splice(b,1)}
  /* A987 wingman drones orbit the ship and fire at the nearest target */
  for(var dn0=0;dn0<run.drones.length;dn0++){var dno=run.drones[dn0];dno.ang+=0.028*dt;dno.x=run.px+Math.cos(dno.ang)*dno.r;dno.y=run.py+Math.sin(dno.ang)*dno.r;dno.fire-=dt;if(dno.fire<=0){var dnt=nearestTarget(dno.x,dno.y);if(dnt){var dna=Math.atan2(dnt.y-dno.y,dnt.x-dno.x);run.bullets.push({x:dno.x,y:dno.y,vx:Math.cos(dna)*7*VS,vy:Math.sin(dna)*7*VS,dmg:1,hit:{}});dno.fire=hasEvo('swarm')?28:46;}else dno.fire=14;}}
  /* spawn */
  spawnT-=dt;
  if(!run.bossActive&&spawnT<=0&&run.waveKills<run.waveTarget){
    formationCooldown-=dt;
    if(formationCooldown<=0&&run.wave>1&&Math.random()<0.12&&run.enemies.length<4){spawnFormation();formationCooldown=220;}
    else{spawnEnemy();}
    spawnT=Math.max(8,28-run.stage*3)*(run.waveMod&&run.waveMod.id==='rush'?0.55:1);
  }
  /* boss */
  if(boss){
    boss.t+=dt;if(boss.flash>0)boss.flash-=dt;
    if(!boss.phase2&&boss.hp<=boss.maxhp*0.5){boss.phase2=true;boss.fire=Math.min(boss.fire,20);float(boss.x,boss.y-30,'RAGE!','#ffd166');sfx('boss');}
    if(boss.y<96*VS)boss.y+=boss.vy*slowMult*dt;
    else{boss.x+=boss.dir*(0.9+run.stage*0.12)*(boss.phase2?1.35:1)*slowMult*dt;if(boss.x>W-60)boss.dir=-1;if(boss.x<60)boss.dir=1;}
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
      if(boss.phase2)boss.fire*=0.65;
    }
  }
  /* laser beam damage */
  if(powerKind==='laser'){run.laserT-=dt;if(run.laserT<=0){run.laserT=5;for(var le=run.enemies.length-1;le>=0;le--){var len=run.enemies[le];if(Math.abs(len.x-run.px)<22&&len.y<run.py){len.hp-=2;len.flash=4;burst(len.x,len.y,'#4cc9f0',3);if(len.hp<=0)killEnemy(len,len.x,len.y);}}}if(boss&&Math.abs(boss.x-run.px)<22){boss.hp-=0.6;boss.flash=3;}}
  var slowMult=(powerKind==='slow')?0.35:1;
  /* enemies */
  for(var e=run.enemies.length-1;e>=0;e--){
    var en=run.enemies[e];en.t+=dt;en.y+=en.vy*slowMult*dt;if(en.flash>0)en.flash-=dt;
    if(en.pattern==='sine')en.x+=Math.sin(en.t*en.freq)*en.amp*0.05;
    else if(en.pattern==='swoop')en.x+=en.dir*1.1*dt;
    else if(en.pattern==='dive')en.x+=Math.max(-1.9,Math.min(1.9,(run.px-en.x)*0.03))*dt;
    else if(en.pattern==='hover'){if(en.y>118*VS){en.vy=0;en.fire-=dt;if(en.fire<=0){en.fire=95;var ga=Math.atan2(run.py-en.y,run.px-en.x);run.bullets.push({eb:1,x:en.x,y:en.y+10,vx:Math.cos(ga)*3.1*VS,vy:Math.sin(ga)*3.1*VS,dmg:1});sfx('tap');}}}
    else if(en.pattern==='bomber'){if(en.y>70&&en.y<H*0.62){en.fire-=dt;if(en.fire<=0){en.fire=110;run.bullets.push({eb:1,mine:1,x:en.x,y:en.y+14,vx:0,vy:1.1*VS,dmg:1});}}}
    if(en.x<16||en.x>W-16)en.dir=-en.dir;
    if(en.y>H+30){run.enemies.splice(e,1);continue}
    if(run.inv<=0&&Math.hypot(en.x-run.px,en.y-run.py)<en.r+10){hurtPlayer();burst(en.x,en.y,'#ff9f2e',12);run.enemies.splice(e,1);continue}
    for(var s=run.bullets.length-1;s>=0;s--){var bb=run.bullets[s];if(bb.eb)continue;var py=bb.y-bb.vy*dt;if(segHit(bb.x-bb.vx*dt,py,bb.x,bb.y,en.x,en.y,en.r+4)){if(en.uid==null)en.uid=uidc++;bb.hit=bb.hit||{};if(bb.hit[en.uid])continue;var bd=bb.dmg;if(runCrit()&&Math.random()<runCrit()){bd*=2;float(en.x,en.y-14,'CRIT','#ffd166');}en.hp-=bd;en.flash=6;if(bb.pierce>0){bb.pierce--;bb.hit[en.uid]=1;if(en.hp<=0)killEnemy(en,en.x,en.y);else burst(bb.x,bb.y,'#9fe6ff',4);}else{run.bullets.splice(s,1);if(en.hp<=0)killEnemy(en,en.x,en.y);else burst(bb.x,bb.y,'#9fe6ff',4);}break;}}
  }
  /* boss bullets vs boss handled via shared hit below */
  if(boss){
    for(var s2=run.bullets.length-1;s2>=0;s2--){var b2=run.bullets[s2];if(b2.eb)continue;var py2=b2.y-b2.vy*dt;if(segHit(b2.x-b2.vx*dt,py2,b2.x,b2.y,boss.x,boss.y,boss.r+4)){var bd2=b2.dmg;if(runCrit()&&Math.random()<runCrit()){bd2*=2;float(boss.x,boss.y-20,'CRIT','#ffd166');}boss.hp-=bd2;boss.flash=6;run.bullets.splice(s2,1);burst(b2.x,b2.y,'#ffd166',3)}}
    if(run.inv<=0&&Math.hypot(boss.x-run.px,boss.y-run.py)<boss.r+13)hurtPlayer();
    if(boss.hp<=0)killBoss();
  }
  /* drops */
  for(var d=run.drops.length-1;d>=0;d--){
    var dr=run.drops[d];dr.y+=1.3*VS*dt;
    if(runMagnet()){var mx=run.px-dr.x,my=run.py-dr.y,md=Math.hypot(mx,my)||1;if(md<150+runMagnet()*30){dr.x+=mx/md*(2.2+runMagnet()*0.6)*dt;dr.y+=my/md*(2.2+runMagnet()*0.6)*dt}}
    if(dr.y>H+16){run.drops.splice(d,1);continue}
    if(Math.hypot(dr.x-run.px,dr.y-run.py)<36){
      if(dr.type==='health'){run.health=Math.min(9,run.health+1);float(dr.x,dr.y,'+1 HP','#7CFC00');}
      else if(dr.type==='credit'){addCredits(dr.v,dr.x,dr.y);}
      else{
        if(dr.w==='shield'){run.shield=Math.max(run.shield,1);}
        else if(dr.w==='nova'){/* Nova Bomb: nuke all on-screen enemies */
          var toKill=run.enemies.slice();shake(22);
          for(var nk=0;nk<toKill.length;nk++)killEnemy(toKill[nk],toKill[nk].x,toKill[nk].y,true);
          burst(W/2,H/2,'#ff4d5e',80);deathRing(W/2,H/2,'#ff4d5e',W*0.7);
          if(boss){boss.hp=Math.max(1,boss.hp-40);boss.flash=20;burst(boss.x,boss.y,'#ff4d5e',40);}
        }
        else if(dr.w==='laser'){powerKind='laser';powerTimer=280;run.laserT=0;}
        else if(dr.w==='slow'){powerKind='slow';powerTimer=360;}
        else{powerKind=dr.w;powerTimer=440;}
        run.runPower++;meta.quests.powerups=Math.max(meta.quests.powerups||0,run.runPower);float(dr.x,dr.y,dr.label,dr.c);
      }
      sfx('win');run.drops.splice(d,1);
    }
  }
  /* the "eb" boss bullets live in run.bullets too; update all non-player ones */
  for(var eb=run.bullets.length-1;eb>=0;eb--){var ebl=run.bullets[eb];if(!ebl.eb)continue;ebl.x+=ebl.vx*dt;ebl.y+=ebl.vy*dt;if(ebl.y>H+16||ebl.x<-16||ebl.x>W+16){run.bullets.splice(eb,1);continue}if(run.inv<=0&&Math.hypot(ebl.x-run.px,ebl.y-run.py)<16){hurtPlayer();run.bullets.splice(eb,1)}}
  for(var p=run.parts.length-1;p>=0;p--){var pa=run.parts[p];pa.x+=pa.vx*dt;pa.y+=pa.vy*dt;pa.vy+=0.05*dt;pa.life-=dt;if(pa.life<=0)run.parts.splice(p,1)}
  for(var f=run.floats.length-1;f>=0;f--){var fa=run.floats[f];fa.y-=0.7*dt;fa.life-=dt;if(fa.life<=0)run.floats.splice(f,1)}
  resolveBlasts();
  for(var bi=run.blasts.length-1;bi>=0;bi--){run.blasts[bi].life-=dt;if(run.blasts[bi].life<=0)run.blasts.splice(bi,1);}
  if(run.rings)for(var ri=run.rings.length-1;ri>=0;ri--){var rg=run.rings[ri];rg.r+=(rg.maxR-rg.r)*0.22*dt;rg.life-=dt;if(rg.life<=0)run.rings.splice(ri,1);}
  scrollBg(dt,1+run.stage*0.04);
  if(run.shakeT>0){run.shakeT-=dt;if(run.shakeT<=0)run.shakeMag=0}
  hud();
}
function killEnemy(en,x,y,noBlast){
  var idx=run.enemies.indexOf(en);if(idx>=0)run.enemies.splice(idx,1);
  var col=en.kind==='ufo'?'#7fe07f':en.kind==='dart'?'#ffd166':en.kind==='purp'?'#e96fe9':en.kind==='diver'?'#ff5030':en.kind==='gunner'?'#4fd6a0':en.kind==='splitter'?'#7a7a90':en.kind==='bomber'?'#c88a2a':'#4a8aff';
  burst(x,y,col,en.kind==='splitter'?42:22);
  deathRing(x,y,col,en.kind==='splitter'?56:36);
  if(killSfxT<=0){sfx('kill');killSfxT=3;}
  if(!noBlast&&upLv('explosive'))run.blasts.push({x:x,y:y,r:hasEvo('nova')?84:60,dmg:upLv('explosive'),life:16,resolved:false});
  var pts=en.kind==='splitter'?150:en.kind==='bomber'?100:en.kind==='gunner'?90:en.kind==='diver'?60:en.kind==='orb'?80:40;
  var gained=Math.round(pts*addCombo(x,y));run.score+=gained;float(x,y,'+'+gained,'#bfe9ff');
  var crMult=run.waveMod&&run.waveMod.id==='bonus'?2:1;
  addCredits((en.kind==='splitter'?22:en.kind==='bomber'?16:en.kind==='orb'?14:8)*crMult);
  if(en.kind==='splitter'){for(var sc=0;sc<2;sc++){run.enemies.push({kind:'ufo',pattern:'swoop',x:Math.max(24,Math.min(W-24,x+(sc?26:-26))),y:y,vy:1.4,t:0,hp:1,r:hitR(SPR.ufo),spr:SPR.ufo,dir:sc?1:-1,amp:24,freq:0.03,fire:80});}}
  meta.quests.kills++;run.waveKills++;run.kills++;
  if(upLv('vampire')&&run.health<9&&Math.random()<upLv('vampire')*0.08){run.health++;float(x,y,'+1 HP','#7CFC00');}
  var luck=upLv('luck')*0.06,roll=Math.random();
  var darkZone=run.waveMod&&run.waveMod.id==='dark';
  if(!darkZone&&roll<0.12+luck)run.drops.push({x:x,y:y,type:'health'});
  else if(roll<(darkZone?0.42:0.3)+luck)run.drops.push({x:x,y:y,type:'credit',v:25});
  else if(roll<(darkZone?0.50:0.36)+luck){var pw=[['rapid','RAPID','#ffd166'],['spread','SPREAD','#7ef27e'],['shield','SHIELD','#4cc9f0'],['nova','NOVA BOMB','#ff4d5e'],['laser','LASER','#4cc9f0'],['slow','TIME SLOW','#c060ff']][(Math.random()*6)|0];run.drops.push({x:x,y:y,type:'power',w:pw[0],label:pw[1],c:pw[2]});}
  qUpdate();
  if(!run.bossActive&&run.waveKills>=run.waveTarget)nextWave();
}
/* A987 explosive rounds: blasts are queued on kill and resolved after the entity
   loops so splicing enemies can never skip or double-process one. */
function resolveBlasts(){
  for(var b=0;b<run.blasts.length;b++){
    var bl=run.blasts[b];if(bl.resolved)continue;bl.resolved=true;burst(bl.x,bl.y,'#ffb03a',16);
    var hits=[];for(var i=0;i<run.enemies.length;i++){var en=run.enemies[i];if(Math.hypot(en.x-bl.x,en.y-bl.y)<bl.r)hits.push(en);}
    for(var h=0;h<hits.length;h++){var e2=hits[h];e2.hp-=bl.dmg;if(e2.hp<=0)killEnemy(e2,e2.x,e2.y,true);else burst(e2.x,e2.y,'#ffd166',4);}
  }
}
function nextWave(){
  run.waveKills=0;run.wave++;meta.quests.waves++;run.waveTarget=Math.min(40,8+run.stage*2+run.wave);
  /* roll a wave modifier on ~40% of waves (not wave 1) */
  run.waveMod=null;
  if(run.wave>1&&Math.random()<0.4){run.waveMod=WAVE_MODS[(Math.random()*WAVE_MODS.length)|0];float(W/2,H*0.45,run.waveMod.name,run.waveMod.col);float(W/2,H*0.5,run.waveMod.tag,run.waveMod.col);shake(6);}
  var bonus=15+run.wave*5;addCredits(bonus,W/2,H*0.6);float(W/2,H*0.6-22,'WAVE BONUS','#ffd166');
  var bossNext=run.wave%4===0&&!run.bossActive;
  if(bossNext)spawnBoss();else openShop();
  qUpdate();
}
function nextThreat(stage){
  if(stage===2)return 'NEW THREAT: DIVERS';
  if(stage===3)return 'NEW THREAT: PURPLE RAIDERS';
  if(stage===4)return 'NEW THREAT: GUNNERS';
  if(stage===5)return 'NEW THREAT: SPLITTERS';
  if(stage===6)return 'NEW THREAT: BOMBERS';
  return 'HOLD THE LINE';
}
function showIntro(main,sub){run.introMain=main;run.introSub=sub||'';run.introT=170;}
function killBoss(){
  var bx=boss.x,by=boss.y,bt=boss.type||0;
  burst(bx,by,bt===1?'#c060ff':bt===2?'#3fae3f':'#e04040',90);deathRing(bx,by,bt===1?'#c060ff':bt===2?'#3fae3f':'#ff4d5e',120);addCredits(150+run.stage*60,bx,by);
  run.score+=1200+run.stage*400;float(bx,by,'BOSS DOWN!','#ffd166');
  meta.quests.bosses++;boss=null;run.bossActive=false;
  run.stage++;run.wave=1;run.waveKills=0;run.waveTarget=Math.min(26,6+run.stage);
  showIntro('STAGE '+run.stage,nextThreat(run.stage));sfx('win');shake(16);qUpdate();
  openShop();
}
/* ============================ ROGUELIKE RUN ============================
   A1527: after every wave the run pauses and the station shop opens so run
   credits can be spent mid-run. The loop freezes (render only) until the
   player departs. Permanent ship upgrades live on the main menu instead. */
function nearestTarget(x,y){var best=null,bd=1e9,i;for(i=0;i<run.enemies.length;i++){var e=run.enemies[i],d=Math.hypot(e.x-x,e.y-y);if(d<bd){bd=d;best=e;}}if(boss){var db=Math.hypot(boss.x-x,boss.y-y);if(db<bd){bd=db;best=boss;}}return best;}
function applyRunUpgrade(id){
  run.runUps[id]=(run.runUps[id]||0)+1;
  run.level=(run.level||1)+1;
  if(id==='shield')run.shield=Math.min(shieldMax(),(run.shield||0)+1);
  if(id==='life')run.health=Math.min(9,run.health+1);
  if(id==='drone')run.drones.push({ang:(run.drones.length*2.1),r:30+run.drones.length*11,fire:24,x:run.px,y:run.py});
  checkEvolutions();
}
function resumeGame(){run.paused=false;lastT=0;updatePauseBtn();}
function pauseModalOpen(){var s=document.getElementById('shopOverlay');return !!(s&&!s.classList.contains('hidden'));}
function updatePauseBtn(){var b=document.getElementById('pauseBtn');if(b){b.textContent=(run&&run.paused)?'Resume':'Pause';b.style.display=(run&&!run.over)?'':'none';}var c=document.getElementById('cbBtn');if(c)c.style.display=(run&&!run.over)?'':'none';}
function togglePause(){if(!run||run.over||pauseModalOpen())return;if(run.paused)resumeGame();else{run.paused=true;lastT=0;updatePauseBtn();}sfx('tap');}
function openShop(){
  if(run.over||run.paused)return;
  rollShop();
  run.paused=true;lastT=0;updatePauseBtn();
  renderShop();
  document.getElementById('shopOverlay').classList.remove('hidden');
  sfx('win');
}
function rollShop(){
  var pool=SHOP_POOL.slice();shopStock=[];
  while(shopStock.length<4&&pool.length){var i=(Math.random()*pool.length)|0;shopStock.push({item:pool[i],sold:false});pool.splice(i,1);}
}
function renderShop(){
  var el=document.getElementById('shopList');if(!el)return;
  el.innerHTML='';document.getElementById('shopCredits').textContent=run.credits;
  shopStock.forEach(function(s,idx){
    var row=document.createElement('div');row.className='shop-row';
    row.innerHTML='<div><b>'+s.item.name+'</b><small>'+s.item.desc+'</small></div>';
    var btn=document.createElement('button');btn.className='buy';
    btn.textContent=s.sold?'SOLD':(s.item.cost+' cr');
    btn.disabled=s.sold||run.credits<s.item.cost;
    btn.onclick=function(){buyShop(idx);};
    row.appendChild(btn);el.appendChild(row);
  });
}
function buyShop(idx){
  var s=shopStock[idx];if(!s||s.sold||run.credits<s.item.cost)return;
  run.credits-=s.item.cost;
  if(s.item.id==='heal')run.health=Math.min(9,run.health+1);else applyRunUpgrade(s.item.id);
  s.sold=true;renderShop();renderCredits();sfx('win');
}
function rerollShop(){
  var cost=20;if(run.credits<cost)return;
  run.credits-=cost;rollShop();renderShop();renderCredits();sfx('tap');
}
function leaveShop(){
  document.getElementById('shopOverlay').classList.add('hidden');
  resumeGame();
}
function hurtPlayer(){
  run.combo=0;
  if(shieldOn()){run.shield=Math.max(0,run.shield-1);run.inv=70;burst(run.px,run.py,'#4cc9f0',22);float(run.px,run.py,'SHIELD','#4cc9f0');try{navigator.vibrate&&navigator.vibrate(20)}catch(e){}return}
  run.health--;run.inv=110;burst(run.px,run.py,'#ff4d5e',44);shake(18);sfx('bad');try{navigator.vibrate&&navigator.vibrate(35)}catch(e){};
  if(run.health<=0)endRun(false);
}
/* ----- render ----- */
function drawSpr(sp,cx,cy){var w=sp.width*SS,h=sp.height*SS;ctx.drawImage(sp,Math.round(cx-w/2),Math.round(cy-h/2),w,h)}
/* A1629 perf: background gradients are built once and reused (in local space,
   then translated into place) so low-end devices stop allocating several radial
   gradients every frame. They are rebuilt only when an object respawns. */
var gradBuilds=0,vigGrad=null,vigKey='';
function nebGrad(ne){if(!ne.g||ne.gr!==ne.r){var g=ctx.createRadialGradient(0,0,ne.r*0.05,0,0,ne.r);g.addColorStop(0,hexA(ne.c,1));g.addColorStop(0.45,hexA(ne.c,0.75));g.addColorStop(1,hexA(ne.c,0));ne.g=g;ne.gr=ne.r;gradBuilds++;}return ne.g;}
function planetGrad(pl){if(!pl.g||pl.gr!==pl.r){var g=ctx.createRadialGradient(-pl.r*0.32,-pl.r*0.32,pl.r*0.1,0,0,pl.r);g.addColorStop(0,pl.hi);g.addColorStop(0.55,pl.c);g.addColorStop(1,'#05070d');pl.g=g;pl.gr=pl.r;gradBuilds++;}return pl.g;}
function render(){
  ctx.setTransform(vsScale,0,0,vsScale,0,0);
  if(run.shakeMag)ctx.translate(rnd(-run.shakeMag,run.shakeMag),rnd(-run.shakeMag,run.shakeMag));
  ctx.fillStyle='#05070d';ctx.fillRect(-20,-20,W+40,H+40);
  for(var nb=0;nb<bg.neb.length;nb++){var ne=bg.neb[nb];var ng=nebGrad(ne);ctx.globalAlpha=ne.a;ctx.save();ctx.translate(ne.x,ne.y);ctx.fillStyle=ng;ctx.beginPath();ctx.arc(0,0,ne.r,0,Math.PI*2);ctx.fill();ctx.restore();}
  ctx.globalAlpha=1;
  for(var pp=0;pp<bg.planets.length;pp++){var pl=bg.planets[pp];
    if(pl.ring){ctx.globalAlpha=0.45;ctx.strokeStyle=pl.hi;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(pl.x,pl.y,pl.r*1.5,pl.r*0.5,0.5,0,Math.PI*2);ctx.stroke();}
    var pg=planetGrad(pl);ctx.globalAlpha=1;ctx.save();ctx.translate(pl.x,pl.y);ctx.fillStyle=pg;ctx.beginPath();ctx.arc(0,0,pl.r,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  /* shooting star comets */
  if(!reduceMotion){for(var ci2=0;ci2<bg.comets.length;ci2++){var cm2=bg.comets[ci2];var ca=cm2.life/cm2.maxLife;ctx.globalAlpha=ca*0.85;ctx.strokeStyle=cm2.c;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cm2.x,cm2.y);ctx.lineTo(cm2.x-cm2.vx*cm2.len*0.12,cm2.y-cm2.vy*cm2.len*0.12);ctx.stroke();}ctx.globalAlpha=1;}
  drawStars(bg.far);drawStars(bg.mid);drawStars(bg.near);
  ctx.globalAlpha=1;
  /* drops */
  for(var d=0;d<run.drops.length;d++){var dr=run.drops[d];if(dr.type==='health')drawSpr(SPR.plus,dr.x,dr.y);else if(dr.type==='power')drawSpr(SPR.star,dr.x,dr.y);else{ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(dr.x,dr.y,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7a5200';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('C',dr.x,dr.y+4)}}
  /* enemies */
  for(var e=0;e<run.enemies.length;e++){var en=run.enemies[e];drawSpr(en.spr,en.x,en.y);if(en.flash>0){var ew=en.spr.width*SS,eh=en.spr.height*SS;ctx.globalAlpha=Math.min(0.85,en.flash/6*0.85);ctx.fillStyle='#fff';ctx.fillRect(Math.round(en.x-ew/2),Math.round(en.y-eh/2),ew,eh);ctx.globalAlpha=1;}if(en.pattern==='hover'&&en.fire<18){ctx.globalAlpha=0.45+0.55*Math.abs(Math.sin(en.t*0.7));ctx.strokeStyle='#4fd6a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(en.x,en.y,en.r+10,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}}
  /* boss (with an attack telegraph ring in the last ~0.3s before it fires) */
  if(boss){var tel=boss.fire<18&&boss.y>=90*VS;if(tel){ctx.globalAlpha=0.45+0.55*Math.abs(Math.sin(boss.t*0.7));ctx.strokeStyle='#ff4d5e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(boss.x,boss.y,boss.r+16,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    var bsp=BOSS_SPR[boss.type||0];drawSpr(bsp,boss.x,boss.y);if(boss.flash>0){var bw=bsp.width*SS,bh=bsp.height*SS;ctx.globalAlpha=Math.min(0.8,boss.flash/6*0.8);ctx.fillStyle='#fff';ctx.fillRect(Math.round(boss.x-bw/2),Math.round(boss.y-bh/2),bw,bh);ctx.globalAlpha=1;}ctx.fillStyle='#2a0505';ctx.fillRect(boss.x-84,boss.y-78,168,11);ctx.fillStyle=(boss.type===1?'#c060ff':boss.type===2?'#3fae3f':'#ff4d5e');ctx.fillRect(boss.x-84,boss.y-78,168*Math.max(0,boss.hp/boss.maxhp),11)}
  /* player bullets: paired cyan orbs with glow trail */
  for(var b=0;b<run.bullets.length;b++){var sb=run.bullets[b];
    if(!sb.eb){ctx.globalAlpha=0.18;ctx.fillStyle='#8fe6ff';ctx.beginPath();ctx.arc(sb.x,sb.y,10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    if(sb.eb){
      if(sb.mine){ctx.fillStyle='#8a5a1e';ctx.beginPath();ctx.arc(sb.x,sb.y,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#3a2408';ctx.lineWidth=2;for(var mk=0;mk<6;mk++){var mka=mk*Math.PI/3;ctx.beginPath();ctx.moveTo(sb.x+Math.cos(mka)*5,sb.y+Math.sin(mka)*5);ctx.lineTo(sb.x+Math.cos(mka)*9,sb.y+Math.sin(mka)*9);ctx.stroke();}ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(sb.x,sb.y,2.4,0,Math.PI*2);ctx.fill();continue;}
      if(meta.cb){ctx.save();ctx.translate(sb.x,sb.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#ff4d5e';ctx.fillRect(-6,-6,12,12);ctx.fillStyle='#05070d';ctx.fillRect(-2.5,-2.5,5,5);ctx.restore();continue;}
      ctx.fillStyle='#ff4d5e';ctx.beginPath();ctx.arc(sb.x,sb.y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2a0505';ctx.beginPath();ctx.arc(sb.x,sb.y,3.5,0,Math.PI*2);ctx.fill();continue;
    }
    if(meta.cb){ctx.fillStyle='#8fe6ff';ctx.strokeStyle='#0a2a33';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(sb.x-3,sb.y,4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(sb.x+3,sb.y,4,0,Math.PI*2);ctx.fill();ctx.stroke();continue;}
    ctx.fillStyle='#8fe6ff';ctx.beginPath();ctx.arc(sb.x-3,sb.y,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sb.x+3,sb.y,4,0,Math.PI*2);ctx.fill();}
  /* laser beam */
  if(powerKind==='laser'){var la=Math.min(1,powerTimer/280);ctx.globalAlpha=la*0.9;ctx.strokeStyle='#4cc9f0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(run.px,run.py-24);ctx.lineTo(run.px,0);ctx.stroke();ctx.globalAlpha=la*0.35;ctx.strokeStyle='#ffffff';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(run.px,run.py-24);ctx.lineTo(run.px,0);ctx.stroke();ctx.globalAlpha=1;}
  /* slow tint overlay */
  if(powerKind==='slow'){ctx.globalAlpha=0.12;ctx.fillStyle='#c060ff';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  /* player + flame */
  if(!(run.inv>0&&Math.floor(run.inv/5)%2===0)){var fl=run.flame<3?run.py+14:run.py+19;ctx.fillStyle=run.flame<3?'#ff8c1a':'#ffd166';ctx.fillRect(run.px-6,fl,12,7);drawSpr(SHIPS[meta.hull]||SHIPS[0],run.px,run.py);}
  if(shieldOn()||run.shield>0){ctx.strokeStyle='#4cc9f0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(run.px,run.py,30,0,Math.PI*2);ctx.stroke()}
  /* A987 wingman drones + explosive blast rings */
  for(var dnr=0;dnr<run.drones.length;dnr++){var drn=run.drones[dnr];ctx.strokeStyle='#7fe3f2';ctx.lineWidth=1;ctx.beginPath();ctx.arc(drn.x,drn.y,16,0,Math.PI*2);ctx.stroke();drawSpr(SPR.orb,drn.x,drn.y);}
  for(var blr=0;blr<run.blasts.length;blr++){var blp=run.blasts[blr];ctx.globalAlpha=Math.max(0,blp.life/16)*0.7;ctx.strokeStyle='#ffb03a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(blp.x,blp.y,blp.r*(1-blp.life/16),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  /* death rings */
  if(run.rings){for(var rrd=0;rrd<run.rings.length;rrd++){var rg2=run.rings[rrd];ctx.globalAlpha=Math.max(0,rg2.life/rg2.maxLife)*0.75;ctx.strokeStyle=rg2.col;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(rg2.x,rg2.y,rg2.r,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;}
  if(run.hint>0){ctx.globalAlpha=Math.min(1,run.hint/70);ptext(ctx,'DRAG ANYWHERE TO FLY',W/2,H*0.8,2,'#bfe9ff','#04070c','center');ctx.globalAlpha=1}
  if(run.paused&&!pauseModalOpen()){ctx.fillStyle='rgba(3,6,12,.72)';ctx.fillRect(0,0,W,H);ptext(ctx,'PAUSED',W/2,H*0.4,3,'#7CFC00','#04070c','center');ptext(ctx,'DRAG OR ARROW KEYS TO FLY',W/2,H*0.47,1,'#bfe9ff','#04070c','center');ptext(ctx,'GUNS FIRE ON THEIR OWN',W/2,H*0.495,1,'#bfe9ff','#04070c','center');ptext(ctx,'GREEN = HEALTH   BLUE = POWER',W/2,H*0.52,1,'#8fe36a','#04070c','center');ptext(ctx,'PRESS P OR TAP PAUSE TO RESUME',W/2,H*0.575,1,'#7CFC00','#04070c','center');}
  /* particles */
  for(var p=0;p<run.parts.length;p++){var pa=run.parts[p];ctx.globalAlpha=Math.max(0,pa.life/42);ctx.fillStyle=pa.c;ctx.fillRect(pa.x|0,pa.y|0,3,3)}ctx.globalAlpha=1;
  /* floats */
  for(var f=0;f<run.floats.length;f++){var fa=run.floats[f];ctx.globalAlpha=Math.max(0,fa.life/38);ptext(ctx,fa.t,fa.x,fa.y,1,fa.c,'#05070d','center')}ctx.globalAlpha=1;
  /* A1617 low-health warning vignette (gradient cached per field size). */
  if(run.health<=1&&!run.over){var vk=W+'x'+H;if(vigKey!==vk){vigGrad=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.24,W/2,H/2,Math.max(W,H)*0.62);vigGrad.addColorStop(0,'rgba(255,0,40,0)');vigGrad.addColorStop(1,'rgba(255,0,40,1)');vigKey=vk;}ctx.globalAlpha=0.22+0.2*Math.abs(Math.sin(nowMs*0.004));ctx.fillStyle=vigGrad;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  /* A1617 wave-1 onboarding: a short Pip banner plus a legend, non-blocking. */
  if(run.tut>0)drawTutorial();
  /* A1629 story beats surface in-canvas while immersive (the DOM strip is hidden). */
  if(document.documentElement.classList.contains('jvds-immersive')&&run.beatT>0){ctx.globalAlpha=Math.min(1,run.beatT/50);ptext(ctx,run.beat,W/2,H*0.2,1,'#bfe9ff','#04070c','center');ctx.globalAlpha=1;}
  if(run.introT>0)drawIntro();
  /* retro scanlines */
  if(!reduceMotion){ctx.globalAlpha=0.05;ctx.fillStyle='#000';for(var sl=0;sl<H;sl+=3){ctx.fillRect(0,sl,W,1);}ctx.globalAlpha=1;}
  /* In-canvas HUD bar: SCORE top-left, HEALTH top-right, WAVE/STAGE below-left.
     In immersive mode this is the only HUD, inset below the shell Exit control
     so it never sits under the button. */
  var pad=7,s=2,sp=6*s,hudY=document.documentElement.classList.contains('jvds-immersive')?Math.round(48/Math.max(0.35,cssScale)):pad;
  ptext(ctx,'SCORE',pad,hudY,s,'#7CFC00','#04070c');
  ptext(ctx,String(run.score),pad+ptextW('SCORE',s)+sp,hudY,s,'#ffffff','#04070c');
  var lw2=ptextW('HEALTH',s),nw2=ptextW(String(run.health),s),x1=W-pad-(lw2+sp+nw2);
  ptext(ctx,'HEALTH',x1,hudY,s,'#7CFC00','#04070c');
  ptext(ctx,String(run.health),x1+lw2+sp,hudY,s,'#ff4d5e','#04070c');
  ptext(ctx,'WAVE '+run.wave+'  STAGE '+run.stage+'  LVL '+(run.level||1),pad,hudY+16,s,'#8fe36a','#04070c');
  var bl=buildLabel();if(bl)ptext(ctx,bl,pad,hudY+30,1,'#4cc9f0','#04070c');
  if(run.waveMod)ptext(ctx,run.waveMod.tag,W-pad,hudY+16,1,run.waveMod.col,'#04070c','right');
  if((run.combo||0)>=2){var cm=Math.round(comboMult()*10)/10;ptext(ctx,'COMBO x'+cm,W/2,hudY,2,cm>=2?'#ffd166':'#7CFC00','#04070c','center')}
  ctx.setTransform(vsScale,0,0,vsScale,0,0);
}
/* A1617 wave-1 onboarding: a Pip banner with a three-row legend that fades out. */
function drawTutorial(){
  var a=Math.min(1,run.tut/60);ctx.globalAlpha=a;
  var cx=W/2,pw=Math.min(W-48,380),ph=138,px=cx-pw/2,py=H*0.27;
  ctx.fillStyle='rgba(6,12,22,.84)';ctx.strokeStyle='#1e5a72';ctx.lineWidth=1;ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.fill();ctx.stroke();
  ptext(ctx,'PIP SAYS: DRAG ANYWHERE TO FLY',cx,py+13,1,'#7CFC00','#04070c','center');
  var rows=[['ufo','SHOOT THE SWARM'],['plus','GRAB GREEN = HEALTH'],['star','GRAB BLUE = POWER']];
  for(var i=0;i<rows.length;i++){var yy=py+52+i*30;var sp=SPR[rows[i][0]],sw=sp.width*2,sh=sp.height*2;ctx.drawImage(sp,px+24,yy-sh/2,sw,sh);ptext(ctx,rows[i][1],px+54,yy-7,2,'#bfe9ff','#04070c');}
  ctx.globalAlpha=1;
}
/* A1629 stage intro: a short card naming the next threat, non-blocking. */
function drawIntro(){
  var a=Math.min(1,run.introT/50);ctx.globalAlpha=a;
  var cx=W/2,by=H*0.42,pw=Math.min(W-60,380),px=cx-pw/2;
  ctx.fillStyle='rgba(6,12,22,.84)';ctx.strokeStyle='#1e5a72';ctx.lineWidth=1;ctx.beginPath();ctx.rect(px,by-26,pw,76);ctx.fill();ctx.stroke();
  ptext(ctx,run.introMain,cx,by-10,3,'#7CFC00','#04070c','center');
  if(run.introSub)ptext(ctx,run.introSub,cx,by+30,1,'#bfe9ff','#04070c','center');
  ctx.globalAlpha=1;
}
function ptextW(str,s){return Math.max(0,String(str).length*6*s-s);}
function pnumW(v,s){return String(v).length*6*s}
function hud(){var set=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v};set('hScore',run.score.toLocaleString());set('hStage',run.stage);set('hWave',run.wave);set('hLives',run.health);set('hCredits',run.credits);set('hBest',(window.GameSystem?window.GameSystem.getBestScore('nova-siege'):0).toLocaleString());storyScore();
  /* A1629 screen readers: a throttled polite announcement of the live run state. */
  a11yT-=1;if(a11yT<=0){a11yT=60;var ae=document.getElementById('a11yStatus');if(ae)ae.textContent='Score '+run.score+'. Health '+run.health+'. Wave '+run.wave+'. Stage '+run.stage+'.';}}
/* ============================ UI ============================ */
document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.tabpane').forEach(function(x){x.classList.remove('active')});t.classList.add('active');document.getElementById('pane-'+t.dataset.tab).classList.add('active');if(t.dataset.tab==='up')renderUpgrades();if(t.dataset.tab==='quest')renderQuests();if(t.dataset.tab==='skin')renderSkins();sfx('tap');}});
function renderCredits(){document.getElementById('credBank').textContent=meta.credits.toLocaleString();if(document.getElementById('hCredits'))document.getElementById('hCredits').textContent=(run?run.credits:0);}
function renderUpgrades(){var el=document.getElementById('upList');el.innerHTML='';UPGRADES.forEach(function(u){var lvl=meta.up[u.id]||0,maxed=lvl>=u.max,cost=maxed?0:u.cost(lvl);var row=document.createElement('div');row.className='up-row';var pips='';for(var i=0;i<u.max;i++)pips+='<span class="pip '+(i<lvl?'on':'')+'"></span>';row.innerHTML='<div><b>'+u.name+'</b><small>'+u.info+'</small><div class="pips">'+pips+'</div></div>';var btn=document.createElement('button');btn.className='buy';btn.textContent=maxed?'MAX':(cost+' cr');btn.disabled=maxed||meta.credits<cost;btn.onclick=function(){if(meta.credits>=cost&&!maxed){meta.credits-=cost;meta.up[u.id]=lvl+1;saveMeta();renderUpgrades();renderCredits();sfx('win');document.getElementById('quote').textContent=u.name+' upgraded to level '+(lvl+1)+'.';}};row.appendChild(btn);el.appendChild(row);});}
function renderQuests(){var el=document.getElementById('questList');el.innerHTML='';QUESTS.forEach(function(q){var cur=Math.min(q.goal,meta.quests[q.key]||0),done=!!meta.completed[q.id]||cur>=q.goal,pct=Math.round(cur/q.goal*100);var row=document.createElement('div');row.className='quest-row '+(done?'done':'');row.innerHTML='<b>'+(done?'[X] ':'[ ] ')+q.name+'</b><small>'+q.text+'</small>'+(done?'<small>Reward banked: '+q.reward+' cr</small>':'<div class="meter"><span style="width:'+pct+'%"></span></div><small>'+cur+' / '+q.goal+'</small>');el.appendChild(row);});}
function qUpdate(){var changed=false;QUESTS.forEach(function(q){if(meta.completed[q.id])return;if((meta.quests[q.key]||0)>=q.goal){meta.completed[q.id]=true;meta.credits+=q.reward;changed=true;try{var pp=window.playerProfile;if(pp&&pp.addXP)pp.addXP(Math.round(q.reward/2),'game:nova-siege-quest');}catch(e){}if(run&&!run.over)float(W/2,140,'QUEST: '+q.name+' +'+q.reward+'cr','#7CFC00');}});if(changed){saveMeta();renderQuests();renderCredits();}}
function renderSkins(){var el=document.getElementById('skinList');el.innerHTML='';HULLS.forEach(function(h,idx){var owned=h.cost===0||meta.hulls.indexOf(idx)>=0;var d=document.createElement('div');d.className='skin '+(meta.hull===idx?'sel':'')+(owned?'':' locked');var sc=document.createElement('canvas');sc.width=SHIP_ROWS[0].length;sc.height=SHIP_ROWS.length;sc.getContext('2d').drawImage(SHIPS[idx],0,0);d.appendChild(sc);if(!owned){var c=document.createElement('span');c.className='cost';c.textContent=h.cost;d.appendChild(c);}d.title=h.name+' - '+h.perk+(owned?'':' - '+h.cost+' cr');d.onclick=function(){if(owned){meta.hull=idx;saveMeta();renderSkins();document.getElementById('skinInfo').textContent=h.name+' hull equipped. '+h.perk+'.';sfx('win');}else if(meta.credits>=h.cost){meta.credits-=h.cost;meta.hulls.push(idx);meta.hull=idx;saveMeta();renderSkins();renderCredits();document.getElementById('skinInfo').textContent=h.name+' hull unlocked and equipped! '+h.perk+'.';sfx('win');}else{document.getElementById('skinInfo').textContent='You need '+(h.cost-meta.credits)+' more credits for the '+h.name+' hull ('+h.perk+').';}};el.appendChild(d);});}
/* A1527: the main menu (title screen and death screen) is where permanent ship
   upgrades live now; the play field owns the whole screen during a run. */
function showMenuMain(){var m=document.getElementById('menuMain'),p=document.getElementById('menuPanel');if(m)m.classList.remove('hidden');if(p)p.classList.add('hidden');}
function openMenu(){var m=document.getElementById('menuMain'),p=document.getElementById('menuPanel');if(m)m.classList.add('hidden');if(p)p.classList.remove('hidden');renderUpgrades();renderQuests();renderSkins();renderCredits();sfx('tap');}
function closeMenu(){showMenuMain();sfx('tap');}
/* A1629 colourblind bullet-shape toggle (auto-on when the OS asks for contrast). */
function renderCB(){var b=document.getElementById('cbBtn');if(!b)return;b.textContent='Bullet shapes: '+(meta.cb?'On':'Off');b.setAttribute('aria-pressed',meta.cb?'true':'false');}
function toggleCB(){meta.cb=!meta.cb;saveMeta();renderCB();sfx('tap');}
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
window.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')keys.left=1;if(e.key==='ArrowRight')keys.right=1;if(e.key==='ArrowUp')keys.up=1;if(e.key==='ArrowDown')keys.down=1;if(e.key==='p'||e.key==='P')togglePause();});
window.addEventListener('keyup',function(e){if(e.key==='ArrowLeft')keys.left=0;if(e.key==='ArrowRight')keys.right=0;if(e.key==='ArrowUp')keys.up=0;if(e.key==='ArrowDown')keys.down=0});
document.getElementById('startBtn').onclick=function(){storyBegin();startRun()};
document.getElementById('menuUpBtn').onclick=openMenu;
document.getElementById('menuBack').onclick=closeMenu;
document.getElementById('shopLeave').onclick=leaveShop;
document.getElementById('shopReroll').onclick=rerollShop;
document.getElementById('pauseBtn').onclick=togglePause;
document.getElementById('runCardBtn').onclick=downloadRunCard;
document.getElementById('cbBtn').onclick=toggleCB;
/* ============================ BOOT ============================ */
function drawTitle(){var tcanvas=document.getElementById('titleFont'),tc=tcanvas.getContext('2d');tc.clearRect(0,0,tcanvas.width,tcanvas.height);var ol='#04120a';ptext(tc,'NOVA',tcanvas.width/2,10,6,'#7CFC00',ol,'center');ptext(tc,'SIEGE',tcanvas.width/2,58,6,'#7CFC00',ol,'center');ptext(tc,"PIP'S ARCADE REMASTER",tcanvas.width/2,118,2,'#8fe36a',ol,'center');}
drawTitle();
renderUpgrades();renderQuests();renderSkins();renderCredits();renderTitleStats();renderCB();
run={score:0,stage:1,wave:1,health:baseHealth(),credits:0,px:W/2,py:H-80,over:true,hint:0,combo:0,comboT:0,bestCombo:0,bullets:[],enemies:[],drops:[],parts:[],floats:[],flame:0,shakeT:0,shakeMag:0,inv:0,bossActive:false,shield:0,runPower:0,kills:0,waveKills:0,waveTarget:6,fireT:0,runUps:{},evos:[],tut:0,beat:'',beatT:0,introMain:'',introSub:'',introT:0,paused:false,drones:[],level:1,blasts:[],rings:[],waveMod:null,laserT:0};
window.__nova={get run(){return run},get meta(){return meta},get boss(){return boss},get sprites(){return SPR},get ships(){return SHIPS},get bg(){return bg},get bossType(){return boss?boss.type:null},get enemyKinds(){return run.enemies.map(function(e){return e.kind})},get stage(){return run.stage},get scale(){return vsScale},get lw(){return LW},get lh(){return H},get sprZoom(){return SS},get cssScale(){return cssScale},get hulls(){return HULLS},get combo(){return run.combo||0},get comboMult(){return comboMult()},get bossFire(){return boss?boss.fire:null},get runUps(){return run.runUps},get tutorialActive(){return !!(run&&run.tut>0)},get evolutions(){return (run&&run.evos)?run.evos.slice():[]},get reduceMotion(){return reduceMotion},get buildLabel(){return buildLabel()},makeRunCard:function(){return makeRunCard().toDataURL('image/png')},get lastRunSaved(){try{return !!localStorage.getItem(LASTKEY)}catch(e){return false}},get paused(){return !!run.paused},get menuOpen(){var e=document.getElementById('menuPanel');return !!e&&!e.classList.contains('hidden')},get shopOpen(){var e=document.getElementById('shopOverlay');return !!e&&!e.classList.contains('hidden')},get runCritChance(){return runCrit()},get runPierce(){return runPierce()},get runDamage(){return runDamage()},get runShots(){return runShots()},get runRate(){return runRate()},get runSpeed(){return runSpeed()},get runDrones(){return run.drones.length},get runLevel(){return run.level||1},get blasts(){return run.blasts.length},get gradBuilds(){return gradBuilds},get bossPhase(){return boss?(boss.phase2?2:1):0},get cb(){return !!meta.cb},get beat(){return run?run.beat:''},get beatActive(){return !!(run&&run.beatT>0)},get introActive(){return !!(run&&run.introT>0)},forceBoss:function(){spawnBoss();return boss?boss.type:null},openMenu:function(){openMenu()},closeMenu:function(){return closeMenu()},forceShop:function(){openShop()},forceWave:function(){nextWave()},refreshShop:function(){renderShop()},applyRunUpgrade:function(id){applyRunUpgrade(id);},pickKind:function(){return pickKind();},forceEnd:function(){run.health=0;hurtPlayer()}};
hud();
})();
