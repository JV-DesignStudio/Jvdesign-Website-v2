(() => {
  'use strict';

  // A2836: fixed-viewport rebuild. The board, HUD and clue all live inside one
  // 100dvh shell, so the play field is visible without scrolling on phone,
  // landscape and desktop. No landing page or iframe.
  const CRITTERS = [
    { e: '\u{1F98A}', name: 'fox',       tags: ['fur', 'land', 'night'] },
    { e: '\u{1F438}', name: 'frog',      tags: ['jump', 'water', 'green'] },
    { e: '\u{1F422}', name: 'turtle',    tags: ['shell', 'water', 'slow'] },
    { e: '\u{1F98B}', name: 'butterfly', tags: ['fly', 'garden', 'colour'] },
    { e: '\u{1F41D}', name: 'bee',       tags: ['fly', 'garden', 'stripe'] },
    { e: '\u{1F98E}', name: 'lizard',    tags: ['land', 'green', 'sun'] },
    { e: '\u{1F989}', name: 'owl',       tags: ['fly', 'night', 'feather'] },
    { e: '\u{1F40C}', name: 'snail',     tags: ['shell', 'slow', 'garden'] },
    { e: '\u{1F980}', name: 'crab',      tags: ['water', 'shell', 'sideways'] }
  ];
  const HAZARDS = [
    { e: '\u{1F4A3}', name: 'bomb' },
    { e: '\u26A1',    name: 'zap' },
    { e: '\u{1FAA4}', name: 'trap' }
  ];
  const RULES = [
    { title: 'Habitat check',    text: 'Tap water critters only.',        tag: 'water',  emoji: '\u{1F30A}' },
    { title: 'Garden helpers',   text: 'Tap garden critters only.',       tag: 'garden', emoji: '\u{1F337}' },
    { title: 'Night watch',      text: 'Tap night critters only.',        tag: 'night',  emoji: '\u{1F319}' },
    { title: 'Shell survey',     text: 'Tap critters with shells only.',  tag: 'shell',  emoji: '\u{1F41A}' },
    { title: 'Sky patrol',       text: 'Tap flying critters only.',       tag: 'fly',    emoji: '\u{1F985}' },
    { title: 'Slow and steady',  text: 'Tap slow critters only.',         tag: 'slow',   emoji: '\u{1F40C}' }
  ];

  const $ = (id) => document.getElementById(id);
  const board = $('board');
  const scoreEl = $('score');
  const waveEl = $('wave');
  const timeEl = $('time');
  const livesEl = $('lives');
  const bestEl = $('best');
  const feedback = $('feedback');
  const overlay = $('overlay');
  const pauseOverlay = $('pauseOverlay');
  const a11y = $('a11yStatus');

  const TOTAL_TIME = 45;
  const WAVE_EVERY = 10;

  let score = 0;
  let wave = 1;
  let lives = 3;
  let time = TOTAL_TIME;
  let best = 0;
  let running = false;
  let paused = false;
  let rule = RULES[0];
  let tickTimer = null;
  let spawnAt = 0;
  let rafId = 0;
  let streak = 0;
  let holes = [];
  let gs = null;

  try {
    best = window.GameSystem ? (GameSystem.getBestScore('critter-whack') || 0) : 0;
  } catch (e) { best = 0; }

  const storyRun = window.__storyRun || (window.__storyRun = new StoryRun({
    id: 'critter-whack',
    title: 'Echo and the Forest Rescue',
    character: 'Echo',
    open: 'Echo is sorting the forest rescue and the wrong critter goes to the wrong home.',
    objective: 'Read each habitat clue and send every critter home.',
    beats: [
      { at: 0,   text: 'First clue board is up.' },
      { at: 0.4, text: 'New habitats start mixing in.' },
      { at: 0.8, text: 'Last wave, read fast.' }
    ],
    cap: 300,
    result: {
      success: 'Every critter is home, your streak is counted and the forest settles.',
      partial: 'Most critters are home, one tricky clue still needs a second look.',
      fail: 'The forest is still messy, but Echo knows the clues for the next round.'
    },
    onFinish: function () { running = false; paused = false; stopTimers(); },
    onRestart: function () { start(); }
  }));

  function say(text) {
    if (a11y) a11y.textContent = text;
  }

  function setBestText() {
    bestEl.textContent = best;
    const titleBest = $('titleBest');
    if (titleBest) titleBest.textContent = best > 0 ? 'Your best: ' + best : 'Your first run sets your best score.';
  }

  function setupBoard() {
    board.innerHTML = '';
    holes = Array.from({ length: 9 }, (_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hole';
      b.setAttribute('aria-label', 'Critter hole ' + (i + 1) + ', empty');
      b.innerHTML = '<span class="critter" aria-hidden="true"></span><span class="label"></span>';
      b.addEventListener('click', () => tap(i));
      board.appendChild(b);
      return { el: b, item: null, up: false, until: 0 };
    });
  }

  function setRule() {
    rule = RULES[(wave - 1) % RULES.length];
    $('ruleTitle').textContent = rule.title;
    $('ruleText').textContent = rule.text;
    $('targetEmoji').textContent = rule.emoji;
  }

  function hud() {
    scoreEl.textContent = score;
    waveEl.textContent = wave;
    timeEl.textContent = Math.max(0, time);
    livesEl.textContent = lives;
    bestEl.textContent = best;
    if (storyRun && storyRun.setScore) storyRun.setScore(score);
  }

  function pickItem() {
    if (Math.random() < 0.18) {
      const hazard = HAZARDS[Math.floor(Math.random() * HAZARDS.length)];
      return { e: hazard.e, name: hazard.name, good: false, hazard: true };
    }
    const good = Math.random() < 0.55;
    const pool = CRITTERS.filter((c) => good ? c.tags.includes(rule.tag) : !c.tags.includes(rule.tag));
    const pick = pool[Math.floor(Math.random() * pool.length)] || CRITTERS[0];
    return { e: pick.e, name: pick.name, good };
  }

  function pop() {
    const free = holes.filter((h) => !h.up);
    if (!free.length) return;
    const h = free[Math.floor(Math.random() * free.length)];
    h.item = pickItem();
    h.up = true;
    h.until = performance.now() + Math.max(720, 1350 - wave * 55);
    h.el.classList.remove('hit', 'miss');
    h.el.classList.add('up');
    h.el.querySelector('.critter').textContent = h.item.e;
    h.el.querySelector('.label').textContent = h.item.hazard ? 'hazard' : h.item.name;
    h.el.setAttribute('aria-label', 'Critter hole, ' + (h.item.hazard ? 'hazard' : h.item.name));
  }

  function hide(h) {
    h.up = false;
    h.item = null;
    h.el.classList.remove('up');
    h.el.querySelector('.critter').textContent = '';
    h.el.querySelector('.label').textContent = '';
    h.el.setAttribute('aria-label', 'Critter hole, empty');
  }

  function tap(i) {
    if (!running || paused) return;
    const h = holes[i];
    if (!h || !h.up || !h.item) return;
    if (h.item.good) {
      streak += 1;
      score += 20 + streak * 5;
      h.el.classList.add('hit');
      feedback.textContent = 'Match! ' + capitalise(h.item.name) + ' fits this clue.';
      say(feedback.textContent + ' Score ' + score + '.');
      if (window.JVDSAudio && window.JVDSAudio.success) window.JVDSAudio.success();
    } else {
      streak = 0;
      lives -= 1;
      h.el.classList.add('miss');
      feedback.textContent = h.item.hazard
        ? 'Hazard! Read the clue before tapping.'
        : 'Not this group. ' + capitalise(h.item.name) + ' does not match.';
      say(feedback.textContent + ' Lives ' + lives + '.');
      if (window.JVDSAudio && window.JVDSAudio.error) window.JVDSAudio.error();
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
    }
    const flashed = h.el;
    hide(h);
    hud();
    setTimeout(() => flashed.classList.remove('hit', 'miss'), 280);
    if (lives <= 0) end(false);
  }

  function capitalise(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function loop(now) {
    if (!running || paused) return;
    const t = typeof now === 'number' ? now : performance.now();
    holes.forEach((h) => {
      if (h.up && t > h.until) {
        if (h.item && h.item.good) {
          streak = 0;
          feedback.textContent = 'A matching critter got away. Streak reset.';
          say(feedback.textContent);
        }
        hide(h);
      }
    });
    if (t > spawnAt) {
      pop();
      spawnAt = t + Math.max(340, 800 - wave * 35);
    }
    rafId = requestAnimationFrame(loop);
  }

  function tick() {
    if (!running || paused) return;
    time -= 1;
    if (time > 0 && time % WAVE_EVERY === 0) {
      wave += 1;
      setRule();
      feedback.textContent = 'New clue: ' + rule.text;
      say(feedback.textContent);
    }
    hud();
    if (time <= 0) { end(true); return; }
    tickTimer = setTimeout(tick, 1000);
  }

  function stopTimers() {
    clearTimeout(tickTimer);
    tickTimer = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  function start() {
    score = 0;
    wave = 1;
    lives = 3;
    time = TOTAL_TIME;
    streak = 0;
    paused = false;
    running = true;
    holes.forEach((h) => { h.el.classList.remove('hit', 'miss'); hide(h); });
    setRule();
    hud();
    overlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    feedback.textContent = 'Find: ' + rule.text;
    say('Game started. ' + rule.text);
    spawnAt = 0;

    if (!gs && window.GameSystem) {
      try { gs = new GameSystem('critter-whack', 'Critter Whack: Ranger Sort', 'echo'); } catch (e) { gs = null; }
    }
    if (gs) { try { gs.beginRun(); } catch (e) {} }
    if (storyRun) {
      storyRun.gameSystem = gs;
      if (!storyRun.running) storyRun.begin();
    }
    stopTimers();
    tick();
    rafId = requestAnimationFrame(loop);
  }

  function end(won) {
    if (!running) return;
    running = false;
    paused = false;
    stopTimers();
    holes.forEach(hide);
    best = Math.max(best, score);
    try {
      if (window.GameSystem && GameSystem.saveScore) GameSystem.saveScore('critter-whack', best);
    } catch (e) {}
    hud();
    setBestText();
    say(won ? 'Run complete. Score ' + score + '.' : 'Run over. Score ' + score + '.');
    if (storyRun && storyRun.finish) {
      storyRun.finish(won ? 'success' : 'fail', score);
    } else {
      showFallbackResult(won);
    }
  }

  // Kept for clarity if the shared story layer is ever unavailable.
  function showFallbackResult(won) {
    const card = overlay.querySelector('.card');
    if (!card) return;
    overlay.classList.remove('hidden');
    const title = overlay.querySelector('h2');
    if (title) title.textContent = won ? 'Run complete' : 'Run over';
    const sub = overlay.querySelector('.sub');
    if (sub) sub.textContent = 'Score ' + score + '. Best ' + best + '.';
  }

  function togglePause(force) {
    if (!running) return;
    const next = typeof force === 'boolean' ? force : !paused;
    if (next === paused) return;
    paused = next;
    if (paused) {
      stopTimers();
      if (storyRun && storyRun.stop) storyRun.stop();
      pauseOverlay.classList.remove('hidden');
      $('pauseBtn').textContent = 'Resume';
      say('Game paused.');
    } else {
      pauseOverlay.classList.add('hidden');
      $('pauseBtn').textContent = 'Pause';
      if (storyRun && !storyRun.running) storyRun.begin();
      tick();
      rafId = requestAnimationFrame(loop);
      say('Game resumed.');
    }
  }

  function toggleSound() {
    const btn = $('soundBtn');
    let muted = false;
    try { muted = localStorage.getItem('soundEnabled') === 'false'; } catch (e) {}
    muted = !muted;
    try { localStorage.setItem('soundEnabled', muted ? 'false' : 'true'); } catch (e) {}
    if (window.JVDSAudio && window.JVDSAudio.setMuted) window.JVDSAudio.setMuted(muted);
    btn.textContent = muted ? 'Sound: Off' : 'Sound: On';
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    say(muted ? 'Sound off.' : 'Sound on.');
  }

  function toggleHelp() {
    const box = $('helpBox');
    const btn = $('helpBtn');
    const open = box.hidden;
    box.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function wire() {
    let savedMuted = false;
    try { savedMuted = localStorage.getItem('soundEnabled') === 'false'; } catch (e) {}
    $('soundBtn').textContent = savedMuted ? 'Sound: Off' : 'Sound: On';
    $('soundBtn').setAttribute('aria-label', savedMuted ? 'Unmute sound' : 'Mute sound');

    $('startBtn').addEventListener('click', start);
    $('pauseBtn').addEventListener('click', () => togglePause());
    $('resumeBtn').addEventListener('click', () => togglePause(false));
    $('restartBtn').addEventListener('click', start);
    $('quitBtn').addEventListener('click', () => {
      stopTimers();
      running = false;
      paused = false;
      holes.forEach(hide);
      pauseOverlay.classList.add('hidden');
      overlay.classList.remove('hidden');
      $('pauseBtn').textContent = 'Pause';
      setBestText();
      hud();
    });
    $('soundBtn').addEventListener('click', toggleSound);
    $('helpBtn').addEventListener('click', toggleHelp);

    const fsBtn = $('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        const d = document;
        const isFs = d.fullscreenElement || d.webkitFullscreenElement;
        try {
          if (!isFs) {
            const el = d.documentElement;
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) req.call(el);
          } else {
            const exit = d.exitFullscreen || d.webkitExitFullscreen;
            if (exit) exit.call(d);
          }
        } catch (e) {}
      });
      const syncFs = () => {
        const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
        fsBtn.textContent = on ? 'Exit full' : 'Fullscreen';
      };
      ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, syncFs));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
      if (e.key === 'Escape') { if (running && !paused) togglePause(true); return; }
      if (e.key >= '1' && e.key <= '9') {
        if (!running || paused) return;
        e.preventDefault();
        tap(Number(e.key) - 1);
      }
    });
  }

  // Build the engine instance before DOMContentLoaded so the shared Arcade menu
  // can see it and expose pause, restart, sound and help.
  if (!gs && window.GameSystem) {
    try { gs = new GameSystem('critter-whack', 'Critter Whack: Ranger Sort', 'echo'); } catch (e) { gs = null; }
  }
  if (gs && gs.registerArcadeActions) {
    gs.registerArcadeActions({ start: start, restart: start, pause: togglePause, sound: toggleSound, help: toggleHelp });
  }

  setupBoard();
  setRule();
  hud();
  setBestText();
  wire();
})();
