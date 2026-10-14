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
   IFRAME BUILDING BLOCKS (Roblox Pirate simulation)
   =================================================== */

var CSS_PIRATE = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}label{cursor:pointer}</style>';

var CANVAS_PIRATE = '<div class="row"><span>HP: <b id="hp">100</b></span><span>Gold: <b id="gold">0</b></span><span>Enemies: <b id="enemies">0</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to sail &middot; Space to fire cannons</div>';

var SETUP_PIRATE = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400,TURN=0.04,THRUST=0.15,FRICTION=0.98,BALL_SPEED=6;',
  'let ship={x:300,y:300,w:20,h:32,angle:-Math.PI/2,speed:0,hp:100,alive:true};',
  'let gold=0,won=false,canFire=true,cooldown=0;',
  'let upHeld=false,downHeld=false,leftHeld=false,rightHeld=false,fireHeld=false;',
  'let cannonballs=[];'
].join('');

var OCEAN_BASE = [
  'let waves=[];',
  'for(let i=0;i<60;i++){waves.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*3+1,s:Math.random()*0.005+0.002})}'
].join('');

var KEYS_PIRATE = [
  'document.addEventListener("keydown",function(e){',
  'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=true;',
  'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=true;',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;',
  'if(e.code==="Space"){fireHeld=true;e.preventDefault()}',
  '});',
  'document.addEventListener("keyup",function(e){',
  'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=false;',
  'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=false;',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false;',
  'if(e.code==="Space")fireHeld=false;',
  '});'
].join('');

var MOVE_SHIP = [
  'function moveShip(){',
  'if(!ship.alive)return;',
  'if(leftHeld)ship.angle-=TURN;',
  'if(rightHeld)ship.angle+=TURN;',
  'if(upHeld)ship.speed+=THRUST;',
  'if(downHeld)ship.speed-=THRUST*0.5;',
  'ship.speed*=FRICTION;',
  'if(ship.speed>4)ship.speed=4;if(ship.speed<-1)ship.speed=-1;',
  'ship.x+=Math.cos(ship.angle)*ship.speed;',
  'ship.y+=Math.sin(ship.angle)*ship.speed;',
  'if(ship.x<0)ship.x=W;if(ship.x>W)ship.x=0;',
  'if(ship.y<0)ship.y=H;if(ship.y>H)ship.y=0;',
  '}'
].join('');

var FIRE_CANNON = [
  'function fireCannon(){',
  'if(!ship.alive||!canFire||!fireHeld)return;',
  'canFire=false;cooldown=30;',
  'cannonballs.push({x:ship.x,y:ship.y,dx:Math.cos(ship.angle)*BALL_SPEED,dy:Math.sin(ship.angle)*BALL_SPEED,life:80,fromPlayer:true});',
  '}',
  'function updateBalls(){',
  'for(let i=cannonballs.length-1;i>=0;i--){let b=cannonballs[i];',
  'b.x+=b.dx;b.y+=b.dy;b.life--;',
  'if(b.life<=0||b.x<-10||b.x>W+10||b.y<-10||b.y>H+10){cannonballs.splice(i,1)}',
  '}}',
  'function updateCooldown(){if(!canFire){cooldown--;if(cooldown<=0)canFire=true}}'
].join('');

var ENEMIES_VARS = [
  'let enemies=[];',
  'function spawnEnemy(){',
  'let side=Math.floor(Math.random()*4);',
  'let ex=0,ey=0;',
  'if(side===0){ex=Math.random()*W;ey=-30}',
  'else if(side===1){ex=W+30;ey=Math.random()*H}',
  'else if(side===2){ex=Math.random()*W;ey=H+30}',
  'else{ex=-30;ey=Math.random()*H}',
  'enemies.push({x:ex,y:ey,angle:0,speed:0.6+Math.random()*0.4,hp:30,fireCd:0});',
  '}',
  'for(let i=0;i<3;i++)spawnEnemy();'
].join('');

var ENEMY_AI = [
  'function moveEnemies(){',
  'for(let i=0;i<enemies.length;i++){let e=enemies[i];',
  'let dx=ship.x-e.x,dy=ship.y-e.y;',
  'e.angle=Math.atan2(dy,dx);',
  'e.x+=Math.cos(e.angle)*e.speed;',
  'e.y+=Math.sin(e.angle)*e.speed;',
  'if(e.fireCd>0){e.fireCd--}else{',
  'e.fireCd=90+Math.floor(Math.random()*60);',
  'cannonballs.push({x:e.x,y:e.y,dx:Math.cos(e.angle)*3,dy:Math.sin(e.angle)*3,life:60,fromPlayer:false})',
  '}}}',
  'function checkBallHits(){',
  'for(let i=cannonballs.length-1;i>=0;i--){let b=cannonballs[i];',
  'if(b.fromPlayer){for(let j=enemies.length-1;j>=0;j--){let e=enemies[j];',
  'let dx=b.x-e.x,dy=b.y-e.y;',
  'if(Math.sqrt(dx*dx+dy*dy)<18){e.hp-=15;cannonballs.splice(i,1);',
  'if(e.hp<=0){enemies.splice(j,1);gold+=10;spawnEnemy()}break}',
  '}}else{',
  'let dx=b.x-ship.x,dy=b.y-ship.y;',
  'if(Math.sqrt(dx*dx+dy*dy)<16){ship.hp-=10;cannonballs.splice(i,1);',
  'if(ship.hp<=0){ship.alive=false}',
  '}}}}'
].join('');

var TREASURE_VARS = [
  'let treasures=[];',
  'function spawnTreasures(){',
  'let spots=[{x:80,y:60},{x:520,y:80},{x:500,y:340},{x:60,y:350},{x:300,y:50}];',
  'for(let i=0;i<spots.length;i++){treasures.push({x:spots[i].x,y:spots[i].y,collected:false})}',
  '}',
  'spawnTreasures();'
].join('');

var TREASURE_CHECK = [
  'function checkTreasure(){',
  'for(let i=0;i<treasures.length;i++){let t=treasures[i];',
  'if(!t.collected){',
  'let dx=ship.x-t.x,dy=ship.y-t.y;',
  'if(Math.sqrt(dx*dx+dy*dy)<20){t.collected=true;gold+=25}',
  '}}}'
].join('');

var DRAW_BG_PIRATE = [
  'CWArt.bg(ctx,W,H,"#0c2340","#061428");',
  'for(let i=0;i<waves.length;i++){let w=waves[i];',
  'ctx.fillStyle="rgba(30,90,160,"+(0.2+Math.sin(Date.now()*w.s)*0.15)+")";',
  'ctx.beginPath();ctx.arc(w.x,w.y,w.r,0,Math.PI*2);ctx.fill()}'
].join('');

var DRAW_SHIP = [
  'if(ship.alive){',
  'ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.angle+Math.PI/2);',
  'ctx.shadowColor="rgba(200,160,80,.8)";ctx.shadowBlur=12;',
  'ctx.fillStyle="#8B4513";ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(-10,14);ctx.lineTo(10,14);ctx.closePath();ctx.fill();',
  'ctx.fillStyle="#fff";ctx.fillRect(-1,-12,2,18);',
  'ctx.fillStyle="rgba(255,255,255,.85)";ctx.fillRect(-6,-10,12,8);',
  'ctx.restore();',
  '}'
].join('');

var DRAW_BALLS = [
  'for(let i=0;i<cannonballs.length;i++){let b=cannonballs[i];',
  'ctx.save();ctx.shadowColor=b.fromPlayer?"rgba(255,180,50,.9)":"rgba(255,80,80,.9)";ctx.shadowBlur=8;',
  'ctx.fillStyle=b.fromPlayer?"#ffa500":"#ff4444";',
  'ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.restore()}'
].join('');

var DRAW_ENEMIES = [
  'for(let i=0;i<enemies.length;i++){let e=enemies[i];',
  'ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle+Math.PI/2);',
  'ctx.shadowColor="rgba(255,80,80,.7)";ctx.shadowBlur=10;',
  'ctx.fillStyle="#8B0000";ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(-8,12);ctx.lineTo(8,12);ctx.closePath();ctx.fill();',
  'ctx.fillStyle="#222";ctx.fillRect(-1,-10,2,16);',
  'ctx.fillStyle="rgba(60,60,60,.8)";ctx.fillRect(-5,-8,10,7);',
  'ctx.restore();',
  'ctx.fillStyle="rgba(255,80,80,.8)";ctx.fillRect(e.x-12,e.y-20,24*(e.hp/30),3);',
  '}'
].join('');

var DRAW_TREASURES = [
  'for(let i=0;i<treasures.length;i++){let t=treasures[i];',
  'if(!t.collected){',
  'ctx.save();ctx.shadowColor="rgba(255,215,0,.9)";ctx.shadowBlur=14+Math.sin(Date.now()/300)*4;',
  'ctx.fillStyle="#ffd700";CWArt.roundRect(ctx,t.x-8,t.y-6,16,12,3);ctx.fill();',
  'ctx.fillStyle="#b8860b";ctx.fillRect(t.x-2,t.y-6,4,3);',
  'ctx.restore()}}'
].join('');

var DRAW_HUD_PIRATE = [
  'document.getElementById("hp").textContent=Math.max(0,ship.hp);',
  'document.getElementById("gold").textContent=gold;',
  'document.getElementById("enemies").textContent=enemies.length;',
  'if(!ship.alive&&!won){ctx.fillStyle="rgba(0,0,0,.65)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#f56565";ctx.font="bold 26px system-ui";ctx.textAlign="center";',
  'ctx.fillText("SHIP SUNK!",W/2,H/2-10);',
  'ctx.fillStyle="#e8eaf2";ctx.font="14px system-ui";',
  'ctx.fillText("Gold collected: "+gold,W/2,H/2+20)}'
].join('');

var WIN_CHECK = [
  'function checkWin(){',
  'let allCollected=true;',
  'for(let i=0;i<treasures.length;i++){if(!treasures[i].collected)allCollected=false}',
  'if(allCollected&&gold>=125&&!won){won=true}',
  '}'
].join('');

var DRAW_WIN = [
  'if(won){ctx.fillStyle="rgba(0,0,0,.65)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#ffd700";ctx.font="bold 28px system-ui";ctx.textAlign="center";',
  'ctx.fillText("TREASURE FOUND!",W/2,H/2-20);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("Gold: "+gold+" | Enemies sunk: "+(3-enemies.length+gold/10),W/2,H/2+15)}'
].join('');

var TOUCH_PIRATE = [
  'let touchStart=null;',
  'canvas.addEventListener("touchstart",function(e){touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault()});',
  'canvas.addEventListener("touchend",function(e){if(!touchStart)return;',
  'let dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;',
  'if(Math.abs(dx)<15&&Math.abs(dy)<15){fireHeld=true;setTimeout(function(){fireHeld=false},100)}',
  'else if(Math.abs(dy)>Math.abs(dx)){if(dy<0){upHeld=true;setTimeout(function(){upHeld=false},200)}',
  'else{downHeld=true;setTimeout(function(){downHeld=false},200)}}',
  'else{if(dx<0){leftHeld=true;setTimeout(function(){leftHeld=false},200)}',
  'else{rightHeld=true;setTimeout(function(){rightHeld=false},200)}}',
  'touchStart=null});'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

/* ===================================================
   CW_CONFIG - Roblox Pirate canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-pirate-canvas',
  downloadName: 'my-pirate-game.html',

  hints: [
    'Arrow keys to sail your ship across the ocean',
    'Hold Up to accelerate, Left/Right to turn',
    'Press Space to fire cannonballs ahead of your ship',
    'Enemy ships chase you and fire back, dodge their shots!',
    'Sail over golden chests to collect treasure',
    'Collect all treasure and survive to win!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_PIRATE, CANVAS_PIRATE,
        SETUP_PIRATE + OCEAN_BASE + KEYS_PIRATE +
        'function draw(){' + DRAW_BG_PIRATE + DRAW_SHIP + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_PIRATE, CANVAS_PIRATE,
        SETUP_PIRATE + OCEAN_BASE + KEYS_PIRATE +
        'function draw(){' + DRAW_BG_PIRATE + DRAW_SHIP + DRAW_HUD_PIRATE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){if(typeof moveShip==="function")moveShip();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_PIRATE, CANVAS_PIRATE,
        SETUP_PIRATE + OCEAN_BASE + KEYS_PIRATE +
        MOVE_SHIP +
        'function draw(){' + DRAW_BG_PIRATE + DRAW_BALLS + DRAW_SHIP + DRAW_HUD_PIRATE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){moveShip();if(typeof fireCannon==="function")fireCannon();if(typeof updateBalls==="function")updateBalls();if(typeof updateCooldown==="function")updateCooldown();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_PIRATE, CANVAS_PIRATE,
        SETUP_PIRATE + OCEAN_BASE + KEYS_PIRATE + ENEMIES_VARS +
        MOVE_SHIP + FIRE_CANNON +
        'function draw(){' + DRAW_BG_PIRATE + DRAW_BALLS + DRAW_ENEMIES + DRAW_SHIP + DRAW_HUD_PIRATE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){moveShip();fireCannon();updateBalls();updateCooldown();if(typeof moveEnemies==="function")moveEnemies();if(typeof checkBallHits==="function")checkBallHits();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_PIRATE, CANVAS_PIRATE,
        SETUP_PIRATE + OCEAN_BASE + KEYS_PIRATE + ENEMIES_VARS + TREASURE_VARS +
        MOVE_SHIP + FIRE_CANNON + ENEMY_AI +
        'function draw(){' + DRAW_BG_PIRATE + DRAW_TREASURES + DRAW_BALLS + DRAW_ENEMIES + DRAW_SHIP + DRAW_HUD_PIRATE + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){moveShip();fireCannon();updateBalls();updateCooldown();moveEnemies();checkBallHits();if(typeof checkTreasure==="function")checkTreasure();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_PIRATE, CANVAS_PIRATE,
        SETUP_PIRATE + OCEAN_BASE + KEYS_PIRATE + ENEMIES_VARS + TREASURE_VARS +
        MOVE_SHIP + FIRE_CANNON + ENEMY_AI + TREASURE_CHECK + TOUCH_PIRATE +
        'function draw(){' + DRAW_BG_PIRATE + DRAW_TREASURES + DRAW_BALLS + DRAW_ENEMIES + DRAW_SHIP + DRAW_HUD_PIRATE + DRAW_WIN + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){if(!won){moveShip();fireCannon();updateBalls();updateCooldown();moveEnemies();checkBallHits();checkTreasure();if(typeof checkWin==="function")checkWin();}draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Ship & Ocean Rendering',
      goal: 'Draw the ocean and your pirate ship on the canvas.',
      points: [
        'A dark ocean background with animated wave dots',
        'A triangular ship shape drawn at its position and angle',
        'The ship has a hull, mast and sail rendered with canvas paths'
      ],
      challenge: 'Write the ocean wave animation that makes the water feel alive:',
      starter: '// Create wave dots across the ocean\nlet waves = [];\nfor (let i = 0; i < 60; i++) {\n  waves.push({\n    x: Math.random() * W,\n    y: Math.random() * H,\n    r: Math.random() * 3 + 1,\n    s: ???\n  });\n}',
      solution: 'let waves = [];\nfor (let i = 0; i < 60; i++) {\n  waves.push({\n    x: Math.random() * W,\n    y: Math.random() * H,\n    r: Math.random() * 3 + 1,\n    s: Math.random() * 0.005 + 0.002\n  });\n}',
      checks: ['waves', 'math.random', 'push'],
      height: 220,
      fills: {
        text: 'Each wave dot has a random ___ speed. The ___ function adds each dot to the array.',
        answers: ['animation', 'push']
      },
      quiz: {
        question: 'In Roblox, the ocean is created using:',
        options: [
          'A blue Part with Transparency set to 0.5',
          'Terrain Water that automatically makes unanchored parts float',
          'A ScreenGui that covers the whole screen in blue'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Ship Movement',
      goal: 'Steer the ship with arrow keys using angle-based movement.',
      points: [
        'Left/Right arrows rotate the ship\'s heading angle',
        'Up arrow thrusts forward along the current angle',
        'Friction slows the ship gradually when no key is pressed'
      ],
      challenge: 'Write the movement function that applies thrust and turning:',
      starter: '// Move the ship each frame\nfunction moveShip() {\n  if (!ship.alive) return;\n  if (leftHeld) ship.angle -= TURN;\n  if (rightHeld) ship.angle += TURN;\n  if (upHeld) ship.speed += ???;\n  ship.speed *= FRICTION;\n  // Move along the angle\n  ship.x += Math.cos(ship.angle) * ???;\n  ship.y += Math.sin(ship.angle) * ???;\n}',
      solution: 'function moveShip() {\n  if (!ship.alive) return;\n  if (leftHeld) ship.angle -= TURN;\n  if (rightHeld) ship.angle += TURN;\n  if (upHeld) ship.speed += THRUST;\n  if (downHeld) ship.speed -= THRUST * 0.5;\n  ship.speed *= FRICTION;\n  if (ship.speed > 4) ship.speed = 4;\n  if (ship.speed < -1) ship.speed = -1;\n  ship.x += Math.cos(ship.angle) * ship.speed;\n  ship.y += Math.sin(ship.angle) * ship.speed;\n  if (ship.x < 0) ship.x = W; if (ship.x > W) ship.x = 0;\n  if (ship.y < 0) ship.y = H; if (ship.y > H) ship.y = 0;\n}',
      checks: ['thrust', 'math.cos', 'friction'],
      height: 260,
      fills: {
        text: 'The ___ constant controls how fast the ship accelerates. Multiplying speed by ___ each frame creates drag.',
        answers: ['THRUST', 'FRICTION']
      },
      quiz: {
        question: 'In the Roblox pirate workshop, ship movement uses:',
        options: [
          'A BodyVelocity on the hull driven by the VehicleSeat\'s Throttle and Steer',
          'Teleporting the ship every second',
          'Changing the ship\'s Position directly each frame'
        ],
        correct: 0
      }
    },
    {
      num: 3,
      title: 'Cannon Firing',
      goal: 'Fire cannonballs in the direction the ship is facing.',
      points: [
        'Pressing Space creates a cannonball at the ship\'s position',
        'The ball travels along the ship\'s angle at BALL_SPEED',
        'A cooldown timer prevents spam-firing'
      ],
      challenge: 'Write the cannon firing function:',
      starter: '// Fire a cannonball from the ship\nfunction fireCannon() {\n  if (!ship.alive || !canFire || !fireHeld) return;\n  canFire = false;\n  cooldown = 30;\n  cannonballs.push({\n    x: ship.x, y: ship.y,\n    dx: Math.cos(ship.angle) * ???,\n    dy: Math.sin(ship.angle) * ???,\n    life: 80, fromPlayer: true\n  });\n}\n\nfunction updateBalls() {\n  for (let i = cannonballs.length - 1; i >= 0; i--) {\n    let b = cannonballs[i];\n    b.x += b.dx; b.y += b.dy; b.life--;\n    if (b.life <= 0) cannonballs.splice(i, 1);\n  }\n}\n\nfunction updateCooldown() {\n  if (!canFire) { cooldown--; if (cooldown <= 0) canFire = true; }\n}',
      solution: 'function fireCannon() {\n  if (!ship.alive || !canFire || !fireHeld) return;\n  canFire = false; cooldown = 30;\n  cannonballs.push({\n    x: ship.x, y: ship.y,\n    dx: Math.cos(ship.angle) * BALL_SPEED,\n    dy: Math.sin(ship.angle) * BALL_SPEED,\n    life: 80, fromPlayer: true\n  });\n}\nfunction updateBalls() {\n  for (let i = cannonballs.length - 1; i >= 0; i--) {\n    let b = cannonballs[i];\n    b.x += b.dx; b.y += b.dy; b.life--;\n    if (b.life <= 0 || b.x < -10 || b.x > W+10 || b.y < -10 || b.y > H+10) {\n      cannonballs.splice(i, 1);\n    }\n  }\n}\nfunction updateCooldown() {\n  if (!canFire) { cooldown--; if (cooldown <= 0) canFire = true; }\n}',
      checks: ['ball_speed', 'math.cos', 'cooldown'],
      height: 380,
      fills: {
        text: 'The ___ array holds all active cannonballs. The ___ property tracks how many frames until each ball disappears.',
        answers: ['cannonballs', 'life']
      },
      quiz: {
        question: 'In the Roblox workshop, cannonballs are cleaned up using:',
        options: [
          'The player manually deletes them',
          'Debris:AddItem(ball, 5) which auto-deletes the ball after 5 seconds',
          'They stay in the game forever'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Enemy Ships with AI',
      goal: 'Add enemy ships that chase the player and fire back.',
      points: [
        'Enemy ships spawn at random edges of the screen',
        'They rotate to face the player and move toward them',
        'Enemies fire cannonballs on a random timer'
      ],
      challenge: 'Write the enemy AI that chases and fires at the player:',
      starter: '// Move enemies toward the player and fire\nfunction moveEnemies() {\n  for (let i = 0; i < enemies.length; i++) {\n    let e = enemies[i];\n    let dx = ship.x - e.x;\n    let dy = ship.y - e.y;\n    e.angle = Math.atan2(???, ???);\n    e.x += Math.cos(e.angle) * e.speed;\n    e.y += Math.sin(e.angle) * e.speed;\n  }\n}',
      solution: 'function moveEnemies() {\n  for (let i = 0; i < enemies.length; i++) {\n    let e = enemies[i];\n    let dx = ship.x - e.x, dy = ship.y - e.y;\n    e.angle = Math.atan2(dy, dx);\n    e.x += Math.cos(e.angle) * e.speed;\n    e.y += Math.sin(e.angle) * e.speed;\n    if (e.fireCd > 0) { e.fireCd--; } else {\n      e.fireCd = 90 + Math.floor(Math.random() * 60);\n      cannonballs.push({x:e.x, y:e.y, dx:Math.cos(e.angle)*3, dy:Math.sin(e.angle)*3, life:60, fromPlayer:false});\n    }\n  }\n}\nfunction checkBallHits() {\n  for (let i = cannonballs.length - 1; i >= 0; i--) {\n    let b = cannonballs[i];\n    if (b.fromPlayer) {\n      for (let j = enemies.length - 1; j >= 0; j--) {\n        let e = enemies[j];\n        let dx = b.x - e.x, dy = b.y - e.y;\n        if (Math.sqrt(dx*dx+dy*dy) < 18) {\n          e.hp -= 15; cannonballs.splice(i, 1);\n          if (e.hp <= 0) { enemies.splice(j, 1); gold += 10; spawnEnemy(); }\n          break;\n        }\n      }\n    } else {\n      let dx = b.x - ship.x, dy = b.y - ship.y;\n      if (Math.sqrt(dx*dx+dy*dy) < 16) {\n        ship.hp -= 10; cannonballs.splice(i, 1);\n        if (ship.hp <= 0) ship.alive = false;\n      }\n    }\n  }\n}',
      checks: ['atan2', 'enemies', 'angle'],
      height: 220,
      fills: {
        text: 'The ___ function calculates the angle from the enemy to the player. In Roblox, enemies use ___ events to detect cannonball hits.',
        answers: ['Math.atan2', 'Touched']
      },
      quiz: {
        question: 'In Roblox, the Touched event on a cannonball fires when:',
        options: [
          'The cannonball\'s physics collider overlaps another part',
          'The player clicks on the cannonball',
          'The cannonball changes colour'
        ],
        correct: 0
      }
    },
    {
      num: 5,
      title: 'Treasure Collection',
      goal: 'Place golden treasure chests that the player can sail over to collect.',
      points: [
        'Five treasure chests are placed at fixed positions',
        'Sailing close to a chest collects it and adds +25 gold',
        'In Roblox, this uses a ProximityPrompt with a Triggered event'
      ],
      challenge: 'Write the treasure collection check:',
      starter: '// Check if the player ship touches any treasure\nfunction checkTreasure() {\n  for (let i = 0; i < treasures.length; i++) {\n    let t = treasures[i];\n    if (!t.collected) {\n      let dx = ship.x - t.x;\n      let dy = ship.y - t.y;\n      if (Math.sqrt(dx * dx + dy * dy) < ???) {\n        t.collected = ???;\n        gold += 25;\n      }\n    }\n  }\n}',
      solution: 'function checkTreasure() {\n  for (let i = 0; i < treasures.length; i++) {\n    let t = treasures[i];\n    if (!t.collected) {\n      let dx = ship.x - t.x;\n      let dy = ship.y - t.y;\n      if (Math.sqrt(dx * dx + dy * dy) < 20) {\n        t.collected = true;\n        gold += 25;\n      }\n    }\n  }\n}',
      checks: ['collected', 'math.sqrt', 'gold'],
      height: 240,
      quiz: {
        question: 'In the Roblox workshop, treasure chests use a ProximityPrompt. What does HoldDuration = 1 mean?',
        options: [
          'The player must hold E for 1 second before the chest opens',
          'The chest appears for only 1 second',
          'The prompt shows from 1 stud away'
        ],
        correct: 0
      }
    },
    {
      num: 6,
      title: 'Health, Damage & Victory',
      goal: 'Add a win condition when all treasure is collected and the ship survives.',
      points: [
        'Collecting all 5 treasures (125+ gold) triggers the win screen',
        'Enemy cannonballs reduce the player\'s HP by 10 each hit',
        'The same loop in Roblox uses Health values, Touched events and a leaderboard'
      ],
      challenge: 'Write the win condition check and victory display:',
      starter: '// Check if all treasure is collected\nfunction checkWin() {\n  let allCollected = true;\n  for (let i = 0; i < treasures.length; i++) {\n    if (!treasures[i].collected) allCollected = false;\n  }\n  if (allCollected && gold >= ??? && !won) {\n    won = ???;\n  }\n}',
      solution: 'function checkWin() {\n  let allCollected = true;\n  for (let i = 0; i < treasures.length; i++) {\n    if (!treasures[i].collected) allCollected = false;\n  }\n  if (allCollected && gold >= 125 && !won) {\n    won = true;\n  }\n}',
      checks: ['allcollected', '125', 'won'],
      height: 200,
      fills: {
        text: 'The win requires ___ gold from 5 chests at 25 each. In Roblox, the leaderboard folder must be named ___.',
        answers: ['125', 'leaderstats']
      },
      quiz: {
        question: 'In the Roblox pirate workshop, the sinking script uses TweenService to:',
        options: [
          'Smoothly move all ship parts downward into the water over 3 seconds',
          'Change the ship\'s colour to red',
          'Teleport the ship to the sky'
        ],
        correct: 0
      }
    }
  ]
};
