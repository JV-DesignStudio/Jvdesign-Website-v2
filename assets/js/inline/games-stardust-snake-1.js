(function () {
  var $ = function (id) { return document.getElementById(id); };
  var C = $('game');
  var ctx = C.getContext('2d');
  var audio = (typeof AudioEffects !== 'undefined') ? new AudioEffects(.5) : null;
  var sys = window.GameSystem ? new GameSystem('stardust-snake', 'Stardust Snake', 'stardust') : null;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var COLS = 20, ROWS = 20;
  var STEP_GAIN = 5, MIN_STEP = 72;
  var SPEEDS = { chill: 210, normal: 170, turbo: 120 };
  var COMBO_WINDOW = 3200;
  var GOLDEN_SLOW = 42;

  // Trail colour palettes. Slot 0 is always open; the others unlock as your
  // best constellation grows, so there is a reason to keep playing.
  var PALETTES = [
    { name: 'Starlight', head: '#fff3cf', mid: '#E8A800', tail: '#7c5bd6', glow: '232,168,0' },
    { name: 'Aurora', head: '#d4fff2', mid: '#3fd0b0', tail: '#2a5fd6', glow: '63,208,176' },
    { name: 'Comet', head: '#ffe1c2', mid: '#ff7a3c', tail: '#8a1f4a', glow: '255,122,60' },
    { name: 'Nebula', head: '#ffd8ef', mid: '#ff5c9e', tail: '#5b2a8a', glow: '255,92,158' }
  ];
  var PALETTE_UNLOCK = [0, 10, 20, 30];

  var ACH = [
    { id: 'first-star', name: 'First Spark', test: function (s) { return s.score >= 1; } },
    { id: 'ten-stars', name: 'Ten Stars', test: function (s) { return s.score >= 10; } },
    { id: 'long-trail', name: 'Long Trail', test: function (s) { return s.longest >= 25; } },
    { id: 'clean-sky', name: 'Clean Sky', test: function (s) { return s.score >= 12 && s.wallDeaths === 0; } }
  ];

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
    flash = 1;
    try { audio?.playSuccess?.(); } catch (e) {}
    burst(headPow().x, headPow().y, '#ffd24a', reduceMotion ? 10 : 28);
  }) : null;
  var shake = window.JVDSShowcase ? new JVDSShowcase.Shake(14) : null;

  var snake, dir, nextDir, food, foodType, score, best, step, startStep, acc, last;
  var running, dead, paused, longest, combo, comboTimer, goldenCount, wallDeaths, skipNext;
  var eatCount = 0, lastEatType = '';
  var difficulty = loadPref('diff', 'normal');
  var wallWrap = loadPref('wrap', '0') === '1';
  var paletteIdx = parseInt(loadPref('palette', '0'), 10) || 0;
  var flash = 0, deathAnim = 0, trailTimer = 0;
  var stars = [], particles = [];
  var achUnlocked = loadAch();
  var size = 0, dpr = 1;

  function prefKey(k) { return 'jvds_sd_snake_' + k; }
  function loadPref(k, d) { try { var v = localStorage.getItem(prefKey(k)); return v == null ? d : v; } catch (e) { return d; } }
  function savePref(k, v) { try { localStorage.setItem(prefKey(k), String(v)); } catch (e) {} }
  function loadAch() {
    try { return JSON.parse(localStorage.getItem(prefKey('ach')) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveAch() { try { localStorage.setItem(prefKey('ach'), JSON.stringify(achUnlocked)); } catch (e) {} }
  function isMuted() { try { return localStorage.getItem('jvds_sound') === '0'; } catch (e) { return false; } }
  function setMuted(m) { try { localStorage.setItem('jvds_sound', m ? '0' : '1'); } catch (e) {} }

  function loadBest() {
    try { if (window.JVDSGameScore) return window.JVDSGameScore.getBestScore('stardust-snake') || 0; } catch (e) {}
    try { if (window.GameSystem && window.GameSystem.getBestScore) return window.GameSystem.getBestScore('stardust-snake') || 0; } catch (e) {}
    return 0;
  }
  function saveBest() {
    try {
      if (window.JVDSGameScore) window.JVDSGameScore.saveScore('stardust-snake', best, { level: best + 1, extra: { longest: longest } });
      else if (window.GameSystem && window.GameSystem.saveScore) window.GameSystem.saveScore('stardust-snake', best, { level: best + 1, extra: { longest: longest } });
    } catch (e) {}
  }

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

  function cellPx(cx, cy) { var s = size / COLS; return { x: cx * s + s / 2, y: cy * s + s / 2 }; }
  function headPow() { return cellPx(snake[0].x, snake[0].y); }
  function headTipPow() {
    var head = snake[0];
    var t = (running && !dead && !paused) ? Math.max(0, Math.min(1, acc / step)) : 0;
    var nx = head.x + dir.x, ny = head.y + dir.y;
    var ok = nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS;
    return cellPx(head.x + (ok ? dir.x * t : 0), head.y + (ok ? dir.y * t : 0));
  }

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

  function rollFoodType() {
    var r = Math.random();
    if (r < 0.10) return 'poison';
    if (r < 0.35) return 'golden';
    return 'normal';
  }

  function placeFood(forceNormal) {
    var open = [];
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      var hit = snake.some(function (s) { return s.x === x && s.y === y; });
      if (!hit) open.push({ x: x, y: y });
    }
    food = open.length ? open[(Math.random() * open.length) | 0] : { x: 0, y: 0 };
    foodType = (forceNormal || score < 3) ? 'normal' : rollFoodType();
  }

  function reset() {
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
    score = 0; startStep = SPEEDS[difficulty] || SPEEDS.normal; step = startStep;
    acc = 0; last = 0;
    running = false; dead = false; paused = false; longest = 3;
    combo = 0; comboTimer = 0; goldenCount = 0; wallDeaths = 0; skipNext = false;
    flash = 0; deathAnim = 0; trailTimer = 0;
    eatCount = 0; lastEatType = '';
    particles = [];
    if (milestones) milestones.reset();
    if (shake) shake.reset();
    placeFood(true);
    if (sys && sys.beginRun) sys.beginRun();
    updateCombo(); hud(); setPauseLabel(); draw();
  }

  function hud() {
    $('score').textContent = score;
    $('length').textContent = snake.length;
    $('best').textContent = Math.max(best, score);
    var g = milestones ? milestones.next() : null;
    $('goal').textContent = g == null ? 'Done' : g;
    if (storyRun) storyRun.setScore(score);
  }

  function updateCombo() {
    var el = $('combo');
    if (!el) return;
    if (combo >= 2) { el.textContent = 'COMBO x' + Math.min(combo, 9); el.classList.add('show'); }
    else el.classList.remove('show');
  }

  function setPauseLabel() {
    var b = $('pause');
    if (b) b.textContent = paused ? 'Resume' : 'Pause';
  }

  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function unlockAch(a) {
    achUnlocked[a.id] = true;
    saveAch();
    toast('🏅 ' + a.name + ' unlocked!');
    try { audio?.playLevelUp?.(); } catch (e) {}
  }

  function checkAchievements() {
    var snap = { score: score, longest: longest, wallDeaths: wallDeaths };
    for (var i = 0; i < ACH.length; i++) {
      if (!achUnlocked[ACH[i].id] && ACH[i].test(snap)) unlockAch(ACH[i]);
    }
  }

  function unlockedPalettes() {
    var bestSeen = Math.max(best || 0, score || 0);
    var n = 0;
    for (var i = 0; i < PALETTES.length; i++) if (bestSeen >= PALETTE_UNLOCK[i]) n = i + 1;
    return n;
  }

  var loopHandle = null;

  // Apply one star's effect. `head` has already been added to the tail. Shared
  // by the real move loop and the deterministic feedNow test hook.
  function applyEat(head) {
    eatCount++; lastEatType = foodType;
    var p = cellPx(head.x, head.y);
    if (foodType === 'poison') {
      if (snake.length > 2) snake.pop();
      snake.pop();
      skipNext = true;
      combo = 0; comboTimer = 0;
      burst(p.x, p.y, '#ff4d6d', reduceMotion ? 4 : 14);
      toast('Dark spark! The trail shrinks.');
      try { audio?.playError?.(); } catch (e) {}
    } else {
      combo = comboTimer > 0 ? combo + 1 : 1;
      comboTimer = COMBO_WINDOW;
      if (foodType === 'golden') {
        goldenCount++;
        score += 5;
        step = Math.min(startStep, step + GOLDEN_SLOW);
        burst(p.x, p.y, '#ffe9a0', reduceMotion ? 6 : 22);
        toast('Golden star! +5');
        try { audio?.playLevelUp?.(); } catch (e) {}
      } else {
        score += (combo >= 3 ? 2 : 1);
        step = Math.max(MIN_STEP, step - STEP_GAIN);
        try { audio?.playPop?.(); } catch (e) {}
        burst(p.x, p.y, '#ffd24a', reduceMotion ? 4 : 12);
        if (!reduceMotion) burst(p.x, p.y, '#a78bfa', 6);
      }
      longest = Math.max(longest, snake.length);
      if (milestones) milestones.check(score);
      placeFood(false);
    }
    updateCombo();
    checkAchievements();
  }

  function tick() {
    if (skipNext) { skipNext = false; return; }
    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
      if (wallWrap) { head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS; }
      else { wallDeaths++; return end(); }
    }
    var ate = food && head.x === food.x && head.y === food.y;
    var grow = ate && foodType !== 'poison';
    var body = grow ? snake : snake.slice(0, snake.length - 1);
    if (body.some(function (s) { return s.x === head.x && s.y === head.y; })) return end();
    snake.unshift(head);
    if (ate) applyEat(head);
    else snake.pop();
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
    updateEffects(Math.min(dt, 100) / 1000);
    draw(ts);
  }

  function updateEffects(dt) {
    // Continuous spark trail drifting off the head.
    if (running && !dead && !paused && !reduceMotion) {
      trailTimer -= dt;
      if (trailTimer <= 0) {
        trailTimer = 0.045;
        var hp = headTipPow();
        particles.push({
          x: hp.x + (Math.random() - .5) * 5,
          y: hp.y + (Math.random() - .5) * 5,
          vx: (Math.random() - .5) * 24,
          vy: (Math.random() - .5) * 24,
          life: .6, color: (PALETTES[paletteIdx] || PALETTES[0]).head, size: 1 + Math.random() * 2
        });
      }
    }
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.8;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 520) particles.splice(0, particles.length - 520);
    if (comboTimer > 0) {
      comboTimer -= dt * 1000;
      if (comboTimer <= 0 && combo > 1) { combo = 0; updateCombo(); }
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    if (deathAnim > 0) deathAnim = Math.max(0, deathAnim - dt * 2.2);
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
    if (deathAnim > 0 && !reduceMotion) {
      var z = 1 + 0.12 * deathAnim;
      ctx.translate(size / 2, size / 2); ctx.scale(z, z); ctx.translate(-size / 2, -size / 2);
    }

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

    // edge warning when the head nears the wall (only matters with wrap off)
    var hd = snake[0];
    var edge = Math.min(hd.x, hd.y, COLS - 1 - hd.x, ROWS - 1 - hd.y);
    if (running && !wallWrap && edge <= 1) {
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.18 * Math.sin(t * 8);
      ctx.strokeStyle = '#E8A800'; ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, size - 8, size - 8);
      ctx.restore();
    }

    drawFood(t, s);
    drawTrail(s);
    drawParticles();

    if (flash > 0) {
      var fg = ctx.createRadialGradient(size / 2, size / 2, size * .2, size / 2, size / 2, size * .78);
      fg.addColorStop(0, 'rgba(232,168,0,0)');
      fg.addColorStop(1, 'rgba(232,168,0,' + (0.35 * flash) + ')');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, size, size);
    }
    if (deathAnim > 0) { ctx.fillStyle = 'rgba(3,1,15,' + (0.55 * deathAnim) + ')'; ctx.fillRect(0, 0, size, size); }
    ctx.restore();
  }

  function drawFood(t, s) {
    if (!food) return;
    var f = cellPx(food.x, food.y);
    var pulse = 0.82 + 0.18 * Math.sin(t * 4);
    ctx.save();
    ctx.translate(f.x, f.y);
    if (foodType === 'golden') {
      ctx.rotate(t * 1.1);
      ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 22 * pulse;
      ctx.fillStyle = '#ffe9a0';
      starPath(0, 0, 5, s * 0.44 * pulse, s * 0.2 * pulse); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,210,74,.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5 * pulse, 0, Math.PI * 2); ctx.stroke();
    } else if (foodType === 'poison') {
      ctx.rotate(t * 2.2);
      ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#b3123a';
      starPath(0, 0, 7, s * 0.42 * pulse, s * 0.16 * pulse); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd0d8';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.rotate(t * 0.6);
      ctx.shadowColor = '#E8A800'; ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#ffd24a';
      starPath(0, 0, 5, s * 0.36 * pulse, s * 0.16 * pulse); ctx.fill();
    }
    ctx.restore();
  }

  function drawTrail(s) {
    if (!snake || !snake.length) return;
    var pal = PALETTES[paletteIdx] || PALETTES[0];
    var glow = 0.5 + 0.5 * Math.min(1, snake.length / 18);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // The head glides ahead within the current tick so motion is smooth
    // instead of snapping cell to cell.
    var head = snake[0];
    var t = (running && !dead && !paused) ? Math.max(0, Math.min(1, acc / step)) : 0;
    var nx = head.x + dir.x, ny = head.y + dir.y;
    var leadOK = nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS;

    var pts = [{ x: (head.x + (leadOK ? dir.x * t : 0)) * s + s / 2, y: (head.y + (leadOK ? dir.y * t : 0)) * s + s / 2 }];
    for (var i = 1; i < snake.length; i++) pts.push({ x: snake[i].x * s + s / 2, y: snake[i].y * s + s / 2 });

    // glow underlay
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.strokeStyle = 'rgba(' + pal.glow + ',' + (0.18 + 0.22 * glow) + ')';
    ctx.lineWidth = s * 0.96; ctx.stroke();

    // gradient body: bright head to deep tail
    var g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.addColorStop(0, pal.head); g.addColorStop(.45, pal.mid); g.addColorStop(1, pal.tail);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var m = 1; m < pts.length; m++) ctx.lineTo(pts[m].x, pts[m].y);
    ctx.strokeStyle = g; ctx.lineWidth = s * 0.66 * (1 + 0.05 * glow); ctx.stroke();

    // head
    ctx.shadowColor = pal.mid; ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, s * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = pal.head; ctx.fill();
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
    setPauseLabel();
    draw();
  }

  function end() {
    if (dead) return;
    dead = true; running = false;
    if (shake && !reduceMotion) shake.hit(16);
    deathAnim = reduceMotion ? 0 : 1;
    if (!reduceMotion) burst(headPow().x, headPow().y, '#a78bfa', 30);
    try { audio?.playError?.(); } catch (e) {}
    checkAchievements();
    var newBest = score > best;
    if (newBest) best = score;
    saveBest();
    if (sys && sys.saveState) { try { sys.saveState(); } catch (e) {} }
    buildPalettePills();
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
    g.fillText('Best ' + Math.max(best, runScore) + '     Longest trail ' + longest, 450, 380);
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

  // ---- settings UI ----
  function updateDiffPills() {
    var pills = document.querySelectorAll('#diffPills .pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle('active', pills[i].getAttribute('data-diff') === difficulty);
  }

  function buildPalettePills() {
    var wrap = $('palettePills');
    if (!wrap) return;
    wrap.innerHTML = '';
    var open = unlockedPalettes();
    for (var i = 0; i < PALETTES.length; i++) {
      var unlocked = i < open;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (i === paletteIdx ? ' active' : '') + (unlocked ? '' : ' locked');
      b.textContent = unlocked ? PALETTES[i].name : '🔒 ' + PALETTE_UNLOCK[i];
      b.disabled = !unlocked;
      b.setAttribute('data-pal', String(i));
      b.setAttribute('aria-label', unlocked ? 'Trail colour ' + PALETTES[i].name : 'Locked until best ' + PALETTE_UNLOCK[i]);
      b.addEventListener('click', (function (idx, ok) {
        return function () {
          if (!ok) return;
          paletteIdx = idx; savePref('palette', idx); buildPalettePills();
        };
      })(i, unlocked));
      wrap.appendChild(b);
    }
  }

  function updateSound() {
    var b = $('sound');
    if (b) { b.textContent = isMuted() ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(isMuted())); }
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

  var diffRow = $('diffPills');
  if (diffRow) diffRow.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.pill') : null;
    if (!b || !b.getAttribute('data-diff')) return;
    difficulty = b.getAttribute('data-diff');
    savePref('diff', difficulty);
    updateDiffPills();
  });

  var wrapBox = $('wrapToggle');
  if (wrapBox) {
    wrapBox.checked = wallWrap;
    wrapBox.addEventListener('change', function () { wallWrap = wrapBox.checked; savePref('wrap', wallWrap ? '1' : '0'); });
  }

  var soundBtn = $('sound');
  if (soundBtn) soundBtn.addEventListener('click', function () { setMuted(!isMuted()); updateSound(); });

  var pauseCtl = (typeof GameUI !== 'undefined' && GameUI.autoPause) ? GameUI.autoPause({
    pause: function () { if (!running || dead) return false; paused = true; setPauseLabel(); return true; },
    resume: function () { paused = false; setPauseLabel(); }
  }) : null;
  $('pause').addEventListener('click', function () {
    if (pauseCtl) pauseCtl.toggle();
    else { paused = !paused; setPauseLabel(); }
  });

  window.addEventListener('resize', resize);

  // ---- boot ----
  best = loadBest();
  makeStars();
  reset();
  if (paletteIdx >= unlockedPalettes()) { paletteIdx = 0; savePref('palette', 0); }
  resize();
  updateDiffPills();
  buildPalettePills();
  updateSound();
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
    foodType: function () { return foodType; },
    combo: function () { return combo; },
    particles: function () { return particles.length; },
    milestone: function () { return milestones ? milestones.next() : null; },
    milestoneHits: function () { return milestoneHits; },
    best: function () { return best; },
    longest: function () { return longest; },
    eatCount: function () { return eatCount; },
    lastEat: function () { return lastEatType; },
    goldenCount: function () { return goldenCount; },
    wallWrap: function () { return wallWrap; },
    wallDeaths: function () { return wallDeaths; },
    difficulty: function () { return difficulty; },
    palette: function () { return paletteIdx; },
    unlockedPalettes: function () { return unlockedPalettes(); },
    achievements: function () { return Object.keys(achUnlocked); },
    shakeHits: function () { return shake ? shake.hits : 0; },
    reduceMotion: reduceMotion,
    setDir: setDir,
    setWrap: function (v) { wallWrap = !!v; },
    setFoodType: function (t) { foodType = t; },
    // Deterministic eat for the smoke test: add the next cell out front and
    // apply one star's effect without waiting for the move timer.
    feedNow: function (t) {
      if (dead || !running) return false;
      foodType = t || 'normal';
      var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (wallWrap) { head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS; }
      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return false;
      snake.unshift(head);
      applyEat(head);
      hud();
      return true;
    },
    placeFoodAhead: function (t) {
      var h = snake[0];
      var nx = h.x + dir.x, ny = h.y + dir.y;
      if (wallWrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
      food = { x: nx, y: ny };
      foodType = t || 'normal';
    }
  };
})();
