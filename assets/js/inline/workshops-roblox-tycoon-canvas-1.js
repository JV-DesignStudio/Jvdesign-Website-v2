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
   IFRAME BUILDING BLOCKS (Roblox Tycoon simulation)
   =================================================== */

var CSS_TYCOON = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}.btn{background:#2d333b;border:1px solid #444c56;color:#e8eaf2;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.75rem;transition:background .2s}.btn:hover{background:#3d444d}.btn.bought{background:#1a3a2a;border-color:#48bb78;color:#48bb78;cursor:default}</style>';

var CANVAS_TYCOON = '<div class="row"><span>Cash: <b id="cash">$0</b></span><span>Bricks: <b id="brickCount">0</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" id="upgrades"></div>';

var SETUP_TYCOON = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400;',
  'let cash=0,totalBricks=0,brickValue=10,dropInterval=2000,lastDrop=0;',
  'let bricks=[];',
  'let dropper={x:W/2-20,y:30,w:40,h:30,color:"#63b3ed"};',
  'let collector={x:W/2-50,y:H-40,w:100,h:20,color:"#48bb78"};',
  'let upgrades=[];'
].join('');

var DROPPER_LOGIC = [
  'function spawnBrick(){',
  'bricks.push({x:dropper.x+dropper.w/2-8+Math.random()*16-8,y:dropper.y+dropper.h,w:16,h:16,vy:0,color:"#ecc94b",alive:true});',
  'totalBricks++;',
  '}'
].join('');

var BRICK_PHYSICS = [
  'function updateBricks(){',
  'for(let i=bricks.length-1;i>=0;i--){',
  'let b=bricks[i];if(!b.alive){bricks.splice(i,1);continue}',
  'b.vy+=0.15;b.y+=b.vy;',
  'if(b.y+b.h>=collector.y&&b.x+b.w>collector.x&&b.x<collector.x+collector.w){',
  'b.alive=false;if(typeof collectBrick==="function")collectBrick();',
  '}',
  'if(b.y>H+20){b.alive=false}',
  '}}'
].join('');

var COLLECT_FUNC = [
  'function collectBrick(){',
  'cash+=brickValue;',
  'document.getElementById("cash").textContent="$"+cash;',
  'document.getElementById("brickCount").textContent=totalBricks;',
  '}'
].join('');

var DRAW_BG_TYCOON = 'CWArt.bg(ctx,W,H,"#1a1c2e","#0d0f1a");CWArt.grid(ctx,W,H,40);';

var DRAW_DROPPER = [
  'ctx.save();ctx.shadowColor=dropper.color;ctx.shadowBlur=12;',
  'ctx.fillStyle=dropper.color;CWArt.roundRect(ctx,dropper.x,dropper.y,dropper.w,dropper.h,6);ctx.fill();ctx.restore();',
  'ctx.fillStyle="rgba(255,255,255,.8)";ctx.font="bold 9px system-ui";ctx.textAlign="center";',
  'ctx.fillText("DROPPER",dropper.x+dropper.w/2,dropper.y+dropper.h/2+3);'
].join('');

var DRAW_COLLECTOR = [
  'ctx.save();ctx.shadowColor=collector.color;ctx.shadowBlur=14;',
  'ctx.fillStyle=collector.color;CWArt.roundRect(ctx,collector.x,collector.y,collector.w,collector.h,6);ctx.fill();ctx.restore();',
  'ctx.fillStyle="rgba(255,255,255,.8)";ctx.font="bold 9px system-ui";ctx.textAlign="center";',
  'ctx.fillText("COLLECTOR",collector.x+collector.w/2,collector.y+collector.h/2+3);'
].join('');

var DRAW_BRICKS = [
  'for(let i=0;i<bricks.length;i++){let b=bricks[i];if(!b.alive)continue;',
  'ctx.save();ctx.shadowColor="rgba(236,201,75,.7)";ctx.shadowBlur=8;',
  'ctx.fillStyle=b.color;CWArt.roundRect(ctx,b.x,b.y,b.w,b.h,3);ctx.fill();ctx.restore();',
  '}'
].join('');

var DRAW_PIPE = [
  'ctx.save();ctx.strokeStyle="rgba(99,179,237,.3)";ctx.lineWidth=2;ctx.setLineDash([4,4]);',
  'ctx.beginPath();ctx.moveTo(dropper.x+dropper.w/2,dropper.y+dropper.h);',
  'ctx.lineTo(collector.x+collector.w/2,collector.y);ctx.stroke();ctx.restore();'
].join('');

var DRAW_CASH_HUD = [
  'ctx.fillStyle="rgba(236,201,75,.9)";ctx.font="bold 18px system-ui";ctx.textAlign="left";',
  'ctx.fillText("$"+cash,12,24);',
  'ctx.fillStyle="rgba(255,255,255,.5)";ctx.font="11px system-ui";',
  'ctx.fillText("Bricks: "+totalBricks,12,42);'
].join('');

var UPGRADE_DEFS = [
  'upgrades=[',
  '{name:"Speed+",desc:"Drop every 1s",price:100,bought:false,action:function(){dropInterval=1000}},',
  '{name:"Value+",desc:"$25 per brick",price:200,bought:false,action:function(){brickValue=25}},',
  '{name:"Double",desc:"2 bricks at once",price:500,bought:false,action:function(){dropper.double=true}}',
  '];'
].join('');

var UPGRADE_BTNS = [
  'function renderUpgradeButtons(){',
  'let wrap=document.getElementById("upgrades");wrap.innerHTML="";',
  'for(let i=0;i<upgrades.length;i++){(function(idx){',
  'let u=upgrades[idx];let btn=document.createElement("button");',
  'btn.className="btn"+(u.bought?" bought":"");',
  'btn.textContent=u.bought?"Owned":u.name+" ($"+u.price+")";',
  'btn.title=u.desc;',
  'btn.onclick=function(){if(u.bought||cash<u.price)return;cash-=u.price;u.bought=true;u.action();renderUpgradeButtons();',
  'document.getElementById("cash").textContent="$"+cash};',
  'wrap.appendChild(btn);',
  '})(i)}}'
].join('');

var DRAW_UPGRADE_PADS = [
  'let padY=H-80;let padW=80;let gap=20;let startX=(W-(upgrades.length*padW+(upgrades.length-1)*gap))/2;',
  'for(let i=0;i<upgrades.length;i++){let u=upgrades[i];let px=startX+i*(padW+gap);',
  'ctx.save();ctx.shadowColor=u.bought?"rgba(72,187,120,.6)":"rgba(245,101,101,.6)";ctx.shadowBlur=10;',
  'ctx.fillStyle=u.bought?"#1a3a2a":"#3a1a1a";CWArt.roundRect(ctx,px,padY,padW,18,4);ctx.fill();ctx.restore();',
  'ctx.fillStyle=u.bought?"#48bb78":"#f56565";ctx.font="bold 8px system-ui";ctx.textAlign="center";',
  'ctx.fillText(u.bought?"OWNED":u.name+" $"+u.price,px+padW/2,padY+12);',
  '}'
].join('');

var DRAW_GLOW_EFFECTS = [
  'let glowPhase=Math.sin(Date.now()/400)*0.3+0.7;',
  'ctx.save();ctx.globalAlpha=glowPhase*0.15;ctx.fillStyle="#ecc94b";',
  'ctx.beginPath();ctx.arc(dropper.x+dropper.w/2,dropper.y+dropper.h+6,20,0,Math.PI*2);ctx.fill();ctx.restore();',
  'ctx.save();ctx.globalAlpha=glowPhase*0.1;ctx.fillStyle="#48bb78";',
  'ctx.beginPath();ctx.arc(collector.x+collector.w/2,collector.y-4,30,0,Math.PI*2);ctx.fill();ctx.restore();'
].join('');

var DRAW_PARTICLES = [
  'if(typeof particles==="undefined")window.particles=[];',
  'for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.x+=p.vx;p.y+=p.vy;p.life--;',
  'if(p.life<=0){particles.splice(i,1);continue}',
  'ctx.save();ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle=p.color;',
  'ctx.fillRect(p.x,p.y,p.size,p.size);ctx.restore()}',
  'function spawnParticles(x,y,color){for(let i=0;i<5;i++){',
  'particles.push({x:x,y:y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3-1,',
  'life:20+Math.random()*15,maxLife:35,size:2+Math.random()*3,color:color})}}'
].join('');

var COLLECT_WITH_FX = [
  'function collectBrick(){',
  'cash+=brickValue;',
  'if(typeof spawnParticles==="function")spawnParticles(collector.x+collector.w/2,collector.y,"#ecc94b");',
  'document.getElementById("cash").textContent="$"+cash;',
  'document.getElementById("brickCount").textContent=totalBricks;',
  '}'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

/* ===================================================
   CW_CONFIG - Roblox Tycoon canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-tycoon-canvas',
  downloadName: 'my-tycoon-game.html',

  hints: [
    'Watch the dropper spawn yellow bricks that fall down',
    'The green collector at the bottom catches bricks for cash',
    'Each brick is worth $10 - watch the cash counter go up',
    'Buy upgrades to make your factory earn faster',
    'The Speed+ upgrade halves the drop interval',
    'Try buying all three upgrades to max out your factory!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_TYCOON, CANVAS_TYCOON,
        SETUP_TYCOON + DROPPER_LOGIC +
        'function draw(){ctx.clearRect(0,0,W,H);' + DRAW_BG_TYCOON + DRAW_DROPPER + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){let now=Date.now();if(now-lastDrop>=dropInterval){lastDrop=now;if(typeof spawnBrick==="function")spawnBrick()}draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_TYCOON, CANVAS_TYCOON,
        SETUP_TYCOON + DROPPER_LOGIC + BRICK_PHYSICS +
        'function draw(){ctx.clearRect(0,0,W,H);' + DRAW_BG_TYCOON + DRAW_PIPE + DRAW_DROPPER + DRAW_COLLECTOR + DRAW_BRICKS + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){let now=Date.now();if(now-lastDrop>=dropInterval){lastDrop=now;spawnBrick()}updateBricks();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_TYCOON, CANVAS_TYCOON,
        SETUP_TYCOON + DROPPER_LOGIC + BRICK_PHYSICS + COLLECT_FUNC +
        'function draw(){ctx.clearRect(0,0,W,H);' + DRAW_BG_TYCOON + DRAW_PIPE + DRAW_DROPPER + DRAW_COLLECTOR + DRAW_BRICKS + DRAW_CASH_HUD + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){let now=Date.now();if(now-lastDrop>=dropInterval){lastDrop=now;spawnBrick()}updateBricks();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_TYCOON, CANVAS_TYCOON,
        SETUP_TYCOON + DROPPER_LOGIC + BRICK_PHYSICS + COLLECT_FUNC +
        UPGRADE_DEFS + UPGRADE_BTNS +
        'function draw(){ctx.clearRect(0,0,W,H);' + DRAW_BG_TYCOON + DRAW_PIPE + DRAW_DROPPER + DRAW_COLLECTOR + DRAW_BRICKS + DRAW_CASH_HUD + DRAW_UPGRADE_PADS + '}' +
        'try{' + u + '}catch(e){}' +
        'renderUpgradeButtons();' +
        'function loop(){let now=Date.now();let interval=dropInterval;if(now-lastDrop>=interval){lastDrop=now;spawnBrick();if(dropper.double)spawnBrick()}updateBricks();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_TYCOON, CANVAS_TYCOON,
        SETUP_TYCOON + DROPPER_LOGIC + BRICK_PHYSICS + COLLECT_FUNC +
        UPGRADE_DEFS + UPGRADE_BTNS +
        'function draw(){ctx.clearRect(0,0,W,H);' + DRAW_BG_TYCOON + DRAW_PIPE + DRAW_GLOW_EFFECTS + DRAW_DROPPER + DRAW_COLLECTOR + DRAW_BRICKS + DRAW_CASH_HUD + DRAW_UPGRADE_PADS + '}' +
        'try{' + u + '}catch(e){}' +
        'renderUpgradeButtons();' +
        'function loop(){let now=Date.now();if(now-lastDrop>=dropInterval){lastDrop=now;spawnBrick();if(dropper.double)spawnBrick()}updateBricks();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_TYCOON, CANVAS_TYCOON,
        SETUP_TYCOON + DROPPER_LOGIC + BRICK_PHYSICS +
        UPGRADE_DEFS + UPGRADE_BTNS + DRAW_PARTICLES + COLLECT_WITH_FX +
        'function draw(){ctx.clearRect(0,0,W,H);' + DRAW_BG_TYCOON + DRAW_PIPE + DRAW_GLOW_EFFECTS + DRAW_DROPPER + DRAW_COLLECTOR + DRAW_BRICKS + DRAW_CASH_HUD + DRAW_UPGRADE_PADS + '}' +
        u +
        'renderUpgradeButtons();' +
        'function loop(){let now=Date.now();if(now-lastDrop>=dropInterval){lastDrop=now;spawnBrick();if(dropper.double)spawnBrick()}updateBricks();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Build the Dropper',
      goal: 'Create a dropper that spawns falling bricks every 2 seconds.',
      points: [
        'A dropper box sits at the top of the screen',
        'Every 2 seconds a new yellow brick spawns below it',
        'Bricks fall downward with gravity'
      ],
      challenge: 'Write the function that creates a new falling brick:',
      starter: '// Spawn a brick below the dropper\nfunction spawnBrick() {\n  bricks.push({\n    x: dropper.x + dropper.w / 2 - 8,\n    y: dropper.y + ???,\n    w: 16, h: 16,\n    vy: ???,\n    color: "#ecc94b",\n    alive: true\n  });\n  totalBricks++;\n}',
      solution: 'function spawnBrick() {\n  bricks.push({\n    x: dropper.x + dropper.w / 2 - 8 + Math.random() * 16 - 8,\n    y: dropper.y + dropper.h,\n    w: 16, h: 16,\n    vy: 0,\n    color: "#ecc94b",\n    alive: true\n  });\n  totalBricks++;\n}',
      checks: ['dropper.h', 'vy', 'alive'],
      height: 240,
      fills: {
        text: 'The brick spawns at the ___ of the dropper. Its initial vertical velocity is ___.',
        answers: ['bottom', '0']
      },
      quiz: {
        question: 'In the Roblox workshop, the dropper uses a while true do loop with task.wait(2). What does task.wait(2) do?',
        options: [
          'Deletes the brick after 2 seconds',
          'Pauses the loop for 2 seconds before spawning the next brick',
          'Makes the brick fall 2 studs per frame'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Add the Collector',
      goal: 'Place a collector that catches falling bricks.',
      points: [
        'A green collector box sits at the bottom of the screen',
        'Bricks that land on it are removed from the game',
        'In Roblox, the Touched event handles this collision'
      ],
      challenge: 'Write the brick physics with collector collision:',
      starter: '// Update all falling bricks each frame\nfunction updateBricks() {\n  for (let i = bricks.length - 1; i >= 0; i--) {\n    let b = bricks[i];\n    if (!b.alive) { bricks.splice(i, 1); continue; }\n    b.vy += 0.15;\n    b.y += b.vy;\n    // Check if brick hits the collector\n    if (b.y + b.h >= ??? &&\n        b.x + b.w > collector.x &&\n        b.x < collector.x + collector.w) {\n      b.alive = ???;\n    }\n  }\n}',
      solution: 'function updateBricks() {\n  for (let i = bricks.length - 1; i >= 0; i--) {\n    let b = bricks[i];\n    if (!b.alive) { bricks.splice(i, 1); continue; }\n    b.vy += 0.15;\n    b.y += b.vy;\n    if (b.y + b.h >= collector.y &&\n        b.x + b.w > collector.x &&\n        b.x < collector.x + collector.w) {\n      b.alive = false;\n      if (typeof collectBrick === "function") collectBrick();\n    }\n    if (b.y > H + 20) { b.alive = false; }\n  }\n}',
      checks: ['collector.y', 'alive', 'false'],
      height: 280,
      fills: {
        text: 'The collector uses ___ detection to catch bricks. In Roblox, the same thing is done with a ___ event.',
        answers: ['collision', 'Touched']
      },
      quiz: {
        question: 'In Roblox, the collector script checks hit.Name == "DropBrick". Why is this check important?',
        options: [
          'So the collector only picks up bricks, not the player or other parts',
          'So the collector changes color',
          'So the collector moves to a new position'
        ],
        correct: 0
      }
    },
    {
      num: 3,
      title: 'Cash System',
      goal: 'Award cash when bricks are collected and display it on screen.',
      points: [
        'Each collected brick adds $10 to the cash counter',
        'The HUD shows current cash and total bricks',
        'In Roblox, the leaderstats folder shows this automatically'
      ],
      challenge: 'Write the collect function that awards cash:',
      starter: '// Award cash when a brick is collected\nfunction collectBrick() {\n  cash += ???;\n  document.getElementById("cash").textContent = "???" + cash;\n  document.getElementById("brickCount").textContent = totalBricks;\n}',
      solution: 'function collectBrick() {\n  cash += brickValue;\n  document.getElementById("cash").textContent = "$" + cash;\n  document.getElementById("brickCount").textContent = totalBricks;\n}',
      checks: ['brickvalue', 'cash', 'textcontent'],
      height: 160,
      fills: {
        text: 'Each brick is worth $___. In Roblox, cash is stored in a special folder called ___.',
        answers: ['10', 'leaderstats']
      },
      quiz: {
        question: 'In the Roblox workshop, why is the leaderstats folder special?',
        options: [
          'It makes the game run faster',
          'Roblox automatically shows its contents as a leaderboard in the top-right corner',
          'It is required for scripts to work'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Buy Pad Upgrades',
      goal: 'Add upgrade buttons that let players spend cash on improvements.',
      points: [
        'Three upgrade pads: faster drops, more valuable bricks, double bricks',
        'Each costs a different amount of cash',
        'In Roblox, a Touched event on a buy pad checks the player\'s cash'
      ],
      challenge: 'Write the upgrade button renderer:',
      starter: '// Create buttons for each upgrade\nfunction renderUpgradeButtons() {\n  let wrap = document.getElementById("upgrades");\n  wrap.innerHTML = "";\n  for (let i = 0; i < upgrades.length; i++) {\n    let u = upgrades[i];\n    let btn = document.createElement("button");\n    btn.className = "btn" + (u.bought ? " bought" : "");\n    btn.textContent = u.bought ? "Owned" : u.name + " ($" + u.??? + ")";\n    btn.onclick = function() {\n      if (u.bought || cash < u.price) return;\n      cash -= u.???;\n      u.bought = true;\n      u.action();\n      renderUpgradeButtons();\n    };\n    wrap.appendChild(btn);\n  }\n}',
      solution: 'function renderUpgradeButtons() {\n  let wrap = document.getElementById("upgrades");\n  wrap.innerHTML = "";\n  for (let i = 0; i < upgrades.length; i++) {\n    let u = upgrades[i];\n    let btn = document.createElement("button");\n    btn.className = "btn" + (u.bought ? " bought" : "");\n    btn.textContent = u.bought ? "Owned" : u.name + " ($" + u.price + ")";\n    btn.onclick = function() {\n      if (u.bought || cash < u.price) return;\n      cash -= u.price;\n      u.bought = true;\n      u.action();\n      renderUpgradeButtons();\n    };\n    wrap.appendChild(btn);\n  }\n}',
      checks: ['price', 'bought', 'action'],
      height: 320,
      fills: {
        text: 'The buy pad checks if the player has enough ___ before purchasing. In Roblox, the ___ function prevents non-players from triggering the pad.',
        answers: ['cash', 'GetPlayerFromCharacter']
      },
      quiz: {
        question: 'In the Roblox buy pad script, what does "return" do inside the Touched function?',
        options: [
          'Restarts the whole script',
          'Exits the function early so nothing else runs',
          'Prints a message to the output'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Cash GUI Display',
      goal: 'Add an on-canvas cash display with glow effects.',
      points: [
        'A large cash readout drawn on the canvas',
        'Glow effects pulse around the dropper and collector',
        'In Roblox, a ScreenGui with a TextLabel shows the cash'
      ],
      challenge: 'Write the glow effects for the dropper and collector:',
      starter: '// Draw pulsing glow effects\nlet glowPhase = Math.sin(Date.now() / 400) * 0.3 + 0.7;\n\n// Dropper glow\nctx.save();\nctx.globalAlpha = glowPhase * ???;\nctx.fillStyle = "#ecc94b";\nctx.beginPath();\nctx.arc(dropper.x + dropper.w / 2, dropper.y + dropper.h + 6, ???, 0, Math.PI * 2);\nctx.fill();\nctx.restore();\n\n// Collector glow\nctx.save();\nctx.globalAlpha = glowPhase * 0.1;\nctx.fillStyle = "#48bb78";\nctx.beginPath();\nctx.arc(collector.x + collector.w / 2, ???, 30, 0, Math.PI * 2);\nctx.fill();\nctx.restore();',
      solution: 'let glowPhase = Math.sin(Date.now() / 400) * 0.3 + 0.7;\nctx.save();\nctx.globalAlpha = glowPhase * 0.15;\nctx.fillStyle = "#ecc94b";\nctx.beginPath();\nctx.arc(dropper.x + dropper.w / 2, dropper.y + dropper.h + 6, 20, 0, Math.PI * 2);\nctx.fill();\nctx.restore();\nctx.save();\nctx.globalAlpha = glowPhase * 0.1;\nctx.fillStyle = "#48bb78";\nctx.beginPath();\nctx.arc(collector.x + collector.w / 2, collector.y - 4, 30, 0, Math.PI * 2);\nctx.fill();\nctx.restore();',
      checks: ['glowphase', 'globalalpha', 'arc'],
      height: 340,
      fills: {
        text: 'In Roblox, a ___ with a TextLabel shows cash on screen. The ___ event fires whenever the cash value changes.',
        answers: ['ScreenGui', 'Changed']
      },
      quiz: {
        question: 'What is the difference between a Script and a LocalScript in Roblox?',
        options: [
          'Scripts are newer than LocalScripts',
          'Scripts run on the server, LocalScripts run on the player\'s computer',
          'There is no difference'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Polish & Particles',
      goal: 'Add collection particle effects and final visual polish.',
      points: [
        'Gold particles burst from the collector when a brick lands',
        'Particles fade out over time with decreasing opacity',
        'The same concept in Roblox uses ParticleEmitters on parts'
      ],
      challenge: 'Write the particle spawner for brick collection:',
      starter: '// Spawn particles at a position\nfunction spawnParticles(x, y, color) {\n  for (let i = 0; i < 5; i++) {\n    particles.push({\n      x: x, y: y,\n      vx: (Math.random() - 0.5) * 3,\n      vy: (Math.random() - 0.5) * 3 - ???,\n      life: 20 + Math.random() * 15,\n      maxLife: ???,\n      size: 2 + Math.random() * 3,\n      color: color\n    });\n  }\n}',
      solution: 'function spawnParticles(x, y, color) {\n  for (let i = 0; i < 5; i++) {\n    particles.push({\n      x: x, y: y,\n      vx: (Math.random() - 0.5) * 3,\n      vy: (Math.random() - 0.5) * 3 - 1,\n      life: 20 + Math.random() * 15,\n      maxLife: 35,\n      size: 2 + Math.random() * 3,\n      color: color\n    });\n  }\n}',
      checks: ['particles', 'life', 'maxlife'],
      height: 260,
      fills: {
        text: 'Particles fade by reducing their ___ over time. In Roblox, the same effect uses a ___ attached to a part.',
        answers: ['opacity', 'ParticleEmitter']
      },
      quiz: {
        question: 'In this workshop you built a dropper, collector, buy pads and a cash GUI. Which of these did you NOT build?',
        options: [
          'A racing system with checkpoints',
          'A buy pad that unlocks upgrades',
          'A cash display GUI'
        ],
        correct: 0
      }
    }
  ]
};
