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
   IFRAME BUILDING BLOCKS (Roblox Adventure simulation)
   =================================================== */

var CSS_ADV = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap}label{cursor:pointer}.dialogue-box{position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.92);border:2px solid #38bdf8;border-radius:12px;padding:12px 18px;max-width:340px;text-align:center;font-size:.82rem;color:#e2e8f0;pointer-events:none;z-index:10;display:none}.dialogue-box .npc-name{color:#38bdf8;font-weight:700;margin-bottom:4px;font-size:.75rem}</style>';

var CANVAS_ADV = '<div class="row"><span>Room: <b id="roomName">Village</b></span><span>Keys: <b id="keyCount">0</b>/3</span><span>Crystals: <b id="crystalCount">0</b>/5</span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrow keys / WASD to move &middot; E to interact</div><div class="dialogue-box" id="dialogueBox"><div class="npc-name" id="npcName"></div><div id="npcText"></div></div>';

var SETUP_ADV = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400,TILE=40,SPEED=2.5;',
  'let player={x:80,y:180,w:16,h:16,dir:"down"};',
  'let upHeld=false,downHeld=false,leftHeld=false,rightHeld=false,interactHeld=false;',
  'let currentRoom=0,keysCollected=0,crystalsCollected=0,won=false;'
].join('');

var ROOMS_BASE = [
  'let rooms=[',
  '{name:"Village",bg:"#1a2a1a",walls:[',
  '{x:0,y:0,w:600,h:20},{x:0,y:380,w:600,h:20},',
  '{x:0,y:0,w:20,h:400},{x:580,y:0,w:20,h:400},',
  '{x:200,y:0,w:20,h:160},{x:200,y:220,w:20,h:180},',
  '{x:400,y:0,w:20,h:280},{x:400,y:340,w:20,h:60}',
  '],doors:[{x:200,y:160,w:20,h:60,to:1,color:"#f6ad55"},{x:400,y:280,w:20,h:60,to:2,color:"#68d391"}],',
  'npcs:[{x:100,y:100,w:16,h:16,name:"Village Elder",lines:["Welcome, brave adventurer!","Our island is in danger.","Find the 3 Ancient Keys to open the Volcano Gate."],color:"#38bdf8"}],',
  'items:[],crystals:[]},',

  '{name:"Ruins",bg:"#1a1a2a",walls:[',
  '{x:0,y:0,w:600,h:20},{x:0,y:380,w:600,h:20},',
  '{x:0,y:0,w:20,h:400},{x:580,y:0,w:20,h:400},',
  '{x:160,y:100,w:20,h:200},{x:340,y:100,w:20,h:200}',
  '],doors:[{x:0,y:160,w:20,h:60,to:0,color:"#f6ad55"}],',
  'npcs:[],',
  'items:[{x:80,y:300,w:14,h:14,type:"key",id:"k1",collected:false,color:"#ecc94b"}],',
  'crystals:[{x:260,y:80,w:10,h:10,id:"c1",collected:false},{x:500,y:300,w:10,h:10,id:"c2",collected:false}]},',

  '{name:"Jungle",bg:"#0a2a1a",walls:[',
  '{x:0,y:0,w:600,h:20},{x:0,y:380,w:600,h:20},',
  '{x:0,y:0,w:20,h:400},{x:580,y:0,w:20,h:400},',
  '{x:120,y:0,w:20,h:260},{x:300,y:140,w:20,h:260},{x:460,y:0,w:20,h:260}',
  '],doors:[{x:580,y:160,w:20,h:60,to:0,color:"#68d391"},{x:300,y:380,w:60,h:20,to:3,color:"#b794f4",needKeys:3}],',
  'npcs:[{x:540,y:80,w:16,h:16,name:"Merchant",lines:["Looking for keys? Check the ruins and the jungle paths!","Crystals glow cyan, collect them all for bonus XP!"],color:"#f6ad55"}],',
  'items:[{x:60,y:340,w:14,h:14,type:"key",id:"k2",collected:false,color:"#ecc94b"},{x:540,y:340,w:14,h:14,type:"key",id:"k3",collected:false,color:"#ecc94b"}],',
  'crystals:[{x:200,y:60,w:10,h:10,id:"c3",collected:false},{x:400,y:300,w:10,h:10,id:"c4",collected:false},{x:550,y:200,w:10,h:10,id:"c5",collected:false}]},',

  '{name:"Volcano",bg:"#2a0a0a",walls:[',
  '{x:0,y:0,w:600,h:20},{x:0,y:380,w:600,h:20},',
  '{x:0,y:0,w:20,h:400},{x:580,y:0,w:20,h:400},',
  '{x:200,y:100,w:200,h:20},{x:200,y:280,w:200,h:20},',
  '{x:200,y:100,w:20,h:80},{x:380,y:200,w:20,h:80}',
  '],doors:[{x:300,y:0,w:60,h:20,to:2,color:"#b794f4"}],',
  'npcs:[],items:[],crystals:[]}',
  '];'
].join('');

var KEYS_ADV = [
  'document.addEventListener("keydown",function(e){',
  'if(e.code==="ArrowUp"||e.code==="KeyW"){upHeld=true;e.preventDefault()}',
  'if(e.code==="ArrowDown"||e.code==="KeyS"){downHeld=true;e.preventDefault()}',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;',
  'if(e.code==="KeyE")interactHeld=true;',
  '});',
  'document.addEventListener("keyup",function(e){',
  'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=false;',
  'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=false;',
  'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;',
  'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false;',
  'if(e.code==="KeyE")interactHeld=false;',
  '});'
].join('');

var MOVE_PLAYER_ADV = [
  'function movePlayer(){',
  'if(won)return;',
  'let nx=player.x,ny=player.y;',
  'if(upHeld){ny-=SPEED;player.dir="up"}',
  'if(downHeld){ny+=SPEED;player.dir="down"}',
  'if(leftHeld){nx-=SPEED;player.dir="left"}',
  'if(rightHeld){nx+=SPEED;player.dir="right"}',
  'let room=rooms[currentRoom];',
  'let blocked=false;',
  'for(let i=0;i<room.walls.length;i++){let w=room.walls[i];',
  'if(nx+player.w>w.x&&nx<w.x+w.w&&ny+player.h>w.y&&ny<w.y+w.h){blocked=true;break}',
  '}',
  'if(!blocked){player.x=nx;player.y=ny}',
  'if(player.x<0)player.x=0;if(player.x+player.w>W)player.x=W-player.w;',
  'if(player.y<0)player.y=0;if(player.y+player.h>H)player.y=H-player.h;',
  '}'
].join('');

var DOOR_CHECK = [
  'function checkDoors(){',
  'let room=rooms[currentRoom];',
  'for(let i=0;i<room.doors.length;i++){let d=room.doors[i];',
  'if(player.x+player.w>d.x&&player.x<d.x+d.w&&player.y+player.h>d.y&&player.y<d.y+d.h){',
  'if(d.needKeys&&keysCollected<d.needKeys)continue;',
  'currentRoom=d.to;',
  'player.x=W/2-player.w/2;player.y=H/2-player.h/2;',
  'document.getElementById("roomName").textContent=rooms[currentRoom].name;',
  'break;',
  '}}}'
].join('');

var ITEM_CHECK = [
  'function checkItems(){',
  'let room=rooms[currentRoom];',
  'for(let i=0;i<room.items.length;i++){let it=room.items[i];',
  'if(it.collected)continue;',
  'if(player.x+player.w>it.x&&player.x<it.x+it.w&&player.y+player.h>it.y&&player.y<it.y+it.h){',
  'it.collected=true;',
  'if(it.type==="key"){keysCollected++;document.getElementById("keyCount").textContent=keysCollected}',
  '}}',
  'for(let i=0;i<room.crystals.length;i++){let c=room.crystals[i];',
  'if(c.collected)continue;',
  'if(player.x+player.w>c.x&&player.x<c.x+c.w&&player.y+player.h>c.y&&player.y<c.y+c.h){',
  'c.collected=true;',
  'crystalsCollected++;document.getElementById("crystalCount").textContent=crystalsCollected;',
  '}}}'
].join('');

var NPC_DIALOGUE = [
  'let dialogueTimer=0,dialogueLines=[],dialogueLine=0,dialogueActive=false;',
  'function checkNPCs(){',
  'if(dialogueActive)return;',
  'if(!interactHeld)return;',
  'let room=rooms[currentRoom];',
  'for(let i=0;i<room.npcs.length;i++){let n=room.npcs[i];',
  'let dx=player.x+player.w/2-(n.x+n.w/2),dy=player.y+player.h/2-(n.y+n.h/2);',
  'if(Math.abs(dx)<40&&Math.abs(dy)<40){',
  'dialogueLines=n.lines;dialogueLine=0;dialogueActive=true;dialogueTimer=0;',
  'let db=document.getElementById("dialogueBox");',
  'db.style.display="block";',
  'document.getElementById("npcName").textContent=n.name;',
  'document.getElementById("npcText").textContent=dialogueLines[0];',
  'break;',
  '}}}',
  'function updateDialogue(){',
  'if(!dialogueActive)return;',
  'dialogueTimer++;',
  'if(dialogueTimer>120){',
  'dialogueLine++;dialogueTimer=0;',
  'if(dialogueLine>=dialogueLines.length){',
  'dialogueActive=false;document.getElementById("dialogueBox").style.display="none";',
  '}else{document.getElementById("npcText").textContent=dialogueLines[dialogueLine]}',
  '}}'
].join('');

var WIN_CHECK = [
  'function checkWin(){',
  'if(won)return;',
  'if(currentRoom===3&&keysCollected>=3){',
  'let bx=260,by=150,bw=80,bh=80;',
  'if(player.x+player.w>bx&&player.x<bx+bw&&player.y+player.h>by&&player.y<by+bh){',
  'won=true;',
  '}}}'
].join('');

var DRAW_BG_ADV = [
  'let room=rooms[currentRoom];',
  'CWArt.bg(ctx,W,H,room.bg,room.bg==="rgba(0,0,0,0)"?"#0d0f1a":"#0a0e14");CWArt.grid(ctx,W,H,TILE);'
].join('');

var DRAW_WALLS = [
  'for(let i=0;i<room.walls.length;i++){let w=room.walls[i];',
  'ctx.fillStyle="rgba(100,116,139,.6)";ctx.fillRect(w.x,w.y,w.w,w.h);',
  'ctx.strokeStyle="rgba(148,163,184,.3)";ctx.lineWidth=1;ctx.strokeRect(w.x,w.y,w.w,w.h);',
  '}'
].join('');

var DRAW_DOORS = [
  'for(let i=0;i<room.doors.length;i++){let d=room.doors[i];',
  'ctx.save();ctx.shadowColor=d.color;ctx.shadowBlur=d.needKeys&&keysCollected<d.needKeys?4:14;',
  'ctx.fillStyle=d.needKeys&&keysCollected<d.needKeys?"rgba(120,120,120,.5)":d.color;',
  'ctx.fillRect(d.x,d.y,d.w,d.h);ctx.restore();',
  'if(d.needKeys&&keysCollected<d.needKeys){ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 8px system-ui";ctx.textAlign="center";',
  'ctx.fillText(keysCollected+"/"+d.needKeys,d.x+d.w/2,d.y+d.h/2+3)}',
  '}'
].join('');

var DRAW_ITEMS = [
  'for(let i=0;i<room.items.length;i++){let it=room.items[i];',
  'if(it.collected)continue;',
  'ctx.save();ctx.shadowColor=it.color;ctx.shadowBlur=10+Math.sin(Date.now()/300)*4;',
  'ctx.fillStyle=it.color;ctx.fillRect(it.x,it.y,it.w,it.h);ctx.restore();',
  'ctx.fillStyle="rgba(255,255,255,.8)";ctx.font="bold 8px system-ui";ctx.textAlign="center";',
  'ctx.fillText("KEY",it.x+it.w/2,it.y-3);',
  '}',
  'for(let i=0;i<room.crystals.length;i++){let c=room.crystals[i];',
  'if(c.collected)continue;',
  'ctx.save();ctx.shadowColor="rgba(0,229,255,.9)";ctx.shadowBlur=8+Math.sin(Date.now()/250)*3;',
  'ctx.fillStyle="#00e5ff";ctx.beginPath();',
  'ctx.moveTo(c.x+c.w/2,c.y);ctx.lineTo(c.x+c.w,c.y+c.h/2);ctx.lineTo(c.x+c.w/2,c.y+c.h);ctx.lineTo(c.x,c.y+c.h/2);ctx.closePath();ctx.fill();ctx.restore();',
  '}'
].join('');

var DRAW_NPCS = [
  'for(let i=0;i<room.npcs.length;i++){let n=room.npcs[i];',
  'ctx.save();ctx.shadowColor=n.color;ctx.shadowBlur=8;',
  'ctx.fillStyle=n.color;ctx.fillRect(n.x,n.y,n.w,n.h);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(n.x+3,n.y+4,3,3);ctx.fillRect(n.x+10,n.y+4,3,3);',
  'ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="bold 7px system-ui";ctx.textAlign="center";',
  'ctx.fillText(n.name,n.x+n.w/2,n.y-4);',
  'let dx=player.x+player.w/2-(n.x+n.w/2),dy=player.y+player.h/2-(n.y+n.h/2);',
  'if(Math.abs(dx)<40&&Math.abs(dy)<40){ctx.fillStyle="rgba(56,189,248,.7)";ctx.font="bold 8px system-ui";ctx.fillText("[E] Talk",n.x+n.w/2,n.y+n.h+10)}',
  '}'
].join('');

var DRAW_PLAYER_ADV = [
  'ctx.save();ctx.shadowColor="rgba(99,179,237,.9)";ctx.shadowBlur=10;',
  'ctx.fillStyle="#63b3ed";ctx.fillRect(player.x,player.y,player.w,player.h);ctx.restore();',
  'ctx.fillStyle="#fff";',
  'if(player.dir==="down"||player.dir==="up"){ctx.fillRect(player.x+3,player.y+5,3,3);ctx.fillRect(player.x+10,player.y+5,3,3)}',
  'if(player.dir==="left"){ctx.fillRect(player.x+2,player.y+5,3,3);ctx.fillRect(player.x+8,player.y+5,3,3)}',
  'if(player.dir==="right"){ctx.fillRect(player.x+5,player.y+5,3,3);ctx.fillRect(player.x+11,player.y+5,3,3)}'
].join('');

var DRAW_BOSS = [
  'if(currentRoom===3){',
  'let bx=260,by=150,bw=80,bh=80;',
  'ctx.save();ctx.shadowColor="rgba(239,68,68,.8)";ctx.shadowBlur=20+Math.sin(Date.now()/200)*8;',
  'ctx.fillStyle="#ef4444";ctx.fillRect(bx,by,bw,bh);ctx.restore();',
  'ctx.fillStyle="#fff";ctx.fillRect(bx+18,by+20,12,12);ctx.fillRect(bx+50,by+20,12,12);',
  'ctx.fillStyle="rgba(239,68,68,.9)";ctx.font="bold 10px system-ui";ctx.textAlign="center";',
  'ctx.fillText("VOLCANO BEAST",bx+bw/2,by-6);',
  '}'
].join('');

var DRAW_HUD_ADV = [
  'document.getElementById("keyCount").textContent=keysCollected;',
  'document.getElementById("crystalCount").textContent=crystalsCollected;',
  'document.getElementById("roomName").textContent=rooms[currentRoom].name;',
  'if(won){ctx.fillStyle="rgba(0,0,0,.65)";ctx.fillRect(0,0,W,H);',
  'ctx.fillStyle="#48bb78";ctx.font="bold 26px system-ui";ctx.textAlign="center";',
  'ctx.fillText("ISLAND QUEST COMPLETE!",W/2,H/2-30);',
  'ctx.fillStyle="#e8eaf2";ctx.font="16px system-ui";',
  'ctx.fillText("You defeated the Volcano Beast!",W/2,H/2+5);',
  'ctx.fillText("Keys: "+keysCollected+"/3  Crystals: "+crystalsCollected+"/5",W/2,H/2+30)}'
].join('');

var TOUCH_ADV = [
  'let touchStart=null;',
  'canvas.addEventListener("touchstart",function(e){touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault()});',
  'canvas.addEventListener("touchend",function(e){if(!touchStart)return;',
  'let dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;',
  'if(Math.abs(dx)<10&&Math.abs(dy)<10){interactHeld=true;setTimeout(function(){interactHeld=false},150)}',
  'else if(Math.abs(dx)>Math.abs(dy)){',
  'if(dx>0){rightHeld=true;setTimeout(function(){rightHeld=false},200)}',
  'else{leftHeld=true;setTimeout(function(){leftHeld=false},200)}}',
  'else{if(dy>0){downHeld=true;setTimeout(function(){downHeld=false},200)}',
  'else{upHeld=true;setTimeout(function(){upHeld=false},200)}}',
  'touchStart=null});'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

/* ===================================================
   CW_CONFIG - Roblox Adventure canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-adventure-canvas',
  downloadName: 'my-adventure-game.html',

  hints: [
    'Arrow keys or WASD to move around the village',
    'Walk into the orange door to enter the Ruins',
    'Collect the golden keys scattered across rooms',
    'Press E near an NPC to hear their dialogue',
    'You need 3 keys to open the purple Volcano gate',
    'Reach the Volcano Beast to complete the quest!'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_ADV, CANVAS_ADV,
        SETUP_ADV + ROOMS_BASE + KEYS_ADV +
        'function draw(){' + DRAW_BG_ADV + DRAW_WALLS + DRAW_PLAYER_ADV + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){if(typeof movePlayer==="function")movePlayer();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_ADV, CANVAS_ADV,
        SETUP_ADV + ROOMS_BASE + KEYS_ADV +
        MOVE_PLAYER_ADV +
        'function draw(){' + DRAW_BG_ADV + DRAW_WALLS + DRAW_DOORS + DRAW_PLAYER_ADV + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_ADV, CANVAS_ADV,
        SETUP_ADV + ROOMS_BASE + KEYS_ADV +
        MOVE_PLAYER_ADV +
        'function draw(){' + DRAW_BG_ADV + DRAW_WALLS + DRAW_DOORS + DRAW_PLAYER_ADV + DRAW_HUD_ADV + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();if(typeof checkDoors==="function")checkDoors();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_ADV, CANVAS_ADV,
        SETUP_ADV + ROOMS_BASE + KEYS_ADV +
        MOVE_PLAYER_ADV + DOOR_CHECK +
        'function draw(){' + DRAW_BG_ADV + DRAW_WALLS + DRAW_DOORS + DRAW_ITEMS + DRAW_PLAYER_ADV + DRAW_HUD_ADV + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();checkDoors();if(typeof checkItems==="function")checkItems();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_ADV, CANVAS_ADV,
        SETUP_ADV + ROOMS_BASE + KEYS_ADV +
        MOVE_PLAYER_ADV + DOOR_CHECK + ITEM_CHECK +
        'function draw(){' + DRAW_BG_ADV + DRAW_WALLS + DRAW_DOORS + DRAW_ITEMS + DRAW_NPCS + DRAW_PLAYER_ADV + DRAW_HUD_ADV + '}' +
        NPC_DIALOGUE +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();checkDoors();checkItems();if(typeof checkNPCs==="function")checkNPCs();updateDialogue();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_ADV, CANVAS_ADV,
        SETUP_ADV + ROOMS_BASE + KEYS_ADV +
        MOVE_PLAYER_ADV + DOOR_CHECK + ITEM_CHECK + NPC_DIALOGUE + TOUCH_ADV +
        'function draw(){' + DRAW_BG_ADV + DRAW_WALLS + DRAW_DOORS + DRAW_ITEMS + DRAW_NPCS + DRAW_BOSS + DRAW_PLAYER_ADV + DRAW_HUD_ADV + '}' +
        'try{' + u + '}catch(e){}' +
        'function loop(){movePlayer();checkDoors();checkItems();checkNPCs();updateDialogue();if(typeof checkWin==="function")checkWin();draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Player Movement',
      goal: 'Set up top-down movement so the player can walk around the village.',
      points: [
        'A player character that moves in four directions',
        'Arrow keys or WASD control movement',
        'Wall collision prevents walking through walls'
      ],
      challenge: 'Write the movement function for top-down movement with wall collision:',
      starter: '// Move the player each frame (top-down)\nfunction movePlayer() {\n  if (won) return;\n  let nx = player.x, ny = player.y;\n  if (upHeld) { ny -= ???; player.dir = "up"; }\n  if (downHeld) { ny += ???; player.dir = "down"; }\n  if (leftHeld) { nx -= ???; player.dir = "left"; }\n  if (rightHeld) { nx += ???; player.dir = "right"; }\n  // Check wall collision\n  let room = rooms[currentRoom];\n  let blocked = false;\n  for (let i = 0; i < room.walls.length; i++) {\n    let w = room.walls[i];\n    if (nx+player.w > w.x && nx < w.x+w.w &&\n        ny+player.h > w.y && ny < w.y+w.h) {\n      blocked = ???;\n      break;\n    }\n  }\n  if (!blocked) { player.x = nx; player.y = ny; }\n}',
      solution: 'function movePlayer() {\n  if (won) return;\n  let nx = player.x, ny = player.y;\n  if (upHeld) { ny -= SPEED; player.dir = "up"; }\n  if (downHeld) { ny += SPEED; player.dir = "down"; }\n  if (leftHeld) { nx -= SPEED; player.dir = "left"; }\n  if (rightHeld) { nx += SPEED; player.dir = "right"; }\n  let room = rooms[currentRoom];\n  let blocked = false;\n  for (let i = 0; i < room.walls.length; i++) {\n    let w = room.walls[i];\n    if (nx+player.w > w.x && nx < w.x+w.w &&\n        ny+player.h > w.y && ny < w.y+w.h) {\n      blocked = true;\n      break;\n    }\n  }\n  if (!blocked) { player.x = nx; player.y = ny; }\n}',
      checks: ['speed', 'blocked', 'true'],
      height: 340,
      fills: {
        text: 'The ___ constant controls how fast the player walks. If a wall overlaps, the ___ flag prevents the move.',
        answers: ['SPEED', 'blocked']
      },
      quiz: {
        question: 'In a top-down game, unlike a platformer, there is no gravity. Movement uses:',
        options: [
          'Only left and right velocity',
          'Four-directional input: up, down, left and right with equal speed',
          'A single speed value that always points downward'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Room Layout & Walls',
      goal: 'Define rooms with walls so the player explores a structured world.',
      points: [
        'Each room has a name, background colour and wall array',
        'Walls are rectangles the player cannot walk through',
        'Doors are gaps in the walls shown as coloured passages'
      ],
      challenge: 'The walls and doors are already drawn. Study the room data and add a new wall to the village room:',
      starter: '// Add an extra wall in the Village room\n// Walls are objects: {x, y, w, h}\n// This wall blocks the bottom-right corner\nrooms[0].walls.push(\n  { x: ???, y: ???, w: 120, h: 20 }\n);\n// Try values that make sense in a 600x400 canvas\n// For example: x=460, y=300 puts a wall\n// near the bottom-right area',
      solution: 'rooms[0].walls.push(\n  { x: 460, y: 300, w: 120, h: 20 }\n);',
      checks: ['walls', 'push', 'x:'],
      height: 180,
      fills: {
        text: 'Each wall is a ___ with x, y, width and height properties. In Roblox, walls are ___ objects with Size and Position.',
        answers: ['rectangle', 'Part']
      },
      quiz: {
        question: 'In Roblox Studio, the equivalent of our wall rectangles are:',
        options: [
          'Scripts that block the player with code',
          'Part objects with CanCollide = true that act as physical walls',
          'Decals painted onto the ground'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Doors & Room Transitions',
      goal: 'Let the player walk through doors to move between rooms.',
      points: [
        'Each door has a target room (<code>to</code> property)',
        'Walking into a door teleports the player to the centre of the next room',
        'Some doors require keys to open (<code>needKeys</code>)'
      ],
      challenge: 'Write the door collision check that transitions between rooms:',
      starter: '// Check if the player touches a door\nfunction checkDoors() {\n  let room = rooms[currentRoom];\n  for (let i = 0; i < room.doors.length; i++) {\n    let d = room.doors[i];\n    if (player.x+player.w > d.x && player.x < d.x+d.w &&\n        player.y+player.h > d.y && player.y < d.y+d.h) {\n      if (d.needKeys && keysCollected < d.needKeys) continue;\n      currentRoom = ???;\n      player.x = W/2 - player.w/2;\n      player.y = H/2 - player.h/2;\n      document.getElementById("roomName").textContent = rooms[currentRoom].???;\n      break;\n    }\n  }\n}',
      solution: 'function checkDoors() {\n  let room = rooms[currentRoom];\n  for (let i = 0; i < room.doors.length; i++) {\n    let d = room.doors[i];\n    if (player.x+player.w > d.x && player.x < d.x+d.w &&\n        player.y+player.h > d.y && player.y < d.y+d.h) {\n      if (d.needKeys && keysCollected < d.needKeys) continue;\n      currentRoom = d.to;\n      player.x = W/2 - player.w/2;\n      player.y = H/2 - player.h/2;\n      document.getElementById("roomName").textContent = rooms[currentRoom].name;\n      break;\n    }\n  }\n}',
      checks: ['d.to', 'currentroom', 'name'],
      height: 280,
      fills: {
        text: 'The door\'s ___ property tells us which room to go to. In Roblox, room transitions use ___ to move players.',
        answers: ['to', 'TeleportService']
      },
      quiz: {
        question: 'Why do we set player.x and player.y to the centre of the canvas after a room transition?',
        options: [
          'To reset the player\'s speed to zero',
          'So the player doesn\'t spawn inside a wall in the new room',
          'Because the canvas requires the player to be centred'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Collectible Items & Keys',
      goal: 'Add keys and crystals that the player can pick up by walking over them.',
      points: [
        'Golden keys unlock the Volcano gate (need 3)',
        'Cyan crystals are bonus collectibles',
        'Each item has a <code>collected</code> flag so it only works once'
      ],
      challenge: 'Write the item collection check:',
      starter: '// Check if the player touches an item\nfunction checkItems() {\n  let room = rooms[currentRoom];\n  for (let i = 0; i < room.items.length; i++) {\n    let it = room.items[i];\n    if (it.collected) continue;\n    if (player.x+player.w > it.x && player.x < it.x+it.w &&\n        player.y+player.h > it.y && player.y < it.y+it.h) {\n      it.collected = ???;\n      if (it.type === "key") {\n        keysCollected++;\n        document.getElementById("keyCount").textContent = ???;\n      }\n    }\n  }\n}',
      solution: 'function checkItems() {\n  let room = rooms[currentRoom];\n  for (let i = 0; i < room.items.length; i++) {\n    let it = room.items[i];\n    if (it.collected) continue;\n    if (player.x+player.w > it.x && player.x < it.x+it.w &&\n        player.y+player.h > it.y && player.y < it.y+it.h) {\n      it.collected = true;\n      if (it.type === "key") {\n        keysCollected++;\n        document.getElementById("keyCount").textContent = keysCollected;\n      }\n    }\n  }\n}',
      checks: ['collected', 'true', 'keyscollected'],
      height: 260,
      fills: {
        text: 'Setting collected to ___ prevents picking up the same item twice. In Roblox, the Crystal script uses a ___ event to detect the player.',
        answers: ['true', 'Touched']
      },
      quiz: {
        question: 'In the Roblox workshop, why does each Crystal have its own <code>collected</code> variable?',
        options: [
          'Because Roblox only allows one variable per script',
          'So each crystal tracks independently whether it has been collected',
          'Because collected is a global Roblox property'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'NPC Dialogue',
      goal: 'Let NPCs speak when the player presses E nearby.',
      points: [
        'NPCs have a name, position and array of dialogue lines',
        'Pressing E within range starts the dialogue sequence',
        'Lines advance automatically every 2 seconds'
      ],
      challenge: 'The dialogue system is built in. Write the NPC proximity check:',
      starter: '// Check if E is pressed near an NPC\nfunction checkNPCs() {\n  if (dialogueActive) return;\n  if (!interactHeld) return;\n  let room = rooms[currentRoom];\n  for (let i = 0; i < room.npcs.length; i++) {\n    let n = room.npcs[i];\n    let dx = player.x - n.x;\n    let dy = player.y - n.y;\n    if (Math.abs(dx) < ??? && Math.abs(dy) < ???) {\n      dialogueLines = n.lines;\n      dialogueLine = 0;\n      dialogueActive = ???;\n      // Show the dialogue box\n      break;\n    }\n  }\n}',
      solution: 'function checkNPCs() {\n  if (dialogueActive) return;\n  if (!interactHeld) return;\n  let room = rooms[currentRoom];\n  for (let i = 0; i < room.npcs.length; i++) {\n    let n = room.npcs[i];\n    let dx = player.x - n.x;\n    let dy = player.y - n.y;\n    if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {\n      dialogueLines = n.lines;\n      dialogueLine = 0;\n      dialogueActive = true;\n      break;\n    }\n  }\n}',
      checks: ['40', 'dialogueactive', 'true'],
      height: 280,
      quiz: {
        question: 'In the Roblox workshop, NPC dialogue uses a ProximityPrompt. What does the ProximityPrompt do?',
        options: [
          'It makes the NPC walk towards the player automatically',
          'It shows a prompt when the player walks close and presses a key',
          'It displays a health bar above the NPC'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Win Condition & Polish',
      goal: 'Add a boss encounter in the Volcano room and a victory screen.',
      points: [
        'The Volcano Beast appears in the final room',
        'Walking into the boss triggers the win (simplified from the full Roblox combat)',
        'A victory overlay shows keys and crystals collected'
      ],
      challenge: 'Write the win condition check for reaching the boss:',
      starter: '// Check if the player reaches the boss in the Volcano\nfunction checkWin() {\n  if (won) return;\n  if (currentRoom === ??? && keysCollected >= ???) {\n    let bx = 260, by = 150, bw = 80, bh = 80;\n    if (player.x+player.w > bx && player.x < bx+bw &&\n        player.y+player.h > by && player.y < by+bh) {\n      won = ???;\n    }\n  }\n}',
      solution: 'function checkWin() {\n  if (won) return;\n  if (currentRoom === 3 && keysCollected >= 3) {\n    let bx = 260, by = 150, bw = 80, bh = 80;\n    if (player.x+player.w > bx && player.x < bx+bw &&\n        player.y+player.h > by && player.y < by+bh) {\n      won = true;\n    }\n  }\n}',
      checks: ['3', 'keyscollected', 'won'],
      height: 220,
      fills: {
        text: 'The player must be in room ___ (the Volcano) with all 3 keys. In the Roblox version, the boss uses a ___ event to detect when its health reaches zero.',
        answers: ['3', 'Died']
      },
      quiz: {
        question: 'In the Roblox workshop, the boss uses <code>humanoid.Died:Connect()</code>. This fires when:',
        options: [
          'The player presses a key near the boss',
          'The boss\'s Humanoid health drops to zero',
          'The boss walks off the edge of the map'
        ],
        correct: 1
      }
    }
  ]
};
