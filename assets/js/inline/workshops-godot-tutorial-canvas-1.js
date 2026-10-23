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

var PLAYER_VARS = 'let px=200,py=200,pAngle=0,speed=3;';
var TRAIL_VARS = 'let trail=[];';
var COIN_VARS = 'let coins=[];for(var ci=0;ci<8;ci++)coins.push({x:40+Math.floor(Math.random()*7)*46,y:40+Math.floor(Math.random()*7)*46,active:true});';
var WIN_VARS = 'let score=0,gameWon=false;';
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

var DRAW_BG = 'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,400);' +
  'ctx.strokeStyle="#1e293b";ctx.lineWidth=1;for(var gi=0;gi<400;gi+=40){ctx.beginPath();ctx.moveTo(gi,0);ctx.lineTo(gi,400);ctx.stroke();ctx.beginPath();ctx.moveTo(0,gi);ctx.lineTo(400,gi);ctx.stroke()}';
var DRAW_TRAIL = 'for(var ti=0;ti<trail.length;ti++){var alpha=ti/trail.length*0.5;ctx.fillStyle="rgba(96,165,250,"+alpha+")";ctx.beginPath();ctx.arc(trail[ti].x,trail[ti].y,4*(ti/trail.length),0,Math.PI*2);ctx.fill()}';
var DRAW_COINS = 'for(var cii=0;cii<coins.length;cii++){if(coins[cii].active){ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(coins[cii].x,coins[cii].y,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 10px monospace";ctx.textAlign="center";ctx.fillText("🪙",coins[cii].x,coins[cii].y+4)}}';
var DRAW_PLAYER = 'ctx.save();ctx.translate(px,py);ctx.rotate(pAngle);ctx.fillStyle="#60a5fa";ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-8,8);ctx.lineTo(-8,-8);ctx.closePath();ctx.fill();ctx.restore();';
var DRAW_HUD = 'ctx.fillStyle="#fff";ctx.font="bold 14px monospace";ctx.textAlign="left";ctx.fillText("🪙 " + score + " / 8",8,20);';

function wbWrap(presetup, blobSrc, afterBlob) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob);
}

window.CW_CONFIG = {
  storageKey: 'jvds-godot-tutorial-canvas',
  downloadName: 'my-godot-tutorial.html',
  nextStep: { url: '/workshops/godot-world-workshop.html', label: 'Godot World' },

  hints: [
    'A blue arrow sprite you can move around a dark grid',
    'The sprite rotates to face the direction you are moving',
    'A glowing trail follows the sprite as it moves',
    'Yellow coin pickups are scattered around the level',
    'Collect all 8 coins to trigger the win condition',
    'Your score is displayed in the top-left corner',
    'Your mod card - plan your own Godot scene to build at home'
  ],

  templates: {
    1: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + TRAIL_VARS + COIN_VARS + WIN_VARS + KEYS,
        gdscriptToJs(u),
        'function loop(){' +
        DRAW_BG + DRAW_COINS + DRAW_PLAYER + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + TRAIL_VARS + COIN_VARS + WIN_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(typeof cwStep==="function")cwStep();' +
        'px=Math.max(8,Math.min(392,px));py=Math.max(8,Math.min(392,py));' +
        DRAW_BG + DRAW_COINS + DRAW_PLAYER + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + TRAIL_VARS + COIN_VARS + WIN_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'var vx=0,vy=0;' +
        'if(leftHeld)vx=-speed;if(rightHeld)vx=speed;if(upHeld)vy=-speed;if(downHeld)vy=speed;' +
        'px+=vx;py+=vy;' +
        'if(vx!==0||vy!==0)pAngle=Math.atan2(vy,vx);' +
        'px=Math.max(8,Math.min(392,px));py=Math.max(8,Math.min(392,py));' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_COINS + DRAW_PLAYER + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + TRAIL_VARS + COIN_VARS + WIN_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'var vx=0,vy=0;' +
        'if(leftHeld)vx=-speed;if(rightHeld)vx=speed;if(upHeld)vy=-speed;if(downHeld)vy=speed;' +
        'px+=vx;py+=vy;' +
        'if(vx!==0||vy!==0)pAngle=Math.atan2(vy,vx);' +
        'px=Math.max(8,Math.min(392,px));py=Math.max(8,Math.min(392,py));' +
        'trail.push({x:px,y:py});if(trail.length>20)trail.shift();' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_TRAIL + DRAW_COINS + DRAW_PLAYER + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + TRAIL_VARS + COIN_VARS + WIN_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'var vx=0,vy=0;' +
        'if(leftHeld)vx=-speed;if(rightHeld)vx=speed;if(upHeld)vy=-speed;if(downHeld)vy=speed;' +
        'px+=vx;py+=vy;' +
        'if(vx!==0||vy!==0)pAngle=Math.atan2(vy,vx);' +
        'px=Math.max(8,Math.min(392,px));py=Math.max(8,Math.min(392,py));' +
        'trail.push({x:px,y:py});if(trail.length>20)trail.shift();' +
        'for(var cii=0;cii<coins.length;cii++){if(coins[cii].active){var cdx=px-coins[cii].x,cdy=py-coins[cii].y;if(Math.sqrt(cdx*cdx+cdy*cdy)<18){coins[cii].active=false;score++}}}' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_TRAIL + DRAW_COINS + DRAW_PLAYER + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + TRAIL_VARS + COIN_VARS + WIN_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(!gameWon){' +
        'var vx=0,vy=0;' +
        'if(leftHeld)vx=-speed;if(rightHeld)vx=speed;if(upHeld)vy=-speed;if(downHeld)vy=speed;' +
        'px+=vx;py+=vy;' +
        'if(vx!==0||vy!==0)pAngle=Math.atan2(vy,vx);' +
        'px=Math.max(8,Math.min(392,px));py=Math.max(8,Math.min(392,py));' +
        'trail.push({x:px,y:py});if(trail.length>20)trail.shift();' +
        'for(var cii=0;cii<coins.length;cii++){if(coins[cii].active){var cdx=px-coins[cii].x,cdy=py-coins[cii].y;if(Math.sqrt(cdx*cdx+cdy*cdy)<18){coins[cii].active=false;score++}}}' +
        'if(score>=8)gameWon=true;' +
        'if(typeof cwStep==="function")cwStep();' +
        '}' +
        DRAW_BG + DRAW_TRAIL + DRAW_COINS + DRAW_PLAYER + DRAW_HUD +
        'if(gameWon){ctx.fillStyle="rgba(34,197,94,0.25)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("All coins collected!",200,185);ctx.font="16px monospace";ctx.fillText("Refresh to play again",200,218)}' +
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
        'h2{color:#60a5fa;margin:0 0 12px}' +
        '.card{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:16px}' +
        '.row{display:flex;gap:8px;margin:6px 0;align-items:baseline}' +
        '.lbl{color:#94a3b8;min-width:160px;font-size:.85rem}' +
        '.val{color:#f1f5f9;font-weight:bold}' +
        '.tip{margin-top:14px;padding:10px;background:#0f172a;border-left:3px solid #60a5fa;font-size:.82rem;color:#94a3b8}' +
        '</style>' +
        '<div class="card"><h2>🏠 My Godot Scene Mod Card</h2>';
      var order = ['Game name','Sprite colour','Collectible type','Number of collectibles','Background style','Trail colour','One thing to add at home'];
      order.forEach(function(k) {
        if (fields[k]) html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
      });
      html += '<div class="tip">💡 At home: open Godot, create a CharacterBody2D, add a Sprite2D child and draw your character. Add a script with _physics_process(delta) and use velocity = input_dir * speed then move_and_slide() for smooth movement!</div></div>';
      var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
      return cwBlobWrap('<style>body{margin:0;background:#0f172a}</style>', '<div></div>', '', blob, '');
    }
  },

  steps: [
    {
      num: 1,
      title: 'Your First Scene',
      activity: '🌟 First scene',
      goal: 'Place your sprite and coins on the canvas.',
      checkpoint: 'You should see a blue arrow in the center and yellow coin dots scattered around.',
      points: [
        'The sprite is a triangle pointing right - a simple arrow shape',
        'Coins are random yellow circles placed on a grid',
        '8 coins total - enough to be a challenge without being tedious',
        'In Godot your first scene would have a Node2D root with child nodes for sprite and coins'
      ],
      challenge: '🤖 Set the starting position and coin count:',
      starter: '# Sprite starts in the center\nvar start_x = ___\nvar start_y = 200\n\n# Number of coins to collect\nvar coin_count = ___',
      solution: '# Sprite starts in the center\nvar start_x = 200\nvar start_y = 200\n\n# Number of coins to collect\nvar coin_count = 8',
      checks: ['200', '8'],
      height: 110,
      fills: {
        text: 'The sprite starts at the ___ of the canvas. Collecting all ___ coins triggers the win condition.',
        answers: ['center', '8']
      },
      quiz: {
        question: 'Why start the player in the center of the map?',
        options: [
          'Center is the default position',
          'Center placement gives equal distance to all corners - coins spread around the edges require the player to explore the full map',
          'Godot places nodes at the center by default'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Input & Movement',
      activity: '🕹️ Input',
      goal: 'Move the sprite with WASD or arrow keys.',
      checkpoint: 'Use arrow keys or WASD - the blue arrow should move around the canvas.',
      points: [
        'Check four key states: left, right, up, down',
        'Build a velocity vector from the held keys',
        'Add velocity to position each frame',
        'In Godot you would use Input.get_vector() to build the direction in one call'
      ],
      challenge: '🤖 Write movement using velocity:',
      starter: '# Build velocity from input\nvar vx = 0\nvar vy = 0\nif Input.is_action_pressed("ui_left"): vx = -___\nif Input.is_action_pressed("ui_right"): vx = speed\nif Input.is_action_pressed("ui_up"): vy = -speed\nif Input.is_action_pressed("ui_down"): vy = ___\nposition.x += vx\nposition.y += vy',
      solution: '# Build velocity from input\nvar vx = 0\nvar vy = 0\nif Input.is_action_pressed("ui_left"): vx = -speed\nif Input.is_action_pressed("ui_right"): vx = speed\nif Input.is_action_pressed("ui_up"): vy = -speed\nif Input.is_action_pressed("ui_down"): vy = speed\nposition.x += vx\nposition.y += vy',
      checks: ['speed', 'vx', 'vy'],
      height: 200,
      fills: {
        text: 'Velocity is ___ each frame to position. A velocity approach makes it easy to add ___ or deceleration later.',
        answers: ['added', 'acceleration']
      },
      quiz: {
        question: 'Why build a velocity vector instead of moving the position directly?',
        options: [
          'Vectors use less memory',
          'A velocity variable makes it easy to add friction, acceleration or clamping without rewriting the movement logic',
          'Godot requires velocity variables'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Rotation',
      activity: '🔄 Rotation',
      goal: 'Rotate the sprite to face the direction it is moving.',
      checkpoint: 'Move in different directions - the arrow should always point the way it is going.',
      points: [
        'atan2(vy, vx) returns the angle from the positive X axis to the point (vx, vy)',
        'Only update the angle when actually moving (vx != 0 or vy != 0)',
        'In Godot: sprite.rotation = velocity.angle() does this in one line',
        'Rotation makes movement feel responsive and directional'
      ],
      challenge: '🤖 Write the rotation update:',
      starter: '# Rotate to face movement direction\nif vx != 0 or vy != 0:\n    sprite_angle = atan2(___, vx)',
      solution: '# Rotate to face movement direction\nif vx != 0 or vy != 0:\n    sprite_angle = atan2(vy, vx)',
      checks: ['atan2', 'vy', 'vx'],
      height: 110,
      fills: {
        text: 'atan2(y, x) returns the ___ to a point in radians. We only update rotation when ___ to avoid snapping to zero.',
        answers: ['angle', 'moving']
      },
      quiz: {
        question: 'Why pass (vy, vx) to atan2 rather than (vx, vy)?',
        options: [
          'It is a typo',
          'atan2 takes (y, x) by convention - the y argument comes first. Reversing them gives the wrong angle',
          'vy must always come before vx in GDScript'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Motion Trail',
      activity: '✨ Trail',
      goal: 'Leave a fading trail of dots behind the sprite as it moves.',
      checkpoint: 'Move around - a glowing blue trail should follow the arrow and fade as it gets older.',
      points: [
        'Push the current position to a trail array each frame',
        'Limit trail length to 20 points (shift off the oldest when exceeded)',
        'Render older points more transparent using the index as opacity',
        'The trail gives the feeling of speed and makes the movement path visible'
      ],
      challenge: '🤖 Write the trail logic:',
      starter: '# Add current position to trail\ntrail.push({x: position_x, y: position_y})\n\n# Keep trail length at max 20\nif trail.size() > ___:\n    trail.pop_front()',
      solution: '# Add current position to trail\ntrail.push({x: position_x, y: position_y})\n\n# Keep trail length at max 20\nif trail.size() > 20:\n    trail.pop_front()',
      checks: ['20', 'trail', 'pop_front'],
      height: 140,
      fills: {
        text: 'The trail stores up to ___ positions. Older positions are drawn with ___ opacity to create the fade effect.',
        answers: ['20', 'lower']
      },
      quiz: {
        question: 'Why use a fixed-length queue (push/shift) instead of clearing the array each frame?',
        options: [
          'Arrays cannot be cleared in GDScript',
          'A queue preserves the last N positions across frames - clearing each frame would give a single-frame trail with no fade',
          'Fixed-length queues use less memory'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Collectibles',
      activity: '🪙 Collect',
      goal: 'Collect coins by moving over them; increase the score.',
      checkpoint: 'Drive over a yellow coin - it should disappear and your score should increase.',
      points: [
        'Each coin has an active flag - false means already collected',
        'Check distance from player to each active coin',
        'On collect: set coin.active = false and increment score',
        'In Godot you would use Area2D nodes with body_entered signals for pickups'
      ],
      challenge: '🤖 Write the coin collection check:',
      starter: '# Check each coin\nfor coin in coins:\n    if coin.active:\n        var dist = abs(player_x - coin.x) + abs(player_y - coin.y)\n        if dist < ___:\n            coin.active = ___\n            score += 1',
      solution: '# Check each coin\nfor coin in coins:\n    if coin.active:\n        var dist = abs(player_x - coin.x) + abs(player_y - coin.y)\n        if dist < 18:\n            coin.active = false\n            score += 1',
      checks: ['18', 'false', 'score'],
      height: 160,
      fills: {
        text: 'Coins are collected within ___ pixels. Setting active to ___ prevents collecting the same coin twice.',
        answers: ['18', 'false']
      },
      quiz: {
        question: 'Why use an active flag instead of removing the coin from the array?',
        options: [
          'Arrays cannot be modified in loops',
          'Removing from an array mid-loop causes index drift bugs - a flag is simpler and avoids off-by-one errors when iterating',
          'The active flag is required by GDScript'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Win Condition',
      activity: '🏆 Win',
      goal: 'Show a win screen when all 8 coins are collected.',
      checkpoint: 'Collect all 8 coins - a green overlay should appear with a congratulations message.',
      points: [
        'Check score >= 8 after each coin collection',
        'Set gameWon = true to freeze movement and show the overlay',
        'Win screen shows final score and a restart prompt',
        'In Godot you would show a CanvasLayer with a Control scene on top of the game'
      ],
      challenge: '🤖 Write the win check:',
      starter: '# Trigger win when all coins collected\nif score >= ___:\n    game_won = ___',
      solution: '# Trigger win when all coins collected\nif score >= 8:\n    game_won = true',
      checks: ['8', 'true', 'game_won'],
      height: 100,
      fills: {
        text: 'The win triggers when score reaches ___. Movement is disabled by checking ___ before updating position.',
        answers: ['8', 'game_won']
      },
      quiz: {
        question: 'What makes a win condition satisfying to the player?',
        options: [
          'A large number on screen',
          'Clear visual feedback that confirms achievement - the green overlay and message create a moment of celebration',
          'The game ending immediately'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '🏠 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and build this scene for real.',
      checkpoint: 'Fill in as many fields as you like, then hit Apply to see your card.',
      points: [
        'At home: open Godot, create a CharacterBody2D with a Sprite2D child',
        'Add a script with _physics_process(delta): use Input.get_vector() and move_and_slide()',
        'Add Area2D nodes for coins with body_entered signal connected to a collect function',
        'Add a CanvasLayer with a Label to show score and a win panel'
      ],
      challenge: '✏️ Fill in your Mod Card:',
      starter: '# My Godot Scene Mod Card\nGame name: ___\nSprite colour: ___\nCollectible type: ___\nNumber of collectibles: ___\nBackground style: ___\nTrail colour: ___\nOne thing to add at home: ___',
      solution: '# My Godot Scene Mod Card\nGame name: Star Collector\nSprite colour: purple\nCollectible type: stars\nNumber of collectibles: 12\nBackground style: deep space\nTrail colour: pink\nOne thing to add at home: enemies that patrol and reset the score on contact',
      checks: [],
      height: 180,
      fills: {
        text: 'At home my sprite will be ___ and I will collect ___.',
        answers: ['purple', 'stars']
      }
    }
  ]
};
