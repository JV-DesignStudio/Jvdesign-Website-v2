/* ============================================================================
   Unity Studio, multi-game edition.
   One browser app that builds seven small games the Unity way (GameObjects +
   Components), plays each live, and exports real compilable Unity C# plus a
   scene builder so the same game runs in the real engine.
   Loaded by workshops/unity-studio.html. No external libraries.
   ============================================================================ */
(function () {
  'use strict';

  var COLS = 40, ROWS = 16, CELL = 24;
  var SAVE_KEY = 'jvds-unity-studio-v2';

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function num(id, d) { var e = $(id); var v = e ? parseFloat(e.value) : d; return isNaN(v) ? d : v; }
  function bool(id) { var e = $(id); return e ? e.checked : true; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ==========================================================================
     GAMES
     Each game defines: label, emoji, blurb, paint (grid editor?), palette,
     fields (inspector), preview(ctx) for the setup tab, build() -> sim,
     sim(s,dt), draw(ctx,s), controls (hint text), files() -> {name:cs}.
     ========================================================================== */
  var GAMES = {};

  /* ---------- shared tile collision for grid games ---------- */
  function gridSolid(t) { return t === 1 || t === 2; }

  /* =======================================================================
     1. 2D PLATFORMER
     ======================================================================= */
  GAMES.platformer = {
    label: '2D Platformer', emoji: '🏃',
    blurb: 'A side-on platformer: run, jump, collect coins, avoid the enemy and reach the goal.',
    paint: true,
    palette: [
      { t: 1, label: 'Ground', color: '#4b5563' }, { t: 2, label: 'Platform', color: '#8b5e34' },
      { t: 3, label: 'Coin', color: '#f5c518' }, { t: 4, label: 'Enemy', color: '#ef4444' },
      { t: 5, label: 'Goal', color: '#22c55e' }, { t: 6, label: 'Player', color: '#5bc0f8' },
      { t: 0, label: 'Erase', color: '#94a3b8' }
    ],
    fields: [
      { id: 'moveSpeed', label: 'Move speed', value: 5, min: 1, max: 12, step: 1 },
      { id: 'jumpForce', label: 'Jump force', value: 9, min: 4, max: 16, step: 1 },
      { id: 'gravityScale', label: 'Gravity scale', value: 3, min: 0, max: 8, step: 1 },
      { id: 'health', label: 'Starting health', value: 3, min: 1, max: 9, step: 1 },
      { id: 'coinPoints', label: 'Coin points', value: 1, min: 1, max: 10, step: 1 },
      { id: 'enemySpeed', label: 'Enemy speed', value: 2, min: 1, max: 6, step: 1 },
      { id: 'enemyDamage', label: 'Enemy damage', value: 1, min: 1, max: 3, step: 1 }
    ],
    controls: 'Arrow keys or A and D to move, Space or W to jump.',
    sample: function () {
      var g = new Array(COLS * ROWS).fill(0), c, ix = function (c, r) { return r * COLS + c; };
      for (c = 0; c < COLS; c++) { g[ix(c, ROWS - 1)] = 1; g[ix(c, ROWS - 2)] = 1; }
      for (c = 18; c <= 21; c++) { g[ix(c, ROWS - 1)] = 0; g[ix(c, ROWS - 2)] = 0; }
      [6, 12, 26, 32].forEach(function (pc, i) { var pr = ROWS - 5 - (i % 3); g[ix(pc, pr)] = 2; g[ix(pc + 1, pr)] = 2; });
      [[5, ROWS - 4], [9, ROWS - 7], [13, ROWS - 4], [20, ROWS - 5], [27, ROWS - 8], [33, ROWS - 5]].forEach(function (p) { g[ix(p[0], p[1])] = 3; });
      g[ix(4, ROWS - 2)] = 6; g[ix(15, ROWS - 2)] = 4; g[ix(37, ROWS - 3)] = 5;
      return g;
    },
    build: function (v, grid) {
      var p = findTile(grid, 6) || { c: 2, r: ROWS - 2 };
      var s = { v: v, grid: grid, t: 0,
        player: { x: p.c * CELL + CELL * .15, y: p.r * CELL, w: CELL * .7, h: CELL * .9, vx: 0, vy: 0, onGround: false, health: v.health, hurtAt: -99 },
        coins: [], enemies: [], score: 0, won: false, over: false };
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var t = grid[r * COLS + c];
        if (t === 3) s.coins.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, got: false });
        if (t === 4) s.enemies.push({ x: c * CELL, y: r * CELL, w: CELL * .8, h: CELL * .8, dir: 1, homeX: c * CELL, range: CELL * 2 });
      }
      return s;
    },
    sim: function (s, dt, input) {
      if (s.won || s.over) return;
      var v = s.v, p = s.player;
      var gravity = v.gravityScale * 620, speed = v.moveSpeed * 55, jumpV = v.jumpForce * 72;
      p.vx = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * speed;
      if (input.jump && p.onGround) { p.vy = -jumpV; p.onGround = false; }
      input.jump = false;
      p.vy = Math.min(900, p.vy + gravity * dt);
      var nx = p.x + p.vx * dt;
      if (!collide(s.grid, nx, p.y, p.w, p.h)) p.x = nx;
      var ny = p.y + p.vy * dt;
      p.onGround = false;
      if (!collide(s.grid, p.x, ny, p.w, p.h)) p.y = ny;
      else { if (p.vy > 0) { while (!collide(s.grid, p.x, p.y + 1, p.w, p.h) && p.y < ROWS * CELL) p.y += 1; p.onGround = true; } p.vy = 0; }
      if (p.y > ROWS * CELL + 120) { var st = findTile(s.grid, 6) || { c: 2, r: ROWS - 2 }; p.x = st.c * CELL + CELL * .15; p.y = st.r * CELL; p.vy = 0; }
      s.coins.forEach(function (co) { if (!co.got && p.x < co.x + CELL * .3 && p.x + p.w > co.x - CELL * .3 && p.y < co.y + CELL * .3 && p.y + p.h > co.y - CELL * .3) { co.got = true; s.score += v.coinPoints; } });
      s.enemies.forEach(function (en) {
        en.x += en.dir * (v.enemySpeed * 45) * dt;
        if (en.x > en.homeX + en.range) en.dir = -1; if (en.x < en.homeX - en.range) en.dir = 1;
        if (p.x < en.x + en.w && p.x + p.w > en.x && p.y < en.y + en.h && p.y + p.h > en.y && s.t - p.hurtAt > 1 && s.t > .3) { p.hurtAt = s.t; p.health -= v.enemyDamage; if (p.health <= 0) s.over = true; }
      });
      var gl = findTile(s.grid, 5);
      if (gl) { var gx = gl.c * CELL, gy = gl.r * CELL; if (p.x < gx + CELL && p.x + p.w > gx && p.y < gy + CELL && p.y + p.h > gy) s.won = true; }
      s.t += dt;
    },
    draw: function (ctx, s) {
      drawGridWorld(ctx, s.grid);
      s.coins.forEach(function (co) { if (co.got) return; ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(co.x, co.y, CELL * .24, 0, 6.283); ctx.fill(); });
      s.enemies.forEach(function (en) { ctx.fillStyle = '#ef4444'; ctx.fillRect(en.x, en.y, en.w, en.h); ctx.fillStyle = '#fff'; ctx.fillRect(en.x + en.w * .22, en.y + en.h * .28, 3, 3); ctx.fillRect(en.x + en.w * .62, en.y + en.h * .28, 3, 3); });
      var p = s.player; ctx.fillStyle = (s.t - p.hurtAt < .3) ? '#fca5a5' : '#5bc0f8'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#04121c'; ctx.fillRect(p.x + p.w * .2, p.y + p.h * .25, 3, 3); ctx.fillRect(p.x + p.w * .62, p.y + p.h * .25, 3, 3);
    },
    hud: function (s) { return [{ t: '🪙 Score: ' + s.score }, { t: '❤️ Health: ' + Math.max(0, s.player.health) }, { t: s.won ? '🎉 You win!' : (s.over ? '💥 Game over, press reset' : '') }]; },
    files: function (v, grid) { return filesPlatformer(v, grid); }
  };

  /* =======================================================================
     2. PONG
     ======================================================================= */
  GAMES.pong = {
    label: 'Pong', emoji: '🏓',
    blurb: 'The classic two-paddle game. Left paddle uses W and S, right paddle uses Up and Down, or switch on the computer opponent.',
    paint: false,
    fields: [
      { id: 'ballSpeed', label: 'Ball speed', value: 5, min: 2, max: 12, step: 1 },
      { id: 'paddleSpeed', label: 'Paddle speed', value: 6, min: 2, max: 14, step: 1 },
      { id: 'paddleHeight', label: 'Paddle height', value: 4, min: 2, max: 8, step: 1, unit: 'x' },
      { id: 'winsToWin', label: 'Points to win', value: 5, min: 1, max: 11, step: 1 },
      { id: 'ai', label: 'Computer controls the right paddle', type: 'check', value: true }
    ],
    controls: 'Left paddle: W and S. Right paddle: Up and Down. First to the target score wins.',
    preview: function (ctx) { ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 960, 384); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(480, 0); ctx.lineTo(480, 384); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#5bc0f8'; ctx.fillRect(30, 140, 12, 100); ctx.fillRect(918, 140, 12, 100); ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(480, 192, 8, 0, 6.283); ctx.fill(); },
    build: function (v) {
      var ph = v.paddleHeight * 18;
      return { v: v, t: 0, over: false, left: { y: 192 - ph / 2, h: ph, score: 0 }, right: { y: 192 - ph / 2, h: ph, score: 0 },
        ball: { x: 480, y: 192, r: 8, vx: (Math.random() < .5 ? -1 : 1) * v.ballSpeed * 42, vy: (Math.random() * 2 - 1) * v.ballSpeed * 30 } };
    },
    sim: function (s, dt, input) {
      if (s.over) return;
      var v = s.v, ps = v.paddleSpeed * 60;
      if (input.up) s.left.y -= ps * dt; if (input.down) s.left.y += ps * dt;
      if (input.jump) s.right.y -= ps * dt; if (input.fireL) s.right.y += ps * dt; // arrow controls mapped below
      if (v.ai) { var target = s.ball.y - s.right.h / 2; s.right.y += clamp(target - s.right.y, -ps * dt, ps * dt); }
      s.left.y = clamp(s.left.y, 0, 384 - s.left.h); s.right.y = clamp(s.right.y, 0, 384 - s.right.h);
      var b = s.ball; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < b.r || b.y > 384 - b.r) { b.vy = -b.vy; b.y = clamp(b.y, b.r, 384 - b.r); }
      if (b.x < 42 + b.r && b.x > 30 && b.y > s.left.y && b.y < s.left.y + s.left.h && b.vx < 0) { b.vx = Math.abs(b.vx) * 1.03; b.vy += (b.y - (s.left.y + s.left.h / 2)) * 3; }
      if (b.x > 918 - b.r && b.x < 930 && b.y > s.right.y && b.y < s.right.y + s.right.h && b.vx > 0) { b.vx = -Math.abs(b.vx) * 1.03; b.vy += (b.y - (s.right.y + s.right.h / 2)) * 3; }
      if (b.x < 0) { s.right.score++; resetBall(s); }
      if (b.x > 960) { s.left.score++; resetBall(s); }
      s.t += dt;
      if (s.left.score >= v.winsToWin || s.right.score >= v.winsToWin) s.over = true;
    },
    draw: function (ctx, s) {
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 960, 384);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(480, 0); ctx.lineTo(480, 384); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#5bc0f8'; ctx.fillRect(30, s.left.y, 12, s.left.h);
      ctx.fillStyle = '#f87171'; ctx.fillRect(918, s.right.y, 12, s.right.h);
      ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#e8eaf2'; ctx.font = 'bold 30px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s.left.score, 400, 46); ctx.fillText(s.right.score, 560, 46);
    },
    hud: function (s) { return [{ t: '🔵 ' + s.left.score + '  :  ' + s.right.score + ' 🔴' }, { t: s.over ? ((s.left.score > s.right.score ? '🏆 Left wins!' : '🏆 Right wins!') + ' press reset') : '' }]; },
    files: function (v) { return filesPong(v); }
  };

  /* =======================================================================
     3. BREAKOUT
     ======================================================================= */
  GAMES.breakout = {
    label: 'Breakout', emoji: '🧱',
    blurb: 'Bounce the ball off your paddle to smash every brick. Do not drop the ball.',
    paint: false,
    fields: [
      { id: 'ballSpeed', label: 'Ball speed', value: 5, min: 2, max: 12, step: 1 },
      { id: 'paddleSpeed', label: 'Paddle speed', value: 7, min: 2, max: 16, step: 1 },
      { id: 'brickRows', label: 'Brick rows', value: 5, min: 2, max: 8, step: 1 },
      { id: 'brickPoints', label: 'Points per brick', value: 10, min: 1, max: 50, step: 1 },
      { id: 'lives', label: 'Lives', value: 3, min: 1, max: 5, step: 1 }
    ],
    controls: 'Move the paddle with the Left and Right arrows. Keep the ball in play.',
    preview: function (ctx) { ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 960, 384); for (var r = 0; r < 4; r++) for (var c = 0; c < 10; c++) { ctx.fillStyle = ['#ef4444', '#f59e0b', '#22c55e', '#5bc0f8'][r]; ctx.fillRect(60 + c * 84, 40 + r * 26, 76, 18); } ctx.fillStyle = '#5bc0f8'; ctx.fillRect(410, 350, 140, 12); ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(480, 330, 8, 0, 6.283); ctx.fill(); },
    build: function (v) {
      var bricks = [];
      for (var r = 0; r < v.brickRows; r++) for (var c = 0; c < 10; c++) bricks.push({ x: 60 + c * 84, y: 40 + r * 30, w: 76, h: 20, alive: true });
      var s = { v: v, t: 0, over: false, won: false, score: 0, lives: v.lives, bricks: bricks,
        paddle: { x: 410, w: 140, h: 12 }, ball: { x: 480, y: 330, r: 8, vx: v.ballSpeed * 40, vy: -v.ballSpeed * 44 }, stuck: true };
      return s;
    },
    sim: function (s, dt, input) {
      if (s.over || s.won) return;
      var v = s.v, ps = v.paddleSpeed * 55;
      if (input.left) s.paddle.x -= ps * dt; if (input.right) s.paddle.x += ps * dt;
      s.paddle.x = clamp(s.paddle.x, 0, 960 - s.paddle.w);
      var b = s.ball;
      if (s.stuck) { b.x = s.paddle.x + s.paddle.w / 2; b.y = 330; if (input.jump) { s.stuck = false; input.jump = false; } s.t += dt; return; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < b.r || b.x > 960 - b.r) { b.vx = -b.vx; b.x = clamp(b.x, b.r, 960 - b.r); }
      if (b.y < b.r) { b.vy = -b.vy; b.y = b.r; }
      if (b.y > 348 && b.y < 366 && b.x > s.paddle.x && b.x < s.paddle.x + s.paddle.w && b.vy > 0) { b.vy = -Math.abs(b.vy); b.vx += (b.x - (s.paddle.x + s.paddle.w / 2)) * 4; s.stuck = false; }
      for (var i = 0; i < s.bricks.length; i++) { var k = s.bricks[i]; if (!k.alive) continue; if (b.x > k.x - b.r && b.x < k.x + k.w + b.r && b.y > k.y - b.r && b.y < k.y + k.h + b.r) { k.alive = false; s.score += v.brickPoints; b.vy = -b.vy; break; } }
      if (b.y > 400) { s.lives--; if (s.lives <= 0) s.over = true; else { s.stuck = true; b.x = s.paddle.x + s.paddle.w / 2; b.y = 330; b.vx = v.ballSpeed * 40; b.vy = -v.ballSpeed * 44; } }
      if (!s.bricks.some(function (k) { return k.alive; })) s.won = true;
      s.t += dt;
    },
    draw: function (ctx, s) {
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 960, 384);
      var colors = ['#ef4444', '#f59e0b', '#22c55e', '#5bc0f8', '#a78bfa', '#ec4899'];
      s.bricks.forEach(function (k, i) { if (!k.alive) return; ctx.fillStyle = colors[(Math.floor(i / 10)) % colors.length]; ctx.fillRect(k.x, k.y, k.w, k.h); });
      ctx.fillStyle = '#5bc0f8'; ctx.fillRect(s.paddle.x, 350, s.paddle.w, s.paddle.h);
      ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, 6.283); ctx.fill();
    },
    hud: function (s) { return [{ t: '🪙 Score: ' + s.score }, { t: '❤️ Lives: ' + s.lives }, { t: s.won ? '🎉 All bricks cleared!' : (s.over ? '💥 Game over, press reset' : (s.stuck ? 'Press Space to launch' : '')) }]; },
    files: function (v) { return filesBreakout(v); }
  };

  /* =======================================================================
     4. TOP-DOWN SHOOTER  (grid arena)
     ======================================================================= */
  GAMES.shooter = {
    label: 'Top-Down Shooter', emoji: '🔫',
    blurb: 'Move with WASD in a walled arena and your character fires at the nearest enemy automatically. Clear the room without running out of health.',
    paint: true,
    palette: [
      { t: 1, label: 'Wall', color: '#4b5563' }, { t: 4, label: 'Enemy', color: '#ef4444' },
      { t: 6, label: 'Player', color: '#5bc0f8' }, { t: 0, label: 'Erase', color: '#94a3b8' }
    ],
    fields: [
      { id: 'moveSpeed', label: 'Move speed', value: 5, min: 2, max: 12, step: 1 },
      { id: 'fireRate', label: 'Shots per second', value: 3, min: 1, max: 10, step: 1 },
      { id: 'bulletSpeed', label: 'Bullet speed', value: 9, min: 3, max: 18, step: 1 },
      { id: 'enemySpeed', label: 'Enemy speed', value: 3, min: 1, max: 8, step: 1 },
      { id: 'enemyHealth', label: 'Enemy health', value: 2, min: 1, max: 6, step: 1 },
      { id: 'playerHealth', label: 'Player health', value: 5, min: 1, max: 10, step: 1 }
    ],
    controls: 'WASD or arrow keys to move. Your gun fires at the nearest enemy on its own.',
    sample: function () { return sampleArena(6); },
    build: function (v, grid) {
      var p = findTile(grid, 6) || { c: 2, r: 2 };
      var s = { v: v, grid: grid, t: 0, over: false, won: false, score: 0, fireAt: 0,
        player: { x: p.c * CELL + CELL / 2, y: p.r * CELL + CELL / 2, r: CELL * .34, health: v.playerHealth, hurtAt: -99 }, bullets: [], enemies: [] };
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r * COLS + c] === 4) s.enemies.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, r: CELL * .36, health: v.enemyHealth, hurtAt: -9 });
      return s;
    },
    sim: function (s, dt, input) {
      if (s.over || s.won) return;
      var v = s.v, p = s.player, sp = v.moveSpeed * 52;
      var dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      var len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      var nx = p.x + dx * sp * dt, ny = p.y + dy * sp * dt;
      if (!solidPoint(s.grid, nx, p.y, p.r)) p.x = nx;
      if (!solidPoint(s.grid, p.x, ny, p.r)) p.y = ny;
      s.fireAt -= dt;
      if (s.enemies.length && s.fireAt <= 0) { s.fireAt = 1 / v.fireRate; var near = nearest(s.enemies, p); var a = Math.atan2(near.y - p.y, near.x - p.x); s.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * v.bulletSpeed * 60, vy: Math.sin(a) * v.bulletSpeed * 60, life: 1.4 }); }
      s.bullets.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; });
      s.bullets = s.bullets.filter(function (b) { return b.life > 0 && b.x > 0 && b.x < 960 && b.y > 0 && b.y < 384; });
      s.enemies.forEach(function (en) {
        var a = Math.atan2(p.y - en.y, p.x - en.x); en.x += Math.cos(a) * v.enemySpeed * 45 * dt; en.y += Math.sin(a) * v.enemySpeed * 45 * dt;
        if (Math.hypot(en.x - p.x, en.y - p.y) < en.r + p.r && s.t - p.hurtAt > .8) { p.hurtAt = s.t; p.health--; if (p.health <= 0) s.over = true; }
      });
      s.bullets.forEach(function (b) { s.enemies.forEach(function (en) { if (b.life > 0 && Math.hypot(b.x - en.x, b.y - en.y) < en.r + 3) { b.life = 0; en.health--; if (en.health <= 0) { en.dead = true; s.score++; } } }); });
      s.enemies = s.enemies.filter(function (en) { return !en.dead; });
      if (!s.enemies.length) s.won = true;
      s.t += dt;
    },
    draw: function (ctx, s) {
      drawGridWorld(ctx, s.grid);
      s.enemies.forEach(function (en) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(en.x, en.y, en.r, 0, 6.283); ctx.fill(); });
      s.bullets.forEach(function (b) { ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 6.283); ctx.fill(); });
      var p = s.player; ctx.fillStyle = (s.t - p.hurtAt < .3) ? '#fca5a5' : '#5bc0f8'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    },
    hud: function (s) { return [{ t: '🎯 Kills: ' + s.score + ' / ' + (s.score + s.enemies.length) }, { t: '❤️ Health: ' + Math.max(0, s.player.health) }, { t: s.won ? '🎉 Room cleared!' : (s.over ? '💥 Game over, press reset' : '') }]; },
    files: function (v, grid) { return filesShooter(v, grid); }
  };

  /* =======================================================================
     5. ACTION RPG  (grid arena)
     ======================================================================= */
  GAMES.rpg = {
    label: 'Action RPG', emoji: '⚔️',
    blurb: 'A small action RPG: move around, swing your sword, defeat enemies for XP and level up. Your damage grows as you level.',
    paint: true,
    palette: [
      { t: 1, label: 'Wall', color: '#4b5563' }, { t: 4, label: 'Enemy', color: '#ef4444' },
      { t: 6, label: 'Player', color: '#5bc0f8' }, { t: 0, label: 'Erase', color: '#94a3b8' }
    ],
    fields: [
      { id: 'moveSpeed', label: 'Move speed', value: 5, min: 2, max: 12, step: 1 },
      { id: 'attackDamage', label: 'Attack damage', value: 2, min: 1, max: 8, step: 1 },
      { id: 'attackRate', label: 'Attacks per second', value: 2, min: 1, max: 6, step: 1 },
      { id: 'enemyHealth', label: 'Enemy health', value: 4, min: 1, max: 12, step: 1 },
      { id: 'enemyDamage', label: 'Enemy damage', value: 1, min: 1, max: 3, step: 1 },
      { id: 'levelUpXP', label: 'XP to level up', value: 3, min: 1, max: 8, step: 1 }
    ],
    controls: 'WASD or arrows to move. Space to swing your sword in the direction you face.',
    sample: function () { return sampleArena(5); },
    build: function (v, grid) {
      var p = findTile(grid, 6) || { c: 2, r: 2 };
      var s = { v: v, grid: grid, t: 0, over: false, won: false, kills: 0, xp: 0, level: 1,
        player: { x: p.c * CELL + CELL / 2, y: p.r * CELL + CELL / 2, r: CELL * .34, health: 8, dir: { x: 1, y: 0 }, attackAt: -9, hurtAt: -99 }, enemies: [], swing: null };
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (grid[r * COLS + c] === 4) s.enemies.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, r: CELL * .36, health: v.enemyHealth, hurtAt: -9 });
      return s;
    },
    sim: function (s, dt, input) {
      if (s.over || s.won) return;
      var v = s.v, p = s.player, sp = v.moveSpeed * 52;
      var dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx || dy) { var l = Math.hypot(dx, dy); dx /= l; dy /= l; p.dir = { x: dx, y: dy }; }
      var nx = p.x + dx * sp * dt, ny = p.y + dy * sp * dt;
      if (!solidPoint(s.grid, nx, p.y, p.r)) p.x = nx;
      if (!solidPoint(s.grid, p.x, ny, p.r)) p.y = ny;
      if (input.jump && s.t - p.attackAt > 1 / v.attackRate) { p.attackAt = s.t; s.swing = { x: p.x + p.dir.x * CELL, y: p.y + p.dir.y * CELL, r: CELL * .9, life: .18 }; input.jump = false; }
      if (s.swing) { s.swing.life -= dt; if (s.swing.life <= 0) s.swing = null; }
      s.enemies.forEach(function (en) {
        var a = Math.atan2(p.y - en.y, p.x - en.x); en.x += Math.cos(a) * 40 * dt; en.y += Math.sin(a) * 40 * dt;
        if (s.t - en.hurtAt > .5 && Math.hypot(en.x - p.x, en.y - p.y) < en.r + p.r) { en.hurtAt = s.t; p.health -= v.enemyDamage; if (p.health <= 0) s.over = true; }
      });
      if (s.swing) s.enemies.forEach(function (en) { if (Math.hypot(en.x - s.swing.x, en.y - s.swing.y) < en.r + s.swing.r && s.t - en.hurtAt > .3) { en.hurtAt = s.t; en.health -= v.attackDamage + (s.level - 1); if (en.health <= 0) { en.dead = true; s.kills++; s.xp++; if (s.xp >= v.levelUpXP) { s.xp = 0; s.level++; } } } });
      s.enemies = s.enemies.filter(function (en) { return !en.dead; });
      if (!s.enemies.length) s.won = true;
      s.t += dt;
    },
    draw: function (ctx, s) {
      drawGridWorld(ctx, s.grid, true);
      s.enemies.forEach(function (en) { ctx.fillStyle = en.hurtAt && (s.t - en.hurtAt < .15) ? '#fff' : '#ef4444'; ctx.beginPath(); ctx.arc(en.x, en.y, en.r, 0, 6.283); ctx.fill(); });
      if (s.swing) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.swing.x, s.swing.y, s.swing.r, 0, 6.283); ctx.stroke(); }
      var p = s.player; ctx.fillStyle = (s.t - p.hurtAt < .25) ? '#fca5a5' : '#5bc0f8'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#e8eaf2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.dir.x * p.r * 1.7, p.y + p.dir.y * p.r * 1.7); ctx.stroke();
    },
    hud: function (s) { return [{ t: '⚔️ Level ' + s.level }, { t: '✨ XP ' + s.xp + '/' + s.v.levelUpXP }, { t: '❤️ Health: ' + Math.max(0, s.player.health) }, { t: s.won ? '🎉 Area cleared!' : (s.over ? '💥 Game over, press reset' : '') }]; },
    files: function (v, grid) { return filesRpg(v, grid); }
  };

  /* =======================================================================
     6. UI & MENUS  (lighter: mock menu + real menu scripts)
     ======================================================================= */
  GAMES.ui = {
    label: 'UI & Menus', emoji: '🖥️',
    blurb: 'Build a game menu system: a main menu, a pause menu and a HUD. The preview is a live mock of the menus, and the export is the real Unity UI scripts.',
    paint: false,
    fields: [
      { id: 'title', label: 'Game title', type: 'text', value: 'My Great Game' },
      { id: 'accent', label: 'Accent colour', type: 'color', value: '#5bc0f8' },
      { id: 'showOptions', label: 'Include an Options screen', type: 'check', value: true }
    ],
    controls: 'Click the buttons in the preview. This game is about the menus, not the play area.',
    preview: function (ctx, v) { drawMenuMock(ctx, v, null); },
    build: function (v) { return { v: v, t: 0, screen: 'main' }; },
    sim: function (s, dt, input) {
      s.t += dt;
      if (input.click) { input.click = false; var b = input.clickTarget; if (b === 'play') s.screen = 'playing'; else if (b === 'options') s.screen = 'options'; else if (b === 'back') s.screen = 'main'; else if (b === 'pause') s.screen = s.screen === 'paused' ? 'playing' : 'paused'; }
      if (input.jump) { input.jump = false; if (s.screen === 'playing') s.screen = 'paused'; else if (s.screen === 'paused') s.screen = 'playing'; }
    },
    draw: function (ctx, s) { drawMenuMock(ctx, s.v, s.screen); },
    hud: function (s) { return [{ t: 'Screen: ' + s.screen }, { t: 'Press Space to pause or resume' }]; },
    files: function (v) { return filesUi(v); }
  };

  /* =======================================================================
     7. MULTIPLAYER  (lighter: two players on one screen + netcode scripts)
     ======================================================================= */
  GAMES.multiplayer = {
    label: 'Multiplayer', emoji: '🌐',
    blurb: 'Two players moving in the same world. The preview shows a host and a client sharing one scene, and the export is a starter for Unity Netcode for GameObjects.',
    paint: false,
    fields: [
      { id: 'moveSpeed', label: 'Player speed', value: 5, min: 2, max: 12, step: 1 },
      { id: 'syncRate', label: 'Sync rate (per second)', value: 20, min: 5, max: 60, step: 5 }
    ],
    controls: 'Move the blue player with WASD. The red player follows the same world to show shared state.',
    preview: function (ctx) { ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 960, 384); ctx.fillStyle = '#5bc0f8'; ctx.beginPath(); ctx.arc(300, 192, 18, 0, 6.283); ctx.fill(); ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.arc(660, 192, 18, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e8eaf2'; ctx.font = 'bold 15px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Host', 300, 240); ctx.fillText('Client', 660, 240); },
    build: function (v) { return { v: v, t: 0, host: { x: 300, y: 192 }, client: { x: 660, y: 192 }, acc: 0, packets: 0 }; },
    sim: function (s, dt, input) {
      var sp = s.v.moveSpeed * 52, h = s.host;
      var dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      var l = Math.hypot(dx, dy); if (l) { dx /= l; dy /= l; h.x = clamp(h.x + dx * sp * dt, 20, 940); h.y = clamp(h.y + dy * sp * dt, 20, 364); }
      s.acc += dt; if (s.acc >= 1 / s.v.syncRate) { s.acc = 0; s.packets++; s.client.x += clamp(h.x - s.client.x, -60, 60); s.client.y += clamp(h.y - s.client.y, -60, 60); }
      s.t += dt;
    },
    draw: function (ctx, s) {
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 960, 384);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; for (var i = 0; i < 6; i++) { ctx.strokeRect(10 + i * 158, 10, 150, 364); }
      ctx.fillStyle = 'rgba(91,192,248,.18)'; ctx.beginPath(); ctx.arc(s.host.x, s.host.y, 40, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#5bc0f8'; ctx.beginPath(); ctx.arc(s.host.x, s.host.y, 18, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.arc(s.client.x, s.client.y, 18, 0, 6.283); ctx.fill();
    },
    hud: function (s) { return [{ t: '📦 Packets sent: ' + s.packets }, { t: '🌐 Host and client in one world' }]; },
    files: function (v) { return filesMultiplayer(v); }
  };

  /* ==========================================================================
     SHARED GRID / DRAW HELPERS
     ========================================================================== */
  function findTile(grid, type) { for (var i = 0; i < grid.length; i++) if (grid[i] === type) return { c: i % COLS, r: Math.floor(i / COLS) }; return null; }
  function solidPoint(grid, x, y, r) {
    var pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    for (var i = 0; i < pts.length; i++) { var c = Math.floor(pts[i][0] / CELL), rr = Math.floor(pts[i][1] / CELL); if (c < 0 || c >= COLS || rr < 0 || rr >= ROWS) return true; if (gridSolid(grid[rr * COLS + c])) return true; }
    return false;
  }
  function collide(grid, x, y, w, h) {
    var pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
    for (var i = 0; i < pts.length; i++) { var c = Math.floor(pts[i][0] / CELL), r = Math.floor(pts[i][1] / CELL); if (c < 0 || c >= COLS) return true; if (r < 0 || r >= ROWS) continue; if (gridSolid(grid[r * COLS + c])) return true; }
    return false;
  }
  function nearest(list, p) { var best = list[0], bd = Infinity; list.forEach(function (e) { var d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y); if (d < bd) { bd = d; best = e; } }); return best; }
  function sampleArena(enemies) {
    var g = new Array(COLS * ROWS).fill(0), ix = function (c, r) { return r * COLS + c; }, c, r;
    for (c = 0; c < COLS; c++) { g[ix(c, 0)] = 1; g[ix(c, ROWS - 1)] = 1; }
    for (r = 0; r < ROWS; r++) { g[ix(0, r)] = 1; g[ix(COLS - 1, r)] = 1; }
    [[8, 5], [6, 10], [25, 12], [30, 3], [20, 8], [34, 12]].forEach(function (p) { g[ix(p[0], p[1])] = 1; });
    g[ix(20, ROWS - 3)] = 6;
    var placed = 0, spots = [[4, 3], [16, 3], [28, 4], [33, 8], [12, 8], [24, 10]];
    for (var i = 0; i < spots.length && placed < enemies; i++) { g[ix(spots[i][0], spots[i][1])] = 4; placed++; }
    return g;
  }
  function drawGridWorld(ctx, grid, rpgFloor) {
    ctx.fillStyle = rpgFloor ? '#1b2430' : '#0d1117'; ctx.fillRect(0, 0, 960, 384);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = grid[r * COLS + c];
      if (t === 1) { ctx.fillStyle = '#4b5563'; ctx.fillRect(c * CELL, r * CELL, CELL, CELL); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(c * CELL, r * CELL, CELL, 4); }
      else if (t === 2) { ctx.fillStyle = '#8b5e34'; ctx.fillRect(c * CELL, r * CELL, CELL, CELL); }
      else if (t === 5) { ctx.fillStyle = '#22c55e'; ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4); }
    }
  }
  function drawMenuMock(ctx, v, screen) {
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 960, 384);
    var accent = (v && v.accent) || '#5bc0f8';
    ctx.textAlign = 'center'; ctx.fillStyle = accent; ctx.font = 'bold 40px Inter, sans-serif';
    ctx.fillText((v && v.title) || 'My Great Game', 480, 110);
    var buttons = screen === 'options' ? ['Back'] : (screen === 'paused' ? ['Resume'] : (screen === 'playing' ? ['Pause'] : ['Play', v && v.showOptions ? 'Options' : 'Quit']));
    ctx.font = 'bold 20px Inter, sans-serif';
    buttons.forEach(function (b, i) {
      var w = 220, h = 44, x = 480 - w / 2, y = 170 + i * 60;
      ctx.fillStyle = 'rgba(91,192,248,.16)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#e8eaf2'; ctx.fillText(b, 480, y + 29);
    });
    if (screen === 'playing') { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '15px Inter, sans-serif'; ctx.fillText('game running...', 480, 360); }
  }

  /* ==========================================================================
     UI STATE + RENDER
     ========================================================================== */
  var state = { game: 'platformer', grid: null, values: {}, paintTile: 1, screen: 'scene' };
  var sim = null, raf = null, last = 0;
  var input = { left: false, right: false, up: false, down: false, jump: false, fireL: false, click: false, clickTarget: null };

  function loadStore() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || {}; } catch (e) { return {}; } }
  function saveStore() {
    var st = loadStore();
    st[state.game] = { grid: state.grid, values: readValues() };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function defaults(game) { var o = {}, g = GAMES[game]; g.fields.forEach(function (f) { o[f.id] = f.value; }); return o; }
  function readValues() { var o = {}, g = GAMES[state.game]; g.fields.forEach(function (f) { var e = $(f.id); if (!e) { o[f.id] = f.value; return; } o[f.id] = f.type === 'check' ? e.checked : (f.type === 'text' || f.type === 'color' ? e.value : (parseFloat(e.value) || f.value)); }); return o; }
  function currentValues() { var g = GAMES[state.game]; var o = {}; g.fields.forEach(function (f) { o[f.id] = (state.values[f.id] !== undefined) ? state.values[f.id] : f.value; }); return o; }

  function renderPalette() {
    var g = GAMES[state.game], box = $('usPalette'); if (!box) return;
    box.innerHTML = '';
    if (!g.paint) { box.innerHTML = '<span class="us-hint" style="margin:0">This game uses a fixed scene. Use Objects &amp; Components to change how it plays.</span>'; return; }
    g.palette.forEach(function (p, i) {
      var b = el('button', 'us-swatch' + (p.t === state.paintTile ? ' is-active' : ''), '<i style="background:' + p.color + '"></i>' + p.label);
      b.type = 'button'; b.addEventListener('click', function () {
        state.paintTile = p.t;
        [].forEach.call(box.querySelectorAll('.us-swatch'), function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
      });
      box.appendChild(b);
    });
  }

  function renderInspector() {
    var g = GAMES[state.game], box = $('usInspector'); if (!box) return;
    box.innerHTML = '';
    var card = el('div', 'us-card');
    card.appendChild(el('div', 'us-obj-head', '<span class="us-obj-emoji">' + g.emoji + '</span> ' + g.label + ' <span class="us-chip">Inspector</span>'));
    var body = el('div', 'us-obj-body'); body.style.display = 'block';
    g.fields.forEach(function (f) {
      var row = el('div', 'us-field');
      var lab = el('label', null, f.label); lab.setAttribute('for', f.id); row.appendChild(lab);
      var inp;
      if (f.type === 'check') { inp = el('input'); inp.type = 'checkbox'; inp.checked = !!currentValues()[f.id]; }
      else if (f.type === 'text' || f.type === 'color') { inp = el('input'); inp.type = f.type; inp.value = currentValues()[f.id]; }
      else { inp = el('input'); inp.type = 'number'; inp.value = currentValues()[f.id]; inp.min = f.min; inp.max = f.max; inp.step = f.step || 1; }
      inp.id = f.id;
      inp.addEventListener('input', function () { state.values[f.id] = f.type === 'check' ? inp.checked : (f.type === 'text' || f.type === 'color' ? inp.value : (parseFloat(inp.value) || f.value)); saveStore(); if (raf) startPlay(); if (state.screen === 'scene') renderScene(); });
      inp.addEventListener('change', function () { if (!g.paint && state.screen === 'scene') renderScene(); });
      row.appendChild(inp); body.appendChild(row);
    });
    card.appendChild(body); box.appendChild(card);
  }

  function renderScene() {
    var g = GAMES[state.game], cv = $('usScene'); if (!cv) return;
    var ctx = cv.getContext('2d');
    if (!g.paint) { if (g.preview) g.preview(ctx, currentValues()); return; }
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) drawGridTile(ctx, c, r, state.grid[r * COLS + c]);
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
    for (var cc = 0; cc <= COLS; cc++) { ctx.beginPath(); ctx.moveTo(cc * CELL + .5, 0); ctx.lineTo(cc * CELL + .5, ROWS * CELL); ctx.stroke(); }
    for (var rr = 0; rr <= ROWS; rr++) { ctx.beginPath(); ctx.moveTo(0, rr * CELL + .5); ctx.lineTo(COLS * CELL, rr * CELL + .5); ctx.stroke(); }
  }
  function drawGridTile(ctx, c, r, t) {
    var x = c * CELL, y = r * CELL;
    if (t === 1) { ctx.fillStyle = '#4b5563'; ctx.fillRect(x, y, CELL, CELL); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x, y, CELL, 4); }
    else if (t === 2) { ctx.fillStyle = '#8b5e34'; ctx.fillRect(x, y, CELL, CELL); }
    else if (t === 3) { ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, CELL * .26, 0, 6.283); ctx.fill(); }
    else if (t === 4) { ctx.fillStyle = '#ef4444'; ctx.fillRect(x + 3, y + 4, CELL - 6, CELL - 6); }
    else if (t === 5) { ctx.fillStyle = '#22c55e'; ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6); }
    else if (t === 6) { ctx.fillStyle = '#5bc0f8'; ctx.fillRect(x + 4, y + 2, CELL - 8, CELL - 4); }
  }

  /* ---------- painter ---------- */
  var painting = false;
  function bindPaint() {
    var cv = $('usScene'); if (!cv) return;
    cv.addEventListener('pointerdown', function (e) { if (!GAMES[state.game].paint) { handleSceneClick(e); return; } painting = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} paintAt(e.clientX, e.clientY); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (painting) paintAt(e.clientX, e.clientY); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { painting = false; }); });
  }
  function paintAt(clientX, clientY) {
    var cv = $('usScene'), rect = cv.getBoundingClientRect();
    var sx = (clientX - rect.left) * (cv.width / rect.width), sy = (clientY - rect.top) * (cv.height / rect.height);
    var c = Math.floor(sx / CELL), r = Math.floor(sy / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    if (state.paintTile === 6) { for (var i = 0; i < state.grid.length; i++) if (state.grid[i] === 6) state.grid[i] = 0; }
    state.grid[r * COLS + c] = state.paintTile; drawGridTile(cv.getContext('2d'), c, r, state.paintTile); saveStore();
  }
  function handleSceneClick(e) {
    // UI mock: route clicks to the nearest button row
    var g = state.game; if (g !== 'ui') return;
    var cv = $('usScene'), rect = cv.getBoundingClientRect();
    var y = (e.clientY - rect.top) * (cv.height / rect.height);
    var idx = Math.floor((y - 170) / 60);
    var screen = sim ? sim.screen : 'main';
    var buttons = screen === 'options' ? ['Back'] : (screen === 'paused' ? ['Resume'] : (screen === 'playing' ? ['Pause'] : ['Play', 'Options']));
    if (idx >= 0 && idx < buttons.length) { input.click = true; input.clickTarget = buttons[idx].toLowerCase(); }
  }

  /* ---------- play loop ---------- */
  var keys = {};
  function startPlay() {
    var g = GAMES[state.game];
    state.values = readValues();
    sim = g.build(currentValues(), state.grid);
    last = 0; if (raf) cancelAnimationFrame(raf);
    loop(performance.now());
    renderHud();
  }
  function stopPlay() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function loop(ts) {
    var g = GAMES[state.game], ctx = $('usPlay'); if (!ctx) return;
    var c = ctx.getContext('2d');
    if (!last) last = ts; var dt = Math.min(.032, (ts - last) / 1000); last = ts;
    if (sim) { g.sim(sim, dt, input); g.draw(c, sim); }
    raf = requestAnimationFrame(loop);
  }
  function renderHud() {
    if (!sim) return; var g = GAMES[state.game], box = $('usHud'); if (!box) return;
    box.innerHTML = ''; (g.hud(sim) || []).forEach(function (h) { box.appendChild(el('span', null, h.t)); });
  }
  if (typeof window !== 'undefined') window.__usHudTick = renderHud;

  function bindControls() {
    var cv = $('usPlay');
    // keyboard
    document.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = true;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = true;
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { input.up = true; input.jump = true; }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { input.down = true; input.fireL = true; }
      else if (k === ' ') { input.jump = true; e.preventDefault(); }
      else if (k === 'r' || k === 'R') startPlay();
    });
    document.addEventListener('keyup', function (e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { input.up = false; input.fireL = false; }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') input.down = false;
    });
    // on-screen dpad -> same flags
    hold('usLeft', function () { input.left = true; }, function () { input.left = false; });
    hold('usRight', function () { input.right = true; }, function () { input.right = false; });
    hold('usUp', function () { input.up = true; input.jump = true; }, function () { input.up = false; });
    hold('usDown', function () { input.down = true; input.fireL = true; }, function () { input.down = false; });
    var jb = $('usJump'); if (jb) jb.addEventListener('click', function () { input.jump = true; });
    var rb = $('usReset'); if (rb) rb.addEventListener('click', function () { startPlay(); });
    if (cv) cv.addEventListener('click', function (e) { if (state.game === 'ui') { var rect = cv.getBoundingClientRect(); var y = (e.clientY - rect.top) * (cv.height / rect.height); var screen = sim ? sim.screen : 'main'; var buttons = screen === 'options' ? ['Back'] : (screen === 'paused' ? ['Resume'] : (screen === 'playing' ? ['Pause'] : ['Play', 'Options'])); var idx = Math.floor((y - 170) / 60); if (idx >= 0 && idx < buttons.length) { input.click = true; input.clickTarget = buttons[idx].toLowerCase(); } } });
  }
  function hold(id, on, off) { var e = $(id); if (!e) return; ['pointerdown', 'touchstart'].forEach(function (ev) { e.addEventListener(ev, function (x) { on(); x.preventDefault(); }, { passive: false }); }); ['pointerup', 'pointerleave', 'pointercancel', 'touchend'].forEach(function (ev) { e.addEventListener(ev, off); }); }

  /* ---------- game switch ---------- */
  function switchGame(id) {
    if (!GAMES[id]) id = 'platformer';
    state.game = id;
    var store = loadStore(), saved = store[id];
    var g = GAMES[id];
    if (id === 'shooter' || id === 'rpg' || id === 'platformer') { state.grid = (saved && saved.grid && saved.grid.length === COLS * ROWS) ? saved.grid.slice() : g.sample(); }
    state.values = (saved && saved.values) ? Object.assign(defaults(id), saved.values) : defaults(id);
    var blurb = $('usGameBlurb'); if (blurb) blurb.textContent = g.blurb;
    [].forEach.call(document.querySelectorAll('.us-game-btn'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-game') === id); });
    var note = $('usSceneNote'); var wrap = $('usSceneWrap');
    if (note) note.style.display = g.paint ? 'none' : 'block';
    if (wrap) wrap.style.display = 'block';
    if (note) note.textContent = g.paint ? '' : 'This game has a fixed scene. Press Play to try it, or use Objects & Components to change how it plays.';
    var ch = $('usControls'); if (ch) ch.textContent = g.controls;
    renderPalette(); renderInspector(); renderScene();
    var c2 = $('usClearWrap'); if (c2) c2.style.display = g.paint ? 'flex' : 'none';
    var sc = $('usSample'); if (sc) sc.style.display = g.paint ? 'inline-block' : 'none';
    saveStore();
  }

  /* ==========================================================================
     C# EXPORT
     ========================================================================== */
  function gridRows(grid) { var a = []; for (var r = 0; r < ROWS; r++) { var s = ''; for (var c = 0; c < COLS; c++) s += String(grid[r * COLS + c]); a.push(s); } return a; }
  var SOLID_SPRITE =
    '    Sprite SolidSprite()\n' +
    '    {\n' +
    '        var tex = new Texture2D(1, 1);\n' +
    '        tex.SetPixel(0, 0, Color.white);\n' +
    '        tex.Apply();\n' +
    '        return Sprite.Create(tex, new Rect(0f, 0f, 1f, 1f), new Vector2(0.5f, 0.5f), 1f);\n' +
    '    }\n';

  function filesPlatformer(v, grid) {
    var rows = gridRows(grid);
    return addReadme({
      'Assets/Scripts/PlayerController.cs':
        'using UnityEngine;\n\npublic class PlayerController : MonoBehaviour\n{\n' +
        '    public float moveSpeed = ' + v.moveSpeed + 'f;\n    public float jumpForce = ' + v.jumpForce + 'f;\n    public float gravityScale = ' + v.gravityScale + 'f;\n' +
        '    public int maxHealth = ' + v.health + ';\n    private Rigidbody2D rb;\n    private float move;\n    private bool grounded;\n\n' +
        '    void Start() { rb = GetComponent<Rigidbody2D>(); rb.gravityScale = gravityScale; rb.freezeRotation = true; }\n' +
        '    void Update() { move = Input.GetAxisRaw("Horizontal"); if (Input.GetButtonDown("Jump") && grounded) rb.velocity = new Vector2(rb.velocity.x, jumpForce); }\n' +
        '    void FixedUpdate() { rb.velocity = new Vector2(move * moveSpeed, rb.velocity.y); grounded = Mathf.Abs(rb.velocity.y) < 0.05f; }\n}\n',
      'Assets/Scripts/Coin.cs':
        'using UnityEngine;\n\npublic class Coin : MonoBehaviour\n{\n    public int points = ' + v.coinPoints + ';\n' +
        '    void OnTriggerEnter2D(Collider2D other) { if (other.CompareTag("Player")) { if (GameManager.Instance) GameManager.Instance.AddScore(points); Destroy(gameObject); } }\n}\n',
      'Assets/Scripts/EnemyPatrol.cs':
        'using UnityEngine;\n\npublic class EnemyPatrol : MonoBehaviour\n{\n    public float patrolSpeed = ' + v.enemySpeed + 'f;\n    public float patrolDistance = 2f;\n    public int damage = ' + v.enemyDamage + ';\n' +
        '    private float minX, maxX; private int dir = 1;\n' +
        '    void Start() { minX = transform.position.x - patrolDistance; maxX = transform.position.x + patrolDistance; }\n' +
        '    void Update() { transform.position += new Vector3(dir * patrolSpeed * Time.deltaTime, 0, 0); if (transform.position.x > maxX) dir = -1; if (transform.position.x < minX) dir = 1; }\n' +
        '    void OnTriggerStay2D(Collider2D other) { if (other.CompareTag("Player") && GameManager.Instance) GameManager.Instance.DamagePlayer(damage); }\n}\n',
      'Assets/Scripts/Goal.cs': 'using UnityEngine;\n\npublic class Goal : MonoBehaviour\n{\n    void OnTriggerEnter2D(Collider2D other) { if (other.CompareTag("Player") && GameManager.Instance) GameManager.Instance.Win(); }\n}\n',
      'Assets/Scripts/GameManager.cs':
        'using UnityEngine;\n\npublic class GameManager : MonoBehaviour\n{\n    public static GameManager Instance;\n    public int score = 0; public int maxHealth = ' + v.health + '; public int health = ' + v.health + ';\n    public float damageCooldown = 1f; private float lastDamage = -10f;\n' +
        '    void Awake() { if (Instance == null) Instance = this; else Destroy(gameObject); }\n' +
        '    public void AddScore(int n) { score += n; Debug.Log("Score: " + score); }\n' +
        '    public void DamagePlayer(int n) { if (Time.time - lastDamage < damageCooldown) return; lastDamage = Time.time; health -= n; Debug.Log("Health: " + health); if (health <= 0) Debug.Log("Game Over"); }\n' +
        '    public void Win() { Debug.Log("You Win! Score: " + score); }\n}\n',
      'Assets/Scripts/CameraFollow.cs':
        'using UnityEngine;\n\npublic class CameraFollow : MonoBehaviour\n{\n    public Transform target; public Vector3 offset = new Vector3(0, 1.5f, -10); public float smooth = 5f;\n' +
        '    void LateUpdate() { if (!target) return; transform.position = Vector3.Lerp(transform.position, target.position + offset, smooth * Time.deltaTime); }\n}\n',
      'Assets/Scripts/LevelLayout.cs': layoutCs('LevelLayout', rows, '  // 0 empty 1 ground 2 platform 3 coin 4 enemy 5 goal 6 player', { solid: ['1', '2'], gravity: v.gravityScale })
    }, 'platformer', v);
  }

  function filesPong(v) {
    return addReadme({
      'Assets/Scripts/PaddleController.cs':
        'using UnityEngine;\n\npublic class PaddleController : MonoBehaviour\n{\n    public float speed = ' + v.paddleSpeed + 'f;\n    public string axis = "Vertical";\n' +
        '    void Update() { float m = 0; if (axis == "Vertical") { if (Input.GetKey(KeyCode.W)) m = -1; if (Input.GetKey(KeyCode.S)) m = 1; } else { if (Input.GetKey(KeyCode.UpArrow)) m = -1; if (Input.GetKey(KeyCode.DownArrow)) m = 1; } transform.Translate(0, m * speed * Time.deltaTime, 0); }\n}\n',
      'Assets/Scripts/BallController.cs':
        'using UnityEngine;\n\npublic class BallController : MonoBehaviour\n{\n    public float speed = ' + (v.ballSpeed * 42) + 'f;\n    private Rigidbody2D rb;\n' +
        '    void Start() { rb = GetComponent<Rigidbody2D>(); rb.velocity = new Vector2(Random.value < 0.5f ? -1 : 1, Random.Range(-0.6f, 0.6f)) * speed; }\n' +
        '    void FixedUpdate() { rb.velocity = rb.velocity.normalized * speed; }\n}\n',
      'Assets/Scripts/PongGame.cs':
        'using UnityEngine;\n\npublic class PongGame : MonoBehaviour\n{\n    public int pointsToWin = ' + v.winsToWin + ';\n    public int leftScore = 0, rightScore = 0;\n' +
        '    public void ScoreLeft() { leftScore++; Debug.Log("Left " + leftScore); } public void ScoreRight() { rightScore++; Debug.Log("Right " + rightScore); }\n}\n',
      'Assets/Scripts/BuildPong.cs':
        'using UnityEngine;\n\npublic class BuildPong : MonoBehaviour\n{\n    public float paddleHeight = ' + (v.paddleHeight * 18 / 24) + 'f;\n' +
        '    void Awake()\n    {\n        MakeWall(-0.5f, 5f, 0.2f, 10.5f); MakeWall(20.1f, 5f, 0.2f, 10.5f);\n' +
        '        MakeWall(10f, -0.4f, 21f, 0.2f); MakeWall(10f, 10.4f, 21f, 0.2f);\n' +
        '        MakePaddle(1f, 5f, "Vertical"); MakePaddle(19.2f, 5f, "Arrows");\n' +
        '        var ball = MakeBox("Ball", 10f, 5f, 0.4f, 0.4f); ball.AddComponent<CircleCollider2D>().radius = 0.5f; var rb = ball.AddComponent<Rigidbody2D>(); rb.gravityScale = 0; rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous; ball.AddComponent<BallController>();\n' +
        '        if (GetComponent<PongGame>() == null) gameObject.AddComponent<PongGame>();\n    }\n' +
        '    void MakeWall(float x, float y, float w, float h) { var go = MakeBox("Wall", x, y, w, h); var b = go.AddComponent<BoxCollider2D>(); }\n' +
        '    void MakePaddle(float x, float y, string axis) { var go = MakeBox("Paddle", x, y, 0.4f, paddleHeight * 4f); go.AddComponent<BoxCollider2D>(); var pc = go.AddComponent<PaddleController>(); pc.axis = axis; }\n' +
        '    GameObject MakeBox(string name, float x, float y, float w, float h) { var go = new GameObject(name); go.transform.position = new Vector3(x, y, 0); go.transform.localScale = new Vector3(w, h, 1); var sr = go.AddComponent<SpriteRenderer>(); sr.sprite = SolidSprite(); if (name != "Ball") sr.color = name == "Paddle" ? new Color(0.36f, 0.75f, 0.97f) : Color.white; return go; }\n' +
        SOLID_SPRITE + '}\n'
    }, 'pong', v);
  }

  function filesBreakout(v) {
    return addReadme({
      'Assets/Scripts/PaddleController.cs': 'using UnityEngine;\n\npublic class PaddleController : MonoBehaviour\n{\n    public float speed = ' + v.paddleSpeed + 'f;\n    void Update() { float m = Input.GetAxisRaw("Horizontal"); transform.Translate(m * speed * Time.deltaTime, 0, 0); }\n}\n',
      'Assets/Scripts/Ball.cs': 'using UnityEngine;\n\npublic class Ball : MonoBehaviour\n{\n    public float speed = ' + (v.ballSpeed * 40) + 'f;\n    private Rigidbody2D rb; private bool launched = false;\n' +
        '    void Start() { rb = GetComponent<Rigidbody2D>(); }\n    void Update() { if (!launched && Input.GetKeyDown(KeyCode.Space)) { launched = true; rb.velocity = new Vector2(0.6f, 1f).normalized * speed; } }\n    void FixedUpdate() { if (launched) rb.velocity = rb.velocity.normalized * speed; }\n}\n',
      'Assets/Scripts/Brick.cs': 'using UnityEngine;\n\npublic class Brick : MonoBehaviour\n{\n    public int points = ' + v.brickPoints + ';\n    void OnCollisionEnter2D(Collision2D c) { if (c.gameObject.GetComponent<Ball>()) { BreakoutGame.Instance.AddScore(points); Destroy(gameObject); } }\n}\n',
      'Assets/Scripts/BreakoutGame.cs': 'using UnityEngine;\n\npublic class BreakoutGame : MonoBehaviour\n{\n    public static BreakoutGame Instance; public int score = 0; public int lives = ' + v.lives + ';\n    void Awake() { Instance = this; }\n    public void AddScore(int n) { score += n; Debug.Log("Score: " + score); }\n    public void LoseLife() { lives--; Debug.Log("Lives: " + lives); }\n}\n',
      'Assets/Scripts/BuildBreakout.cs':
        'using UnityEngine;\n\npublic class BuildBreakout : MonoBehaviour\n{\n    void Awake()\n    {\n        if (GetComponent<BreakoutGame>() == null) gameObject.AddComponent<BreakoutGame>();\n' +
        '        var paddle = MakeBox("Paddle", 0f, -6f, 3f, 0.5f); paddle.AddComponent<BoxCollider2D>(); paddle.AddComponent<PaddleController>();\n' +
        '        var ball = MakeBox("Ball", 0f, -4.5f, 0.4f, 0.4f); ball.AddComponent<CircleCollider2D>().radius = 0.5f; var rb = ball.AddComponent<Rigidbody2D>(); rb.gravityScale = 0; rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous; ball.AddComponent<Ball>();\n' +
        '        for (int r = 0; r < ' + v.brickRows + '; r++) for (int c = 0; c < 10; c++) { var brick = MakeBox("Brick", -6.3f + c * 1.4f, 6f - r * 0.9f, 1.2f, 0.7f); brick.AddComponent<BoxCollider2D>(); brick.AddComponent<Brick>(); }\n    }\n' +
        '    GameObject MakeBox(string name, float x, float y, float w, float h) { var go = new GameObject(name); go.transform.position = new Vector3(x, y, 0); go.transform.localScale = new Vector3(w, h, 1); var sr = go.AddComponent<SpriteRenderer>(); sr.sprite = SolidSprite(); return go; }\n' +
        SOLID_SPRITE + '}\n'
    }, 'breakout', v);
  }

  function filesShooter(v, grid) {
    var rows = gridRows(grid);
    return addReadme({
      'Assets/Scripts/TopDownPlayer.cs': 'using UnityEngine;\n\npublic class TopDownPlayer : MonoBehaviour\n{\n    public float moveSpeed = ' + v.moveSpeed + 'f;\n    public float fireRate = ' + v.fireRate + 'f;\n    public GameObject bullet;\n    private float nextFire;\n' +
        '    void Update()\n    {\n        float x = Input.GetAxisRaw("Horizontal"), y = Input.GetAxisRaw("Vertical"); transform.position += new Vector3(x, y, 0).normalized * moveSpeed * Time.deltaTime;\n' +
        '        var enemies = GameObject.FindGameObjectsWithTag("Enemy");\n        if (enemies.Length > 0 && Time.time > nextFire) { nextFire = Time.time + 1f / fireRate; var near = enemies[0]; foreach (var e in enemies) if (Vector2.Distance(e.transform.position, transform.position) < Vector2.Distance(near.transform.position, transform.position)) near = e; var dir = (near.transform.position - transform.position).normalized; var b = Instantiate(bullet, transform.position, Quaternion.identity); b.GetComponent<Rigidbody2D>().velocity = dir * 9f; }\n    }\n}\n',
      'Assets/Scripts/Bullet.cs': 'using UnityEngine;\n\npublic class Bullet : MonoBehaviour\n{\n    void OnTriggerEnter2D(Collider2D other) { if (other.CompareTag("Enemy")) { Destroy(other.gameObject); Destroy(gameObject); } }\n}\n',
      'Assets/Scripts/EnemyChase.cs': 'using UnityEngine;\n\npublic class EnemyChase : MonoBehaviour\n{\n    public float speed = ' + v.enemySpeed + 'f;\n    public int health = ' + v.enemyHealth + ';\n    private Transform target;\n    void Start() { var p = GameObject.FindWithTag("Player"); if (p) target = p.transform; }\n    void Update() { if (target) transform.position = Vector2.MoveTowards(transform.position, target.position, speed * Time.deltaTime); }\n}\n',
      'Assets/Scripts/ShooterGame.cs': 'using UnityEngine;\n\npublic class ShooterGame : MonoBehaviour\n{\n    public static ShooterGame Instance; public int score; void Awake() { Instance = this; } public void Kill() { score++; Debug.Log("Kills: " + score); }\n}\n',
      'Assets/Scripts/BuildArena.cs': layoutCs('BuildArena', rows, '  // 0 empty 1 wall 4 enemy 6 player', { solid: ['1'], arena: true, playerScript: 'TopDownPlayer', enemyScript: 'EnemyChase' })
    }, 'shooter', v);
  }

  function filesRpg(v, grid) {
    var rows = gridRows(grid);
    return addReadme({
      'Assets/Scripts/RpgPlayer.cs': 'using UnityEngine;\n\npublic class RpgPlayer : MonoBehaviour\n{\n    public float moveSpeed = ' + v.moveSpeed + 'f;\n    public float attacksPerSecond = ' + v.attackRate + 'f;\n    public int attackDamage = ' + v.attackDamage + ';\n    private float nextAttack;\n' +
        '    void Update() { float x = Input.GetAxisRaw("Horizontal"), y = Input.GetAxisRaw("Vertical"); transform.position += new Vector3(x, y, 0).normalized * moveSpeed * Time.deltaTime; if (Input.GetKeyDown(KeyCode.Space) && Time.time > nextAttack) { nextAttack = Time.time + 1f / attacksPerSecond; foreach (var hit in Physics2D.OverlapCircleAll(transform.position, 1.2f)) { var e = hit.GetComponent<RpgEnemy>(); if (e) e.TakeDamage(attackDamage); } } }\n}\n',
      'Assets/Scripts/RpgEnemy.cs': 'using UnityEngine;\n\npublic class RpgEnemy : MonoBehaviour\n{\n    public int health = ' + v.enemyHealth + ';\n    public int damage = ' + v.enemyDamage + ';\n    public int xpReward = 1;\n    private Transform target;\n    void Start() { var p = GameObject.FindWithTag("Player"); if (p) target = p.transform; }\n    void Update() { if (target) transform.position = Vector2.MoveTowards(transform.position, target.position, 3f * Time.deltaTime); }\n    public void TakeDamage(int n) { health -= n; if (health <= 0) { if (RpgGame.Instance) RpgGame.Instance.GainXP(xpReward); Destroy(gameObject); } }\n}\n',
      'Assets/Scripts/RpgGame.cs': 'using UnityEngine;\n\npublic class RpgGame : MonoBehaviour\n{\n    public static RpgGame Instance; public int level = 1; public int xp; public int xpToLevel = ' + v.levelUpXP + ';\n    void Awake() { Instance = this; }\n    public void GainXP(int n) { xp += n; if (xp >= xpToLevel) { xp = 0; level++; xpToLevel += 2; Debug.Log("Level up: " + level); } }\n}\n',
      'Assets/Scripts/BuildArena.cs': layoutCs('BuildArena', rows, '  // 0 empty 1 wall 4 enemy 6 player', { solid: ['1'], arena: true, playerScript: 'RpgPlayer', enemyScript: 'RpgEnemy' })
    }, 'rpg', v);
  }

  function filesUi(v) {
    return addReadme({
      'Assets/Scripts/UIManager.cs': 'using UnityEngine;\nusing UnityEngine.SceneManagement;\n\npublic class UIManager : MonoBehaviour\n{\n    public static UIManager Instance;\n    public GameObject mainMenu; public GameObject optionsMenu; public GameObject pauseMenu; public GameObject hud;\n' +
        '    private bool paused;\n    void Awake() { Instance = this; }\n    void Update() { if (Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.P)) TogglePause(); ShowMenu(); }\n' +
        '    void ShowMenu() { var playing = !paused && !mainMenu.activeSelf && !optionsMenu.activeSelf; hud.SetActive(playing); pauseMenu.SetActive(paused); }\n' +
        '    public void Play() { mainMenu.SetActive(false); optionsMenu.SetActive(false); paused = false; }\n    public void OpenOptions() { optionsMenu.SetActive(true); }\n    public void Back() { optionsMenu.SetActive(false); }\n    public void Quit() { Application.Quit(); }\n    public void TogglePause() { if (mainMenu.activeSelf || optionsMenu.activeSelf) return; paused = !paused; }\n}\n',
      'Assets/Scripts/MainMenu.cs': 'using UnityEngine;\n\npublic class MainMenu : MonoBehaviour\n{\n    public void OnPlay() { if (UIManager.Instance) UIManager.Instance.Play(); }\n    public void OnOptions() { if (UIManager.Instance) UIManager.Instance.OpenOptions(); }\n    public void OnQuit() { if (UIManager.Instance) UIManager.Instance.Quit(); }\n}\n',
      'Assets/Scripts/PauseMenu.cs': 'using UnityEngine;\n\npublic class PauseMenu : MonoBehaviour\n{\n    public void OnResume() { if (UIManager.Instance) UIManager.Instance.TogglePause(); }\n}\n',
      'Assets/Scripts/Hud.cs': 'using UnityEngine;\nusing UnityEngine.UI;\n\npublic class Hud : MonoBehaviour\n{\n    public Text scoreText; public int score;\n    public void AddScore(int n) { score += n; if (scoreText) scoreText.text = "Score: " + score; }\n}\n'
    }, 'ui', v);
  }

  function filesMultiplayer(v) {
    return addReadme({
      'Assets/Scripts/NetworkPlayer.cs':
        'using Unity.Netcode;\nusing UnityEngine;\n\n// Starter for Unity Netcode for GameObjects. Add the Netcode package, then put\n// this on your player prefab and set the NetworkManager to spawn it.\n' +
        'public class NetworkPlayer : NetworkBehaviour\n{\n    public float moveSpeed = ' + v.moveSpeed + 'f;\n    private readonly NetworkVariable<Vector2> netPos = new NetworkVariable<Vector2>();\n' +
        '    void Update()\n    {\n        if (!IsOwner) { transform.position = netPos.Value; return; }\n        float x = Input.GetAxisRaw("Horizontal"), y = Input.GetAxisRaw("Vertical");\n        transform.position += new Vector3(x, y, 0).normalized * moveSpeed * Time.deltaTime;\n        if (IsServer) netPos.Value = transform.position;\n    }\n}\n',
      'Assets/Scripts/NetworkBootstrap.cs':
        'using Unity.Netcode;\nusing UnityEngine;\n\npublic class NetworkBootstrap : MonoBehaviour\n{\n    public void StartHost() { NetworkManager.Singleton.StartHost(); }\n    public void StartClient() { NetworkManager.Singleton.StartClient(); }\n}\n'
    }, 'multiplayer', v);
  }

  function layoutCs(className, rows, comment, opts) {
    opts = opts || {};
    var solid = opts.solid || ['1'];
    var solidCond = solid.map(function (ch) { return "t == '" + ch + "'"; }).join(' || ');
    var lines = rows.map(function (r) { return '        "' + r + '"'; }).join(',\n');
    var block = opts.arena
      ? '        else if (t == \'6\')\n        {\n            go.tag = "Player";\n            go.AddComponent<BoxCollider2D>();\n            var rb = go.AddComponent<Rigidbody2D>(); rb.gravityScale = 0; rb.freezeRotation = true;\n            go.AddComponent<' + opts.playerScript + '>();\n        }\n' +
        '        else if (t == \'4\')\n        {\n            go.tag = "Enemy";\n            go.AddComponent<CircleCollider2D>().isTrigger = true;\n            go.AddComponent<' + opts.enemyScript + '>();\n        }\n'
      : '        else if (t == \'6\')\n        {\n            go.tag = "Player";\n            go.AddComponent<BoxCollider2D>();\n            var rb = go.AddComponent<Rigidbody2D>(); rb.gravityScale = ' + opts.gravity + 'f; rb.freezeRotation = true;\n            go.AddComponent<PlayerController>();\n        }\n' +
        '        else if (t == \'3\')\n        {\n            go.AddComponent<CircleCollider2D>().isTrigger = true; go.AddComponent<Coin>();\n        }\n' +
        '        else if (t == \'4\')\n        {\n            go.AddComponent<BoxCollider2D>().isTrigger = true; go.AddComponent<EnemyPatrol>();\n        }\n' +
        '        else if (t == \'5\')\n        {\n            go.AddComponent<BoxCollider2D>().isTrigger = true; go.AddComponent<Goal>();\n        }\n';
    return 'using UnityEngine;\n\npublic class ' + className + ' : MonoBehaviour\n{\n' + comment + '\n    public float cell = 1f;\n' +
      '    private static readonly string[] Layout =\n    {\n' + lines + '\n    };\n\n' +
      '    void Awake()\n    {\n        int rows = Layout.Length, cols = Layout[0].Length;\n        for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++) { if (Layout[r][c] != \'0\') Make(Layout[r][c], c * cell + cell * 0.5f, (rows - 1 - r) * cell + cell * 0.5f); }\n    }\n\n' +
      '    void Make(char t, float x, float y)\n    {\n        var go = new GameObject("Tile_" + t);\n        go.transform.position = new Vector3(x, y, 0);\n' +
      '        var sr = go.AddComponent<SpriteRenderer>(); sr.sprite = SolidSprite(); sr.color = ColorFor(t);\n' +
      '        if (' + solidCond + ') { go.transform.localScale = new Vector3(cell, cell, 1); go.AddComponent<BoxCollider2D>(); }\n' + block +
      '    }\n\n' +
      '    Color ColorFor(char t) { if (t == \'1\') return new Color(0.29f, 0.33f, 0.4f); if (t == \'2\') return new Color(0.55f, 0.37f, 0.2f); if (t == \'4\') return new Color(0.94f, 0.27f, 0.27f); if (t == \'3\') return new Color(0.96f, 0.77f, 0.09f); if (t == \'5\') return new Color(0.13f, 0.77f, 0.37f); return new Color(0.36f, 0.75f, 0.97f); }\n' +
      SOLID_SPRITE + '}\n';
  }

  function addReadme(files, game, v) {
    var g = GAMES[game];
    var names = Object.keys(files).map(function (n) { return '  ' + n.split('/').pop(); }).join('\n');
    files['README.txt'] =
      (v.title ? v.title + '\n\n' : '') +
      'Made in the JVDesignStudio Unity Studio (' + g.label + ').\n\n' +
      'HOW TO RUN IT IN UNITY:\n' +
      '1. Install Unity Hub and an LTS editor (Unity Personal, free).\n' +
      '2. New Project, choose 2D (Built-In), name it whatever you like.\n' +
      '3. Copy the Assets/Scripts folder into your project Assets folder.\n' +
      (game === 'ui' ? '4. Build the Canvas and menus in Unity (Button, Text, Panel), then attach the scripts.\n'
        : game === 'multiplayer' ? '4. Add the Netcode for GameObjects package, set up the NetworkManager, then attach NetworkPlayer to your prefab.\n'
          : '4. Create Empty in the Hierarchy, name it Level, and add the ' + ({ platformer: 'LevelLayout', shooter: 'BuildArena', rpg: 'BuildArena', pong: 'BuildPong', breakout: 'BuildBreakout' }[game] || 'LevelLayout') + ' script to it.\n5. Press Play.\n') +
      '\nSCRIPTS:\n' + names + '\n\nFull guide: https://jvdesignstudio.co.uk/workshops/my-first-unity-game.html\n';
    return files;
  }

  /* ==========================================================================
     ZIP (no libraries)
     ========================================================================== */
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

  /* ==========================================================================
     WIRE UP
     ========================================================================== */
  function refreshTree() {
    var g = GAMES[state.game], tree = $('usTree'); if (!tree) return;
    var project = ($('xProject') && $('xProject').value || 'MyUnityGame').replace(/[^A-Za-z0-9_.-]/g, '') || 'MyUnityGame';
    var files = g.files(currentValues(), state.grid);
    tree.textContent = project + '.zip\n' + Object.keys(files).map(function (n, i, a) { return '├── ' + n; }).join('\n');
  }

  var exportMsg = $('usMsg');
  function doExport() {
    try {
      var enc = new TextEncoder(), g = GAMES[state.game];
      var project = (($('xProject') && $('xProject').value) || 'MyUnityGame').replace(/[^A-Za-z0-9_.-]/g, '') || 'MyUnityGame';
      var files = g.files(currentValues(), state.grid), arr = [];
      Object.keys(files).forEach(function (n) { arr.push({ name: n, data: enc.encode(files[n]) }); });
      var zip = makeZip(arr), blob = new Blob([zip], { type: 'application/zip' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = project + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      try { var c = parseInt(localStorage.getItem('jvds_tool_export_unity-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_unity-studio', String(c)); } catch (e) {}
      if (exportMsg) { exportMsg.className = 'us-msg ok'; exportMsg.textContent = 'Downloaded ' + project + '.zip (' + g.label + '). Follow the README to open it in Unity.'; }
    } catch (e) { if (exportMsg) { exportMsg.className = 'us-msg bad'; exportMsg.textContent = 'Something went wrong building the zip. Try again.'; } }
  }

  function boot() {
    var blurb = $('usGameBlurb');
    // game picker
    [].forEach.call(document.querySelectorAll('.us-game-btn'), function (b) {
      b.addEventListener('click', function () { switchGame(b.getAttribute('data-game')); });
    });
    // tabs
    [].forEach.call(document.querySelectorAll('.us-tab'), function (btn) {
      btn.addEventListener('click', function () {
        [].forEach.call(document.querySelectorAll('.us-tab'), function (b) { b.classList.remove('is-active'); });
        [].forEach.call(document.querySelectorAll('.us-panel'), function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var p = $('panel-' + btn.getAttribute('data-tab')); if (p) p.classList.add('is-active');
        state.screen = btn.getAttribute('data-tab');
        if (state.screen === 'play') startPlay(); else stopPlay();
        if (state.screen === 'scene') renderScene();
        if (state.screen === 'export') refreshTree();
      });
    });
    var clr = $('usClear'); if (clr) clr.addEventListener('click', function () { state.grid = new Array(COLS * ROWS).fill(0); renderScene(); saveStore(); });
    var smp = $('usSample'); if (smp) smp.addEventListener('click', function () { state.grid = GAMES[state.game].sample(); renderScene(); saveStore(); });
    var op = $('usOpenPlay'); if (op) op.addEventListener('click', function () { var t = document.querySelector('.us-tab[data-tab="play"]'); if (t) t.click(); });
    var dl = $('xDownload'); if (dl) dl.addEventListener('click', doExport);
    var cp = $('xCopy'); if (cp) cp.addEventListener('click', function () {
      var files = GAMES[state.game].files(currentValues(), state.grid);
      var all = Object.keys(files).map(function (n) { return '// ===== ' + n + ' =====\n' + files[n]; }).join('\n');
      try { navigator.clipboard.writeText(all).then(function () { if (exportMsg) { exportMsg.className = 'us-msg ok'; exportMsg.textContent = 'Copied all scripts.'; } }, function () {}); } catch (e) {}
    });
    ['xProject'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('input', refreshTree); });
    bindPaint(); bindControls();
    // initial game from ?game= or default
    var want = (new URLSearchParams(location.search)).get('game');
    switchGame(GAMES[want] ? want : 'platformer');
    refreshTree();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
