(function () {
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('game');
  var ctx = canvas.getContext('2d');
  var sys = window.GameSystem ? new GameSystem('stardust-snake', 'Stardust Snake', 'stardust') : null;
  var sfx = (window.SoundManager && sys) ? new SoundManager(sys) : null;

  var COLS = 20, ROWS = 20;
  var START_STEP = 170, MIN_STEP = 72, STEP_GAIN = 5;

  var snake, dir, nextDir, food, score, best, step, acc, last, running, dead, lastMove;
  var stars = [];

  function makeStars() {
    stars = [];
    for (var i = 0; i < 46; i++) {
      stars.push({
        x: Math.random() * COLS,
        y: Math.random() * ROWS,
        r: 0.3 + Math.random() * 0.9,
        a: 0.15 + Math.random() * 0.5,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  function reset() {
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    step = START_STEP;
    acc = 0;
    last = 0;
    running = false;
    dead = false;
    lastMove = 0;
    placeFood();
    if (sys && sys.beginRun) sys.beginRun();
    hud();
    draw();
  }

  function placeFood() {
    var open = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var hit = snake.some(function (s) { return s.x === x && s.y === y; });
        if (!hit) open.push({ x: x, y: y });
      }
    }
    food = open.length ? open[(Math.random() * open.length) | 0] : { x: 0, y: 0 };
  }

  function hud() {
    $('score').textContent = score;
    $('length').textContent = snake.length;
    $('best').textContent = best;
  }

  function cells() { return Math.round(size); }
  var size = 0;

  // ---- canvas sizing ----
  function resize() {
    var stage = canvas.parentElement;
    var pad = 16;
    var w = stage.clientWidth - pad;
    var h = stage.clientHeight - pad;
    var side = Math.max(160, Math.min(w, h));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = side;
    canvas.style.width = side + 'px';
    canvas.style.height = side + 'px';
    canvas.width = Math.round(side * dpr);
    canvas.height = Math.round(side * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    var s = size / COLS;
    ctx.clearRect(0, 0, size, size);
    // deep sky
    var bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, '#0a0126');
    bg.addColorStop(1, '#03010f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // background stars
    var t = performance.now() / 700;
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var a = st.a * (0.6 + 0.4 * Math.sin(t + st.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cbb6ff';
      ctx.beginPath();
      ctx.arc(st.x * s, st.y * s, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // food star
    if (food) {
      var fx = food.x * s + s / 2, fy = food.y * s + s / 2;
      var pulse = 0.8 + 0.2 * Math.sin(performance.now() / 260);
      ctx.save();
      ctx.shadowColor = '#E8A800';
      ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#ffd24a';
      drawStar(fx, fy, 5, s * 0.34 * pulse, s * 0.15 * pulse);
      ctx.fill();
      ctx.restore();
    }

    // snake trail
    for (var j = snake.length - 1; j >= 0; j--) {
      var seg = snake[j];
      var frac = 1 - j / Math.max(snake.length, 1);
      var px = seg.x * s + s / 2, py = seg.y * s + s / 2;
      ctx.beginPath();
      ctx.arc(px, py, s * (j === 0 ? 0.42 : 0.34), 0, Math.PI * 2);
      if (j === 0) {
        ctx.fillStyle = '#ffe08a';
        ctx.shadowColor = '#E8A800';
        ctx.shadowBlur = 16;
      } else {
        var g = 168 + Math.round(80 * frac);
        ctx.fillStyle = 'rgba(' + (232 - Math.round(140 * (1 - frac))) + ',' + (168 + Math.round(60 * frac)) + ',' + g + ',' + (0.35 + 0.6 * frac) + ')';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawStar(cx, cy, spikes, outer, inner) {
    var rot = -Math.PI / 2;
    ctx.beginPath();
    for (var i = 0; i < spikes * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var x = cx + Math.cos(rot) * r;
      var y = cy + Math.sin(rot) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      rot += Math.PI / spikes;
    }
    ctx.closePath();
  }

  function setDir(x, y) {
    if (!running) return;
    if (dir.x === -x && dir.y === -y) return; // no instant reverse
    nextDir = { x: x, y: y };
  }

  function tick() {
    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return end();
    var ate = food && head.x === food.x && head.y === food.y;
    var body = ate ? snake : snake.slice(0, snake.length - 1);
    if (body.some(function (s) { return s.x === head.x && s.y === head.y; })) return end();
    snake.unshift(head);
    if (ate) {
      score++;
      step = Math.max(MIN_STEP, step - STEP_GAIN);
      if (sfx) sfx.playPointSound();
      placeFood();
    } else {
      snake.pop();
    }
    hud();
    draw();
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!running) { draw(); return; }
    if (!last) last = ts;
    var dt = ts - last;
    last = ts;
    acc += dt;
    if (acc >= step) {
      acc = acc % step;
      tick();
    }
    if (running) draw();
  }

  function start() {
    reset();
    running = true;
    $('startScreen').classList.add('hidden');
    $('overScreen').classList.add('hidden');
    draw();
  }

  function end() {
    running = false;
    dead = true;
    if (sfx) sfx.playErrorSound();
    if (score > best) {
      best = score;
      try { if (window.GameSystem && GameSystem.saveScore) GameSystem.saveScore('stardust-snake', best, { level: best + 1 }); } catch (e) {}
    } else {
      try { if (window.GameSystem && GameSystem.saveScore) GameSystem.saveScore('stardust-snake', score, { newPlay: true }); } catch (e) {}
    }
    if (sys && sys.recordGamePlay) { try { sys.recordGamePlay(Date.now()); } catch (e) {} }
    $('overScore').textContent = score;
    $('overBest').textContent = best;
    $('overLine').textContent = score >= 10
      ? 'A bright constellation. Stardust keeps the best one in the sky.'
      : 'Stardust gathers the light back up. Try a longer trail next time.';
    $('overScreen').classList.remove('hidden');
    hud();
    draw();
  }

  function isPlaying() { return running; }

  // ---- input ----
  document.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (['arrowup', 'w'].indexOf(k) >= 0) { setDir(0, -1); e.preventDefault(); }
    else if (['arrowdown', 's'].indexOf(k) >= 0) { setDir(0, 1); e.preventDefault(); }
    else if (['arrowleft', 'a'].indexOf(k) >= 0) { setDir(-1, 0); e.preventDefault(); }
    else if (['arrowright', 'd'].indexOf(k) >= 0) { setDir(1, 0); e.preventDefault(); }
  });

  $('dUp').addEventListener('click', function () { setDir(0, -1); });
  $('dDown').addEventListener('click', function () { setDir(0, 1); });
  $('dLeft').addEventListener('click', function () { setDir(-1, 0); });
  $('dRight').addEventListener('click', function () { setDir(1, 0); });

  var touchStart = null;
  canvas.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });

  $('playBtn').addEventListener('click', start);
  $('againBtn').addEventListener('click', start);
  $('restart').addEventListener('click', function () { if (running || dead) start(); else start(); });

  window.addEventListener('resize', resize);

  // ---- boot ----
  best = 0;
  try { best = (window.GameSystem && GameSystem.getBestScore) ? (GameSystem.getBestScore('stardust-snake') || 0) : 0; } catch (e) {}
  makeStars();
  reset();
  resize();
  requestAnimationFrame(loop);

  // exposed for the automated smoke test
  window.__stardustSnake = {
    snake: function () { return snake; },
    score: function () { return score; },
    running: function () { return running; },
    dead: function () { return dead; },
    speed: function () { return step; },
    food: function () { return food; },
    setDir: setDir,
    placeFoodAhead: function () { var h = snake[0]; food = { x: h.x + dir.x, y: h.y + dir.y }; }
  };
})();
