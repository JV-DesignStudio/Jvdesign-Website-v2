(function () {
  var $ = function (id) { return document.getElementById(id); };
  var C = $('game');
  var ctx = C.getContext('2d');
  var audio = (typeof AudioEffects !== 'undefined') ? new AudioEffects(.5) : null;
  var sys = window.GameSystem ? new GameSystem('stardust-snake', 'Stardust Snake', 'stardust') : null;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var COLS = 20, ROWS = 20;
  var START_STEP = 170, MIN_STEP = 72, STEP_GAIN = 5;

  var BEATS = [
    { at: 0, text: 'Stardust drifts into the empty sky, one spark at a time.' },
    { at: .4, text: 'The trail lengthens and the constellation starts to glow.' },
    { at: .8, text: 'Last of the light: every star counts now.' }
  ];

  var storyRun = window.__storyRun = window.StoryRun ? new StoryRun({
    id: 'stardust-snake',
    gameSystem: sys,
    title: 'Stardust Snake',
    character: 'Stardust',
    open: 'Stardust is a lone speck of light and the fallen stars are going out.',
    objective: 'Guide the stardust trail into the fallen stars and grow as long as you can.',
    beats: BEATS,
    cap: 300,
    result: {
      success: 'A long bright constellation. Stardust sets it in the sky to guide the next traveller.',
      partial: 'The trail reached across the dark before it faded, and the sky still holds your light.',
      fail: 'The light fades early, but Stardust keeps the shape of the trail you made.'
    },
    onBeat: function (b) { toast(b.text); },
    onFinish: function (outcome, score) { addKeepsakeButton(outcome, score); },
    onRestart: function () { startGame(); }
  }) : null;

  // A952 showcase polish: goals that celebrate as the trail grows, plus a shake on
  // the fade. Shared implementation in ../game-showcase.js.
  var MISSION = [5, 10, 18, 30];
  var milestoneHits = 0;
  var milestones = window.JVDSShowcase ? new JVDSShowcase.Milestones(MISSION, function (m) {
    milestoneHits++;
    toast('Constellation goal: ' + m + ' stars!');
    try { audio?.playSuccess?.(); } catch (e) {}
    burst(headPow().x, headPow().y, '#ffd24a', reduceMotion ? 10 : 28);
  }) : null;
  var shake = window.JVDSShowcase ? new JVDSShowcase.Shake(14) : null;

  var snake, dir, nextDir, food, score, best, step, acc, last, running, dead, paused, longest;
  var stars = [], particles = [];
  var size = 0, dpr = 1;

  function makeStars() {
    stars = [];
    for (var i = 0; i < 54; i++) {
      stars.push({
        x: Math.random() * COLS, y: Math.random() * ROWS,
        r: .3 + Math.random() * 1.0, a: .12 + Math.random() * .5,
        tw: Math.random() * Math.PI * 2,
        col: ['#ffffff', '#cbb6ff', '#f6dfa0', '#a78bfa'][i % 4]
      });
    }
  }

  function headPow() { var s = size / COLS; return { x: snake[0].x * s + s / 2, y: snake[0].y * s + s / 2 }; }
  function cellPow(c) { var s = size / COLS; return { x: c.x * s + s / 2, y: c.y * s + s / 2 }; }

  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - .5) * 260,
        vy: (Math.random() - .5) * 260,
        life: 1, color: color, size: 1.5 + Math.random() * 3.5
      });
    }
  }

  function placeFood() {
    var open = [];
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var hit = snake.some(function (s) { return s.x === x && s.y === y; });
      if (!hit) open.push({ x: x, y: y });
    }
    food = open.length ? open[(Math.random() * open.length) | 0] : { x: 0, y: 0 };
  }

  function reset() {
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
    score = 0; step = START_STEP; acc = 0; last = 0;
    running = false; dead = false; paused = false; longest = 3;
    particles = [];
    if (milestones) milestones.reset();
    if (shake) shake.reset();
    placeFood();
    if (sys && sys.beginRun) sys.beginRun();
    hud();
    draw();
  }

  function hud() {
    $('score').textContent = score;
    $('length').textContent = snake.length;
    $('best').textContent = best;
    var g = milestones ? milestones.next() : null;
    $('goal').textContent = g == null ? 'Done' : g;
    if (storyRun) storyRun.setScore(score);
  }

  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  var loopHandle = null;

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
      longest = Math.max(longest, snake.length);
      step = Math.max(MIN_STEP, step - STEP_GAIN);
      try { audio?.playPop?.(); } catch (e) {}
      var p = cellPow(head);
      burst(p.x, p.y, '#ffd24a', reduceMotion ? 4 : 12);
      if (!reduceMotion) burst(p.x, p.y, '#a78bfa', 6);
      if (milestones) milestones.check(score);
      placeFood();
    } else {
      snake.pop();
    }
    hud();
  }

  function loop(ts) {
    loopHandle = requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = ts - last;
    last = ts;
    if (running && !dead && !paused) {
      acc += dt;
      while (acc >= step) { acc -= step; tick(); if (dead) break; }
    }
    updateParticles(dt / 1000);
    draw(ts);
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.8;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (shake) shake.decay();
  }

  // ---- canvas sizing ----
  function resize() {
    var stage = C.parentElement;
    var w = stage.clientWidth - 16, h = stage.clientHeight - 16;
    var side = Math.max(160, Math.min(w, h));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = side;
    C.style.width = side + 'px'; C.style.height = side + 'px';
    C.width = Math.round(side * dpr); C.height = Math.round(side * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw(ts) {
    var s = size / COLS;
    var t = (ts || performance.now()) / 1000;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (shake && !reduceMotion) shake.apply(ctx, 1);

    var bg = ctx.createRadialGradient(size / 2, size * .38, size * .1, size / 2, size * .5, size * .8);
    bg.addColorStop(0, '#150a3d'); bg.addColorStop(.5, '#0a0126'); bg.addColorStop(1, '#03010f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);

    // faint grid
    ctx.strokeStyle = 'rgba(167,139,250,.06)'; ctx.lineWidth = 1;
    for (var i = 1; i < COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(size, i * s); ctx.stroke();
    }

    // twinkling background stars
    for (var k = 0; k < stars.length; k++) {
      var st = stars[k];
      ctx.globalAlpha = st.a * (0.55 + 0.45 * Math.sin(t * 1.4 + st.tw));
      ctx.fillStyle = st.col;
      ctx.beginPath(); ctx.arc(st.x * s, st.y * s, st.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // edge warning when the head nears the wall
    var hd = snake[0];
    var edge = Math.min(hd.x, hd.y, COLS - 1 - hd.x, ROWS - 1 - hd.y);
    if (running && edge <= 1) {
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.18 * Math.sin(t * 8);
      ctx.strokeStyle = '#E8A800'; ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, size - 8, size - 8);
      ctx.restore();
    }

    // food star, slowly spinning
    if (food) {
      var f = cellPow(food);
      var pulse = 0.82 + 0.18 * Math.sin(t * 4);
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(t * 0.6);
      ctx.shadowColor = '#E8A800'; ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#ffd24a';
      starPath(0, 0, 5, s * 0.36 * pulse, s * 0.16 * pulse); ctx.fill();
      ctx.restore();
    }

    drawTrail(s);
    drawParticles();
    ctx.restore();
  }

  function drawTrail(s) {
    if (!snake || !snake.length) return;
    var glow = 0.5 + 0.5 * Math.min(1, snake.length / 18);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    var pts = snake.map(function (seg) { return { x: seg.x * s + s / 2, y: seg.y * s + s / 2 }; });

    // glow underlay
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = 'rgba(232,168,0,' + (0.18 + 0.22 * glow) + ')';
    ctx.lineWidth = s * 0.96; ctx.stroke();

    // gradient body: bright gold head to violet tail
    var g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.addColorStop(0, '#ffe08a'); g.addColorStop(.45, '#E8A800'); g.addColorStop(1, '#7c5bd6');
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.strokeStyle = g; ctx.lineWidth = s * 0.66 * (1 + 0.05 * glow); ctx.stroke();

    // head
    ctx.shadowColor = '#E8A800'; ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, s * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3cf'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function starPath(cx, cy, spikes, outer, inner) {
    var rot = -Math.PI / 2;
    ctx.beginPath();
    for (var i = 0; i < spikes * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var x = cx + Math.cos(rot) * r, y = cy + Math.sin(rot) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      rot += Math.PI / spikes;
    }
    ctx.closePath();
  }

  function setDir(x, y) {
    if (!running || dead || paused) return;
    if (dir.x === -x && dir.y === -y) return;
    if (nextDir.x === x && nextDir.y === y) return;
    nextDir = { x: x, y: y };
    try { audio?.playTap?.(720); } catch (e) {}
  }

  function startGame() {
    reset();
    running = true; dead = false; paused = false;
    $('startScreen').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    if (sys && sys.beginRun) sys.beginRun();
    if (storyRun && !storyRun.running) storyRun.begin();
    toast(BEATS[0].text);
    last = 0; acc = 0;
    draw();
  }

  function end() {
    if (dead) return;
    dead = true; running = false;
    if (shake && !reduceMotion) shake.hit(16);
    if (!reduceMotion) burst(headPow().x, headPow().y, '#a78bfa', 30);
    try { audio?.playError?.(); } catch (e) {}
    if (score > best) {
      best = score;
      try { if (window.GameSystem && GameSystem.saveScore) GameSystem.saveScore('stardust-snake', best, { level: best + 1, extra: { longest: longest } }); } catch (e) {}
    } else {
      try { if (window.GameSystem && GameSystem.saveScore) GameSystem.saveScore('stardust-snake', score, { newPlay: true, extra: { longest: longest } }); } catch (e) {}
    }
    if (sys && sys.saveState) { try { sys.saveState(); } catch (e) {} }
    hud();
    if (storyRun) {
      storyRun.finish(score >= 18 ? 'success' : score >= 5 ? 'partial' : 'fail', score);
    } else {
      $('endTitle').textContent = 'Your constellation faded';
      $('endScreen').classList.remove('hidden');
    }
  }

  // A shareable/saveable keepsake card so a run can leave the browser (school-PC
  // friendly: a plain PNG download, no account and no upload).
  function addKeepsakeButton(outcome, runScore) {
    var card = document.querySelector('.sr-modal.show .sr-modal-card');
    if (!card || card.querySelector('.sr-keepsake')) return;
    var btn = document.createElement('button');
    btn.className = 'sr-keepsake';
    btn.type = 'button';
    btn.textContent = '⬇ Save your constellation';
    btn.style.cssText = 'display:block;width:100%;border:0;border-radius:10px;padding:11px;margin-bottom:8px;font:inherit;font-weight:900;cursor:pointer;background:rgba(64,59,51,.08);color:#403b33';
    btn.addEventListener('click', function () { saveKeepsake(outcome, runScore); });
    var firstBtn = card.querySelector('.sr-again');
    if (firstBtn) card.insertBefore(btn, firstBtn); else card.appendChild(btn);
  }

  function saveKeepsake(outcome, runScore) {
    var c = document.createElement('canvas');
    c.width = 900; c.height = 600;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 600);
    grad.addColorStop(0, '#150a3d'); grad.addColorStop(1, '#03010f');
    g.fillStyle = grad; g.fillRect(0, 0, 900, 600);
    for (var i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(200,182,255,' + (0.1 + Math.random() * 0.5) + ')';
      g.fillRect(Math.random() * 900, Math.random() * 600, 2, 2);
    }
    // a small constellation trail
    g.strokeStyle = '#E8A800'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath();
    var px = 210, py = 360;
    g.moveTo(px, py);
    for (var s = 0; s < 6; s++) { px += 40 + Math.random() * 40; py += (Math.random() - .5) * 90; g.lineTo(px, py); }
    g.stroke();
    px = 210; py = 360;
    g.fillStyle = '#ffd24a';
    g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center';
    g.fillStyle = '#E8A800'; g.font = '700 42px system-ui, sans-serif';
    g.fillText('Stardust Snake', 450, 92);
    g.fillStyle = '#c8b6ff'; g.font = '700 20px system-ui, sans-serif';
    g.fillText("Stardust's trail", 450, 126);
    g.fillStyle = '#ffffff'; g.font = '800 108px system-ui, sans-serif';
    g.fillText(String(runScore), 450, 270);
    g.fillStyle = '#c8b6ff'; g.font = '700 22px system-ui, sans-serif';
    g.fillText('STARS', 450, 308);
    g.fillStyle = '#e6dcff'; g.font = '600 22px system-ui, sans-serif';
    g.fillText('Best ' + best + '     Longest trail ' + longest, 450, 380);
    var line = outcome === 'success' ? 'A bright constellation set in the sky.'
      : outcome === 'partial' ? 'A trail of light across the dark.'
      : 'A first spark. The sky remembers it.';
    g.fillStyle = '#E8A800'; g.font = '700 26px system-ui, sans-serif';
    g.fillText(line, 450, 440);
    g.fillStyle = '#8a7ab5'; g.font = '600 18px system-ui, sans-serif';
    g.fillText('jvdesignstudio.co.uk', 450, 552);
    c.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'stardust-snake-run.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }, 'image/png');
  }

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
  C.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  C.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });

  $('playBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);
  $('restart').addEventListener('click', startGame);

  var pauseCtl = (typeof GameUI !== 'undefined' && GameUI.autoPause) ? GameUI.autoPause({
    pause: function () { if (!running || dead) return false; paused = true; return true; },
    resume: function () { paused = false; }
  }) : null;
  $('pause').addEventListener('click', function () { if (pauseCtl) pauseCtl.toggle(); });

  window.addEventListener('resize', resize);

  // ---- boot ----
  best = 0;
  try { best = (window.GameSystem && GameSystem.getBestScore) ? (GameSystem.getBestScore('stardust-snake') || 0) : 0; } catch (e) {}
  makeStars();
  reset();
  resize();
  loopHandle = requestAnimationFrame(loop);

  // exposed for the automated smoke test
  window.__stardustSnake = {
    snake: function () { return snake; },
    score: function () { return score; },
    running: function () { return running; },
    dead: function () { return dead; },
    paused: function () { return paused; },
    speed: function () { return step; },
    food: function () { return food; },
    particles: function () { return particles.length; },
    milestone: function () { return milestones ? milestones.next() : null; },
    milestoneHits: function () { return milestoneHits; },
    shakeHits: function () { return shake ? shake.hits : 0; },
    reduceMotion: reduceMotion,
    setDir: setDir,
    placeFoodAhead: function () { var h = snake[0]; food = { x: h.x + dir.x, y: h.y + dir.y }; }
  };
})();
