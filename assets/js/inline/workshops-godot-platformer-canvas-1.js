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
    .replace(/\bInput\.is_action_just_pressed\("ui_up"\)/g, 'upJustPressed')
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

var CANVAS_TAG = '<canvas id="game" width="600" height="400"></canvas>';

var SETUP = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var PLAYER_VARS = 'let px=80,py=300,pw=30,ph=30,vx=0,vy=0,speed=4,jumpForce=-10,gravity=0.5,onGround=false;';

var PLAT_VARS = 'let platforms=[{x:0,y:370,w:600,h:30},{x:100,y:290,w:120,h:15},{x:300,y:220,w:120,h:15},{x:480,y:290,w:100,h:15},{x:180,y:150,w:120,h:15}];';

var COIN_VARS = 'let coins=[{x:150,y:265,r:8,got:false},{x:350,y:195,r:8,got:false},{x:520,y:265,r:8,got:false},{x:230,y:125,r:8,got:false}];let collected=0;';

var ENEMY_VARS = 'let enemies=[{x:320,y:205,w:25,h:15,dx:1,minX:300,maxX:420},{x:100,y:275,w:25,h:15,dx:-1,minX:100,maxX:220}];';

var STATE_VARS = 'let gameState="play";';

var KEYS = 'let leftHeld=false,rightHeld=false,upHeld=false,upJustPressed=false;' +
  'document.addEventListener("keydown",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=true;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=true;' +
    'if((e.code==="ArrowUp"||e.code==="KeyW")&&!upHeld){upHeld=true;upJustPressed=true}' +
    'e.preventDefault()});' +
  'document.addEventListener("keyup",function(e){' +
    'if(e.code==="ArrowLeft"||e.code==="KeyA")leftHeld=false;' +
    'if(e.code==="ArrowRight"||e.code==="KeyD")rightHeld=false;' +
    'if(e.code==="ArrowUp"||e.code==="KeyW")upHeld=false});';

var DRAW_BG = 'ctx.fillStyle="#0f172a";ctx.fillRect(0,0,600,400);';

var DRAW_PLATS = 'ctx.fillStyle="#22c55e";for(var i=0;i<platforms.length;i++){ctx.fillRect(platforms[i].x,platforms[i].y,platforms[i].w,platforms[i].h)}';

var DRAW_PLAYER = 'ctx.fillStyle="#60a5fa";ctx.fillRect(px,py,pw,ph);ctx.fillStyle="#93c5fd";ctx.fillRect(px+8,py+6,6,6);ctx.fillRect(px+18,py+6,6,6);';

var DRAW_COINS = 'ctx.fillStyle="#fbbf24";for(var i=0;i<coins.length;i++){if(!coins[i].got){ctx.beginPath();ctx.arc(coins[i].x,coins[i].y,coins[i].r,0,Math.PI*2);ctx.fill()}}';

var DRAW_ENEMIES = 'ctx.fillStyle="#f43f5e";for(var i=0;i<enemies.length;i++){ctx.fillRect(enemies[i].x,enemies[i].y,enemies[i].w,enemies[i].h)}';

var DRAW_HUD = 'ctx.fillStyle="#fff";ctx.font="bold 18px monospace";ctx.textAlign="left";ctx.fillText("Coins: "+collected+"/"+coins.length,10,24);';

function wbWrap(presetup, blobSrc, afterBlob) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob);
}

window.CW_CONFIG = {
  storageKey: 'jvds-godot-platformer-canvas',
  downloadName: 'my-godot-platformer.html',
  nextStep: { url: '/workshops/godot-racing-canvas.html', label: 'Godot Racing' },

  hints: [
    'A blue square standing on a green platform',
    'The player runs left and right on the ground',
    'Pressing Up makes the player jump with gravity pulling them back',
    'Multiple platforms at different heights to jump between',
    'Golden coins float above platforms waiting to be collected',
    'Red enemies patrol platforms and reset the player on touch',
    'Your mod card - fill it in and take your ideas home to Godot'
  ],

  templates: {
    1: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + PLAT_VARS + KEYS,
        gdscriptToJs(u),
        'function loop(){' +
        DRAW_BG + DRAW_PLATS + DRAW_PLAYER +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + PLAT_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(typeof cwStep==="function")cwStep();' +
        'px=Math.max(0,Math.min(570,px));' +
        DRAW_BG + DRAW_PLATS + DRAW_PLAYER +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + PLAT_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)vx=-speed;else if(rightHeld)vx=speed;else vx=0;' +
        'px+=vx;px=Math.max(0,Math.min(570,px));' +
        'if(typeof cwStep==="function")cwStep();' +
        'vy+=gravity;py+=vy;onGround=false;' +
        'for(var i=0;i<platforms.length;i++){var p=platforms[i];' +
        'if(py+ph>=p.y&&py+ph<=p.y+p.h+vy+1&&px+pw>p.x&&px<p.x+p.w&&vy>=0){py=p.y-ph;vy=0;onGround=true}}' +
        DRAW_BG + DRAW_PLATS + DRAW_PLAYER +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + PLAT_VARS + COIN_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)vx=-speed;else if(rightHeld)vx=speed;else vx=0;' +
        'px+=vx;px=Math.max(0,Math.min(570,px));' +
        'if(upJustPressed&&onGround){vy=jumpForce;onGround=false}upJustPressed=false;' +
        'vy+=gravity;py+=vy;onGround=false;' +
        'for(var i=0;i<platforms.length;i++){var p=platforms[i];' +
        'if(py+ph>=p.y&&py+ph<=p.y+p.h+vy+1&&px+pw>p.x&&px<p.x+p.w&&vy>=0){py=p.y-ph;vy=0;onGround=true}}' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_PLATS + DRAW_COINS + DRAW_PLAYER +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + PLAT_VARS + COIN_VARS + KEYS,
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(leftHeld)vx=-speed;else if(rightHeld)vx=speed;else vx=0;' +
        'px+=vx;px=Math.max(0,Math.min(570,px));' +
        'if(upJustPressed&&onGround){vy=jumpForce;onGround=false}upJustPressed=false;' +
        'vy+=gravity;py+=vy;onGround=false;' +
        'for(var i=0;i<platforms.length;i++){var p=platforms[i];' +
        'if(py+ph>=p.y&&py+ph<=p.y+p.h+vy+1&&px+pw>p.x&&px<p.x+p.w&&vy>=0){py=p.y-ph;vy=0;onGround=true}}' +
        'for(var i=0;i<coins.length;i++){if(!coins[i].got){var dx=px+pw/2-coins[i].x,dy=py+ph/2-coins[i].y;if(dx*dx+dy*dy<(pw/2+coins[i].r)*(pw/2+coins[i].r)){coins[i].got=true;collected++}}}' +
        'if(typeof cwStep==="function")cwStep();' +
        DRAW_BG + DRAW_PLATS + DRAW_COINS + DRAW_PLAYER + DRAW_HUD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wbWrap(
        SETUP + PLAYER_VARS + PLAT_VARS + COIN_VARS + ENEMY_VARS + STATE_VARS + KEYS +
        'document.addEventListener("keydown",function(e){if(e.code==="KeyR"&&gameState==="over"){px=80;py=300;vx=0;vy=0;collected=0;for(var i=0;i<coins.length;i++)coins[i].got=false;gameState="play"}});',
        'window.cwStep=function(){' + gdscriptToJs(u) + '};',
        'function loop(){' +
        'if(gameState==="play"){' +
        'if(leftHeld)vx=-speed;else if(rightHeld)vx=speed;else vx=0;' +
        'px+=vx;px=Math.max(0,Math.min(570,px));' +
        'if(upJustPressed&&onGround){vy=jumpForce;onGround=false}upJustPressed=false;' +
        'vy+=gravity;py+=vy;onGround=false;' +
        'for(var i=0;i<platforms.length;i++){var p=platforms[i];' +
        'if(py+ph>=p.y&&py+ph<=p.y+p.h+vy+1&&px+pw>p.x&&px<p.x+p.w&&vy>=0){py=p.y-ph;vy=0;onGround=true}}' +
        'for(var i=0;i<coins.length;i++){if(!coins[i].got){var dx=px+pw/2-coins[i].x,dy=py+ph/2-coins[i].y;if(dx*dx+dy*dy<(pw/2+coins[i].r)*(pw/2+coins[i].r)){coins[i].got=true;collected++}}}' +
        'for(var i=0;i<enemies.length;i++){var en=enemies[i];en.x+=en.dx;if(en.x<=en.minX||en.x+en.w>=en.maxX)en.dx*=-1;' +
        'if(px+pw>en.x&&px<en.x+en.w&&py+ph>en.y&&py<en.y+en.h){gameState="over"}}' +
        'if(collected>=coins.length){gameState="win"}' +
        'if(typeof cwStep==="function")cwStep();' +
        '}' +
        DRAW_BG + DRAW_PLATS + DRAW_COINS + DRAW_ENEMIES + DRAW_PLAYER + DRAW_HUD +
        'if(gameState==="win"){ctx.fillStyle="#22c55e";ctx.font="bold 32px monospace";ctx.textAlign="center";ctx.fillText("ALL COINS!",300,180);ctx.font="18px monospace";ctx.fillText("Press R to play again",300,215)}' +
        'if(gameState==="over"){ctx.fillStyle="#f43f5e";ctx.font="bold 32px monospace";ctx.textAlign="center";ctx.fillText("GAME OVER",300,180);ctx.font="18px monospace";ctx.fillText("Press R to try again",300,215)}' +
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
        '<div class="card"><h2>\uD83C\uDFE0 My Platformer Mod Card</h2>';
      var order = ['Game name','Player colour','Enemy colour','Number of platforms','Coins to collect','Special move','One thing to add at home'];
      order.forEach(function(k) {
        if (fields[k]) {
          html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
        }
      });
      html += '<div class="tip">\uD83D\uDCA1 At home: open Godot, create a new 2D project, add a CharacterBody2D with a ColorRect child. Paste your movement code from Step 2 and start building!</div></div>';
      var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
      return cwBlobWrap('<style>body{margin:0;background:#0f172a}</style>', '<div id="out"></div>', '', blob, '');
    }
  },

  steps: [
    {
      num: 1,
      title: 'Player & Ground',
      activity: '\uD83C\uDFD7\uFE0F Build it',
      goal: 'Place a blue player on a green ground platform.',
      checkpoint: 'You should see a blue square sitting on a green bar at the bottom of the canvas.',
      points: [
        'The ground spans the full 600px width at y=370',
        'The player is a 30x30 blue square starting at x=80, y=300',
        'In Godot you would use a CharacterBody2D with a CollisionShape2D',
        'Higher platforms are placed at various heights for jumping'
      ],
      challenge: '\uD83E\uDD16 Set the player position:',
      starter: '# Set the player position\nvar player_x = ___\nvar player_y = 300\nvar player_w = ___\nvar player_h = 30',
      solution: '# Set the player position\nvar player_x = 80\nvar player_y = 300\nvar player_w = 30\nvar player_h = 30',
      checks: ['80', '300', '30'],
      height: 120,
      fills: {
        text: 'The player starts at x = ___ near the left side. The ground is at y = ___.',
        answers: ['80', '370']
      },
      quiz: {
        question: 'Why use CharacterBody2D in Godot for the player?',
        options: [
          'It is the only node type',
          'CharacterBody2D handles physics-based movement with built-in collision response, perfect for platformers',
          'It draws prettier sprites'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Running Left & Right',
      activity: '\uD83D\uDD79\uFE0F Move it',
      goal: 'Move the player horizontally with arrow keys.',
      checkpoint: 'Press the left and right arrow keys - the blue square should slide smoothly side to side.',
      points: [
        'In Godot: <code>Input.is_action_pressed("ui_left")</code> for held keys',
        'Set velocity to -speed or +speed while a key is held',
        'When no key is pressed, velocity is 0 (instant stop)',
        'Clamp x to keep the player on screen (0 to 570)'
      ],
      challenge: '\uD83E\uDD16 Write the horizontal movement:',
      starter: '# Move left and right\nif Input.is_action_pressed("ui_left"):\n    velocity_x = ___\nelif Input.is_action_pressed("ui_right"):\n    velocity_x = ___\nelse:\n    velocity_x = 0',
      solution: '# Move left and right\nif Input.is_action_pressed("ui_left"):\n    velocity_x = -speed\nelif Input.is_action_pressed("ui_right"):\n    velocity_x = speed\nelse:\n    velocity_x = 0',
      checks: ['is_action_pressed', 'velocity_x', 'speed'],
      height: 180,
      fills: {
        text: 'Moving left uses velocity ___. Speed is ___ pixels per frame.',
        answers: ['-speed', '4']
      },
      quiz: {
        question: 'Why set velocity to 0 when no key is pressed?',
        options: [
          'It saves memory',
          'Instant stop gives precise control - platformers need tight, responsive movement',
          'Godot requires zero velocity'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Gravity & Jumping',
      activity: '\u2B06\uFE0F Jump!',
      goal: 'Add gravity and let the player jump with Up.',
      checkpoint: 'Press Up - the player should arc upward and fall back down. They can only jump from the ground.',
      points: [
        'Gravity adds 0.5 to vertical velocity each frame',
        'Jumping sets vy to -10 (negative = upward)',
        'The player can only jump when <code>on_ground</code> is true',
        'Platform collision: when falling onto a platform, snap to its top'
      ],
      challenge: '\uD83E\uDD16 Write the jump:',
      starter: '# Jump when on ground\nif Input.is_action_just_pressed("ui_up") and on_ground:\n    velocity_y = ___\n    on_ground = false\n\n# Gravity pulls down\nvelocity_y += ___',
      solution: '# Jump when on ground\nif Input.is_action_just_pressed("ui_up") and on_ground:\n    velocity_y = -10\n    on_ground = false\n\n# Gravity pulls down\nvelocity_y += 0.5',
      checks: ['-10', '0.5', 'on_ground'],
      height: 160,
      fills: {
        text: 'Jump force is ___ (negative means up). Gravity adds ___ per frame to pull back down.',
        answers: ['-10', '0.5']
      },
      quiz: {
        question: 'Why check on_ground before allowing a jump?',
        options: [
          'It prevents errors',
          'Without the check the player could jump mid-air infinitely - the ground check limits jumps to feel physical',
          'Godot crashes on double jumps'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Collecting Coins',
      activity: '\uD83E\uDE99 Collect',
      goal: 'Place golden coins above platforms and collect them on touch.',
      checkpoint: 'Jump up to a coin - it should disappear and the counter in the top-left should go up.',
      points: [
        'Four coins float above different platforms',
        'Circle-rectangle collision uses distance between centres',
        'On collect: mark the coin as "got" and increment the counter',
        'In Godot you would use Area2D for the coin pickup zone'
      ],
      challenge: '\uD83E\uDD16 Write the coin collection:',
      starter: '# Check each coin\nfor i in range(4):\n    if not coins[i].got:\n        # Distance check\n        coins[i].got = ___\n        collected += ___',
      solution: '# Check each coin\nfor i in range(4):\n    if not coins[i].got:\n        # Distance check\n        coins[i].got = true\n        collected += 1',
      checks: ['got', 'true', 'collected', '1'],
      height: 140,
      fills: {
        text: 'There are ___ coins to collect. Each coin adds ___ to the counter.',
        answers: ['4', '1']
      },
      quiz: {
        question: 'Why mark coins as "got" instead of removing them from the array?',
        options: [
          'Arrays cannot be modified',
          'Flagging avoids index shifts and lets you easily reset all coins for a restart',
          'It uses less memory'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Patrolling Enemies',
      activity: '\uD83D\uDC7E Enemies',
      goal: 'Add red enemies that pace back and forth on platforms.',
      checkpoint: 'Two red rectangles should be moving back and forth on platforms. Touch one to see game over.',
      points: [
        'Each enemy has a min/max x range and reverses at the edges',
        'Movement: <code>enemy.x += enemy.dx</code> each frame',
        'When x reaches minX or maxX, flip dx: <code>enemy.dx *= -1</code>',
        'Touching an enemy triggers game over'
      ],
      challenge: '\uD83E\uDD16 Write the enemy patrol:',
      starter: '# Move and bounce enemies\nenemy.x += enemy.dx\nif enemy.x <= enemy.min_x or enemy.x + enemy.w >= enemy.max_x:\n    enemy.dx *= ___',
      solution: '# Move and bounce enemies\nenemy.x += enemy.dx\nif enemy.x <= enemy.min_x or enemy.x + enemy.w >= enemy.max_x:\n    enemy.dx *= -1',
      checks: ['enemy.dx', '-1', 'min_x', 'max_x'],
      height: 120,
      fills: {
        text: 'Enemies reverse direction by multiplying dx by ___. They patrol between ___ and max_x.',
        answers: ['-1', 'min_x']
      },
      quiz: {
        question: 'Why give each enemy its own min/max range?',
        options: [
          'It uses less code',
          'Individual ranges let you confine each enemy to its own platform, creating varied challenges per section',
          'Godot requires unique ranges'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Win & Restart',
      activity: '\uD83C\uDFC6 Finish it',
      goal: 'Win when all coins are collected, game over on enemy touch, R to restart.',
      checkpoint: 'Collect all 4 coins to see the win screen. Get hit by an enemy to see game over. Press R to reset.',
      points: [
        'When <code>collected >= coins.length</code>, show "ALL COINS!" and stop play',
        'Touching an enemy sets game_state to "over"',
        'Pressing R resets position, velocity, coins, and state',
        'A state machine ("play" / "win" / "over") controls the loop'
      ],
      challenge: '\uD83E\uDD16 Write the win check:',
      starter: '# Check win condition\nif collected >= ___:\n    game_state = "___"',
      solution: '# Check win condition\nif collected >= coins.length:\n    game_state = "win"',
      checks: ['collected', 'coins', 'win'],
      height: 80,
      fills: {
        text: 'The player wins by collecting all ___ coins. The game uses ___ states: play, win, and over.',
        answers: ['4', '3']
      },
      quiz: {
        question: 'Why use three states instead of just play/over?',
        options: [
          'Three is the minimum Godot allows',
          'Separating "win" from "over" lets you show different messages and potentially different rewards or next-level options',
          'It runs faster with three states'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '\uD83C\uDFE0 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and use these choices to build your own platformer.',
      checkpoint: 'Fill in as many fields as you want - then hit Apply to see your card. Screenshot it or write it down to use at home.',
      points: [
        'At home: open Godot and create a new 2D project',
        'Add a CharacterBody2D node with a ColorRect child for your player',
        'Paste your movement code from Step 2 into the _physics_process function',
        'Use your mod card choices to change colours, speed, and add your own twist'
      ],
      challenge: '\u270F\uFE0F Fill in your Mod Card - change anything you want to make this game yours:',
      starter: '# My Platformer Mod Card\nGame name: ___\nPlayer colour: ___\nEnemy colour: ___\nNumber of platforms: ___\nCoins to collect: ___\nSpecial move: ___\nOne thing to add at home: ___',
      solution: '# My Platformer Mod Card\nGame name: Jump Quest\nPlayer colour: purple\nEnemy colour: orange\nNumber of platforms: 6\nCoins to collect: 5\nSpecial move: double jump\nOne thing to add at home: moving platforms',
      checks: [],
      height: 180,
      fills: {
        text: 'At home I will open ___ and add my special move: ___.',
        answers: ['Godot', 'double jump']
      }
    }
  ]
};
