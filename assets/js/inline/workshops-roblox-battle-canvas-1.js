'use strict';

/* ===================================================
   Lua-to-JS transpiler (light transform so Roblox Lua
   syntax runs in the canvas iframe simulation)
   =================================================== */
function luaToJs(code) {
  return code
    .replace(/\blocal\s+/g, 'let ')
    .replace(/\bfunction\s*\(([^)]*)\)\s*/g, 'function($1){')
    .replace(/\bend\b(?!\w)/g, '}')
    .replace(/\bthen\b/g, '{')
    .replace(/\belseif\b/g, '} else if')
    .replace(/\belse\b(?!\s*if)/g, '} else {')
    .replace(/\bnot\s+/g, '!')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\.\.\s*/g, '+ ')
    .replace(/~=/g, '!==')
    .replace(/\btrue\b/g, 'true')
    .replace(/\bfalse\b/g, 'false')
    .replace(/\bnil\b/g, 'null')
    .replace(/\bwhile\s+true\s*\{/g, 'while(true){')
    .replace(/\bwhile\s+(.*?)\s*\{/g, 'while($1){')
    .replace(/\bif\s+(.*?)\s*\{/g, 'if($1){')
    .replace(/\bfor\s+(\w+)\s*=\s*(\S+)\s*,\s*(\S+)/g, 'for(let $1=$2;$1<=$3;$1++)')
    .replace(/\.f\b/g, '');
}

/* ===================================================
   IFRAME BUILDING BLOCKS (Roblox Battle Arena simulation)
   =================================================== */

var CSS_BATTLE = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%;cursor:crosshair}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}label{cursor:pointer}</style>';

var CANVAS_BATTLE = '<div class="row"><span>HP: <b id="hp">100</b></span><span>Enemies: <b id="enemyCount">0</b></span><span>Kills: <b id="kills">0</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to move &middot; Click to attack</div>';

var SETUP_BATTLE = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400,SPEED=3,ARENA_PAD=30;',
  'let player={x:W/2-10,y:H/2-10,w:20,h:24,vx:0,vy:0,hp:100,maxHp:100,alive:true,facing:1,attacking:false,attackTimer:0};',
  'let enemies=[],kills=0,gameWon=false,gameLost=false;',
  'let leftHeld=false,rightHeld=false,upHeld=false,downHeld=false;'
].join('');

var ARENA_WALLS = [
  'let walls=[',
  '{x:ARENA_PAD,y:ARENA_PAD,w:W-ARENA_PAD*2,h:4,color:"#4a5568"},',
  '{x:ARENA_PAD,y:H-ARENA_PAD,w:W-ARENA_PAD*2,h:4,color:"#4a5568"},',
  '{x:ARENA_PAD,y:ARENA_PAD,w:4,h:H-ARENA_PAD*2,color:"#4a5568"},',
  '{x:W-ARENA_PAD-4,y:ARENA_PAD,w:4,h:H-ARENA_PAD*2,color:"#4a5568"}',
  '];',
  'let pillars=[',
  '{x:150,y:120,w:16,h:16},{x:430,y:120,w:16,h:16},',
  '{x:150,y:270,w:16,h:16},{x:430,y:270,w:16,h:16},',
  '{x:290,y:195,w:20,h:20}',
  '];'
].join('');

var KEYS_BATTLE = [
  'document.addEventListener("keydown",function(e){',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;',
  'if(e.code==="ArrowUp"||e.code==="KeyW"){upHeld=true;e.preventDefault()}',
  'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=true;',
  '});',
  'document.addEventListener("keyup",function(e){',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false;',
  'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=false;',
  'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=false;',
  '});'
].join('');

var MOVE_PLAYER_BATTLE = [
  'function movePlayer(){',
  'if(!player.alive)return;',
  'player.vx=0;player.vy=0;',
  'if(leftHeld){player.vx=-SPEED;player.facing=-1}',
  'if(rightHeld){player.vx=SPEED;player.facing=1}',
  'if(upHeld)player.vy=-SPEED;',
  'if(downHeld)player.vy=SPEED;',
  'player.x+=player.vx;player.y+=player.vy;',
  'if(player.x<ARENA_PAD+4)player.x=ARENA_PAD+4;',
  'if(player.x+player.w>W-ARENA_PAD-4)player.x=W-ARENA_PAD-4-player.w;',
  'if(player.y<ARENA_PAD+4)player.y=ARENA_PAD+4;',
  'if(player.y+player.h>H-ARENA_PAD)player.y=H-ARENA_PAD-player.h;',
  'for(let i=0;i<pillars.length;i++){let p=pillars[i];',
  'if(player.x+player.w>p.x&&player.x<p.x+p.w&&player.y+player.h>p.y&&player.y<p.y+p.h){',
  'if(player.vx>0)player.x=p.x-player.w;if(player.vx<0)player.x=p.x+p.w;',
  'if(player.vy>0)player.y=p.y-player.h;if(player.vy<0)player.y=p.y+p.h;',
  '}}',
  '}'
].join('');

var SPAWN_ENEMIES = [
  'function spawnEnemies(){',
  'let spawns=[{x:60,y:60},{x:500,y:60},{x:60,y:320},{x:500,y:320},{x:280,y:60}];',
  'for(let i=0;i<spawns.length;i++){',
  'enemies.push({x:spawns[i].x,y:spawns[i].y,w:18,h:22,hp:40,maxHp:40,alive:true,vx:0,vy:0,speed:1.2,color:"#f56565",knockX:0,knockY:0});',
  '}}',
  'spawnEnemies();'
].join('');

var ENEMY_AI = [
  'function moveEnemies(){',
  'for(let i=0;i<enemies.length;i++){let e=enemies[i];',
  'if(!e.alive)continue;',
  'e.knockX*=0.85;e.knockY*=0.85;',
  'let dx=player.x-e.x,dy=player.y-e.y;',
  'let dist=Math.sqrt(dx*dx+dy*dy);',
  'if(dist>0){e.vx=(dx/dist)*e.speed;e.vy=(dy/dist)*e.speed}',
  'e.x+=e.vx+e.knockX;e.y+=e.vy+e.knockY;',
  'if(e.x<ARENA_PAD+4)e.x=ARENA_PAD+4;',
  'if(e.x+e.w>W-ARENA_PAD-4)e.x=W-ARENA_PAD-4-e.w;',
  'if(e.y<ARENA_PAD+4)e.y=ARENA_PAD+4;',
  'if(e.y+e.h>H-ARENA_PAD)e.y=H-ARENA_PAD-e.h;',
  '}}'
].join('');

var ATTACK_CLICK = [
  'canvas.addEventListener("click",function(e){',
  'if(!player.alive||player.attacking)return;',
  'player.attacking=true;player.attackTimer=12;',
  '});'
].join('');

var ATTACK_SYSTEM = [
  'function processAttack(){',
  'if(!player.attacking)return;',
  'player.attackTimer--;',
  'if(player.attackTimer<=0){player.attacking=false;return}',
  'if(player.attackTimer===10){',
  'let sx=player.facing===1?player.x+player.w:player.x-30;',
  'let sy=player.y-4;let sw=30;let sh=player.h+8;',
  'for(let i=0;i<enemies.length;i++){let e=enemies[i];',
  'if(!e.alive)continue;',
  'if(sx+sw>e.x&&sx<e.x+e.w&&sy+sh>e.y&&sy<e.y+e.h){',
  'e.hp-=20;',
  'let kx=player.facing*6,ky=-2;',
  'e.knockX=kx;e.knockY=ky;',
  'if(e.hp<=0){e.alive=false;kills++;document.getElementById("kills").textContent=kills}',
  '}}}}'
].join('');

var ENEMY_DAMAGE = [
  'function enemyAttack(){',
  'if(!player.alive)return;',
  'for(let i=0;i<enemies.length;i++){let e=enemies[i];',
  'if(!e.alive)continue;',
  'let dx=player.x-e.x,dy=player.y-e.y;',
  'let dist=Math.sqrt(dx*dx+dy*dy);',
  'if(dist<24){',
  'player.hp-=0.3;',
  'document.getElementById("hp").textContent=Math.ceil(player.hp);',
  'if(player.hp<=0){player.hp=0;player.alive=false}',
  '}}}'
].join('');

var WIN_LOSE_CHECK = [
  'function checkWinLose(){',
  'if(gameLost||gameWon)return;',
  'if(!player.alive){gameLost=true;return}',
  'let allDead=true;',
  'for(let i=0;i<enemies.length;i++){if(enemies[i].alive){allDead=false;break}}',
  'if(allDead&&enemies.length>0)gameWon=true;',
  '}'
].join('');

var DRAW_BG_BATTLE = [
  'CWArt.bg(ctx,W,H,"#1a1020","#0d0814");CWArt.grid(ctx,W,H,40);'
].join('');

var DRAW_ARENA = [
  'for(let i=0;i<walls.length;i++){let w=walls[i];',
  'ctx.save();ctx.shadowColor="#718096";ctx.shadowBlur=6;',
  'ctx.fillStyle=w.color;ctx.fillRect(w.x,w.y,w.w,w.h);ctx.restore()}',
  'for(let i=0;i<pillars.length;i++){let p=pillars[i];',
  'ctx.save();ctx.shadowColor="rgba(160,140,100,.6)";ctx.shadowBlur=8;',
  'ctx.fillStyle="#8b7355";CWArt.roundRect(ctx,p.x,p.y,p.w,p.h,3);ctx.fill();ctx.restore()}'
].join('');

var DRAW_PLAYER_BATTLE = [
  'if(player.alive){',
  'ctx.save();ctx.shadowColor="rgba(99,179,237,.9)";ctx.shadowBlur=12;',
  'ctx.fillStyle="#63b3ed";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.restore();',
  'let ex=player.facing===1?player.x+5:player.x+11;',
  'ctx.fillStyle="#fff";ctx.fillRect(ex,player.y+6,4,4);ctx.fillRect(ex+6*player.facing,player.y+6,4,4);',
  'if(player.attacking){',
  'let sx=player.facing===1?player.x+player.w:player.x-30;',
  'ctx.save();ctx.shadowColor="rgba(255,200,50,.9)";ctx.shadowBlur=14;',
  'ctx.fillStyle="#ecc94b";ctx.fillRect(sx,player.y-2,30,4);ctx.restore()}',
  '}'
].join('');

var DRAW_ENEMIES = [
  'for(let i=0;i<enemies.length;i++){let e=enemies[i];',
  'if(!e.alive)continue;',
  'ctx.save();ctx.shadowColor="rgba(245,101,101,.7)";ctx.shadowBlur=10;',
  'ctx.fillStyle=e.color;ctx.fillRect(e.x,e.y,e.w,e.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(e.x+4,e.y+5,3,3);ctx.fillRect(e.x+11,e.y+5,3,3);',
  '}'
].join('');

var DRAW_HEALTH_BARS = [
  'if(player.alive){',
  'let pw=player.w+4,ph=3;let px=player.x-2,py=player.y-8;',
  'ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(px,py,pw,ph);',
  'let pct=player.hp/player.maxHp;',
  'ctx.fillStyle=pct>0.5?"#48bb78":pct>0.25?"#ecc94b":"#f56565";',
  'ctx.fillRect(px,py,pw*pct,ph)}',
  'for(let i=0;i<enemies.length;i++){let e=enemies[i];',
  'if(!e.alive)continue;',
  'let ew=e.w+4,eh=3;let ex=e.x-2,ey=e.y-7;',
  'ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(ex,ey,ew,eh);',
  'let epct=e.hp/e.maxHp;',
  'ctx.fillStyle="#f56565";ctx.fillRect(ex,ey,ew*epct,eh)}'
].join('');

var DRAW_HUD_BATTLE = [
  'document.getElementById("hp").textContent=Math.ceil(player.hp);',
  'let aliveCount=0;for(let i=0;i<enemies.length;i++){if(enemies[i].alive)aliveCount++}',
  'document.getElementById("enemyCount").textContent=aliveCount;',
  'document.getElementById("kills").textContent=kills;'
].join('');

var DRAW_WIN = [
  'if(gameWon){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#48bb78";ctx.font="bold 28px system-ui";ctx.textAlign="center";',
  'ctx.fillText("YOU WIN!",W/2,H/2-20);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("All enemies defeated! Kills: "+kills,W/2,H/2+15)}',
  'if(gameLost){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#f56565";ctx.font="bold 28px system-ui";ctx.textAlign="center";',
  'ctx.fillText("DEFEATED!",W/2,H/2-20);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("Kills: "+kills+" | Click to retry",W/2,H/2+15)}'
].join('');

var RETRY_CLICK = [
  'canvas.addEventListener("click",function(e){',
  'if(gameLost){',
  'player.x=W/2-10;player.y=H/2-10;player.hp=100;player.alive=true;player.attacking=false;player.attackTimer=0;',
  'kills=0;gameLost=false;gameWon=false;enemies=[];spawnEnemies();',
  '}});'
].join('');

var TOUCH_BATTLE = [
  'let touchStart=null,touchMoveDir=null;',
  'canvas.addEventListener("touchstart",function(e){',
  'let r=canvas.getBoundingClientRect();let tx=e.touches[0].clientX-r.left;let ty=e.touches[0].clientY-r.top;',
  'touchStart={x:tx,y:ty};e.preventDefault();',
  'if(!player.alive||player.attacking)return;player.attacking=true;player.attackTimer=12;',
  '});',
  'canvas.addEventListener("touchmove",function(e){',
  'if(!touchStart)return;e.preventDefault();',
  'let dx=e.touches[0].clientX-touchStart.x,dy=e.touches[0].clientY-touchStart.y;',
  'leftHeld=false;rightHeld=false;upHeld=false;downHeld=false;',
  'if(Math.abs(dx)>15){if(dx>0)rightHeld=true;else leftHeld=true}',
  'if(Math.abs(dy)>15){if(dy>0)downHeld=true;else upHeld=true}',
  '});',
  'canvas.addEventListener("touchend",function(e){',
  'leftHeld=false;rightHeld=false;upHeld=false;downHeld=false;touchStart=null;',
  '});'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

/* ===================================================
   CW_CONFIG - Roblox Battle Arena canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-battle-canvas',
  downloadName: 'my-battle-game.html',

  hints: [
    'Arrow keys to move around the arena',
    'Click anywhere to swing your sword!',
    'Enemies chase you - keep moving to avoid damage',
    'Watch your health bar, dodge and strike!',
    'Hit enemies to knock them back',
    'Defeat all 5 enemies to win!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_BATTLE, CANVAS_BATTLE,
        SETUP_BATTLE + ARENA_WALLS + KEYS_BATTLE +
        'function draw(){' + DRAW_BG_BATTLE + DRAW_ARENA + DRAW_PLAYER_BATTLE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){if(typeof movePlayer==="function")movePlayer();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_BATTLE, CANVAS_BATTLE,
        SETUP_BATTLE + ARENA_WALLS + KEYS_BATTLE +
        MOVE_PLAYER_BATTLE +
        'function draw(){' + DRAW_BG_BATTLE + DRAW_ARENA + DRAW_ENEMIES + DRAW_PLAYER_BATTLE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();if(typeof moveEnemies==="function")moveEnemies();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_BATTLE, CANVAS_BATTLE,
        SETUP_BATTLE + ARENA_WALLS + KEYS_BATTLE +
        MOVE_PLAYER_BATTLE + SPAWN_ENEMIES + ENEMY_AI +
        'function draw(){' + DRAW_BG_BATTLE + DRAW_ARENA + DRAW_ENEMIES + DRAW_PLAYER_BATTLE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();moveEnemies();if(typeof processAttack==="function")processAttack();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_BATTLE, CANVAS_BATTLE,
        SETUP_BATTLE + ARENA_WALLS + KEYS_BATTLE +
        MOVE_PLAYER_BATTLE + SPAWN_ENEMIES + ENEMY_AI + ATTACK_CLICK + ATTACK_SYSTEM +
        'function draw(){' + DRAW_BG_BATTLE + DRAW_ARENA + DRAW_ENEMIES + DRAW_PLAYER_BATTLE + DRAW_HUD_BATTLE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();moveEnemies();processAttack();if(typeof enemyAttack==="function")enemyAttack();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_BATTLE, CANVAS_BATTLE,
        SETUP_BATTLE + ARENA_WALLS + KEYS_BATTLE +
        MOVE_PLAYER_BATTLE + SPAWN_ENEMIES + ENEMY_AI + ATTACK_CLICK + ATTACK_SYSTEM + ENEMY_DAMAGE +
        'function draw(){' + DRAW_BG_BATTLE + DRAW_ARENA + DRAW_ENEMIES + DRAW_HEALTH_BARS + DRAW_PLAYER_BATTLE + DRAW_HUD_BATTLE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();moveEnemies();processAttack();enemyAttack();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_BATTLE, CANVAS_BATTLE,
        SETUP_BATTLE + ARENA_WALLS + KEYS_BATTLE +
        MOVE_PLAYER_BATTLE + SPAWN_ENEMIES + ENEMY_AI + ATTACK_CLICK + ATTACK_SYSTEM + ENEMY_DAMAGE +
        WIN_LOSE_CHECK +
        'function draw(){' + DRAW_BG_BATTLE + DRAW_ARENA + DRAW_ENEMIES + DRAW_HEALTH_BARS + DRAW_PLAYER_BATTLE + DRAW_HUD_BATTLE + DRAW_WIN + '}' +
        TOUCH_BATTLE + RETRY_CLICK + u +
        'function loop(){movePlayer();moveEnemies();processAttack();enemyAttack();if(typeof checkWinLose==="function")checkWinLose();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Build the Arena & Player',
      goal: 'Set up the player and top-down movement inside a walled arena.',
      points: [
        'A player character that moves in all 4 directions',
        'Arrow keys move up/down/left/right',
        'Walls and pillars keep the player inside the arena'
      ],
      challenge: 'Write the movement function for top-down arena controls:',
      starter: '// Move the player each frame\nfunction movePlayer() {\n  if (!player.alive) return;\n  player.vx = 0; player.vy = 0;\n  // Apply keyboard input\n  if (leftHeld) { player.vx = ???; player.facing = -1; }\n  if (rightHeld) { player.vx = ???; player.facing = 1; }\n  if (upHeld) player.vy = ???;\n  if (downHeld) player.vy = ???;\n  // Move\n  player.x += player.vx;\n  player.y += player.vy;\n}',
      solution: 'function movePlayer() {\n  if (!player.alive) return;\n  player.vx = 0; player.vy = 0;\n  if (leftHeld) { player.vx = -SPEED; player.facing = -1; }\n  if (rightHeld) { player.vx = SPEED; player.facing = 1; }\n  if (upHeld) player.vy = -SPEED;\n  if (downHeld) player.vy = SPEED;\n  player.x += player.vx;\n  player.y += player.vy;\n}',
      checks: ['speed', '-speed', 'player.vx', 'player.vy'],
      height: 260,
      fills: {
        text: 'The ___ constant controls how fast the player moves. Negative vy moves the player ___.',
        answers: ['SPEED', 'up']
      },
      quiz: {
        question: 'In a top-down arena game, moving up means:',
        options: [
          'Increasing the Y position (y gets bigger)',
          'Decreasing the Y position (y gets smaller, toward the top)',
          'Setting the X position to 0'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Spawn Enemies',
      goal: 'Add enemy NPCs that chase the player around the arena.',
      points: [
        'Five enemies spawn at different positions around the arena',
        'Each enemy has HP, speed and colour properties',
        'Enemies move toward the player using distance calculations'
      ],
      challenge: 'Write the enemy spawner and AI movement:',
      starter: '// Spawn 5 enemies at preset positions\nfunction spawnEnemies() {\n  let spawns = [{x:60,y:60},{x:500,y:60},{x:60,y:320},{x:500,y:320},{x:280,y:60}];\n  for (let i = 0; i < spawns.length; i++) {\n    enemies.push({x:spawns[i].x, y:spawns[i].y, w:18, h:22, hp:40, maxHp:40, alive:true, vx:0, vy:0, speed:1.2, color:"#f56565", knockX:0, knockY:0});\n  }\n}\nspawnEnemies();\n\n// Move enemies toward the player\nfunction moveEnemies() {\n  for (let i = 0; i < enemies.length; i++) {\n    let e = enemies[i];\n    if (!e.alive) continue;\n    let dx = player.x - e.x;\n    let dy = player.y - e.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist > 0) {\n      e.vx = (dx / dist) * ???;\n      e.vy = (dy / dist) * ???;\n    }\n    e.x += e.vx; e.y += e.vy;\n  }\n}',
      solution: 'function spawnEnemies() {\n  let spawns = [{x:60,y:60},{x:500,y:60},{x:60,y:320},{x:500,y:320},{x:280,y:60}];\n  for (let i = 0; i < spawns.length; i++) {\n    enemies.push({x:spawns[i].x, y:spawns[i].y, w:18, h:22, hp:40, maxHp:40, alive:true, vx:0, vy:0, speed:1.2, color:"#f56565", knockX:0, knockY:0});\n  }\n}\nspawnEnemies();\n\nfunction moveEnemies() {\n  for (let i = 0; i < enemies.length; i++) {\n    let e = enemies[i];\n    if (!e.alive) continue;\n    let dx = player.x - e.x;\n    let dy = player.y - e.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist > 0) {\n      e.vx = (dx / dist) * e.speed;\n      e.vy = (dy / dist) * e.speed;\n    }\n    e.x += e.vx; e.y += e.vy;\n  }\n}',
      checks: ['e.speed', 'math.sqrt', 'dx', 'dy'],
      height: 380,
      fills: {
        text: 'Dividing by ___ normalises the direction vector to length 1. Multiplying by ___ sets the final speed.',
        answers: ['dist', 'e.speed']
      },
      quiz: {
        question: 'Why do we divide dx and dy by dist before multiplying by speed?',
        options: [
          'To make the enemy stop when it reaches the player',
          'To normalise the direction so the enemy moves at a constant speed regardless of distance',
          'To make the enemy move faster when far away'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Click to Attack!',
      goal: 'Add a sword swing attack triggered by clicking.',
      points: [
        'Clicking triggers a sword swing in the direction the player faces',
        'The attack lasts a few frames then resets',
        'The sword hitbox checks overlap with enemy positions'
      ],
      challenge: 'Write the attack processing function:',
      starter: '// Process the sword swing each frame\ncanvas.addEventListener("click", function(e) {\n  if (!player.alive || player.attacking) return;\n  player.attacking = true;\n  player.attackTimer = 12;\n});\n\nfunction processAttack() {\n  if (!player.attacking) return;\n  player.attackTimer--;\n  if (player.attackTimer <= 0) { player.attacking = false; return; }\n  if (player.attackTimer === 10) {\n    // Sword hitbox\n    let sx = player.facing === 1 ? player.x + player.w : player.x - 30;\n    let sy = player.y - 4;\n    let sw = 30; let sh = player.h + 8;\n    for (let i = 0; i < enemies.length; i++) {\n      let e = enemies[i];\n      if (!e.alive) continue;\n      // Check overlap\n      if (sx + sw > e.x && sx < e.x + e.w && sy + sh > ??? && sy < ???) {\n        e.hp -= 20;\n        if (e.hp <= 0) { e.alive = false; kills++; }\n      }\n    }\n  }\n}',
      solution: 'canvas.addEventListener("click", function(e) {\n  if (!player.alive || player.attacking) return;\n  player.attacking = true;\n  player.attackTimer = 12;\n});\n\nfunction processAttack() {\n  if (!player.attacking) return;\n  player.attackTimer--;\n  if (player.attackTimer <= 0) { player.attacking = false; return; }\n  if (player.attackTimer === 10) {\n    let sx = player.facing === 1 ? player.x + player.w : player.x - 30;\n    let sy = player.y - 4;\n    let sw = 30; let sh = player.h + 8;\n    for (let i = 0; i < enemies.length; i++) {\n      let e = enemies[i];\n      if (!e.alive) continue;\n      if (sx + sw > e.x && sx < e.x + e.w && sy + sh > e.y && sy < e.y + e.h) {\n        e.hp -= 20;\n        if (e.hp <= 0) { e.alive = false; kills++; }\n      }\n    }\n  }\n}',
      checks: ['e.y', 'e.h', 'e.hp', 'processattack'],
      height: 400,
      fills: {
        text: 'The sword swing checks for ___ between the sword hitbox and enemy rectangles. Each hit deals ___ damage.',
        answers: ['overlap', '20']
      },
      quiz: {
        question: 'In Roblox, the Classic Sword detects hits using:',
        options: [
          'A Touched event that fires when the sword part collides with another character',
          'A while loop that checks distance every second',
          'The player manually typing the target name'
        ],
        correct: 0
      }
    },
    {
      num: 4,
      title: 'Health & Damage',
      goal: 'Add health bars and let enemies deal contact damage.',
      points: [
        'Player and enemies display health bars above them',
        'Enemies deal damage when they touch the player',
        'Health bar colour changes: green, yellow, red based on HP'
      ],
      challenge: 'Write the enemy contact damage function:',
      starter: '// Enemies deal damage when touching the player\nfunction enemyAttack() {\n  if (!player.alive) return;\n  for (let i = 0; i < enemies.length; i++) {\n    let e = enemies[i];\n    if (!e.alive) continue;\n    let dx = player.x - e.x;\n    let dy = player.y - e.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist < ???) {\n      player.hp -= ???;\n      if (player.hp <= 0) {\n        player.hp = 0;\n        player.alive = false;\n      }\n    }\n  }\n}',
      solution: 'function enemyAttack() {\n  if (!player.alive) return;\n  for (let i = 0; i < enemies.length; i++) {\n    let e = enemies[i];\n    if (!e.alive) continue;\n    let dx = player.x - e.x;\n    let dy = player.y - e.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist < 24) {\n      player.hp -= 0.3;\n      if (player.hp <= 0) {\n        player.hp = 0;\n        player.alive = false;\n      }\n    }\n  }\n}',
      checks: ['24', '0.3', 'player.hp', 'player.alive'],
      height: 320,
      fills: {
        text: 'Enemies deal ___ damage per frame on contact. The health bar turns ___ when HP drops below 25%.',
        answers: ['0.3', 'red']
      },
      quiz: {
        question: 'In Roblox, the Humanoid.HealthChanged event fires when:',
        options: [
          'The player presses a button',
          'The Humanoid\'s Health property changes (takes damage or heals)',
          'A new player joins the server'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Knockback & Effects',
      goal: 'Add knockback so enemies fly back when hit by the sword.',
      points: [
        'Hitting an enemy pushes them away from the player',
        'Knockback decays smoothly over time using friction',
        'The sword swing shows a golden slash effect'
      ],
      challenge: 'Write the knockback logic (already wired into the attack):',
      starter: '// In the attack hit section, add knockback:\n// When the sword hits enemy e:\nlet kx = player.facing * ???;  // push in facing direction\nlet ky = ???;                    // slight upward push\ne.knockX = kx;\ne.knockY = ky;\n\n// In moveEnemies, apply and decay knockback:\n// e.knockX *= 0.85;  (friction slows it down)\n// e.knockY *= 0.85;\n// e.x += e.vx + e.knockX;\n// e.y += e.vy + e.knockY;',
      solution: '// Knockback applied in attack hit:\nlet kx = player.facing * 6;\nlet ky = -2;\ne.knockX = kx;\ne.knockY = ky;\n\n// In moveEnemies, knockback decays:\n// e.knockX *= 0.85;\n// e.knockY *= 0.85;\n// e.x += e.vx + e.knockX;\n// e.y += e.vy + e.knockY;',
      checks: ['knockx', 'knocky', '0.85', 'facing'],
      height: 240,
      quiz: {
        question: 'Why does knockback multiply by 0.85 each frame instead of subtracting a fixed amount?',
        options: [
          'Fixed subtraction can overshoot to negative, while multiplication decays smoothly toward zero',
          'Multiplication is faster for the computer',
          '0.85 is a Roblox constant that cannot be changed'
        ],
        correct: 0
      }
    },
    {
      num: 6,
      title: 'Victory & Defeat',
      goal: 'Add win/lose conditions and a retry mechanic.',
      points: [
        'When all enemies are defeated, show a victory screen',
        'When the player dies, show a defeat screen with retry',
        'In Roblox, the same logic uses <code>Humanoid.Died</code> and leaderboard tracking'
      ],
      challenge: 'Write the win/lose check:',
      starter: '// Check if the game is over\nfunction checkWinLose() {\n  if (gameLost || gameWon) return;\n  if (!player.alive) { gameLost = true; return; }\n  let allDead = ???;\n  for (let i = 0; i < enemies.length; i++) {\n    if (enemies[i].alive) { allDead = ???; break; }\n  }\n  if (allDead && enemies.length > 0) gameWon = true;\n}',
      solution: 'function checkWinLose() {\n  if (gameLost || gameWon) return;\n  if (!player.alive) { gameLost = true; return; }\n  let allDead = true;\n  for (let i = 0; i < enemies.length; i++) {\n    if (enemies[i].alive) { allDead = false; break; }\n  }\n  if (allDead && enemies.length > 0) gameWon = true;\n}',
      checks: ['alldead', 'true', 'false', 'gamewon'],
      height: 200,
      fills: {
        text: 'We start by assuming all enemies are ___. If we find one alive, we set it to ___.',
        answers: ['dead', 'false']
      },
      quiz: {
        question: 'In the Roblox workshop, kills are tracked using a "creator" tag. What adds that tag?',
        options: [
          'A script we write from scratch',
          'The Classic Sword automatically tags the Humanoid it hits',
          'Roblox tracks kills without any tag'
        ],
        correct: 1
      }
    }
  ]
};
