(() => {
  'use strict';

  const W = 900;
  const H = 560;
  const GARDEN_Y = H - 70;
  const STORY_WAVES = 3;
  const COMBO_WINDOW = 2.4;
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const audio = window.AudioEffects ? new AudioEffects(0.45) : null;
  const sys = window.GameSystem ? new GameSystem('lumo-firefly', 'Lumo Firefly Shooter', 'lumo') : null;
  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduceMotion = !!(reducedQuery && reducedQuery.matches);
  const coarseQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  let coarsePointer = !!(coarseQuery && coarseQuery.matches);

  const DIFF = {
    cozy: { label: 'Cozy', spawn: 1.25, speed: 0.82, damage: 0.7, target: 0.8 },
    classic: { label: 'Classic', spawn: 1, speed: 1, damage: 1, target: 1 },
    storm: { label: 'Storm', spawn: 0.78, speed: 1.22, damage: 1.35, target: 1.2 }
  };

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  const savedDiff = lsGet('jvds_lumo_difficulty');
  let difficulty = DIFF[savedDiff] ? savedDiff : 'classic';
  const savedMode = lsGet('jvds_lumo_mode');
  let mode = savedMode === 'endless' || savedMode === 'story' ? savedMode : 'story';
  let soundOn = !(sys && sys.getSetting && sys.getSetting('soundEnabled') === false) && lsGet('jvds_sound') !== '0';
  let hapticsOn = lsGet('jvds_lumo_haptics') !== '0';
  let textMode = lsGet('jvds_lumo_textmode') === '1';

  function readUrlOption(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
  }
  const urlDiff = readUrlOption('diff');
  if (DIFF[urlDiff]) difficulty = urlDiff;
  const urlMode = readUrlOption('mode');
  if (urlMode === 'story' || urlMode === 'endless') mode = urlMode;

  function hashSeed(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function newSeed() {
    return Math.random().toString(36).slice(2, 8);
  }
  let seed = readUrlOption('seed') || lsGet('jvds_lumo_seed') || newSeed();
  let rng = mulberry32(hashSeed(seed));

  const storedBest = safeNumber(lsGet('jvds_lumo_best'));
  let best = Math.max(storedBest, safeNumber(sys && sys.state && sys.state.highScore));

  let run = false;
  let paused = false;
  let finished = false;
  let result = '';
  let score = 0;
  let wave = 1;
  let glow = 100;
  let combo = 1;
  let comboTimer = 0;
  let maxCombo = 1;
  let threats = 0;
  let target = 8;
  let totalKills = 0;
  let fireflies = 0;
  let shotsFired = 0;
  let shotsHit = 0;
  let wavesCleared = 0;
  let bossKills = 0;
  let shots = [];
  let bugs = [];
  let drops = [];
  let bits = [];
  let aim = { x: W / 2, y: 150 };
  const lumo = { x: W / 2, y: GARDEN_Y };
  let cooldown = 0;
  let burst = 2;
  let slow = 2;
  let slowT = 0;
  let power = { rapid: 0, triple: 0, shield: 0 };
  let spawnAcc = 0;
  let shakeT = 0;
  let bossAlive = false;
  let bossSpawned = false;
  let waveStarts = 0;
  let runStartedAt = performance.now();
  let last = performance.now();
  let toastTimer = 0;
  const hudCache = {};
  const test = {
    spawned: 0,
    hits: 0,
    collected: 0,
    damageHits: 0,
    shakeHits: 0,
    finishCount: 0,
    waveStarts: 0
  };

  const storyRun = window.StoryRun ? new StoryRun({
    id: 'lumo-firefly',
    gameSystem: sys,
    title: "Lumo's Firefly Shooter",
    character: 'Lumo',
    open: "Lumo's night garden has gone dark and shadow bugs are eating the glow.",
    objective: 'Aim the light orbs, rescue fireflies and clear three short waves.',
    beats: [
      { at: 0, text: 'The first shadow bugs drift in from the dark.' },
      { at: 0.4, text: 'The swarm thickens and the glow starts to dip.' },
      { at: 0.8, text: 'One last push to relight the whole garden.' }
    ],
    result: {
      success: 'The garden glows again and Lumo leaves a firefly on your windowsill.',
      partial: 'The garden dims but holds, and most fireflies are safe.',
      fail: 'The shadows win this wave, but Lumo still has light left to try again.'
    },
    cap: 300,
    onFinish: outcome => handleFinish(outcome),
    onRestart: () => {
      resetRun();
      sys?.beginRun?.();
      beginWave(1);
      run = true;
      paused = false;
      finished = false;
      hideStart();
      hidePause();
      last = performance.now();
      updateHud(true);
      toast('Wave 1');
      announce('Run restarted. ' + goalText());
    }
  }) : null;
  window.__storyRun = storyRun;

  function setText(id, value) {
    const el = $(id);
    if (!el) return;
    const text = String(value);
    if (hudCache[id] !== text) {
      el.textContent = text;
      hudCache[id] = text;
    }
  }

  function announce(message) {
    if (!textMode) return;
    const el = $('srStatus');
    if (el) el.textContent = String(message).slice(0, 240);
  }

  function toast(message, good = true) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast show ' + (good ? 'good' : 'bad');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 1300);
  }

  function sound(name) {
    try { if (audio && typeof audio[name] === 'function') audio[name](); } catch (e) {}
  }

  function vibrate(ms) {
    if (!hapticsOn) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  function starText(count) {
    return '★'.repeat(count) + '☆'.repeat(3 - count);
  }

  function starsFor(value) {
    if (value >= 3200) return 3;
    if (value >= 1600) return 2;
    if (value >= 600) return 1;
    return 0;
  }

  function isThreat(bug) {
    return bug.type === 'shadow' || bug.type === 'moth' || bug.type === 'boss';
  }

  function isBossWave(w) {
    return mode === 'story' ? w === STORY_WAVES : w % 4 === 0;
  }

  function targetFor(w) {
    const base = mode === 'story' ? 8 + (w - 1) * 4 : 10 + (w - 1) * 3;
    return Math.max(1, Math.round(base * DIFF[difficulty].target));
  }

  function spawnInterval() {
    const base = Math.max(0.42, 1.15 - wave * 0.05);
    return base * DIFF[difficulty].spawn;
  }

  function goalText() {
    return mode === 'story' ? 'Clear ' + target + ' threats' : 'Survive wave ' + wave;
  }

  function updateSummary() {
    setText('sumWaves', wavesCleared);
    setText('sumFireflies', fireflies);
    setText('sumCombo', maxCombo);
    setText('sumAccuracy', (shotsFired ? Math.round((shotsHit / shotsFired) * 100) : 0) + '%');
    setText('sumBest', best);
  }

  function updateHud(force) {
    if (force) {
      Object.keys(hudCache).forEach(key => { delete hudCache[key]; });
    }
    const liveBest = Math.max(best, score);
    setText('score', score);
    setText('wave', wave);
    setText('glow', Math.max(0, Math.round(glow)) + '%');
    setText('combo', 'x' + combo);
    setText('best', liveBest);
    setText('bestVal', liveBest);
    setText('fireflies', fireflies);
    setText('goal', goalText());
    setText('waveGoal', (mode === 'story' ? 'Wave ' + wave + ' of ' + STORY_WAVES : 'Wave ' + wave) + ' · ' + Math.min(threats, target) + '/' + target + ' threats');
    setText('modeLabel', mode === 'story' ? 'Story run' : 'Endless');
    setText('seedLabel', 'Garden seed: ' + seed);
    setText('burstCount', burst);
    setText('slowCount', slow);
    setText('stars', starText(starsFor(score)));
    setText('startStars', starText(starsFor(liveBest)));

    const bar = $('comboBar');
    if (bar) {
      const width = combo > 1 ? Math.max(0, Math.min(1, comboTimer / COMBO_WINDOW)) * 100 : 0;
      bar.style.width = width + '%';
    }

    const badges = [
      ['puRapid', power.rapid, 'Rapid fire ' + Math.ceil(power.rapid) + 's'],
      ['puTriple', power.triple, 'Triple shot ' + Math.ceil(power.triple) + 's'],
      ['puShield', power.shield, 'Shield ' + power.shield]
    ];
    badges.forEach(([id, value, text]) => {
      const el = $(id);
      if (!el) return;
      el.hidden = value <= 0;
      if (value > 0 && el.textContent !== text) el.textContent = text;
    });
  }

  function syncOptions() {
    document.querySelectorAll('#diffPills .pill').forEach(btn => {
      const on = btn.dataset.diff === difficulty;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#modePills .pill').forEach(btn => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function updateSoundButton() {
    const btn = $('soundBtn');
    if (!btn) return;
    btn.textContent = soundOn ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    btn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
  }

  function updateMotionAndToggles() {
    const a11y = $('a11yBox');
    if (a11y) a11y.checked = textMode;
    const haptics = $('hapticsBox');
    if (haptics) haptics.checked = hapticsOn;
    updateSoundButton();
  }

  function setDifficulty(value) {
    if (!DIFF[value]) return;
    if (run) { toast('Finish this run first', false); return; }
    difficulty = value;
    lsSet('jvds_lumo_difficulty', difficulty);
    target = targetFor(1);
    syncOptions();
    updateHud(true);
    toast('Pace: ' + DIFF[difficulty].label);
  }

  function setMode(value) {
    if (value !== 'story' && value !== 'endless') return;
    if (run) { toast('Finish this run first', false); return; }
    mode = value;
    lsSet('jvds_lumo_mode', mode);
    target = targetFor(1);
    syncOptions();
    updateHud(true);
    toast(mode === 'story' ? 'Story run: three short waves' : 'Endless run: survive the night');
  }

  function setSeed(value) {
    const clean = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || newSeed();
    seed = clean;
    lsSet('jvds_lumo_seed', seed);
    rng = mulberry32(hashSeed(seed));
    updateHud(true);
    return seed;
  }

  function shareLink() {
    const base = window.location.origin + window.location.pathname;
    return base + '?seed=' + encodeURIComponent(seed) + '&mode=' + encodeURIComponent(mode) + '&diff=' + encodeURIComponent(difficulty);
  }

  function resetRng() {
    rng = mulberry32(hashSeed(seed));
  }

  function resetRun() {
    run = false;
    paused = false;
    finished = false;
    result = '';
    score = 0;
    wave = 1;
    glow = 100;
    combo = 1;
    comboTimer = 0;
    maxCombo = 1;
    threats = 0;
    target = targetFor(1);
    totalKills = 0;
    fireflies = 0;
    shotsFired = 0;
    shotsHit = 0;
    wavesCleared = 0;
    bossKills = 0;
    shots = [];
    bugs = [];
    drops = [];
    bits = [];
    aim = { x: W / 2, y: 150 };
    cooldown = 0;
    burst = 2;
    slow = 2;
    slowT = 0;
    power = { rapid: 0, triple: 0, shield: 0 };
    spawnAcc = 0;
    shakeT = 0;
    bossAlive = false;
    bossSpawned = false;
    waveStarts = 0;
    runStartedAt = performance.now();
    last = performance.now();
    resetRng();
    updateHud(true);
    updateSummary();
  }

  function beginWave(w) {
    wave = w;
    threats = 0;
    target = targetFor(w);
    spawnAcc = 0;
    bossAlive = false;
    bossSpawned = false;
    waveStarts++;
    test.waveStarts++;
    if (isBossWave(w)) spawnBoss();
    updateHud(true);
  }

  function startRun() {
    if (run) return;
    resetRun();
    sys?.beginRun?.();
    beginWave(1);
    run = true;
    paused = false;
    finished = false;
    hideStart();
    hidePause();
    storyRun?.begin?.();
    if (storyRun) storyRun._pausedByGame = false;
    runStartedAt = performance.now();
    last = performance.now();
    updateHud(true);
    toast('Wave 1');
    announce('Run started. ' + goalText());
  }

  function restartRun() {
    resetRun();
    sys?.beginRun?.();
    beginWave(1);
    run = true;
    paused = false;
    finished = false;
    hideStart();
    hidePause();
    storyRun?.begin?.();
    if (storyRun) storyRun._pausedByGame = false;
    runStartedAt = performance.now();
    last = performance.now();
    updateHud(true);
    toast('Wave 1');
    announce('Run restarted. ' + goalText());
  }

  function finishRun(outcome) {
    if (finished || !run) return;
    run = false;
    paused = false;
    if (storyRun) {
      storyRun.setScore(score);
      storyRun.finish(outcome, score);
      return;
    }
    try {
      sys?.addScore?.(score);
      sys?.addXP?.(Math.max(8, Math.floor(score / 40)));
      sys?.recordGamePlay?.(Math.max(1000, Math.round(performance.now() - runStartedAt)));
      sys?.saveState?.();
    } catch (e) {}
    handleFinish(outcome);
  }

  function handleFinish(outcome) {
    finished = true;
    run = false;
    paused = false;
    result = outcome || 'partial';
    best = Math.max(best, score, safeNumber(sys && sys.state && sys.state.highScore));
    lsSet('jvds_lumo_best', String(best));
    test.finishCount++;
    try {
      if (sys) {
        sys.unlockAchievement?.('firstPlay');
        if (result === 'success') sys.unlockAchievement?.('storyComplete');
        if (bossKills > 0) sys.unlockAchievement?.('bossDown');
        if (fireflies >= 10) sys.unlockAchievement?.('firefly10');
        if (maxCombo >= 5) sys.unlockAchievement?.('combo5');
      }
    } catch (e) {}
    updateSummary();
    updateHud(true);
    updateSoundButton();
    addModalResult();
    setTimeout(() => {
      try { window.JVDSOnboarding?.showTip?.(); } catch (e) {}
    }, 700);
    const message = result === 'success'
      ? 'Garden saved. ' + score + ' points.'
      : result === 'partial'
        ? 'Time up. ' + score + ' points.'
        : 'The glow ran out. ' + score + ' points.';
    announce(message);
  }

  function addModalResult() {
    const card = document.querySelector('.sr-modal.show .sr-modal-card');
    if (!card || card.querySelector('.ff-modal-extra')) return;
    const line = document.createElement('p');
    line.className = 'ff-modal-extra';
    line.textContent = starText(starsFor(score)) + ' · Best ' + best + ' · ' + wavesCleared + ' wave(s) · ' + fireflies + ' firefly rescue(s)';
    const stats = card.querySelector('.sr-stats');
    if (stats && stats.parentNode) stats.parentNode.insertBefore(line, stats.nextSibling);
    else card.insertBefore(line, card.querySelector('.sr-again'));

    const book = document.createElement('div');
    book.className = 'ff-book-card';
    const cover = document.createElement('img');
    cover.src = '../lumo-front-cover-concept-v001.webp';
    cover.alt = 'Cover of Lumo and the Grumble-Grit';
    cover.width = 76;
    cover.height = 76;
    cover.loading = 'lazy';
    cover.decoding = 'async';
    const copy = document.createElement('div');
    copy.className = 'ff-book-copy';
    const kicker = document.createElement('span');
    kicker.className = 'ff-book-kicker';
    kicker.textContent = result === 'success' ? 'The story continues' : 'Lumo has more light to give';
    const text = document.createElement('p');
    text.textContent = result === 'success'
      ? 'The garden is safe. Read how Lumo faces the Grumble-Grit in his book.'
      : 'The garden dimmed, but Lumo never gives up. Meet the Grumble-Grit in his book.';
    const link = document.createElement('a');
    link.className = 'ff-book-link';
    link.href = '/books/lumo_and_the_grumble_grit.html';
    link.textContent = 'Read the book';
    copy.appendChild(kicker);
    copy.appendChild(text);
    copy.appendChild(link);
    book.appendChild(cover);
    book.appendChild(copy);
    card.insertBefore(book, card.querySelector('.sr-back') || null);
  }

  function hideStart() {
    $('startScreen')?.classList.add('hidden');
  }
  function hidePause() {
    $('pauseOverlay')?.classList.add('hidden');
  }

  function pauseStory() {
    if (storyRun && storyRun.running) {
      storyRun.stop();
      storyRun._pausedByGame = true;
    }
  }
  function resumeStory() {
    if (storyRun && storyRun._pausedByGame && !storyRun.finished) {
      storyRun._pausedByGame = false;
      storyRun.running = true;
      storyRun._last = 0;
      storyRun._loop(performance.now());
    }
  }

  function togglePause(force) {
    if (!run || finished) return;
    paused = typeof force === 'boolean' ? force : !paused;
    const button = $('pause');
    if (button) {
      button.textContent = paused ? '▶' : '⏸';
      button.setAttribute('aria-pressed', paused ? 'true' : 'false');
      button.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    }
    if (paused) {
      $('pauseOverlay')?.classList.remove('hidden');
      pauseStory();
      announce('Game paused.');
    } else {
      hidePause();
      resumeStory();
      last = performance.now();
      announce('Game resumed.');
    }
  }

  function pickType() {
    const roll = rng();
    if (roll < 0.26) return 'firefly';
    if (wave === 1) return roll < 0.82 ? 'moth' : 'shadow';
    return roll < 0.56 ? 'moth' : 'shadow';
  }

  function spawn(typeOverride) {
    if (bugs.length >= 18) return null;
    const type = typeOverride || pickType();
    if (type === 'boss') return spawnBoss();
    const side = rng() < 0.5 ? -1 : 1;
    const hp = type === 'shadow' ? 2 : 1;
    const bug = {
      type,
      x: side < 0 ? -34 : W + 34,
      y: 60 + rng() * 230,
      vx: -side * (36 + wave * 5 + rng() * 24) * DIFF[difficulty].speed,
      t: rng() * 8,
      r: type === 'moth' ? 20 : 17,
      hp,
      maxHp: hp
    };
    bugs.push(bug);
    test.spawned++;
    return bug;
  }

  function spawnBoss() {
    if (bossAlive) return null;
    const hp = 10 + wave * 2;
    const boss = {
      type: 'boss',
      x: W / 2,
      y: 115,
      vx: (rng() < 0.5 ? -1 : 1) * 58,
      t: 0,
      r: 36,
      hp,
      maxHp: hp,
      minionAt: 2.5
    };
    bugs.push(boss);
    bossAlive = true;
    bossSpawned = true;
    test.spawned++;
    toast('Boss moth incoming', false);
    announce('Boss moth. It takes several hits.');
    return boss;
  }

  function aimAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    aim.x = Math.max(0, Math.min(W, (clientX - rect.left) / rect.width * W));
    aim.y = Math.max(0, Math.min(H, (clientY - rect.top) / rect.height * H));
  }

  function canvasScale() {
    const rect = canvas.getBoundingClientRect();
    return rect.width ? W / rect.width : 1;
  }

  function logicalScreenPx(px) {
    return Math.max(1, Math.min(220, px * canvasScale()));
  }

  function tapRadius() {
    return coarsePointer ? Math.max(44, logicalScreenPx(44)) : 30;
  }

  function hitPadding() {
    return coarsePointer ? Math.max(9, logicalScreenPx(6)) : 9;
  }

  function shoot() {
    if (!run || paused || finished || cooldown > 0) return;
    const dx = aim.x - lumo.x;
    const dy = aim.y - (lumo.y - 22);
    const baseAngle = Math.atan2(dy, dx);
    const angles = power.triple > 0 ? [baseAngle - 0.16, baseAngle, baseAngle + 0.16] : [baseAngle];
    angles.forEach(angle => {
      shots.push({
        x: lumo.x,
        y: lumo.y - 24,
        vx: Math.cos(angle) * 700,
        vy: Math.sin(angle) * 700,
        life: 1.25
      });
    });
    shotsFired += angles.length;
    cooldown = power.rapid > 0 ? 0.085 : 0.17;
    sound('playTap');
  }

  function bumpCombo() {
    combo = Math.min(10, combo + 1);
    comboTimer = COMBO_WINDOW;
    if (combo > maxCombo) maxCombo = combo;
    if (combo === 5 || combo === 10) announce('Combo x' + combo + '.');
  }

  function breakCombo() {
    combo = 1;
    comboTimer = 0;
  }

  function collectFirefly(bug) {
    fireflies++;
    test.collected++;
    score += Math.round(60 * combo);
    glow = Math.min(100, glow + 2);
    bumpCombo();
    sound('playCombo');
    if (!reduceMotion) {
      for (let i = 0; i < 8; i++) {
        bits.push({ x: bug.x, y: bug.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, a: 1, c: '#fef08a' });
      }
    }
    announce('Firefly rescued. ' + fireflies + ' safe.');
  }

  function maybeDrop(x, y, chance) {
    if (rng() > chance) return;
    const kinds = ['nectar', 'rapid', 'triple', 'shield'];
    const kind = kinds[Math.floor(rng() * kinds.length)];
    drops.push({ type: kind, x, y, r: 14, vy: 44, t: 0 });
  }

  function spawnDrop(type, x, y) {
    const kind = ['nectar', 'rapid', 'triple', 'shield'].includes(type) ? type : 'nectar';
    const drop = { type: kind, x, y, r: 14, vy: 44, t: 0 };
    drops.push(drop);
    return drop;
  }

  function applyDrop(kind) {
    if (kind === 'nectar') {
      glow = Math.min(100, glow + 12);
      toast('Nectar restores glow');
    } else if (kind === 'rapid') {
      power.rapid = 8;
      toast('Rapid fire for 8s');
    } else if (kind === 'triple') {
      power.triple = 8;
      toast('Triple shot for 8s');
    } else if (kind === 'shield') {
      power.shield = Math.min(2, power.shield + 1);
      toast('Shield ready');
    }
    sound('playPowerup');
    vibrate(12);
    announce('Power-up: ' + kind + '.');
    updateHud(true);
  }

  function collectDrop(drop) {
    applyDrop(drop.type);
  }

  function killBug(bug, options) {
    const opts = options || {};
    const isBoss = bug.type === 'boss';
    const base = isBoss ? 500 : bug.type === 'shadow' ? 140 : 110;
    score += Math.round(base * combo);
    threats += isBoss ? 5 : 1;
    totalKills++;
    if (isBoss) {
      bossAlive = false;
      bossKills++;
      shakeT = reduceMotion ? 0 : 0.3;
      if (!reduceMotion) test.shakeHits++;
      sound('playLevelUp');
      vibrate(40);
      announce('Boss moth defeated.');
    } else {
      sound('playSuccess');
    }
    if (!reduceMotion) {
      for (let i = 0; i < (isBoss ? 30 : 10); i++) {
        bits.push({
          x: bug.x,
          y: bug.y,
          vx: (Math.random() - 0.5) * (isBoss ? 360 : 170),
          vy: (Math.random() - 0.5) * (isBoss ? 360 : 170),
          a: 1,
          c: bug.type === 'shadow' ? '#a78bfa' : '#fde68a'
        });
      }
    }
    if (!opts.noDrop) maybeDrop(bug.x, bug.y, isBoss ? 1 : 0.1);
    if (!opts.noWave) checkWave();
  }

  function hitBug(bug, index) {
    if (bug.type === 'firefly') {
      collectFirefly(bug);
      bugs.splice(index, 1);
      return;
    }
    bug.hp--;
    bumpCombo();
    score += Math.round(12 * combo);
    test.hits++;
    if (bug.hp <= 0) {
      killBug(bug);
      bugs.splice(index, 1);
    } else {
      sound('playPop');
    }
  }

  function damageGarden(raw) {
    if (finished) return;
    test.damageHits++;
    if (power.shield > 0) {
      power.shield--;
      sound('playPowerup');
      vibrate(18);
      toast('Shield saved the garden');
      announce('Shield absorbed the hit. Glow is ' + Math.round(glow) + ' percent.');
      updateHud(true);
      return;
    }
    const damage = Math.max(1, Math.round(raw * DIFF[difficulty].damage));
    glow = Math.max(0, glow - damage);
    breakCombo();
    sound('playError');
    vibrate(30);
    if (!reduceMotion) {
      shakeT = 0.25;
      test.shakeHits++;
    }
    announce('Garden glow down to ' + Math.round(glow) + ' percent.');
    updateHud(true);
    if (glow <= 0) finishRun('fail');
  }

  function reachGarden(bug) {
    if (bug.type === 'firefly') {
      toast('A firefly drifted home');
      return;
    }
    if (bug.type === 'moth') {
      breakCombo();
      toast('A moth escaped', false);
      return;
    }
    damageGarden(bug.type === 'boss' ? 24 : 14);
  }

  function checkWave() {
    if (finished || bossAlive || threats < target) return;
    wavesCleared++;
    glow = Math.min(100, glow + 4);
    if (mode === 'story' && wave >= STORY_WAVES) {
      finishRun('success');
      return;
    }
    beginWave(wave + 1);
    toast('Wave ' + wave);
    announce('Wave ' + wave + '. ' + goalText());
  }

  function useBurst() {
    if (!run || paused || finished) return;
    const targets = bugs.filter(isThreat);
    const flies = bugs.filter(b => b.type === 'firefly');
    if (!targets.length && !flies.length) {
      toast('Nothing to clear yet');
      return;
    }
    if (burst <= 0) {
      toast('No burst left', false);
      return;
    }
    burst--;
    sound('playSuccess');
    vibrate(25);
    flies.forEach(collectFirefly);
    targets.forEach(bug => killBug(bug, { noDrop: true, noWave: true }));
    bugs = [];
    checkWave();
    updateHud(true);
    toast('Sunflower burst');
  }

  function useSlow() {
    if (!run || paused || finished) return;
    if (slow <= 0) {
      toast('No slow pollen left', false);
      return;
    }
    slow--;
    slowT = 5;
    sound('playPowerup');
    toast('Slow pollen active');
    announce('Slow pollen active for five seconds.');
    updateHud(true);
  }

  function updateShots(dt) {
    const pad = hitPadding();
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || shot.x < -40 || shot.x > W + 40 || shot.y < -40 || shot.y > H + 40) {
        shots.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let j = bugs.length - 1; j >= 0; j--) {
        const bug = bugs[j];
        if (Math.hypot(shot.x - bug.x, shot.y - bug.y) <= bug.r + pad) {
          shots.splice(i, 1);
          shotsHit++;
          hitBug(bug, j);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (let j = drops.length - 1; j >= 0; j--) {
        const drop = drops[j];
        if (Math.hypot(shot.x - drop.x, shot.y - drop.y) <= drop.r + pad) {
          collectDrop(drop);
          drops.splice(j, 1);
          shots.splice(i, 1);
          shotsHit++;
          break;
        }
      }
    }
  }

  function updateBugs(dt) {
    const slowFactor = slowT > 0 ? 0.45 : 1;
    const speed = DIFF[difficulty].speed;
    for (let i = bugs.length - 1; i >= 0; i--) {
      const bug = bugs[i];
      bug.t += dt;
      if (bug.type === 'boss') {
        bug.x += bug.vx * dt;
        if (bug.x < 110) { bug.x = 110; bug.vx = Math.abs(bug.vx); }
        if (bug.x > W - 110) { bug.x = W - 110; bug.vx = -Math.abs(bug.vx); }
        bug.y = 115 + Math.sin(bug.t * 1.3) * 22;
        bug.minionAt -= dt;
        if (bug.minionAt <= 0) {
          bug.minionAt = 3.2;
          spawn('shadow');
        }
        continue;
      }
      bug.x += bug.vx * dt * slowFactor;
      if (bug.type === 'moth') {
        bug.y += (Math.sin(bug.t * 3) * 10 + 26 * speed) * dt * slowFactor;
        bug.x += Math.cos(bug.t * 2) * 20 * dt * slowFactor;
      } else if (bug.type === 'shadow') {
        bug.y += 52 * speed * dt * slowFactor;
      } else {
        bug.y += 18 * speed * dt * slowFactor;
      }
      if (bug.y >= GARDEN_Y) {
        reachGarden(bug);
        bugs.splice(i, 1);
        continue;
      }
      if (bug.x < -90 || bug.x > W + 90) bugs.splice(i, 1);
    }
  }

  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      drop.t += dt;
      drop.y += drop.vy * dt;
      if (drop.y >= GARDEN_Y) {
        collectDrop(drop);
        drops.splice(i, 1);
      }
    }
  }

  function updateBits(dt) {
    if (reduceMotion) { bits = []; return; }
    for (const bit of bits) {
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.a -= dt * 1.6;
    }
    bits = bits.filter(bit => bit.a > 0);
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0 && combo > 1) breakCombo();
    }
    slowT = Math.max(0, slowT - dt);
    power.rapid = Math.max(0, power.rapid - dt);
    power.triple = Math.max(0, power.triple - dt);
    shakeT = Math.max(0, shakeT - dt);

    spawnAcc += dt;
    const interval = spawnInterval();
    let guard = 0;
    while (spawnAcc >= interval && guard < 4) {
      spawnAcc -= interval;
      spawn();
      guard++;
    }

    updateShots(dt);
    if (finished) return;
    updateBugs(dt);
    if (finished) return;
    updateDrops(dt);
    updateBits(dt);
    checkWave();
    updateHud();
  }

  function drawLumo() {
    ctx.save();
    ctx.translate(lumo.x, lumo.y);
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.ellipse(0, -18, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(-18, -34);
    ctx.lineTo(-8, -56);
    ctx.lineTo(-1, -36);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, -34);
    ctx.lineTo(8, -56);
    ctx.lineTo(1, -36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(-8, -22, 3.5, 0, Math.PI * 2);
    ctx.arc(8, -22, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(-8, -22, 1.6, 0, Math.PI * 2);
    ctx.arc(8, -22, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, -48, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shakeT > 0 && !reduceMotion) {
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    }
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#111827');
    sky.addColorStop(0.55, '#1e1b4b');
    sky.addColorStop(1, '#14532d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 70; i++) {
      const twinkle = reduceMotion ? 0.2 : 0.15 + Math.sin(i + last * 0.001) * 0.12;
      ctx.fillStyle = 'rgba(255,255,255,' + twinkle + ')';
      ctx.fillRect((i * 97) % W, (i * 53) % H, 2, 2);
    }

    ctx.fillStyle = 'rgba(34,197,94,.22)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(i * 82 + 20, GARDEN_Y + 28, 20 + (i % 3) * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(253,224,71,.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lumo.x, lumo.y - 48);
    ctx.lineTo(aim.x, aim.y);
    ctx.stroke();

    drawLumo();

    shots.forEach(shot => {
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    bugs.forEach(bug => {
      const icon = bug.type === 'firefly' ? '🟡' : bug.type === 'moth' ? '🦋' : bug.type === 'shadow' ? '🕷️' : '👑';
      ctx.font = Math.round(bug.r * 1.6) + 'px system-ui';
      ctx.fillText(icon, bug.x, bug.y);
      if (bug.hp > 1 && bug.type !== 'boss') {
        ctx.fillStyle = '#fff';
        ctx.font = '14px system-ui';
        ctx.fillText(String(bug.hp), bug.x, bug.y - bug.r);
      }
    });

    drops.forEach(drop => {
      const icons = { nectar: '💧', rapid: '⚡', triple: '✨', shield: '🛡️' };
      ctx.fillStyle = 'rgba(34,197,94,.9)';
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '18px system-ui';
      ctx.fillText(icons[drop.type] || '✨', drop.x, drop.y);
    });

    bits.forEach(bit => {
      ctx.globalAlpha = bit.a;
      ctx.fillStyle = bit.c;
      ctx.beginPath();
      ctx.arc(bit.x, bit.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    const boss = bugs.find(bug => bug.type === 'boss');
    if (boss) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, W, 8);
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(0, 0, W * Math.max(0, boss.hp / boss.maxHp), 8);
      ctx.fillStyle = '#fff';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('Boss moth ' + Math.max(0, boss.hp) + '/' + boss.maxHp, W - 14, 24);
    }

    if (!run && !finished) {
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '34px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Tap Start wave', W / 2, H / 2);
    }
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (run && !paused && !finished) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  canvas.addEventListener('pointermove', event => {
    aimAt(event.clientX, event.clientY);
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    aimAt(event.clientX, event.clientY);
    if (!run || paused || finished) return;
    const radius = tapRadius();
    const flyIndex = bugs.findIndex(bug => bug.type === 'firefly' && Math.hypot(aim.x - bug.x, aim.y - bug.y) < radius);
    if (flyIndex >= 0) {
      collectFirefly(bugs[flyIndex]);
      bugs.splice(flyIndex, 1);
      updateHud(true);
      return;
    }
    const dropIndex = drops.findIndex(drop => Math.hypot(aim.x - drop.x, aim.y - drop.y) < radius);
    if (dropIndex >= 0) {
      collectDrop(drops[dropIndex]);
      drops.splice(dropIndex, 1);
      return;
    }
    shoot();
  });

  window.addEventListener('keydown', event => {
    const tag = (event.target && event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault();
      if (!run && !finished) startRun();
      else if (run && !paused) shoot();
      return;
    }
    if (event.code === 'Enter' && !run && !finished) {
      event.preventDefault();
      startRun();
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (run && !finished) {
        event.preventDefault();
        togglePause();
      }
      return;
    }
    if (event.code === 'KeyB' && run && !paused) {
      event.preventDefault();
      useBurst();
      return;
    }
    if (event.code === 'KeyS' && run && !paused) {
      event.preventDefault();
      useSlow();
      return;
    }
    if (!run || paused) return;
    const step = 24;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') { event.preventDefault(); aim.x = Math.max(0, aim.x - step); }
    if (event.code === 'ArrowRight' || event.code === 'KeyD') { event.preventDefault(); aim.x = Math.min(W, aim.x + step); }
    if (event.code === 'ArrowUp' || event.code === 'KeyW') { event.preventDefault(); aim.y = Math.max(0, aim.y - step); }
    if (event.code === 'ArrowDown') { event.preventDefault(); aim.y = Math.min(H, aim.y + step); }
  });

  $('start').addEventListener('click', startRun);
  $('startMain').addEventListener('click', startRun);
  $('pause').addEventListener('click', () => togglePause());
  $('burst').addEventListener('click', useBurst);
  $('slow').addEventListener('click', useSlow);
  $('resumeBtn').addEventListener('click', () => togglePause(false));
  $('restartBtn').addEventListener('click', restartRun);
  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn;
    if (sys) sys.updateSetting?.('soundEnabled', soundOn);
    lsSet('jvds_sound', soundOn ? '1' : '0');
    updateSoundButton();
    toast(soundOn ? 'Sound on' : 'Sound off');
    if (soundOn) sound('playTap');
  });
  $('a11yBox').addEventListener('change', event => {
    textMode = !!event.target.checked;
    lsSet('jvds_lumo_textmode', textMode ? '1' : '0');
    if (textMode) announce('Screen-reader game messages on.');
    else { const el = $('srStatus'); if (el) el.textContent = ''; }
  });
  $('hapticsBox').addEventListener('change', event => {
    hapticsOn = !!event.target.checked;
    lsSet('jvds_lumo_haptics', hapticsOn ? '1' : '0');
    if (hapticsOn) vibrate(12);
  });
  $('diffPills').addEventListener('click', event => {
    const btn = event.target.closest('[data-diff]');
    if (btn) setDifficulty(btn.dataset.diff);
  });
  $('modePills').addEventListener('click', event => {
    const btn = event.target.closest('[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });
  $('dailyBtn').addEventListener('click', () => {
    if (run) { toast('Finish this run, then the daily seed is ready', false); return; }
    setSeed('lumo-' + new Date().toISOString().slice(0, 10));
    toast('Daily garden ready');
  });
  $('shareBtn').addEventListener('click', () => {
    const link = shareLink();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {}, () => {});
        copied = true;
      }
    } catch (e) {}
    toast(copied ? 'Challenge link copied' : link, copied);
    announce('Challenge link: ' + link);
  });
  if (reducedQuery) {
    const onMotionChange = event => {
      reduceMotion = event.matches;
      if (reduceMotion) { bits = []; shakeT = 0; }
    };
    if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', onMotionChange);
    else if (reducedQuery.addListener) reducedQuery.addListener(onMotionChange);
  }
  if (coarseQuery) {
    const onPointerChange = event => { coarsePointer = event.matches; };
    if (coarseQuery.addEventListener) coarseQuery.addEventListener('change', onPointerChange);
    else if (coarseQuery.addListener) coarseQuery.addListener(onPointerChange);
  }
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);
  setTimeout(fit, 30);
  setTimeout(fit, 250);

  syncOptions();
  updateMotionAndToggles();
  resetRun();
  updateSummary();
  updateHud(true);
  requestAnimationFrame(loop);

  window.__lumoFirefly = {
    state: () => ({
      running: run,
      paused,
      finished,
      result,
      score,
      wave,
      glow,
      combo,
      comboTimer,
      maxCombo,
      threats,
      target,
      fireflies,
      shotsFired,
      shotsHit,
      wavesCleared,
      bossAlive,
      bossKills,
      power: { ...power },
      burst,
      slow,
      slowT,
      mode,
      difficulty,
      seed,
      best,
      soundOn,
      hapticsOn,
      textMode,
      reduceMotion,
      coarsePointer,
      tapRadius: tapRadius(),
      bugs: bugs.map(bug => bug.type),
      drops: drops.map(drop => drop.type),
      startShown: !$('startScreen')?.classList.contains('hidden'),
      pauseShown: !$('pauseOverlay')?.classList.contains('hidden'),
      modal: !!document.querySelector('.sr-modal.show'),
      stats: { ...test }
    }),
    start: startRun,
    restart: restartRun,
    pause: () => togglePause(true),
    resume: () => togglePause(false),
    togglePause: () => togglePause(),
    shoot,
    aim: (x, y) => { aim.x = Math.max(0, Math.min(W, x)); aim.y = Math.max(0, Math.min(H, y)); },
    setDifficulty,
    setMode,
    setSeed,
    setScore: value => { score = Math.max(0, Math.round(value)); updateHud(true); },
    setGlow: value => { glow = Math.max(0, Math.min(100, value)); updateHud(true); },
    setWave: value => { beginWave(Math.max(1, Math.round(value))); updateHud(true); },
    damage: value => damageGarden(Math.max(0, value)),
    powerup: kind => applyDrop(kind),
    drop: (kind, x, y) => spawnDrop(kind, x ?? W / 2, y ?? 200),
    spawn: type => spawn(type),
    spawnBoss,
    collect: type => {
      const bug = spawn(type || 'firefly');
      if (bug && bug.type === 'firefly') {
        collectFirefly(bug);
        bugs = bugs.filter(b => b !== bug);
      }
      updateHud(true);
    },
    kill: type => {
      const bug = spawn(type || 'shadow');
      if (bug && bug !== null) {
        bug.hp = 0;
        killBug(bug);
        bugs = bugs.filter(b => b !== bug);
      }
      updateHud(true);
    },
    clearWave: () => {
      threats = target;
      bossAlive = false;
      checkWave();
      updateHud(true);
    },
    finish: outcome => finishRun(outcome || 'success'),
    addScore: value => { score += Math.max(0, Math.round(value)); updateHud(true); },
    burstAll: useBurst,
    slowPollen: useSlow,
    shareLink,
    onScreen: () => bugs.map(bug => bug.type),
    reset: () => { resetRun(); hideStart(); hidePause(); }
  };
})();
