'use strict';

/* ===================================================
   IFRAME TEMPLATE BUILDING BLOCKS (snake-specific)
   =================================================== */

var CSS_S = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;max-width:100%}</style>';

var CSS_F = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem}label{display:flex;gap:4px;align-items:center;cursor:pointer}</style>';

var CANVAS_S = '<canvas id="game" width="400" height="400"></canvas>';

var CANVAS_F = '<div class="row"><span>Score: <b id="score">0</b></span><span>Best: <b id="best">0</b></span><label><input type="checkbox" id="wrap"> Wrap</label></div><canvas id="game" width="400" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">Arrows / Swipe &middot; Space restarts</div>';

var SETUP_S = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),CELL=16,GRID=25;let snake=[{x:12,y:12},{x:11,y:12},{x:10,y:12}],dir={x:1,y:0},lastTick=0;';

var SETUP_F = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),CELL=16,GRID=25;let snake,dir,inputQueue,food,dead,lastTick,score;let best=0;try{best=Number(localStorage.getItem("snakeBest")||0)}catch(x){}document.getElementById("best").textContent=best;';

var DRAW_S = 'function draw(){ctx.fillStyle="#0a0e14";ctx.fillRect(0,0,400,400);ctx.fillStyle="#4ade80";for(const c of snake)ctx.fillRect(c.x*CELL+1,c.y*CELL+1,CELL-2,CELL-2)}';

var DRAW_FOOD_OPEN = 'function draw(t){ctx.fillStyle="#0a0e14";ctx.fillRect(0,0,400,400);var r=6+Math.sin((t||0)/150)*2;ctx.fillStyle="#ff5470";ctx.beginPath();ctx.arc(food.x*CELL+CELL/2,food.y*CELL+CELL/2,r,0,Math.PI*2);ctx.fill();';
var DRAW_SNAKE_SOLID = 'ctx.fillStyle="#4ade80";for(const c of snake)ctx.fillRect(c.x*CELL+1,c.y*CELL+1,CELL-2,CELL-2);';
var DRAW_DEATH_CLOSE = 'if(dead){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,400,400);ctx.fillStyle="#fff";ctx.font="bold 26px system-ui";ctx.textAlign="center";ctx.fillText("Game Over",200,180);ctx.font="15px system-ui";ctx.fillText("Score "+score+" \\u00b7 Space to restart",200,210)}}';

var SPAWN = 'function spawnFood(){while(true){var f={x:Math.floor(Math.random()*GRID),y:Math.floor(Math.random()*GRID)};if(!snake.some(function(c){return c.x===f.x&&c.y===f.y}))return f}}';
var SCORE = 'function updateScore(){score=snake.length-3;document.getElementById("score").textContent=score}';
var RESET = 'function reset(){snake=[{x:12,y:12},{x:11,y:12},{x:10,y:12}];dir={x:1,y:0};inputQueue=[];dead=false;lastTick=0;score=0;food=spawnFood();updateScore()}';

var KB_SIMPLE = 'document.addEventListener("keydown",function(e){var map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};if(map[e.key])dir=map[e.key]});';
var KB_QUEUE = 'document.addEventListener("keydown",function(e){var map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};if(map[e.key])inputQueue.push(map[e.key])});';
var KB_FULL = 'document.addEventListener("keydown",function(e){if(e.key===" "&&dead){reset();return}var map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};if(map[e.key])inputQueue.push(map[e.key])});';

var COLLISION = 'var wrapMode=document.getElementById("wrap").checked;if(wrapMode){head.x=(head.x+GRID)%GRID;head.y=(head.y+GRID)%GRID}else if(head.x<0||head.x>GRID-1||head.y<0||head.y>GRID-1){dead=true;return}if(snake.some(function(c){return c.x===head.x&&c.y===head.y})){dead=true;return}';

var TOUCH = 'var touchStart=null;canvas.addEventListener("touchstart",function(e){touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault()});canvas.addEventListener("touchend",function(e){if(!touchStart)return;var dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>Math.abs(dy))inputQueue.push({x:dx>0?1:-1,y:0});else inputQueue.push({x:0,y:dy>0?1:-1});touchStart=null});';

var STEP_OPEN = 'function step(){while(inputQueue.length){var want=inputQueue.shift();if(want.x!==-dir.x||want.y!==-dir.y){dir=want;break}}var head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};';
var STEP_MOVE = 'if(dead)return;snake.unshift(head);if(head.x===food.x&&head.y===food.y){food=spawnFood();updateScore()}else snake.pop()}';

var LOOP_120 = 'function loop(t){if(!dead&&t-lastTick>120){lastTick=t;step();if(dead&&score>best){best=score;try{localStorage.setItem("snakeBest",best)}catch(x){}document.getElementById("best").textContent=best}}draw(t);requestAnimationFrame(loop)}';
var LOOP_SPEED = 'function loop(t){var tickTime=Math.max(60,120-snake.length*2);if(!dead&&t-lastTick>tickTime){lastTick=t;step();if(dead&&score>best){best=score;try{localStorage.setItem("snakeBest",best)}catch(x){}document.getElementById("best").textContent=best}}draw(t);requestAnimationFrame(loop)}';

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '<\/head><body>' + html + '<script>' + code + '<\/script><\/body><\/html>';
}

/* ===================================================
   CW_CONFIG - snake-specific steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-js-snake-canvas',
  downloadName: 'my-snake-game.html',

  hints: [
    'Click the canvas, then use arrow keys to play',
    'Click the canvas and try steering with arrow keys',
    'The snake eats food and grows - try it!',
    'Try hitting a wall, then toggle Wrap mode',
    'Open on your phone to test swipe controls',
    'Watch the snake body fade from head to tail'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_S, CANVAS_S,
        SETUP_S + DRAW_S + KB_SIMPLE +
        'function loop(t){if(t-lastTick>120){lastTick=t;try{' + u +
        '}catch(e){}}draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_S, CANVAS_S,
        SETUP_S + 'var inputQueue=[];' + DRAW_S + u +
        'function loop(t){if(t-lastTick>120){lastTick=t;' +
        'while(inputQueue.length){var want=inputQueue.shift();if(want.x!==-dir.x||want.y!==-dir.y){dir=want;break}}' +
        'var head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};snake.unshift(head);snake.pop()' +
        '}draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_S, CANVAS_S,
        SETUP_S + 'var inputQueue=[];' + u +
        'var food=(typeof spawnFood==="function")?spawnFood():{x:5,y:5};' +
        DRAW_FOOD_OPEN + DRAW_SNAKE_SOLID + '}' +
        KB_QUEUE +
        'function loop(t){if(t-lastTick>120){lastTick=t;' +
        'while(inputQueue.length){var want=inputQueue.shift();if(want.x!==-dir.x||want.y!==-dir.y){dir=want;break}}' +
        'var head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};snake.unshift(head);' +
        'if(head.x===food.x&&head.y===food.y){if(typeof spawnFood==="function")food=spawnFood()}else{snake.pop()}' +
        '}draw(t);requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_F, CANVAS_F,
        SETUP_F + SPAWN + SCORE + RESET + KB_FULL +
        DRAW_FOOD_OPEN + DRAW_SNAKE_SOLID + DRAW_DEATH_CLOSE +
        STEP_OPEN + 'try{' + u + '}catch(e){}' + STEP_MOVE +
        LOOP_120 + 'reset();requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_F, CANVAS_F,
        SETUP_F + SPAWN + SCORE + RESET + KB_FULL +
        DRAW_FOOD_OPEN + DRAW_SNAKE_SOLID + DRAW_DEATH_CLOSE +
        STEP_OPEN + COLLISION + STEP_MOVE +
        u +
        LOOP_120 + 'reset();requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_F, CANVAS_F,
        SETUP_F + SPAWN + SCORE + RESET + KB_FULL +
        DRAW_FOOD_OPEN + u + DRAW_DEATH_CLOSE +
        STEP_OPEN + COLLISION + STEP_MOVE +
        TOUCH + LOOP_SPEED + 'reset();requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Grid & Tick Loop',
      goal: 'Make the snake move one cell every 120 ms.',
      points: [
        '25x25 grid of 16 px cells on a 400x400 canvas',
        'Every tick: create a new head cell, add to front, remove tail',
        '<code>unshift</code> adds to front, <code>pop</code> removes from back'
      ],
      challenge: 'Write the 3 lines that move the snake each tick:',
      starter: '// New head = current head position + direction\nconst head = { x: ???, y: ??? };\n// Add head to front of snake array\n// Remove the last tail segment\n',
      solution: 'const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\nsnake.unshift(head);\nsnake.pop();',
      checks: ['unshift', 'pop', 'snake[0]'],
      height: 100,
      fills: {
        text: 'Arrays grow at the front with ___ and shrink at the back with ___. One step happens every ___ milliseconds.',
        answers: ['unshift', 'pop', '120']
      },
      quiz: {
        question: 'Drawing happens every <code>requestAnimationFrame</code> frame but movement only on ticks. Why split them?',
        options: [
          'To make the code harder to read',
          'Smooth 60 FPS rendering with classic chunky Snake movement',
          'requestAnimationFrame requires separate functions'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'The Input Queue',
      goal: 'Queue arrow-key presses so fast combos work.',
      points: [
        'Push each key into an array instead of overwriting <code>dir</code>',
        'Each tick shifts one valid direction off the queue',
        'Reversals are rejected - you can\'t turn into your own neck'
      ],
      challenge: 'Write the keyboard handler that feeds the queue:',
      starter: '// Listen for arrow keys, push direction into inputQueue\ndocument.addEventListener("keydown", function(e) {\n  const map = {\n    ArrowUp:    {x: 0, y:-1},\n    ArrowDown:  {x: 0, y: 1},\n    ArrowLeft:  {x:-1, y: 0},\n    ArrowRight: {x: 1, y: 0}\n  };\n  // if this key is in the map, queue it\n  \n});',
      solution: 'document.addEventListener("keydown", function(e) {\n  const map = {\n    ArrowUp:    {x: 0, y:-1},\n    ArrowDown:  {x: 0, y: 1},\n    ArrowLeft:  {x:-1, y: 0},\n    ArrowRight: {x: 1, y: 0}\n  };\n  if (map[e.key]) inputQueue.push(map[e.key]);\n});',
      checks: ['addeventlistener', 'keydown', 'inputqueue.push'],
      height: 200,
      quiz: {
        question: 'Why is a queue better than a single <code>nextDir</code> variable?',
        options: [
          'Queues use less memory than variables',
          'Fast combos (up then left within one tick) are both remembered and applied over two ticks',
          'Arrays are required for keyboard events'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Food & Growth',
      goal: 'Spawn food that avoids the snake; eat to grow.',
      points: [
        'Random cell, but keep retrying if it lands on the snake',
        '<code>Array.some()</code> checks if ANY cell matches',
        'Eating = skip the <code>pop</code>, so the snake grows by one'
      ],
      challenge: 'Write the spawnFood function:',
      starter: '// Return a random {x, y} that doesn\'t overlap the snake\nfunction spawnFood() {\n  while (true) {\n    const f = {\n      x: ???,\n      y: ???\n    };\n    // if f is NOT on the snake, return it\n    \n  }\n}',
      solution: 'function spawnFood() {\n  while (true) {\n    const f = {\n      x: Math.floor(Math.random() * GRID),\n      y: Math.floor(Math.random() * GRID)\n    };\n    if (!snake.some(c => c.x === f.x && c.y === f.y)) return f;\n  }\n}',
      checks: ['math.random', 'some', 'return'],
      height: 190,
      fills: {
        text: 'The safe-spawn check uses the array method ___. Growth happens by skipping the ___.',
        answers: ['some', 'pop']
      },
      quiz: {
        question: '<code>snake.some(c => c.x === f.x && c.y === f.y)</code> returns -',
        options: [
          'The matching cell object',
          '<code>true</code> if at least one body cell is at the food position',
          'A new filtered array'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Death & Wrap-Around',
      goal: 'Add wall collision, self-bite, and a wrap toggle.',
      points: [
        'Wrap mode: <code>(head.x + GRID) % GRID</code> teleports across edges',
        'Classic mode: head out of bounds = dead',
        'Self-bite: head matches any body cell = dead'
      ],
      challenge: 'Write the collision checks (<code>head</code> is already computed):',
      starter: '// Read the wrap checkbox\nconst wrapMode = document.getElementById("wrap").checked;\n\n// If wrap: modulo both axes\n// Else: check out-of-bounds -> dead = true; return;\n\n// Self-collision: if head overlaps body -> dead = true; return;\n',
      solution: 'const wrapMode = document.getElementById("wrap").checked;\nif (wrapMode) {\n  head.x = (head.x + GRID) % GRID;\n  head.y = (head.y + GRID) % GRID;\n} else if (head.x < 0 || head.x > GRID-1 || head.y < 0 || head.y > GRID-1) {\n  dead = true; return;\n}\nif (snake.some(c => c.x === head.x && c.y === head.y)) {\n  dead = true; return;\n}',
      checks: ['%', 'dead', 'some'],
      height: 200,
      quiz: {
        question: 'Why add <code>GRID</code> before taking <code>% GRID</code>?',
        options: [
          'It makes the snake faster',
          'JS <code>%</code> keeps the sign: <code>-1 % 25</code> is <code>-1</code>, but <code>(-1+25) % 25</code> gives the desired <code>24</code>',
          'The modulo operator only works on positive numbers'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Touch Controls',
      goal: 'Swipe detection makes it playable on phones.',
      points: [
        'Record touch start position, compare with end position',
        'Bigger axis wins: |dx| > |dy| = horizontal swipe',
        'Feed the same <code>inputQueue</code> - zero new game logic needed'
      ],
      challenge: 'Write the touchstart + touchend handlers:',
      starter: '// Track where the finger lands, then compare on release\nlet touchStart = null;\ncanvas.addEventListener("touchstart", function(e) {\n  // save starting position\n  \n});\ncanvas.addEventListener("touchend", function(e) {\n  if (!touchStart) return;\n  // compare dx vs dy, push direction to inputQueue\n  \n});',
      solution: 'let touchStart = null;\ncanvas.addEventListener("touchstart", function(e) {\n  touchStart = {x: e.touches[0].clientX, y: e.touches[0].clientY};\n  e.preventDefault();\n});\ncanvas.addEventListener("touchend", function(e) {\n  if (!touchStart) return;\n  const dx = e.changedTouches[0].clientX - touchStart.x;\n  const dy = e.changedTouches[0].clientY - touchStart.y;\n  if (Math.abs(dx) > Math.abs(dy))\n    inputQueue.push({x: dx > 0 ? 1 : -1, y: 0});\n  else\n    inputQueue.push({x: 0, y: dy > 0 ? 1 : -1});\n  touchStart = null;\n});',
      checks: ['touchstart', 'touchend', 'inputqueue.push'],
      height: 240,
      fills: {
        text: "A swipe's direction comes from comparing ___ against abs(dy). Touch input pushes into the same input ___.",
        answers: ['abs(dx)', 'queue']
      },
      quiz: {
        question: 'Feeding touch into the existing <code>inputQueue</code> demonstrates -',
        options: [
          'That touch events are identical to keyboard events',
          'Good architecture: input sources vary, game logic stays one clean system',
          'A browser quirk specific to mobile devices'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Gradient Body',
      goal: 'Draw each segment with fading HSL colour.',
      points: [
        'HSL lets you compute ONE number (lightness) per segment',
        '<code>forEach</code> with index <code>i</code> gives the position in the body',
        'Head is bright, tail fades - lightness = <code>55 - i * 1.5</code>'
      ],
      challenge: 'Write the gradient snake draw code:',
      starter: '// Draw each segment with fading lightness\nsnake.forEach(function(c, i) {\n  ctx.fillStyle = "#4ade80";\n  ctx.fillRect(c.x*CELL+1, c.y*CELL+1, CELL-2, CELL-2);\n});',
      solution: 'snake.forEach(function(c, i) {\n  const light = 55 - Math.min(35, i * 1.5);\n  ctx.fillStyle = "hsl(155, 70%, " + light + "%)";\n  ctx.fillRect(c.x*CELL+1, c.y*CELL+1, CELL-2, CELL-2);\n});',
      checks: ['hsl', 'foreach', 'fillrect'],
      height: 120,
      quiz: {
        question: 'HSL colour beats hex for the gradient because -',
        options: [
          'It is shorter to type',
          'You can compute ONE number (lightness) per segment',
          'Browsers render HSL faster than hex'
        ],
        correct: 1
      }
    }
  ]
};
