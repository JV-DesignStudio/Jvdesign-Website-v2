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
   IFRAME BUILDING BLOCKS (Roblox Horror simulation)
   =================================================== */

var CSS_HORROR = '<style>body{display:flex;flex-direction:column;align-items:center;background:#000;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#000;border:2px solid #1a0a2e;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}label{cursor:pointer}</style>';

var CANVAS_HORROR = '<div class="row"><span>Keys: <b id="keys">0/3</b></span><span>Timer: <b id="timer">3:00</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to move &middot; Collect keys, avoid ghost, find door</div>';

var SETUP_HORROR = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400,SPEED=3;',
  'let player={x:50,y:50,w:14,h:14,vx:0,vy:0,alive:true};',
  'let keysCollected=0,totalKeys=3,won=false,gameOver=false;',
  'let timeLeft=180,lastTick=Date.now();',
  'let leftHeld=false,rightHeld=false,upHeld=false,downHeld=false;',
  'let mouseX=W/2,mouseY=H/2;'
].join('');

var MAZE_WALLS = [
  'let walls=[',
  '{x:0,y:0,w:W,h:4},',         // top
  '{x:0,y:H-4,w:W,h:4},',       // bottom
  '{x:0,y:0,w:4,h:H},',         // left
  '{x:W-4,y:0,w:4,h:H},',       // right
  '{x:80,y:0,w:4,h:120},',
  '{x:160,y:60,w:4,h:180},',
  '{x:0,y:180,w:120,h:4},',
  '{x:240,y:0,w:4,h:140},',
  '{x:160,y:240,w:160,h:4},',
  '{x:320,y:60,w:4,h:120},',
  '{x:320,y:180,w:140,h:4},',
  '{x:400,y:0,w:4,h:130},',
  '{x:480,y:100,w:4,h:200},',
  '{x:400,y:280,w:120,h:4},',
  '{x:240,y:140,w:80,h:4},',
  '{x:80,y:280,w:4,h:120},',
  '{x:80,y:320,w:80,h:4},',
  '{x:240,y:320,w:4,h:80},',
  '{x:320,y:340,w:100,h:4},',
  '{x:540,y:200,w:4,h:100},',
  '];'
].join('');

var KEYS_ITEMS = [
  'let items=[',
  '{x:130,y:100,w:10,h:10,type:"key",collected:false},',
  '{x:360,y:100,w:10,h:10,type:"key",collected:false},',
  '{x:200,y:350,w:10,h:10,type:"key",collected:false}',
  '];'
].join('');

var DOOR_OBJ = 'let door={x:550,y:350,w:20,h:30,locked:true};';

var GHOST_OBJ = [
  'let ghost={x:300,y:200,w:16,h:16,speed:1.5,active:true};',
  'let ghostFlicker=0;'
].join('');

var KEYS_INPUT = [
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
  '});',
  'canvas.addEventListener("mousemove",function(e){',
  'let r=canvas.getBoundingClientRect();',
  'mouseX=e.clientX-r.left;mouseY=e.clientY-r.top;',
  '});'
].join('');

var DRAW_DARKNESS = [
  'function drawDarkness(){',
  'ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);',
  '}'
].join('');

var DRAW_FLASHLIGHT = [
  'function drawFlashlight(){',
  'let cx=player.x+player.w/2,cy=player.y+player.h/2;',
  'let dx=mouseX-cx,dy=mouseY-cy;',
  'let angle=Math.atan2(dy,dx);',
  'let spread=0.4,radius=160;',
  'ctx.save();',
  'ctx.beginPath();',
  'ctx.moveTo(cx,cy);',
  'ctx.arc(cx,cy,radius,angle-spread,angle+spread);',
  'ctx.closePath();',
  'ctx.clip();',
  'ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,W,H);',
  'CWArt.grid(ctx,W,H,40);',
  'drawWalls();drawItems();drawDoor();',
  'if(typeof drawGhost==="function")drawGhost();',
  'drawPlayer();',
  'ctx.restore();',
  'let glow=ctx.createRadialGradient(cx,cy,0,cx,cy,40);',
  'glow.addColorStop(0,"rgba(255,220,160,.12)");glow.addColorStop(1,"rgba(0,0,0,0)");',
  'ctx.fillStyle=glow;ctx.fillRect(cx-40,cy-40,80,80);',
  '}'
].join('');

var DRAW_WALLS = [
  'function drawWalls(){',
  'ctx.fillStyle="#3a3a5c";',
  'for(let i=0;i<walls.length;i++){let w=walls[i];',
  'ctx.fillRect(w.x,w.y,w.w,w.h);',
  '}}'
].join('');

var DRAW_ITEMS = [
  'function drawItems(){',
  'for(let i=0;i<items.length;i++){let it=items[i];',
  'if(it.collected)continue;',
  'ctx.save();ctx.shadowColor="rgba(255,220,50,.9)";ctx.shadowBlur=12+Math.sin(Date.now()/200)*4;',
  'ctx.fillStyle="#ffd700";ctx.fillRect(it.x,it.y,it.w,it.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.font="bold 8px system-ui";ctx.textAlign="center";',
  'ctx.fillText("KEY",it.x+it.w/2,it.y-3);',
  '}}'
].join('');

var DRAW_DOOR = [
  'function drawDoor(){',
  'ctx.save();',
  'if(door.locked){ctx.shadowColor="rgba(255,60,60,.8)";ctx.fillStyle="#e53e3e";}',
  'else{ctx.shadowColor="rgba(72,187,120,.8)";ctx.fillStyle="#48bb78";}',
  'ctx.shadowBlur=16;',
  'CWArt.roundRect(ctx,door.x,door.y,door.w,door.h,4);ctx.fill();ctx.restore();',
  'ctx.fillStyle="#fff";ctx.font="bold 8px system-ui";ctx.textAlign="center";',
  'ctx.fillText(door.locked?"LOCKED":"EXIT",door.x+door.w/2,door.y-4);',
  '}'
].join('');

var DRAW_PLAYER = [
  'function drawPlayer(){',
  'if(!player.alive)return;',
  'ctx.save();ctx.shadowColor="rgba(255,220,160,.7)";ctx.shadowBlur=10;',
  'ctx.fillStyle="#63b3ed";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(player.x+3,player.y+3,3,3);ctx.fillRect(player.x+9,player.y+3,3,3);',
  '}'
].join('');

var DRAW_GHOST = [
  'function drawGhost(){',
  'if(!ghost.active)return;',
  'ghostFlicker=Math.sin(Date.now()/100)*0.3+0.5;',
  'ctx.save();ctx.globalAlpha=ghostFlicker;',
  'ctx.shadowColor="rgba(200,180,255,.9)";ctx.shadowBlur=20;',
  'ctx.fillStyle="#c8b4ff";',
  'ctx.beginPath();ctx.arc(ghost.x+ghost.w/2,ghost.y+ghost.h/2,ghost.w/2+2,0,Math.PI*2);ctx.fill();',
  'ctx.fillStyle="rgba(0,0,0,.6)";',
  'ctx.fillRect(ghost.x+4,ghost.y+4,3,4);ctx.fillRect(ghost.x+10,ghost.y+4,3,4);',
  'ctx.restore();',
  '}'
].join('');

var MOVE_PLAYER_HORROR = [
  'function movePlayer(){',
  'if(!player.alive||won||gameOver)return;',
  'let nx=player.x,ny=player.y;',
  'if(leftHeld)nx-=SPEED;',
  'if(rightHeld)nx+=SPEED;',
  'if(upHeld)ny-=SPEED;',
  'if(downHeld)ny+=SPEED;',
  'let blocked=false;',
  'for(let i=0;i<walls.length;i++){let w=walls[i];',
  'if(nx<w.x+w.w&&nx+player.w>w.x&&ny<w.y+w.h&&ny+player.h>w.y){blocked=true;break}}',
  'if(!blocked){player.x=nx;player.y=ny;}',
  '}'
].join('');

var COLLECT_KEYS = [
  'function collectKeys(){',
  'for(let i=0;i<items.length;i++){let it=items[i];',
  'if(it.collected)continue;',
  'if(player.x<it.x+it.w&&player.x+player.w>it.x&&',
  'player.y<it.y+it.h&&player.y+player.h>it.y){',
  'it.collected=true;keysCollected++;',
  'if(keysCollected>=totalKeys)door.locked=false;',
  '}}}'
].join('');

var CHECK_DOOR = [
  'function checkDoor(){',
  'if(door.locked)return;',
  'if(player.x<door.x+door.w&&player.x+player.w>door.x&&',
  'player.y<door.y+door.h&&player.y+player.h>door.y){',
  'won=true;',
  '}}'
].join('');

var MOVE_GHOST = [
  'function moveGhost(){',
  'if(!ghost.active||!player.alive||won||gameOver)return;',
  'let dx=player.x-ghost.x,dy=player.y-ghost.y;',
  'let dist=Math.sqrt(dx*dx+dy*dy);',
  'if(dist>1){ghost.x+=dx/dist*ghost.speed;ghost.y+=dy/dist*ghost.speed;}',
  'if(dist<12){player.alive=false;',
  'setTimeout(function(){player.x=50;player.y=50;player.alive=true;ghost.x=300;ghost.y=200;},1200);',
  '}}'
].join('');

var UPDATE_TIMER = [
  'function updateTimer(){',
  'let now=Date.now();',
  'if(now-lastTick>=1000&&!won&&!gameOver&&player.alive){',
  'timeLeft--;lastTick=now;',
  'if(timeLeft<=0){gameOver=true;timeLeft=0;}',
  '}}'
].join('');

var DRAW_HUD_HORROR = [
  'function drawHud(){',
  'document.getElementById("keys").textContent=keysCollected+"/"+totalKeys;',
  'let mins=Math.floor(timeLeft/60),secs=timeLeft%60;',
  'let tEl=document.getElementById("timer");',
  'tEl.textContent=mins+":"+(secs<10?"0":"")+secs;',
  'if(timeLeft<=30)tEl.style.color="#f56565";',
  'if(won){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#48bb78";ctx.font="bold 28px system-ui";ctx.textAlign="center";',
  'ctx.fillText("YOU ESCAPED!",W/2,H/2-20);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("Keys: "+keysCollected+"/"+totalKeys,W/2,H/2+15);}',
  'if(gameOver&&!won){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#f56565";ctx.font="bold 28px system-ui";ctx.textAlign="center";',
  'ctx.fillText("TIME\'S UP!",W/2,H/2-20);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("The ghost got you...",W/2,H/2+15);}',
  '}'
].join('');

var TOUCH_HORROR = [
  'let touchStart=null;',
  'canvas.addEventListener("touchstart",function(e){touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault()});',
  'canvas.addEventListener("touchend",function(e){if(!touchStart)return;',
  'let dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;',
  'if(Math.abs(dx)>Math.abs(dy)){',
  'if(dx>0){rightHeld=true;setTimeout(function(){rightHeld=false},200)}',
  'else{leftHeld=true;setTimeout(function(){leftHeld=false},200)}}',
  'else{if(dy<0){upHeld=true;setTimeout(function(){upHeld=false},200)}',
  'else{downHeld=true;setTimeout(function(){downHeld=false},200)}}',
  'touchStart=null});'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

/* ===================================================
   CW_CONFIG - Roblox Horror canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-horror-canvas',
  downloadName: 'my-horror-game.html',

  hints: [
    'Arrow keys to move through the dark maze',
    'The flashlight cone follows your mouse - look around!',
    'Collect the glowing yellow keys hidden in dead ends',
    'The door turns green when you have all 3 keys',
    'Avoid the ghostly purple glow - it kills on touch!',
    'Escape before the timer hits zero!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_HORROR, CANVAS_HORROR,
        SETUP_HORROR + MAZE_WALLS + KEYS_INPUT +
        DRAW_DARKNESS + DRAW_WALLS + DRAW_PLAYER +
        'function draw(){drawDarkness();' +
        'ctx.save();ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,W,H);CWArt.grid(ctx,W,H,40);drawWalls();drawPlayer();ctx.restore();}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_HORROR, CANVAS_HORROR,
        SETUP_HORROR + MAZE_WALLS + KEYS_INPUT +
        DRAW_DARKNESS + DRAW_FLASHLIGHT + DRAW_WALLS +
        DRAW_ITEMS + DRAW_DOOR + DRAW_PLAYER +
        KEYS_ITEMS + DOOR_OBJ +
        'function draw(){drawDarkness();drawFlashlight();}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){if(typeof movePlayer==="function")movePlayer();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_HORROR, CANVAS_HORROR,
        SETUP_HORROR + MAZE_WALLS + KEYS_ITEMS + DOOR_OBJ + KEYS_INPUT +
        DRAW_DARKNESS + DRAW_FLASHLIGHT + DRAW_WALLS +
        DRAW_ITEMS + DRAW_DOOR + DRAW_PLAYER +
        MOVE_PLAYER_HORROR +
        'function draw(){drawDarkness();drawFlashlight();}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();if(typeof collectKeys==="function")collectKeys();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_HORROR, CANVAS_HORROR,
        SETUP_HORROR + MAZE_WALLS + KEYS_ITEMS + DOOR_OBJ + KEYS_INPUT +
        DRAW_DARKNESS + DRAW_FLASHLIGHT + DRAW_WALLS +
        DRAW_ITEMS + DRAW_DOOR + DRAW_PLAYER +
        MOVE_PLAYER_HORROR + COLLECT_KEYS +
        'function draw(){drawDarkness();drawFlashlight();drawHud();}' +
        DRAW_HUD_HORROR +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();collectKeys();if(typeof checkDoor==="function")checkDoor();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_HORROR, CANVAS_HORROR,
        SETUP_HORROR + MAZE_WALLS + KEYS_ITEMS + DOOR_OBJ + GHOST_OBJ + KEYS_INPUT +
        DRAW_DARKNESS + DRAW_FLASHLIGHT + DRAW_WALLS +
        DRAW_ITEMS + DRAW_DOOR + DRAW_PLAYER + DRAW_GHOST +
        MOVE_PLAYER_HORROR + COLLECT_KEYS + CHECK_DOOR +
        DRAW_HUD_HORROR +
        'function draw(){drawDarkness();drawFlashlight();drawHud();}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();collectKeys();checkDoor();if(typeof moveGhost==="function")moveGhost();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_HORROR, CANVAS_HORROR,
        SETUP_HORROR + MAZE_WALLS + KEYS_ITEMS + DOOR_OBJ + GHOST_OBJ + KEYS_INPUT +
        DRAW_DARKNESS + DRAW_FLASHLIGHT + DRAW_WALLS +
        DRAW_ITEMS + DRAW_DOOR + DRAW_PLAYER + DRAW_GHOST +
        MOVE_PLAYER_HORROR + COLLECT_KEYS + CHECK_DOOR + MOVE_GHOST +
        DRAW_HUD_HORROR + TOUCH_HORROR +
        'function draw(){drawDarkness();drawFlashlight();drawHud();}' +
        u +
        'function loop(){movePlayer();collectKeys();checkDoor();moveGhost();if(typeof updateTimer==="function")updateTimer();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Dark Room & Flashlight',
      goal: 'Render a pitch-black canvas with a flashlight cone that follows the mouse.',
      points: [
        'The canvas starts completely dark, just like Roblox Lighting.Brightness = 0',
        'A cone of light follows the mouse direction from the player',
        'Only objects inside the flashlight cone are visible'
      ],
      challenge: 'Write the flashlight rendering function that clips a cone toward the mouse:',
      starter: '// Draw a flashlight cone from the player toward the mouse\nfunction drawFlashlight() {\n  let cx = player.x + player.w / 2;\n  let cy = player.y + player.h / 2;\n  let angle = Math.atan2(mouseY - cy, mouseX - cx);\n  let spread = 0.4, radius = 160;\n  ctx.save();\n  ctx.beginPath();\n  ctx.moveTo(cx, cy);\n  ctx.arc(cx, cy, ???, angle - spread, angle + spread);\n  ctx.closePath();\n  ctx.clip();\n  // Draw visible scene inside the cone\n  ctx.fillStyle = "#1a1a2e";\n  ctx.fillRect(0, 0, W, H);\n  drawWalls(); drawPlayer();\n  ctx.restore();\n}',
      solution: 'function drawFlashlight() {\n  let cx = player.x + player.w / 2;\n  let cy = player.y + player.h / 2;\n  let angle = Math.atan2(mouseY - cy, mouseX - cx);\n  let spread = 0.4, radius = 160;\n  ctx.save();\n  ctx.beginPath();\n  ctx.moveTo(cx, cy);\n  ctx.arc(cx, cy, radius, angle - spread, angle + spread);\n  ctx.closePath();\n  ctx.clip();\n  ctx.fillStyle = "#1a1a2e";\n  ctx.fillRect(0, 0, W, H);\n  CWArt.grid(ctx, W, H, 40);\n  drawWalls(); drawPlayer();\n  ctx.restore();\n}',
      checks: ['radius', 'clip', 'atan2'],
      height: 320,
      fills: {
        text: 'The flashlight uses ctx.___ to restrict drawing to a cone shape. The angle is calculated with ___.',
        answers: ['clip', 'Math.atan2']
      },
      quiz: {
        question: 'In the canvas, the flashlight effect works by:',
        options: [
          'Painting white circles on a black background',
          'Clipping the drawing context to a cone shape so only that area is visible',
          'Changing the brightness property of the canvas element'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Player Movement in the Dark',
      goal: 'Move the player with arrow keys, blocked by maze walls.',
      points: [
        'Arrow keys move the player up, down, left and right',
        'Wall collision prevents the player walking through walls',
        'The player carries the flashlight with them as they move'
      ],
      challenge: 'Write the movement function with wall collision:',
      starter: '// Move the player, checking for wall collisions\nfunction movePlayer() {\n  if (!player.alive || won || gameOver) return;\n  let nx = player.x, ny = player.y;\n  if (leftHeld) nx -= SPEED;\n  if (rightHeld) nx += SPEED;\n  if (upHeld) ny -= ???;\n  if (downHeld) ny += ???;\n  let blocked = false;\n  for (let i = 0; i < walls.length; i++) {\n    let w = walls[i];\n    if (nx < w.x + w.w && nx + player.w > w.x &&\n        ny < w.y + w.h && ny + player.h > w.y) {\n      blocked = true; break;\n    }\n  }\n  if (!blocked) { player.x = nx; player.y = ny; }\n}',
      solution: 'function movePlayer() {\n  if (!player.alive || won || gameOver) return;\n  let nx = player.x, ny = player.y;\n  if (leftHeld) nx -= SPEED;\n  if (rightHeld) nx += SPEED;\n  if (upHeld) ny -= SPEED;\n  if (downHeld) ny += SPEED;\n  let blocked = false;\n  for (let i = 0; i < walls.length; i++) {\n    let w = walls[i];\n    if (nx < w.x + w.w && nx + player.w > w.x &&\n        ny < w.y + w.h && ny + player.h > w.y) {\n      blocked = true; break;\n    }\n  }\n  if (!blocked) { player.x = nx; player.y = ny; }\n}',
      checks: ['speed', 'blocked', 'walls'],
      height: 320,
      fills: {
        text: 'Wall collision uses ___ overlap detection. If any wall overlaps the new position, movement is ___.',
        answers: ['AABB', 'blocked']
      },
      quiz: {
        question: 'In Roblox, wall collision is handled automatically because:',
        options: [
          'All parts have CanCollide = true by default, so the physics engine prevents overlap',
          'You have to write a collision script for every wall',
          'Walls are just visual decorations with no physics'
        ],
        correct: 0
      }
    },
    {
      num: 3,
      title: 'Key Collection',
      goal: 'Place glowing keys in the maze and collect them on touch.',
      points: [
        'Three golden keys are hidden in maze dead ends',
        'Walking into a key collects it and increments the counter',
        'The key vanishes when collected, matching Roblox Transparency = 1'
      ],
      challenge: 'Write the key collection function:',
      starter: '// Check if the player touches any uncollected key\nfunction collectKeys() {\n  for (let i = 0; i < items.length; i++) {\n    let it = items[i];\n    if (it.collected) continue;\n    if (player.x < it.x + it.w && player.x + player.w > it.x &&\n        player.y < it.y + it.h && player.y + player.h > it.y) {\n      it.collected = ???;\n      keysCollected++;\n      if (keysCollected >= totalKeys) door.locked = ???;\n    }\n  }\n}',
      solution: 'function collectKeys() {\n  for (let i = 0; i < items.length; i++) {\n    let it = items[i];\n    if (it.collected) continue;\n    if (player.x < it.x + it.w && player.x + player.w > it.x &&\n        player.y < it.y + it.h && player.y + player.h > it.y) {\n      it.collected = true;\n      keysCollected++;\n      if (keysCollected >= totalKeys) door.locked = false;\n    }\n  }\n}',
      checks: ['collected', 'true', 'locked'],
      height: 240,
      fills: {
        text: 'When all keys are collected, the door\'s ___ property becomes false. In Roblox the same uses a ___ folder.',
        answers: ['locked', 'leaderstats']
      },
      quiz: {
        question: 'In the Roblox workshop, the key script uses a "collected" boolean to:',
        options: [
          'Make the key spin faster',
          'Stop the same key being collected more than once by the Touched event',
          'Change the key colour to green'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Locked Door',
      goal: 'A door that only opens when all 3 keys are collected.',
      points: [
        'The door glows red when locked and green when unlocked',
        'Walking into an unlocked door triggers the win condition',
        'Matches the Roblox EscapeDoor script that checks keys >= 3'
      ],
      challenge: 'Write the door check function:',
      starter: '// Check if the player reaches the unlocked door\nfunction checkDoor() {\n  if (door.???) return;\n  if (player.x < door.x + door.w && player.x + player.w > door.x &&\n      player.y < door.y + door.h && player.y + player.h > door.y) {\n    won = ???;\n  }\n}',
      solution: 'function checkDoor() {\n  if (door.locked) return;\n  if (player.x < door.x + door.w && player.x + player.w > door.x &&\n      player.y < door.y + door.h && player.y + player.h > door.y) {\n    won = true;\n  }\n}',
      checks: ['locked', 'won', 'true'],
      height: 180,
      fills: {
        text: 'The door stays solid while ___ is true. In Roblox the door sets CanCollide to ___ when it opens.',
        answers: ['locked', 'false']
      },
      quiz: {
        question: 'In the Roblox version, when the door opens it does three things. Which is NOT one of them?',
        options: [
          'Sets Transparency to 0.8 so it looks ghostly',
          'Deletes itself with :Destroy()',
          'Changes BrickColor to Bright green'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Ghost Enemy',
      goal: 'A flickering ghost that chases the player through the maze.',
      points: [
        'The ghost floats toward the nearest player each frame',
        'It passes through walls (CanCollide = false in Roblox)',
        'Touching the ghost kills the player, then respawns them'
      ],
      challenge: 'Write the ghost movement and kill logic:',
      starter: '// Move the ghost toward the player, kill on touch\nfunction moveGhost() {\n  if (!ghost.active || !player.alive || won || gameOver) return;\n  let dx = player.x - ghost.x;\n  let dy = player.y - ghost.y;\n  let dist = Math.sqrt(dx * dx + dy * dy);\n  if (dist > 1) {\n    ghost.x += dx / dist * ghost.???;\n    ghost.y += dy / dist * ghost.???;\n  }\n  if (dist < 12) {\n    player.alive = false;\n    setTimeout(function() {\n      player.x = 50; player.y = 50; player.alive = true;\n      ghost.x = 300; ghost.y = 200;\n    }, 1200);\n  }\n}',
      solution: 'function moveGhost() {\n  if (!ghost.active || !player.alive || won || gameOver) return;\n  let dx = player.x - ghost.x;\n  let dy = player.y - ghost.y;\n  let dist = Math.sqrt(dx * dx + dy * dy);\n  if (dist > 1) {\n    ghost.x += dx / dist * ghost.speed;\n    ghost.y += dy / dist * ghost.speed;\n  }\n  if (dist < 12) {\n    player.alive = false;\n    setTimeout(function() {\n      player.x = 50; player.y = 50; player.alive = true;\n      ghost.x = 300; ghost.y = 200;\n    }, 1200);\n  }\n}',
      checks: ['speed', 'dist', 'alive'],
      height: 320,
      fills: {
        text: 'The ghost uses .Unit direction (normalised by dividing by ___) multiplied by speed. In Roblox, .Magnitude measures ___.',
        answers: ['dist', 'distance']
      },
      quiz: {
        question: 'In the Roblox ghost script, what does (target.Position - ghost.Position).Unit give you?',
        options: [
          'The distance between the ghost and the player',
          'A direction vector of length 1 pointing from the ghost to the player',
          'The speed of the ghost in studs per second'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Timer & Atmospheric Polish',
      goal: 'Add a countdown timer and win/lose conditions with spooky effects.',
      points: [
        'A 3-minute countdown timer, matching the Roblox TimerGui',
        'Timer turns red at 30 seconds. Zero = game over',
        'Win overlay when escaping, game-over screen when time runs out'
      ],
      challenge: 'Write the countdown timer update function:',
      starter: '// Update the countdown timer each second\nfunction updateTimer() {\n  let now = Date.now();\n  if (now - lastTick >= ??? && !won && !gameOver && player.alive) {\n    timeLeft--;\n    lastTick = now;\n    if (timeLeft <= 0) {\n      gameOver = ???;\n      timeLeft = 0;\n    }\n  }\n}',
      solution: 'function updateTimer() {\n  let now = Date.now();\n  if (now - lastTick >= 1000 && !won && !gameOver && player.alive) {\n    timeLeft--;\n    lastTick = now;\n    if (timeLeft <= 0) {\n      gameOver = true;\n      timeLeft = 0;\n    }\n  }\n}',
      checks: ['1000', 'gameover', 'true'],
      height: 200,
      fills: {
        text: 'The timer checks every ___ milliseconds (1 second). In Roblox the timer uses ___ to wait 1 second per loop.',
        answers: ['1000', 'task.wait']
      },
      quiz: {
        question: 'In the Roblox workshop, the timer label turns red when timeLeft reaches:',
        options: [
          '60 seconds',
          '30 seconds, giving the player a visual warning that time is almost up',
          '0 seconds, but only after the player dies'
        ],
        correct: 1
      }
    }
  ]
};
