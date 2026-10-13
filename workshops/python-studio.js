/* Python Studio
   Pick a game from the My First Python Game series, tune it, play it live in
   the browser, then export a runnable pygame project (real main.py + README).
   The preview runs the same logic as the exported Python, so what you see is
   what the project does.

   Exports a small node API (GAMES, projectFiles, ...) so
   tests/python-studio-http.js can check the projects without a browser. */
(function () {
  'use strict';

  var W = 640, H = 480;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function randi(a, b) { return a + Math.floor(Math.random() * (b - a)); }

  function num(k, label, min, max, def) { return { k: k, label: label, type: 'number', min: min, max: max, def: def }; }
  function rgb(k, label, def) { return { k: k, label: label, type: 'rgb', def: def }; }

  function hexToTuple(hex) {
    var h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h || '000000', 16);
    return '(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')';
  }

  /* ============================ Python project builders ============================ */
  function head(title, v) {
    return [
      'import pygame',
      'import random',
      'import sys',
      '',
      'pygame.init()',
      'W, H = 640, 480',
      'screen = pygame.display.set_mode((W, H))',
      'pygame.display.set_caption(' + JSON.stringify(title) + ')',
      'clock = pygame.time.Clock()',
      'font = pygame.font.SysFont("arial", 28)',
      'big = pygame.font.SysFont("arial", 48, bold=True)',
      '',
      '# Colours',
      'BG = ' + hexToTuple(v.col_bg || '#101828'),
      'C1 = ' + hexToTuple(v.col_a || '#06d6a0'),
      'C2 = ' + hexToTuple(v.col_b || '#ef476f'),
      'C3 = ' + hexToTuple(v.col_c || '#ffd166'),
      'C4 = ' + hexToTuple(v.col_d || '#118ab2'),
      ''
    ].join('\n');
  }
  function tail() {
    return [
      '',
      '    pygame.display.flip()',
      '    clock.tick(60)'
    ].join('\n');
  }

  function catchPython(title, v) {
    return head(title, v) + [
      'PLAYER_SPEED = ' + v.player_speed,
      'FALL_SPEED = ' + v.fall_speed,
      'SPAWN_EVERY = ' + v.spawn,
      'LIVES = ' + v.lives,
      'STARTX = ' + ((typeof v.startX === 'number') ? v.startX : 0.5),
      '',
      'player = pygame.Rect(0, 0, 70, 24)',
      'player.midbottom = (int(W * STARTX), H - 20)',
      'fruits = []',
      'lives = LIVES',
      'score = 0',
      'frame = 0',
      '',
      'def reset():',
      '    global lives, score, frame, fruits',
      '    lives = LIVES',
      '    score = 0',
      '    frame = 0',
      '    fruits = []',
      '    player.midbottom = (int(W * STARTX), H - 20)',
      '',
      'while True:',
      '    for event in pygame.event.get():',
      '        if event.type == pygame.QUIT:',
      '            pygame.quit()',
      '            sys.exit()',
      '    keys = pygame.key.get_pressed()',
      '    if keys[pygame.K_LEFT] or keys[pygame.K_a]:',
      '        player.x -= PLAYER_SPEED',
      '    if keys[pygame.K_RIGHT] or keys[pygame.K_d]:',
      '        player.x += PLAYER_SPEED',
      '    player.x = max(0, min(W - player.width, player.x))',
      '',
      '    frame += 1',
      '    if frame % SPAWN_EVERY == 0:',
      '        fruits.append(pygame.Rect(random.randint(0, W - 28), -20, 28, 28))',
      '',
      '    for fruit in fruits[:]:',
      '        fruit.y += FALL_SPEED',
      '        if fruit.colliderect(player):',
      '            fruits.remove(fruit)',
      '            score += 1',
      '        elif fruit.top > H:',
      '            fruits.remove(fruit)',
      '            lives -= 1',
      '    if lives <= 0:',
      '        reset()',
      '',
      '    screen.fill(BG)',
      '    pygame.draw.rect(screen, C1, player)',
      '    for fruit in fruits:',
      '        pygame.draw.circle(screen, C3, fruit.center, 14)',
      '    screen.blit(font.render("Score " + str(score), True, (255, 255, 255)), (12, 10))',
      '    screen.blit(font.render("Lives " + str(lives), True, (255, 255, 255)), (12, 44))',
      tail()
    ].join('\n') + '\n';
  }

  function dodgePython(title, v) {
    return head(title, v) + [
      'PLAYER_SPEED = ' + v.player_speed,
      'ENEMY_SPEED = ' + v.enemy_speed,
      'SPAWN_EVERY = ' + v.spawn,
      'LIVES = ' + v.lives,
      'STARTX = ' + ((typeof v.startX === 'number') ? v.startX : 0.5),
      '',
      'player = pygame.Rect(int(W * STARTX), H - 60, 34, 34)',
      'hazards = []',
      'lives = LIVES',
      'frame = 0',
      '',
      'def reset():',
      '    global lives, frame, hazards',
      '    lives = LIVES',
      '    frame = 0',
      '    hazards = []',
      '    player.x = int(W * STARTX)',
      '    player.y = H - 60',
      '',
      'while True:',
      '    for event in pygame.event.get():',
      '        if event.type == pygame.QUIT:',
      '            pygame.quit()',
      '            sys.exit()',
      '    keys = pygame.key.get_pressed()',
      '    if keys[pygame.K_LEFT] or keys[pygame.K_a]:',
      '        player.x -= PLAYER_SPEED',
      '    if keys[pygame.K_RIGHT] or keys[pygame.K_d]:',
      '        player.x += PLAYER_SPEED',
      '    if keys[pygame.K_UP] or keys[pygame.K_w]:',
      '        player.y -= PLAYER_SPEED',
      '    if keys[pygame.K_DOWN] or keys[pygame.K_s]:',
      '        player.y += PLAYER_SPEED',
      '    player.x = max(0, min(W - player.width, player.x))',
      '    player.y = max(0, min(H - player.height, player.y))',
      '',
      '    frame += 1',
      '    if frame % SPAWN_EVERY == 0:',
      '        hazards.append(pygame.Rect(random.randint(0, W - 30), -30, 30, 30))',
      '',
      '    for h in hazards[:]:',
      '        h.y += ENEMY_SPEED',
      '        if h.colliderect(player):',
      '            hazards.remove(h)',
      '            lives -= 1',
      '        elif h.top > H:',
      '            hazards.remove(h)',
      '    if lives <= 0:',
      '        reset()',
      '',
      '    screen.fill(BG)',
      '    pygame.draw.rect(screen, C1, player)',
      '    for h in hazards:',
      '        pygame.draw.rect(screen, C2, h)',
      '    seconds = frame // 60',
      '    screen.blit(font.render("Time " + str(seconds) + "s", True, (255, 255, 255)), (12, 10))',
      '    screen.blit(font.render("Lives " + str(lives), True, (255, 255, 255)), (12, 44))',
      tail()
    ].join('\n') + '\n';
  }

  function mazePython(title, v) {
    return head(title, v) + [
      'COLS = ' + v.cols,
      'ROWS = ' + v.rows,
      'CELL = 40',
      'OX = (W - COLS * CELL) // 2',
      'OY = (H - ROWS * CELL) // 2',
      '',
      'def is_wall(cx, cy):',
      '    if cx == 0 or cy == 0 or cx == COLS - 1 or cy == ROWS - 1:',
      '        return True',
      '    return cx % 2 == 0 and cy % 2 == 0',
      '',
      'px, py = 1, 1',
      'goal = (COLS - 2, ROWS - 2)',
      'won = False',
      '',
      'while True:',
      '    for event in pygame.event.get():',
      '        if event.type == pygame.QUIT:',
      '            pygame.quit()',
      '            sys.exit()',
      '        if event.type == pygame.KEYDOWN and not won:',
      '            nx, ny = px, py',
      '            if event.key in (pygame.K_LEFT, pygame.K_a): nx -= 1',
      '            if event.key in (pygame.K_RIGHT, pygame.K_d): nx += 1',
      '            if event.key in (pygame.K_UP, pygame.K_w): ny -= 1',
      '            if event.key in (pygame.K_DOWN, pygame.K_s): ny += 1',
      '            if not is_wall(nx, ny):',
      '                px, py = nx, ny',
      '            if (px, py) == goal:',
      '                won = True',
      '        if event.type == pygame.KEYDOWN and won and event.key == pygame.K_SPACE:',
      '            px, py = 1, 1',
      '            won = False',
      '',
      '    screen.fill(BG)',
      '    for cx in range(COLS):',
      '        for cy in range(ROWS):',
      '            if is_wall(cx, cy):',
      '                pygame.draw.rect(screen, C4, (OX + cx * CELL, OY + cy * CELL, CELL - 2, CELL - 2))',
      '    pygame.draw.rect(screen, C3, (OX + goal[0] * CELL + 6, OY + goal[1] * CELL + 6, CELL - 14, CELL - 14))',
      '    pygame.draw.rect(screen, C1, (OX + px * CELL + 6, OY + py * CELL + 6, CELL - 14, CELL - 14))',
      '    if won:',
      '        screen.blit(big.render("You win!", True, C3), (W // 2 - 110, 16))',
      tail()
    ].join('\n') + '\n';
  }

  function breakoutPython(title, v) {
    return head(title, v) + [
      'PADDLE_SPEED = ' + v.paddle_speed,
      'BALL_SPEED = ' + v.ball_speed,
      '',
      'paddle = pygame.Rect(0, 0, 90, 14)',
      'paddle.midbottom = (W // 2, H - 20)',
      'ball = pygame.Rect(0, 0, 16, 16)',
      'bricks = []',
      'for row in range(4):',
      '    for col in range(8):',
      '        bricks.append(pygame.Rect(40 + col * 70, 50 + row * 28, 60, 20))',
      '',
      'def reset():',
      '    global vx, vy',
      '    paddle.midbottom = (W // 2, H - 20)',
      '    ball.center = (W // 2, H // 2)',
      '    vx = BALL_SPEED',
      '    vy = -BALL_SPEED',
      '',
      'vx, vy = BALL_SPEED, -BALL_SPEED',
      'ball.center = (W // 2, H // 2)',
      '',
      'while True:',
      '    for event in pygame.event.get():',
      '        if event.type == pygame.QUIT:',
      '            pygame.quit()',
      '            sys.exit()',
      '    keys = pygame.key.get_pressed()',
      '    if keys[pygame.K_LEFT] or keys[pygame.K_a]:',
      '        paddle.x -= PADDLE_SPEED',
      '    if keys[pygame.K_RIGHT] or keys[pygame.K_d]:',
      '        paddle.x += PADDLE_SPEED',
      '    paddle.x = max(0, min(W - paddle.width, paddle.x))',
      '',
      '    ball.x += vx',
      '    ball.y += vy',
      '    if ball.left < 0 or ball.right > W:',
      '        vx = -vx',
      '    if ball.top < 0:',
      '        vy = -vy',
      '    if ball.colliderect(paddle) and vy > 0:',
      '        vy = -vy',
      '    for brick in bricks[:]:',
      '        if ball.colliderect(brick):',
      '            bricks.remove(brick)',
      '            vy = -vy',
      '            break',
      '    if ball.top > H or len(bricks) == 0:',
      '        reset()',
      '',
      '    screen.fill(BG)',
      '    pygame.draw.rect(screen, C4, paddle)',
      '    pygame.draw.circle(screen, C1, ball.center, 8)',
      '    for brick in bricks:',
      '        pygame.draw.rect(screen, C2, brick)',
      tail()
    ].join('\n') + '\n';
  }

  function platformerPython(title, v) {
    return head(title, v) + [
      'RUN_SPEED = ' + v.run_speed,
      'GRAVITY = ' + v.gravity,
      'JUMP_POWER = ' + v.jump,
      '',
      'player = pygame.Rect(40, 380, 30, 40)',
      'vx = 0',
      'vy = 0',
      'on_ground = False',
      'platforms = [',
      '    pygame.Rect(0, 440, W, 40),',
      '    pygame.Rect(160, 360, 120, 20),',
      '    pygame.Rect(340, 300, 120, 20),',
      '    pygame.Rect(480, 230, 120, 20),',
      ']',
      'goal = pygame.Rect(600, 180, 24, 50)',
      '',
      'while True:',
      '    for event in pygame.event.get():',
      '        if event.type == pygame.QUIT:',
      '            pygame.quit()',
      '            sys.exit()',
      '    keys = pygame.key.get_pressed()',
      '    vx = 0',
      '    if keys[pygame.K_LEFT] or keys[pygame.K_a]:',
      '        vx = -RUN_SPEED',
      '    if keys[pygame.K_RIGHT] or keys[pygame.K_d]:',
      '        vx = RUN_SPEED',
      '    if (keys[pygame.K_SPACE] or keys[pygame.K_UP] or keys[pygame.K_w]) and on_ground:',
      '        vy = -JUMP_POWER',
      '        on_ground = False',
      '',
      '    player.x += vx',
      '    vy += GRAVITY',
      '    player.y += vy',
      '    on_ground = False',
      '    for plat in platforms:',
      '        if player.colliderect(plat) and vy >= 0 and player.bottom - vy <= plat.top + 10:',
      '            player.bottom = plat.top',
      '            vy = 0',
      '            on_ground = True',
      '    player.x = max(0, min(W - player.width, player.x))',
      '',
      '    screen.fill(BG)',
      '    for plat in platforms:',
      '        pygame.draw.rect(screen, C4, plat)',
      '    pygame.draw.rect(screen, C3, goal)',
      '    pygame.draw.rect(screen, C1, player)',
      '    if player.colliderect(goal):',
      '        screen.blit(big.render("You win!", True, C3), (W // 2 - 110, 16))',
      tail()
    ].join('\n') + '\n';
  }

  /* ============================ Games (preview + export) ============================ */
  var GAMES = {
    catch: {
      emoji: '🍎', name: 'Fruit Catch',
      blurb: 'Move the basket left and right to catch the falling fruit. Miss one and you lose a life.',
      controls: 'Left and Right (or A and D) move the basket. Catch as much fruit as you can.',
      fields: [num('player_speed', 'Basket speed', 2, 12, 6), num('fall_speed', 'Fruit speed', 1, 10, 4), num('spawn', 'Frames between fruit', 10, 90, 45), num('lives', 'Lives', 1, 9, 3), rgb('col_bg', 'Background', '#101828'), rgb('col_a', 'Basket colour', '#06d6a0'), rgb('col_c', 'Fruit colour', '#ffd166')],
      python: catchPython,
      make: function (v) {
        var s = {};
        s.reset = function () { s.px = clamp(startXPx(v, W) - 35, 0, W - 70); s.py = H - 20 - 24; s.fruits = []; s.frame = 0; s.score = 0; s.lives = v.lives; };
        function hit(f) { return f.x < s.px + 70 && f.x + 28 > s.px && f.y < s.py + 24 && f.y + 28 > s.py; }
        s.update = function (k) {
          if (k.left) s.px -= v.player_speed; if (k.right) s.px += v.player_speed;
          s.px = clamp(s.px, 0, W - 70);
          s.frame++;
          if (s.frame % v.spawn === 0) s.fruits.push({ x: randi(0, W - 28), y: -20 });
          for (var i = s.fruits.length - 1; i >= 0; i--) {
            var f = s.fruits[i]; f.y += v.fall_speed;
            if (hit(f)) { s.fruits.splice(i, 1); s.score++; }
            else if (f.y > H) { s.fruits.splice(i, 1); s.lives--; }
          }
          if (s.lives <= 0) s.reset();
        };
        s.draw = function (g) {
          g.fill(v.col_bg, 0, 0, W, H);
          g.fill(v.col_a, s.px, s.py, 70, 24);
          for (var i = 0; i < s.fruits.length; i++) g.circle(v.col_c, s.fruits[i].x + 14, s.fruits[i].y + 14, 14);
          g.text('Score ' + s.score, '#ffffff', 12, 10);
          g.text('Lives ' + s.lives, '#ffffff', 12, 44);
        };
        s.reset(); return s;
      }
    },

    dodge: {
      emoji: '💨', name: 'Dodge & Collect',
      blurb: 'Dodge the falling blocks for as long as you can. Move in every direction to stay clear.',
      controls: 'Arrow keys or W A S D move your block. Survive for the longest time you can.',
      fields: [num('player_speed', 'Move speed', 2, 10, 5), num('enemy_speed', 'Hazard speed', 2, 12, 5), num('spawn', 'Frames between hazards', 8, 60, 28), num('lives', 'Lives', 1, 9, 3), rgb('col_bg', 'Background', '#101828'), rgb('col_a', 'Player colour', '#06d6a0'), rgb('col_b', 'Hazard colour', '#ef476f')],
      python: dodgePython,
      make: function (v) {
        var s = {};
        s.reset = function () { s.px = clamp(startXPx(v, W) - 17, 0, W - 34); s.py = H - 60; s.haz = []; s.frame = 0; s.lives = v.lives; };
        function hit(h) { return h.x < s.px + 34 && h.x + 30 > s.px && h.y < s.py + 34 && h.y + 30 > s.py; }
        s.update = function (k) {
          if (k.left) s.px -= v.player_speed; if (k.right) s.px += v.player_speed;
          if (k.up) s.py -= v.player_speed; if (k.down) s.py += v.player_speed;
          s.px = clamp(s.px, 0, W - 34); s.py = clamp(s.py, 0, H - 34);
          s.frame++;
          if (s.frame % v.spawn === 0) s.haz.push({ x: randi(0, W - 30), y: -30 });
          for (var i = s.haz.length - 1; i >= 0; i--) {
            var h = s.haz[i]; h.y += v.enemy_speed;
            if (hit(h)) { s.haz.splice(i, 1); s.lives--; }
            else if (h.y > H) s.haz.splice(i, 1);
          }
          if (s.lives <= 0) s.reset();
        };
        s.draw = function (g) {
          g.fill(v.col_bg, 0, 0, W, H);
          g.fill(v.col_a, s.px, s.py, 34, 34);
          for (var i = 0; i < s.haz.length; i++) g.fill(v.col_b, s.haz[i].x, s.haz[i].y, 30, 30);
          g.text('Time ' + Math.floor(s.frame / 60) + 's', '#ffffff', 12, 10);
          g.text('Lives ' + s.lives, '#ffffff', 12, 44);
        };
        s.reset(); return s;
      }
    },

    maze: {
      emoji: '🧭', name: 'Maze Explorer',
      blurb: 'Step through the maze to reach the yellow goal. Each tap moves you one square.',
      controls: 'Arrow keys or W A S D step one square. Reach the yellow square to win.',
      fields: [num('cols', 'Maze width', 7, 15, 13), num('rows', 'Maze height', 7, 11, 11), rgb('col_bg', 'Background', '#101828'), rgb('col_a', 'Player colour', '#06d6a0'), rgb('col_d', 'Wall colour', '#118ab2'), rgb('col_c', 'Goal colour', '#ffd166')],
      python: mazePython,
      make: function (v) {
        var s = {}, cs = 40;
        var n = Math.round(v.cols), m = Math.round(v.rows);
        s.ox = (W - n * cs) / 2; s.oy = (H - m * cs) / 2; s.cs = cs; s.n = n; s.m = m;
        s.wall = function (cx, cy) { return cx === 0 || cy === 0 || cx === n - 1 || cy === m - 1 || (cx % 2 === 0 && cy % 2 === 0); };
        s.reset = function () { s.px = 1; s.py = 1; s.won = false; };
        s.update = function (k, p) {
          if (s.won) { if (p.action) s.reset(); return; }
          var nx = s.px, ny = s.py;
          if (p.left) nx--; else if (p.right) nx++; else if (p.up) ny--; else if (p.down) ny++;
          if ((nx !== s.px || ny !== s.py) && !s.wall(nx, ny)) { s.px = nx; s.py = ny; }
          if (s.px === n - 2 && s.py === m - 2) s.won = true;
        };
        s.draw = function (g) {
          g.fill(v.col_bg, 0, 0, W, H);
          for (var cx = 0; cx < n; cx++) for (var cy = 0; cy < m; cy++) if (s.wall(cx, cy)) g.fill(v.col_d, s.ox + cx * cs, s.oy + cy * cs, cs - 2, cs - 2);
          g.fill(v.col_c, s.ox + (n - 2) * cs + 6, s.oy + (m - 2) * cs + 6, cs - 14, cs - 14);
          g.fill(v.col_a, s.ox + s.px * cs + 6, s.oy + s.py * cs + 6, cs - 14, cs - 14);
          if (s.won) g.text('You win!', '#ffffff', W / 2 - 40, 16);
        };
        s.reset(); return s;
      }
    },

    breakout: {
      emoji: '🧱', name: 'Breakout',
      blurb: 'Bounce the ball off your paddle to smash every brick. Clear them all to win.',
      controls: 'Left and Right (or A and D) move the paddle. Keep the ball up.',
      fields: [num('paddle_speed', 'Paddle speed', 3, 12, 7), num('ball_speed', 'Ball speed', 2, 10, 5), rgb('col_bg', 'Background', '#101828'), rgb('col_a', 'Ball colour', '#06d6a0'), rgb('col_b', 'Brick colour', '#ef476f'), rgb('col_d', 'Paddle colour', '#118ab2')],
      python: breakoutPython,
      make: function (v) {
        var s = {};
        s.reset = function () {
          s.px = clamp(startXPx(v, W) - 45, 0, W - 90); s.py = H - 34; s.bx = W / 2; s.by = H / 2; s.vx = v.ball_speed; s.vy = -v.ball_speed;
          s.bricks = [];
          for (var r = 0; r < 4; r++) for (var c = 0; c < 8; c++) s.bricks.push({ x: 40 + c * 70, y: 50 + r * 28 });
        };
        s.update = function (k) {
          if (k.left) s.px -= v.paddle_speed; if (k.right) s.px += v.paddle_speed;
          s.px = clamp(s.px, 0, W - 90);
          s.bx += s.vx; s.by += s.vy;
          if (s.bx < 8 || s.bx > W - 8) s.vx = -s.vx;
          if (s.by < 8) s.vy = -s.vy;
          if (s.by + 8 > s.py && s.by - 8 < s.py + 14 && s.bx > s.px && s.bx < s.px + 90 && s.vy > 0) s.vy = -Math.abs(s.vy);
          for (var i = s.bricks.length - 1; i >= 0; i--) {
            var b = s.bricks[i];
            if (s.bx > b.x - 8 && s.bx < b.x + 68 && s.by > b.y - 8 && s.by < b.y + 28) { s.bricks.splice(i, 1); s.vy = -s.vy; break; }
          }
          if (s.by > H || s.bricks.length === 0) s.reset();
        };
        s.draw = function (g) {
          g.fill(v.col_bg, 0, 0, W, H);
          for (var i = 0; i < s.bricks.length; i++) g.fill(v.col_b, s.bricks[i].x, s.bricks[i].y, 60, 20);
          g.fill(v.col_d, s.px, s.py, 90, 14);
          g.circle(v.col_a, s.bx, s.by, 8);
        };
        s.reset(); return s;
      }
    },

    platformer: {
      emoji: '🏃', name: 'Simple Platformer',
      blurb: 'Run and jump between platforms to reach the flag. Tune the gravity and jump to change the feel.',
      controls: 'Left and Right (or A and D) to run. Space, W or the up arrow to jump.',
      fields: [num('run_speed', 'Run speed', 2, 10, 5), num('gravity', 'Gravity', 0.3, 2, 0.8), num('jump', 'Jump power', 6, 20, 14), rgb('col_bg', 'Background', '#101828'), rgb('col_a', 'Player colour', '#06d6a0'), rgb('col_d', 'Platform colour', '#118ab2'), rgb('col_c', 'Flag colour', '#ffd166')],
      python: platformerPython,
      make: function (v) {
        var s = {};
        var plats = [{ x: 0, y: 440, w: W, h: 40 }, { x: 160, y: 360, w: 120, h: 20 }, { x: 340, y: 300, w: 120, h: 20 }, { x: 480, y: 230, w: 120, h: 20 }];
        s.plats = plats; s.goal = { x: 600, y: 180, w: 24, h: 50 };
        s.reset = function () { s.px = clamp(startXPx(v, W) - 15, 0, W - 30); s.py = 380; s.vy = 0; s.onfloor = false; };
        s.update = function (k, p) {
          var vx = 0;
          if (k.left) vx = -v.run_speed; if (k.right) vx = v.run_speed;
          if ((k.action || k.up) && s.onfloor) { s.vy = -v.jump; s.onfloor = false; }
          s.px += vx;
          s.vy += v.gravity; s.py += s.vy;
          s.onfloor = false;
          for (var i = 0; i < plats.length; i++) {
            var pl = plats[i];
            var bot = s.py + 40;
            if (s.px < pl.x + pl.w && s.px + 30 > pl.x && bot > pl.y && bot - s.vy <= pl.y + 10 && s.vy >= 0) { s.py = pl.y - 40; s.vy = 0; s.onfloor = true; }
          }
          s.px = clamp(s.px, 0, W - 30);
        };
        s.draw = function (g) {
          g.fill(v.col_bg, 0, 0, W, H);
          for (var i = 0; i < plats.length; i++) g.fill(v.col_d, plats[i].x, plats[i].y, plats[i].w, plats[i].h);
          g.fill(v.col_c, s.goal.x, s.goal.y, s.goal.w, s.goal.h);
          g.fill(v.col_a, s.px, s.py, 30, 40);
          if (s.px + 30 > s.goal.x && s.px < s.goal.x + s.goal.w && s.py + 40 > s.goal.y && s.py < s.goal.y + s.goal.h) g.text('You win!', '#ffffff', W / 2 - 40, 16);
        };
        s.reset(); return s;
      }
    }
  };

  /* ============================ Project + readme ============================ */
  function sanitiseTitle(t) { return String(t || 'my-game').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 30) || 'my-game'; }
  function buildReadme(id, values, title) {
    var g = GAMES[id]; if (!g) return '';
    return [
      'Python Studio project',
      '=====================',
      '',
      'Game: ' + g.name,
      'Made in the free JVDesignStudio Python Studio:',
      'https://jvdesignstudio.co.uk/workshops/python-studio.html',
      '',
      'How to run it',
      '-------------',
      '1. Install Python 3 from python.org (free).',
      '2. In a terminal, install Pygame:  pip install pygame',
      '3. Run the game:  python main.py',
      '',
      'Pygame is a free, open source library, so this project works on a home',
      'computer with no paid software. On a locked-down school computer you can',
      'build the game here in the browser, then run the project at home.',
      '',
      'main.py is a normal Pygame program: a while loop, an event loop, and',
      'drawing with pygame.draw. Change a number near the top and run it again',
      'to see what it does. Have fun!'
    ].join('\n');
  }
  function projectFiles(id, values, title) {
    var g = GAMES[id]; if (!g) return [];
    var name = sanitiseTitle(title);
    return [
      { name: 'main.py', text: g.python(name, values) },
      { name: 'README.md', text: buildReadme(id, values, name) },
      { name: 'requirements.txt', text: 'pygame\n' }
    ];
  }

  /* ============================ ZIP (no libraries) ============================ */
  var CRC = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(v) { return [v & 255, (v >> 8) & 255]; }
  function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
  function makeZip(files) {
    var enc = new TextEncoder(), chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nb = enc.encode(f.name), data = f.data, crc = crc32(data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0));
      var h = new Uint8Array(local.length + nb.length); h.set(local, 0); h.set(nb, local.length);
      chunks.push(h, data);
      var cd = new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)).concat(Array.prototype.slice.call(nb)));
      central.push(cd); offset += h.length + data.length;
    });
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var total = chunks.reduce(function (s, c) { return s + c.length; }, 0) + cdSize + eocd.length;
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    central.forEach(function (c) { out.set(c, p); p += c.length; });
    out.set(eocd, p); return out;
  }

  function defaultsFor(id) { var o = {}, g = GAMES[id]; g.fields.forEach(function (f) { o[f.k] = f.def; }); if (id === 'catch' || id === 'dodge' || id === 'breakout' || id === 'platformer') { if (o.startX === undefined) o.startX = 0.5; } return o; }
  function startXPx(v, w) { var f = (v && typeof v.startX === 'number') ? v.startX : 0.5; if (!(f >= 0) || !(f <= 1)) f = 0.5; return Math.round(f * w); }

  /* ============================ Node export ============================ */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAMES: GAMES, projectFiles: projectFiles, buildReadme: buildReadme, defaultsFor: defaultsFor, makeZip: makeZip, crc32: crc32, sanitiseTitle: sanitiseTitle, hexToTuple: hexToTuple, W: W, H: H };
    return;
  }

  /* ============================ Browser ============================ */
  function $(id) { return document.getElementById(id); }
  var state = { game: 'catch', values: null };

  function ctxPy(c) {
    return {
      fill: function (col, x, y, w, h) { c.fillStyle = col; c.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0)); },
      circle: function (col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); },
      text: function (s, col, x, y) { c.fillStyle = col; c.font = '600 22px Inter, system-ui, sans-serif'; c.textBaseline = 'top'; c.fillText(String(s), x | 0, y | 0); }
    };
  }

  function readField(f) {
    var el = $('pyf_' + f.k); if (!el) return state.values[f.k];
    return f.type === 'number' ? Number(el.value) : el.value;
  }
  function renderInspector() {
    var g = GAMES[state.game], box = $('pyInspector'); if (!box) return;
    box.innerHTML = g.fields.map(function (f) {
      if (f.type === 'number') return '<div class="py-field"><label for="pyf_' + f.k + '">' + f.label + '</label><input type="range" id="pyf_' + f.k + '" min="' + f.min + '" max="' + f.max + '" step="' + (f.min < 1 ? 0.1 : 1) + '" value="' + state.values[f.k] + '"><span class="py-val" id="pyv_' + f.k + '">' + state.values[f.k] + '</span></div>';
      return '<div class="py-field"><label for="pyf_' + f.k + '">' + f.label + '</label><input type="color" id="pyf_' + f.k + '" value="' + state.values[f.k] + '"><span class="py-val">' + state.values[f.k] + '</span></div>';
    }).join('');
    g.fields.forEach(function (f) {
      var el = $('pyf_' + f.k); if (!el) return;
      el.addEventListener('input', function () {
        state.values[f.k] = readField(f);
        var v = $('pyv_' + f.k); if (v) v.textContent = state.values[f.k];
        buildSim(); refreshCode();
      });
    });
  }

  var sim = null, raf = null, last = 0, acc = 0, cur = {}, prev = {};
  var STEP = 1 / 60;
  function buildSim() { sim = GAMES[state.game].make(state.values); acc = 0; }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!last) last = t;
    var dt = Math.min(0.1, (t - last) / 1000); last = t;
    acc += dt;
    var pressed = {};
    ['left', 'right', 'up', 'down', 'action'].forEach(function (k) { pressed[k] = cur[k] && !prev[k]; });
    while (acc >= STEP) {
      if (sim) sim.update(cur, pressed);
      ['left', 'right', 'up', 'down', 'action'].forEach(function (k) { prev[k] = cur[k]; pressed[k] = false; });
      acc -= STEP;
    }
    var cv = $('pyPlay'); if (cv && sim) { var c = cv.getContext('2d'); c.imageSmoothingEnabled = false; sim.draw(ctxPy(c)); }
  }
  function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  function refreshCode() {
    var code = $('pyCode'); if (!code) return;
    code.textContent = GAMES[state.game].python(sanitiseTitle(($('pyTitle') && $('pyTitle').value) || 'my-game'), state.values);
  }

  function keyMap(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      case 'ArrowUp': case 'w': case 'W': return 'up';
      case 'ArrowDown': case 's': case 'S': return 'down';
      case ' ': case 'z': case 'Z': return 'action';
      default: return null;
    }
  }
  function bindHold(id, key) {
    var el = $(id); if (!el) return;
    ['pointerdown', 'touchstart'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); cur[key] = true; }); });
    ['pointerup', 'pointerleave', 'pointercancel', 'touchend'].forEach(function (ev) { el.addEventListener(ev, function () { cur[key] = false; }); });
  }

  function switchGame(id) {
    if (!GAMES[id]) id = 'catch';
    state.game = id; state.values = defaultsFor(id);
    document.querySelectorAll('.py-game-btn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-game') === id); });
    var blurb = $('pyBlurb'); if (blurb) blurb.textContent = GAMES[id].blurb;
    var ctl = $('pyControls'); if (ctl) ctl.textContent = GAMES[id].controls;
    renderInspector(); buildSim(); var hud = $('pyHud'); if (hud) hud.textContent = GAMES[id].emoji + ' ' + GAMES[id].name; refreshCode();
  }

  function switchGame(id) {
    if (!GAMES[id]) id = 'catch';
    state.game = id; state.values = defaultsFor(id);
    document.querySelectorAll('.py-game-btn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-game') === id); });
    var blurb = $('pyBlurb'); if (blurb) blurb.textContent = GAMES[id].blurb;
    var ctl = $('pyControls'); if (ctl) ctl.textContent = GAMES[id].controls;
    renderInspector(); buildSim(); var hud = $('pyHud'); if (hud) hud.textContent = GAMES[id].emoji + ' ' + GAMES[id].name; refreshCode();
    drawWorld(); syncCodeBox();
  }

  /* ---------- drag and drop world strip + live code ---------- */
  function worldSupported() { return state.game === 'catch' || state.game === 'dodge' || state.game === 'breakout' || state.game === 'platformer'; }
  function drawWorld() {
    var cv = $('pyWorld'); if (!cv) return;
    var c = cv.getContext('2d'), sx = (typeof state.values.startX === 'number') ? state.values.startX : 0.5;
    c.fillStyle = '#0d1117'; c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.moveTo(0, 90); c.lineTo(cv.width, 90); c.stroke();
    var bx = Math.round(sx * (cv.width - 60)) + 30;
    c.fillStyle = '#ffd166'; c.beginPath(); c.arc((bx + 120) % cv.width, 40, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = state.values.col_a || '#06d6a0'; c.fillRect(bx - 24, 66, 48, 20);
    c.fillStyle = '#fff'; c.font = '12px Inter, sans-serif'; c.textAlign = 'center';
    c.fillText('drag me', bx, 58);
    var msg = $('pyWorldMsg');
    if (msg) msg.textContent = worldSupported() ? ('Player starts ' + Math.round(sx * 100) + '% across. Drag it and press Play.') : 'This game uses a fixed arena. The code box below still works.';
  }
  function setStartX(fx) {
    if (!(fx >= 0) || !(fx <= 1)) return;
    state.values.startX = Math.round(fx * 100) / 100;
    buildSim(); refreshCode(); drawWorld(); syncCodeBox();
  }
  function initWorld() {
    var cv = $('pyWorld'); if (!cv || !window.JVDSLiveEdit) return;
    var pal = $('pyWorldPalette');
    if (pal) window.JVDSLiveEdit.armPalette(pal, function () { drawWorld(); });
    var dragging = false;
    function fxFromEvent(e) {
      var r = cv.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width);
    }
    cv.addEventListener('pointerdown', function (e) { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} setStartX(fxFromEvent(e)); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (dragging) setStartX(fxFromEvent(e)); });
    ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { dragging = false; }); });
    cv.addEventListener('dragover', function (e) { e.preventDefault(); });
    cv.addEventListener('drop', function (e) { e.preventDefault(); setStartX(fxFromEvent(e)); });
    cv.addEventListener('keydown', function (e) {
      var sx = (typeof state.values.startX === 'number') ? state.values.startX : 0.5, used = true;
      if (e.key === 'ArrowLeft') sx -= 0.05;
      else if (e.key === 'ArrowRight') sx += 0.05;
      else if (e.key === 'Home') sx = 0;
      else if (e.key === 'End') sx = 1;
      else used = false;
      if (used) { e.preventDefault(); setStartX(Math.min(1, Math.max(0, sx))); }
    });
    drawWorld();
  }
  function currentCode() {
    var t = ($('pyTitle') && $('pyTitle').value) || 'my-game';
    return GAMES[state.game].python(sanitiseTitle(t), state.values);
  }
  function syncCodeBox() { var ta = $('pyCodeEdit'); if (ta) ta.value = currentCode(); }
  function initCode() {
    if (!window.JVDSLiveEdit || !$('pyCodeEdit')) return;
    syncCodeBox();
    window.JVDSLiveEdit.bindCodeEditor({
      textareaId: 'pyCodeEdit', applyId: 'pyCodeApply', resetId: 'pyCodeReset', statusId: 'pyCodeMsg',
      getCode: currentCode,
      getFieldMeta: function () {
        return GAMES[state.game].fields.map(function (f) {
          return { key: f.k, min: (f.type === 'number') ? f.min : undefined, max: (f.type === 'number') ? f.max : undefined };
        }).concat([{ key: 'startx', min: 0, max: 1 }, { key: 'start_x', min: 0, max: 1 }]);
      },
      getValues: function () { return state.values; },
      setValue: function (k, v) {
        if (k === 'startx' || k === 'start_x' || k === 'startX') { state.values.startX = Math.min(1, Math.max(0, v > 1 ? v / 100 : v)); return; }
        var f = null;
        GAMES[state.game].fields.forEach(function (x) { if (x.k === k) f = x; });
        if (f && f.type === 'number') state.values[k] = v;
      },
      resetValues: function () { state.values = defaultsFor(state.game); renderInspector(); buildSim(); drawWorld(); },
      refresh: function () { renderInspector(); buildSim(); refreshCode(); drawWorld(); }
    });
  }
  function boot() {
    state.values = defaultsFor(state.game);
    switchGame(state.game);
    try { var want = new URLSearchParams(location.search).get('game'); if (want && GAMES[want]) switchGame(want); } catch (e) {}

    document.querySelectorAll('.py-game-btn').forEach(function (b) { b.addEventListener('click', function () { switchGame(b.getAttribute('data-game')); }); });
    document.querySelectorAll('.py-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        var tab = b.getAttribute('data-tab');
        document.querySelectorAll('.py-tab').forEach(function (x) { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        document.querySelectorAll('.py-panel').forEach(function (p) { p.classList.toggle('is-active', p.id === 'panel-' + tab); });
        if (tab === 'export') refreshCode();
        if (tab === 'play') startLoop();
      });
    });

    var def = $('pyDefaults'); if (def) def.addEventListener('click', function () { state.values = defaultsFor(state.game); renderInspector(); buildSim(); refreshCode(); });
    var op = $('pyOpenPlay'); if (op) op.addEventListener('click', function () { var b = document.querySelector('.py-tab[data-tab="play"]'); if (b) b.click(); });
    var rs = $('pyReset'); if (rs) rs.addEventListener('click', function () { buildSim(); });
    bindHold('pyLeft', 'left'); bindHold('pyRight', 'right'); bindHold('pyUp', 'up'); bindHold('pyDown', 'down'); bindHold('pyAction', 'action');
    var tt = $('pyTitle'); if (tt) tt.addEventListener('input', refreshCode);
    document.addEventListener('keydown', function (e) { var k = keyMap(e); if (k) { cur[k] = true; if (e.key === ' ') e.preventDefault(); } });
    document.addEventListener('keyup', function (e) { var k = keyMap(e); if (k) cur[k] = false; });

    var dl = $('pyDownload'), cp = $('pyCopy'), msg = $('pyMsg');
    function flash(cls, text) { if (msg) { msg.className = 'py-msg ' + cls; msg.textContent = text; } }
    function title() { return sanitiseTitle(($('pyTitle') && $('pyTitle').value) || 'my-game'); }
    if (dl) dl.addEventListener('click', function () {
      try {
        var enc = new TextEncoder(), arr = projectFiles(state.game, state.values, title()).map(function (f) { return { name: f.name, data: enc.encode(f.text) }; });
        var zip = makeZip(arr), blob = new Blob([zip], { type: 'application/zip' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = title() + '.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        try { var c = parseInt(localStorage.getItem('jvds_tool_export_python-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_python-studio', String(c)); } catch (e) {}
        flash('ok', 'Downloaded ' + title() + '.zip. Install Python and Pygame, then run python main.py.');
      } catch (e) { flash('bad', 'Something went wrong building the project. Try again.'); }
    });
    if (cp) cp.addEventListener('click', function () {
      var text = GAMES[state.game].python(title(), state.values);
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { flash('ok', 'Python code copied.'); }, function () { flash('bad', 'Could not copy. Select the code and copy it.'); });
      else flash('ok', 'Select the code above and copy it.');
    });

    startLoop();
    initWorld(); initCode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
