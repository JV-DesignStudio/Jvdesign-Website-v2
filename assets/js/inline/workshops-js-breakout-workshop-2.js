'use strict';

/* ===================================================
   IFRAME BUILDING BLOCKS (breakout-specific)
   =================================================== */

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#222;margin:0;overflow:hidden}canvas{display:block;cursor:none}</style>';

var CANVAS_TAG = '<canvas id="game" width="400" height="500"></canvas>';

var SETUP_BASIC = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var PADDLE_OBJ = 'const paddle={x:160,y:475,w:80,h:12};';

var BALL_OBJ = 'const ball={x:200,y:460,r:8,vx:3,vy:-3};';

var BRICK_COLORS = 'const BRICK_COLORS=["#ff6b6b","#ffd166","#06d6a0","#60a5fa","#c084fc"];';

var BRICK_SETUP = 'const COLS=8,ROWS=5,BW=46,BH=18,BGAP=4;const bricks=[];for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++)bricks.push({x:c*(BW+BGAP)+8,y:r*(BH+BGAP)+40,w:BW,h:BH,alive:true,color:BRICK_COLORS[r]});';

var DRAW_BG = 'ctx.fillStyle="#181825";ctx.fillRect(0,0,400,500);';

var DRAW_PADDLE = 'ctx.fillStyle="#ffd166";ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);';

var DRAW_BALL = 'ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();';

var DRAW_BRICKS = 'for(var i=0;i<bricks.length;i++){var b=bricks[i];if(!b.alive)continue;ctx.shadowColor=b.color;ctx.shadowBlur=10;ctx.fillStyle=b.color;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.shadowBlur=0;}';

var DRAW_SCORE_BASIC = 'ctx.fillStyle="#fff";ctx.font="bold 18px sans-serif";ctx.textAlign="left";ctx.fillText("Score: "+score,10,25);ctx.textAlign="left";';
var DRAW_SCORE = 'ctx.fillStyle="#fff";ctx.font="bold 18px sans-serif";ctx.textAlign="left";ctx.fillText("Score: "+score,10,25);ctx.textAlign="right";ctx.fillText("Lives: "+lives+"  Level: "+level,390,25);ctx.textAlign="left";';

var DRAW_DEATH = 'if(dead){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,400,500);ctx.fillStyle="#fff";ctx.font="bold 30px sans-serif";ctx.textAlign="center";ctx.fillText("Game Over",200,220);ctx.font="18px sans-serif";ctx.fillText("Score: "+score,200,260);ctx.fillText("Click to retry",200,295);ctx.textAlign="left";}';

var DRAW_WIN = 'if(won){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,400,500);ctx.fillStyle="#ffd166";ctx.font="bold 30px sans-serif";ctx.textAlign="center";ctx.fillText("You Win!",200,220);ctx.font="18px sans-serif";ctx.fillStyle="#fff";ctx.fillText("Score: "+score,200,260);ctx.fillText("Click to play again",200,295);ctx.textAlign="left";}';

var MOUSE_HANDLER = 'canvas.addEventListener("mousemove",function(e){var rect=canvas.getBoundingClientRect();paddle.x=e.clientX-rect.left-paddle.w/2;if(paddle.x<0)paddle.x=0;if(paddle.x>400-paddle.w)paddle.x=400-paddle.w;});';

var WALL_BOUNCE = 'if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=-ball.vx;}if(ball.x+ball.r>400){ball.x=400-ball.r;ball.vx=-ball.vx;}if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=-ball.vy;}';

var PADDLE_BOUNCE = 'if(ball.y+ball.r>=paddle.y&&ball.y-ball.r<=paddle.y+paddle.h&&ball.x>=paddle.x&&ball.x<=paddle.x+paddle.w){ball.vy=-Math.abs(ball.vy);var hit=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);ball.vx=hit*5;ball.y=paddle.y-ball.r;}';

var BRICK_HIT = 'for(var i=0;i<bricks.length;i++){var b=bricks[i];if(!b.alive)continue;if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){b.alive=false;ball.vy=-ball.vy;score+=10;}}';

var PARTICLE_VARS = 'var particles=[];';

var BRICK_HIT_PARTICLES = 'for(var i=0;i<bricks.length;i++){var b=bricks[i];if(!b.alive)continue;if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){b.alive=false;ball.vy=-ball.vy;score+=10;for(var p=0;p<8;p++)particles.push({x:b.x+b.w/2,y:b.y+b.h/2,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,life:30,color:b.color});}}';

var PARTICLE_UPDATE = 'for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.x+=p.vx;p.y+=p.vy;p.life--;if(p.life<=0)particles.splice(i,1);}';

var PARTICLE_DRAW = 'for(var i=0;i<particles.length;i++){var p=particles[i];ctx.globalAlpha=p.life/30;ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,4,4);}ctx.globalAlpha=1;';

var SCORE_VARS = 'var score=0;';
var LIVES_VARS = 'var lives=3,level=1,dead=false,won=false;';

var BALL_MOVE = 'ball.x+=ball.vx;ball.y+=ball.vy;';

var BALL_DEATH_CHECK = 'if(ball.y-ball.r>500){lives--;if(lives<=0){dead=true;}else{ball.x=200;ball.y=460;ball.vx=3*((Math.random()>0.5)?1:-1);ball.vy=-3-level;}}';

var LEVEL_CHECK = 'var allDead=true;for(var i=0;i<bricks.length;i++)if(bricks[i].alive)allDead=false;if(allDead){level++;if(level>3){won=true;}else{for(var i=0;i<bricks.length;i++)bricks[i].alive=true;ball.x=200;ball.y=460;ball.vx=3*((Math.random()>0.5)?1:-1);ball.vy=-3-level;}}';

var RESTART_HANDLER = 'canvas.addEventListener("mousedown",function(){if(dead||won){score=0;lives=3;level=1;dead=false;won=false;for(var i=0;i<bricks.length;i++)bricks[i].alive=true;ball.x=200;ball.y=460;ball.vx=3;ball.vy=-3;particles=[];}});';

function wrap(code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + CSS_GAME +
    '<\/head><body>' + CANVAS_TAG + '<script>' + code + '<\/script><\/body><\/html>';
}

/* ===================================================
   CW_CONFIG - breakout-specific steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-js-breakout-canvas',
  downloadName: 'my-breakout-game.html',

  hints: [
    'A dark canvas appears - move your mouse to see the paddle follow',
    'The ball bounces off three walls - watch it ricochet around',
    'Hit the paddle to send the ball back up - angle matters!',
    'Neon bricks glow and shatter when the ball hits them',
    'Particles explode out of broken bricks - satisfying!',
    'Three lives, three levels - can you clear them all?'
  ],

  templates: {
    1: function(u) {
      return wrap(
        SETUP_BASIC + PADDLE_OBJ +
        'try{' + u + '}catch(e){}' +
        'function loop(){' +
        DRAW_BG + DRAW_PADDLE +
        'requestAnimationFrame(loop);}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(
        SETUP_BASIC + PADDLE_OBJ + BALL_OBJ +
        MOUSE_HANDLER +
        'function loop(){' +
        BALL_MOVE +
        'try{' + u + '}catch(e){}' +
        DRAW_BG + DRAW_PADDLE + DRAW_BALL +
        'requestAnimationFrame(loop);}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(
        SETUP_BASIC + PADDLE_OBJ + BALL_OBJ +
        MOUSE_HANDLER +
        'function loop(){' +
        BALL_MOVE + WALL_BOUNCE +
        'try{' + u + '}catch(e){}' +
        'if(ball.y-ball.r>500){ball.x=200;ball.y=460;ball.vx=3;ball.vy=-3;}' +
        DRAW_BG + DRAW_PADDLE + DRAW_BALL +
        'requestAnimationFrame(loop);}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(
        SETUP_BASIC + PADDLE_OBJ + BALL_OBJ + BRICK_COLORS + BRICK_SETUP + SCORE_VARS +
        MOUSE_HANDLER +
        'function loop(){' +
        BALL_MOVE + WALL_BOUNCE + PADDLE_BOUNCE +
        'try{' + u + '}catch(e){}' +
        'if(ball.y-ball.r>500){ball.x=200;ball.y=460;ball.vx=3;ball.vy=-3;}' +
        DRAW_BG + DRAW_BRICKS + DRAW_PADDLE + DRAW_BALL +
        DRAW_SCORE_BASIC +
        'requestAnimationFrame(loop);}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(
        SETUP_BASIC + PADDLE_OBJ + BALL_OBJ + BRICK_COLORS + BRICK_SETUP + SCORE_VARS + PARTICLE_VARS +
        MOUSE_HANDLER +
        'function loop(){' +
        BALL_MOVE + WALL_BOUNCE + PADDLE_BOUNCE +
        'try{' + u + '}catch(e){}' +
        PARTICLE_UPDATE +
        'if(ball.y-ball.r>500){ball.x=200;ball.y=460;ball.vx=3;ball.vy=-3;}' +
        DRAW_BG + DRAW_BRICKS + DRAW_PADDLE + DRAW_BALL + PARTICLE_DRAW +
        DRAW_SCORE_BASIC +
        'requestAnimationFrame(loop);}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(
        SETUP_BASIC + PADDLE_OBJ + BALL_OBJ + BRICK_COLORS + BRICK_SETUP + PARTICLE_VARS +
        'var score=0;' + LIVES_VARS +
        MOUSE_HANDLER +
        'function loop(){if(!dead&&!won){' +
        BALL_MOVE + WALL_BOUNCE + PADDLE_BOUNCE +
        BRICK_HIT_PARTICLES + PARTICLE_UPDATE +
        'try{' + u + '}catch(e){}}' +
        DRAW_BG + DRAW_BRICKS + DRAW_PADDLE + DRAW_BALL + PARTICLE_DRAW +
        DRAW_SCORE + DRAW_DEATH + DRAW_WIN +
        'requestAnimationFrame(loop);}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Canvas & Mouse Paddle',
      goal: 'Set up a 400x500 canvas and make a paddle follow the mouse.',
      points: [
        '<code>mousemove</code> fires every time the pointer moves - perfect for a paddle',
        '<code>getBoundingClientRect()</code> converts page coordinates to canvas coordinates',
        'Clamp the paddle so it stays within the canvas edges'
      ],
      challenge: 'Write the mousemove handler so the paddle tracks the mouse:',
      starter: '// Make the paddle follow the mouse\ncanvas.addEventListener("mousemove", function(e) {\n  // Get the canvas position on the page\n  var rect = canvas.getBoundingClientRect();\n  // Set paddle x to mouse position, centred on paddle\n  paddle.x = e.clientX - rect.left - paddle.w / 2;\n  // Clamp: keep paddle inside canvas\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x > 400 - paddle.w) paddle.x = ___;\n});',
      solution: 'canvas.addEventListener("mousemove", function(e) {\n  var rect = canvas.getBoundingClientRect();\n  paddle.x = e.clientX - rect.left - paddle.w / 2;\n  if (paddle.x < 0) paddle.x = 0;\n  if (paddle.x > 400 - paddle.w) paddle.x = 400 - paddle.w;\n});',
      checks: ['mousemove', 'getboundingclientrect', 'paddle'],
      height: 200,
      fills: {
        text: 'The ___ event fires whenever the pointer moves. To convert page coordinates to canvas coordinates, call canvas.___().',
        answers: ['mousemove', 'getBoundingClientRect']
      },
      quiz: {
        question: 'Why do we need <code>getBoundingClientRect()</code>?',
        options: [
          'It makes the canvas bigger',
          'Mouse events give page coordinates - we subtract the canvas position to get coordinates relative to the canvas itself',
          'It draws the paddle'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Ball & Wall Bounce',
      goal: 'Add a ball that moves with velocity and bounces off three walls.',
      points: [
        'The ball is an object: <code>{ x, y, r, vx, vy }</code> - position, radius, velocity',
        'Each frame: <code>x += vx</code> and <code>y += vy</code> moves the ball',
        'Reverse <code>vx</code> when hitting left/right walls, <code>vy</code> when hitting the top'
      ],
      challenge: 'Write the wall bounce logic for the ball:',
      starter: '// Bounce off left wall\nif (ball.x - ball.r < 0) {\n  ball.x = ball.r;\n  ball.vx = -ball.vx;\n}\n// Bounce off right wall\nif (ball.x + ball.r > 400) {\n  ball.x = 400 - ball.r;\n  ball.vx = ___;\n}\n// Bounce off top wall\nif (ball.y - ball.r < 0) {\n  ball.y = ball.r;\n  ball.vy = ___;\n}',
      solution: 'if (ball.x - ball.r < 0) {\n  ball.x = ball.r;\n  ball.vx = -ball.vx;\n}\nif (ball.x + ball.r > 400) {\n  ball.x = 400 - ball.r;\n  ball.vx = -ball.vx;\n}\nif (ball.y - ball.r < 0) {\n  ball.y = ball.r;\n  ball.vy = -ball.vy;\n}',
      checks: ['ball.vx', 'ball.vy', 'ball.x'],
      height: 230,
      fills: {
        text: 'Reversing a velocity means multiplying it by ___. The ball bounces off ___ walls (left, right and top).',
        answers: ['-1', '3']
      },
      quiz: {
        question: 'Why does the ball NOT bounce off the bottom wall?',
        options: [
          'The bottom wall is broken',
          'Missing the bottom is how you lose - the ball falls past the paddle and you lose a life',
          'The canvas is only 400 pixels tall'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Paddle Rebound',
      goal: 'Make the ball bounce off the paddle with spin based on hit position.',
      points: [
        'Check if the ball overlaps the paddle rectangle each frame',
        'On hit, reverse <code>vy</code> so the ball goes back up',
        'Where the ball hits the paddle sets <code>vx</code> - centre goes straight, edges angle sharply'
      ],
      challenge: 'Write the paddle collision with spin:',
      starter: '// Check if ball reached paddle height and is within paddle width\nif (ball.y + ball.r >= paddle.y &&\n    ball.y - ball.r <= paddle.y + paddle.h &&\n    ball.x >= paddle.x &&\n    ball.x <= paddle.x + paddle.w) {\n  // Bounce upward\n  ball.vy = -Math.abs(ball.vy);\n  // Spin: -1 at left edge, 0 at centre, +1 at right edge\n  var hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);\n  ball.vx = hit * ___;\n  // Push ball above paddle to avoid sticking\n  ball.y = paddle.y - ball.r;\n}',
      solution: 'if (ball.y + ball.r >= paddle.y &&\n    ball.y - ball.r <= paddle.y + paddle.h &&\n    ball.x >= paddle.x &&\n    ball.x <= paddle.x + paddle.w) {\n  ball.vy = -Math.abs(ball.vy);\n  var hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);\n  ball.vx = hit * 5;\n  ball.y = paddle.y - ball.r;\n}',
      checks: ['paddle', 'ball.vy', 'ball.vx'],
      height: 250,
      fills: {
        text: 'The hit variable ranges from ___ (left edge) to +1 (right edge). Multiplying it by 5 sets the ball\'s horizontal ___.',
        answers: ['-1', 'velocity']
      },
      quiz: {
        question: 'Why use <code>-Math.abs(ball.vy)</code> instead of <code>-ball.vy</code>?',
        options: [
          'It is faster to compute',
          'If the ball hits the paddle twice in a row, <code>-ball.vy</code> would flip it downward again - <code>-Math.abs()</code> always forces it upward',
          'Math.abs makes the ball go faster'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Bricks & Glow',
      goal: 'Create a grid of colourful bricks that shatter when the ball hits them.',
      points: [
        'Bricks are stored in an array - each has <code>{ x, y, w, h, alive, color }</code>',
        'Draw each alive brick with <code>shadowBlur</code> for a neon glow effect',
        'On collision, set <code>alive = false</code> and reverse the ball\'s <code>vy</code>'
      ],
      challenge: 'Write the brick collision logic:',
      starter: '// Check every brick for collision\nfor (var i = 0; i < bricks.length; i++) {\n  var b = bricks[i];\n  if (!b.alive) continue;\n  // Ball overlaps brick?\n  if (ball.x + ball.r > b.x &&\n      ball.x - ball.r < b.x + b.w &&\n      ball.y + ball.r > b.y &&\n      ball.y - ball.r < b.y + b.h) {\n    b.___ = false;\n    ball.vy = -ball.vy;\n    score += 10;\n  }\n}',
      solution: 'for (var i = 0; i < bricks.length; i++) {\n  var b = bricks[i];\n  if (!b.alive) continue;\n  if (ball.x + ball.r > b.x &&\n      ball.x - ball.r < b.x + b.w &&\n      ball.y + ball.r > b.y &&\n      ball.y - ball.r < b.y + b.h) {\n    b.alive = false;\n    ball.vy = -ball.vy;\n    score += 10;\n  }\n}',
      checks: ['bricks', 'alive', 'ball.vy'],
      height: 260,
      fills: {
        text: 'Each brick\'s ___ property controls whether it draws and collides. The neon glow uses ctx.___ on the canvas context.',
        answers: ['alive', 'shadowBlur']
      },
      quiz: {
        question: 'Why do we use <code>if (!b.alive) continue;</code> inside the loop?',
        options: [
          'It makes the loop run backwards',
          'Skip destroyed bricks - no point drawing or collision-checking something that is already gone',
          'It deletes the brick from the array'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Particle Explosions',
      goal: 'Spawn particles that burst out when a brick breaks.',
      points: [
        'When a brick dies, push 8 small particles into a <code>particles</code> array',
        'Each particle has random velocity, a colour matching the brick, and a <code>life</code> countdown',
        'Each frame: move particles, decrease life, remove dead ones with <code>splice</code>'
      ],
      challenge: 'Write the particle spawning code inside the brick-hit block:',
      starter: '// When a brick is destroyed, spawn particles\n// (This code goes right after b.alive = false)\nfor (var p = 0; p < 8; p++) {\n  particles.push({\n    x: b.x + b.w / 2,\n    y: b.y + b.h / 2,\n    vx: (Math.random() - 0.5) * 4,\n    vy: (Math.random() - 0.5) * 4,\n    life: ___,\n    color: b.color\n  });\n}',
      solution: 'for (var p = 0; p < 8; p++) {\n  particles.push({\n    x: b.x + b.w / 2,\n    y: b.y + b.h / 2,\n    vx: (Math.random() - 0.5) * 4,\n    vy: (Math.random() - 0.5) * 4,\n    life: 30,\n    color: b.color\n  });\n}',
      checks: ['particles', 'push', 'random'],
      height: 220,
      fills: {
        text: '<code>Math.random() - 0.5</code> gives a number between ___ and 0.5, creating random directions. Particles fade using a ___ counter.',
        answers: ['-0.5', 'life']
      },
      quiz: {
        question: 'Why multiply <code>(Math.random() - 0.5)</code> by 4?',
        options: [
          'Random gives 0 to 1, subtracting 0.5 centres it, and multiplying by 4 scales the speed - particles fly in all directions with decent velocity',
          'It makes exactly four particles',
          'It sets the particle colour'
        ],
        correct: 0
      }
    },
    {
      num: 6,
      title: 'Lives, Levels & Ship It',
      goal: 'Add 3 lives, level progression with speed increase, and a restart flow.',
      points: [
        'When the ball falls off the bottom, lose a life and reset the ball - at 0 lives, game over',
        'Clear all bricks to advance a level - speed increases and bricks respawn',
        'After level 3, show "You Win!" and let the player click to start over'
      ],
      challenge: 'Write the lives and level-up logic:',
      starter: '// Ball fell off the bottom\nif (ball.y - ball.r > 500) {\n  lives--;\n  if (lives <= 0) {\n    dead = true;\n  } else {\n    ball.x = 200;\n    ball.y = 460;\n    ball.vx = 3 * ((Math.random() > 0.5) ? 1 : -1);\n    ball.vy = -3 - ___;\n  }\n}\n// Check if all bricks are destroyed\nvar allDead = true;\nfor (var i = 0; i < bricks.length; i++)\n  if (bricks[i].alive) allDead = false;\nif (allDead) {\n  level++;\n  if (level > 3) {\n    won = true;\n  } else {\n    for (var i = 0; i < bricks.length; i++) bricks[i].___ = true;\n    ball.x = 200;\n    ball.y = 460;\n    ball.vx = 3 * ((Math.random() > 0.5) ? 1 : -1);\n    ball.vy = -3 - level;\n  }\n}',
      solution: 'if (ball.y - ball.r > 500) {\n  lives--;\n  if (lives <= 0) {\n    dead = true;\n  } else {\n    ball.x = 200;\n    ball.y = 460;\n    ball.vx = 3 * ((Math.random() > 0.5) ? 1 : -1);\n    ball.vy = -3 - level;\n  }\n}\nvar allDead = true;\nfor (var i = 0; i < bricks.length; i++)\n  if (bricks[i].alive) allDead = false;\nif (allDead) {\n  level++;\n  if (level > 3) {\n    won = true;\n  } else {\n    for (var i = 0; i < bricks.length; i++) bricks[i].alive = true;\n    ball.x = 200;\n    ball.y = 460;\n    ball.vx = 3 * ((Math.random() > 0.5) ? 1 : -1);\n    ball.vy = -3 - level;\n  }\n}',
      checks: ['lives', 'level', 'dead'],
      height: 400,
      fills: {
        text: 'The ball speeds up each level because vy is set to <code>-3 - ___</code>. After level 3 the game sets ___ to true.',
        answers: ['level', 'won']
      },
      quiz: {
        question: 'Why does <code>ball.vy = -3 - level</code> make the game harder each level?',
        options: [
          'It changes the paddle size',
          'Higher level means a larger negative vy - the ball starts faster, giving less reaction time',
          'It adds more bricks'
        ],
        correct: 1
      }
    }
  ]
};
