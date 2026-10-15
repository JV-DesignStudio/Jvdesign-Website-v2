'use strict';

/* ===================================================
   GDScript-to-JS transpiler (light transform so
   GDScript syntax runs in the canvas iframe)
   =================================================== */
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

/* ===================================================
   IFRAME BUILDING BLOCKS (Godot Racing)
   =================================================== */

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#1a1a2e;margin:0;overflow:hidden}canvas{display:block;cursor:pointer}</style>';

var CANVAS_TAG = '<canvas id="game" width="600" height="400"></canvas>';

var SETUP = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var CAR_VARS = 'let carX=270,carY=320,carW=60,carH=40,carSpeed=0,maxSpeed=6,steer=0;';

var ROAD_VARS = 'let roadOffset=0,laneW=200,roadX=200;';

var OBS_VARS = 'let obs=[];for(let i=0;i<3;i++)obs.push({x:220+Math.floor(Math.random()*160),y:-100-i*200,w:40,h:40});';

var LAP_VARS = 'let distance=0,lapLength=3000,lap=0,bestTime=Infinity,lapTimer=0,frameCount=0;';

var STATE_VARS = 'let gameState="play";';

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

var DRAW_ROAD = 'ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,600,400);' +
  'ctx.fillStyle="#444";ctx.fillRect(roadX,0,laneW,400);' +
  'ctx.strokeStyle="#ffff00";ctx.setLineDash([20,20]);ctx.lineDashOffset=-roadOffset;' +
  'ctx.beginPath();ctx.moveTo(roadX+laneW/2,0);ctx.lineTo(roadX+laneW/2,400);ctx.stroke();ctx.setLineDash([]);';

var DRAW_CAR = 'ctx.fillStyle="#60a5fa";ctx.fillRect(carX,carY,carW,carH);' +
  'ctx.fillStyle="#3b82f6";ctx.fillRect(carX+5,carY+2,12,8);ctx.fillRect(carX+carW-17,carY+2,12,8);' +
  'ctx.fillRect(carX+5,carY+carH-10,12,8);ctx.fillRect(carX+carW-17,carY+carH-10,12,8);';

var DRAW_OBS = 'ctx.fillStyle="#f43f5e";for(let i=0;i<obs.length;i++){ctx.fillRect(obs[i].x,obs[i].y,obs[i].w,obs[i].h)}';

var DRAW_HUD = 'ctx.fillStyle="#fff";ctx.font="bold 18px monospace";ctx.textAlign="left";' +
  'ctx.fillText("Speed: "+Math.round(carSpeed*10),10,24);' +
  'ctx.fillText("Lap: "+lap,10,48);' +
  'ctx.textAlign="right";ctx.fillText("Time: "+(lapTimer/60).toFixed(1)+"s",590,24);';

function wrap(code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + CSS_GAME +
    '<\/head><body>' + CANVAS_TAG + '<script>' + code + '<\/script><\/body><\/html>';
}

/* ===================================================
   CW_CONFIG - Godot Racing steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-godot-racing-canvas',
  downloadName: 'my-godot-racing.html',

  hints: [
    'A blue car on a grey road with lane markings',
    'Use the arrow keys to drive the car',
    'The lane dashes scroll to show movement',
    'Red obstacles slide toward the car',
    'Crashing slows the car down',
    'A lap timer counts your laps and best time'
  ],

  templates: {
    1: function(u) {
      return wrap(
        SETUP + CAR_VARS + ROAD_VARS + KEYS +
        'try{eval(' + JSON.stringify(gdscriptToJs(u)) + ')}catch(e){}' +
        'function loop(){' +
        DRAW_ROAD + DRAW_CAR +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(
        SETUP + CAR_VARS + ROAD_VARS + KEYS +
        'function loop(){' +
        'try{eval(' + JSON.stringify(gdscriptToJs(u)) + ')}catch(e){}' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        DRAW_ROAD + DRAW_CAR +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(
        SETUP + CAR_VARS + ROAD_VARS + KEYS +
        'function loop(){' +
        'if(upHeld)carSpeed+=0.15;else carSpeed*=0.98;' +
        'if(downHeld)carSpeed-=0.1;' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        'if(leftHeld)carX-=3;if(rightHeld)carX+=3;' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'try{eval(' + JSON.stringify(gdscriptToJs(u)) + ')}catch(e){}' +
        DRAW_ROAD + DRAW_CAR +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(
        SETUP + CAR_VARS + ROAD_VARS + OBS_VARS + KEYS +
        'function loop(){' +
        'if(upHeld)carSpeed+=0.15;else carSpeed*=0.98;' +
        'if(downHeld)carSpeed-=0.1;' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        'if(leftHeld)carX-=3;if(rightHeld)carX+=3;' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'roadOffset+=carSpeed;' +
        'try{eval(' + JSON.stringify(gdscriptToJs(u)) + ')}catch(e){}' +
        DRAW_ROAD + DRAW_CAR + DRAW_OBS +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(
        SETUP + CAR_VARS + ROAD_VARS + OBS_VARS + KEYS +
        'function loop(){' +
        'if(upHeld)carSpeed+=0.15;else carSpeed*=0.98;' +
        'if(downHeld)carSpeed-=0.1;' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        'if(leftHeld)carX-=3;if(rightHeld)carX+=3;' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'roadOffset+=carSpeed;' +
        'for(var i=0;i<obs.length;i++){obs[i].y+=carSpeed;' +
        'if(obs[i].y>420){obs[i].y=-60;obs[i].x=220+Math.floor(Math.random()*160)}}' +
        'try{eval(' + JSON.stringify(gdscriptToJs(u)) + ')}catch(e){}' +
        DRAW_ROAD + DRAW_CAR + DRAW_OBS +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(
        SETUP + CAR_VARS + ROAD_VARS + OBS_VARS + LAP_VARS + STATE_VARS + KEYS +
        'document.addEventListener("keydown",function(e){if(e.code==="KeyR"&&gameState==="over"){carSpeed=0;distance=0;lap=0;lapTimer=0;gameState="play"}});' +
        'function loop(){' +
        'if(gameState==="play"){' +
        'if(upHeld)carSpeed+=0.15;else carSpeed*=0.98;' +
        'if(downHeld)carSpeed-=0.1;' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        'if(leftHeld)carX-=3;if(rightHeld)carX+=3;' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'roadOffset+=carSpeed;distance+=carSpeed;lapTimer++;' +
        'for(var i=0;i<obs.length;i++){obs[i].y+=carSpeed;' +
        'if(obs[i].y>420){obs[i].y=-60;obs[i].x=220+Math.floor(Math.random()*160)}' +
        'if(carX<obs[i].x+obs[i].w&&carX+carW>obs[i].x&&carY<obs[i].y+obs[i].h&&carY+carH>obs[i].y){carSpeed*=0.3;obs[i].y=420}}' +
        'try{eval(' + JSON.stringify(gdscriptToJs(u)) + ')}catch(e){}' +
        '}' +
        DRAW_ROAD + DRAW_CAR + DRAW_OBS + DRAW_HUD +
        'if(gameState==="over"){ctx.fillStyle="#fff";ctx.font="bold 32px monospace";ctx.textAlign="center";' +
        'ctx.fillText("RACE COMPLETE!",300,180);ctx.font="20px monospace";' +
        'ctx.fillText("Best Lap: "+(bestTime===Infinity?"--":(bestTime/60).toFixed(1)+"s"),300,220);' +
        'ctx.fillText("Press R to race again",300,260)}' +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'The Car and the Road',
      goal: 'Draw the car and the road it drives on.',
      points: [
        'The canvas is 600 wide and 400 tall.',
        'The road is a grey strip down the middle.',
        'The car is a blue rectangle that sits on the road.'
      ],
      challenge: 'Set where the car starts:',
      starter: '# Where does the car start?\nvar car_x = ___\nvar car_y = 320\nvar car_w = ___\nvar car_h = 40',
      solution: '# Where does the car start?\nvar car_x = 270\nvar car_y = 320\nvar car_w = 60\nvar car_h = 40',
      checks: ['270', '60'],
      height: 130
    },
    {
      num: 2,
      title: 'Drive!',
      goal: 'Move the car with the arrow keys.',
      points: [
        'Up speeds up. Down slows down.',
        'Left and Right steer the car.',
        'The car stays on the road.'
      ],
      challenge: 'Write the controls:',
      starter: '# Speed up and slow down\nif Input.is_action_pressed("ui_up"):\n    car_speed += ___\nif Input.is_action_pressed("ui_down"):\n    car_speed -= 0.1\n\n# Steer left and right\nif Input.is_action_pressed("ui_left"):\n    car_x -= ___\nif Input.is_action_pressed("ui_right"):\n    car_x += ___',
      solution: '# Speed up and slow down\nif Input.is_action_pressed("ui_up"):\n    car_speed += 0.15\nif Input.is_action_pressed("ui_down"):\n    car_speed -= 0.1\n\n# Steer left and right\nif Input.is_action_pressed("ui_left"):\n    car_x -= 3\nif Input.is_action_pressed("ui_right"):\n    car_x += 3',
      checks: ['0.15', '3'],
      height: 200
    },
    {
      num: 3,
      title: 'Moving Road',
      goal: 'Make the road markings scroll so the car looks like it is moving.',
      points: [
        'The road stays still. Only the dashes move.',
        'Add the car speed to the dash offset each frame.',
        'The offset wraps around so the dashes keep coming.'
      ],
      challenge: 'Scroll the road:',
      starter: '# Scroll the road markings\nroad_offset += ___\n\n# Wrap it so the dashes keep coming\nif road_offset > ___:\n    road_offset -= ___',
      solution: '# Scroll the road markings\nroad_offset += car_speed\n\n# Wrap it so the dashes keep coming\nif road_offset > 40:\n    road_offset -= 40',
      checks: ['car_speed', '40'],
      height: 150
    },
    {
      num: 4,
      title: 'Obstacles',
      goal: 'Add red obstacles that slide toward the car.',
      points: [
        'Obstacles start above the screen and move down.',
        'When one passes the bottom, send it back to the top.',
        'It comes down a random lane each time.'
      ],
      challenge: 'Move and recycle the obstacles:',
      starter: '# Move each obstacle toward the car\nfor i in range(3):\n    obs[i].y += ___\n    # Send it back to the top if it goes past the bottom\n    if obs[i].y > ___:\n        obs[i].y = -60\n        obs[i].x = 220 + randi() % 160',
      solution: '# Move each obstacle toward the car\nfor i in range(3):\n    obs[i].y += car_speed\n    # Send it back to the top if it goes past the bottom\n    if obs[i].y > 420:\n        obs[i].y = -60\n        obs[i].x = 220 + randi() % 160',
      checks: ['car_speed', '420'],
      height: 180
    },
    {
      num: 5,
      title: 'Crash!',
      goal: 'Slow the car down when it hits an obstacle.',
      points: [
        'Two rectangles crash when they overlap.',
        'On a crash the car slows down a lot.',
        'The obstacle moves away so it only hits once.'
      ],
      challenge: 'Add the crash check:',
      starter: '# Check each obstacle for a crash\nfor i in range(3):\n    if car_x < obs[i].x + obs[i].w and car_x + car_w > obs[i].x and car_y < obs[i].y + obs[i].h and car_y + ___ > obs[i].y:\n        car_speed *= ___\n        obs[i].y = 420',
      solution: '# Check each obstacle for a crash\nfor i in range(3):\n    if car_x < obs[i].x + obs[i].w and car_x + car_w > obs[i].x and car_y < obs[i].y + obs[i].h and car_y + car_h > obs[i].y:\n        car_speed *= 0.3\n        obs[i].y = 420',
      checks: ['car_h', '0.3'],
      height: 150
    },
    {
      num: 6,
      title: 'Lap Timer',
      goal: 'Count your laps and keep your best time.',
      points: [
        'The distance grows every frame.',
        'Every 3000 of distance finishes a lap.',
        'After 3 laps the race ends. Press R to race again.'
      ],
      challenge: 'Track the laps:',
      starter: '# Add to the distance every frame\ndistance += car_speed\n\n# Finish a lap after enough distance\nif distance >= ___:\n    lap += 1\n    distance = 0\n    if lap_timer < best_time:\n        best_time = lap_timer\n    lap_timer = 0\n    if lap >= ___:\n        game_state = "over"',
      solution: '# Add to the distance every frame\ndistance += car_speed\n\n# Finish a lap after enough distance\nif distance >= lap_length:\n    lap += 1\n    distance = 0\n    if lap_timer < best_time:\n        best_time = lap_timer\n    lap_timer = 0\n    if lap >= 3:\n        game_state = "over"',
      checks: ['lap_length', '3'],
      height: 190
    }
  ]
};
