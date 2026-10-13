'use strict';

/* ===================================================
   IFRAME BUILDING BLOCKS (platformer-part2-specific)
   =================================================== */

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#1a1a2e;margin:0;overflow:hidden}canvas{display:block;cursor:pointer}</style>';

var CANVAS_TAG = '<canvas id="game" width="600" height="400"></canvas>';

var SETUP_BASIC = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var PLAYER_OBJ = 'const player={x:50,y:300,w:24,h:32,vx:0,vy:0,onGround:false,jumpsLeft:2,facing:1};const gravity=0.5;const moveSpeed=3;const jumpForce=-10;';

var KEYS_HANDLER = 'const keys={};document.addEventListener("keydown",function(e){keys[e.code]=true;e.preventDefault()});document.addEventListener("keyup",function(e){keys[e.code]=false});';

var DRAW_BG = 'ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,600,400);';

var DRAW_GROUND = 'ctx.fillStyle="#2d5016";ctx.fillRect(0,368,600,32);';

var DRAW_PLAYER = 'ctx.fillStyle="#e63946";ctx.fillRect(player.x,player.y,player.w,player.h);';

var DRAW_PLAYER_EYES = 'ctx.fillStyle="#fff";if(player.facing>0){ctx.fillRect(player.x+14,player.y+6,6,6)}else{ctx.fillRect(player.x+4,player.y+6,6,6)}';

var BASIC_PHYSICS = 'player.vy+=gravity;player.vx=0;if(keys["ArrowLeft"]){player.vx=-moveSpeed;player.facing=-1}if(keys["ArrowRight"]){player.vx=moveSpeed;player.facing=1}player.x+=player.vx;player.y+=player.vy;';

var GROUND_CHECK = 'if(player.y+player.h>=368){player.y=368-player.h;player.vy=0;player.onGround=true;player.jumpsLeft=2}else{player.onGround=false}if(player.x<0)player.x=0;if(player.x+player.w>600)player.x=600-player.w;';

var BASIC_JUMP = 'if(keys["ArrowUp"]&&player.onGround){player.vy=jumpForce;player.onGround=false}';

var DOUBLE_JUMP_HANDLER = 'var justPressed=keys["ArrowUp"]&&!player._lastUp;player._lastUp=!!keys["ArrowUp"];if(justPressed&&player.jumpsLeft>0){player.vy=jumpForce;player.jumpsLeft--;player.onGround=false}';

var PLATFORMS_DATA = 'const platforms=[{x:0,y:368,w:600,h:32},{x:100,y:290,w:100,h:16},{x:280,y:240,w:100,h:16},{x:420,y:300,w:120,h:16},{x:50,y:180,w:80,h:16},{x:200,y:140,w:100,h:16},{x:450,y:180,w:100,h:16}];';

var DRAW_PLATFORMS = 'ctx.fillStyle="#2d5016";for(var i=0;i<platforms.length;i++){var pl=platforms[i];ctx.fillRect(pl.x,pl.y,pl.w,pl.h)}';

var PLATFORM_COLLIDE = 'player.onGround=false;for(var i=0;i<platforms.length;i++){var pl=platforms[i];if(player.x+player.w>pl.x&&player.x<pl.x+pl.w&&player.y+player.h>=pl.y&&player.y+player.h<=pl.y+10&&player.vy>=0){player.y=pl.y-player.h;player.vy=0;player.onGround=true;player.jumpsLeft=2}}';

var WALL_PLATFORMS = 'const walls=[{x:180,y:160,w:16,h:120},{x:400,y:100,w:16,h:160}];';

var DRAW_WALLS = 'ctx.fillStyle="#4a3728";for(var i=0;i<walls.length;i++){var wl=walls[i];ctx.fillRect(wl.x,wl.y,wl.w,wl.h)}';

var PARALLAX_DATA = 'const layers=[{color:"#16213e",shapes:[{x:50,y:180,w:120,h:220},{x:300,y:200,w:150,h:200},{x:500,y:160,w:100,h:240}],speed:0.1},{color:"#1a1a2e",shapes:[{x:20,y:220,w:100,h:180},{x:200,y:240,w:130,h:160},{x:400,y:210,w:110,h:190}],speed:0.3},{color:"#0f3460",shapes:[{x:80,y:270,w:60,h:130},{x:250,y:280,w:50,h:120},{x:450,y:260,w:70,h:140}],speed:0.6}];var camX=0;';

var LEVEL_DATA = 'const levelStr=["....................","..........C.........",".....###...........","...C...........C...","...###....E..###...","....................",".......###.........","..C................","..###..........C...","..............###..","..E................","################..#"];const TILE=32;var tiles=[];var coins=[];var enemies=[];';

var PARSE_LEVEL = 'for(var r=0;r<levelStr.length;r++){for(var c=0;c<levelStr[r].length;c++){var ch=levelStr[r].charAt(c);if(ch==="#")tiles.push({x:c*TILE,y:r*TILE,w:TILE,h:TILE});else if(ch==="C")coins.push({x:c*TILE+8,y:r*TILE+8,w:16,h:16,got:false});else if(ch==="E")enemies.push({x:c*TILE,y:r*TILE,w:TILE,h:TILE,vx:1,alive:true})}}';

var DRAW_TILES = 'ctx.fillStyle="#2d5016";for(var i=0;i<tiles.length;i++){var t=tiles[i];ctx.fillRect(t.x,t.y,t.w,t.h)}';

var DRAW_COINS = 'ctx.fillStyle="#ffd700";for(var i=0;i<coins.length;i++){var co=coins[i];if(!co.got){ctx.fillRect(co.x,co.y,co.w,co.h)}}';

var DRAW_ENEMIES = 'ctx.fillStyle="#9b59b6";for(var i=0;i<enemies.length;i++){var en=enemies[i];if(en.alive){ctx.fillRect(en.x,en.y,en.w,en.h)}}';

var ENEMY_MOVE = 'for(var i=0;i<enemies.length;i++){var en=enemies[i];if(en.alive){en.x+=en.vx;var onPlat=false;for(var j=0;j<tiles.length;j++){var t=tiles[j];if(en.x+en.w>t.x&&en.x<t.x+t.w&&en.y+en.h>=t.y&&en.y+en.h<=t.y+4){onPlat=true}}if(!onPlat||en.x<0||en.x+en.w>600)en.vx*=-1}}';

var COIN_COLLECT = 'for(var i=0;i<coins.length;i++){var co=coins[i];if(!co.got&&player.x+player.w>co.x&&player.x<co.x+co.w&&player.y+player.h>co.y&&player.y<co.y+co.h){co.got=true;score++}}';

var TIMER_VARS = 'var score=0;var timer=60;var lastTime=Date.now();var gameOver=false;var won=false;';

var TIMER_TICK = 'var now=Date.now();timer-=(now-lastTime)/1000;lastTime=now;if(timer<=0){timer=0;gameOver=true}';

var DRAW_HUD = 'ctx.fillStyle="#fff";ctx.font="bold 18px sans-serif";ctx.textAlign="left";ctx.fillText("Coins: "+score,10,24);ctx.textAlign="right";ctx.fillText("Time: "+Math.ceil(timer),590,24);';

var CHECK_WIN = 'var allGot=true;for(var i=0;i<coins.length;i++){if(!coins[i].got)allGot=false}if(allGot&&coins.length>0){gameOver=true;won=true}';

var DRAW_GAMEOVER = 'if(gameOver){ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,600,400);ctx.fillStyle="#fff";ctx.font="bold 32px sans-serif";ctx.textAlign="center";ctx.fillText(won?"You Win!":"Time Up!",300,180);ctx.font="18px sans-serif";ctx.fillText("Coins: "+score+" / "+coins.length,300,220)}';

function wrap(code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + CSS_GAME +
    '<\/head><body>' + CANVAS_TAG + '<script>' + code + '<\/script><\/body><\/html>';
}

/* ===================================================
   CW_CONFIG - platformer-part2-specific steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-js-platformer-part2-canvas',
  downloadName: 'my-platformer-part2.html',

  hints: [
    'Your game engine is alive - a red player on solid ground',
    'Double jump lets you reach higher platforms - tap jump twice!',
    'Slide down walls slowly and kick off them to reach new areas',
    'Watch the layers scroll at different speeds - depth from motion',
    'Levels built from text - each character is a tile on screen',
    'Stomp enemies, grab coins, beat the clock - your platformer is complete!'
  ],

  templates: {
    1: function(u) {
      return wrap(
        SETUP_BASIC + PLAYER_OBJ + KEYS_HANDLER + PLATFORMS_DATA +
        'try{' + u + '}catch(e){}' +
        'function loop(){' +
        BASIC_PHYSICS + PLATFORM_COLLIDE + GROUND_CHECK + BASIC_JUMP +
        DRAW_BG + DRAW_PLATFORMS + DRAW_PLAYER + DRAW_PLAYER_EYES +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(
        SETUP_BASIC + PLAYER_OBJ + KEYS_HANDLER + PLATFORMS_DATA +
        'function loop(){' +
        BASIC_PHYSICS + PLATFORM_COLLIDE + GROUND_CHECK +
        'try{' + u + '}catch(e){}' +
        DRAW_BG + DRAW_PLATFORMS + DRAW_PLAYER + DRAW_PLAYER_EYES +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
     3: function(u) {
      return wrap(
        SETUP_BASIC + PLAYER_OBJ + KEYS_HANDLER + PLATFORMS_DATA + WALL_PLATFORMS +
        'function loop(){' +
        BASIC_PHYSICS + PLATFORM_COLLIDE + GROUND_CHECK + DOUBLE_JUMP_HANDLER +
        'try{' + u + '}catch(e){}' +
        DRAW_BG + DRAW_PLATFORMS + DRAW_WALLS + DRAW_PLAYER + DRAW_PLAYER_EYES +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(
        SETUP_BASIC + PLAYER_OBJ + KEYS_HANDLER + PLATFORMS_DATA + WALL_PLATFORMS + PARALLAX_DATA +
        'function loop(){' +
        BASIC_PHYSICS + PLATFORM_COLLIDE + GROUND_CHECK + DOUBLE_JUMP_HANDLER +
        'camX=player.x-300;' +
        DRAW_BG +
        'try{' + u + '}catch(e){}' +
        DRAW_PLATFORMS + DRAW_WALLS + DRAW_PLAYER + DRAW_PLAYER_EYES +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(
        SETUP_BASIC + PLAYER_OBJ + KEYS_HANDLER + LEVEL_DATA +
        'try{' + u + '}catch(e){}' +
        'function loop(){' +
        BASIC_PHYSICS +
        'player.onGround=false;for(var i=0;i<tiles.length;i++){var t=tiles[i];if(player.x+player.w>t.x&&player.x<t.x+t.w&&player.y+player.h>=t.y&&player.y+player.h<=t.y+10&&player.vy>=0){player.y=t.y-player.h;player.vy=0;player.onGround=true;player.jumpsLeft=2}}' +
        GROUND_CHECK + DOUBLE_JUMP_HANDLER +
        DRAW_BG + DRAW_TILES + DRAW_COINS + DRAW_ENEMIES + DRAW_PLAYER + DRAW_PLAYER_EYES +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(
        SETUP_BASIC + PLAYER_OBJ + KEYS_HANDLER + LEVEL_DATA + TIMER_VARS +
        PARSE_LEVEL +
        'function loop(){if(!gameOver){' +
        BASIC_PHYSICS +
        'player.onGround=false;for(var i=0;i<tiles.length;i++){var t=tiles[i];if(player.x+player.w>t.x&&player.x<t.x+t.w&&player.y+player.h>=t.y&&player.y+player.h<=t.y+10&&player.vy>=0){player.y=t.y-player.h;player.vy=0;player.onGround=true;player.jumpsLeft=2}}' +
        GROUND_CHECK + DOUBLE_JUMP_HANDLER + ENEMY_MOVE + COIN_COLLECT + TIMER_TICK +
        'try{' + u + '}catch(e){}' +
        CHECK_WIN + '}' +
        DRAW_BG + DRAW_TILES + DRAW_COINS + DRAW_ENEMIES + DRAW_PLAYER + DRAW_PLAYER_EYES + DRAW_HUD + DRAW_GAMEOVER +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Your Own Engine',
      goal: 'Rebuild the core game loop: canvas, player, gravity, arrow movement and ground collision.',
      points: [
        'The <code>&lt;canvas&gt;</code> runs at 600x400 pixels - wider than Flappy Bird for side-scrolling',
        'The player object tracks position, velocity, size and a <code>facing</code> direction',
        'Every frame: apply <code>gravity</code> to vy, read arrow keys into vx, move, then redraw'
      ],
      challenge: 'Write the core update loop - apply gravity, read keys, move the player:',
      starter: '// The game loop runs every frame\n// Step 1: gravity pulls the player down\nplayer.vy += gravity;\n\n// Step 2: read arrow keys for movement\nplayer.vx = 0;\nif (keys["ArrowLeft"]) {\n  player.vx = -moveSpeed;\n}\nif (keys["ArrowRight"]) {\n  player.vx = ___;\n}\n\n// Step 3: update position\nplayer.x += player.vx;\nplayer.y += player.___;',
      solution: 'player.vy += gravity;\n\nplayer.vx = 0;\nif (keys["ArrowLeft"]) {\n  player.vx = -moveSpeed;\n}\nif (keys["ArrowRight"]) {\n  player.vx = moveSpeed;\n}\n\nplayer.x += player.vx;\nplayer.y += player.vy;\n\nrequestAnimationFrame(loop);',
      checks: ['gravity', 'player', 'requestanimationframe'],
      height: 260,
      fills: {
        text: 'Each frame, ___ increases the downward velocity. The ___ function schedules the next frame.',
        answers: ['gravity', 'requestAnimationFrame']
      },
      quiz: {
        question: 'Why do we set <code>vx = 0</code> at the start of every frame?',
        options: [
          'It makes the player invisible',
          'Without it the player would keep sliding after you release the key - resetting ensures movement only while a key is held',
          'JavaScript requires it for the loop to work'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Double Jump',
      goal: 'Replace the simple ground-only jump with a jumpsLeft counter that allows two jumps.',
      points: [
        'Instead of a boolean <code>onGround</code> check, track <code>jumpsLeft</code> (starts at 2)',
        'Each jump press spends one jump - first jump from the ground, second in mid-air',
        'Landing on the ground resets <code>jumpsLeft</code> back to 2'
      ],
      challenge: 'Write the double jump logic using a counter:',
      starter: '// Detect a fresh key press (not held)\nvar justPressed = keys["ArrowUp"] && !player._lastUp;\nplayer._lastUp = !!keys["ArrowUp"];\n\n// Jump if we have jumps remaining\nif (justPressed && player.jumpsLeft > ___) {\n  player.vy = jumpForce;\n  player.___--;\n  player.onGround = false;\n}',
      solution: 'var justPressed = keys["ArrowUp"] && !player._lastUp;\nplayer._lastUp = !!keys["ArrowUp"];\n\nif (justPressed && player.jumpsLeft > 0) {\n  player.vy = jumpForce;\n  player.jumpsLeft--;\n  player.onGround = false;\n}',
      checks: ['jumpsleft', 'jump', 'onground'],
      height: 200,
      fills: {
        text: 'The counter ___ starts at 2 and decreases each jump. Landing resets it so you can jump again.',
        answers: ['jumpsLeft']
      },
      quiz: {
        question: 'Why do we track <code>justPressed</code> instead of just checking <code>keys["ArrowUp"]</code>?',
        options: [
          'Arrow keys do not work without it',
          'Holding the key would fire a jump EVERY FRAME - justPressed ensures only one jump per press',
          'It makes the game run faster'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Wall Slide & Wall Jump',
      goal: 'Detect wall contact, slow the fall speed, and kick the player away from the wall on jump.',
      points: [
        'Check if the player overlaps a wall rectangle while moving sideways',
        'While touching a wall: slow the fall to <code>vy * 0.4</code> for a slide effect',
        'Jumping while on a wall pushes the player away horizontally - a wall kick'
      ],
      challenge: 'Write the wall detection and wall jump logic:',
      starter: '// Check each wall for contact\nvar onWall = 0; // -1 = left wall, 1 = right wall\nfor (var i = 0; i < walls.length; i++) {\n  var wl = walls[i];\n  if (player.x + player.w > wl.x && player.x < wl.x + wl.w &&\n      player.y + player.h > wl.y && player.y < wl.y + wl.h) {\n    // Which side?\n    if (player.x < wl.x) onWall = -1;\n    else onWall = 1;\n    // Slide: slow the fall\n    if (player.vy > 0) player.vy *= ___;\n  }\n}\n// Wall jump: push away from the wall\nvar justPressed = keys["ArrowUp"] && !player._lastWallUp;\nplayer._lastWallUp = !!keys["ArrowUp"];\nif (justPressed && onWall !== 0 && !player.onGround) {\n  player.vy = jumpForce;\n  player.vx = onWall * -___;\n}',
      solution: 'var onWall = 0;\nfor (var i = 0; i < walls.length; i++) {\n  var wl = walls[i];\n  if (player.x + player.w > wl.x && player.x < wl.x + wl.w &&\n      player.y + player.h > wl.y && player.y < wl.y + wl.h) {\n    if (player.x < wl.x) onWall = -1;\n    else onWall = 1;\n    if (player.vy > 0) player.vy *= 0.4;\n  }\n}\nvar justPressed = keys["ArrowUp"] && !player._lastWallUp;\nplayer._lastWallUp = !!keys["ArrowUp"];\nif (justPressed && onWall !== 0 && !player.onGround) {\n  player.vy = jumpForce;\n  player.vx = onWall * -5;\n}',
      checks: ['wall', 'player.vy', 'onwall'],
      height: 320,
      fills: {
        text: 'Multiplying vy by a small number like 0.4 creates a ___  effect. The wall jump pushes the player in the ___ direction from the wall.',
        answers: ['slide', 'opposite']
      },
      quiz: {
        question: 'Why multiply <code>vy</code> by 0.4 instead of setting it to a fixed number?',
        options: [
          'Fixed numbers crash the game',
          'Multiplying scales smoothly - fast falls slow to a gentle slide, while already-slow falls barely change',
          'It uses less memory'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Parallax Scrolling',
      goal: 'Draw layered backgrounds at different scroll speeds to create an illusion of depth.',
      points: [
        'Three layers: far clouds (0.1x speed), mid hills (0.3x speed), near trees (0.6x speed)',
        'Each layer draws its shapes offset by <code>camX * layer.speed</code>',
        'Closer layers move faster, giving the illusion that they are nearer to the camera'
      ],
      challenge: 'Write the parallax draw function that renders each layer at its own scroll speed:',
      starter: '// Draw each parallax layer\nfor (var i = 0; i < layers.length; i++) {\n  var layer = layers[i];\n  ctx.fillStyle = layer.color;\n  var offset = camX * layer.___;\n  for (var j = 0; j < layer.shapes.length; j++) {\n    var s = layer.shapes[j];\n    ctx.fillRect(s.x - offset, s.y, s.w, s.h);\n  }\n}',
      solution: 'for (var i = 0; i < layers.length; i++) {\n  var layer = layers[i];\n  ctx.fillStyle = layer.color;\n  var offset = camX * layer.speed;\n  for (var j = 0; j < layer.shapes.length; j++) {\n    var s = layer.shapes[j];\n    ctx.fillRect(s.x - offset, s.y, s.w, s.h);\n  }\n}',
      checks: ['layer', 'camx', 'speed'],
      height: 210,
      fills: {
        text: 'Far layers use a small ___ multiplier so they barely move. This is called ___ scrolling.',
        answers: ['speed', 'parallax']
      },
      quiz: {
        question: 'Why does a layer with speed 0.1 look far away?',
        options: [
          'It is drawn smaller',
          'It moves only 10% as fast as the camera - distant things appear to shift less when you move, just like in real life',
          'It is drawn with a darker colour'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Levels as Text',
      goal: 'Define levels with ASCII strings where # = solid, C = coin, E = enemy, . = empty.',
      points: [
        'Each row of the level string is a row of tiles on screen',
        '<code>charAt(c)</code> reads a single character at column c from the string',
        'Each tile is TILE (32) pixels wide - multiply row/col by TILE for pixel position'
      ],
      challenge: 'Write the ASCII level parser that turns text into game objects:',
      starter: '// Parse the level strings into game objects\nfor (var r = 0; r < levelStr.length; r++) {\n  for (var c = 0; c < levelStr[r].length; c++) {\n    var ch = levelStr[r].charAt(c);\n    if (ch === "#") {\n      tiles.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE });\n    } else if (ch === "C") {\n      coins.push({ x: c * TILE + 8, y: r * ___ + 8, w: 16, h: 16, got: false });\n    } else if (ch === "E") {\n      enemies.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE, vx: 1, alive: true });\n    }\n  }\n}',
      solution: 'for (var r = 0; r < levelStr.length; r++) {\n  for (var c = 0; c < levelStr[r].length; c++) {\n    var ch = levelStr[r].charAt(c);\n    if (ch === "#") {\n      tiles.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE });\n    } else if (ch === "C") {\n      coins.push({ x: c * TILE + 8, y: r * TILE + 8, w: 16, h: 16, got: false });\n    } else if (ch === "E") {\n      enemies.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE, vx: 1, alive: true });\n    }\n  }\n}',
      checks: ['charat', 'tile', 'levelstr'],
      height: 290,
      fills: {
        text: 'The function ___ reads one character from a string. Multiplying row and column by ___ converts grid positions to pixels.',
        answers: ['charAt', 'TILE']
      },
      quiz: {
        question: 'Why design levels as text strings instead of arrays of numbers?',
        options: [
          'Text strings are faster to process',
          'You can SEE the level shape in your code - the layout of characters mirrors what appears on screen',
          'JavaScript only supports strings'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Enemies, Timer & Finish',
      goal: 'Stomp enemies from above, race a countdown timer, and win when all coins are collected.',
      points: [
        'Stomp check: if the player lands on an enemy from above (vy > 0), the enemy dies and the player bounces',
        'The timer counts down from 60 using real elapsed time - not frame count',
        'Victory: when every coin has <code>got === true</code>, the game is won'
      ],
      challenge: 'Write the stomp check, timer and victory condition:',
      starter: '// Stomp enemies from above\nfor (var i = 0; i < enemies.length; i++) {\n  var en = enemies[i];\n  if (en.alive && player.x + player.w > en.x && player.x < en.x + en.w &&\n      player.y + player.h > en.y && player.y + player.h < en.y + 16 &&\n      player.vy > 0) {\n    en.___ = false;\n    player.vy = -8; // bounce\n  }\n}\n// Timer countdown\nvar now = Date.now();\ntimer -= (now - lastTime) / 1000;\nlastTime = now;\nif (timer <= 0) { timer = 0; gameOver = true; }\n// Check win\nvar allGot = true;\nfor (var i = 0; i < coins.length; i++) {\n  if (!coins[i].got) allGot = false;\n}\nif (allGot && coins.length > 0) {\n  gameOver = true;\n  ___ = true;\n}',
      solution: 'for (var i = 0; i < enemies.length; i++) {\n  var en = enemies[i];\n  if (en.alive && player.x + player.w > en.x && player.x < en.x + en.w &&\n      player.y + player.h > en.y && player.y + player.h < en.y + 16 &&\n      player.vy > 0) {\n    en.alive = false;\n    player.vy = -8;\n  }\n}\nvar now = Date.now();\ntimer -= (now - lastTime) / 1000;\nlastTime = now;\nif (timer <= 0) { timer = 0; gameOver = true; }\nvar allGot = true;\nfor (var i = 0; i < coins.length; i++) {\n  if (!coins[i].got) allGot = false;\n}\nif (allGot && coins.length > 0) {\n  gameOver = true;\n  won = true;\n}',
      checks: ['player.vy', 'timer', 'enemies'],
      height: 380,
      fills: {
        text: 'Landing on an enemy with ___ > 0 means the player is falling. Real-time timers use ___ instead of frame counting.',
        answers: ['vy', 'Date.now']
      },
      quiz: {
        question: 'Why check <code>player.vy > 0</code> for stomping instead of just overlap?',
        options: [
          'vy > 0 makes the game faster',
          'Without it, walking into an enemy from the side would also count as a stomp - the player must be falling onto the enemy',
          'Positive vy means jumping'
        ],
        correct: 1
      }
    }
  ]
};
