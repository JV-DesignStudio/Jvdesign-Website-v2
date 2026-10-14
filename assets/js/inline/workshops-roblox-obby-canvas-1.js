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
   IFRAME BUILDING BLOCKS (Roblox Obby simulation)
   =================================================== */

var CSS_OBBY = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}label{cursor:pointer}</style>';

var CANVAS_OBBY = '<div class="row"><span>Lives: <b id="lives">3</b></span><span>Time: <b id="timer">0s</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to move &middot; Space to jump</div>';

var SETUP_OBBY = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400,GRAVITY=0.5,JUMP=-10,SPEED=4;',
  'let player={x:40,y:100,w:16,h:24,vx:0,vy:0,onGround:false,alive:true};',
  'let lives=3,startTime=Date.now(),won=false;',
  'let leftHeld=false,rightHeld=false,jumpHeld=false;'
].join('');

var PLATFORMS_BASE = [
  'let platforms=[',
  '{x:20,y:300,w:80,h:12,color:"#718096",type:"start"},',
  '{x:140,y:280,w:40,h:10,color:"#63b3ed",type:"normal"},',
  '{x:220,y:260,w:30,h:10,color:"#68d391",type:"normal"},',
  '{x:300,y:240,w:50,h:10,color:"#f6ad55",type:"normal"},',
  '{x:380,y:220,w:30,h:10,color:"#fc8181",type:"normal"},',
  '{x:450,y:200,w:40,h:10,color:"#b794f4",type:"normal"},',
  '{x:530,y:180,w:60,h:12,color:"#48bb78",type:"finish"}',
  '];'
].join('');

var LAVA_FLOOR = 'let lavaY=380;';

var KEYS_OBBY = [
  'document.addEventListener("keydown",function(e){',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;',
  'if(e.code==="Space"||e.code==="ArrowUp"||e.code==="KeyW"){jumpHeld=true;e.preventDefault()}',
  '});',
  'document.addEventListener("keyup",function(e){',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false;',
  'if(e.code==="Space"||e.code==="ArrowUp"||e.code==="KeyW")jumpHeld=false;',
  '});'
].join('');

var MOVE_PLAYER = [
  'function movePlayer(){',
  'if(!player.alive)return;',
  'if(leftHeld)player.vx=-SPEED;',
  'else if(rightHeld)player.vx=SPEED;',
  'else player.vx*=0.8;',
  'if(jumpHeld&&player.onGround){player.vy=JUMP;player.onGround=false}',
  'player.vy+=GRAVITY;',
  'player.x+=player.vx;player.y+=player.vy;',
  'if(player.x<0)player.x=0;if(player.x+player.w>W)player.x=W-player.w;',
  'player.onGround=false;',
  'for(let i=0;i<platforms.length;i++){let p=platforms[i];',
  'if(player.vy>=0&&player.x+player.w>p.x&&player.x<p.x+p.w&&',
  'player.y+player.h>=p.y&&player.y+player.h<=p.y+p.h+player.vy+2){',
  'player.y=p.y-player.h;player.vy=0;player.onGround=true;',
  'if(p.type==="finish"&&!won){won=true}',
  '}}',
  '}'
].join('');

var DRAW_BG_OBBY = 'CWArt.bg(ctx,W,H,"#1a1c2e","#0d0f1a");CWArt.grid(ctx,W,H,40);';

var DRAW_PLATFORMS = [
  'for(let i=0;i<platforms.length;i++){let p=platforms[i];',
  'ctx.save();ctx.shadowColor=p.color;ctx.shadowBlur=p.type==="finish"?16:8;',
  'ctx.fillStyle=p.color;CWArt.roundRect(ctx,p.x,p.y,p.w,p.h,4);ctx.fill();ctx.restore();',
  'if(p.type==="start"){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("START",p.x+p.w/2,p.y-4)}',
  'if(p.type==="finish"){ctx.fillStyle="rgba(72,187,120,.9)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("FINISH",p.x+p.w/2,p.y-4)}',
  '}'
].join('');

var DRAW_PLAYER = [
  'if(player.alive){',
  'ctx.save();ctx.shadowColor="rgba(99,179,237,.9)";ctx.shadowBlur=12;',
  'ctx.fillStyle="#63b3ed";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(player.x+4,player.y+6,4,4);ctx.fillRect(player.x+10,player.y+6,4,4);',
  '}'
].join('');

var DRAW_LAVA = [
  'ctx.save();ctx.shadowColor="rgba(245,101,101,.8)";ctx.shadowBlur=20;',
  'ctx.fillStyle="#f56565";ctx.fillRect(0,lavaY,W,H-lavaY);ctx.restore();',
  'for(let i=0;i<W;i+=20){let h=4+Math.sin((Date.now()/200)+i)*3;',
  'ctx.fillStyle="rgba(255,160,0,.6)";ctx.fillRect(i,lavaY-h,10,h)}'
].join('');

var DRAW_HUD = [
  'document.getElementById("lives").textContent=lives;',
  'let elapsed=Math.floor((Date.now()-startTime)/1000);',
  'document.getElementById("timer").textContent=elapsed+"s";',
  'if(won){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#48bb78";ctx.font="bold 28px system-ui";ctx.textAlign="center";',
  'ctx.fillText("YOU FINISHED!",W/2,H/2-20);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("Time: "+elapsed+"s",W/2,H/2+15)}'
].join('');

var RESPAWN = [
  'function respawn(){',
  'player.x=40;player.y=100;player.vx=0;player.vy=0;player.alive=true;player.onGround=false;',
  '}'
].join('');

var LAVA_CHECK = [
  'function checkLava(){',
  'if(player.y+player.h>=lavaY&&player.alive){',
  'player.alive=false;lives--;',
  'document.getElementById("lives").textContent=lives;',
  'if(lives>0)setTimeout(respawn,800);',
  '}}'
].join('');

var MOVING_PLAT_VARS = [
  'let movePlat1={x:200,y:230,w:50,h:10,color:"#ecc94b",type:"moving",baseX:200,range:60,speed:0.02,axis:"x"};',
  'let movePlat2={x:400,y:190,w:50,h:10,color:"#ecc94b",type:"moving",baseX:400,range:40,speed:0.025,axis:"x"};',
  'platforms.push(movePlat1,movePlat2);'
].join('');

var MOVE_PLATFORMS = [
  'function moveMovingPlatforms(){',
  'for(let i=0;i<platforms.length;i++){let p=platforms[i];',
  'if(p.type==="moving"){p.x=p.baseX+Math.sin(Date.now()*p.speed)*p.range}',
  '}}'
].join('');

var JUMP_PAD_VARS = [
  'let jumpPad={x:340,y:250,w:30,h:8,color:"#00e5ff",type:"jumppad"};',
  'platforms.push(jumpPad);'
].join('');

var JUMP_PAD_CHECK = [
  'function checkJumpPad(){',
  'let p=jumpPad;',
  'if(player.alive&&player.vy>=0&&player.x+player.w>p.x&&player.x<p.x+p.w&&',
  'player.y+player.h>=p.y&&player.y+player.h<=p.y+p.h+player.vy+2){',
  'player.vy=-14;player.onGround=false;',
  '}}'
].join('');

var DRAW_JUMPPAD_GLOW = [
  'let jp=jumpPad;ctx.save();',
  'ctx.shadowColor="rgba(0,229,255,.9)";ctx.shadowBlur=20+Math.sin(Date.now()/200)*6;',
  'ctx.fillStyle="#00e5ff";CWArt.roundRect(ctx,jp.x,jp.y,jp.w,jp.h,3);ctx.fill();ctx.restore();',
  'ctx.fillStyle="rgba(255,255,255,.8)";ctx.font="bold 7px system-ui";ctx.textAlign="center";',
  'ctx.fillText("JUMP",jp.x+jp.w/2,jp.y-3);'
].join('');

var TOUCH_OBBY = [
  'let touchStart=null;',
  'canvas.addEventListener("touchstart",function(e){touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault()});',
  'canvas.addEventListener("touchend",function(e){if(!touchStart)return;',
  'let dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;',
  'if(Math.abs(dy)>20&&dy<0){jumpHeld=true;setTimeout(function(){jumpHeld=false},150)}',
  'else if(Math.abs(dx)>20){if(dx>0){rightHeld=true;setTimeout(function(){rightHeld=false},200)}',
  'else{leftHeld=true;setTimeout(function(){leftHeld=false},200)}}',
  'touchStart=null});'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

/* ===================================================
   CW_CONFIG - Roblox Obby canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-obby-canvas',
  downloadName: 'my-obby-game.html',

  hints: [
    'Arrow keys to move, Space to jump onto the platforms',
    'Try jumping across the stepping stones',
    'The red lava kills you! Avoid falling into it',
    'Watch the yellow platforms slide back and forth',
    'The cyan pad launches you high - try it!',
    'Reach the green FINISH platform to win!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_OBBY, CANVAS_OBBY,
        SETUP_OBBY + PLATFORMS_BASE + KEYS_OBBY + RESPAWN +
        'function draw(){' + DRAW_BG_OBBY + DRAW_PLATFORMS + DRAW_PLAYER + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_OBBY, CANVAS_OBBY,
        SETUP_OBBY + PLATFORMS_BASE + LAVA_FLOOR + KEYS_OBBY + RESPAWN +
        MOVE_PLAYER +
        'function draw(){' + DRAW_BG_OBBY + DRAW_LAVA + DRAW_PLATFORMS + DRAW_PLAYER + DRAW_HUD + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();if(typeof checkLava==="function")checkLava();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_OBBY, CANVAS_OBBY,
        SETUP_OBBY + PLATFORMS_BASE + LAVA_FLOOR + MOVING_PLAT_VARS + KEYS_OBBY + RESPAWN +
        MOVE_PLAYER + LAVA_CHECK +
        'function draw(){' + DRAW_BG_OBBY + DRAW_LAVA + DRAW_PLATFORMS + DRAW_PLAYER + DRAW_HUD + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){if(typeof moveMovingPlatforms==="function")moveMovingPlatforms();movePlayer();checkLava();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_OBBY, CANVAS_OBBY,
        SETUP_OBBY + PLATFORMS_BASE + LAVA_FLOOR + MOVING_PLAT_VARS + JUMP_PAD_VARS + KEYS_OBBY + RESPAWN +
        MOVE_PLAYER + LAVA_CHECK + MOVE_PLATFORMS +
        'function draw(){' + DRAW_BG_OBBY + DRAW_LAVA + DRAW_PLATFORMS + DRAW_JUMPPAD_GLOW + DRAW_PLAYER + DRAW_HUD + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){moveMovingPlatforms();movePlayer();checkLava();if(typeof checkJumpPad==="function")checkJumpPad();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_OBBY, CANVAS_OBBY,
        SETUP_OBBY + PLATFORMS_BASE + LAVA_FLOOR + MOVING_PLAT_VARS + JUMP_PAD_VARS + KEYS_OBBY + RESPAWN +
        MOVE_PLAYER + LAVA_CHECK + MOVE_PLATFORMS + JUMP_PAD_CHECK +
        'function draw(){' + DRAW_BG_OBBY + DRAW_LAVA + DRAW_PLATFORMS + DRAW_JUMPPAD_GLOW + DRAW_PLAYER + DRAW_HUD + '}' +
        TOUCH_OBBY + u +
        'function loop(){moveMovingPlatforms();movePlayer();checkLava();checkJumpPad();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_OBBY, CANVAS_OBBY,
        SETUP_OBBY + PLATFORMS_BASE + LAVA_FLOOR + MOVING_PLAT_VARS + JUMP_PAD_VARS + KEYS_OBBY + RESPAWN +
        MOVE_PLAYER + LAVA_CHECK + MOVE_PLATFORMS + JUMP_PAD_CHECK + TOUCH_OBBY +
        'function draw(){' + DRAW_BG_OBBY + DRAW_LAVA + DRAW_PLATFORMS + DRAW_JUMPPAD_GLOW + DRAW_PLAYER + DRAW_HUD + '}' +
        u +
        'function loop(){moveMovingPlatforms();movePlayer();checkLava();checkJumpPad();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Build the Obby Layout',
      goal: 'Set up the player and the basic movement physics.',
      points: [
        'A player character with gravity, speed and jump power',
        'Arrow keys move left/right, Space jumps',
        'The player lands on platforms and can fall off'
      ],
      challenge: 'Write the movement function that applies gravity and keyboard input:',
      starter: '// Move the player each frame\nfunction movePlayer() {\n  if (!player.alive) return;\n  // Apply keyboard input to velocity\n  if (leftHeld) player.vx = ???;\n  else if (rightHeld) player.vx = ???;\n  else player.vx *= 0.8;\n  // Jump if on ground\n  if (jumpHeld && player.onGround) {\n    player.vy = ???;\n    player.onGround = false;\n  }\n  // Apply gravity\n  player.vy += GRAVITY;\n  // Move\n  player.x += player.vx;\n  player.y += player.vy;\n}',
      solution: 'function movePlayer() {\n  if (!player.alive) return;\n  if (leftHeld) player.vx = -SPEED;\n  else if (rightHeld) player.vx = SPEED;\n  else player.vx *= 0.8;\n  if (jumpHeld && player.onGround) {\n    player.vy = JUMP;\n    player.onGround = false;\n  }\n  player.vy += GRAVITY;\n  player.x += player.vx;\n  player.y += player.vy;\n}',
      checks: ['speed', 'jump', 'gravity'],
      height: 280,
      fills: {
        text: 'The ___ constant pulls the player down each frame. Pressing Space sets vy to ___ to jump.',
        answers: ['GRAVITY', 'JUMP']
      },
      quiz: {
        question: 'In a platformer, gravity is simulated by:',
        options: [
          'Moving platforms up every frame',
          'Adding a small value to the player\'s vertical velocity each frame',
          'Setting the player\'s Y position to 0'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Lava! Kill Floor',
      goal: 'Add a lava floor that kills the player and costs a life.',
      points: [
        'A red lava zone sits below all the platforms',
        'Touching it kills the player and removes a life',
        'After a short delay, the player respawns at the start'
      ],
      challenge: 'Write the lava collision check:',
      starter: '// Check if the player has fallen into the lava\nfunction checkLava() {\n  if (player.y + player.h >= ??? && player.alive) {\n    player.alive = ???;\n    lives--;\n    if (lives > 0) setTimeout(respawn, 800);\n  }\n}',
      solution: 'function checkLava() {\n  if (player.y + player.h >= lavaY && player.alive) {\n    player.alive = false;\n    lives--;\n    if (lives > 0) setTimeout(respawn, 800);\n  }\n}',
      checks: ['lavay', 'alive', 'false'],
      height: 160,
      fills: {
        text: 'The lava kills the player when their ___ edge reaches lavaY. The ___ function delays the respawn.',
        answers: ['bottom', 'setTimeout']
      },
      quiz: {
        question: 'In Roblox, the equivalent of our checkLava function is:',
        options: [
          'A Touched event on the lava part that sets Humanoid.Health to 0',
          'A ProximityPrompt that asks players to restart',
          'A while loop that checks distance every second'
        ],
        correct: 0
      }
    },
    {
      num: 3,
      title: 'Moving Platforms',
      goal: 'Make two platforms slide back and forth using sine waves.',
      points: [
        'Each platform has a base position, range and speed',
        '<code>Math.sin()</code> creates smooth back-and-forth motion',
        'The platform positions update every frame before collision checks'
      ],
      challenge: 'Write the function that moves the platforms:',
      starter: '// Update moving platform positions each frame\nfunction moveMovingPlatforms() {\n  for (let i = 0; i < platforms.length; i++) {\n    let p = platforms[i];\n    if (p.type === "moving") {\n      // Use sine wave: baseX + sin(time * speed) * range\n      p.x = p.baseX + ???;\n    }\n  }\n}',
      solution: 'function moveMovingPlatforms() {\n  for (let i = 0; i < platforms.length; i++) {\n    let p = platforms[i];\n    if (p.type === "moving") {\n      p.x = p.baseX + Math.sin(Date.now() * p.speed) * p.range;\n    }\n  }\n}',
      checks: ['math.sin', 'date.now', 'range'],
      height: 180,
      fills: {
        text: 'Sine waves produce smooth ___ motion. In Roblox, the same effect uses ___.',
        answers: ['back-and-forth', 'TweenService']
      },
      quiz: {
        question: 'In Roblox, TweenService:Create() does the same job as our Math.sin() approach. TweenService is better because:',
        options: [
          'It uses less memory',
          'It handles easing styles (Sine, Bounce, etc.) and repeats automatically',
          'It only works on Anchored parts'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Jump Pad',
      goal: 'Add a launch pad that blasts the player upward.',
      points: [
        'A cyan pad that glows with a pulsing effect',
        'Landing on it sets a high negative velocity (launches up)',
        'In Roblox, this sets <code>HumanoidRootPart.Velocity</code>'
      ],
      challenge: 'Write the jump pad collision check:',
      starter: '// Check if the player lands on the jump pad\nfunction checkJumpPad() {\n  let p = jumpPad;\n  if (player.alive && player.vy >= 0 &&\n      player.x + player.w > p.x && player.x < p.x + p.w &&\n      player.y + player.h >= p.y && player.y + player.h <= p.y + p.h + player.vy + 2) {\n    player.vy = ???;\n    player.onGround = false;\n  }\n}',
      solution: 'function checkJumpPad() {\n  let p = jumpPad;\n  if (player.alive && player.vy >= 0 &&\n      player.x + player.w > p.x && player.x < p.x + p.w &&\n      player.y + player.h >= p.y && player.y + player.h <= p.y + p.h + player.vy + 2) {\n    player.vy = -14;\n    player.onGround = false;\n  }\n}',
      checks: ['jumppad', 'vy', '-14'],
      height: 200,
      fills: {
        text: 'The jump pad sets vy to a large ___ number. In Roblox, it sets Velocity.Y to ___.',
        answers: ['negative', '80']
      },
      quiz: {
        question: 'In Roblox Lua, <code>rootPart.Velocity = Vector3.new(0, 80, 0)</code> means:',
        options: [
          'The Y axis (middle number) launches the player upward at speed 80',
          'The X axis moves the player 80 studs to the right',
          'All three axes get set to 80'
        ],
        correct: 0
      }
    },
    {
      num: 5,
      title: 'Touch Controls',
      goal: 'Swipe detection for mobile play.',
      points: [
        'Track where the finger lands, compare on release',
        'Vertical swipe up = jump, horizontal = move',
        'Same input system, just a different event source'
      ],
      challenge: 'Write the touch handlers for mobile:',
      starter: '// Touch controls for mobile\nlet touchStart = null;\ncanvas.addEventListener("touchstart", function(e) {\n  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };\n  e.preventDefault();\n});\ncanvas.addEventListener("touchend", function(e) {\n  if (!touchStart) return;\n  let dx = e.changedTouches[0].clientX - touchStart.x;\n  let dy = e.changedTouches[0].clientY - touchStart.y;\n  // Swipe up = jump, swipe left/right = move\n  \n  touchStart = null;\n});',
      solution: 'let touchStart = null;\ncanvas.addEventListener("touchstart", function(e) {\n  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };\n  e.preventDefault();\n});\ncanvas.addEventListener("touchend", function(e) {\n  if (!touchStart) return;\n  let dx = e.changedTouches[0].clientX - touchStart.x;\n  let dy = e.changedTouches[0].clientY - touchStart.y;\n  if (Math.abs(dy) > 20 && dy < 0) {\n    jumpHeld = true; setTimeout(function(){ jumpHeld = false; }, 150);\n  } else if (Math.abs(dx) > 20) {\n    if (dx > 0) { rightHeld = true; setTimeout(function(){ rightHeld = false; }, 200); }\n    else { leftHeld = true; setTimeout(function(){ leftHeld = false; }, 200); }\n  }\n  touchStart = null;\n});',
      checks: ['touchstart', 'touchend', 'jumpheld'],
      height: 300,
      quiz: {
        question: 'Why use setTimeout to clear the movement flag instead of setting it immediately?',
        options: [
          'setTimeout is faster than direct assignment',
          'The player needs the input to last a few frames, otherwise the move is too brief to see',
          'Touch events can only fire once per second'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Victory & Polish',
      goal: 'Add a win check on the finish platform and visual polish.',
      points: [
        'Reaching the green finish platform triggers the win state',
        'A victory overlay shows time taken',
        'The same logic in Roblox uses <code>Touched:Connect</code> with a winners table'
      ],
      challenge: 'Write the finish-line check and victory display:',
      starter: '// Add to the draw function: check for win\nif (won) {\n  ctx.fillStyle = "rgba(0,0,0,.6)";\n  ctx.fillRect(0, 0, W, H);\n  ctx.fillStyle = "#48bb78";\n  ctx.font = "bold 28px system-ui";\n  ctx.textAlign = "center";\n  ctx.fillText("???", W/2, H/2 - 20);\n}',
      solution: 'if (won) {\n  ctx.fillStyle = "rgba(0,0,0,.6)";\n  ctx.fillRect(0, 0, W, H);\n  ctx.fillStyle = "#48bb78";\n  ctx.font = "bold 28px system-ui";\n  ctx.textAlign = "center";\n  ctx.fillText("YOU FINISHED!", W/2, H/2 - 20);\n  ctx.fillStyle = "#e8eaf2";\n  ctx.font = "16px system-ui";\n  let elapsed = Math.floor((Date.now() - startTime) / 1000);\n  ctx.fillText("Time: " + elapsed + "s", W/2, H/2 + 15);\n}',
      checks: ['you finished', 'filltext', 'elapsed'],
      height: 200,
      fills: {
        text: 'The Roblox version uses a ___ table to stop the same player winning twice. Our canvas uses a ___ boolean.',
        answers: ['winners', 'won']
      },
      quiz: {
        question: 'In the Roblox workshop, the finish script uses <code>winners[player.Name] = true</code>. This is needed because:',
        options: [
          'Lua requires tables for all variables',
          'The Touched event fires many times as the player walks, so the table prevents duplicate messages',
          'It stores the player\'s score'
        ],
        correct: 1
      }
    }
  ]
};
