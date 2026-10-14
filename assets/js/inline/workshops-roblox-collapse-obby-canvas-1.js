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
   IFRAME BUILDING BLOCKS (Collapse Obby simulation)
   =================================================== */

var CSS_COLLAPSE = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}label{cursor:pointer}</style>';

var CANVAS_COLLAPSE = '<div class="row"><span>Lives: <b id="lives">3</b></span><span>Time: <b id="timer">0s</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to move &middot; Space to jump &middot; Platforms crumble!</div>';

var SETUP_COLLAPSE = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400,GRAVITY=0.5,JUMP=-10,SPEED=4;',
  'let player={x:40,y:100,w:16,h:24,vx:0,vy:0,onGround:false,alive:true};',
  'let lives=3,startTime=Date.now(),won=false;',
  'let leftHeld=false,rightHeld=false,jumpHeld=false;'
].join('');

var PLATFORMS_COLLAPSE = [
  'let platforms=[',
  '{x:20,y:300,w:80,h:12,color:"#718096",type:"safe",opacity:1,timer:-1,crumbling:false},',
  '{x:140,y:280,w:40,h:10,color:"#63b3ed",type:"crumble",opacity:1,timer:-1,crumbling:false},',
  '{x:220,y:255,w:35,h:10,color:"#68d391",type:"crumble",opacity:1,timer:-1,crumbling:false},',
  '{x:290,y:235,w:45,h:10,color:"#f6ad55",type:"crumble",opacity:1,timer:-1,crumbling:false},',
  '{x:370,y:260,w:35,h:10,color:"#fc8181",type:"crumble",opacity:1,timer:-1,crumbling:false},',
  '{x:430,y:230,w:50,h:12,color:"#9f7aea",type:"safe",opacity:1,timer:-1,crumbling:false},',
  '{x:510,y:210,w:40,h:10,color:"#f687b3",type:"crumble",opacity:1,timer:-1,crumbling:false},',
  '{x:560,y:180,w:30,h:10,color:"#68d391",type:"crumble",opacity:1,timer:-1,crumbling:false},',
  '{x:490,y:150,w:60,h:12,color:"#48bb78",type:"finish",opacity:1,timer:-1,crumbling:false}',
  '];'
].join('');

var LAVA_FLOOR_COLLAPSE = 'let lavaY=380;';

var KEYS_COLLAPSE = [
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

var MOVE_PLAYER_COLLAPSE = [
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
  'if(p.opacity<=0)continue;',
  'if(player.vy>=0&&player.x+player.w>p.x&&player.x<p.x+p.w&&',
  'player.y+player.h>=p.y&&player.y+player.h<=p.y+p.h+player.vy+2){',
  'player.y=p.y-player.h;player.vy=0;player.onGround=true;',
  'if(p.type==="finish"&&!won){won=true}',
  'if(p.type==="crumble"&&!p.crumbling){p.crumbling=true;p.timer=Date.now()}',
  '}}',
  '}'
].join('');

var CRUMBLE_UPDATE = [
  'function updateCrumble(){',
  'for(let i=0;i<platforms.length;i++){let p=platforms[i];',
  'if(p.crumbling&&p.opacity>0){',
  'let elapsed=(Date.now()-p.timer)/1000;',
  'if(elapsed<0.5){p.opacity=1-elapsed*0.4}',
  'else if(elapsed<1.2){p.opacity=Math.max(0,1-(elapsed-0.2)*1.2)}',
  'else{p.opacity=0}',
  '}}}'
].join('');

var RESPAWN_COLLAPSE = [
  'function respawn(){',
  'player.x=40;player.y=100;player.vx=0;player.vy=0;player.alive=true;player.onGround=false;',
  'for(let i=0;i<platforms.length;i++){let p=platforms[i];p.opacity=1;p.crumbling=false;p.timer=-1}',
  '}'
].join('');

var LAVA_CHECK_COLLAPSE = [
  'function checkLava(){',
  'if(player.y+player.h>=lavaY&&player.alive){',
  'player.alive=false;lives--;',
  'document.getElementById("lives").textContent=lives;',
  'if(lives>0)setTimeout(respawn,800);',
  '}}'
].join('');

var DRAW_BG_COLLAPSE = 'CWArt.bg(ctx,W,H,"#1a1c2e","#0d0f1a");CWArt.grid(ctx,W,H,40);';

var DRAW_PLATFORMS_COLLAPSE = [
  'for(let i=0;i<platforms.length;i++){let p=platforms[i];',
  'if(p.opacity<=0)continue;',
  'ctx.save();ctx.globalAlpha=p.opacity;',
  'ctx.shadowColor=p.color;ctx.shadowBlur=p.type==="finish"?16:p.type==="safe"?12:8;',
  'ctx.fillStyle=p.color;CWArt.roundRect(ctx,p.x,p.y,p.w,p.h,4);ctx.fill();ctx.restore();',
  'if(p.type==="safe"&&p.opacity>0.5){ctx.fillStyle="rgba(255,255,255,.6)";ctx.font="bold 7px system-ui";ctx.textAlign="center";ctx.fillText("SAFE",p.x+p.w/2,p.y-3)}',
  'if(p.type==="finish"){ctx.fillStyle="rgba(72,187,120,.9)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("FINISH",p.x+p.w/2,p.y-4)}',
  'if(p.crumbling&&p.opacity>0.1){ctx.fillStyle="rgba(255,100,100,"+((1-p.opacity)*0.6)+")";ctx.fillRect(p.x,p.y,p.w*p.opacity,2)}',
  '}'
].join('');

var DRAW_PLAYER_COLLAPSE = [
  'if(player.alive){',
  'ctx.save();ctx.shadowColor="rgba(99,179,237,.9)";ctx.shadowBlur=12;',
  'ctx.fillStyle="#63b3ed";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(player.x+4,player.y+6,4,4);ctx.fillRect(player.x+10,player.y+6,4,4);',
  '}'
].join('');

var DRAW_LAVA_COLLAPSE = [
  'ctx.save();ctx.shadowColor="rgba(245,101,101,.8)";ctx.shadowBlur=20;',
  'ctx.fillStyle="#f56565";ctx.fillRect(0,lavaY,W,H-lavaY);ctx.restore();',
  'for(let i=0;i<W;i+=20){let h=4+Math.sin((Date.now()/200)+i)*3;',
  'ctx.fillStyle="rgba(255,160,0,.6)";ctx.fillRect(i,lavaY-h,10,h)}'
].join('');

var DRAW_HUD_COLLAPSE = [
  'document.getElementById("lives").textContent=lives;',
  'let elapsed=Math.floor((Date.now()-startTime)/1000);',
  'document.getElementById("timer").textContent=elapsed+"s";',
  'if(won){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#48bb78";ctx.font="bold 28px system-ui";ctx.textAlign="center";',
  'ctx.fillText("YOU ESCAPED!",W/2,H/2-20);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("Time: "+elapsed+"s",W/2,H/2+15)}'
].join('');

var DRAW_CRUMBLE_WARNING = [
  'for(let i=0;i<platforms.length;i++){let p=platforms[i];',
  'if(p.crumbling&&p.opacity>0.1&&p.opacity<0.8){',
  'ctx.save();ctx.globalAlpha=Math.sin(Date.now()/60)*0.4+0.4;',
  'ctx.strokeStyle="#ff4444";ctx.lineWidth=2;ctx.strokeRect(p.x-1,p.y-1,p.w+2,p.h+2);',
  'ctx.restore()}}'
].join('');

var TOUCH_COLLAPSE = [
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
   CW_CONFIG - Collapse Obby canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-collapse-obby-canvas',
  downloadName: 'my-collapse-obby.html',

  hints: [
    'Arrow keys to move, Space to jump onto the platforms',
    'Platforms shake and fade when you land on them!',
    'Move quickly - crumbling platforms disappear in about 1 second',
    'SAFE platforms (labelled) never crumble - plan your route',
    'The timer shows how long you have been running',
    'Reach the green FINISH platform before everything crumbles!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_COLLAPSE, CANVAS_COLLAPSE,
        SETUP_COLLAPSE + PLATFORMS_COLLAPSE + KEYS_COLLAPSE + RESPAWN_COLLAPSE +
        'function draw(){' + DRAW_BG_COLLAPSE + DRAW_PLATFORMS_COLLAPSE + DRAW_PLAYER_COLLAPSE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_COLLAPSE, CANVAS_COLLAPSE,
        SETUP_COLLAPSE + PLATFORMS_COLLAPSE + LAVA_FLOOR_COLLAPSE + KEYS_COLLAPSE + RESPAWN_COLLAPSE +
        MOVE_PLAYER_COLLAPSE +
        'function draw(){' + DRAW_BG_COLLAPSE + DRAW_LAVA_COLLAPSE + DRAW_PLATFORMS_COLLAPSE + DRAW_PLAYER_COLLAPSE + DRAW_HUD_COLLAPSE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();if(typeof checkLava==="function")checkLava();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_COLLAPSE, CANVAS_COLLAPSE,
        SETUP_COLLAPSE + PLATFORMS_COLLAPSE + LAVA_FLOOR_COLLAPSE + KEYS_COLLAPSE + RESPAWN_COLLAPSE +
        MOVE_PLAYER_COLLAPSE + LAVA_CHECK_COLLAPSE +
        'function draw(){' + DRAW_BG_COLLAPSE + DRAW_LAVA_COLLAPSE + DRAW_PLATFORMS_COLLAPSE + DRAW_CRUMBLE_WARNING + DRAW_PLAYER_COLLAPSE + DRAW_HUD_COLLAPSE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();if(typeof updateCrumble==="function")updateCrumble();checkLava();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_COLLAPSE, CANVAS_COLLAPSE,
        SETUP_COLLAPSE + PLATFORMS_COLLAPSE + LAVA_FLOOR_COLLAPSE + KEYS_COLLAPSE + RESPAWN_COLLAPSE +
        MOVE_PLAYER_COLLAPSE + LAVA_CHECK_COLLAPSE + CRUMBLE_UPDATE +
        'function draw(){' + DRAW_BG_COLLAPSE + DRAW_LAVA_COLLAPSE + DRAW_PLATFORMS_COLLAPSE + DRAW_CRUMBLE_WARNING + DRAW_PLAYER_COLLAPSE + DRAW_HUD_COLLAPSE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();updateCrumble();checkLava();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_COLLAPSE, CANVAS_COLLAPSE,
        SETUP_COLLAPSE + PLATFORMS_COLLAPSE + LAVA_FLOOR_COLLAPSE + KEYS_COLLAPSE + RESPAWN_COLLAPSE +
        MOVE_PLAYER_COLLAPSE + LAVA_CHECK_COLLAPSE + CRUMBLE_UPDATE +
        'function draw(){' + DRAW_BG_COLLAPSE + DRAW_LAVA_COLLAPSE + DRAW_PLATFORMS_COLLAPSE + DRAW_CRUMBLE_WARNING + DRAW_PLAYER_COLLAPSE + DRAW_HUD_COLLAPSE + '}' +
        TOUCH_COLLAPSE + u +
        'function loop(){movePlayer();updateCrumble();checkLava();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_COLLAPSE, CANVAS_COLLAPSE,
        SETUP_COLLAPSE + PLATFORMS_COLLAPSE + LAVA_FLOOR_COLLAPSE + KEYS_COLLAPSE + RESPAWN_COLLAPSE +
        MOVE_PLAYER_COLLAPSE + LAVA_CHECK_COLLAPSE + CRUMBLE_UPDATE + TOUCH_COLLAPSE +
        'function draw(){' + DRAW_BG_COLLAPSE + DRAW_LAVA_COLLAPSE + DRAW_PLATFORMS_COLLAPSE + DRAW_CRUMBLE_WARNING + DRAW_PLAYER_COLLAPSE + DRAW_HUD_COLLAPSE + '}' +
        u +
        'function loop(){movePlayer();updateCrumble();checkLava();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Platform Layout',
      goal: 'Set up the crumbling world with platforms, a player and basic rendering.',
      points: [
        'A row of coloured platforms stretching across the screen',
        'Each platform has an opacity, a crumble timer and a type',
        '"safe" platforms never crumble, "crumble" platforms fade when touched'
      ],
      challenge: 'Write the platform array with safe and crumble types:',
      starter: '// Create the platform layout\n// Each platform needs: x, y, w, h, color, type, opacity, timer, crumbling\nlet platforms = [\n  {x:20, y:300, w:80, h:12, color:"#718096", type:"???", opacity:1, timer:-1, crumbling:false},\n  {x:140, y:280, w:40, h:10, color:"#63b3ed", type:"???", opacity:1, timer:-1, crumbling:false},\n  {x:490, y:150, w:60, h:12, color:"#48bb78", type:"finish", opacity:1, timer:-1, crumbling:false}\n];',
      solution: 'let platforms = [\n  {x:20, y:300, w:80, h:12, color:"#718096", type:"safe", opacity:1, timer:-1, crumbling:false},\n  {x:140, y:280, w:40, h:10, color:"#63b3ed", type:"crumble", opacity:1, timer:-1, crumbling:false},\n  {x:490, y:150, w:60, h:12, color:"#48bb78", type:"finish", opacity:1, timer:-1, crumbling:false}\n];',
      checks: ['safe', 'crumble', 'finish'],
      height: 220,
      fills: {
        text: 'The start platform uses type ___ so it never disappears. Normal platforms use type ___ so they fade when touched.',
        answers: ['safe', 'crumble']
      },
      quiz: {
        question: 'In a collapse obby, what makes it different from a normal obby?',
        options: [
          'Players can fly between platforms',
          'Platforms crumble and disappear after you step on them, so you must keep moving',
          'Enemies chase the player backwards'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Player Movement & Gravity',
      goal: 'Add movement, gravity and platform collision with crumble triggering.',
      points: [
        'Arrow keys move left/right, Space jumps',
        'Gravity pulls the player down each frame',
        'Landing on a "crumble" platform starts its fade timer'
      ],
      challenge: 'Write the movement function that triggers crumbling on landing:',
      starter: '// Move player and start crumble when landing\nfunction movePlayer() {\n  if (!player.alive) return;\n  if (leftHeld) player.vx = -SPEED;\n  else if (rightHeld) player.vx = SPEED;\n  else player.vx *= 0.8;\n  if (jumpHeld && player.onGround) {\n    player.vy = JUMP;\n    player.onGround = false;\n  }\n  player.vy += GRAVITY;\n  player.x += player.vx; player.y += player.vy;\n  // Collision with platforms\n  for (let i = 0; i < platforms.length; i++) {\n    let p = platforms[i];\n    if (p.opacity <= 0) continue;\n    // ... collision check ...\n    // When landing on crumble type:\n    if (p.type === "???" && !p.crumbling) {\n      p.crumbling = ???;\n      p.timer = ???;\n    }\n  }\n}',
      solution: 'function movePlayer() {\n  if (!player.alive) return;\n  if (leftHeld) player.vx = -SPEED;\n  else if (rightHeld) player.vx = SPEED;\n  else player.vx *= 0.8;\n  if (jumpHeld && player.onGround) {\n    player.vy = JUMP;\n    player.onGround = false;\n  }\n  player.vy += GRAVITY;\n  player.x += player.vx; player.y += player.vy;\n  player.onGround = false;\n  for (let i = 0; i < platforms.length; i++) {\n    let p = platforms[i];\n    if (p.opacity <= 0) continue;\n    if (player.vy >= 0 && player.x + player.w > p.x && player.x < p.x + p.w &&\n      player.y + player.h >= p.y && player.y + player.h <= p.y + p.h + player.vy + 2) {\n      player.y = p.y - player.h; player.vy = 0; player.onGround = true;\n      if (p.type === "finish" && !won) { won = true; }\n      if (p.type === "crumble" && !p.crumbling) {\n        p.crumbling = true;\n        p.timer = Date.now();\n      }\n    }\n  }\n}',
      checks: ['crumble', 'crumbling', 'date.now'],
      height: 340,
      fills: {
        text: 'When the player lands on a crumble platform, we set crumbling to ___ and record the current time with ___.',
        answers: ['true', 'Date.now()']
      },
      quiz: {
        question: 'Why do we record Date.now() when the player lands on a crumble platform?',
        options: [
          'To know when to delete the player',
          'So we can calculate how long the platform has been crumbling and fade it smoothly',
          'To set the game speed'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'The Crumble Mechanic',
      goal: 'Make platforms fade out and disappear after the player touches them.',
      points: [
        'A timer counts how long since the player landed',
        'The platform\'s opacity fades from 1 to 0 over about 1 second',
        'Once opacity hits 0, the platform is gone and can\'t be stood on'
      ],
      challenge: 'Write the crumble update function:',
      starter: '// Update crumbling platforms each frame\nfunction updateCrumble() {\n  for (let i = 0; i < platforms.length; i++) {\n    let p = platforms[i];\n    if (p.crumbling && p.opacity > 0) {\n      let elapsed = (Date.now() - p.timer) / 1000;\n      // First 0.5s: slight fade (warning)\n      if (elapsed < 0.5) {\n        p.opacity = 1 - elapsed * ???;\n      }\n      // 0.5s to 1.2s: rapid fade\n      else if (elapsed < 1.2) {\n        p.opacity = Math.max(0, ???);\n      }\n      // Gone!\n      else {\n        p.opacity = ???;\n      }\n    }\n  }\n}',
      solution: 'function updateCrumble() {\n  for (let i = 0; i < platforms.length; i++) {\n    let p = platforms[i];\n    if (p.crumbling && p.opacity > 0) {\n      let elapsed = (Date.now() - p.timer) / 1000;\n      if (elapsed < 0.5) {\n        p.opacity = 1 - elapsed * 0.4;\n      }\n      else if (elapsed < 1.2) {\n        p.opacity = Math.max(0, 1 - (elapsed - 0.2) * 1.2);\n      }\n      else {\n        p.opacity = 0;\n      }\n    }\n  }\n}',
      checks: ['crumbling', 'opacity', 'elapsed'],
      height: 300,
      fills: {
        text: 'The crumble has two phases: a short ___ phase where it flickers, then a rapid ___ to zero opacity.',
        answers: ['warning', 'fade']
      },
      quiz: {
        question: 'In the Roblox workshop, the equivalent of our opacity fade uses:',
        options: [
          'TweenService to animate the Transparency property from 0 to 1 before setting Anchored = false',
          'A BodyVelocity to push the platform down',
          'A while loop that instantly deletes the platform'
        ],
        correct: 0
      }
    },
    {
      num: 4,
      title: 'Timer Display',
      goal: 'Show a live timer counting how long the player has survived.',
      points: [
        'A seconds counter at the top of the screen',
        'Lives display updates when the player falls in lava',
        'The timer gives the game its "how fast can you escape?" tension'
      ],
      challenge: 'Write the HUD that shows lives and elapsed time:',
      starter: '// Update the HUD display\ndocument.getElementById("lives").textContent = lives;\nlet elapsed = Math.floor((Date.now() - ???) / 1000);\ndocument.getElementById("timer").textContent = elapsed + "s";',
      solution: 'document.getElementById("lives").textContent = lives;\nlet elapsed = Math.floor((Date.now() - startTime) / 1000);\ndocument.getElementById("timer").textContent = elapsed + "s";',
      checks: ['starttime', 'elapsed', 'textcontent'],
      height: 120,
      fills: {
        text: 'The timer calculates seconds by subtracting ___ from Date.now(). In Roblox, we use ___ to measure run time.',
        answers: ['startTime', 'tick()']
      },
      quiz: {
        question: 'In the Roblox Collapse workshop, the 30-second timer is driven by:',
        options: [
          'The CollapseWall moving forward at COLLAPSE_SPEED studs per second',
          'A simple wait(30) that ends the game',
          'The number of platforms remaining'
        ],
        correct: 0
      }
    },
    {
      num: 5,
      title: 'Safe Platforms vs Crumbling',
      goal: 'Add clearly marked safe platforms that never crumble.',
      points: [
        'Safe platforms show a "SAFE" label and have a stronger glow',
        'They act as rest stops so the player can plan their next jumps',
        'In Roblox, the Safe Zone is where the collapse wall pauses'
      ],
      challenge: 'Write the drawing code that marks safe platforms differently:',
      starter: '// Draw platform labels\nfor (let i = 0; i < platforms.length; i++) {\n  let p = platforms[i];\n  if (p.type === "safe" && p.opacity > 0.5) {\n    ctx.fillStyle = "rgba(255,255,255,.6)";\n    ctx.font = "bold 7px system-ui";\n    ctx.textAlign = "center";\n    ctx.fillText("???", p.x + p.w/2, p.y - 3);\n  }\n}',
      solution: 'for (let i = 0; i < platforms.length; i++) {\n  let p = platforms[i];\n  if (p.type === "safe" && p.opacity > 0.5) {\n    ctx.fillStyle = "rgba(255,255,255,.6)";\n    ctx.font = "bold 7px system-ui";\n    ctx.textAlign = "center";\n    ctx.fillText("SAFE", p.x + p.w/2, p.y - 3);\n  }\n}',
      checks: ['safe', 'filltext', 'opacity'],
      height: 200,
      quiz: {
        question: 'In the Roblox version, the Safe Zone works because:',
        options: [
          'The collapse wall only starts moving after the player leaves the Safe Zone and touches Checkpoint1',
          'Safe Zone platforms are made of a special material',
          'The Safe Zone has invisible walls around it'
        ],
        correct: 0
      }
    },
    {
      num: 6,
      title: 'Win Condition & Polish',
      goal: 'Add victory detection, visual polish and touch controls.',
      points: [
        'Reaching the finish platform shows a victory screen with time',
        'Crumbling platforms flash red as a warning before they vanish',
        'Touch/swipe controls work on mobile devices'
      ],
      challenge: 'Write the victory overlay that shows when the player reaches the finish:',
      starter: '// Show victory when the player reaches the finish\nif (won) {\n  ctx.fillStyle = "rgba(0,0,0,.6)";\n  ctx.fillRect(0, 0, W, H);\n  ctx.fillStyle = "#48bb78";\n  ctx.font = "bold 28px system-ui";\n  ctx.textAlign = "center";\n  ctx.fillText("???", W/2, H/2 - 20);\n}',
      solution: 'if (won) {\n  ctx.fillStyle = "rgba(0,0,0,.6)";\n  ctx.fillRect(0, 0, W, H);\n  ctx.fillStyle = "#48bb78";\n  ctx.font = "bold 28px system-ui";\n  ctx.textAlign = "center";\n  ctx.fillText("YOU ESCAPED!", W/2, H/2 - 20);\n  ctx.fillStyle = "#e8eaf2";\n  ctx.font = "16px system-ui";\n  let elapsed = Math.floor((Date.now() - startTime) / 1000);\n  ctx.fillText("Time: " + elapsed + "s", W/2, H/2 + 15);\n}',
      checks: ['you escaped', 'filltext', 'elapsed'],
      height: 200,
      fills: {
        text: 'In the Roblox version, reaching the final checkpoint sets COLLAPSE_SPEED to ___ to stop the wall. The player\'s best time is saved with ___.',
        answers: ['0', 'DataStoreService']
      },
      quiz: {
        question: 'In the Roblox Collapse workshop, the finish script uses a "finished" table. Why?',
        options: [
          'To store the player\'s inventory',
          'The Touched event fires many times per second, so the table prevents the win code from running twice for the same player',
          'Roblox requires all variables to be in tables'
        ],
        correct: 1
      }
    }
  ]
};
