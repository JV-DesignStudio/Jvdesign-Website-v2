'use strict';

/* ===================================================
   CORRUPTED: Neon Glitch Obby canvas
   A self-destructing neon runner with a chasing
   corruption wall. Each template runs standalone with
   its step solution plugged in as u.
   =================================================== */

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

var CSS_GLITCH = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0a0616;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#060310;border:2px solid #2a1545;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap;justify-content:center}</style>';

var HTML_GLITCH = '<div class="row"><span>Lives: <b id="lives">3</b></span><span>Shards: <b id="shards">0</b></span><span>Time: <b id="timer">0s</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Auto-runner demo: the runner moves on its own, arrow keys work too</div>';

var SETUP_GLITCH = [
  'var canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'var W=600,H=400,GRAVITY=0.5,JUMP=-10,SPEED=2.2;',
  'var player={x:40,y:100,w:16,h:24,vx:0,vy:0,onGround:false,alive:true};',
  'var lives=3,shards=0,crumbled=0,startTime=Date.now(),won=false;',
  'var shardsArr=[],corruptionX=-80,flickerPhase=0,blades=[],autoJumpCd=0;',
  'var leftHeld=false,rightHeld=false,jumpHeld=false;',
  'function respawn(){player.x=40;player.y=100;player.vx=0;player.vy=0;player.alive=true;player.onGround=false;}'
].join('');

var PLATFORMS_GLITCH = [
  'var platforms=[',
  '{x:20,y:300,w:90,h:12,color:"#00e5ff",type:"start"},',
  '{x:150,y:280,w:44,h:10,color:"#00e5ff",type:"normal"},',
  '{x:230,y:260,w:44,h:10,color:"#ff2fd6",type:"normal"},',
  '{x:310,y:240,w:44,h:10,color:"#ff2fd6",type:"unstable"},',
  '{x:390,y:220,w:44,h:10,color:"#ff3131",type:"normal"},',
  '{x:470,y:200,w:44,h:10,color:"#ff3131",type:"unstable"},',
  '{x:540,y:180,w:50,h:12,color:"#48bb78",type:"finish"}',
  '];'
].join('');

var SHARDS_GLITCH = [
  'shardsArr=[{x:160,y:250,w:10,h:10},{x:240,y:230,w:10,h:10},{x:320,y:210,w:10,h:10},{x:400,y:190,w:10,h:10},{x:480,y:170,w:10,h:10}];'
].join('');

var BLADES_GLITCH = [
  'blades=[{x:270,y:200,angle:0,speed:0.08},{x:430,y:160,angle:0,speed:-0.06}];'
].join('');

var KEYS_GLITCH = [
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

var MOVE_GLITCH = [
  'function autoPlay(){if(!player.alive)return;player.vx=SPEED;',
  'var aheadX=player.x+player.w+16,footY=player.y+player.h+4,ground=false;',
  'for(var i=0;i<platforms.length;i++){var p=platforms[i];',
  'if(aheadX>p.x&&aheadX<p.x+p.w&&footY>=p.y&&footY<=p.y+30){ground=true;break}}',
  'if(!ground&&player.onGround&&autoJumpCd<=0){player.vy=JUMP;player.onGround=false;autoJumpCd=25}',
  'if(autoJumpCd>0)autoJumpCd--;}',

  'function movePlayer(){if(!player.alive)return;',
  'if(leftHeld)player.vx=-4;else if(rightHeld)player.vx=4;',
  'if((jumpHeld)&&player.onGround){player.vy=JUMP;player.onGround=false}',
  'player.vy+=GRAVITY;player.x+=player.vx;player.y+=player.vy;',
  'if(player.x<0)player.x=0;if(player.x+player.w>W)player.x=W-player.w;',
  'player.onGround=false;',
  'for(var i=0;i<platforms.length;i++){var p=platforms[i];',
  'if(player.vy>=0&&player.x+player.w>p.x&&player.x<p.x+p.w&&',
  'player.y+player.h>=p.y&&player.y+player.h<=p.y+p.h+player.vy+2){',
  'player.y=p.y-player.h;player.vy=0;player.onGround=true;',
  'if(p.type==="finish"&&!won){won=true}}}',
  'if(player.y>H&&player.alive){player.alive=false;lives--;',
  'document.getElementById("lives").textContent=lives;',
  'if(lives>0)setTimeout(respawn,800);}}'
].join('');

var DRAW_GLITCH = [
  'function drawBase(){',
  'ctx.fillStyle="#060310";ctx.fillRect(0,0,W,H);',
  'var i,p;',
  'for(i=0;i<platforms.length;i++){p=platforms[i];',
  'var alpha=1;',
  'if(p.type==="unstable"&&flickerPhase>0)alpha=0.4+0.6*Math.abs(Math.sin(flickerPhase));',
  'ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor=p.color;ctx.shadowBlur=10;',
  'ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.w,p.h);ctx.restore();',
  'if(p.type==="finish"){ctx.fillStyle="rgba(72,187,120,.9)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText("ESCAPE",p.x+p.w/2,p.y-4)}}',
  'for(i=0;i<shardsArr.length;i++){p=shardsArr[i];',
  'ctx.save();ctx.shadowColor="#7bf1a8";ctx.shadowBlur=12;ctx.fillStyle="#7bf1a8";',
  'ctx.fillRect(p.x,p.y,p.w,p.h);ctx.restore();}',
  'for(i=0;i<blades.length;i++){var b=blades[i];',
  'ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);',
  'ctx.shadowColor="#ff2fd6";ctx.shadowBlur=14;ctx.fillStyle="#ff2fd6";',
  'ctx.fillRect(-22,-3,44,6);ctx.fillRect(-3,-22,6,44);ctx.restore();}',
  'if(player.alive){',
  'ctx.save();ctx.shadowColor="rgba(0,229,255,.9)";ctx.shadowBlur=12;',
  'ctx.fillStyle="#00e5ff";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(player.x+4,player.y+6,4,4);ctx.fillRect(player.x+10,player.y+6,4,4);}',
  'else{ctx.save();ctx.fillStyle="rgba(255,47,214,.18)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="rgba(0,229,255,.5)";',
  'for(var g=0;g<8;g++){ctx.fillRect(Math.random()*W,Math.random()*H,60+Math.random()*120,3)}',
  'ctx.restore();}',
  'if(corruptionX>-40){',
  'var grad=ctx.createLinearGradient(corruptionX-70,0,corruptionX,0);',
  'grad.addColorStop(0,"rgba(255,47,214,0)");grad.addColorStop(1,"rgba(255,47,214,.85)");',
  'ctx.fillStyle=grad;ctx.fillRect(corruptionX-70,0,70,H);',
  'ctx.fillStyle="#ff2fd6";ctx.fillRect(corruptionX-4,0,8,H);}}'
].join('');

var COMPLETE_ZONES = [
  'function drawZones(){',
  'ctx.fillStyle="rgba(0,229,255,.10)";ctx.fillRect(0,0,200,H);',
  'ctx.fillStyle="rgba(255,47,214,.10)";ctx.fillRect(200,0,200,H);',
  'ctx.fillStyle="rgba(255,49,49,.12)";ctx.fillRect(400,0,200,H);',
  'ctx.fillStyle="rgba(232,234,242,.55)";ctx.font="bold 10px system-ui";ctx.textAlign="center";',
  'ctx.fillText("Boot Sequence",100,20);',
  'ctx.fillText("Memory Lane",300,20);',
  'ctx.fillText("Kernel Panic",500,20);}'
].join('');

var COMPLETE_SHARDS = [
  'function collectShards(){',
  'for(var i=shardsArr.length-1;i>=0;i--){var s=shardsArr[i];',
  'if(player.alive&&player.x+player.w>s.x&&player.x<s.x+s.w&&player.y+player.h>s.y&&player.y<s.y+s.h){',
  'shardsArr.splice(i,1);shards++;document.getElementById("shards").textContent=shards;}}}'
].join('');

var COMPLETE_CRUMBLE = [
  'function crumblePlatforms(){',
  'for(var i=platforms.length-1;i>=0;i--){',
  'if(platforms[i].x+platforms[i].w<player.x&&platforms[i].type==="normal"){',
  'platforms.splice(i,1);crumbled++;}}}'
].join('');

var COMPLETE_CORRUPTION = [
  'function moveCorruption(){',
  'corruptionX+=0.35;',
  'if(corruptionX>W+40)corruptionX=-80;',
  'if(player.alive&&player.x<corruptionX){',
  'player.alive=false;lives--;document.getElementById("lives").textContent=lives;',
  'if(lives>0)setTimeout(respawn,800);}}'
].join('');

var COMPLETE_SPIN = [
  'function spinBlades(){',
  'for(var i=0;i<blades.length;i++){blades[i].angle+=blades[i].speed;',
  'if(player.alive&&Math.abs(player.x+8-blades[i].x)<16&&Math.abs(player.y+12-blades[i].y)<16){',
  'player.alive=false;lives--;document.getElementById("lives").textContent=lives;',
  'if(lives>0)setTimeout(respawn,800);}}',
  'flickerPhase+=0.1;}'
].join('');

/* ===================================================
   CW_CONFIG - Corruption Obby canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-corruption-obby-canvas',
  downloadName: 'my-corruption-obby.html',

  hints: [
    'Paint the three neon zones across the world',
    'Pick up every shard on touch, count each once',
    'Delete normal platforms once the runner passes them',
    'Slide the corruption wall forward, glitch whoever it touches',
    'Spin the blades and flicker the unstable platforms',
    'Count up the timer and crown the escape with shards and time'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_GLITCH, HTML_GLITCH,
        SETUP_GLITCH + PLATFORMS_GLITCH + KEYS_GLITCH + MOVE_GLITCH +
        DRAW_GLITCH + 'try{' + u + '}catch(e){}' +
        'function loop(){autoPlay();movePlayer();if(typeof drawZones==="function")drawZones();drawBase();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_GLITCH, HTML_GLITCH,
        SETUP_GLITCH + PLATFORMS_GLITCH + SHARDS_GLITCH + KEYS_GLITCH + MOVE_GLITCH + COMPLETE_ZONES +
        DRAW_GLITCH + 'try{' + u + '}catch(e){}' +
        'function loop(){autoPlay();movePlayer();drawZones();if(typeof collectShards==="function")collectShards();drawBase();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_GLITCH, HTML_GLITCH,
        SETUP_GLITCH + PLATFORMS_GLITCH + SHARDS_GLITCH + KEYS_GLITCH + MOVE_GLITCH + COMPLETE_ZONES + COMPLETE_SHARDS +
        DRAW_GLITCH + 'try{' + u + '}catch(e){}' +
        'function loop(){autoPlay();movePlayer();drawZones();collectShards();if(typeof crumblePlatforms==="function")crumblePlatforms();drawBase();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_GLITCH, HTML_GLITCH,
        SETUP_GLITCH + PLATFORMS_GLITCH + SHARDS_GLITCH + KEYS_GLITCH + MOVE_GLITCH + COMPLETE_ZONES + COMPLETE_SHARDS + COMPLETE_CRUMBLE +
        DRAW_GLITCH + 'try{' + u + '}catch(e){}' +
        'function loop(){autoPlay();movePlayer();drawZones();collectShards();crumblePlatforms();if(typeof moveCorruption==="function")moveCorruption();drawBase();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_GLITCH, HTML_GLITCH,
        SETUP_GLITCH + PLATFORMS_GLITCH + SHARDS_GLITCH + BLADES_GLITCH + KEYS_GLITCH + MOVE_GLITCH + COMPLETE_ZONES + COMPLETE_SHARDS + COMPLETE_CRUMBLE + COMPLETE_CORRUPTION +
        DRAW_GLITCH + 'try{' + u + '}catch(e){}' +
        'function loop(){autoPlay();movePlayer();drawZones();collectShards();crumblePlatforms();moveCorruption();if(typeof spinBlades==="function")spinBlades();drawBase();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_GLITCH, HTML_GLITCH,
        SETUP_GLITCH + PLATFORMS_GLITCH + SHARDS_GLITCH + BLADES_GLITCH + KEYS_GLITCH + MOVE_GLITCH + COMPLETE_ZONES + COMPLETE_SHARDS + COMPLETE_CRUMBLE + COMPLETE_CORRUPTION + COMPLETE_SPIN +
        DRAW_GLITCH + 'try{' + u + '}catch(e){}' +
        'function loop(){autoPlay();movePlayer();drawZones();collectShards();crumblePlatforms();moveCorruption();spinBlades();if(typeof drawTimer==="function")drawTimer();drawBase();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'The Failing Simulation',
      goal: 'Understand the mechanic, set up the world and write the Config of zones.',
      points: [
        'The world deletes itself behind you as you run',
        'Three neon zones: Boot Sequence, Memory Lane, Kernel Panic',
        'Each zone paints its third of the sky'
      ],
      challenge: 'Write the painter for the three neon zones:',
      starter: '// Paint the three neon zones across the world\nfunction drawZones() {\n  ctx.fillStyle = "rgba(0,229,255,.10)";\n  ctx.fillRect(0, 0, 200, H);\n  ctx.fillStyle = "rgba(255,47,214,.10)";\n  ctx.fillRect(200, 0, 200, H);\n  ctx.fillStyle = "rgba(255,49,49,.12)";\n  ctx.fillRect(400, 0, 200, H);\n  ctx.fillStyle = "rgba(232,234,242,.55)";\n  ctx.font = "bold 10px system-ui";\n  ctx.textAlign = "center";\n  ctx.fillText(???);\n  ctx.fillText(???);\n  ctx.fillText(???);\n}',
      solution: 'function drawZones() {\n  ctx.fillStyle = "rgba(0,229,255,.10)";\n  ctx.fillRect(0, 0, 200, H);\n  ctx.fillStyle = "rgba(255,47,214,.10)";\n  ctx.fillRect(200, 0, 200, H);\n  ctx.fillStyle = "rgba(255,49,49,.12)";\n  ctx.fillRect(400, 0, 200, H);\n  ctx.fillStyle = "rgba(232,234,242,.55)";\n  ctx.font = "bold 10px system-ui";\n  ctx.textAlign = "center";\n  ctx.fillText("Boot Sequence", 100, 20);\n  ctx.fillText("Memory Lane", 300, 20);\n  ctx.fillText("Kernel Panic", 500, 20);\n}',
      checks: ['boot sequence', 'memory lane', 'kernel panic'],
      height: 280,
      fills: {
        text: 'Three ___: Boot Sequence, Memory Lane, Kernel Panic, each a third of the sky.',
        answers: ['zones']
      },
      quiz: {
        question: 'The Corruption wall in the full game is:',
        options: [
          'A wall of glitch that slides forward and kills on touch',
          'A wall you climb for bonus shards',
          'A wall of text with the rules'
        ],
        correct: 0
      }
    },
    {
      num: 2,
      title: 'Data Shards',
      goal: 'Scatter glowing collectibles that count exactly once each.',
      points: [
        'Five shards float above the course',
        'Touching one removes it and adds to the counter',
        'Walking backwards counts finished loops, so removal matters'
      ],
      challenge: 'Write the pickup check for the shards:',
      starter: '// Pick up every shard on touch, count each once\nfunction collectShards() {\n  for (var i = shardsArr.length - 1; i >= 0; i--) {\n    var s = shardsArr[i];\n    if (player.alive && player.x + player.w > s.x && player.x < s.x + s.w &&\n        player.y + player.h > s.y && player.y < s.y + s.h) {\n      shardsArr.splice(???);\n      shards++;\n      document.getElementById("shards").textContent = shards;\n    }\n  }\n}',
      solution: 'function collectShards() {\n  for (var i = shardsArr.length - 1; i >= 0; i--) {\n    var s = shardsArr[i];\n    if (player.alive && player.x + player.w > s.x && player.x < s.x + s.w &&\n        player.y + player.h > s.y && player.y < s.y + s.h) {\n      shardsArr.splice(i, 1);\n      shards++;\n      document.getElementById("shards").textContent = shards;\n    }\n  }\n}',
      checks: ['splice', 'shards++', 'shardsarr'],
      height: 260,
      fills: {
        text: 'Taken shards leave the list through ___, so each counts exactly once.',
        answers: ['splice']
      },
      quiz: {
        question: 'CollectionService tags in Roblox Studio are for:',
        options: [
          'Finding every shard with one tag instead of naming each part',
          'Making shards shinier',
          'Deleting shards at random'
        ],
        correct: 0
      }
    },
    {
      num: 3,
      title: 'Self-Destructing Platforms',
      goal: 'The world deletes itself behind you as you run.',
      points: [
        'Only normal platforms crumble, never start or finish',
        'A platform counts as passed once fully behind the runner',
        'The crumbled counter proves the world is unravelling'
      ],
      challenge: 'Write the crumble for passed platforms:',
      starter: '// Delete normal platforms once the runner passes them\nfunction crumblePlatforms() {\n  for (var i = platforms.length - 1; i >= 0; i--) {\n    if (platforms[i].x + platforms[i].w < player.x && platforms[i].type === ???) {\n      platforms.splice(i, 1);\n      crumbled++;\n    }\n  }\n}',
      solution: 'function crumblePlatforms() {\n  for (var i = platforms.length - 1; i >= 0; i--) {\n    if (platforms[i].x + platforms[i].w < player.x && platforms[i].type === "normal") {\n      platforms.splice(i, 1);\n      crumbled++;\n    }\n  }\n}',
      checks: ['splice', 'crumbled', 'normal'],
      height: 220,
      fills: {
        text: 'Passed platforms are ___ from the list, so there is no going back.',
        answers: ['deleted']
      },
      quiz: {
        question: 'Deleting the world behind the player means:',
        options: [
          'No going back: keep moving forward or fall',
          'The game runs twice as fast',
          'You fall at once'
        ],
        correct: 0
      }
    },
    {
      num: 4,
      title: 'The Corruption Zone',
      goal: 'A wall of pure glitch that slides forward and kills on touch.',
      points: [
        'The wall starts off screen and slides right every frame',
        'Touching it glitches the screen and costs a life',
        'Respawn puts you at the start, but the wall keeps coming'
      ],
      challenge: 'Write the wall advance and its touch kill:',
      starter: '// Slide the wall forward, glitch whoever it touches\nfunction moveCorruption() {\n  corruptionX += 0.35;\n  if (corruptionX > W + 40) corruptionX = -80;\n  if (player.alive && player.x < corruptionX) {\n    player.alive = false;\n    lives--;\n    document.getElementById("lives").textContent = lives;\n    if (lives > 0) setTimeout(???, 800);\n  }\n}',
      solution: 'function moveCorruption() {\n  corruptionX += 0.35;\n  if (corruptionX > W + 40) corruptionX = -80;\n  if (player.alive && player.x < corruptionX) {\n    player.alive = false;\n    lives--;\n    document.getElementById("lives").textContent = lives;\n    if (lives > 0) setTimeout(respawn, 800);\n  }\n}',
      checks: ['corruptionx', 'lives--', 'respawn'],
      height: 240,
      fills: {
        text: 'A touch costs a life and triggers a ___, while the wall never waits.',
        answers: ['respawn']
      },
      quiz: {
        question: 'Respawning at the start while the wall keeps sliding means:',
        options: [
          'Deaths are free',
          'Every death costs time, so slow runners get caught again',
          'The wall resets too'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Corrupted Obstacles',
      goal: 'Spinning neon blades and flickering unstable platforms.',
      points: [
        'Two blades spin in place, angle growing every frame',
        'Touching a blade costs a life like the wall does',
        'Unstable platforms flicker to warn they cannot be trusted'
      ],
      challenge: 'Write the blade spin and the touch kill:',
      starter: '// Spin the blades, kill on touch, flicker the unstable\nfunction spinBlades() {\n  for (var i = 0; i < blades.length; i++) {\n    blades[i].angle += blades[i].speed;\n    if (player.alive && Math.abs(player.x + 8 - blades[i].x) < 16 &&\n        Math.abs(player.y + 12 - blades[i].y) < 16) {\n      player.alive = false;\n      lives--;\n      document.getElementById("lives").textContent = lives;\n      if (lives > 0) setTimeout(respawn, 800);\n    }\n  }\n  flickerPhase += ???;\n}',
      solution: 'function spinBlades() {\n  for (var i = 0; i < blades.length; i++) {\n    blades[i].angle += blades[i].speed;\n    if (player.alive && Math.abs(player.x + 8 - blades[i].x) < 16 &&\n        Math.abs(player.y + 12 - blades[i].y) < 16) {\n      player.alive = false;\n      lives--;\n      document.getElementById("lives").textContent = lives;\n      if (lives > 0) setTimeout(respawn, 800);\n    }\n  }\n  flickerPhase += 0.1;\n}',
      checks: ['angle', 'flickerphase', 'lives--'],
      height: 280,
      fills: {
        text: 'Blades spin by angle, and unstable platforms ___ to warn you off them.',
        answers: ['flicker']
      },
      quiz: {
        question: 'Flickering unstable platforms warn the player because:',
        options: [
          'Flashing looks cool',
          'Unstable ground flashes before it can be trusted, so eyes learn the danger',
          'Flashing pauses the game'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Speed Timer and Publish',
      goal: 'Add a live timer HUD, tweak difficulty and publish the game.',
      points: [
        'The clock counts up from the run start',
        'Reaching ESCAPE freezes the win banner with shards and time',
        'Faster runs and more shards mean a better leaderboard line'
      ],
      challenge: 'Write the timer HUD and the win banner:',
      starter: '// Count up the timer, crown the escape\nfunction drawTimer() {\n  var elapsed = Math.floor((Date.now() - startTime) / 1000);\n  document.getElementById("timer").textContent = elapsed + "s";\n  if (won) {\n    ctx.fillStyle = "rgba(0,0,0,.6)";\n    ctx.fillRect(0, 0, W, H);\n    ctx.fillStyle = "#48bb78";\n    ctx.font = "bold 26px system-ui";\n    ctx.textAlign = "center";\n    ctx.fillText(???);\n    ctx.fillStyle = "#e8eaf2";\n    ctx.font = "15px system-ui";\n    ctx.fillText("Shards: " + shards + "  Time: " + elapsed + "s", W / 2, H / 2 + 18);\n  }\n}',
      solution: 'function drawTimer() {\n  var elapsed = Math.floor((Date.now() - startTime) / 1000);\n  document.getElementById("timer").textContent = elapsed + "s";\n  if (won) {\n    ctx.fillStyle = "rgba(0,0,0,.6)";\n    ctx.fillRect(0, 0, W, H);\n    ctx.fillStyle = "#48bb78";\n    ctx.font = "bold 26px system-ui";\n    ctx.textAlign = "center";\n    ctx.fillText("ESCAPED!", W / 2, H / 2 - 10);\n    ctx.fillStyle = "#e8eaf2";\n    ctx.font = "15px system-ui";\n    ctx.fillText("Shards: " + shards + "  Time: " + elapsed + "s", W / 2, H / 2 + 18);\n  }\n}',
      checks: ['elapsed', 'escaped', 'shards'],
      height: 280,
      fills: {
        text: 'The timer counts up from run start, and the banner pairs shards with ___.',
        answers: ['time']
      },
      quiz: {
        question: 'Before publishing the obby for friends, the last check is:',
        options: [
          'Add three more zones',
          'Escape once alive: finish with shards on the clock and no errors',
          'Delete the timer'
        ],
        correct: 1
      }
    }
  ]
};
