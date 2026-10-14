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
   IFRAME BUILDING BLOCKS (Roblox Simulator simulation)
   =================================================== */

var CSS_SIM = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%;cursor:pointer}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}.hud{display:flex;gap:16px;align-items:center;font-size:.85rem;flex-wrap:wrap}.hud b{color:#ffd166}.shop-panel{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 14px;font-size:.75rem;display:flex;gap:10px;flex-wrap:wrap;align-items:center}.shop-btn{background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.4);color:#63b3ed;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.75rem;font-family:inherit}.shop-btn:hover{background:rgba(99,179,237,.3)}.shop-btn.owned{opacity:.4;cursor:default}</style>';

var CANVAS_SIM = '<div class="hud"><span>Coins: <b id="coins">0</b></span><span>Gems: <b id="gems">0</b></span><span>Backpack: <b id="backpack">0</b>/<b id="bpMax">10</b></span><span>Multiplier: <b id="multi">x1</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to move &middot; Walk over orbs to collect &middot; Click orbs too!</div>';

var CANVAS_SIM_SHOP = '<div class="hud"><span>Coins: <b id="coins">0</b></span><span>Gems: <b id="gems">0</b></span><span>Backpack: <b id="backpack">0</b>/<b id="bpMax">10</b></span><span>Multiplier: <b id="multi">x1</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="shop-panel" id="shopPanel"><b>Shop:</b><button class="shop-btn" id="btnBP" onclick="buyUpgrade(\'backpack\')">Bigger Backpack (25c)</button><button class="shop-btn" id="btnSpeed" onclick="buyUpgrade(\'speed\')">Speed Boost (40c)</button><button class="shop-btn" id="btnAuto" onclick="buyUpgrade(\'auto\')">Auto-Collect (60c)</button></div><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to move &middot; Walk over orbs to collect</div>';

var CANVAS_SIM_REBIRTH = '<div class="hud"><span>Coins: <b id="coins">0</b></span><span>Gems: <b id="gems">0</b></span><span>Backpack: <b id="backpack">0</b>/<b id="bpMax">10</b></span><span>Multiplier: <b id="multi">x1</b></span><span>Rebirths: <b id="rebirths">0</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="shop-panel" id="shopPanel"><b>Shop:</b><button class="shop-btn" id="btnBP" onclick="buyUpgrade(\'backpack\')">Bigger Backpack (25c)</button><button class="shop-btn" id="btnSpeed" onclick="buyUpgrade(\'speed\')">Speed Boost (40c)</button><button class="shop-btn" id="btnAuto" onclick="buyUpgrade(\'auto\')">Auto-Collect (60c)</button><button class="shop-btn" id="btnRebirth" onclick="doRebirth()" style="background:rgba(245,101,101,.15);border-color:rgba(245,101,101,.4);color:#f56565">Rebirth (100c)</button></div><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys to move &middot; Walk over orbs to collect</div>';

var SETUP_SIM = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400;',
  'let SPEED=3;',
  'let player={x:W/2-8,y:H/2-12,w:16,h:24,vx:0,vy:0};',
  'let coins=0,gems=0,backpackCount=0,backpackMax=10,multiplier=1,rebirthCount=0;',
  'let orbs=[];let autoCollect=false;let hasSpeedBoost=false;let hasBigBP=false;',
  'let leftHeld=false,rightHeld=false,upHeld=false,downHeld=false;'
].join('');

var SPAWN_ORBS = [
  'const ORB_COLORS=["#ffd166","#06d6a0","#ef476f","#118ab2","#b794f4"];',
  'function spawnOrb(){',
  'if(orbs.length>=20)return;',
  'let kind=Math.random()<0.15?"gem":"coin";',
  'let r=kind==="gem"?8:6;',
  'orbs.push({x:30+Math.random()*(W-60),y:30+Math.random()*(H-60),r:r,',
  'color:kind==="gem"?"#b794f4":ORB_COLORS[Math.floor(Math.random()*3)],',
  'kind:kind,bob:Math.random()*Math.PI*2,alive:true});',
  '}',
  'for(let i=0;i<8;i++)spawnOrb();',
  'setInterval(spawnOrb,1200);'
].join('');

var KEYS_SIM = [
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

var MOVE_PLAYER_SIM = [
  'function movePlayer(){',
  'if(leftHeld)player.vx=-SPEED;',
  'else if(rightHeld)player.vx=SPEED;',
  'else player.vx*=0.7;',
  'if(upHeld)player.vy=-SPEED;',
  'else if(downHeld)player.vy=SPEED;',
  'else player.vy*=0.7;',
  'player.x+=player.vx;player.y+=player.vy;',
  'if(player.x<0)player.x=0;if(player.x+player.w>W)player.x=W-player.w;',
  'if(player.y<0)player.y=0;if(player.y+player.h>H)player.y=H-player.h;',
  '}'
].join('');

var COLLECT_ORBS = [
  'function collectOrbs(){',
  'let px=player.x+player.w/2,py=player.y+player.h/2;',
  'for(let i=orbs.length-1;i>=0;i--){let o=orbs[i];',
  'if(!o.alive)continue;',
  'let dx=px-o.x,dy=py-o.y,dist=Math.sqrt(dx*dx+dy*dy);',
  'if(dist<o.r+14){',
  'if(backpackCount>=backpackMax)continue;',
  'o.alive=false;orbs.splice(i,1);',
  'if(o.kind==="gem"){gems+=multiplier;if(document.getElementById("gems"))document.getElementById("gems").textContent=gems}',
  'else{coins+=multiplier;if(document.getElementById("coins"))document.getElementById("coins").textContent=coins}',
  'backpackCount++;if(document.getElementById("backpack"))document.getElementById("backpack").textContent=backpackCount;',
  '}}}'
].join('');

var CLICK_COLLECT = [
  'canvas.addEventListener("click",function(e){',
  'let rect=canvas.getBoundingClientRect();',
  'let mx=(e.clientX-rect.left)*(W/rect.width),my=(e.clientY-rect.top)*(H/rect.height);',
  'for(let i=orbs.length-1;i>=0;i--){let o=orbs[i];',
  'if(!o.alive)continue;',
  'let dx=mx-o.x,dy=my-o.y;',
  'if(dx*dx+dy*dy<(o.r+8)*(o.r+8)){',
  'if(backpackCount>=backpackMax)break;',
  'o.alive=false;orbs.splice(i,1);',
  'if(o.kind==="gem"){gems+=multiplier;if(document.getElementById("gems"))document.getElementById("gems").textContent=gems}',
  'else{coins+=multiplier;if(document.getElementById("coins"))document.getElementById("coins").textContent=coins}',
  'backpackCount++;if(document.getElementById("backpack"))document.getElementById("backpack").textContent=backpackCount;',
  'break;',
  '}}});'
].join('');

var SELL_ZONE = [
  'let sellZone={x:W-70,y:H-50,w:60,h:40};',
  'function checkSell(){',
  'let px=player.x+player.w/2,py=player.y+player.h/2;',
  'if(px>sellZone.x&&px<sellZone.x+sellZone.w&&py>sellZone.y&&py<sellZone.y+sellZone.h&&backpackCount>0){',
  'backpackCount=0;',
  'if(document.getElementById("backpack"))document.getElementById("backpack").textContent=0;',
  '}}'
].join('');

var DRAW_BG_SIM = 'CWArt.bg(ctx,W,H,"#1a2e1a","#0d1a0d");CWArt.grid(ctx,W,H,40);';

var DRAW_ORBS = [
  'for(let i=0;i<orbs.length;i++){let o=orbs[i];',
  'if(!o.alive)continue;',
  'let bob=Math.sin(Date.now()/400+o.bob)*2;',
  'ctx.save();ctx.shadowColor=o.color;ctx.shadowBlur=o.kind==="gem"?14:10;',
  'ctx.fillStyle=o.color;ctx.beginPath();ctx.arc(o.x,o.y+bob,o.r,0,Math.PI*2);ctx.fill();ctx.restore();',
  'if(o.kind==="gem"){ctx.fillStyle="rgba(255,255,255,.5)";ctx.beginPath();ctx.arc(o.x-2,o.y+bob-2,2,0,Math.PI*2);ctx.fill()}',
  '}'
].join('');

var DRAW_PLAYER_SIM = [
  'ctx.save();ctx.shadowColor="rgba(99,179,237,.9)";ctx.shadowBlur=12;',
  'ctx.fillStyle="#63b3ed";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(player.x+4,player.y+6,4,4);ctx.fillRect(player.x+10,player.y+6,4,4);'
].join('');

var DRAW_SELL_ZONE = [
  'ctx.save();ctx.shadowColor="rgba(72,187,120,.7)";ctx.shadowBlur=14;',
  'ctx.fillStyle="rgba(72,187,120,.25)";CWArt.roundRect(ctx,sellZone.x,sellZone.y,sellZone.w,sellZone.h,6);ctx.fill();ctx.restore();',
  'ctx.fillStyle="rgba(72,187,120,.9)";ctx.font="bold 10px system-ui";ctx.textAlign="center";',
  'ctx.fillText("SELL",sellZone.x+sellZone.w/2,sellZone.y+sellZone.h/2+4);'
].join('');

var DRAW_HUD_SIM = [
  'if(document.getElementById("coins"))document.getElementById("coins").textContent=coins;',
  'if(document.getElementById("gems"))document.getElementById("gems").textContent=gems;',
  'if(document.getElementById("multi"))document.getElementById("multi").textContent="x"+multiplier;',
  'if(document.getElementById("bpMax"))document.getElementById("bpMax").textContent=backpackMax;',
  'if(document.getElementById("backpack"))document.getElementById("backpack").textContent=backpackCount;'
].join('');

var SHOP_SYSTEM = [
  'function buyUpgrade(type){',
  'if(type==="backpack"&&!hasBigBP&&coins>=25){coins-=25;backpackMax=20;hasBigBP=true;',
  'document.getElementById("bpMax").textContent=backpackMax;',
  'document.getElementById("btnBP").classList.add("owned");document.getElementById("btnBP").textContent="Owned";}',
  'if(type==="speed"&&!hasSpeedBoost&&coins>=40){coins-=40;SPEED=5;hasSpeedBoost=true;',
  'document.getElementById("btnSpeed").classList.add("owned");document.getElementById("btnSpeed").textContent="Owned";}',
  'if(type==="auto"&&!autoCollect&&coins>=60){coins-=60;autoCollect=true;',
  'document.getElementById("btnAuto").classList.add("owned");document.getElementById("btnAuto").textContent="Owned";}',
  'document.getElementById("coins").textContent=coins;',
  '}'
].join('');

var AUTO_COLLECT = [
  'function doAutoCollect(){',
  'if(!autoCollect)return;',
  'let px=player.x+player.w/2,py=player.y+player.h/2;',
  'for(let i=orbs.length-1;i>=0;i--){let o=orbs[i];',
  'if(!o.alive)continue;',
  'let dx=px-o.x,dy=py-o.y,dist=Math.sqrt(dx*dx+dy*dy);',
  'if(dist<80){',
  'o.x+=(px-o.x)*0.08;o.y+=(py-o.y)*0.08;',
  '}}}'
].join('');

var REBIRTH_SYSTEM = [
  'function doRebirth(){',
  'if(coins<100)return;',
  'coins=0;gems=0;backpackCount=0;backpackMax=10;SPEED=3;autoCollect=false;hasSpeedBoost=false;hasBigBP=false;',
  'rebirthCount++;multiplier=1+rebirthCount;',
  'document.getElementById("coins").textContent=0;',
  'document.getElementById("gems").textContent=0;',
  'document.getElementById("backpack").textContent=0;',
  'document.getElementById("bpMax").textContent=10;',
  'document.getElementById("multi").textContent="x"+multiplier;',
  'if(document.getElementById("rebirths"))document.getElementById("rebirths").textContent=rebirthCount;',
  'document.getElementById("btnBP").classList.remove("owned");document.getElementById("btnBP").textContent="Bigger Backpack (25c)";',
  'document.getElementById("btnSpeed").classList.remove("owned");document.getElementById("btnSpeed").textContent="Speed Boost (40c)";',
  'document.getElementById("btnAuto").classList.remove("owned");document.getElementById("btnAuto").textContent="Auto-Collect (60c)";',
  'orbs=[];for(let i=0;i<8;i++)spawnOrb();',
  '}'
].join('');

var TOUCH_SIM = [
  'let touchStart=null;',
  'canvas.addEventListener("touchstart",function(e){touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault()});',
  'canvas.addEventListener("touchmove",function(e){if(!touchStart)return;e.preventDefault();',
  'let dx=e.touches[0].clientX-touchStart.x,dy=e.touches[0].clientY-touchStart.y;',
  'leftHeld=dx<-15;rightHeld=dx>15;upHeld=dy<-15;downHeld=dy>15;});',
  'canvas.addEventListener("touchend",function(){leftHeld=false;rightHeld=false;upHeld=false;downHeld=false;touchStart=null});'
].join('');

var DRAW_BP_BAR = [
  'let bpPct=backpackCount/backpackMax;',
  'ctx.fillStyle="rgba(0,0,0,.4)";CWArt.roundRect(ctx,10,H-20,100,10,4);ctx.fill();',
  'ctx.fillStyle=bpPct>=1?"#f56565":"#48bb78";CWArt.roundRect(ctx,10,H-20,100*bpPct,10,4);ctx.fill();',
  'ctx.fillStyle="rgba(255,255,255,.6)";ctx.font="bold 8px system-ui";ctx.textAlign="left";',
  'ctx.fillText("BP: "+backpackCount+"/"+backpackMax,12,H-12);'
].join('');

var DRAW_PARTICLES = [
  'let particles=[];',
  'function addParticle(x,y,color){particles.push({x:x,y:y,vx:(Math.random()-0.5)*3,vy:-Math.random()*2-1,life:1,color:color})}',
  'function drawParticles(){',
  'for(let i=particles.length-1;i>=0;i--){let p=particles[i];',
  'p.x+=p.vx;p.y+=p.vy;p.life-=0.03;',
  'if(p.life<=0){particles.splice(i,1);continue}',
  'ctx.globalAlpha=p.life;ctx.fillStyle=p.color;',
  'ctx.beginPath();ctx.arc(p.x,p.y,3*p.life,0,Math.PI*2);ctx.fill();',
  'ctx.globalAlpha=1;}}'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

/* ===================================================
   CW_CONFIG - Roblox Simulator canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-simulator-canvas',
  downloadName: 'my-simulator-game.html',

  hints: [
    'Arrow keys to move your character around the world',
    'Walk over the colourful orbs to collect them',
    'Purple orbs are gems, worth more than coins!',
    'Visit the green SELL zone to empty your backpack',
    'Buy upgrades in the shop to collect faster',
    'Rebirth resets your coins but gives a permanent multiplier!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_SIM, CANVAS_SIM,
        SETUP_SIM + SPAWN_ORBS + KEYS_SIM +
        'function draw(){' + DRAW_BG_SIM + DRAW_ORBS + DRAW_PLAYER_SIM + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){if(typeof movePlayer==="function")movePlayer();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_SIM, CANVAS_SIM,
        SETUP_SIM + SPAWN_ORBS + KEYS_SIM + MOVE_PLAYER_SIM +
        'function draw(){' + DRAW_BG_SIM + DRAW_ORBS + DRAW_PLAYER_SIM + DRAW_HUD_SIM + '}' +
        'try{' + u + '}catch(e){}' +
        CLICK_COLLECT +
        'function loop(){movePlayer();if(typeof collectOrbs==="function")collectOrbs();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_SIM, CANVAS_SIM,
        SETUP_SIM + SPAWN_ORBS + KEYS_SIM + MOVE_PLAYER_SIM + COLLECT_ORBS + CLICK_COLLECT +
        SELL_ZONE +
        'function draw(){' + DRAW_BG_SIM + DRAW_SELL_ZONE + DRAW_ORBS + DRAW_PLAYER_SIM + DRAW_BP_BAR + DRAW_HUD_SIM + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();collectOrbs();if(typeof checkSell==="function")checkSell();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_SIM, CANVAS_SIM_SHOP,
        SETUP_SIM + SPAWN_ORBS + KEYS_SIM + MOVE_PLAYER_SIM + COLLECT_ORBS + CLICK_COLLECT +
        SELL_ZONE +
        'function draw(){' + DRAW_BG_SIM + DRAW_SELL_ZONE + DRAW_ORBS + DRAW_PLAYER_SIM + DRAW_BP_BAR + DRAW_HUD_SIM + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();collectOrbs();checkSell();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_SIM, CANVAS_SIM_SHOP,
        SETUP_SIM + SPAWN_ORBS + KEYS_SIM + MOVE_PLAYER_SIM + COLLECT_ORBS + CLICK_COLLECT +
        SELL_ZONE + SHOP_SYSTEM +
        'function draw(){' + DRAW_BG_SIM + DRAW_SELL_ZONE + DRAW_ORBS + DRAW_PLAYER_SIM + DRAW_BP_BAR + DRAW_HUD_SIM + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();collectOrbs();if(typeof doAutoCollect==="function")doAutoCollect();checkSell();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_SIM, CANVAS_SIM_REBIRTH,
        SETUP_SIM + SPAWN_ORBS + KEYS_SIM + MOVE_PLAYER_SIM + COLLECT_ORBS + CLICK_COLLECT +
        SELL_ZONE + SHOP_SYSTEM + AUTO_COLLECT + TOUCH_SIM + DRAW_PARTICLES +
        'function draw(){' + DRAW_BG_SIM + DRAW_SELL_ZONE + DRAW_ORBS + DRAW_PLAYER_SIM + DRAW_BP_BAR + DRAW_HUD_SIM + 'drawParticles();' + '}' +
        u +
        'function loop(){movePlayer();collectOrbs();doAutoCollect();checkSell();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Player & Resource Spawning',
      goal: 'Set up a player character and spawn collectible orbs across the world.',
      points: [
        'A player character that moves with arrow keys (top-down view)',
        'Colourful coin orbs and purple gem orbs spawn randomly',
        'Orbs bob up and down with a sine wave for a polished look'
      ],
      challenge: 'Write the movement function for a top-down simulator:',
      starter: '// Move the player in all four directions\nfunction movePlayer() {\n  if (leftHeld) player.vx = ???;\n  else if (rightHeld) player.vx = ???;\n  else player.vx *= 0.7;\n  if (upHeld) player.vy = ???;\n  else if (downHeld) player.vy = ???;\n  else player.vy *= 0.7;\n  // Move\n  player.x += player.vx;\n  player.y += player.vy;\n}',
      solution: 'function movePlayer() {\n  if (leftHeld) player.vx = -SPEED;\n  else if (rightHeld) player.vx = SPEED;\n  else player.vx *= 0.7;\n  if (upHeld) player.vy = -SPEED;\n  else if (downHeld) player.vy = SPEED;\n  else player.vy *= 0.7;\n  player.x += player.vx;\n  player.y += player.vy;\n}',
      checks: ['speed', '-speed', 'player.vx', 'player.vy'],
      height: 260,
      fills: {
        text: 'Moving left sets vx to ___ and moving up sets vy to ___.',
        answers: ['-SPEED', '-SPEED']
      },
      quiz: {
        question: 'In a top-down simulator, moving "up" on screen means:',
        options: [
          'Increasing the player\'s Y position',
          'Decreasing the player\'s Y position (negative direction)',
          'Setting the player\'s X position to 0'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Collection Mechanics',
      goal: 'Let the player walk over orbs or click them to collect resources.',
      points: [
        'Walking near an orb picks it up automatically',
        'Clicking an orb collects it from a distance',
        'Coins and gems are tracked separately on the HUD'
      ],
      challenge: 'Write the walk-over collection function:',
      starter: '// Collect orbs the player walks over\nfunction collectOrbs() {\n  let px = player.x + player.w / 2;\n  let py = player.y + player.h / 2;\n  for (let i = orbs.length - 1; i >= 0; i--) {\n    let o = orbs[i];\n    if (!o.alive) continue;\n    let dx = px - o.x, dy = py - o.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist < ???) {\n      o.alive = false;\n      orbs.splice(i, 1);\n      if (o.kind === "gem") gems += ???;\n      else coins += ???;\n    }\n  }\n}',
      solution: 'function collectOrbs() {\n  let px = player.x + player.w / 2;\n  let py = player.y + player.h / 2;\n  for (let i = orbs.length - 1; i >= 0; i--) {\n    let o = orbs[i];\n    if (!o.alive) continue;\n    let dx = px - o.x, dy = py - o.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist < o.r + 14) {\n      if (backpackCount >= backpackMax) continue;\n      o.alive = false;\n      orbs.splice(i, 1);\n      if (o.kind === "gem") gems += multiplier;\n      else coins += multiplier;\n      backpackCount++;\n    }\n  }\n}',
      checks: ['collectOrbs', 'dist', 'splice', 'coins'],
      height: 300,
      fills: {
        text: 'We check ___ between the player and each orb. The ___ method removes the collected orb from the array.',
        answers: ['distance', 'splice']
      },
      quiz: {
        question: 'Why do we loop backwards (i--) when removing orbs from the array?',
        options: [
          'Backwards loops are always faster in JavaScript',
          'Removing an item shifts later indices down, so looping forward can skip items',
          'The orbs array is sorted in reverse order'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Backpack & Sell Zone',
      goal: 'Add a backpack limit and a sell zone to trade resources for permanent coins.',
      points: [
        'The backpack holds a limited number of items (starts at 10)',
        'A green sell zone empties the backpack when you walk into it',
        'A progress bar shows how full the backpack is'
      ],
      challenge: 'Write the sell zone check:',
      starter: '// Empty the backpack when the player enters the sell zone\nlet sellZone = {x: W-70, y: H-50, w: 60, h: 40};\nfunction checkSell() {\n  let px = player.x + player.w / 2;\n  let py = player.y + player.h / 2;\n  if (px > sellZone.??? && px < sellZone.x + sellZone.??? &&\n      py > sellZone.y && py < sellZone.y + sellZone.h &&\n      backpackCount > 0) {\n    backpackCount = ???;\n  }\n}',
      solution: 'let sellZone = {x: W-70, y: H-50, w: 60, h: 40};\nfunction checkSell() {\n  let px = player.x + player.w / 2;\n  let py = player.y + player.h / 2;\n  if (px > sellZone.x && px < sellZone.x + sellZone.w &&\n      py > sellZone.y && py < sellZone.y + sellZone.h &&\n      backpackCount > 0) {\n    backpackCount = 0;\n  }\n}',
      checks: ['sellzone', 'backpackcount', '0'],
      height: 240,
      fills: {
        text: 'The sell zone checks if the player is inside its ___ using x, y, w and h. Selling resets the backpack count to ___.',
        answers: ['bounds', '0']
      },
      quiz: {
        question: 'In Roblox, the equivalent of our sell zone would be:',
        options: [
          'A Part with a Touched event that checks the player\'s backpack folder',
          'A ClickDetector on a distant NPC',
          'A script that runs every 10 seconds automatically'
        ],
        correct: 0
      }
    },
    {
      num: 4,
      title: 'Shop & Upgrade System',
      goal: 'Build a shop panel where players spend coins on upgrades.',
      points: [
        'Three upgrades: bigger backpack, speed boost, auto-collect',
        'Each upgrade costs coins and can only be bought once',
        'Buttons show "Owned" after purchase'
      ],
      challenge: 'Write the upgrade purchase function:',
      starter: '// Buy an upgrade from the shop\nfunction buyUpgrade(type) {\n  if (type === "backpack" && !hasBigBP && coins >= ???) {\n    coins -= 25;\n    backpackMax = ???;\n    hasBigBP = true;\n  }\n  if (type === "speed" && !hasSpeedBoost && coins >= 40) {\n    coins -= 40;\n    SPEED = ???;\n    hasSpeedBoost = true;\n  }\n}',
      solution: 'function buyUpgrade(type) {\n  if (type === "backpack" && !hasBigBP && coins >= 25) {\n    coins -= 25;\n    backpackMax = 20;\n    hasBigBP = true;\n  }\n  if (type === "speed" && !hasSpeedBoost && coins >= 40) {\n    coins -= 40;\n    SPEED = 5;\n    hasSpeedBoost = true;\n  }\n  if (type === "auto" && !autoCollect && coins >= 60) {\n    coins -= 60;\n    autoCollect = true;\n  }\n}',
      checks: ['buyupgrade', 'coins', 'backpackmax', 'speed'],
      height: 260,
      fills: {
        text: 'Each upgrade uses a ___ flag to prevent buying it twice. The speed boost changes the ___ constant from 3 to 5.',
        answers: ['boolean', 'SPEED']
      },
      quiz: {
        question: 'In Roblox, player upgrades are best stored as:',
        options: [
          'Attributes on the Player object using SetAttribute',
          'Global variables in a Script',
          'The game\'s title'
        ],
        correct: 0
      }
    },
    {
      num: 5,
      title: 'Auto-Collect & Speed',
      goal: 'Make the auto-collect upgrade pull nearby orbs towards the player.',
      points: [
        'After buying auto-collect, nearby orbs drift towards the player',
        'Lerp (linear interpolation) creates smooth magnet-like movement',
        'The speed upgrade makes the player move faster to cover more ground'
      ],
      challenge: 'Write the auto-collect magnet function:',
      starter: '// Pull nearby orbs towards the player\nfunction doAutoCollect() {\n  if (!autoCollect) return;\n  let px = player.x + player.w / 2;\n  let py = player.y + player.h / 2;\n  for (let i = 0; i < orbs.length; i++) {\n    let o = orbs[i];\n    if (!o.alive) continue;\n    let dx = px - o.x, dy = py - o.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist < ???) {\n      o.x += (px - o.x) * ???;\n      o.y += (py - o.y) * ???;\n    }\n  }\n}',
      solution: 'function doAutoCollect() {\n  if (!autoCollect) return;\n  let px = player.x + player.w / 2;\n  let py = player.y + player.h / 2;\n  for (let i = 0; i < orbs.length; i++) {\n    let o = orbs[i];\n    if (!o.alive) continue;\n    let dx = px - o.x, dy = py - o.y;\n    let dist = Math.sqrt(dx * dx + dy * dy);\n    if (dist < 80) {\n      o.x += (px - o.x) * 0.08;\n      o.y += (py - o.y) * 0.08;\n    }\n  }\n}',
      checks: ['autocollect', '80', '0.08'],
      height: 280,
      quiz: {
        question: 'The auto-collect magnet uses <code>o.x += (px - o.x) * 0.08</code>. This technique is called:',
        options: [
          'Teleportation - the orb jumps instantly',
          'Linear interpolation (lerp) - moves 8% of the remaining distance each frame',
          'Gravity - the orb falls downward'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Rebirth & Polish',
      goal: 'Add a rebirth system that resets progress for a permanent multiplier.',
      points: [
        'Rebirth costs 100 coins and resets all upgrades',
        'Each rebirth gives a permanent +1 multiplier to all earnings',
        'Particle effects and touch controls add final polish'
      ],
      challenge: 'Write the rebirth function:',
      starter: '// Rebirth: reset everything but gain a permanent multiplier\nfunction doRebirth() {\n  if (coins < ???) return;\n  coins = 0; gems = 0;\n  backpackCount = 0;\n  backpackMax = ???;\n  SPEED = 3;\n  autoCollect = false;\n  rebirthCount++;\n  multiplier = 1 + ???;\n}',
      solution: 'function doRebirth() {\n  if (coins < 100) return;\n  coins = 0; gems = 0;\n  backpackCount = 0;\n  backpackMax = 10;\n  SPEED = 3;\n  autoCollect = false;\n  hasSpeedBoost = false;\n  hasBigBP = false;\n  rebirthCount++;\n  multiplier = 1 + rebirthCount;\n}',
      checks: ['rebirth', '100', 'multiplier', 'rebirthcount'],
      height: 240,
      fills: {
        text: 'Rebirth resets all upgrades but increases the ___ permanently. The formula is 1 + ___ so each rebirth earns more.',
        answers: ['multiplier', 'rebirthCount']
      },
      quiz: {
        question: 'Why do simulators use a rebirth system?',
        options: [
          'To punish players for playing too long',
          'To give players a sense of progress and a reason to keep playing the loop again',
          'To save server memory by deleting player data'
        ],
        correct: 1
      }
    }
  ]
};
