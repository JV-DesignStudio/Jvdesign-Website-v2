'use strict';

function wbWrap(presetup, blobSrc, afterBlob) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob);
}


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
   IFRAME BUILDING BLOCKS (My First Godot Game - Catch)
   =================================================== */

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#1a1a2e;margin:0;overflow:hidden}canvas{display:block;cursor:pointer}</style>';

var CANVAS_TAG = '<canvas id="game" width="600" height="400"></canvas>';

var SETUP = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var BASKET_VARS = 'let bx=250,by=360,bw=100,bh=20,speed=5;';

var STAR_VARS = 'let sx=Math.floor(Math.random()*560)+20,sy=-20,sw=20,sh=20,fallSpeed=3;';

var SCORE_VARS = 'let score=0;';

var STATE_VARS = 'let gameState="play";';

/* Background star field - static decorative dots, drawn once per frame before game objects */
var BG_STARS = 'const bgS=[{x:45,y:25,r:.9},{x:120,y:55,r:1.1},{x:220,y:18,r:.8},{x:310,y:70,r:1},{x:400,y:30,r:.9},{x:480,y:65,r:1.2},{x:555,y:20,r:.8},{x:70,y:110,r:.7},{x:175,y:140,r:1},{x:370,y:100,r:.9},{x:520,y:130,r:.8},{x:140,y:200,r:.7},{x:430,y:180,r:1},{x:560,y:250,r:.9},{x:30,y:300,r:.8}];';

var KEYS = 'let leftHeld=false,rightHeld=false;' +
  'document.addEventListener("keydown",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;' +
    'e.preventDefault()});' +
  'document.addEventListener("keyup",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false});';

var DRAW_BG = 'ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,600,400);' +
  'ctx.fillStyle="rgba(255,255,255,.55)";' +
  'bgS.forEach(function(s){ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});';

/* Basket with soft blue glow */
var DRAW_BASKET = 'ctx.save();ctx.shadowColor="#93c5fd";ctx.shadowBlur=10;ctx.fillStyle="#60a5fa";ctx.fillRect(bx,by,bw,bh);ctx.restore();';

/* Star with warm glow */
var DRAW_STAR = 'ctx.save();ctx.shadowColor="#ffd166";ctx.shadowBlur=16;ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(sx+sw/2,sy+sh/2,sw/2,0,Math.PI*2);ctx.fill();ctx.restore();';

var DRAW_SCORE = 'ctx.fillStyle="#fff";ctx.font="bold 20px monospace";ctx.textAlign="left";ctx.fillText("Score: "+score,12,28);';

var STAR_RESET = 'function resetStar(){sx=Math.floor(Math.random()*560)+20;sy=-20}';

function wrap(code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + CSS_GAME +
    '<\/head><body>' + CANVAS_TAG + '<script>' + code + '<\/script><\/body><\/html>';
}

/* ===================================================
   CW_CONFIG - My First Godot Game steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-my-first-godot-canvas',
  downloadName: 'my-first-godot-game.html',
  nextStep: { url: '/workshops/godot-platformer-canvas.html', label: 'Godot Platformer' },

  hints: [
    'A blue basket glowing at the bottom of a starry dark screen',
    'Arrow keys - slide the basket left and right',
    'A golden star falling from the top - catch it!',
    'Catch the star to score a point and send it back to the top',
    'Stars fall faster the higher your score gets',
    'Game over screen - press R to go again',
    'Your Mod Card - fill it in and take it home to Godot'
  ],

  templates: {
    1: function(u) {
      return wbWrap(
        SETUP + BG_STARS + BASKET_VARS + KEYS,
        gdscriptToJs(u),
        'function loop(){' +
        DRAW_BG + DRAW_BASKET +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wbWrap(
        SETUP + BG_STARS + BASKET_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(window.cwStep)cwStep();' +
        'bx=Math.max(0,Math.min(500,bx));' +
        DRAW_BG + DRAW_BASKET +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wbWrap(
        SETUP + BG_STARS + BASKET_VARS + STAR_VARS + KEYS +
        STAR_RESET,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)bx-=speed;if(rightHeld)bx+=speed;' +
        'bx=Math.max(0,Math.min(500,bx));' +
        'if(window.cwStep)cwStep();' +
        'if(sy>410)resetStar();' +
        DRAW_BG + DRAW_BASKET + DRAW_STAR +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wbWrap(
        SETUP + BG_STARS + BASKET_VARS + STAR_VARS + SCORE_VARS + KEYS +
        STAR_RESET,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)bx-=speed;if(rightHeld)bx+=speed;' +
        'bx=Math.max(0,Math.min(500,bx));' +
        'sy+=fallSpeed;' +
        'if(window.cwStep)cwStep();' +
        'if(sy>410)resetStar();' +
        DRAW_BG + DRAW_BASKET + DRAW_STAR + DRAW_SCORE +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wbWrap(
        SETUP + BG_STARS + BASKET_VARS + STAR_VARS + SCORE_VARS + KEYS +
        STAR_RESET,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)bx-=speed;if(rightHeld)bx+=speed;' +
        'bx=Math.max(0,Math.min(500,bx));' +
        'sy+=fallSpeed;' +
        'if(sy+sh>=by&&sy<=by+bh&&sx+sw>=bx&&sx<=bx+bw){score++;resetStar()}' +
        'if(window.cwStep)cwStep();' +
        'if(sy>410)resetStar();' +
        DRAW_BG + DRAW_BASKET + DRAW_STAR + DRAW_SCORE +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wbWrap(
        SETUP + BG_STARS + BASKET_VARS + STAR_VARS + SCORE_VARS + STATE_VARS + KEYS +
        STAR_RESET +
        'document.addEventListener("keydown",function(e){if(e.code==="KeyR"&&gameState==="over"){score=0;fallSpeed=3;resetStar();gameState="play"}});',
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(gameState==="play"){' +
        'if(leftHeld)bx-=speed;if(rightHeld)bx+=speed;' +
        'bx=Math.max(0,Math.min(500,bx));' +
        'sy+=fallSpeed;' +
        'if(sy+sh>=by&&sy<=by+bh&&sx+sw>=bx&&sx<=bx+bw){score++;resetStar();fallSpeed=Math.min(8,3+score/5)}' +
        'if(sy>410)resetStar();' +
        'if(window.cwStep)cwStep();' +
        '}' +
        DRAW_BG + DRAW_BASKET + DRAW_STAR + DRAW_SCORE +
        'if(gameState==="over"){ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(0,0,600,400);' +
        'ctx.save();ctx.shadowColor="#ffd166";ctx.shadowBlur=20;ctx.fillStyle="#ffd166";ctx.font="bold 36px monospace";ctx.textAlign="center";' +
        'ctx.fillText("GAME OVER",300,180);ctx.restore();ctx.fillStyle="#e8eaf2";ctx.font="18px monospace";ctx.fillText("Score: "+score,300,218);' +
        'ctx.fillStyle="#60a5fa";ctx.font="16px monospace";ctx.fillText("Press R to play again",300,256)}' +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    /* Step 7: Take It Home - shows the learner's mod card in the canvas panel */
    7: function(u) {
      var lines = (u || '').split('\n')
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l && l.indexOf('#') !== 0; });
      var rows = lines.map(function(l) {
        var parts = l.split(':');
        var label = parts[0] ? parts[0].trim() : l;
        var val = parts.slice(1).join(':').trim();
        return '<tr><td style="color:#ffd166;padding:4px 12px 4px 0;white-space:nowrap">' + label + '</td>' +
          '<td style="color:#e8eaf2;padding:4px 0">' + (val || '<span style="color:#666">not filled in yet</span>') + '</td></tr>';
      }).join('');
      return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
        'background:linear-gradient(160deg,#16203c 0%,#0f1424 100%);font-family:Fredoka,system-ui,sans-serif;padding:20px}' +
        '.card{background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.28);border-radius:18px;padding:28px 28px 22px;max-width:500px;width:100%}' +
        'h2{color:#4ade80;margin:0 0 4px;font-size:1.5rem;font-weight:700}' +
        '.sub{color:#93c5fd;font-size:.88rem;margin:0 0 18px}' +
        'table{width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:16px}' +
        '.tip{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);border-radius:10px;padding:12px 14px;' +
        'font-size:.82rem;color:#c0c8e0;line-height:1.55}' +
        '.tip strong{color:#60a5fa;display:block;margin-bottom:4px}' +
        '</style></head><body>' +
        '<div class="card">' +
        '<h2>\uD83C\uDFAE Mod Card - Ready!</h2>' +
        '<p class="sub">Save or screenshot this. At home, open Godot and make it yours.</p>' +
        '<table>' + (rows || '<tr><td style="color:#666;font-size:.85rem">Fill in your mod choices in the editor</td></tr>') + '</table>' +
        '<div class="tip"><strong>At home: open Godot</strong>' +
        'File - New Project - Add a Node2D scene. Create a script and paste your code from each step. ' +
        'Then swap in your colours, your theme, your ideas from this card.</div>' +
        '</div></body></html>';
    }
  },

  steps: [
    {
      num: 1,
      title: 'The Basket',
      activity: '\uD83C\uDFD7\uFE0F Place it',
      goal: 'Place your basket at the bottom of the screen. This is the thing the player controls.',
      checkpoint: 'You should see a glowing blue rectangle near the bottom of the canvas.',
      points: [
        'The screen is 600 pixels wide and 400 pixels tall - a classic arcade size',
        'Your basket is a blue rectangle: 100 wide, 20 tall',
        'In Godot this would be a <code>Sprite2D</code> or <code>ColorRect</code> node',
        'Starting at x = 250 puts it roughly in the centre'
      ],
      challenge: '\uD83E\uDD16 Set the basket position - replace the blanks:',
      starter: '# Set the basket position\nvar basket_x = ___\nvar basket_y = 360\nvar basket_w = ___',
      solution: '# Set the basket position\nvar basket_x = 250\nvar basket_y = 360\nvar basket_w = 100',
      checks: ['250', '360', '100'],
      height: 100,
      fills: {
        text: 'The basket starts at x = ___ to appear centred. It is ___ pixels wide.',
        answers: ['250', '100']
      },
      quiz: {
        question: 'Why place the basket near the bottom of the screen?',
        options: [
          'It looks cooler there',
          'The player needs space above to see falling objects and react in time',
          'Godot requires sprites at the bottom'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Left & Right Movement',
      activity: '\uD83D\uDD79\uFE0F Move it',
      goal: 'Make the basket slide left and right with the arrow keys. Keep it from flying off screen.',
      checkpoint: 'Press the left and right arrow keys - the basket should slide and stop at the edges.',
      points: [
        'In Godot: <code>Input.is_action_pressed("ui_left")</code> checks if a key is held down',
        'Move 5 pixels per frame - fast enough to feel responsive, slow enough to control',
        '<code>clamp(basket_x, 0, 500)</code> keeps the basket inside the canvas at both edges',
        'The right edge cap is 500, not 600, because the basket itself is 100 pixels wide'
      ],
      challenge: '\uD83D\uDD79\uFE0F Write the movement - fill in the speed:',
      starter: '# Move left and right\nif Input.is_action_pressed("ui_left"):\n    basket_x -= ___\nif Input.is_action_pressed("ui_right"):\n    basket_x += ___',
      solution: '# Move left and right\nif Input.is_action_pressed("ui_left"):\n    basket_x -= 5\nif Input.is_action_pressed("ui_right"):\n    basket_x += 5',
      checks: ['is_action_pressed', 'basket_x', '5'],
      height: 140,
      fills: {
        text: 'The basket moves ___ pixels per frame. The clamp keeps it between 0 and ___.',
        answers: ['5', '500']
      },
      quiz: {
        question: 'Why use clamp instead of just checking the edges with if-statements?',
        options: [
          'Clamp is slower but more accurate',
          'Clamp handles both edges in one call and prevents the basket leaving bounds even at high speed',
          'You cannot use if-statements in GDScript'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'A Falling Star',
      activity: '\u2B50 Drop it',
      goal: 'Spawn a glowing star at the top and make it fall. When it exits the screen, send it back.',
      checkpoint: 'A golden star should fall from a random position. When it exits the bottom, a new one appears at the top.',
      points: [
        'The star starts above the screen (y = -20) so it slides in smoothly instead of popping',
        'Random x between 20 and 580 means it could appear anywhere across the width',
        'Each frame: <code>star_y += fall_speed</code> - this is your game\'s physics in one line',
        'In Godot you\'d instance a star scene from a <code>PackedScene</code> - same idea, more power'
      ],
      challenge: '\u2B50 Make the star fall - fill in the two values:',
      starter: '# Move star downward\nstar_y += ___\n\n# Reset when off screen\nif star_y > 410:\n    star_y = ___',
      solution: '# Move star downward\nstar_y += fall_speed\n\n# Reset when off screen\nif star_y > 410:\n    star_y = -20',
      checks: ['fall_speed', '-20'],
      height: 120,
      fills: {
        text: 'The star falls at ___ pixels per frame. Setting y to ___ makes it slide in from above.',
        answers: ['3', '-20']
      },
      quiz: {
        question: 'Why start the star above the screen instead of at y = 0?',
        options: [
          'It needs to accelerate first',
          'Starting off-screen means the star slides smoothly into view instead of appearing suddenly at the edge',
          'Godot sprites must start off-screen'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Catching Stars',
      activity: '\uD83C\uDFAF Collide!',
      goal: 'Detect when the star touches the basket. Award a point and launch a new star.',
      checkpoint: 'When the basket overlaps the falling star, the score should go up by 1 and the star should reset.',
      points: [
        'This is AABB collision - the same rectangle-overlap check used in almost every 2D game',
        'You check all four edges at once: right/left overlap AND top/bottom overlap must all be true',
        'On catch: score goes up by 1, star resets to the top at a new random x',
        'In Godot you\'d use an <code>Area2D</code> with a <code>CollisionShape2D</code> - but the math is identical'
      ],
      challenge: '\uD83C\uDFAF Write the catch - fill in what happens when it lands:',
      starter: '# Check if star touches basket\nif star_y + star_h >= basket_y and star_x + star_w >= basket_x and star_x <= basket_x + basket_w:\n    score += ___\n    star_y = ___',
      solution: '# Check if star touches basket\nif star_y + star_h >= basket_y and star_x + star_w >= basket_x and star_x <= basket_x + basket_w:\n    score += 1\n    star_y = -20',
      checks: ['score', '1', '-20'],
      height: 120,
      fills: {
        text: 'Catching a star adds ___ to the score. The star resets to y = ___ for the next drop.',
        answers: ['1', '-20']
      },
      quiz: {
        question: 'What does AABB stand for?',
        options: [
          'Automatic Axis-Based Bouncing',
          'Axis-Aligned Bounding Box - it checks overlap of two non-rotated rectangles by comparing edges',
          'Advanced Area Boundary Buffer'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Speed Ramp',
      activity: '\uD83D\uDD25 Ramp up',
      goal: 'Make the game get harder as you score. Stars fall faster - but cap it so it stays fair.',
      checkpoint: 'After catching a few stars the fall speed should increase. At high scores it should feel frantic but not impossible.',
      points: [
        'Formula: <code>fall_speed = 3 + score / 5</code> - every 5 catches the star drops 1 pixel faster',
        'Starting at 3 means it\'s easy at first and ramps naturally',
        'Cap at 8 - without a cap the star would eventually move faster than the player can see',
        'This exact difficulty curve (slow start, gentle ramp, hard cap) is used in Tetris'
      ],
      challenge: '\uD83D\uDD25 Write the speed ramp - what number do we divide by, and what\'s the cap?',
      starter: '# Increase speed with score\nvar fall_speed = 3 + score / ___\n# Cap the speed\nfall_speed = clamp(fall_speed, 3, ___)',
      solution: '# Increase speed with score\nvar fall_speed = 3 + score / 5\n# Cap the speed\nfall_speed = clamp(fall_speed, 3, 8)',
      checks: ['5', '8'],
      height: 100,
      fills: {
        text: 'Speed increases every ___ catches. The cap of ___ keeps the game fair at high scores.',
        answers: ['5', '8']
      },
      quiz: {
        question: 'Why not increase speed every single catch?',
        options: [
          'The computer cannot handle it',
          'Increasing every 5 catches gives the player time to adjust - too fast a ramp feels unfair',
          'GDScript only counts in fives'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Game Over & Restart',
      activity: '\uD83C\uDFAE State machine',
      goal: 'Add a game-over screen and let the player restart without reloading the page.',
      checkpoint: 'When the score condition triggers, a game-over overlay should appear. Pressing R should reset everything.',
      points: [
        'A state machine with two states - <code>"play"</code> and <code>"over"</code> - keeps the logic clean',
        'In the <code>"over"</code> state the game freezes and shows the final score',
        'Pressing R resets score, speed and star position then switches back to <code>"play"</code>',
        'State machines are everywhere in game dev - menus, cutscenes, boss phases all use this pattern'
      ],
      challenge: '\uD83C\uDFAE Write the restart - reset all three things:',
      starter: '# Reset everything on R press\nscore = ___\nfall_speed = ___\ngame_state = "play"',
      solution: '# Reset everything on R press\nscore = 0\nfall_speed = 3\ngame_state = "play"',
      checks: ['score', '0', 'fall_speed', '3', 'play'],
      height: 100,
      fills: {
        text: 'Resetting score to ___ and speed to ___ gives a clean fresh start.',
        answers: ['0', '3']
      },
      quiz: {
        question: 'Why use a state machine instead of reloading the page?',
        options: [
          'Reloading is faster',
          'A state machine resets variables instantly without the delay and flicker of a full page reload',
          'GDScript cannot reload pages'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '\uD83C\uDFE0 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and use these choices to make the game yours.',
      checkpoint: 'Fill in as many fields as you want - then hit Apply to see your card. Screenshot it or write it down.',
      points: [
        'Everything you built here runs as real GDScript logic - open Godot and it transfers directly',
        'In Godot: <strong>File - New Project</strong>, add a <code>Node2D</code> scene, attach a script',
        'Copy your code from each step into the script - the variable names are the same',
        'Use the choices on your Mod Card to personalise colours, theme and rules before you build'
      ],
      challenge: '\u270F\uFE0F Fill in your Mod Card - change anything you want to make this game yours:',
      starter: '# My Mod Card\nGame name: ___\nBasket colour: ___\nWhat falls (instead of stars): ___\nTarget score to win: ___\nBackground theme: ___\nOne thing I want to add at home: ___',
      solution: '# My Mod Card\nGame name: Star Catcher\nBasket colour: purple\nWhat falls (instead of stars): gems\nTarget score to win: 20\nBackground theme: deep space\nOne thing I want to add at home: sound when you catch',
      checks: [],
      height: 160,
      fills: {
        text: 'At home I will open ___ and paste my code from step ___.',
        answers: ['Godot', '1']
      }
    }
  ]
};
