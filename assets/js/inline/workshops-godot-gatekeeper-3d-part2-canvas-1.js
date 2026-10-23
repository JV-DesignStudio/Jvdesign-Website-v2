'use strict';

function gdscriptToJs(code) {
  return code
    .replace(/#.*$/gm, '')
    .replace(/\bprint\s*\(/g, 'console.log(')
    .replace(/\bVector2\(([^,]+),\s*([^)]+)\)/g, '{x:$1,y:$2}')
    .replace(/\brandf\(\)/g, 'Math.random()')
    .replace(/\brandi\(\)\s*%\s*(\w+)/g, 'Math.floor(Math.random()*$1)')
    .replace(/\babs\(/g, 'Math.abs(')
    .replace(/\bclamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'Math.max($2,Math.min($3,$1))')
    .replace(/\.position\.x/g, '.x')
    .replace(/\.position\.y/g, '.y')
    .replace(/\bInput\.is_action_pressed\("ui_left"\)/g, 'leftHeld')
    .replace(/\bInput\.is_action_pressed\("ui_right"\)/g, 'rightHeld')
    .replace(/\bInput\.is_action_pressed\("ui_up"\)/g, 'upHeld')
    .replace(/\bInput\.is_action_pressed\("ui_down"\)/g, 'downHeld')
    .replace(/\bInput\.is_action_just_pressed\("ui_accept"\)/g, 'spacePressed')
    .replace(/\bfunc\s+(\w+)\s*\(([^)]*)\)\s*:/g, 'function $1($2){')
    .replace(/\belif\b/g, '} else if')
    .replace(/\bif\s+(.+):/g, 'if($1){')
    .replace(/\belse\s*:/g, '} else {')
    .replace(/\bfor\s+(\w+)\s+in\s+range\(([^)]+)\)\s*:/g, 'for(let $1=0;$1<$2;$1++){')
    .replace(/\bwhile\s+(.+):/g, 'while($1){')
    .replace(/\bvar\b/g, 'let')
    .replace(/\btrue\b/g, 'true')
    .replace(/\bfalse\b/g, 'false')
    .replace(/\bnull\b/g, 'null');
}

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0f172a;margin:0;overflow:hidden}canvas{display:block;cursor:pointer}</style>';
var CANVAS_TAG = '<canvas id="game" width="400" height="400"></canvas>';
var SETUP = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var PLAYER_VARS = 'let px=40,py=360,pw=16,speed=2.5;';
var GUARDS_VARS = 'let guards=[' +
  '{x:160,y:120,w:16,angle:0,speed:1.2,patrol:[{x:100,y:100},{x:260,y:100},{x:260,y:180},{x:100,y:180}],target:0},' +
  '{x:280,y:280,w:16,angle:Math.PI,speed:1.0,patrol:[{x:180,y:240},{x:340,y:240},{x:340,y:320},{x:180,y:320}],target:0}' +
  '];';
var VISION_VARS = 'let visionRange=90,visionAngle=0.55;';
var ROCK_VARS = 'let rocks=[],rockCooldown=0;';
var WALL_DATA = 'let walls=[{x:60,y:60,w:80,h:12},{x:260,y:60,w:12,h:100},{x:60,y:200,w:140,h:12},{x:280,y:200,w:80,h:12},{x:160,y:300,w:12,h:80}];';
var EXIT_VARS = 'let exitX=350,exitY=20,exitW=30,exitH=30;';
var STATE_VARS = 'let gameState="play";';
var KEYS = 'let leftHeld=false,rightHeld=false,upHeld=false,downHeld=false,spacePressed=false;' +
  'document.addEventListener("keydown",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;' +
    'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=true;' +
    'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=true;' +
    'if(e.code==="Space"){spacePressed=true;e.preventDefault()}' +
    'e.preventDefault()});' +
  'document.addEventListener("keyup",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false;' +
    'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=false;' +
    'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=false;' +
    'if(e.code==="Space")spacePressed=false});';

var DRAW_BG = 'ctx.fillStyle="#1e293b";ctx.fillRect(0,0,400,400);' +
  'ctx.strokeStyle="#334155";for(var gi=0;gi<400;gi+=40){ctx.beginPath();ctx.moveTo(gi,0);ctx.lineTo(gi,400);ctx.stroke();ctx.beginPath();ctx.moveTo(0,gi);ctx.lineTo(400,gi);ctx.stroke()}';
var DRAW_WALLS = 'ctx.fillStyle="#475569";for(var wi=0;wi<walls.length;wi++){ctx.fillRect(walls[wi].x,walls[wi].y,walls[wi].w,walls[wi].h)}';
var DRAW_EXIT = 'ctx.fillStyle="#22c55e";ctx.fillRect(exitX,exitY,exitW,exitH);ctx.fillStyle="#fff";ctx.font="bold 10px monospace";ctx.textAlign="center";ctx.fillText("EXIT",exitX+exitW/2,exitY+18);';
var DRAW_PLAYER = 'ctx.fillStyle="#60a5fa";ctx.beginPath();ctx.arc(px+pw/2,py+pw/2,pw/2,0,Math.PI*2);ctx.fill();';
var DRAW_GUARDS = 'for(var gi2=0;gi2<guards.length;gi2++){var g=guards[gi2];ctx.save();ctx.translate(g.x+g.w/2,g.y+g.w/2);ctx.rotate(g.angle);ctx.fillStyle="rgba(251,191,36,0.12)";ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,visionRange,-visionAngle,visionAngle);ctx.fill();ctx.restore();ctx.fillStyle="#f43f5e";ctx.beginPath();ctx.arc(g.x+g.w/2,g.y+g.w/2,g.w/2,0,Math.PI*2);ctx.fill()}';
var DRAW_ROCKS = 'ctx.fillStyle="#a78bfa";for(var ri=0;ri<rocks.length;ri++){ctx.beginPath();ctx.arc(rocks[ri].x,rocks[ri].y,5,0,Math.PI*2);ctx.fill()}';
var DRAW_HUD = 'ctx.fillStyle="#fff";ctx.font="bold 13px monospace";ctx.textAlign="left";ctx.fillText("Space: throw rock | Reach EXIT",6,394);';

function wbWrap(presetup, blobSrc, afterBlob) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob);
}

window.CW_CONFIG = {
  storageKey: 'jvds-godot-gatekeeper2-canvas',
  downloadName: 'my-godot-gatekeeper-2.html',
  nextStep: { url: '/workshops/godot-gdscript-essentials-canvas.html', label: 'GDScript Essentials' },

  hints: [
    'Two red guard dots patrol separate routes on a tiled floor',
    'Guards move independently - their patrols overlap to create tight corridors',
    'Yellow vision cones sweep as guards move; press Space to throw a distraction rock',
    'Rocks land ahead of you and briefly distract nearby guards',
    'Getting spotted by either guard triggers the caught state',
    'Reach the green EXIT to win; press R to retry',
    'Your mod card - plan your own multi-guard level to build at home in Godot'
  ],

  templates: {
    1: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + GUARDS_VARS + WALL_DATA + EXIT_VARS + KEYS,
        gdscriptToJs(u),
        'function loop(){' +
        DRAW_BG + DRAW_WALLS + DRAW_EXIT + DRAW_PLAYER + DRAW_GUARDS + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + GUARDS_VARS + WALL_DATA + EXIT_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_WALLS + DRAW_EXIT + DRAW_PLAYER + DRAW_GUARDS + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + GUARDS_VARS + VISION_VARS + WALL_DATA + EXIT_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)px-=speed;if(rightHeld)px+=speed;if(upHeld)py-=speed;if(downHeld)py+=speed;' +
        'px=Math.max(0,Math.min(400-16,px));py=Math.max(0,Math.min(400-16,py));' +
        'for(var wi=0;wi<walls.length;wi++){var w=walls[wi];if(px+16>w.x&&px<w.x+w.w&&py+16>w.y&&py<w.y+w.h){if(leftHeld)px=w.x+w.w;if(rightHeld)px=w.x-16;if(upHeld)py=w.y+w.h;if(downHeld)py=w.y-16}}' +
        'for(var gi=0;gi<guards.length;gi++){var g=guards[gi];var tx=g.patrol[g.target].x,ty=g.patrol[g.target].y;var dx=tx-g.x,dy=ty-g.y;var dist=Math.sqrt(dx*dx+dy*dy);if(dist<2){g.target=(g.target+1)%g.patrol.length}else{g.x+=dx/dist*g.speed;g.y+=dy/dist*g.speed}g.angle=Math.atan2(dy,dx)}' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_WALLS + DRAW_EXIT + DRAW_PLAYER + DRAW_GUARDS + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + GUARDS_VARS + VISION_VARS + ROCK_VARS + WALL_DATA + EXIT_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)px-=speed;if(rightHeld)px+=speed;if(upHeld)py-=speed;if(downHeld)py+=speed;' +
        'px=Math.max(0,Math.min(384,px));py=Math.max(0,Math.min(384,py));' +
        'for(var wi=0;wi<walls.length;wi++){var w=walls[wi];if(px+16>w.x&&px<w.x+w.w&&py+16>w.y&&py<w.y+w.h){if(leftHeld)px=w.x+w.w;if(rightHeld)px=w.x-16;if(upHeld)py=w.y+w.h;if(downHeld)py=w.y-16}}' +
        'if(spacePressed&&rockCooldown<=0){rocks.push({x:px+8+(rightHeld?60:leftHeld?-60:0),y:py+8+(downHeld?60:upHeld?-60:0),life:120});rockCooldown=45;spacePressed=false}' +
        'if(rockCooldown>0)rockCooldown--;' +
        'for(var ri=rocks.length-1;ri>=0;ri--){rocks[ri].life--;if(rocks[ri].life<=0)rocks.splice(ri,1)}' +
        'for(var gi=0;gi<guards.length;gi++){var g=guards[gi];var tx=g.patrol[g.target].x,ty=g.patrol[g.target].y;var dx=tx-g.x,dy=ty-g.y;var dist=Math.sqrt(dx*dx+dy*dy);if(dist<2){g.target=(g.target+1)%g.patrol.length}else{g.x+=dx/dist*g.speed;g.y+=dy/dist*g.speed}g.angle=Math.atan2(dy,dx)}' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_WALLS + DRAW_EXIT + DRAW_ROCKS + DRAW_PLAYER + DRAW_GUARDS + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + GUARDS_VARS + VISION_VARS + ROCK_VARS + WALL_DATA + EXIT_VARS + STATE_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(gameState==="play"){' +
        'if(leftHeld)px-=speed;if(rightHeld)px+=speed;if(upHeld)py-=speed;if(downHeld)py+=speed;' +
        'px=Math.max(0,Math.min(384,px));py=Math.max(0,Math.min(384,py));' +
        'for(var wi=0;wi<walls.length;wi++){var w=walls[wi];if(px+16>w.x&&px<w.x+w.w&&py+16>w.y&&py<w.y+w.h){if(leftHeld)px=w.x+w.w;if(rightHeld)px=w.x-16;if(upHeld)py=w.y+w.h;if(downHeld)py=w.y-16}}' +
        'if(spacePressed&&rockCooldown<=0){rocks.push({x:px+8+(rightHeld?60:leftHeld?-60:0),y:py+8+(downHeld?60:upHeld?-60:0),life:120});rockCooldown=45;spacePressed=false}' +
        'if(rockCooldown>0)rockCooldown--;' +
        'for(var ri=rocks.length-1;ri>=0;ri--){rocks[ri].life--;if(rocks[ri].life<=0)rocks.splice(ri,1)}' +
        'for(var gi=0;gi<guards.length;gi++){' +
        'var g=guards[gi];' +
        'var distracted=false;for(var rk=0;rk<rocks.length;rk++){var rdx=rocks[rk].x-g.x,rdy=rocks[rk].y-g.y;if(Math.sqrt(rdx*rdx+rdy*rdy)<80){g.angle=Math.atan2(rdy,rdx);distracted=true;break}}' +
        'if(!distracted){var tx=g.patrol[g.target].x,ty=g.patrol[g.target].y;var dx=tx-g.x,dy=ty-g.y;var dist=Math.sqrt(dx*dx+dy*dy);if(dist<2){g.target=(g.target+1)%g.patrol.length}else{g.x+=dx/dist*g.speed;g.y+=dy/dist*g.speed}g.angle=Math.atan2(dy,dx)}' +
        'var pdx=px+8-(g.x+8),pdy=py+8-(g.y+8);var pDist=Math.sqrt(pdx*pdx+pdy*pdy);var pAng=Math.atan2(pdy,pdx);var diff=Math.abs(pAng-g.angle);if(diff>Math.PI)diff=2*Math.PI-diff;if(pDist<visionRange&&diff<visionAngle)gameState="caught"' +
        '}' +
        'if(px+16>exitX&&px<exitX+exitW&&py+16>exitY&&py<exitY+exitH)gameState="win";' +
        'if(typeof cwStep==="function")cwStep();' +
        '}' +
        DRAW_BG + DRAW_WALLS + DRAW_EXIT + DRAW_ROCKS + DRAW_PLAYER + DRAW_GUARDS + DRAW_HUD +
        'if(gameState==="caught"){ctx.fillStyle="rgba(239,68,68,0.3)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("SPOTTED!",200,180);ctx.font="16px monospace";ctx.fillText("Press R to retry",200,220)}' +
        'if(gameState==="win"){ctx.fillStyle="rgba(34,197,94,0.3)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("ESCAPED!",200,180);ctx.font="16px monospace";ctx.fillText("Press R to play again",200,220)}' +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + GUARDS_VARS + VISION_VARS + ROCK_VARS + WALL_DATA + EXIT_VARS + STATE_VARS + KEYS +
        'let level=1;' +
        'document.addEventListener("keydown",function(e){if(e.code==="KeyR"&&(gameState==="caught"||gameState==="win")){px=40;py=360;guards[0].x=160;guards[0].y=120;guards[0].target=0;guards[1].x=280;guards[1].y=280;guards[1].target=0;rocks=[];gameState="play"}});',
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(gameState==="play"){' +
        'if(leftHeld)px-=speed;if(rightHeld)px+=speed;if(upHeld)py-=speed;if(downHeld)py+=speed;' +
        'px=Math.max(0,Math.min(384,px));py=Math.max(0,Math.min(384,py));' +
        'for(var wi=0;wi<walls.length;wi++){var w=walls[wi];if(px+16>w.x&&px<w.x+w.w&&py+16>w.y&&py<w.y+w.h){if(leftHeld)px=w.x+w.w;if(rightHeld)px=w.x-16;if(upHeld)py=w.y+w.h;if(downHeld)py=w.y-16}}' +
        'if(spacePressed&&rockCooldown<=0){rocks.push({x:px+8+(rightHeld?60:leftHeld?-60:0),y:py+8+(downHeld?60:upHeld?-60:0),life:120});rockCooldown=45;spacePressed=false}' +
        'if(rockCooldown>0)rockCooldown--;' +
        'for(var ri=rocks.length-1;ri>=0;ri--){rocks[ri].life--;if(rocks[ri].life<=0)rocks.splice(ri,1)}' +
        'for(var gi=0;gi<guards.length;gi++){' +
        'var g=guards[gi];' +
        'var distracted=false;for(var rk=0;rk<rocks.length;rk++){var rdx=rocks[rk].x-g.x,rdy=rocks[rk].y-g.y;if(Math.sqrt(rdx*rdx+rdy*rdy)<80){g.angle=Math.atan2(rdy,rdx);distracted=true;break}}' +
        'if(!distracted){var tx=g.patrol[g.target].x,ty=g.patrol[g.target].y;var dx=tx-g.x,dy=ty-g.y;var dist=Math.sqrt(dx*dx+dy*dy);if(dist<2){g.target=(g.target+1)%g.patrol.length}else{g.x+=dx/dist*g.speed;g.y+=dy/dist*g.speed}g.angle=Math.atan2(dy,dx)}' +
        'var pdx=px+8-(g.x+8),pdy=py+8-(g.y+8);var pDist=Math.sqrt(pdx*pdx+pdy*pdy);var pAng=Math.atan2(pdy,pdx);var diff=Math.abs(pAng-g.angle);if(diff>Math.PI)diff=2*Math.PI-diff;if(pDist<visionRange&&diff<visionAngle)gameState="caught"' +
        '}' +
        'if(px+16>exitX&&px<exitX+exitW&&py+16>exitY&&py<exitY+exitH)gameState="win";' +
        'if(typeof cwStep==="function")cwStep();' +
        '}' +
        DRAW_BG + DRAW_WALLS + DRAW_EXIT + DRAW_ROCKS + DRAW_PLAYER + DRAW_GUARDS + DRAW_HUD +
        'ctx.fillStyle="#94a3b8";ctx.font="12px monospace";ctx.textAlign="right";ctx.fillText("Level "+level,394,16);' +
        'if(gameState==="caught"){ctx.fillStyle="rgba(239,68,68,0.3)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("SPOTTED!",200,180);ctx.font="16px monospace";ctx.fillText("Press R to retry",200,220)}' +
        'if(gameState==="win"){ctx.fillStyle="rgba(34,197,94,0.3)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("ESCAPED!",200,180);ctx.font="16px monospace";ctx.fillText("Press R to play again",200,220)}' +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    7: function(u) {
      var lines = u.split('\n');
      var fields = {};
      lines.forEach(function(l) {
        var m = l.match(/^([^:]+):\s*(.*)$/);
        if (m && m[2].trim()) fields[m[1].trim()] = m[2].trim();
      });
      var html = '<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:16px;margin:0}' +
        'h2{color:#f43f5e;margin:0 0 12px}' +
        '.card{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:16px}' +
        '.row{display:flex;gap:8px;margin:6px 0;align-items:baseline}' +
        '.lbl{color:#94a3b8;min-width:160px;font-size:.85rem}' +
        '.val{color:#f1f5f9;font-weight:bold}' +
        '.tip{margin-top:14px;padding:10px;background:#0f172a;border-left:3px solid #f43f5e;font-size:.82rem;color:#94a3b8}' +
        '</style>' +
        '<div class="card"><h2>\uD83C\uDFE0 My Multi-Guard Mod Card</h2>';
      var order = ['Game name','Player colour','Number of guards','Distraction item','Map theme','Guard speed','One thing to add at home'];
      order.forEach(function(k) {
        if (fields[k]) html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
      });
      html += '<div class="tip">\uD83D\uDCA1 At home: in Godot, use multiple NavigationAgent2D nodes - one per guard. Add an Area2D around the distraction landing spot and connect its body_entered signal to a function that makes nearby guards investigate.</div></div>';
      var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
      return cwBlobWrap('<style>body{margin:0;background:#0f172a}</style>', '<div></div>', '', blob, '');
    }
  },

  steps: [
    {
      num: 1,
      title: 'Multiple Guards',
      activity: '\uD83D\uDC6E Two guards',
      goal: 'Set up the scene with two independent guards and a player.',
      checkpoint: 'You should see a blue player dot and two red guard dots at different positions on the tiled floor.',
      points: [
        'Each guard is an object with its own position, angle, speed, patrol, and target index',
        'Guard 1 patrols the upper portion of the map',
        'Guard 2 patrols the lower-right portion with slightly different speed',
        'Two guards covering different zones means no single safe corridor'
      ],
      challenge: '\uD83E\uDD16 Set the two guard starting positions:',
      starter: '# Guard 1 starts in upper area\nvar guard1_x = 160\nvar guard1_y = ___\n\n# Guard 2 starts in lower area\nvar guard2_x = ___\nvar guard2_y = 280',
      solution: '# Guard 1 starts in upper area\nvar guard1_x = 160\nvar guard1_y = 120\n\n# Guard 2 starts in lower area\nvar guard2_x = 280\nvar guard2_y = 280',
      checks: ['120', '280'],
      height: 130,
      fills: {
        text: 'Guard 1 is at y=___ and Guard 2 is at y=___. Their patrol zones ___.',
        answers: ['120', '280', 'overlap']
      },
      quiz: {
        question: 'Why do guard patrol zones overlap?',
        options: [
          'Overlapping zones look better on screen',
          'Overlapping patrols eliminate safe waiting spots - the player must time movements across both guards',
          'GDScript requires overlapping patrol paths'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Independent Patrols',
      activity: '\uD83D\uDD04 Patrols',
      goal: 'Make each guard follow its own patrol route independently.',
      checkpoint: 'Both red dots should move in loops - watch them for a full cycle each. Notice they are on different timings.',
      points: [
        'Loop over the guards array and update each one separately',
        'Each guard has its own patrol waypoint array and target index',
        'Guards move at different speeds (1.2 vs 1.0) creating phase drift over time',
        'Phase drift means gaps in the overlapping coverage change constantly'
      ],
      challenge: '\uD83E\uDD16 Update each guard toward its patrol target:',
      starter: '# Loop through all guards\nfor guard in guards:\n    var target = guard.patrol[guard.target]\n    var dx = target.x - guard.x\n    var dy = target.y - guard.y\n    var dist = abs(dx) + abs(dy)\n    if dist < 4:\n        guard.target = (guard.target + 1) % ___\n    else:\n        guard.x += dx / dist * ___\n        guard.y += dy / dist * guard.speed',
      solution: '# Loop through all guards\nfor guard in guards:\n    var target = guard.patrol[guard.target]\n    var dx = target.x - guard.x\n    var dy = target.y - guard.y\n    var dist = abs(dx) + abs(dy)\n    if dist < 4:\n        guard.target = (guard.target + 1) % 4\n    else:\n        guard.x += dx / dist * guard.speed\n        guard.y += dy / dist * guard.speed',
      checks: ['guard.speed', '4', 'guard.target'],
      height: 200,
      fills: {
        text: 'Each guard has ___ patrol waypoints. Different speeds cause phase ___ over time.',
        answers: ['4', 'drift']
      },
      quiz: {
        question: 'Why give guards different patrol speeds?',
        options: [
          'To make one guard harder than the other',
          'Phase drift means the timing windows change every cycle, keeping the player engaged rather than memorising one fixed pattern',
          'One guard has more waypoints so must be faster'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Vision Cones',
      activity: '\uD83D\uDC41\uFE0F Cones',
      goal: 'Draw a vision cone for each guard.',
      checkpoint: 'Each red dot should now have a yellow cone sweeping in its direction of travel.',
      points: [
        'Same vision cone logic as Part 1, applied to each guard in a loop',
        'ctx.save() and ctx.restore() keep each cone rotation isolated',
        'Guard 1 and Guard 2 use the same visionRange and visionAngle',
        'The cones sweep independently as guards drift out of sync'
      ],
      challenge: '\uD83E\uDD16 Draw a cone for each guard in a loop:',
      starter: 'for guard in guards:\n    # Save, translate to guard center, rotate to guard.angle\n    ctx.save()\n    ctx.translate(guard.x + 8, guard.y + 8)\n    ctx.rotate(___)\n    # Draw the cone arc\n    ctx.beginPath()\n    ctx.moveTo(0, 0)\n    ctx.arc(0, 0, visionRange, -visionAngle, ___)\n    ctx.fill()\n    ctx.restore()',
      solution: 'for guard in guards:\n    # Save, translate to guard center, rotate to guard.angle\n    ctx.save()\n    ctx.translate(guard.x + 8, guard.y + 8)\n    ctx.rotate(guard.angle)\n    # Draw the cone arc\n    ctx.beginPath()\n    ctx.moveTo(0, 0)\n    ctx.arc(0, 0, visionRange, -visionAngle, visionAngle)\n    ctx.fill()\n    ctx.restore()',
      checks: ['guard.angle', 'visionAngle', 'ctx.save', 'ctx.restore'],
      height: 200,
      fills: {
        text: 'ctx.save() and ctx.restore() prevent the rotation of one cone from ___ the next.',
        answers: ['affecting']
      },
      quiz: {
        question: 'Why call ctx.save() before rotating for each cone?',
        options: [
          'It makes the drawing faster',
          'Without save/restore, each rotation compounds on the last - the second cone would be rotated by both its own angle and the first guard angle',
          'ctx.rotate requires it'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Distraction Items',
      activity: '\uD83E\uDEA8 Distract',
      goal: 'Throw rocks with Space to distract guards away from their patrol.',
      checkpoint: 'Press Space - a purple dot should appear ahead of you. Throw one near a guard - the guard should turn to face it.',
      points: [
        'Space throws a rock in the direction you are moving',
        'Rocks have a life counter - they disappear after 120 frames (~2 seconds)',
        'Guards within 80 pixels of a rock turn to face it instead of patrolling',
        'Distraction creates a time window to sneak past'
      ],
      challenge: '\uD83E\uDD16 Write the distraction check:',
      starter: '# For each guard, check if any rock is close\nfor guard in guards:\n    var distracted = false\n    for rock in rocks:\n        var dist = abs(rock.x - guard.x) + abs(rock.y - guard.y)\n        if dist < ___:\n            guard.angle = atan2(rock.y - guard.y, rock.x - guard.x)\n            distracted = ___\n            break\n    if not distracted:\n        # Continue normal patrol...',
      solution: '# For each guard, check if any rock is close\nfor guard in guards:\n    var distracted = false\n    for rock in rocks:\n        var dist = abs(rock.x - guard.x) + abs(rock.y - guard.y)\n        if dist < 80:\n            guard.angle = atan2(rock.y - guard.y, rock.x - guard.x)\n            distracted = true\n            break\n    if not distracted:\n        # Continue normal patrol...',
      checks: ['80', 'distracted', 'atan2'],
      height: 200,
      fills: {
        text: 'Distracted guards turn to face the rock but do not ___ toward it. The distraction lasts ___ frames.',
        answers: ['move', '120']
      },
      quiz: {
        question: 'Why make rocks disappear after a short time?',
        options: [
          'To keep the memory usage low',
          'A permanent distraction would trivialise the game - time-limited rocks force the player to move quickly during the window they create',
          'Canvas cannot draw too many objects'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Detection System',
      activity: '\uD83D\uDEA8 Detect',
      goal: 'Trigger caught state if either guard spots the player.',
      checkpoint: 'Walk into either guard cone - a red SPOTTED overlay should appear. Rocks should still distract guards.',
      points: [
        'Check vision cone detection for every guard in the loop',
        'If any guard spots the player, set gameState to "caught"',
        'Distraction check runs first - a guard looking at a rock cannot spot the player',
        'This gives distraction its strategic value'
      ],
      challenge: '\uD83E\uDD16 Write detection for all guards:',
      starter: '# Check each guard for player detection\nfor guard in guards:\n    var pdx = player_x - guard.x\n    var pdy = player_y - guard.y\n    var pDist = abs(pdx) + abs(pdy)\n    var pAngle = atan2(pdy, pdx)\n    var diff = abs(pAngle - guard.angle)\n    if pDist < ___ and diff < visionAngle:\n        game_state = "___"',
      solution: '# Check each guard for player detection\nfor guard in guards:\n    var pdx = player_x - guard.x\n    var pdy = player_y - guard.y\n    var pDist = abs(pdx) + abs(pdy)\n    var pAngle = atan2(pdy, pdx)\n    var diff = abs(pAngle - guard.angle)\n    if pDist < visionRange and diff < visionAngle:\n        game_state = "caught"',
      checks: ['visionRange', 'caught', 'guard.angle'],
      height: 180,
      fills: {
        text: 'Detection loops over ___ guards. Distraction runs ___ detection, so a rock effectively blocks the vision cone.',
        answers: ['all', 'before']
      },
      quiz: {
        question: 'What makes the distraction mechanic feel fair?',
        options: [
          'The rock glows a bright colour',
          'Distraction is checked before detection - so the guard is already looking away before any detection check runs, with no frame where both happen',
          'The distraction radius is larger than the vision cone'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Levels & Victory',
      activity: '\uD83C\uDFC6 Levels',
      goal: 'Reach EXIT to win; press R to restart. Level counter displayed.',
      checkpoint: 'Sneak past both guards to the green EXIT. The green ESCAPED overlay should appear. Press R to try again.',
      points: [
        'Check player overlap with the exit rectangle',
        'Win state shows a green overlay; caught state shows red',
        'Press R to reset player, guards and rocks',
        'Level counter in corner gives a sense of progression for multiple playthroughs'
      ],
      challenge: '\uD83E\uDD16 Write the exit check and win state:',
      starter: '# Check exit overlap\nif player_x + 16 > exit_x and player_x < exit_x + exit_w:\n    if player_y + 16 > exit_y and player_y < exit_y + ___:\n        game_state = "___"',
      solution: '# Check exit overlap\nif player_x + 16 > exit_x and player_x < exit_x + exit_w:\n    if player_y + 16 > exit_y and player_y < exit_y + exit_h:\n        game_state = "win"',
      checks: ['exit_h', 'win'],
      height: 120,
      fills: {
        text: 'The game has three states: play, ___, and ___.',
        answers: ['caught', 'win']
      },
      quiz: {
        question: 'What skill does this level build toward in Godot?',
        options: [
          'Shader programming',
          'NavigationAgent2D with multiple agents, Area2D-based detection, and signal-driven distraction responses',
          'AnimationPlayer keyframes'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '\uD83C\uDFE0 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and build your multi-guard stealth level.',
      checkpoint: 'Fill in as many fields as you like, then hit Apply to see your card.',
      points: [
        'At home: duplicate your Part 1 Godot project and add a second guard node',
        'Use NavigationAgent2D on each guard for path-following',
        'Add an Area2D for the distraction zone - connect body_entered to an investigate function',
        'Export your distraction radius and vision angle as @export variables for easy tuning'
      ],
      challenge: '\u270F\uFE0F Fill in your Mod Card:',
      starter: '# My Multi-Guard Mod Card\nGame name: ___\nPlayer colour: ___\nNumber of guards: ___\nDistraction item: ___\nMap theme: ___\nGuard speed: ___\nOne thing to add at home: ___',
      solution: '# My Multi-Guard Mod Card\nGame name: Night Shift\nPlayer colour: purple\nNumber of guards: 3\nDistraction item: coin\nMap theme: office building\nGuard speed: 1.5\nOne thing to add at home: alert state where guard calls backup',
      checks: [],
      height: 180,
      fills: {
        text: 'At home I will make ___ guards. My distraction item will be a ___.',
        answers: ['3', 'coin']
      }
    }
  ]
};
