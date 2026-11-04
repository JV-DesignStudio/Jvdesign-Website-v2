'use strict';

/* ===================================================
   IFRAME BUILDING BLOCKS (flappy-specific)
   =================================================== */

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#222;margin:0;overflow:hidden}canvas{display:block;cursor:pointer}</style>';

var CANVAS_TAG = '<canvas id="game" width="400" height="500"></canvas>';

var SETUP_BASIC = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var BIRD_OBJ = 'const bird={x:80,y:250,vy:0,size:24};const gravity=0.45;';

var DRAW_SKY = 'ctx.fillStyle="#70c5ce";ctx.fillRect(0,0,400,500);';

var DRAW_BIRD = 'ctx.fillStyle="#ffd166";ctx.fillRect(bird.x,bird.y,bird.size,bird.size);';

var DRAW_PIPES = 'ctx.fillStyle="#06d6a0";for(const p of pipes){ctx.fillRect(p.x,0,52,p.gapY-GAP/2);ctx.fillRect(p.x,p.gapY+GAP/2,52,500)}';

var DRAW_SCORE = 'ctx.fillStyle="#fff";ctx.font="bold 42px sans-serif";ctx.textAlign="center";ctx.fillText(score,200,50);';

var DRAW_DEATH = 'if(dead){ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(0,0,400,500);ctx.fillStyle="#fff";ctx.font="bold 30px sans-serif";ctx.textAlign="center";ctx.fillText("Game Over",200,210);ctx.font="18px sans-serif";ctx.fillText("Score "+score+"  Best "+best,200,250);ctx.fillText("Click or Space to retry",200,285)}';

var HITS_FN = 'function hits(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by}';

var PIPE_VARS = 'let pipes=[],frames=0;const GAP=150;';
var SCORE_VARS = 'let score=0,dead=false;let best=0;try{best=Number(localStorage.getItem("flappyBest")||0)}catch(x){}';

var FLAP_BASIC = 'function flap(){bird.vy=-8}canvas.addEventListener("mousedown",flap);document.addEventListener("keydown",function(e){if(e.code==="Space")flap()});';

var FLAP_FULL = 'function flap(){if(dead){bird.y=250;bird.vy=0;pipes=[];frames=0;score=0;dead=false;return}bird.vy=-8}canvas.addEventListener("mousedown",flap);document.addEventListener("keydown",function(e){if(e.code==="Space")flap()});';

var PIPE_SPAWN = 'frames++;if(frames%90===0)pipes.push({x:400,gapY:100+Math.random()*300});for(const p of pipes)p.x-=2.4;pipes=pipes.filter(function(p){return p.x>-60});';

var COLLISION_CHECK = 'for(const p of pipes){var topH=p.gapY-GAP/2;if(hits(bird.x,bird.y,24,24,p.x,0,52,topH)||hits(bird.x,bird.y,24,24,p.x,p.gapY+GAP/2,52,500))dead=true;if(!p.passed&&p.x+52<bird.x){p.passed=true;score++}}if(bird.y>476)dead=true;';

var SAVE_BEST = 'if(dead&&score>best){best=score;try{localStorage.setItem("flappyBest",best)}catch(x){}}';

function wrap(code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + CSS_GAME +
    '<\/head><body>' + CANVAS_TAG + '<script>' + code + '<\/script><\/body><\/html>';
}

/* ===================================================
   CW_CONFIG - flappy-specific steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-js-flappy-canvas',
  downloadName: 'my-flappy-game.html',

  hints: [
    'A sky-blue canvas appears - your game screen is ready',
    'Watch the bird fall with gravity - click to flap!',
    'Click or press Space to flap the bird upward',
    'Pipes scroll from the right - dodge through the gaps',
    'Hit a pipe or the floor and it is game over',
    'Your best score saves in the browser - try to beat it!'
  ],

  templates: {
    1: function(u) {
      return wrap(
        SETUP_BASIC + BIRD_OBJ +
        'try{' + u + '}catch(e){}' +
        'function loop(){requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(
        SETUP_BASIC + BIRD_OBJ +
        FLAP_BASIC +
        'function loop(){' +
        'try{' + u + '}catch(e){}' +
        'if(bird.y>476){bird.y=476;bird.vy=0}if(bird.y<0){bird.y=0;bird.vy=0}' +
        DRAW_SKY + DRAW_BIRD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(
        SETUP_BASIC + BIRD_OBJ +
        'try{' + u + '}catch(e){}' +
        'function loop(){bird.vy+=gravity;bird.y+=bird.vy;' +
        'if(bird.y>476){bird.y=476;bird.vy=0}if(bird.y<0){bird.y=0;bird.vy=0}' +
        DRAW_SKY + DRAW_BIRD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(
        SETUP_BASIC + BIRD_OBJ + PIPE_VARS +
        FLAP_BASIC +
        'function loop(){bird.vy+=gravity;bird.y+=bird.vy;' +
        'if(bird.y>476){bird.y=476;bird.vy=0}if(bird.y<0){bird.y=0;bird.vy=0}' +
        'try{' + u + '}catch(e){}' +
        DRAW_SKY + DRAW_PIPES + DRAW_BIRD +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(
        SETUP_BASIC + BIRD_OBJ + PIPE_VARS + SCORE_VARS + HITS_FN +
        FLAP_FULL +
        'function loop(){if(!dead){bird.vy+=gravity;bird.y+=bird.vy;' +
        PIPE_SPAWN +
        'try{' + u + '}catch(e){}' +
        SAVE_BEST + '}' +
        DRAW_SKY + DRAW_PIPES + DRAW_BIRD + DRAW_SCORE + DRAW_DEATH +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(
        SETUP_BASIC + BIRD_OBJ + PIPE_VARS + SCORE_VARS + HITS_FN +
        FLAP_FULL +
        'function loop(){if(!dead){bird.vy+=gravity;bird.y+=bird.vy;' +
        PIPE_SPAWN + COLLISION_CHECK + SAVE_BEST + '}' +
        DRAW_SKY + DRAW_PIPES + DRAW_BIRD + DRAW_SCORE +
        'try{' + u + '}catch(e){}' +
        'requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Canvas & First Draw',
      goal: 'Paint the sky and the bird on the 400x500 canvas.',
      points: [
        'The <code>&lt;canvas&gt;</code> element is a blank pixel surface JavaScript draws on every frame',
        '<code>getContext("2d")</code> gives you the drawing toolkit',
        '<code>fillRect(x, y, width, height)</code> paints a filled rectangle'
      ],
      challenge: 'Paint the sky, then draw the bird as a yellow square. Fill in the two canvas methods:',
      starter: '// 1. Paint the sky background\nctx.___ = "#70c5ce";\nctx.___(0, 0, 400, 500);\n\n// 2. Draw the bird as a yellow square\nctx.___ = "#ffd166";\nctx.___(bird.x, bird.y, bird.size, bird.size);',
      solution: 'ctx.fillStyle = "#70c5ce";\nctx.fillRect(0, 0, 400, 500);\n\nctx.fillStyle = "#ffd166";\nctx.fillRect(bird.x, bird.y, bird.size, bird.size);',
      checks: ['fillstyle', 'fillrect'],
      checkHelp: { fillstyle: 'a fillStyle colour', fillrect: 'a fillRect call' },
      predict: { question: 'Which method paints a filled rectangle on the canvas?', options: ['fillStyle', 'fillRect', 'getContext'], correct: 1 },
      explain: 'Which two canvas methods did you use, and what does each one do?',
      solutionNotes: ['Line 1: fillStyle chooses the paint colour.', 'Line 2: fillRect(0, 0, 400, 500) fills the whole canvas.', 'Line 4: fillStyle switches to yellow for the bird.', 'Line 5: fillRect(bird.x, bird.y, bird.size, bird.size) draws the bird.'],
      expect: 'A sky-blue canvas with a small yellow square (the bird) near the left.',
      height: 200,
      fills: {
        text: 'The drawing toolkit comes from canvas.___("2d"). Rectangles are drawn with ctx.___(x, y, w, h).',
        answers: ['getContext', 'fillRect']
      },
      quiz: {
        question: 'What is the <code>&lt;canvas&gt;</code> element?',
        options: [
          'A picture file like PNG or JPG',
          'A blank pixel surface that JavaScript draws on every frame - the browser\'s game screen',
          'A special kind of button element'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Gravity & the Game Loop',
      goal: 'Make the bird fall with gravity using requestAnimationFrame.',
      points: [
        'The bird is a plain object: <code>{ x, y, vy, size }</code>',
        '<code>requestAnimationFrame(loop)</code> calls your function every screen refresh (~60/s)',
        'Each frame: <code>vy += gravity</code>, then <code>y += vy</code>, then redraw everything'
      ],
      challenge: 'Write the gravity physics that run each frame:',
      starter: '// Apply gravity to the bird each frame\n// Step 1: velocity increases by gravity\n\n// Step 2: position changes by velocity\n',
      solution: 'bird.vy += gravity;\nbird.y += bird.vy;',
      checks: ['bird.vy', 'gravity', 'bird.y'],
      checkHelp: { 'bird.vy': 'adding gravity to the bird velocity', gravity: 'the gravity value', 'bird.y': 'moving the bird by its velocity' },
      predict: { question: 'If gravity gets bigger, what happens to the bird?', options: ['It falls faster', 'It falls slower', 'Nothing changes'], correct: 0 },
      explain: 'In your own words, why does the bird speed up as it falls?',
      solutionNotes: ['Line 1: bird.vy += gravity adds gravity to the velocity every frame.', 'Line 2: bird.y += bird.vy moves the bird by that velocity.'],
      expect: 'The yellow bird falls to the bottom of the canvas.',
      height: 90,
      fills: {
        text: 'Gravity grows the ___. Velocity moves the ___. The loop reschedules itself with ___.',
        answers: ['velocity', 'position', 'requestAnimationFrame']
      },
      quiz: {
        question: 'Why does <code>loop()</code> call <code>requestAnimationFrame(loop)</code> at its end?',
        options: [
          'To stop the game',
          'It schedules the NEXT frame - the function re-books itself forever, creating the game loop',
          'It reloads the page'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Flap!',
      goal: 'Make every click/tap/spacebar launch the bird upward.',
      points: [
        'A flap is just <code>bird.vy = -8</code> - replace the velocity, don\'t add to it',
        'Listen for clicks on the canvas AND the spacebar - one action, two listeners',
        'Setting vy (not adding) means a flap from a dive recovers instantly'
      ],
      challenge: 'Write the flap event listeners:',
      starter: '// Flap function: set bird velocity upward\nfunction flap() {\n  // Set vy to jump upward (negative = up)\n  \n}\n\n// Listen for mouse clicks\ncanvas.addEventListener("mousedown", ___);\n\n// Listen for spacebar\ndocument.addEventListener("keydown", function(e) {\n  if (e.code === "Space") ___();\n});',
      solution: 'function flap() {\n  bird.vy = -8;\n}\n\ncanvas.addEventListener("mousedown", flap);\n\ndocument.addEventListener("keydown", function(e) {\n  if (e.code === "Space") flap();\n});',
      checks: ['addeventlistener', 'mousedown', 'keydown', 'vy'],
      checkHelp: { addeventlistener: 'listening for input', mousedown: 'a click handler', keydown: 'a keyboard handler', vy: 'setting the flap velocity' },
      predict: { question: 'A flap sets bird.vy to -8. What does a negative velocity do?', options: ['Moves the bird up', 'Moves the bird down', 'Stops the bird'], correct: 0 },
      explain: 'Why is it better to call one flap function from both inputs?',
      solutionNotes: ['Line 2: bird.vy = -8 replaces the velocity with an upward push.', 'Line 5: the click listener calls the same flap function.', 'Line 8: the spacebar listener calls the same function too.'],
      expect: 'The bird rises each time you click or press Space.',
      height: 220,
      quiz: {
        question: 'One flap function with two event listeners is better than two copies because -',
        options: [
          'Browsers limit you to one function',
          'Change the flap strength once and every input method updates - no duplicate logic',
          'Events require sharing'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Scrolling Pipes',
      goal: 'Spawn pipe pairs that scroll left with a random gap.',
      points: [
        'One pipe = <code>{ x, gapY }</code> - the gap centre. Top and bottom drawn from it',
        'Every 90 frames, push a new pipe at x=400 with random gapY',
        'Each frame: every pipe x -= 2.4. Drop pipes past x = -60 with <code>filter()</code>'
      ],
      challenge: 'Write the pipe spawning and scrolling logic:',
      starter: '// Spawn a new pipe every 90 frames\nframes++;\nif (frames % ___ === 0) {\n  pipes.push({ x: 400, gapY: 100 + Math.random() * 300 });\n}\n// Move all pipes left\nfor (const p of pipes) p.x -= ___;\n// Remove pipes that scrolled off screen\npipes = pipes.filter(function(p) { return p.x > -60; });',
      solution: 'frames++;\nif (frames % 90 === 0) {\n  pipes.push({ x: 400, gapY: 100 + Math.random() * 300 });\n}\nfor (const p of pipes) p.x -= 2.4;\npipes = pipes.filter(function(p) { return p.x > -60; });',
      checks: ['frames', 'push', 'filter'],
      checkHelp: { frames: 'counting frames', push: 'adding a new pipe', filter: 'removing off-screen pipes' },
      predict: { question: 'What happens if you remove the filter on pipes?', options: ['Pipes pile up forever', 'Pipes disappear when off screen', 'The score stops'], correct: 0 },
      explain: 'What would happen if you never removed off-screen pipes?',
      solutionNotes: ['Lines 2-4: frames % 90 spawns a new pipe roughly every 90 frames.', 'Lines 6-7: every pipe moves left each frame.', 'Line 9: filter() drops pipes once they pass x = -60.'],
      expect: 'Green pipes scroll in from the right with a gap to fly through.',
      height: 180,
      fills: {
        text: 'New pipes appear every ___ frames. Off-screen pipes are removed with ___.',
        answers: ['90', 'filter']
      },
      quiz: {
        question: '<code>pipes.filter(p => p.x > -60)</code> does the same job as which trick from other languages?',
        options: [
          'The 2D maze array',
          'removeIf / erase-remove - deleting finished objects from a list',
          'The spawn timer'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Collision & Score',
      goal: 'Die on pipes and floor; score one point per pipe passed.',
      points: [
        'AABB collision: four comparisons to check if two rectangles overlap',
        'Check the bird against BOTH top and bottom pipe of each pair',
        'Scoring: first frame where pipe-right < bird-left, score++ and mark pipe as passed'
      ],
      challenge: 'Write the collision and scoring checks:',
      starter: '// Check each pipe for collision and scoring\nfor (const p of pipes) {\n  var topH = p.gapY - GAP / 2;\n  // Die if bird hits top pipe OR bottom pipe\n  if (hits(bird.x, bird.y, 24, 24, p.x, 0, 52, topH) ||\n      hits(bird.x, bird.y, 24, 24, p.x, p.gapY + GAP/2, 52, 500))\n    dead = true;\n  // Score when pipe passes the bird\n  if (!p.passed && p.x + 52 < bird.x) {\n    p.___ = true;\n    ___++;\n  }\n}\n// Floor death\nif (bird.y > 476) dead = true;',
      solution: 'for (const p of pipes) {\n  var topH = p.gapY - GAP / 2;\n  if (hits(bird.x, bird.y, 24, 24, p.x, 0, 52, topH) ||\n      hits(bird.x, bird.y, 24, 24, p.x, p.gapY + GAP/2, 52, 500))\n    dead = true;\n  if (!p.passed && p.x + 52 < bird.x) {\n    p.passed = true;\n    score++;\n  }\n}\nif (bird.y > 476) dead = true;',
      checks: ['dead', 'passed', 'score'],
      checkHelp: { dead: 'setting the dead flag on a collision', passed: 'marking a pipe as scored', score: 'adding a point' },
      predict: { question: 'Why check the bird against both the top and bottom pipe?', options: ['To keep the gap open', 'Because there are two rectangles to hit', 'To add the score'], correct: 1 },
      explain: 'Why does the passed flag stop the score jumping by 60?',
      solutionNotes: ['Lines 4-6: the bird is tested against the top and bottom pipe rectangles.', 'Lines 7-10: a pipe scores once because passed is set before score++.', 'Line 13: the floor is a separate death check.'],
      expect: 'Touching a pipe or the floor ends the game; passing a pipe adds a point.',
      height: 230,
      fills: {
        text: 'The overlap test is called ___ collision. A pipe scores once thanks to its ___ flag.',
        answers: ['AABB', 'passed']
      },
      quiz: {
        question: 'Without the <code>passed</code> flag, flying beside a pipe would -',
        options: [
          'Crash the game',
          'Score a point EVERY FRAME the condition holds - about 60 points per pipe',
          'Score nothing at all'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Game Over & Best Score',
      goal: 'Show death screen, save best score, tap to restart.',
      points: [
        'While dead: skip physics, overlay "GAME OVER" with score and best',
        'Best score lives in <code>localStorage</code> - the browser\'s built-in save file',
        'A tap/click while dead resets everything: bird, pipes, score, dead flag'
      ],
      challenge: 'Write the game-over overlay drawing code:',
      starter: '// Draw game over screen when dead\nif (dead) {\n  ctx.fillStyle = "rgba(0,0,0,0.5)";\n  ctx.fillRect(0, 0, 400, 500);\n  ctx.fillStyle = "#fff";\n  ctx.font = "bold 30px sans-serif";\n  ctx.textAlign = "center";\n  ctx.fillText("Game Over", 200, ___);\n  ctx.font = "18px sans-serif";\n  ctx.fillText("Score " + ___ + "  Best " + best, 200, 250);\n  ctx.fillText("Click or Space to retry", 200, 285);\n}',
      solution: 'if (dead) {\n  ctx.fillStyle = "rgba(0,0,0,0.5)";\n  ctx.fillRect(0, 0, 400, 500);\n  ctx.fillStyle = "#fff";\n  ctx.font = "bold 30px sans-serif";\n  ctx.textAlign = "center";\n  ctx.fillText("Game Over", 200, 210);\n  ctx.font = "18px sans-serif";\n  ctx.fillText("Score " + score + "  Best " + best, 200, 250);\n  ctx.fillText("Click or Space to retry", 200, 285);\n}',
      checks: ['dead', 'filltext', 'score'],
      checkHelp: { dead: 'checking the game-over state', filltext: 'drawing the game-over text', score: 'showing the score' },
      predict: { question: 'What happens to the best score when the browser closes?', options: ['It resets to 0', 'It stays saved', 'It doubles'], correct: 1 },
      explain: 'Where is the best score stored, and why does it survive a reload?',
      solutionNotes: ['Line 2: a dark fillStyle dims the game behind the overlay.', 'Line 7: fillText draws the Game Over title.', 'Line 9: fillText shows the score and the saved best score.'],
      expect: 'A dark overlay shows Game Over, your score and your best score.',
      height: 230,
      quiz: {
        question: '<code>localStorage</code> survives closing the browser. Which feature of THIS website uses the same trick?',
        options: [
          'The fonts on each page',
          'Your XP, streaks and workshop progress on My Progress',
          'The navigation bar'
        ],
        correct: 1
      }
    }
  ]
};
