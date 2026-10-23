'use strict';

function wbWrap(presetup, blobSrc, afterBlob) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob);
}

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

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#1a1a2e;margin:0;overflow:hidden}canvas{display:block;cursor:pointer}</style>';

var CANVAS_TAG = '<canvas id="game" width="600" height="400"></canvas>';

var SETUP = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var CAR_VARS = 'let carX=270,carY=320,carW=60,carH=40,carSpeed=0,maxSpeed=6,steer=0;';

var ROAD_VARS = 'let roadOffset=0,laneW=200,roadX=200;';

var OBS_VARS = 'let obs=[];for(let i=0;i<3;i++)obs.push({x:220+Math.floor(Math.random()*160),y:-100-i*200,w:40,h:40});';

var LAP_VARS = 'let distance=0,lapLength=3000,lap=0,bestTime=Infinity,lapTimer=0;';

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

window.CW_CONFIG = {
  storageKey: 'jvds-godot-racing-canvas',
  downloadName: 'my-godot-racing.html',
  nextStep: { url: '/workshops/godot-racing-2-canvas.html', label: 'Godot Racing 2' },

  hints: [
    'A blue car on a grey road with lane markings',
    'Use the arrow keys to drive the car',
    'The lane dashes scroll to show movement',
    'Red obstacles slide toward the car',
    'Crashing slows the car down',
    'A lap timer counts your laps and best time',
    'Your mod card - fill it in and take your ideas home to Godot'
  ],

  templates: {
    1: function(u) {
      return wbWrap(
        SETUP + CAR_VARS + ROAD_VARS + KEYS,
        gdscriptToJs(u),
        'function loop(){' +
        DRAW_ROAD + DRAW_CAR +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wbWrap(
        SETUP + CAR_VARS + ROAD_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(window.cwStep)cwStep();' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        DRAW_ROAD + DRAW_CAR +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wbWrap(
        SETUP + CAR_VARS + ROAD_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(upHeld)carSpeed+=0.15;else carSpeed*=0.98;' +
        'if(downHeld)carSpeed-=0.1;' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        'if(leftHeld)carX-=3;if(rightHeld)carX+=3;' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'if(window.cwStep)cwStep();' +
        DRAW_ROAD + DRAW_CAR +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wbWrap(
        SETUP + CAR_VARS + ROAD_VARS + OBS_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(upHeld)carSpeed+=0.15;else carSpeed*=0.98;' +
        'if(downHeld)carSpeed-=0.1;' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        'if(leftHeld)carX-=3;if(rightHeld)carX+=3;' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'roadOffset+=carSpeed;' +
        'if(window.cwStep)cwStep();' +
        DRAW_ROAD + DRAW_CAR + DRAW_OBS +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wbWrap(
        SETUP + CAR_VARS + ROAD_VARS + OBS_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(upHeld)carSpeed+=0.15;else carSpeed*=0.98;' +
        'if(downHeld)carSpeed-=0.1;' +
        'carSpeed=Math.max(0,Math.min(maxSpeed,carSpeed));' +
        'if(leftHeld)carX-=3;if(rightHeld)carX+=3;' +
        'carX=Math.max(roadX,Math.min(roadX+laneW-carW,carX));' +
        'roadOffset+=carSpeed;' +
        'for(var i=0;i<obs.length;i++){obs[i].y+=carSpeed;' +
        'if(obs[i].y>420){obs[i].y=-60;obs[i].x=220+Math.floor(Math.random()*160)}}' +
        'if(window.cwStep)cwStep();' +
        DRAW_ROAD + DRAW_CAR + DRAW_OBS +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wbWrap(
        SETUP + CAR_VARS + ROAD_VARS + OBS_VARS + LAP_VARS + STATE_VARS + KEYS +
        'document.addEventListener("keydown",function(e){if(e.code==="KeyR"&&gameState==="over"){carSpeed=0;distance=0;lap=0;lapTimer=0;gameState="play"}});',
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
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
        'if(window.cwStep)cwStep();' +
        'if(distance>=lapLength){lap++;distance=0;if(lapTimer<bestTime)bestTime=lapTimer;lapTimer=0;if(lap>=3)gameState="over"}' +
        '}' +
        DRAW_ROAD + DRAW_CAR + DRAW_OBS + DRAW_HUD +
        'if(gameState==="over"){ctx.fillStyle="#fff";ctx.font="bold 32px monospace";ctx.textAlign="center";' +
        'ctx.fillText("RACE COMPLETE!",300,180);ctx.font="20px monospace";' +
        'ctx.fillText("Best Lap: "+(bestTime===Infinity?"--":(bestTime/60).toFixed(1)+"s"),300,220);' +
        'ctx.fillText("Press R to race again",300,260)}' +
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
      var html = '<style>body{font-family:monospace;background:#1a1a2e;color:#e2e8f0;padding:16px;margin:0}' +
        'h2{color:#60a5fa;margin:0 0 12px}' +
        '.card{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:16px}' +
        '.row{display:flex;gap:8px;margin:6px 0;align-items:baseline}' +
        '.lbl{color:#94a3b8;min-width:160px;font-size:.85rem}' +
        '.val{color:#f1f5f9;font-weight:bold}' +
        '.tip{margin-top:14px;padding:10px;background:#0f172a;border-left:3px solid #60a5fa;font-size:.82rem;color:#94a3b8}' +
        '</style>' +
        '<div class="card"><h2>\uD83C\uDFE0 My Racing Mod Card</h2>';
      var order = ['Game name','Car colour','Road colour','Number of laps','Obstacle colour','Max speed','One thing to add at home'];
      order.forEach(function(k) {
        if (fields[k]) {
          html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
        }
      });
      html += '<div class="tip">\uD83D\uDCA1 At home: open Godot, create a new 2D project, add a CharacterBody2D with a ColorRect. Connect your steering code from Step 2 to move_and_collide() in _physics_process!</div></div>';
      var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
      return cwBlobWrap('<style>body{margin:0;background:#1a1a2e}</style>', '<div id="out"></div>', '', blob, '');
    }
  },

  steps: [
    {
      num: 1,
      title: 'The Car and the Road',
      activity: '\uD83C\uDFCE\uFE0F Build it',
      goal: 'Draw the car and the road it drives on.',
      checkpoint: 'You should see a blue car sitting on a grey road strip in the centre of the canvas.',
      points: [
        'The canvas is 600 wide and 400 tall.',
        'The road is a 200px wide grey strip down the middle.',
        'The car is a blue rectangle that sits on the road.',
        'In Godot you would use a CharacterBody2D with a ColorRect or Sprite2D.'
      ],
      challenge: '\uD83E\uDD16 Set where the car starts:',
      starter: '# Where does the car start?\nvar car_x = ___\nvar car_y = 320\nvar car_w = ___\nvar car_h = 40',
      solution: '# Where does the car start?\nvar car_x = 270\nvar car_y = 320\nvar car_w = 60\nvar car_h = 40',
      checks: ['270', '60'],
      height: 130,
      fills: {
        text: 'The car starts at x = ___ to sit on the road. The road is ___ pixels wide.',
        answers: ['270', '200']
      },
      quiz: {
        question: 'Why is the road narrower than the canvas?',
        options: [
          'It is a bug in the code',
          'The dark sides act as boundaries - driving off the road should feel wrong, adding challenge',
          'Wider roads use too much memory'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Drive!',
      activity: '\uD83D\uDD79\uFE0F Drive!',
      goal: 'Move the car with the arrow keys.',
      checkpoint: 'Hold Up to accelerate and Left/Right to steer. The car should stay within the road boundaries.',
      points: [
        'Up speeds up. Down slows down.',
        'Left and Right steer the car.',
        'Acceleration adds 0.15 to the speed each frame; steering moves 3 pixels.',
        'In Godot, move_and_collide() or move_and_slide() apply the velocity.'
      ],
      challenge: '\uD83E\uDD16 Write the controls:',
      starter: '# Speed up and slow down\nif Input.is_action_pressed("ui_up"):\n    car_speed += ___\nif Input.is_action_pressed("ui_down"):\n    car_speed -= 0.1\n\n# Steer left and right\nif Input.is_action_pressed("ui_left"):\n    car_x -= ___\nif Input.is_action_pressed("ui_right"):\n    car_x += ___',
      solution: '# Speed up and slow down\nif Input.is_action_pressed("ui_up"):\n    car_speed += 0.15\nif Input.is_action_pressed("ui_down"):\n    car_speed -= 0.1\n\n# Steer left and right\nif Input.is_action_pressed("ui_left"):\n    car_x -= 3\nif Input.is_action_pressed("ui_right"):\n    car_x += 3',
      checks: ['0.15', '3'],
      height: 200,
      fills: {
        text: 'The car accelerates by ___ per frame. Steering moves ___ pixels per frame for responsive control.',
        answers: ['0.15', '3']
      },
      quiz: {
        question: 'Why use gradual acceleration instead of instant max speed?',
        options: [
          'Instant speed would crash the canvas',
          'Ramping up speed feels physical and gives the player a sense of weight and momentum',
          'Godot requires gradual changes'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Moving Road',
      activity: '\uD83D\uDEE3\uFE0F Road scroll',
      goal: 'Make the road markings scroll so the car looks like it is moving.',
      checkpoint: 'Drive fast - the yellow lane dashes should scroll faster as you speed up.',
      points: [
        'The road stays still. Only the dashes scroll.',
        'Add the car speed to the dash offset each frame.',
        'This parallax trick makes stationary dashes look like movement.',
        'In Godot you can move a TileMap or AnimatedSprite2D to get the same effect.'
      ],
      challenge: '\uD83E\uDD16 Scroll the road:',
      starter: '# Scroll the road markings\nroad_offset += ___\n\n# Wrap it so the dashes keep coming\nif road_offset > ___:\n    road_offset -= ___',
      solution: '# Scroll the road markings\nroad_offset += car_speed\n\n# Wrap it so the dashes keep coming\nif road_offset > 40:\n    road_offset -= 40',
      checks: ['car_speed', '40'],
      height: 150,
      fills: {
        text: 'The scroll offset grows by ___ each frame. This parallax trick makes stationary dashes look like ___.',
        answers: ['car_speed', 'movement']
      },
      quiz: {
        question: 'What is the parallax scrolling trick?',
        options: [
          'Moving the player very fast',
          'Moving background elements at different speeds to create depth illusion without actually moving the camera',
          'Drawing more pixels per frame'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Obstacles',
      activity: '\uD83D\uDEA7 Obstacles',
      goal: 'Add red obstacles that slide toward the car.',
      checkpoint: 'Three red rectangles should appear at the top of the road and slide toward you as you drive.',
      points: [
        'Obstacles start above the screen and move down with the car speed.',
        'When one passes the bottom, send it back to the top instead of making a new one.',
        'It comes down a random lane each time.',
        'This recycling pattern is called object pooling - a key performance trick in Godot.'
      ],
      challenge: '\uD83E\uDD16 Move and recycle the obstacles:',
      starter: '# Move each obstacle toward the car\nfor i in range(3):\n    obs[i].y += ___\n    # Send it back to the top if it goes past the bottom\n    if obs[i].y > ___:\n        obs[i].y = -60\n        obs[i].x = 220 + randi() % 160',
      solution: '# Move each obstacle toward the car\nfor i in range(3):\n    obs[i].y += car_speed\n    # Send it back to the top if it goes past the bottom\n    if obs[i].y > 420:\n        obs[i].y = -60\n        obs[i].x = 220 + randi() % 160',
      checks: ['car_speed', '420'],
      height: 180,
      fills: {
        text: 'Obstacles scroll at ___ speed so they match the road. Recycling obstacles off-screen avoids creating ___ objects.',
        answers: ['car_speed', 'new']
      },
      quiz: {
        question: 'Why recycle obstacles instead of creating new ones?',
        options: [
          'GDScript cannot create objects',
          'Reusing existing objects avoids memory allocation overhead - this is called object pooling',
          'New obstacles would be the same colour'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Crash!',
      activity: '\uD83D\uDCA5 Crash!',
      goal: 'Slow the car down when it hits an obstacle.',
      checkpoint: 'Drive into a red obstacle - your car should slow down sharply on impact, then you can keep going.',
      points: [
        'Two rectangles crash when all four edges overlap.',
        'On a crash the car slows down a lot (times 0.3).',
        'The obstacle moves away so it only hits once.',
        'In Godot, Area2D bodies fire an area_entered signal for this kind of overlap check.'
      ],
      challenge: '\uD83E\uDD16 Add the crash check:',
      starter: '# Check each obstacle for a crash\nfor i in range(3):\n    if car_x < obs[i].x + obs[i].w and car_x + car_w > obs[i].x and car_y < obs[i].y + obs[i].h and car_y + ___ > obs[i].y:\n        car_speed *= ___\n        obs[i].y = 420',
      solution: '# Check each obstacle for a crash\nfor i in range(3):\n    if car_x < obs[i].x + obs[i].w and car_x + car_w > obs[i].x and car_y < obs[i].y + obs[i].h and car_y + car_h > obs[i].y:\n        car_speed *= 0.3\n        obs[i].y = 420',
      checks: ['car_h', '0.3'],
      height: 150,
      fills: {
        text: 'AABB checks ___ edges of both rectangles. The speed penalty of ___ makes collisions feel punishing.',
        answers: ['four', '0.3']
      },
      quiz: {
        question: 'Why multiply speed by 0.3 instead of setting it to zero?',
        options: [
          'Zero speed crashes the engine',
          'A dramatic slowdown feels like impact while keeping the player in motion - a full stop would feel like a freeze bug',
          'Multiplication is faster than assignment'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Lap Timer',
      activity: '\uD83C\uDFC6 Lap timer',
      goal: 'Count your laps and keep your best time.',
      checkpoint: 'Drive 3 laps - watch the timer count up, and see your best lap time shown at the race complete screen.',
      points: [
        'The distance grows every frame at the current speed.',
        'Every 3000 distance units finishes a lap.',
        'After 3 laps the race ends. Press R to race again.',
        'In Godot you can use a Timer node instead of counting frames manually.'
      ],
      challenge: '\uD83E\uDD16 Track the laps:',
      starter: '# Add to the distance every frame\ndistance += car_speed\n\n# Finish a lap after enough distance\nif distance >= ___:\n    lap += 1\n    distance = 0\n    if lap_timer < best_time:\n        best_time = lap_timer\n    lap_timer = 0\n    if lap >= ___:\n        game_state = "over"',
      solution: '# Add to the distance every frame\ndistance += car_speed\n\n# Finish a lap after enough distance\nif distance >= lap_length:\n    lap += 1\n    distance = 0\n    if lap_timer < best_time:\n        best_time = lap_timer\n    lap_timer = 0\n    if lap >= 3:\n        game_state = "over"',
      checks: ['lap_length', '3'],
      height: 190,
      fills: {
        text: 'A lap completes every ___ distance units. The race ends after ___ laps.',
        answers: ['3000', '3']
      },
      quiz: {
        question: 'Why track best time instead of total time?',
        options: [
          'Total time is too large to store',
          'Best lap time rewards consistency and improvement - players chase their own record, adding replay value',
          'Godot only supports one timer'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '\uD83C\uDFE0 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and use these choices to build your own racing game.',
      checkpoint: 'Fill in as many fields as you want - then hit Apply to see your card. Screenshot it or write it down to use at home.',
      points: [
        'At home: open Godot and create a new 2D project',
        'Add a CharacterBody2D with a ColorRect child for your car',
        'Use move_and_collide() in _physics_process to apply your steering code from Step 2',
        'Use your mod card to pick your own colours, speed, and game idea'
      ],
      challenge: '\u270F\uFE0F Fill in your Mod Card - change anything you want to make this game yours:',
      starter: '# My Racing Mod Card\nGame name: ___\nCar colour: ___\nRoad colour: ___\nNumber of laps: ___\nObstacle colour: ___\nMax speed: ___\nOne thing to add at home: ___',
      solution: '# My Racing Mod Card\nGame name: Speed Run\nCar colour: red\nRoad colour: dark grey\nNumber of laps: 5\nObstacle colour: yellow\nMax speed: 10\nOne thing to add at home: a second car to race against',
      checks: [],
      height: 180,
      fills: {
        text: 'At home I will open ___ and my max speed will be ___.',
        answers: ['Godot', '10']
      }
    }
  ]
};
