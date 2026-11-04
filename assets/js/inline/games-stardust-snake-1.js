(function () {
  var $ = function (id) { return document.getElementById(id); };
  var C = $('game');
  var ctx = C.getContext('2d');
  var audio = (typeof AudioEffects !== 'undefined') ? new AudioEffects(.5) : null;
  var sys = window.GameSystem ? new GameSystem('stardust-snake', 'Stardust Snake', 'stardust') : null;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Adaptive soundtrack: a soft two-voice loop that quickens as the run grows. */
  var music = (function () {
    var ac = null, on = false, timer = null, step = 0;
    function ensure() {
      try {
        if (!ac) {
          var Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          ac = new Ctx();
        }
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        return ac;
      } catch (e) { return null; }
    }
    function blip(freq, dur, gain) {
      if (!ac || isMuted()) return;
      try {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.value = 0;
        o.connect(g); g.connect(ac.destination);
        var t = ac.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) {}
    }
    function schedule() {
      if (!on) return;
      var seq = [0, 4, 7, 12, 7, 4];
      var base = 220 + Math.min(9, Math.floor((typeof score === 'number' ? score : 0) / 5)) * 16;
      var n = seq[step % seq.length];
      blip(base * Math.pow(2, n / 12), 0.22, 0.04 + musicVol * 0.10);
      if (step % 6 === 0) blip(base / 2, 0.7, 0.03 + musicVol * 0.05);
      step++;
      var gap = Math.max(170, 430 - ((typeof score === 'number' ? score : 0) * 6));
      timer = setTimeout(schedule, gap);
    }
    return {
      start: function () { if (on) return; if (!ensure()) return; on = true; step = 0; schedule(); },
      stop: function () { on = false; if (timer) { clearTimeout(timer); timer = null; } },
      isOn: function () { return on; }
    };
  })();

  var COLS = 20, ROWS = 20;
  var STEP_GAIN = 5, MIN_STEP = 72;
  var SPEEDS = { chill: 210, normal: 170, turbo: 120 };
  var COMBO_WINDOW = 3200;
  var GOLDEN_SLOW = 42;
  var POISON_GRACE_SCORE = 5;
  var POISON_COOLDOWN_EATS = 4;
  var GHOST_CAP = 420;
  var NIGHTFALL_SECONDS = 90;
  var GHOST_PASS_SECONDS = 4;
  var FREEZE_SECONDS = 4;
  var DOUBLE_SECONDS = 6;
  var SLOW_FACTOR = 1.4;

  var PALETTES = [
    { name: 'Starlight', head: '#fff3cf', mid: '#E8A800', tail: '#7c5bd6', glow: '232,168,0' },
    { name: 'Aurora', head: '#d4fff2', mid: '#3fd0b0', tail: '#2a5fd6', glow: '63,208,176' },
    { name: 'Comet', head: '#ffe1c2', mid: '#ff7a3c', tail: '#8a1f4a', glow: '255,122,60' },
    { name: 'Galaxy', head: '#ffd8ef', mid: '#ff5c9e', tail: '#5b2a8a', glow: '255,92,158' }
  ];
  var PALETTE_UNLOCK = [0, 10, 20, 30];

  /* Constellation campaign: eight hand-tuned boards with a target score. */
  var MISSIONS = [
    { name: 'First Spark', goal: 5 },
    { name: 'Crossroads', goal: 8 },
    { name: 'Four Corners', goal: 10 },
    { name: 'Long Diagonal', goal: 12 },
    { name: 'The Ring', goal: 12 },
    { name: 'Sky Pillars', goal: 15 },
    { name: 'Meteor Maze', goal: 15 },
    { name: 'Deep Field', goal: 18 }
  ];

  /* Cosmetic shop. Dust is earned from stars; items are permanent. */
  var SHOP = [
    { id: 'comet-head', name: 'Comet head', cost: 20, desc: 'A bright tail behind the head' },
    { id: 'sparkle-trail', name: 'Sparkle trail', cost: 40, desc: 'Extra glitter as you move' },
    { id: 'star-rain', name: 'Star rain', cost: 60, desc: 'Gentle falling stars in the sky' }
  ];

  var THEMES = [
    { name: 'Nightfall', a: '#150a3d', b: '#0a0126', c: '#03010f', grid: 'rgba(167,139,250,.06)' },
    { name: 'Aurora', a: '#07303a', b: '#041a2e', c: '#020b16', grid: 'rgba(63,208,176,.07)' },
    { name: 'Ember Sky', a: '#3a1a12', b: '#1d0a16', c: '#0b020f', grid: 'rgba(255,122,60,.07)' },
    { name: 'Deep Nebula', a: '#2a0a3a', b: '#150626', c: '#07020f', grid: 'rgba(255,92,158,.07)' }
  ];

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

  var params = new URLSearchParams(location.search);
  var challengeSeed = params.get('seed') || '';
  var activeSeed = challengeSeed || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  var requestedGoal = parseInt(params.get('goal'), 10);

  function hashSeed(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var starRng = mulberry32(hashSeed(activeSeed + ':stars'));
  var foodRng = mulberry32(hashSeed(activeSeed + ':food'));
  var rockRng = mulberry32(hashSeed(activeSeed + ':rocks'));
  function resetRngs() {
    foodRng = mulberry32(hashSeed(activeSeed + ':food'));
    rockRng = mulberry32(hashSeed(activeSeed + ':rocks'));
  }

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
    onFinish: function (outcome, score) {
      running = false;
      if (!won) dead = true;
      addRunSummary();
      addKeepsakeButton(outcome, score);
    },
    onRestart: function () { startGame(); }
  }) : null;

  var MISSION = [5, 10, 18, 30];
  var milestoneHits = 0;
  var milestones = window.JVDSShowcase ? new JVDSShowcase.Milestones(buildGoalLadder(), function (m) {
    milestoneHits++;
    toast('Constellation goal: ' + m + ' stars!');
    flash = 1;
    buzz(14);
    announce('Goal reached: ' + m + ' stars.');
    try { audio?.playSuccess?.(); } catch (e) {}
    burst(headPow().x, headPow().y, '#ffd24a', reduceMotion ? 10 : 28);
  }) : null;
  var shake = window.JVDSShowcase ? new JVDSShowcase.Shake(14) : null;

  function buildGoalLadder() {
    var list = MISSION.slice();
    var v = list[list.length - 1], inc = 20;
    while (v < 5000) { v += inc; list.push(v); inc = Math.round(inc * 1.25); }
    return list;
  }

  var snake, dir, nextDir, food, foodType, score, best, step, startStep, acc, last;
  var running, dead, paused, won, longest, combo, comboTimer, goldenCount, wallDeaths, skipNext;
  var eatCount = 0, lastEatType = '';
  var shields = 0, magnetTimer = 0, slowTimer = 0, poisonCooldown = 0;
  var bestCombo = 0, runPath = [], ghostPath = [];
  var rocks = [], portals = [], tempRocks = [];
  var gameMode = loadPref('mode', 'classic');
  var difficulty = loadPref('diff', 'normal');
  var wallWrap = loadPref('wrap', '0') === '1';
  var haptics = loadPref('haptics', '1') !== '0';
  var a11y = loadPref('a11y', '0') === '1';
  var paletteIdx = parseInt(loadPref('palette', '0'), 10) || 0;
  var flash = 0, deathAnim = 0, trailTimer = 0, shownTheme = 0;
  var stars = [], particles = [];
  var achUnlocked = loadAch();
  var size = 0, dpr = 1;
  /* New mode + meta state. */
  var snake2 = null, dir2 = { x: -1, y: 0 }, nextDir2 = { x: -1, y: 0 }, score2 = 0, alive2 = true;
  var ghostTimer = 0, freezeTimer = 0, doubleTimer = 0;
  var eventTimer = 0, eventKind = '';
  var missionIdx = parseInt(loadPref('mission', '0'), 10) || 0;
  var missionGoal = 0;
  var dust = parseInt(loadPref('dust', '0'), 10) || 0;
  var owned = loadOwned();
  var ghostRace = loadPref('ghostrace', '0') === '1';
  var highContrast = loadPref('hc', '0') === '1';
  var largeCells = loadPref('large', '0') === '1';
  var musicVol = parseFloat(loadPref('musicvol', '0.35'));
  if (isNaN(musicVol)) musicVol = 0.35;
  var musicOn = loadPref('musicon', '0') === '1';
  var keyMap = loadKeys();
  var tutStep = parseInt(loadPref('tut', '0'), 10) || 0;
  var timeLeft = 0;
  var resumeState = loadResume();
  var bindTarget = '';
  var narrationTick = 0;
  var resumeTick = 0;

  function prefKey(k) { return 'jvds_sd_snake_' + k; }
  function loadPref(k, d) { try { var v = localStorage.getItem(prefKey(k)); return v == null ? d : v; } catch (e) { return d; } }
  function savePref(k, v) { try { localStorage.setItem(prefKey(k), String(v)); } catch (e) {} }

  function loadOwned() {
    try { return JSON.parse(localStorage.getItem(prefKey('owned')) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveOwned() { try { localStorage.setItem(prefKey('owned'), JSON.stringify(owned)); } catch (e) {} }
  function hasCosmetic(id) { return !!owned[id]; }

  function loadKeys() {
    try {
      var k = JSON.parse(localStorage.getItem(prefKey('keys')) || 'null');
      if (k && k.up && k.down && k.left && k.right) return k;
    } catch (e) {}
    return { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
  }
  function saveKeys() { try { localStorage.setItem(prefKey('keys'), JSON.stringify(keyMap)); } catch (e) {} }

  function loadResume() {
    try {
      var s = JSON.parse(localStorage.getItem(prefKey('resume')) || 'null');
      if (s && s.snake && s.snake.length && Date.now() - (s.t || 0) < 3600000) return s;
    } catch (e) {}
    return null;
  }
  function saveResume() {
    if (!running || dead || won) return;
    try {
      localStorage.setItem(prefKey('resume'), JSON.stringify({
        t: Date.now(), score: score, snake: snake, dir: dir, food: food, foodType: foodType,
        mode: gameMode, difficulty: difficulty, shields: shields, step: step, longest: longest,
        snake2: snake2, score2: score2, timeLeft: timeLeft,
        timers: { ghost: ghostTimer, freeze: freezeTimer, double: doubleTimer }
      }));
    } catch (e) {}
  }
  function clearResume() { try { localStorage.removeItem(prefKey('resume')); } catch (e) {} resumeState = null; showResumeBtn(); }
  function showResumeBtn() {
    var b = $('resumeBtn');
    if (b) b.classList.toggle('hidden', !resumeState);
  }

  function getDayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function getDailyGoal() {
    var d = new Date();
    var dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    return 5 + (dayOfYear % 8);
  }
  var dailyGoal = (requestedGoal >= 5 && requestedGoal <= 200) ? requestedGoal : getDailyGoal();
  var streakData = (function () {
    try {
      var o = JSON.parse(localStorage.getItem(prefKey('streak')) || '{}');
      var today = getDayKey();
      return { streak: o.streak | 0, lastDay: o.lastDay || '', doneToday: o.lastDay === today };
    } catch (e) { return { streak: 0, lastDay: '', doneToday: false }; }
  }());
  function saveStreakData(streak, day) {
    try {
      var o = JSON.parse(localStorage.getItem(prefKey('streak')) || '{}');
      o.streak = streak; o.lastDay = day;
      localStorage.setItem(prefKey('streak'), JSON.stringify(o));
    } catch (e) {}
  }
  function updateDailyHint() {
    var el = $('dailyHint');
    if (!el) return;
    if (challengeSeed) {
      el.textContent = '🌟 Challenge: collect ' + dailyGoal + ' stars';
      return;
    }
    var streakStr = streakData.doneToday && streakData.streak >= 2 ? ' (' + streakData.streak + '-day streak)' : '';
    el.textContent = streakData.doneToday
      ? '✅ Daily done' + streakStr
      : '🌟 Today: collect ' + dailyGoal + ' stars';
  }
  function checkDailyOnEnd(runScore) {
    if (!challengeSeed && runScore >= dailyGoal && !streakData.doneToday) {
      var today = getDayKey();
      var d = new Date(); d.setDate(d.getDate() - 1);
      var y = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var yesterday = y.getFullYear() + '-' + ('0' + (y.getMonth() + 1)).slice(-2) + '-' + ('0' + y.getDate()).slice(-2);
      var newStreak = streakData.lastDay === yesterday ? streakData.streak + 1 : 1;
      streakData = { streak: newStreak, lastDay: today, doneToday: true };
      saveStreakData(newStreak, today);
    }
    var el = $('dailyLine');
    if (!el) return;
    if (challengeSeed) { el.textContent = 'Challenge: ' + runScore + '/' + dailyGoal + ' stars'; return; }
    if (streakData.doneToday) {
      el.textContent = streakData.streak >= 3 ? '🔥 ' + streakData.streak + '-day streak!'
        : '✅ Daily done! ' + runScore + '/' + dailyGoal + ' stars';
    } else {
      el.textContent = '🌟 Today: ' + runScore + '/' + dailyGoal + ' stars - keep going!';
    }
    updateDailyHint();
  }
  function loadAch() {
    try { return JSON.parse(localStorage.getItem(prefKey('ach')) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveAch() { try { localStorage.setItem(prefKey('ach'), JSON.stringify(achUnlocked)); } catch (e) {} }
  function isMuted() { try { return localStorage.getItem('jvds_sound') === '0'; } catch (e) { return false; } }
  function setMuted(m) { try { localStorage.setItem('jvds_sound', m ? '0' : '1'); } catch (e) {} }

  var ghostBest = 0;
  function loadGhost() {
    try {
      var g = JSON.parse(localStorage.getItem(prefKey('ghost')) || 'null');
      if (g && Array.isArray(g.path)) { ghostBest = g.score | 0; return g.path.slice(0, GHOST_CAP); }
      return [];
    } catch (e) { return []; }
  }
  function saveGhost(runScore) {
    if (runPath.length < 4) return;
    ghostBest = runScore;
    try {
      localStorage.setItem(prefKey('ghost'), JSON.stringify({ score: runScore, path: runPath.slice(0, GHOST_CAP) }));
    } catch (e) {}
  }

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
        x: starRng() * COLS, y: starRng() * ROWS,
        r: .3 + starRng() * 1.0, a: .12 + starRng() * .5,
        tw: starRng() * Math.PI * 2,
        col: ['#ffffff', '#cbb6ff', '#f6dfa0', '#a78bfa'][i % 4]
      });
    }
  }

  function cellPx(cx, cy) { var s = size / COLS; return { x: cx * s + s / 2, y: cy * s + s / 2 }; }
  function curStep() { return slowTimer > 0 ? Math.round(step * SLOW_FACTOR) : step; }
  function headPow() { return cellPx(snake[0].x, snake[0].y); }
  function headTipPow() {
    var head = snake[0];
    var t = (running && !dead && !paused) ? Math.max(0, Math.min(1, acc / curStep())) : 0;
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

  function buzz(pattern) {
    if (!haptics || reduceMotion) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  function announce(msg) {
    var el = $('srStatus');
    if (el) el.textContent = msg;
  }

  function dirWord(d) {
    if (d.x > 0) return 'right';
    if (d.x < 0) return 'left';
    if (d.y > 0) return 'down';
    return 'up';
  }
  function bearingWord(v) {
    var ax = Math.abs(v.dx), ay = Math.abs(v.dy);
    if (ax > ay * 1.5) return v.dx > 0 ? 'right' : 'left';
    if (ay > ax * 1.5) return v.dy > 0 ? 'down' : 'up';
    return (v.dy > 0 ? 'down' : 'up') + '-' + (v.dx > 0 ? 'right' : 'left');
  }
  function narrate() {
    narrationTick++;
    if (narrationTick % 4 !== 0) return;
    if (!snake || !snake[0]) return;
    var h = snake[0], v = compassVector();
    var star = food ? ' Star is ' + bearingWord(v) + '.' : ' No star left.';
    announce('Head at column ' + (h.x + 1) + ' row ' + (h.y + 1) + ', moving ' + dirWord(dir) + '.' + star);
  }

  function themeForScore(v) { return Math.floor((v || 0) / 10) % THEMES.length; }

  function occupied(x, y) {
    return snake.some(function (s) { return s.x === x && s.y === y; });
  }
  function isRockRaw(x, y) {
    return rocks.some(function (r) { return r.x === x && r.y === y; }) ||
      tempRocks.some(function (r) { return r.x === x && r.y === y; });
  }
  function isRock(x, y) {
    /* Freeze star lets the trail drift straight through rocks for a moment. */
    if (freezeTimer > 0) return false;
    return isRockRaw(x, y);
  }

  function inStartZone(x, y) { return y >= 8 && y <= 12 && x >= 5 && x <= 14; }

  function makeRocks() {
    rocks = []; portals = []; tempRocks = [];
    if (gameMode === 'mission') {
      missionGoal = MISSIONS[missionIdx] ? MISSIONS[missionIdx].goal : 5;
      var layout = missionRocks(missionIdx);
      for (var m = 0; m < layout.length; m++) addRock(layout[m].x, layout[m].y);
      return;
    }
    if (gameMode !== 'nebula') return;
    for (var i = 0; i < 26; i++) {
      var x = 1 + Math.floor(rockRng() * (COLS - 2));
      var y = 1 + Math.floor(rockRng() * (ROWS - 2));
      if (inStartZone(x, y)) continue;
      addRock(x, y);
      addRock(COLS - 1 - x, ROWS - 1 - y);
    }
    rocks = rocks.filter(function (r, idx, arr) {
      return arr.findIndex(function (o) { return o.x === r.x && o.y === r.y; }) === idx;
    });
    makePortals();
  }
  function addRock(x, y) {
    if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return;
    if (inStartZone(x, y)) return;
    rocks.push({ x: x, y: y });
  }

  function missionRocks(i) {
    var out = [];
    function put(x, y) { if (x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1 && !inStartZone(x, y)) out.push({ x: x, y: y }); }
    if (i === 1) {
      for (var x1 = 4; x1 < 16; x1++) { put(x1, 4); put(x1, 15); }
      for (var y1 = 4; y1 < 16; y1++) { put(4, y1); put(15, y1); }
    } else if (i === 2) {
      var corners = [[2, 2], [2, 17], [17, 2], [17, 17]];
      corners.forEach(function (p) {
        for (var d = -1; d <= 1; d++) { put(p[0] + d, p[1]); put(p[0], p[1] + d); }
      });
    } else if (i === 3) {
      for (var d3 = 0; d3 < 18; d3++) put(1 + d3, 18 - d3);
    } else if (i === 4) {
      for (var a = 0; a < 16; a++) { put(2 + a, 2); put(17, 2 + a); put(17 - a, 17); put(2, 17 - a); }
    } else if (i === 5) {
      [4, 9, 15].forEach(function (px) {
        for (var py = 3; py < 17; py++) { if (Math.abs(py - 10) > 2) put(px, py); }
      });
    } else if (i === 6) {
      for (var gx = 3; gx < 18; gx += 4) for (var gy = 3; gy < 18; gy += 4) put(gx, gy);
    } else if (i === 7) {
      for (var r = 0; r < 3; r++) {
        for (var rx = 3 + r * 2; rx < 17 - r * 2; rx++) { put(rx, 3 + r * 3); put(rx, 16 - r * 3); }
      }
    }
    return out;
  }

  function makePortals() {
    var free = [];
    for (var y = 1; y < ROWS - 1; y++) {
      for (var x = 1; x < COLS - 1; x++) {
        if (!isRockRaw(x, y) && !occupied(x, y) && !inStartZone(x, y)) free.push({ x: x, y: y });
      }
    }
    if (free.length < 6) return;
    for (var p = 0; p < 2; p++) {
      var a = free.splice((rockRng() * free.length) | 0, 1)[0];
      var b = free.splice((rockRng() * free.length) | 0, 1)[0];
      if (a && b) portals.push({ a: a, b: b });
    }
  }

  function freeCells() { return COLS * ROWS - rocks.length; }

  function rollFoodType() {
    var r = foodRng();
    var canHazard = score >= POISON_GRACE_SCORE && snake.length > 3 && poisonCooldown <= 0 && freezeTimer <= 0;
    if (r < .20) return 'golden';
    if (r < .28) return 'speed';
    if (r < .35) return 'shield';
    if (r < .42) return 'magnet';
    if (r < .50) return 'ghost';
    if (r < .58) return 'freeze';
    if (r < .66) return 'double';
    if (r < .72) return 'bomb';
    if (canHazard && r < .80) return 'poison';
    return 'normal';
  }

  /* Flood fill from the head so a star can never spawn in a sealed pocket. */
  function openCellsFromHead() {
    var head = snake && snake[0];
    if (!head) return [];
    var seen = {}, q = [head], out = [];
    seen[head.x + ',' + head.y] = 1;
    var wrap = wallWrap || gameMode === 'zen';
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      var c = q.shift();
      for (var k = 0; k < 4; k++) {
        var nx = c.x + dirs[k][0], ny = c.y + dirs[k][1];
        if (wrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
        else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        var key = nx + ',' + ny;
        if (seen[key]) continue;
        seen[key] = 1;
        if (isRockRaw(nx, ny) || isPortal(nx, ny)) continue;
        if (occupied(nx, ny)) continue;
        out.push({ x: nx, y: ny });
        q.push({ x: nx, y: ny });
      }
    }
    return out;
  }

  function placeFood(forceNormal) {
    var open = openCellsFromHead();
    food = open.length ? open[(foodRng() * open.length) | 0] : null;
    foodType = (forceNormal || score < 3 || !food) ? 'normal' : rollFoodType();
  }

  function reset() {
    resetRngs();
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
    snake2 = gameMode === 'duo' ? [{ x: 10, y: 15 }, { x: 11, y: 15 }, { x: 12, y: 15 }] : null;
    dir2 = { x: -1, y: 0 }; nextDir2 = { x: -1, y: 0 };
    score2 = 0; alive2 = true;
    makeRocks();
    score = 0; startStep = SPEEDS[difficulty] || SPEEDS.normal; step = startStep;
    acc = 0; last = 0;
    running = false; dead = false; paused = false; won = false; longest = 3;
    combo = 0; comboTimer = 0; goldenCount = 0; wallDeaths = 0; skipNext = false;
    shields = 0; magnetTimer = 0; slowTimer = 0; poisonCooldown = 0;
    ghostTimer = 0; freezeTimer = 0; doubleTimer = 0;
    eventTimer = 10; eventKind = '';
    timeLeft = gameMode === 'nightfall' ? NIGHTFALL_SECONDS : 0;
    bestCombo = 0; runPath = []; shownTheme = 0;
    flash = 0; deathAnim = 0; trailTimer = 0;
    eatCount = 0; lastEatType = '';
    particles = [];
    if (milestones) milestones.reset();
    if (shake) shake.reset();
    placeFood(true);
    updateCombo(); hud(); setPauseLabel(); showPauseOverlay(false); draw();
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + ('0' + s).slice(-2);
  }

  function hud() {
    $('score').textContent = score;
    $('length').textContent = snake.length;
    $('best').textContent = Math.max(best, score);
    var g = gameMode === 'mission' ? missionGoal : (milestones ? milestones.next() : null);
    $('goal').textContent = g == null ? '∞' : g;
    var tb = $('timeBox'); if (tb) tb.classList.toggle('hidden', gameMode !== 'nightfall');
    var tl = $('timeLeft'); if (tl) tl.textContent = fmtTime(timeLeft);
    var pb = $('p2Box'); if (pb) pb.classList.toggle('hidden', gameMode !== 'duo');
    var ps = $('p2Score'); if (ps) ps.textContent = score2;
    if (storyRun) storyRun.setScore(score);
  }

  function updateCombo() {
    var el = $('combo');
    if (!el) return;
    if (combo >= 2) { el.textContent = 'COMBO x' + combo; el.classList.add('show'); }
    else el.classList.remove('show');
  }

  function setPauseLabel() {
    var b = $('pause');
    if (b) b.textContent = paused ? 'Resume' : 'Pause';
  }

  function showPauseOverlay(on) {
    var o = $('pauseOverlay');
    if (o) o.classList.toggle('hidden', !on);
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

  function maybeThemeToast() {
    var ti = themeForScore(score);
    if (ti !== shownTheme) {
      shownTheme = ti;
      toast('The sky shifts: ' + THEMES[ti].name);
    }
  }

  function compassVector() {
    if (!food || !snake) return { dx: 0, dy: 0, angle: 0 };
    var h = snake[0], dx = food.x - h.x, dy = food.y - h.y;
    if (wallWrap) {
      if (dx > COLS / 2) dx -= COLS;
      if (dx < -COLS / 2) dx += COLS;
      if (dy > ROWS / 2) dy -= ROWS;
      if (dy < -ROWS / 2) dy += ROWS;
    }
    return { dx: dx, dy: dy, angle: Math.atan2(dy, dx) };
  }

  function pullFood() {
    if (!food) return;
    var v = compassVector(), nx = food.x, ny = food.y;
    if (Math.abs(v.dx) >= Math.abs(v.dy) && v.dx !== 0) nx += v.dx > 0 ? -1 : 1;
    else if (v.dy !== 0) ny += v.dy > 0 ? -1 : 1;
    if (wallWrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
    if (occupied(nx, ny) || isRockRaw(nx, ny) || isPortal(nx, ny)) return;
    food = { x: nx, y: ny };
  }

  function isPortal(x, y) {
    return portals.some(function (pr) {
      return (pr.a.x === x && pr.a.y === y) || (pr.b.x === x && pr.b.y === y);
    });
  }

  function findSafeCell() {
    var order = [{ x: 10, y: 10 }];
    for (var r = 1; r < COLS; r++) {
      for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        order.push({ x: 10 + dx, y: 10 + dy });
      }
    }
    for (var i = 0; i < order.length; i++) {
      var c = order[i];
      if (c.x < 0 || c.y < 0 || c.x >= COLS || c.y >= ROWS) continue;
      if (isRockRaw(c.x, c.y) || isPortal(c.x, c.y)) continue;
      return c;
    }
    return { x: 10, y: 10 };
  }

  function shieldHit() {
    shields = Math.max(0, shields - 1);
    var c = findSafeCell();
    var nd = (dir.x === 0 && dir.y === 0) ? { x: 1, y: 0 } : dir;
    var len = Math.max(3, snake.length);
    var ns = [{ x: c.x, y: c.y }];
    for (var i = 1; i < len; i++) {
      ns.push({ x: (c.x - nd.x * i + COLS * len) % COLS, y: (c.y - nd.y * i + ROWS * len) % ROWS });
    }
    snake = ns;
    skipNext = true;
    flash = 1;
    toast('Shield absorbed the crash!');
    announce('Shield saved the trail. ' + shields + ' shields left.');
    buzz([10, 30, 10]);
    try { audio?.playPowerup?.(); } catch (e) {}
  }

  function crash() {
    if (shields > 0) { shieldHit(); return true; }
    return false;
  }

  var loopHandle = null;

  function applyEat(head) {
    eatCount++; lastEatType = foodType;
    if (poisonCooldown > 0) poisonCooldown--;
    var p = cellPx(head.x, head.y);
    if (foodType === 'poison') {
      var remove = Math.min(2, Math.max(0, snake.length - 2));
      if (remove) snake.splice(snake.length - remove, remove);
      skipNext = true;
      poisonCooldown = POISON_COOLDOWN_EATS;
      combo = 0; comboTimer = 0;
      burst(p.x, p.y, '#ff4d6d', reduceMotion ? 4 : 14);
      toast('Dark spark! The trail shrinks.');
      announce('Dark spark. The trail shrank to ' + snake.length + ' segments.');
      buzz(12);
      try { audio?.playError?.(); } catch (e) {}
      placeFood(false);
    } else {
      combo = comboTimer > 0 ? combo + 1 : 1;
      comboTimer = COMBO_WINDOW;
      if (foodType === 'golden') {
        goldenCount++;
        score += 5;
        step = Math.min(startStep, step + GOLDEN_SLOW);
        burst(p.x, p.y, '#ffe9a0', reduceMotion ? 6 : 22);
        toast('Golden star! +5');
        announce('Golden star. ' + score + ' stars.');
        buzz(10);
        try { audio?.playLevelUp?.(); } catch (e) {}
      } else if (foodType === 'speed') {
        score += 1;
        slowTimer = Math.max(slowTimer, 3.5);
        burst(p.x, p.y, '#6fd3ff', reduceMotion ? 6 : 18);
        toast('Slow star! The trail eases for a moment.');
        announce('Slow star. The trail eased.');
        buzz(8);
        try { audio?.playPowerup?.(); } catch (e) {}
      } else if (foodType === 'shield') {
        score += 1;
        shields = Math.min(3, shields + 1);
        burst(p.x, p.y, '#7dffd4', reduceMotion ? 6 : 18);
        toast('Shield star! ' + shields + ' shield' + (shields === 1 ? '' : 's') + '.');
        announce('Shield star. ' + shields + ' shields.');
        buzz(8);
        try { audio?.playPowerup?.(); } catch (e) {}
      } else if (foodType === 'magnet') {
        score += 1;
        magnetTimer = 3;
        burst(p.x, p.y, '#d9a0ff', reduceMotion ? 6 : 18);
        toast('Magnet star! Stars drift closer.');
        announce('Magnet star. Stars drift closer.');
        buzz(8);
        try { audio?.playPowerup?.(); } catch (e) {}
      } else if (foodType === 'ghost') {
        score += 1;
        ghostTimer = GHOST_PASS_SECONDS;
        burst(p.x, p.y, '#9d8ec9', reduceMotion ? 6 : 18);
        toast('Ghost star! Slip through your own trail.');
        announce('Ghost star. You can pass through your trail for a moment.');
        buzz(8);
        try { audio?.playPowerup?.(); } catch (e) {}
      } else if (foodType === 'freeze') {
        score += 1;
        freezeTimer = FREEZE_SECONDS;
        burst(p.x, p.y, '#bfeaff', reduceMotion ? 6 : 18);
        toast('Freeze star! Rocks and hazards pause.');
        announce('Freeze star. Rocks and hazards pause.');
        buzz(8);
        try { audio?.playPowerup?.(); } catch (e) {}
      } else if (foodType === 'double') {
        score += 1;
        doubleTimer = DOUBLE_SECONDS;
        burst(p.x, p.y, '#ffd24a', reduceMotion ? 6 : 18);
        toast('Double star! Normal stars score twice.');
        announce('Double star. Normal stars score twice.');
        buzz(8);
        try { audio?.playPowerup?.(); } catch (e) {}
      } else if (foodType === 'bomb') {
        score += 1;
        var before = rocks.length;
        rocks = rocks.filter(function (r) { return Math.abs(r.x - head.x) + Math.abs(r.y - head.y) > 2; });
        tempRocks = tempRocks.filter(function (r) { return Math.abs(r.x - head.x) + Math.abs(r.y - head.y) > 2; });
        burst(p.x, p.y, '#ff7a3c', reduceMotion ? 8 : 26);
        toast(before > rocks.length ? 'Bomb star! Rocks cleared.' : 'Bomb star!');
        announce('Bomb star. ' + (before - rocks.length) + ' rocks cleared.');
        buzz(12);
        try { audio?.playPowerup?.(); } catch (e) {}
      } else {
        score += (combo >= 3 ? 2 : 1) * (doubleTimer > 0 ? 2 : 1);
        step = Math.max(MIN_STEP, step - STEP_GAIN);
        try { audio?.playPop?.(); } catch (e) {}
        burst(p.x, p.y, '#ffd24a', reduceMotion ? 4 : 12);
        if (!reduceMotion) burst(p.x, p.y, '#a78bfa', 6);
      }
      longest = Math.max(longest, snake.length);
      bestCombo = Math.max(bestCombo, combo);
      if (milestones) milestones.check(score);
      maybeThemeToast();
      placeFood(false);
      /* Persist a new best immediately so closing the tab mid-run keeps it. */
      if (score > best) { best = score; saveBest(); }
      if (score >= 1) announce('Star. ' + score + ' of ' + (milestones && milestones.next() != null ? milestones.next() : 'endless') + '.');
    }
    if (eatCount === 1 && tutStep < 2) {
      tutStep = 2; savePref('tut', 2);
      setTimeout(function () { toast('Nice! Collect stars quickly to chain a combo.'); }, 900);
    }
    if (eatCount === 3 && tutStep < 3) {
      tutStep = 3; savePref('tut', 3);
      setTimeout(function () { toast('Glowing stars are special. Dark sparks shrink your trail.'); }, 900);
    }
    updateCombo();
    checkAchievements();
    if (gameMode === 'mission' && score >= missionGoal) { end('win'); return; }
    /* A win is only real when the board has no free cell left for a star. */
    if (!food && snake.length >= freeCells()) { end('win'); return; }
  }

  function tick() {
    if (skipNext) { skipNext = false; return; }
    dir = nextDir;
    if (magnetTimer > 0) pullFood();
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    var wrap = wallWrap || gameMode === 'zen';
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
      if (wrap) { head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS; }
      else {
        if (crash()) return;
        wallDeaths++;
        return end('wall');
      }
    }
    /* Wormholes: step into one mouth, come out at its twin. */
    for (var pi = 0; pi < portals.length; pi++) {
      var pr = portals[pi];
      if (head.x === pr.a.x && head.y === pr.a.y) { head = { x: pr.b.x, y: pr.b.y }; toast('Wormhole!'); break; }
      if (head.x === pr.b.x && head.y === pr.b.y) { head = { x: pr.a.x, y: pr.a.y }; toast('Wormhole!'); break; }
    }
    if (gameMode !== 'zen' && isRock(head.x, head.y)) {
      if (crash()) return;
      return end('rock');
    }
    var ate = food && head.x === food.x && head.y === food.y;
    var grow = ate && foodType !== 'poison';
    var body = grow ? snake : snake.slice(0, snake.length - 1);
    var selfHit = body.some(function (s) { return s.x === head.x && s.y === head.y; });
    if (selfHit && gameMode !== 'zen' && ghostTimer <= 0) {
      if (crash()) return;
      return end('self');
    }
    snake.unshift(head);
    if (ate) { applyEat(head); if (dead || won) return; }
    else snake.pop();
    /* Player two (Duo mode) runs its own trail and score. */
    if (gameMode === 'duo' && snake2 && alive2) {
      dir2 = nextDir2;
      var h2 = { x: snake2[0].x + dir2.x, y: snake2[0].y + dir2.y };
      if (h2.x < 0 || h2.y < 0 || h2.x >= COLS || h2.y >= ROWS) {
        if (wallWrap) { h2.x = (h2.x + COLS) % COLS; h2.y = (h2.y + ROWS) % ROWS; }
        else { alive2 = false; toast('Player 2 is out!'); }
      }
      if (alive2 && isRockRaw(h2.x, h2.y)) { alive2 = false; toast('Player 2 hit a rock!'); }
      if (alive2) {
        var body2 = snake2.slice(0, snake2.length - 1);
        if (body2.some(function (s) { return s.x === h2.x && s.y === h2.y; })) {
          alive2 = false; toast('Player 2 crashed!');
        }
      }
      if (alive2) {
        var ate2 = food && h2.x === food.x && h2.y === food.y;
        snake2.unshift(h2);
        if (ate2) { score2 += 1; placeFood(false); }
        else snake2.pop();
        if (snake2.length > 60) snake2.pop();
      }
    }
    if (runPath.length === 0 || runPath[runPath.length - 1].x !== head.x || runPath[runPath.length - 1].y !== head.y) {
      runPath.push({ x: head.x, y: head.y });
      if (runPath.length > GHOST_CAP) runPath.shift();
    }
    if (a11y) narrate();
    hud();
  }

  function loop(ts) {
    loopHandle = requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = ts - last;
    last = ts;
    if (running && !dead && !paused && gameMode === 'nightfall') {
      timeLeft -= dt / 1000;
      if (timeLeft <= 0) { timeLeft = 0; end('time'); }
      var tl = $('timeLeft');
      if (tl) tl.textContent = fmtTime(timeLeft);
    }
    if (running && !dead && !paused) {
      acc += dt;
      while (acc >= curStep()) { acc -= curStep(); tick(); if (dead || won) break; }
      resumeTick += dt;
      if (resumeTick >= 2000) { resumeTick = 0; saveResume(); }
    }
    updateEffects(Math.min(dt, 100) / 1000);
    draw(ts);
  }

  function updateEffects(dt) {
    var active = running && !dead && !paused;
    if (active && !reduceMotion) {
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
        if (hasCosmetic('sparkle-trail')) {
          particles.push({
            x: hp.x + (Math.random() - .5) * 10, y: hp.y + (Math.random() - .5) * 10,
            vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60,
            life: .8, color: '#ffe9a0', size: 1 + Math.random() * 2.5
          });
        }
      }
    }
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.8;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 520) particles.splice(0, particles.length - 520);
    if (tempRocks.length) {
      var now = performance.now();
      tempRocks = tempRocks.filter(function (r) { return (r.until || 0) > now; });
    }
    /* Power-up timers only tick during live play, so pausing is a true pause. */
    if (active) {
      if (comboTimer > 0) {
        comboTimer -= dt * 1000;
        if (comboTimer <= 0 && combo > 1) { combo = 0; updateCombo(); }
      }
      if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt);
      if (slowTimer > 0) slowTimer = Math.max(0, slowTimer - dt);
      if (ghostTimer > 0) ghostTimer = Math.max(0, ghostTimer - dt);
      if (freezeTimer > 0) freezeTimer = Math.max(0, freezeTimer - dt);
      if (doubleTimer > 0) doubleTimer = Math.max(0, doubleTimer - dt);
      maybeSkyEvent(dt);
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    if (deathAnim > 0) deathAnim = Math.max(0, deathAnim - dt * 2.2);
    if (shake) shake.decay();
  }

  /* Sky events: meteors drop temporary blocked cells; aurora adds a bonus star. */
  function maybeSkyEvent(dt) {
    if (freezeTimer > 0) return;
    if (gameMode !== 'classic' && gameMode !== 'nebula') return;
    if (score < 12) return;
    eventTimer -= dt;
    if (eventTimer > 0) return;
    eventTimer = 13 + Math.random() * 6;
    if (Math.random() < 0.5) {
      eventKind = 'meteor';
      toast('Meteor shower! Temporary rocks fall.');
      var until = performance.now() + 6000;
      for (var i = 0; i < 5; i++) {
        var rx = 1 + Math.floor(Math.random() * (COLS - 2));
        var ry = 1 + Math.floor(Math.random() * (ROWS - 2));
        if (occupied(rx, ry) || isRockRaw(rx, ry) || (Math.abs(rx - snake[0].x) + Math.abs(ry - snake[0].y) <= 1)) continue;
        tempRocks.push({ x: rx, y: ry, until: until });
      }
      burst(headPow().x, headPow().y, '#ff7a3c', reduceMotion ? 8 : 24);
      buzz(18);
    } else {
      eventKind = 'aurora';
      toast('Aurora wind: a bonus golden star appears.');
      placeFood(false);
      foodType = 'golden';
      burst(headPow().x, headPow().y, '#7dffd4', reduceMotion ? 8 : 22);
      buzz(8);
    }
  }

  function resize() {
    var stage = C.parentElement;
    var w = stage.clientWidth - 16, h = stage.clientHeight - 16;
    var side = Math.max(160, Math.min(w, h));
    if (side === size) return;
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
    var th = THEMES[themeForScore(score)] || THEMES[0];

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (shake && !reduceMotion) shake.apply(ctx, 1);
    if (deathAnim > 0 && !reduceMotion) {
      var z = 1 + 0.12 * deathAnim;
      ctx.translate(size / 2, size / 2); ctx.scale(z, z); ctx.translate(-size / 2, -size / 2);
    }

    if (highContrast) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    } else {
      var bg = ctx.createRadialGradient(size / 2, size * .38, size * .1, size / 2, size * .5, size * .8);
      bg.addColorStop(0, th.a); bg.addColorStop(.5, th.b); bg.addColorStop(1, th.c);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
    }

    ctx.strokeStyle = highContrast ? 'rgba(255,255,255,.22)' : th.grid; ctx.lineWidth = 1;
    for (var i = 1; i < COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(size, i * s); ctx.stroke();
    }

    for (var k = 0; k < stars.length; k++) {
      var st = stars[k];
      ctx.globalAlpha = highContrast ? st.a : st.a * (0.55 + 0.45 * Math.sin(t * 1.4 + st.tw));
      ctx.fillStyle = st.col;
      ctx.beginPath(); ctx.arc(st.x * s, st.y * s, st.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* Star rain cosmetic: a few slow falling sparks across the sky. */
    if (hasCosmetic('star-rain')) {
      ctx.save();
      ctx.fillStyle = '#ffe9a0';
      for (var sr = 0; sr < 14; sr++) {
        var sx = ((sr * 137.5 + t * 14) % size);
        var sy = ((sr * 91.7 + t * 40) % size);
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + sr);
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    var hd = snake[0];
    var edge = Math.min(hd.x, hd.y, COLS - 1 - hd.x, ROWS - 1 - hd.y);
    if (running && !wallWrap && edge <= 1) {
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.18 * Math.sin(t * 8);
      ctx.strokeStyle = '#E8A800'; ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, size - 8, size - 8);
      ctx.restore();
    }

    drawRocks(s);
    drawTempRocks(s);
    drawPortals(s, t);
    drawGhost(s);
    drawFood(t, s);
    drawTrail(s);
    if (gameMode === 'duo' && snake2) drawTrail2(s);
    drawParticles();
    drawGhostRace(s);
    drawCompass(s);

    if (freezeTimer > 0) {
      ctx.fillStyle = 'rgba(191,234,255,' + (0.05 + 0.03 * Math.sin(t * 6)) + ')';
      ctx.fillRect(0, 0, size, size);
    }

    if (flash > 0) {
      var fg = ctx.createRadialGradient(size / 2, size / 2, size * .2, size / 2, size / 2, size * .78);
      fg.addColorStop(0, 'rgba(232,168,0,0)');
      fg.addColorStop(1, 'rgba(232,168,0,' + (0.35 * flash) + ')');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, size, size);
    }
    if (deathAnim > 0) { ctx.fillStyle = 'rgba(3,1,15,' + (0.55 * deathAnim) + ')'; ctx.fillRect(0, 0, size, size); }
    ctx.restore();
  }

  function drawRocks(s) {
    for (var i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      var x = r.x * s + s / 2, y = r.y * s + s / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(120,90,200,.34)';
      ctx.shadowColor = '#6b4bb0'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, s * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(200,182,255,.34)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, s * 0.46, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawTempRocks(s) {
    for (var i = 0; i < tempRocks.length; i++) {
      var r = tempRocks[i];
      var x = r.x * s + s / 2, y = r.y * s + s / 2;
      ctx.save();
      ctx.globalAlpha = .85;
      ctx.fillStyle = 'rgba(255,122,60,.55)';
      ctx.shadowColor = '#ff7a3c'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawPortals(s, t) {
    if (!portals.length) return;
    for (var i = 0; i < portals.length; i++) {
      var pr = portals[i];
      [pr.a, pr.b].forEach(function (p, idx) {
        var x = p.x * s + s / 2, y = p.y * s + s / 2;
        ctx.save();
        ctx.globalAlpha = .55 + .25 * Math.sin(t * 3 + i + idx);
        ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, s * 0.34, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#7dffd4'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, s * 0.2, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
    }
  }

  function drawTrail2(s) {
    if (!snake2 || !snake2.length) return;
    var pts = [];
    for (var i = 0; i < snake2.length; i++) pts.push({ x: snake2[i].x * s + s / 2, y: snake2[i].y * s + s / 2 });
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalAlpha = alive2 ? 1 : .35;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.strokeStyle = 'rgba(125,255,212,.25)'; ctx.lineWidth = s * 0.9; ctx.stroke();
    ctx.strokeStyle = '#7dffd4'; ctx.lineWidth = s * 0.62; ctx.stroke();
    ctx.fillStyle = '#d4fff2';
    ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGhostRace(s) {
    if (!ghostRace || !ghostPath.length) return;
    var idx = Math.min(ghostPath.length - 1, runPath.length);
    var g = ghostPath[Math.max(0, idx)];
    if (!g) return;
    var x = g.x * s + s / 2, y = g.y * s + s / 2;
    ctx.save();
    ctx.globalAlpha = .85;
    ctx.strokeStyle = '#c8b6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(200,182,255,.3)';
    ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGhost(s) {
    if (!ghostPath.length) return;
    ctx.save();
    ctx.globalAlpha = .16;
    ctx.fillStyle = '#c8b6ff';
    for (var i = 0; i < ghostPath.length; i++) {
      var g = ghostPath[i];
      ctx.beginPath(); ctx.arc(g.x * s + s / 2, g.y * s + s / 2, Math.max(1, s * 0.13), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawCompass(s) {
    if (!food || !running || dead) return;
    var v = compassVector();
    var cx = size - s * 1.7, cy = s * 1.7, r = s * 1.05;
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(3,1,15,.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(232,168,0,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.translate(cx, cy); ctx.rotate(v.angle);
    ctx.beginPath(); ctx.moveTo(r * .72, 0); ctx.lineTo(-r * .42, -r * .42); ctx.lineTo(-r * .42, r * .42); ctx.closePath();
    ctx.fillStyle = '#ffd24a'; ctx.fill();
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
    } else if (foodType === 'speed') {
      ctx.rotate(-t * 1.6);
      ctx.shadowColor = '#6fd3ff'; ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#bfeaff';
      starPath(0, 0, 4, s * 0.40 * pulse, s * 0.15 * pulse); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (foodType === 'shield') {
      ctx.shadowColor = '#7dffd4'; ctx.shadowBlur = 16 * pulse;
      ctx.strokeStyle = '#7dffd4'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.36 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(125,255,212,.35)';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.24 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (foodType === 'magnet') {
      ctx.rotate(t * 1.4);
      ctx.shadowColor = '#d9a0ff'; ctx.shadowBlur = 16 * pulse;
      ctx.strokeStyle = '#e3c4ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.3 * pulse, Math.PI * .15, Math.PI * .85); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.3 * pulse, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (foodType === 'ghost') {
      ctx.rotate(t * 1.2);
      ctx.shadowColor = '#9d8ec9'; ctx.shadowBlur = 16 * pulse;
      ctx.strokeStyle = '#c8b6ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.33 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = .55; ctx.fillStyle = '#9d8ec9';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.22 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    } else if (foodType === 'freeze') {
      ctx.rotate(t * 0.9);
      ctx.shadowColor = '#bfeaff'; ctx.shadowBlur = 16 * pulse;
      ctx.strokeStyle = '#bfeaff'; ctx.lineWidth = 2.5;
      for (var fs = 0; fs < 3; fs++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.38 * pulse); ctx.lineTo(0, s * 0.38 * pulse); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    } else if (foodType === 'double') {
      ctx.rotate(-t * 0.8);
      ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = '#ffe9a0';
      starPath(0, -s * 0.16, 5, s * 0.28 * pulse, s * 0.13 * pulse); ctx.fill();
      starPath(0, s * 0.16, 5, s * 0.28 * pulse, s * 0.13 * pulse); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (foodType === 'bomb') {
      ctx.shadowColor = '#ff7a3c'; ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#ff7a3c';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.3 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath(); ctx.arc(0, -s * 0.34 * pulse, s * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
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
    var wf = largeCells ? 1.25 : 1;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    var head = snake[0];
    var t = (running && !dead && !paused) ? Math.max(0, Math.min(1, acc / curStep())) : 0;
    var nx = head.x + dir.x, ny = head.y + dir.y;
    var leadOK = nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS;

    var pts = [{ x: (head.x + (leadOK ? dir.x * t : 0)) * s + s / 2, y: (head.y + (leadOK ? dir.y * t : 0)) * s + s / 2 }];
    for (var i = 1; i < snake.length; i++) pts.push({ x: snake[i].x * s + s / 2, y: snake[i].y * s + s / 2 });

    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.strokeStyle = 'rgba(' + pal.glow + ',' + (0.18 + 0.22 * glow) + ')';
    ctx.lineWidth = s * 0.96 * wf; ctx.stroke();

    var g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.addColorStop(0, pal.head); g.addColorStop(.45, pal.mid); g.addColorStop(1, pal.tail);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var m = 1; m < pts.length; m++) ctx.lineTo(pts[m].x, pts[m].y);
    ctx.strokeStyle = g; ctx.lineWidth = s * 0.66 * (1 + 0.05 * glow) * wf; ctx.stroke();

    if (hasCosmetic('comet-head')) {
      for (var ci = 1; ci <= 3; ci++) {
        ctx.globalAlpha = 0.35 / ci;
        ctx.fillStyle = pal.head;
        ctx.beginPath();
        ctx.arc(pts[0].x - dir.x * s * 0.3 * ci, pts[0].y - dir.y * s * 0.3 * ci, (s * 0.3) / ci, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = ghostTimer > 0 ? 0.55 : 1;
    ctx.shadowColor = pal.mid; ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, s * 0.44 * wf, 0, Math.PI * 2);
    ctx.fillStyle = pal.head; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (shields > 0 && !reduceMotion) {
      ctx.globalAlpha = .35 + .25 * Math.sin(performance.now() / 200);
      ctx.strokeStyle = '#7dffd4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, s * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
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
    if (nextDir.x === -x && nextDir.y === -y) return;
    if (nextDir.x === x && nextDir.y === y) return;
    nextDir = { x: x, y: y };
    try { audio?.playTap?.(720); } catch (e) {}
  }

  function setDir2(x, y) {
    if (!running || dead || paused || !alive2) return;
    if (dir2.x === -x && dir2.y === -y) return;
    if (nextDir2.x === -x && nextDir2.y === -y) return;
    if (nextDir2.x === x && nextDir2.y === y) return;
    nextDir2 = { x: x, y: y };
  }

  function applyModeUi() {
    var d2 = $('dpad2');
    if (d2) d2.classList.toggle('hidden', gameMode !== 'duo');
    var d1 = $('dpad');
    if (d1) d1.classList.toggle('p1-duo', gameMode === 'duo');
  }

  function startGame() {
    var oldModal = document.querySelector('.sr-modal.show');
    if (oldModal) oldModal.remove();
    clearResume();
    reset();
    running = true; dead = false; paused = false;
    $('startScreen').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    showPauseOverlay(false);
    applyModeUi();
    if (sys && sys.beginRun) sys.beginRun();
    if (storyRun && !storyRun.running) storyRun.begin();
    if (musicOn && !isMuted()) music.start();
    toast(BEATS[0].text);
    announce('Run started. Guide the stardust trail into the stars.');
    if (tutStep < 1) {
      tutStep = 1; savePref('tut', 1);
      setTimeout(function () { toast('Steer with the arrow keys, swipe or the D-pad.'); }, 1200);
    }
    last = 0; acc = 0;
    setPauseLabel();
    draw();
  }

  function echoLine() {
    if (wallDeaths > 0) return 'Echo says: watch the glow at the edge and turn one cell earlier.';
    if (bestCombo < 3) return 'Echo says: collect stars quickly to build a combo.';
    if (longest < 12) return 'Echo says: every star makes the trail stronger. Keep growing.';
    return 'Echo says: try a longer constellation, then beat your best next run.';
  }

  function end(reason) {
    if (dead || won) return;
    if (reason === 'win') won = true;
    dead = true; running = false;
    clearResume();
    music.stop();
    if (shake && !reduceMotion) shake.hit(16);
    deathAnim = reduceMotion ? 0 : 1;
    if (!reduceMotion) burst(headPow().x, headPow().y, '#a78bfa', 30);
    if (reason === 'win') {
      flash = 1;
      if (gameMode === 'mission') {
        missionIdx = (missionIdx + 1) % MISSIONS.length;
        savePref('mission', missionIdx);
        toast('Constellation complete! Next: ' + MISSIONS[missionIdx].name);
      } else {
        toast('Every star is home. The sky is complete!');
      }
      try { audio?.playLevelUp?.(); } catch (e) {}
    } else if (reason === 'time') {
      toast('Nightfall! Time is up.');
      try { audio?.playLevelUp?.(); } catch (e) {}
    } else {
      try { audio?.playError?.(); } catch (e) {}
      buzz([12, 40, 18]);
    }
    checkAchievements();
    var newBest = score > best;
    if (newBest) best = score;
    saveBest();
    /* A mid-run best update makes score === best at the end, so save the ghost too. */
    if (newBest || score === best) saveGhost(score);
    if (gameMode !== 'zen') { dust += score; savePref('dust', dust); }
    if (sys && sys.saveState) { try { sys.saveState(); } catch (e) {} }
    checkDailyOnEnd(score);
    buildPalettePills();
    hud();
    announce('Run over. ' + score + ' stars. Longest trail ' + longest + '.');
    var outcome = (reason === 'win' || score >= 18) ? 'success' : score >= 5 ? 'partial' : 'fail';
    if (storyRun) {
      storyRun.finish(outcome, score);
      setTimeout(function () {
        var t = document.querySelector('.sr-modal.show .sr-again') || document.querySelector('.sr-modal.show .sr-modal-card');
        if (t && t.focus) { try { t.focus(); } catch (e) {} }
      }, 80);
    } else {
      $('endTitle').textContent = reason === 'win' ? 'The sky is complete' : reason === 'time' ? 'Nightfall falls' : 'Your constellation faded';
      $('endLine').textContent = reason === 'win'
        ? 'Every fallen star is back in the sky. Stardust sets your trail among them.'
        : reason === 'time'
          ? 'The sky goes dark on a run well played. Your best is safe and the stars will return.'
          : 'Stardust gathers the light back up. Try a longer trail next time.';
      renderEndSummary();
      $('endScreen').classList.remove('hidden');
      setTimeout(function () { var t = $('endTitle'); if (t) { try { t.focus(); } catch (e) {} } }, 80);
    }
  }

  function summaryRow(label, value) {
    var d = document.createElement('div');
    var s = document.createElement('span'); s.textContent = label;
    var b = document.createElement('b'); b.textContent = value;
    d.appendChild(s); d.appendChild(b);
    return d;
  }

  function renderSummaryInto(host) {
    host.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'sr-summary-stats';
    wrap.appendChild(summaryRow('Stars', String(score)));
    wrap.appendChild(summaryRow('Longest trail', String(longest)));
    wrap.appendChild(summaryRow('Best combo', 'x' + Math.min(Math.max(bestCombo, 1), 9)));
    wrap.appendChild(summaryRow('Sky', THEMES[themeForScore(score)].name));
    var echo = document.createElement('p');
    echo.className = 'sr-summary-echo';
    echo.textContent = echoLine();
    host.appendChild(echo);
    host.appendChild(wrap);
  }

  function addRunSummary() {
    var card = document.querySelector('.sr-modal.show .sr-modal-card');
    if (!card || card.querySelector('.sr-summary')) return;
    var box = document.createElement('div');
    box.className = 'sr-summary';
    renderSummaryInto(box);
    var anchor = card.querySelector('.sr-stats');
    if (anchor && anchor.nextSibling) card.insertBefore(box, anchor.nextSibling);
    else card.appendChild(box);
  }

  function renderEndSummary() {
    var host = $('endSummary');
    if (!host) return;
    renderSummaryInto(host);
  }

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
    /* Draw the player's real route, not a random constellation. */
    g.strokeStyle = '#E8A800'; g.lineWidth = 4; g.lineCap = 'round';
    var path = (runPath && runPath.length > 1) ? runPath : (snake || []);
    var px = 210, py = 360;
    if (path.length > 1) {
      g.beginPath();
      for (var s = 0; s < path.length; s++) {
        px = 90 + (path[s].x / (COLS - 1)) * 720;
        py = 160 + (path[s].y / (ROWS - 1)) * 400;
        if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
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

  function updateDiffPills() {
    var pills = document.querySelectorAll('#diffPills .pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle('active', pills[i].getAttribute('data-diff') === difficulty);
  }

  function updateModePills() {
    var pills = document.querySelectorAll('#modePills .pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle('active', pills[i].getAttribute('data-mode') === gameMode);
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

  function updateA11y() {
    var b = $('a11yToggle');
    if (b) { b.setAttribute('aria-pressed', String(a11y)); b.classList.toggle('active', a11y); }
    var box = $('a11yBox');
    if (box) box.checked = a11y;
  }

  function updateHaptics() {
    var box = $('hapticsBox');
    if (box) box.checked = haptics;
  }

  function prettyKey(k) {
    if (!k) return '?';
    if (k.indexOf('arrow') === 0) return k.replace('arrow', '').toUpperCase();
    return k.toUpperCase();
  }
  function updateKeyPanel() {
    var names = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
    var btns = document.querySelectorAll('#keyPanel [data-bind]');
    for (var i = 0; i < btns.length; i++) {
      var d = btns[i].getAttribute('data-bind');
      btns[i].textContent = names[d] + ': ' + prettyKey(keyMap[d]);
      btns[i].classList.toggle('listening', bindTarget === d);
    }
  }

  function updateOptionBoxes() {
    var gc = $('ghostRaceBox'); if (gc) gc.checked = ghostRace;
    var hc = $('hcBox'); if (hc) hc.checked = highContrast;
    var lg = $('largeBox'); if (lg) lg.checked = largeCells;
    var mv = $('musicVol'); if (mv) mv.value = String(musicVol);
    var mb = $('musicBtn');
    if (mb) {
      mb.textContent = musicOn ? 'On' : 'Off';
      mb.setAttribute('aria-pressed', String(musicOn));
      mb.setAttribute('aria-label', musicOn ? 'Turn music off' : 'Turn music on');
    }
    document.body.classList.toggle('hc', highContrast);
  }

  function shareLink() {
    return location.origin + location.pathname + '?seed=' + encodeURIComponent(activeSeed) + '&goal=' + dailyGoal;
  }

  function copyShare() {
    var link = shareLink();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(
          function () { toast('Challenge link copied!'); },
          function () { try { window.prompt('Copy this challenge link', link); } catch (e) {} }
        );
        return;
      }
    } catch (e) {}
    try { window.prompt('Copy this challenge link', link); } catch (e) { toast('Challenge link ready'); }
  }

  function openStarMap() {
    buildStarMap();
    var m = $('starMap');
    if (m) { m.classList.remove('hidden'); m.setAttribute('aria-hidden', 'false'); }
  }
  function closeStarMap() {
    var m = $('starMap');
    if (m) { m.classList.add('hidden'); m.setAttribute('aria-hidden', 'true'); }
  }
  function buyCosmetic(id) {
    var item = null;
    for (var i = 0; i < SHOP.length; i++) if (SHOP[i].id === id) item = SHOP[i];
    if (!item || hasCosmetic(id)) return;
    if (dust < item.cost) { toast('Not enough stardust yet.'); return; }
    dust -= item.cost;
    owned[id] = true;
    saveOwned();
    savePref('dust', dust);
    toast('Unlocked ' + item.name + '!');
    buildStarMap();
  }
  function starRow(label, value, cls) {
    var row = document.createElement('div'); row.className = 'sm-row';
    var l = document.createElement('span'); l.textContent = label;
    var r = document.createElement('span'); r.className = cls || ''; r.textContent = value;
    row.appendChild(l); row.appendChild(r);
    return row;
  }
  function buildStarMap() {
    var sum = $('smSummary');
    if (sum) sum.textContent = 'Best ' + best + ' stars · ' + dust + ' stardust · ' + (streakData.streak || 0) + '-day streak';
    var ach = $('smAch');
    if (ach) {
      ach.innerHTML = '';
      for (var i = 0; i < ACH.length; i++) {
        var got = !!achUnlocked[ACH[i].id];
        ach.appendChild(starRow(ACH[i].name, got ? 'Unlocked' : 'Locked', got ? 'on' : 'off'));
      }
    }
    var mis = $('smMissions');
    if (mis) {
      mis.innerHTML = '';
      for (var m = 0; m < MISSIONS.length; m++) {
        var done = m < missionIdx;
        mis.appendChild(starRow((m + 1) + '. ' + MISSIONS[m].name, m === missionIdx ? 'Next' : (done ? 'Cleared' : MISSIONS[m].goal + ' stars'), done ? 'on' : (m === missionIdx ? '' : 'off')));
      }
    }
    var shop = $('smShop');
    if (shop) {
      shop.innerHTML = '';
      for (var s = 0; s < SHOP.length; s++) {
        var item = SHOP[s];
        var row = document.createElement('div'); row.className = 'sm-row';
        var left = document.createElement('span'); left.textContent = item.name + ': ' + item.desc;
        var right = document.createElement('span');
        if (hasCosmetic(item.id)) {
          right.className = 'on'; right.textContent = 'Owned';
        } else {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = item.cost + ' ✦';
          b.disabled = dust < item.cost;
          b.addEventListener('click', (function (cid) { return function () { buyCosmetic(cid); }; })(item.id));
          right.appendChild(b);
        }
        row.appendChild(left); row.appendChild(right);
        shop.appendChild(row);
      }
    }
  }

  function shareScore() {
    var text = 'I collected ' + score + ' stars in Stardust Snake' + (gameMode === 'mission' ? ' (Mission)' : '') + '. Can you beat it?';
    var url = location.origin + location.pathname;
    try {
      if (navigator.share) {
        navigator.share({ title: 'Stardust Snake', text: text, url: url }).catch(function () {});
        return;
      }
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text + ' ' + url).then(
          function () { toast('Score copied!'); },
          function () { toast('Score ready to share'); }
        );
        return;
      }
    } catch (e) {}
    try { window.prompt('Copy your score', text + ' ' + url); } catch (e) {}
  }

  function doResume() {
    if (!resumeState) return;
    var s = resumeState;
    clearResume();
    gameMode = s.mode || 'classic';
    difficulty = s.difficulty || 'normal';
    savePref('mode', gameMode); savePref('diff', difficulty);
    reset();
    snake = s.snake;
    dir = s.dir || { x: 1, y: 0 }; nextDir = dir;
    food = s.food; foodType = s.foodType || 'normal';
    score = s.score | 0; shields = s.shields | 0; step = s.step || startStep; longest = s.longest || snake.length;
    snake2 = s.snake2 || null; score2 = s.score2 | 0;
    timeLeft = s.timeLeft || 0;
    if (s.timers) { ghostTimer = s.timers.ghost || 0; freezeTimer = s.timers.freeze || 0; doubleTimer = s.timers.double || 0; }
    running = true; dead = false; paused = false; won = false;
    $('startScreen').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    applyModeUi(); updateModePills(); updateDiffPills();
    if (musicOn && !isMuted()) music.start();
    announce('Run resumed. ' + score + ' stars.');
    last = 0; acc = 0;
    draw();
  }

  function resumeGame() {
    if (pauseCtl && pauseCtl.paused) pauseCtl.resume();
    else { paused = false; showPauseOverlay(false); setPauseLabel(); }
  }

  function togglePause() {
    if (!running || dead) return;
    if (pauseCtl) pauseCtl.toggle();
    else { paused = !paused; showPauseOverlay(paused); setPauseLabel(); }
  }

  document.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    var active = document.activeElement;
    var tag = active && active.tagName;
    var onControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT';
    var isPlayControl = active && (active.id === 'playBtn' || active.id === 'againBtn' || active.classList.contains('sr-again'));
    if (bindTarget) {
      e.preventDefault();
      keyMap[bindTarget] = k;
      saveKeys();
      var label = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' }[bindTarget];
      bindTarget = '';
      updateKeyPanel();
      toast(label + ' set to ' + e.key);
      return;
    }
    if (k === 'enter' || k === ' ' || k === 'spacebar') {
      if (isPlayControl) return;
      if (k !== 'enter' && onControl) return;
      e.preventDefault();
      if (paused) { resumeGame(); return; }
      if (!running || dead || won) { startGame(); return; }
      return;
    }
    if (k === 'p' || k === 'escape') { e.preventDefault(); togglePause(); return; }
    var wasd = { up: 'w', down: 's', left: 'a', right: 'd' };
    if (gameMode === 'duo') {
      if (k === 'arrowup') { setDir(0, -1); e.preventDefault(); }
      else if (k === 'arrowdown') { setDir(0, 1); e.preventDefault(); }
      else if (k === 'arrowleft') { setDir(-1, 0); e.preventDefault(); }
      else if (k === 'arrowright') { setDir(1, 0); e.preventDefault(); }
      else if (k === 'w') { setDir2(0, -1); e.preventDefault(); }
      else if (k === 's') { setDir2(0, 1); e.preventDefault(); }
      else if (k === 'a') { setDir2(-1, 0); e.preventDefault(); }
      else if (k === 'd') { setDir2(1, 0); e.preventDefault(); }
      return;
    }
    if (k === keyMap.up || k === wasd.up) { setDir(0, -1); e.preventDefault(); }
    else if (k === keyMap.down || k === wasd.down) { setDir(0, 1); e.preventDefault(); }
    else if (k === keyMap.left || k === wasd.left) { setDir(-1, 0); e.preventDefault(); }
    else if (k === keyMap.right || k === wasd.right) { setDir(1, 0); e.preventDefault(); }
  });

  $('dUp').addEventListener('click', function () { setDir(0, -1); });
  $('dDown').addEventListener('click', function () { setDir(0, 1); });
  $('dLeft').addEventListener('click', function () { setDir(-1, 0); });
  $('dRight').addEventListener('click', function () { setDir(1, 0); });

  if ($('d2Up')) $('d2Up').addEventListener('click', function () { setDir2(0, -1); });
  if ($('d2Down')) $('d2Down').addEventListener('click', function () { setDir2(0, 1); });
  if ($('d2Left')) $('d2Left').addEventListener('click', function () { setDir2(-1, 0); });
  if ($('d2Right')) $('d2Right').addEventListener('click', function () { setDir2(1, 0); });

  var touchStart = null;
  C.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  C.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    /* A firm 26px dead-zone plus a diagonal lock stops accidental turns. */
    if (Math.max(ax, ay) < 26) { touchStart = null; return; }
    if (Math.min(ax, ay) > Math.max(ax, ay) * 0.85) { touchStart = null; return; }
    if (ax > ay) setDir(dx > 0 ? 1 : -1, 0);
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

  var modeRow = $('modePills');
  if (modeRow) modeRow.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.pill') : null;
    if (!b || !b.getAttribute('data-mode')) return;
    var m = b.getAttribute('data-mode');
    if (['classic', 'nebula', 'nightfall', 'mission', 'zen', 'duo'].indexOf(m) < 0) return;
    gameMode = m;
    savePref('mode', gameMode);
    updateModePills();
    applyModeUi();
    if (!running) reset();
  });

  var wrapBox = $('wrapToggle');
  if (wrapBox) {
    wrapBox.checked = wallWrap;
    wrapBox.addEventListener('change', function () { wallWrap = wrapBox.checked; savePref('wrap', wallWrap ? '1' : '0'); });
  }

  var hapticsBox = $('hapticsBox');
  if (hapticsBox) {
    hapticsBox.checked = haptics;
    hapticsBox.addEventListener('change', function () { haptics = hapticsBox.checked; savePref('haptics', haptics ? '1' : '0'); });
  }

  var ghostRaceBox = $('ghostRaceBox');
  if (ghostRaceBox) {
    ghostRaceBox.checked = ghostRace;
    ghostRaceBox.addEventListener('change', function () { ghostRace = ghostRaceBox.checked; savePref('ghostrace', ghostRace ? '1' : '0'); });
  }
  var hcBox = $('hcBox');
  if (hcBox) {
    hcBox.checked = highContrast;
    hcBox.addEventListener('change', function () {
      highContrast = hcBox.checked;
      savePref('hc', highContrast ? '1' : '0');
      document.body.classList.toggle('hc', highContrast);
    });
  }
  var largeBox = $('largeBox');
  if (largeBox) {
    largeBox.checked = largeCells;
    largeBox.addEventListener('change', function () { largeCells = largeBox.checked; savePref('large', largeCells ? '1' : '0'); });
  }
  var musicVolEl = $('musicVol');
  if (musicVolEl) {
    musicVolEl.value = String(musicVol);
    musicVolEl.addEventListener('input', function () { musicVol = parseFloat(musicVolEl.value) || 0; savePref('musicvol', musicVol); });
  }
  var musicBtn = $('musicBtn');
  if (musicBtn) musicBtn.addEventListener('click', function () {
    musicOn = !musicOn;
    savePref('musicon', musicOn ? '1' : '0');
    if (musicOn && !isMuted()) music.start(); else music.stop();
    updateOptionBoxes();
    toast(musicOn ? 'Music on' : 'Music off');
  });
  var keysBtn = $('keysBtn');
  if (keysBtn) keysBtn.addEventListener('click', function () {
    var panel = $('keyPanel');
    if (panel) panel.classList.toggle('open');
    if (panel && !panel.classList.contains('open')) { bindTarget = ''; updateKeyPanel(); }
  });
  var bindBtns = document.querySelectorAll('#keyPanel [data-bind]');
  for (var bi = 0; bi < bindBtns.length; bi++) {
    bindBtns[bi].addEventListener('click', (function (btn) {
      return function () {
        bindTarget = btn.getAttribute('data-bind');
        updateKeyPanel();
        toast('Press a key for ' + btn.getAttribute('data-bind') + '.');
      };
    })(bindBtns[bi]));
  }
  var starMapBtn = $('starMapBtn');
  if (starMapBtn) starMapBtn.addEventListener('click', openStarMap);
  var starMapClose = $('starMapClose');
  if (starMapClose) starMapClose.addEventListener('click', closeStarMap);
  var shareScoreBtn = $('shareScoreBtn');
  if (shareScoreBtn) shareScoreBtn.addEventListener('click', shareScore);
  var resumeBtn = $('resumeBtn');
  if (resumeBtn) resumeBtn.addEventListener('click', doResume);

  var a11yBox = $('a11yBox');
  var a11yBtn = $('a11yToggle');
  function setA11y(v) {
    a11y = !!v;
    savePref('a11y', a11y ? '1' : '0');
    updateA11y();
    announce(a11y
      ? 'Text mode on. Arrow keys or W A S D steer. Enter starts. P pauses. Stardust guides you to the nearest star.'
      : 'Text mode off.');
  }
  if (a11yBox) a11yBox.addEventListener('change', function () { setA11y(a11yBox.checked); });
  if (a11yBtn) a11yBtn.addEventListener('click', function () { setA11y(a11yBtn.getAttribute('aria-pressed') !== 'true'); });

  var shareBtn = $('shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', copyShare);

  var pauseOverlay = $('pauseOverlay');
  if (pauseOverlay) pauseOverlay.addEventListener('click', function () { resumeGame(); });

  var soundBtn = $('sound');
  if (soundBtn) soundBtn.addEventListener('click', function () {
    setMuted(!isMuted());
    if (isMuted()) music.stop();
    else if (musicOn) music.start();
    updateSound();
    updateOptionBoxes();
  });

  var pauseCtl = (typeof GameUI !== 'undefined' && GameUI.autoPause) ? GameUI.autoPause({
    pause: function () { if (!running || dead) return false; paused = true; setPauseLabel(); return true; },
    resume: function () { paused = false; setPauseLabel(); showPauseOverlay(false); }
  }) : null;
  $('pause').addEventListener('click', function () { togglePause(); });

  if (window.ResizeObserver && C.parentElement) {
    try { new ResizeObserver(resize).observe(C.parentElement); } catch (e) {}
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  best = loadBest();
  ghostPath = loadGhost();
  if (missionIdx < 0 || missionIdx >= MISSIONS.length) missionIdx = 0;
  makeStars();
  reset();
  if (paletteIdx >= unlockedPalettes()) { paletteIdx = 0; savePref('palette', 0); }
  resize();
  updateDiffPills();
  updateModePills();
  buildPalettePills();
  updateSound();
  updateA11y();
  updateHaptics();
  updateDailyHint();
  applyModeUi();
  showResumeBtn();
  updateOptionBoxes();
  updateKeyPanel();
  loopHandle = requestAnimationFrame(loop);

  window.__stardustSnake = {
    snake: function () { return snake; },
    score: function () { return score; },
    running: function () { return running; },
    dead: function () { return dead; },
    paused: function () { return paused; },
    won: function () { return won; },
    speed: function () { return step; },
    food: function () { return food; },
    foodType: function () { return foodType; },
    combo: function () { return combo; },
    particles: function () { return particles.length; },
    milestone: function () { return milestones ? milestones.next() : null; },
    goalLadder: function () { return milestones ? milestones.list.length : 0; },
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
    shields: function () { return shields; },
    magnet: function () { return magnetTimer; },
    slow: function () { return slowTimer; },
    theme: function () { return themeForScore(score); },
    themeName: function () { return THEMES[themeForScore(score)].name; },
    compass: function () { return compassVector(); },
    ghostLength: function () { return ghostPath.length; },
    ghostScore: function () { return ghostBest; },
    bestCombo: function () { return bestCombo; },
    mode: function () { return gameMode; },
    rocks: function () { return rocks.slice(); },
    aiMode: function () { return a11y; },
    a11y: function () { return a11y; },
    haptics: function () { return haptics; },
    dailyGoal: function () { return dailyGoal; },
    seed: function () { return activeSeed; },
    shareLink: shareLink,
    setDir: setDir,
    setWrap: function (v) { wallWrap = !!v; },
    setMode: function (m) {
      if (['classic', 'nebula', 'nightfall', 'mission', 'zen', 'duo'].indexOf(m) < 0) m = 'classic';
      gameMode = m; savePref('mode', gameMode); updateModePills(); applyModeUi(); if (!running) reset();
    },
    setFoodType: function (t) { foodType = t; },
    setShields: function (n) { shields = n | 0; },
    shieldHit: shieldHit,
    effectiveStep: function () { return curStep(); },
    resetBest: function () { best = 0; try { localStorage.removeItem('jvds_game_stardust-snake'); } catch (e) {} hud(); },
    ghostPass: function () { return ghostTimer; },
    freeze: function () { return freezeTimer; },
    double: function () { return doubleTimer; },
    tempRocks: function () { return tempRocks.slice(); },
    portals: function () { return portals.slice(); },
    mission: function () { return { index: missionIdx, goal: missionGoal, name: MISSIONS[missionIdx].name }; },
    missionProgress: function () { return missionIdx; },
    dust: function () { return dust; },
    owned: function () { return Object.keys(owned); },
    ghostRace: function () { return ghostRace; },
    highContrast: function () { return highContrast; },
    largeCells: function () { return largeCells; },
    timeLeft: function () { return timeLeft; },
    setTimeLeft: function (v) { timeLeft = v; },
    setEventTimer: function (v) { eventTimer = v; },
    eventKind: function () { return eventKind; },
    endNow: function (r) { end(r || 'wall'); },
    musicOn: function () { return musicOn; },
    snake2: function () { return snake2; },
    score2: function () { return score2; },
    alive2: function () { return alive2; },
    setDir2: setDir2,
    openStarMap: openStarMap,
    closeStarMap: closeStarMap,
    buildStarMap: buildStarMap,
    buyCosmetic: buyCosmetic,
    hasCosmetic: hasCosmetic,
    saveResume: saveResume,
    doResume: doResume,
    clearResume: clearResume,
    resumeAvailable: function () { return !!resumeState; },
    shareScore: shareScore,
    addDust: function (n) { dust += n | 0; savePref('dust', dust); },
    feedNow: function (t) {
      if (dead || won || !running) return false;
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
