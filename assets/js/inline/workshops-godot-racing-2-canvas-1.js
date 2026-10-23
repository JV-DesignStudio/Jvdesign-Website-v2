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

var PLAYER_VARS = 'let px=190,py=340,pAngle=0,pSpeed=0,maxSpeed=4,drift=0;';
var AI_VARS = 'let ai=[' +
  '{x:160,y:340,angle:0,speed:2.8,lap:0,waypt:0,boost:0},' +
  '{x:220,y:340,angle:0,speed:2.5,lap:0,waypt:0,boost:0}' +
  '];' +
  'let track=[{x:200,y:60},{x:340,y:80},{x:360,y:200},{x:340,y:320},{x:200,y:360},{x:60,y:320},{x:40,y:200},{x:60,y:80}];';
var POWERUP_VARS = 'let powerups=[{x:200,y:140,active:true},{x:340,y:200,active:true},{x:60,y:260,active:true}];let boostTimer=0;';
var LAP_VARS = 'let pLap=0,pWaypt=0,race="play",frameCount=0;';
var KEYS = 'let leftHeld=false,rightHeld=false,upHeld=false,downHeld=false;' +
  'document.addEventListener("keydown",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;' +
    'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=true;' +
    'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=true;' +
    'e.preventDefault()});' +
  'document.addEventListener("keyup",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false;' +
    'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=false;' +
    'if(e.code==="ArrowDown"||e.code==="KeyS")downHeld=false});';

var DRAW_TRACK = 'ctx.strokeStyle="#334155";ctx.lineWidth=48;ctx.beginPath();ctx.moveTo(track[0].x,track[0].y);for(var ti=1;ti<track.length;ti++)ctx.lineTo(track[ti].x,track[ti].y);ctx.closePath();ctx.stroke();' +
  'ctx.strokeStyle="#1e293b";ctx.lineWidth=46;ctx.beginPath();ctx.moveTo(track[0].x,track[0].y);for(var ti2=1;ti2<track.length;ti2++)ctx.lineTo(track[ti2].x,track[ti2].y);ctx.closePath();ctx.stroke();' +
  'ctx.strokeStyle="#475569";ctx.lineWidth=2;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(track[0].x,track[0].y);for(var ti3=1;ti3<track.length;ti3++)ctx.lineTo(track[ti3].x,track[ti3].y);ctx.closePath();ctx.stroke();ctx.setLineDash([]);';
var DRAW_POWERUPS = 'for(var pi=0;pi<powerups.length;pi++){if(powerups[pi].active){ctx.fillStyle="#22c55e";ctx.beginPath();ctx.arc(powerups[pi].x,powerups[pi].y,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 10px monospace";ctx.textAlign="center";ctx.fillText("B",powerups[pi].x,powerups[pi].y+4)}}';
var DRAW_AI = 'for(var ai2i=0;ai2i<ai.length;ai2i++){var a=ai[ai2i];ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle);ctx.fillStyle=ai2i===0?"#f43f5e":"#fb923c";ctx.fillRect(-8,-5,16,10);ctx.restore()}';
var DRAW_PLAYER_CAR = 'ctx.save();ctx.translate(px,py);ctx.rotate(pAngle+(drift*0.3));ctx.fillStyle=boostTimer>0?"#facc15":"#60a5fa";ctx.fillRect(-8,-5,16,10);ctx.restore();';
var DRAW_HUD = 'ctx.fillStyle="#fff";ctx.font="bold 14px monospace";ctx.textAlign="left";ctx.fillText("Lap: "+(pLap+1)+"/3",8,20);' +
  'if(boostTimer>0){ctx.fillStyle="#facc15";ctx.fillText("BOOST!",8,38)}';
var DRAW_MINIMAP = 'ctx.fillStyle="rgba(15,23,42,0.8)";ctx.fillRect(310,310,80,80);' +
  'ctx.strokeStyle="#475569";ctx.lineWidth=1;ctx.beginPath();' +
  'for(var mi=0;mi<track.length;mi++){var mp=track[mi];if(mi===0)ctx.moveTo(310+mp.x*0.2,310+mp.y*0.2);else ctx.lineTo(310+mp.x*0.2,310+mp.y*0.2)}ctx.closePath();ctx.stroke();' +
  'ctx.fillStyle="#60a5fa";ctx.beginPath();ctx.arc(310+px*0.2,310+py*0.2,2,0,Math.PI*2);ctx.fill();' +
  'for(var ai3i=0;ai3i<ai.length;ai3i++){ctx.fillStyle=ai3i===0?"#f43f5e":"#fb923c";ctx.beginPath();ctx.arc(310+ai[ai3i].x*0.2,310+ai[ai3i].y*0.2,2,0,Math.PI*2);ctx.fill()}';

function wbWrap(presetup, blobSrc, afterBlob) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob);
}

window.CW_CONFIG = {
  storageKey: 'jvds-godot-racing2-canvas',
  downloadName: 'my-godot-racing-2.html',
  nextStep: { url: '/workshops/godot-puzzle-canvas.html', label: 'Godot Puzzle' },

  hints: [
    'A blue car on a looping oval track with two AI opponents',
    'AI cars follow the track waypoints and try to keep up with you',
    'Green B pickups on the track give a short speed boost',
    'Drifting turns the car faster at the cost of some traction',
    'The minimap in the corner shows all three cars at once',
    'First to 3 laps wins the race',
    'Your mod card - customise your racer to take home to Godot'
  ],

  templates: {
    1: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + AI_VARS + POWERUP_VARS + LAP_VARS + KEYS,
        gdscriptToJs(u),
        'function loop(){frameCount++;' +
        'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,400);' +
        DRAW_TRACK + DRAW_POWERUPS + DRAW_AI + DRAW_PLAYER_CAR + DRAW_HUD + DRAW_MINIMAP +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + AI_VARS + POWERUP_VARS + LAP_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){frameCount++;' +
        'if(typeof cwStep==="function")cwStep();' +
        'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,400);' +
        DRAW_TRACK + DRAW_POWERUPS + DRAW_AI + DRAW_PLAYER_CAR + DRAW_HUD + DRAW_MINIMAP +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + AI_VARS + POWERUP_VARS + LAP_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){frameCount++;' +
        'for(var aii=0;aii<ai.length;aii++){var a=ai[aii];var wt=track[a.waypt];var adx=wt.x-a.x,ady=wt.y-a.y;var adist=Math.sqrt(adx*adx+ady*ady);if(adist<20){a.waypt=(a.waypt+1)%track.length;if(a.waypt===0)a.lap++}a.angle=Math.atan2(ady,adx);a.x+=Math.cos(a.angle)*a.speed;a.y+=Math.sin(a.angle)*a.speed;if(a.boost>0){a.x+=Math.cos(a.angle)*1.5;a.y+=Math.sin(a.angle)*1.5;a.boost--}}' +
        'if(typeof cwStep==="function")cwStep();' +
        'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,400);' +
        DRAW_TRACK + DRAW_POWERUPS + DRAW_AI + DRAW_PLAYER_CAR + DRAW_HUD + DRAW_MINIMAP +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + AI_VARS + POWERUP_VARS + LAP_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){frameCount++;' +
        'for(var aii=0;aii<ai.length;aii++){var a=ai[aii];var wt=track[a.waypt];var adx=wt.x-a.x,ady=wt.y-a.y;var adist=Math.sqrt(adx*adx+ady*ady);if(adist<20){a.waypt=(a.waypt+1)%track.length;if(a.waypt===0)a.lap++}a.angle=Math.atan2(ady,adx);a.x+=Math.cos(a.angle)*a.speed;a.y+=Math.sin(a.angle)*a.speed}' +
        'if(boostTimer>0)boostTimer--;' +
        'for(var puii=0;puii<powerups.length;puii++){if(powerups[puii].active){var pudx=px-powerups[puii].x,pudy=py-powerups[puii].y;if(Math.sqrt(pudx*pudx+pudy*pudy)<18){powerups[puii].active=false;boostTimer=90}}}' +
        'if(typeof cwStep==="function")cwStep();' +
        'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,400);' +
        DRAW_TRACK + DRAW_POWERUPS + DRAW_AI + DRAW_PLAYER_CAR + DRAW_HUD + DRAW_MINIMAP +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + AI_VARS + POWERUP_VARS + LAP_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){frameCount++;' +
        'if(race==="play"){' +
        'var turnRate=0.06;if(upHeld){pSpeed=Math.min(pSpeed+0.2,maxSpeed+(boostTimer>0?2:0))}else{pSpeed=Math.max(pSpeed-0.1,0)}' +
        'if(leftHeld){pAngle-=turnRate+(Math.abs(drift)*0.01);drift=Math.max(drift-0.3,-8)}else if(rightHeld){pAngle+=turnRate+(Math.abs(drift)*0.01);drift=Math.min(drift+0.3,8)}else{drift*=0.85}' +
        'px+=Math.cos(pAngle)*pSpeed;py+=Math.sin(pAngle)*pSpeed;' +
        'px=Math.max(10,Math.min(390,px));py=Math.max(10,Math.min(390,py));' +
        'for(var aii=0;aii<ai.length;aii++){var a=ai[aii];var wt=track[a.waypt];var adx=wt.x-a.x,ady=wt.y-a.y;var adist=Math.sqrt(adx*adx+ady*ady);if(adist<20){a.waypt=(a.waypt+1)%track.length;if(a.waypt===0)a.lap++}a.angle=Math.atan2(ady,adx);a.x+=Math.cos(a.angle)*a.speed;a.y+=Math.sin(a.angle)*a.speed}' +
        'if(boostTimer>0)boostTimer--;' +
        'for(var puii=0;puii<powerups.length;puii++){if(powerups[puii].active){var pudx=px-powerups[puii].x,pudy=py-powerups[puii].y;if(Math.sqrt(pudx*pudx+pudy*pudy)<18){powerups[puii].active=false;boostTimer=90}}}' +
        'var wt2=track[pWaypt];var wdx=px-wt2.x,wdy=py-wt2.y;if(Math.sqrt(wdx*wdx+wdy*wdy)<30){pWaypt=(pWaypt+1)%track.length;if(pWaypt===0){pLap++;if(pLap>=3)race="win"}}' +
        'if(typeof cwStep==="function")cwStep();' +
        '}' +
        'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,400);' +
        DRAW_TRACK + DRAW_POWERUPS + DRAW_AI + DRAW_PLAYER_CAR + DRAW_HUD + DRAW_MINIMAP +
        'if(race==="win"){ctx.fillStyle="rgba(34,197,94,0.3)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("YOU WIN!",200,180);ctx.font="16px monospace";ctx.fillText("Refresh to race again",200,220)}' +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + AI_VARS + POWERUP_VARS + LAP_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){frameCount++;' +
        'if(race==="play"){' +
        'var turnRate=0.06;if(upHeld){pSpeed=Math.min(pSpeed+0.2,maxSpeed+(boostTimer>0?2:0))}else{pSpeed=Math.max(pSpeed-0.1,0)}' +
        'if(leftHeld){pAngle-=turnRate+(Math.abs(drift)*0.01);drift=Math.max(drift-0.3,-8)}else if(rightHeld){pAngle+=turnRate+(Math.abs(drift)*0.01);drift=Math.min(drift+0.3,8)}else{drift*=0.85}' +
        'px+=Math.cos(pAngle)*pSpeed;py+=Math.sin(pAngle)*pSpeed;' +
        'px=Math.max(10,Math.min(390,px));py=Math.max(10,Math.min(390,py));' +
        'for(var aii=0;aii<ai.length;aii++){var a=ai[aii];var wt=track[a.waypt];var adx=wt.x-a.x,ady=wt.y-a.y;var adist=Math.sqrt(adx*adx+ady*ady);if(adist<20){a.waypt=(a.waypt+1)%track.length;if(a.waypt===0){a.lap++;if(a.lap>=3&&race==="play")race="lose"}}a.angle=Math.atan2(ady,adx);var aspeed=a.speed+(a.boost>0?1.5:0);a.x+=Math.cos(a.angle)*aspeed;a.y+=Math.sin(a.angle)*aspeed;if(a.boost>0)a.boost--}' +
        'if(boostTimer>0)boostTimer--;' +
        'for(var puii=0;puii<powerups.length;puii++){if(powerups[puii].active){var pudx=px-powerups[puii].x,pudy=py-powerups[puii].y;if(Math.sqrt(pudx*pudx+pudy*pudy)<18){powerups[puii].active=false;boostTimer=90}var audx=ai[0].x-powerups[puii].x,audy=ai[0].y-powerups[puii].y;if(Math.sqrt(audx*audx+audy*audy)<18){powerups[puii].active=false;ai[0].boost=60}}}' +
        'var wt2=track[pWaypt];var wdx=px-wt2.x,wdy=py-wt2.y;if(Math.sqrt(wdx*wdx+wdy*wdy)<30){pWaypt=(pWaypt+1)%track.length;if(pWaypt===0){pLap++;if(pLap>=3)race="win"}}' +
        'if(typeof cwStep==="function")cwStep();' +
        '}' +
        'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,400);' +
        DRAW_TRACK + DRAW_POWERUPS + DRAW_AI + DRAW_PLAYER_CAR + DRAW_HUD + DRAW_MINIMAP +
        'ctx.fillStyle="#94a3b8";ctx.font="12px monospace";ctx.textAlign="right";ctx.fillText("AI1: Lap "+(ai[0].lap+1),392,20);ctx.fillText("AI2: Lap "+(ai[1].lap+1),392,36);' +
        'if(race==="win"){ctx.fillStyle="rgba(34,197,94,0.3)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("YOU WIN!",200,180);ctx.font="16px monospace";ctx.fillText("Refresh to race again",200,220)}' +
        'if(race==="lose"){ctx.fillStyle="rgba(239,68,68,0.3)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("AI WINS",200,180);ctx.font="16px monospace";ctx.fillText("Refresh to race again",200,220)}' +
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
        'h2{color:#f59e0b;margin:0 0 12px}' +
        '.card{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:16px}' +
        '.row{display:flex;gap:8px;margin:6px 0;align-items:baseline}' +
        '.lbl{color:#94a3b8;min-width:160px;font-size:.85rem}' +
        '.val{color:#f1f5f9;font-weight:bold}' +
        '.tip{margin-top:14px;padding:10px;background:#0f172a;border-left:3px solid #f59e0b;font-size:.82rem;color:#94a3b8}' +
        '</style>' +
        '<div class="card"><h2>🏠 My Racing 2 Mod Card</h2>';
      var order = ['Game name','Car colour','Number of laps','Number of AI cars','Power-up type','Track shape','One thing to add at home'];
      order.forEach(function(k) {
        if (fields[k]) html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
      });
      html += '<div class="tip">💡 At home: open Godot, create a Path2D for your track shape and attach a PathFollow2D for each AI car. Use a RigidBody2D for the player car so drifting uses real physics forces!</div></div>';
      var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
      return cwBlobWrap('<style>body{margin:0;background:#0f172a}</style>', '<div></div>', '', blob, '');
    }
  },

  steps: [
    {
      num: 1,
      title: 'AI Opponents',
      activity: '🤖 AI cars',
      goal: 'Add two AI car opponents that share the track with you.',
      checkpoint: 'You should see two extra coloured rectangles on the track - red and orange AI cars.',
      points: [
        'Each AI car has its own position, angle, speed, lap count and waypoint index',
        'AI cars share the same track waypoints as the player',
        'Two opponents at different speeds create natural spacing on the track',
        'In Godot you would use PathFollow2D nodes attached to a Path2D for AI cars'
      ],
      challenge: '🤖 Set the AI car starting positions:',
      starter: '# AI car 1 starts slightly left of center\nvar ai1_x = 160\nvar ai1_y = ___\n\n# AI car 2 starts slightly right of center\nvar ai2_x = ___\nvar ai2_y = 340',
      solution: '# AI car 1 starts slightly left of center\nvar ai1_x = 160\nvar ai1_y = 340\n\n# AI car 2 starts slightly right of center\nvar ai2_x = 220\nvar ai2_y = 340',
      checks: ['340', '220'],
      height: 130,
      fills: {
        text: 'All three cars start near y=___. AI cars follow the track ___, not the player.',
        answers: ['340', 'waypoints']
      },
      quiz: {
        question: 'Why use waypoints for AI cars instead of chasing the player?',
        options: [
          'Waypoints are easier to code',
          'Waypoints keep AI on the track - chasing the player would cut corners or drive off-road',
          'The player must not be followed'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'AI Movement',
      activity: '🔄 AI move',
      goal: 'Make AI cars follow the track waypoints smoothly.',
      checkpoint: 'The red and orange cars should now drive around the track loop on their own.',
      points: [
        'Each AI steers toward its current waypoint, then advances to the next',
        'Use atan2 to get the angle toward the waypoint',
        'Advance to next waypoint when distance is below 20 pixels',
        'Track length modulo wraps from the last waypoint back to the first'
      ],
      challenge: '🤖 Write AI movement toward current waypoint:',
      starter: '# For each AI car\nfor car in ai_cars:\n    var target = track[car.waypt]\n    var dx = target.x - car.x\n    var dy = target.y - car.y\n    var dist = abs(dx) + abs(dy)\n    if dist < ___:\n        car.waypt = (car.waypt + 1) % track.length\n    car.angle = atan2(dy, dx)\n    car.x += cos(car.angle) * ___\n    car.y += sin(car.angle) * car.speed',
      solution: '# For each AI car\nfor car in ai_cars:\n    var target = track[car.waypt]\n    var dx = target.x - car.x\n    var dy = target.y - car.y\n    var dist = abs(dx) + abs(dy)\n    if dist < 20:\n        car.waypt = (car.waypt + 1) % track.length\n    car.angle = atan2(dy, dx)\n    car.x += cos(car.angle) * car.speed\n    car.y += sin(car.angle) * car.speed',
      checks: ['20', 'car.speed', 'atan2', 'track.length'],
      height: 200,
      fills: {
        text: 'AI cars advance to the next waypoint when they are within ___ pixels. The track has ___ waypoints.',
        answers: ['20', '8']
      },
      quiz: {
        question: 'What happens if the waypoint threshold is too small (e.g. 1 pixel)?',
        options: [
          'The AI drives faster',
          'The AI may miss the waypoint and oscillate past it, causing jitter or the car to drive in circles',
          'The AI stops completely'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Power-Up Spawning',
      activity: '💚 Power-up',
      goal: 'Collect green B pickups on the track to get a speed boost.',
      checkpoint: 'Drive over a green B circle - it should disappear and your car should turn yellow briefly.',
      points: [
        'Three power-up positions are pre-set around the track',
        'Each has an active flag that goes false when collected',
        'Check distance from player to each active power-up',
        'On collect: set boostTimer to 90 frames (about 1.5 seconds)'
      ],
      challenge: '🤖 Write the power-up collection check:',
      starter: '# Check each power-up\nfor pu in powerups:\n    if pu.active:\n        var dist = abs(player_x - pu.x) + abs(player_y - pu.y)\n        if dist < ___:\n            pu.active = ___\n            boost_timer = 90',
      solution: '# Check each power-up\nfor pu in powerups:\n    if pu.active:\n        var dist = abs(player_x - pu.x) + abs(player_y - pu.y)\n        if dist < 18:\n            pu.active = false\n            boost_timer = 90',
      checks: ['18', 'false', 'boost_timer'],
      height: 160,
      fills: {
        text: 'Power-ups are collected within ___ pixels. The boost lasts ___ frames at 60fps.',
        answers: ['18', '90']
      },
      quiz: {
        question: 'Why use a timer instead of a flag for the boost?',
        options: [
          'Timers use less memory',
          'A timer lets the boost last a defined duration - a flag would just stay on forever until the player toggled it',
          'GDScript requires timers'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Boost Effect',
      activity: '⚡ Boost',
      goal: 'Boost raises max speed and changes car colour to yellow.',
      checkpoint: 'Collect a power-up - your car turns yellow and accelerates noticeably for a second or two.',
      points: [
        'While boostTimer > 0: increase maxSpeed by 2 and colour the car yellow',
        'boostTimer decrements by 1 each frame, so it expires naturally',
        'AI cars can also pick up boosts - they get a speed bonus for 60 frames',
        'Visual feedback (yellow car) tells the player the boost is active without needing a UI bar'
      ],
      challenge: '🤖 Apply the boost speed and colour:',
      starter: '# Player car colour and max speed\nif boost_timer > 0:\n    car_colour = "yellow"\n    current_max_speed = max_speed + ___\n    boost_timer -= 1\nelse:\n    car_colour = "blue"\n    current_max_speed = ___',
      solution: '# Player car colour and max speed\nif boost_timer > 0:\n    car_colour = "yellow"\n    current_max_speed = max_speed + 2\n    boost_timer -= 1\nelse:\n    car_colour = "blue"\n    current_max_speed = max_speed',
      checks: ['2', 'boost_timer', 'max_speed'],
      height: 160,
      fills: {
        text: 'The boost adds ___ to max speed. Visual feedback changes car colour to ___ during boost.',
        answers: ['2', 'yellow']
      },
      quiz: {
        question: 'Why give AI cars access to boosts too?',
        options: [
          'To fill the track with colour',
          'If only the player gets boosts the race feels unbalanced - AI collecting them forces the player to compete for pickups',
          'AI cars need boosts to keep up with physics'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Drifting',
      activity: '🏎️ Drift',
      goal: 'Hold left/right while moving to drift - the car turns faster but slides sideways.',
      checkpoint: 'Drive fast and hold left or right - the car should visibly skew and turn tighter than normal.',
      points: [
        'drift variable accumulates when steering; it decays when releasing keys (drift *= 0.85)',
        'Turn rate increases slightly with abs(drift) - faster spin at higher drift',
        'Car rendering adds drift * 0.3 to the rotation angle for a skid visual',
        'In Godot you would apply a lateral impulse using RigidBody2D to simulate real drift physics'
      ],
      challenge: '🤖 Write the drift accumulation:',
      starter: '# Accumulate drift when turning\nif left_held:\n    drift = max(drift - 0.3, ___)\nelif right_held:\n    drift = min(drift + 0.3, ___)\nelse:\n    drift *= 0.85',
      solution: '# Accumulate drift when turning\nif left_held:\n    drift = max(drift - 0.3, -8)\nelif right_held:\n    drift = min(drift + 0.3, 8)\nelse:\n    drift *= 0.85',
      checks: ['-8', '8', '0.85', 'drift'],
      height: 140,
      fills: {
        text: 'Drift is clamped between ___ and ___. When no key is held it decays by multiplying by ___.',
        answers: ['-8', '8', '0.85']
      },
      quiz: {
        question: 'Why clamp drift to a maximum value?',
        options: [
          'To prevent divide-by-zero errors',
          'Without a cap, drift would grow infinitely making the car spin uncontrollably',
          'Canvas cannot rotate beyond 8 radians'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Minimap & Finish',
      activity: '🗺️ Minimap',
      goal: 'Show all cars on a minimap. First to 3 laps wins.',
      checkpoint: 'Check the bottom-right corner - three dots should show all car positions on a small track outline.',
      points: [
        'Minimap scales positions by 0.2 to fit in an 80x80 corner box',
        'Each car is a 2px dot in its own colour',
        'Lap counter increments each time the player passes waypoint 0',
        '3 laps triggers the win state with a green overlay'
      ],
      challenge: '🤖 Write the lap counter:',
      starter: '# Increment lap when passing start waypoint\nvar dist_to_wp = abs(player_x - track[player_waypt].x) + abs(player_y - track[player_waypt].y)\nif dist_to_wp < 30:\n    player_waypt = (player_waypt + 1) % track.length\n    if player_waypt == ___:\n        player_lap += 1\n        if player_lap >= ___:\n            race_state = "win"',
      solution: '# Increment lap when passing start waypoint\nvar dist_to_wp = abs(player_x - track[player_waypt].x) + abs(player_y - track[player_waypt].y)\nif dist_to_wp < 30:\n    player_waypt = (player_waypt + 1) % track.length\n    if player_waypt == 0:\n        player_lap += 1\n        if player_lap >= 3:\n            race_state = "win"',
      checks: ['0', '3', 'player_lap'],
      height: 180,
      fills: {
        text: 'A lap completes when player_waypt wraps back to ___. The race ends after ___ complete laps.',
        answers: ['0', '3']
      },
      quiz: {
        question: 'Why track waypoint index to count laps rather than measuring distance from start?',
        options: [
          'Distance calculations are too slow',
          'The player could drive backward past the start line and gain fake laps - waypoint order ensures the full track was completed in the right direction',
          'Waypoints are required by Godot'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '🏠 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and build your advanced racing game.',
      checkpoint: 'Fill in as many fields as you want, then hit Apply to see your card.',
      points: [
        'At home: open Godot and create a Path2D node, then draw your track shape',
        'Add a PathFollow2D with a RigidBody2D child for each AI car',
        'Use a separate RigidBody2D for the player with apply_central_force for acceleration',
        'Add an Area2D with a CollisionShape2D as child for each power-up pickup'
      ],
      challenge: '✏️ Fill in your Mod Card:',
      starter: '# My Racing 2 Mod Card\nGame name: ___\nCar colour: ___\nNumber of laps: ___\nNumber of AI cars: ___\nPower-up type: ___\nTrack shape: ___\nOne thing to add at home: ___',
      solution: '# My Racing 2 Mod Card\nGame name: Turbo Grid\nCar colour: green\nNumber of laps: 5\nNumber of AI cars: 3\nPower-up type: speed boost\nTrack shape: figure-8\nOne thing to add at home: weather effect that changes grip',
      checks: [],
      height: 180,
      fills: {
        text: 'At home I want ___ laps and my track will be a ___.',
        answers: ['5', 'figure-8']
      }
    }
  ]
};
