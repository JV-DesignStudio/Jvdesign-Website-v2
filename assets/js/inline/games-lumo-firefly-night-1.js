(() => {
  'use strict';

  /* ============================================================
     Lumo's Firefly Shooter is a cosy hex match puzzle. Launch
     firefly bubbles into the hanging garden, match three or more,
     rescue fireflies, keep the shadow rows away from Lumo and clear
     each board. It shares the Lumo world with Hive Strike, but none
     of its mechanics.
     ============================================================ */

  const W = 900;
  const H = 560;
  const STORY_WAVES = 3;
  const COMBO_WINDOW = 2.4;
  const COLS = 13;
  const ROWS = 10;
  const R = 24;
  const D = R * 2;
  const RH = Math.round(D * 0.866 * 10) / 10;
  const TOP = 38;
  const ORIGIN = (W - COLS * D) / 2 + R;
  const DANGER_Y = H - 108;
  const LAUNCHER = { x: W / 2, y: H - 52 };
  const COLOURS = ['#f59e0b', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa'];
  // Every colour also has a shape so a colour-blind player can still match.
  const GLYPHS = ['dot', 'triangle', 'square', 'diamond', 'star'];
  const COACH_LINES = [
    'Aim, then tap or Space to launch.',
    'Match 3+. Shapes help if colours blur.',
    'Match beside a firefly to rescue it.'
  ];
  const LANTERNS = [
    { id: 'honey', name: 'Honey', colour: '#fde047', unlock: 0 },
    { id: 'mint', name: 'Mint', colour: '#a7f3d0', unlock: 5 },
    { id: 'rose', name: 'Rose', colour: '#fda4af', unlock: 15 },
    { id: 'sky', name: 'Sky', colour: '#7dd3fc', unlock: 30 }
  ];
  function glyphFor(colour) {
    const i = COLOURS.indexOf(colour);
    return i >= 0 ? GLYPHS[i] : 'dot';
  }

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

  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function safeNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

  const savedDiff = lsGet('jvds_lumo_difficulty');
  let difficulty = DIFF[savedDiff] ? savedDiff : 'classic';
  const savedMode = lsGet('jvds_lumo_mode');
  let mode = savedMode === 'endless' || savedMode === 'story' ? savedMode : 'story';
  let soundOn = !(sys && sys.getSetting && sys.getSetting('soundEnabled') === false) && lsGet('jvds_sound') !== '0';
  let hapticsOn = lsGet('jvds_lumo_haptics') !== '0';
  let textMode = lsGet('jvds_lumo_textmode') === '1';
  let meta = { rescued: safeNumber(lsGet('jvds_ff_rescued')) };
  let lantern = lsGet('jvds_ff_lantern') || 'honey';
  if (!LANTERNS.some(l => l.id === lantern)) lantern = 'honey';
  function lanternDef(id) { return LANTERNS.find(l => l.id === (id || lantern)) || LANTERNS[0]; }
  function lanternUnlocked(l) { return meta.rescued >= l.unlock; }
  function lanternColour() { return lanternDef().colour; }

  function readUrlOption(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
  }
  const urlDiff = readUrlOption('diff');
  if (DIFF[urlDiff]) difficulty = urlDiff;
  const urlMode = readUrlOption('mode');
  if (urlMode === 'story' || urlMode === 'endless') mode = urlMode;

  function hashSeed(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function newSeed() { return Math.random().toString(36).slice(2, 8); }
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
  let waveFireflies = 0;
  let clearedThisWave = 0;
  let bossHp = 0;
  let bossMax = 0;
  let boardComplete = false;
  let nextBoardT = 0;
  let cooldown = 0;
  let burst = 2;
  let slow = 2;
  let slowT = 0;
  let power = { rapid: 0, triple: 0, shield: 0 };
  let shotsSinceDrop = 0;
  let coachT = 0, coachStep = 0;
  let coachDone = lsGet('jvds_ff_coach') === '1';
  let freezeShots = 0;
  let shakeT = 0;
  let runStartedAt = performance.now();
  let last = performance.now();
  let toastTimer = 0;
  let aim = { x: W / 2, y: 220 };
  let current = null;
  let preview = null;
  let grid = [];
  let flying = [];
  let bits = [];
  let floaters = [];
  const hudCache = {};
  const test = { spawned: 0, hits: 0, collected: 0, damageHits: 0, shakeHits: 0, finishCount: 0, waveStarts: 0 };

  const storyRun = window.StoryRun ? new StoryRun({
    id: 'lumo-firefly',
    gameSystem: sys,
    title: "Lumo's Firefly Shooter",
    character: 'Lumo',
    open: "The night garden has gone dark and the shadow rows are creeping down toward Lumo's lantern.",
    objective: 'Launch firefly bubbles, match three or more, rescue every firefly and clear three boards.',
    beats: [
      { at: 0, text: 'The first shadow row gathers at the top of the garden.' },
      { at: 0.4, text: 'The board thickens and the fireflies are hiding deeper.' },
      { at: 0.8, text: 'One last board: wake the Grumble-Grit and light the garden.' }
    ],
    result: {
      success: 'The garden glows again and Lumo leaves a firefly on your windowsill.',
      partial: 'The garden dims but holds, and most fireflies are safe.',
      fail: 'The shadows win this board, but Lumo still has light left to try again.'
    },
    cap: 300,
    onFinish: outcome => handleFinish(outcome),
    onRestart: () => {
      resetRun();
      sys?.beginRun?.();
      beginBoard(1);
      run = true;
      paused = false;
      finished = false;
      hideStart();
      hidePause();
      last = performance.now();
      updateHud(true);
      toast('Board 1');
      announce('Run restarted. ' + goalText());
    }
  }) : null;
  window.__storyRun = storyRun;

  function setText(id, value) {
    const el = $(id);
    if (!el) return;
    const text = String(value);
    if (hudCache[id] !== text) { el.textContent = text; hudCache[id] = text; }
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
  function sound(name) { try { if (audio && typeof audio[name] === 'function') audio[name](); } catch (e) {} }
  function vibrate(ms) { if (!hapticsOn) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function starText(count) { return '★'.repeat(count) + '☆'.repeat(3 - count); }
  function starsFor(value) {
    if (value >= 3200) return 3;
    if (value >= 1600) return 2;
    if (value >= 600) return 1;
    return 0;
  }

  // ── GRID HELPERS ───────────────────────────────────────────────────────────
  function cellX(r, c) { return ORIGIN + c * D + (r % 2) * R; }
  function cellY(r) { return TOP + r * RH; }
  function makeGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(null));
  }
  function neighbourList(r, c) {
    const odd = r % 2 === 1;
    const out = [[r, c - 1], [r, c + 1]];
    if (odd) out.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
    else out.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
    return out.filter(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS);
  }
  function allBubbles() {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c]) out.push(grid[r][c]);
    return out;
  }
  function boardEmpty() { return allBubbles().length === 0; }
  function makeBubble(type, colour) {
    const b = {
      type: type || 'normal',
      color: type === 'shadow' || type === 'boss' ? '#2b2140' : type === 'firefly' ? '#fde047' : type === 'rainbow' ? 'rainbow' : (colour || COLOURS[0]),
      r: 0, c: 0, x: 0, y: 0, hp: 0, maxHp: 0, wobble: Math.random() * 6.28
    };
    if (type === 'boss') { b.hp = 12; b.maxHp = 12; }
    return b;
  }
  function placeBubble(r, c, b) {
    b.r = r; b.c = c; b.x = cellX(r, c); b.y = cellY(r);
    grid[r][c] = b;
  }
  function pickBoardColour() {
    const counts = {};
    for (const b of allBubbles()) {
      if (b.type === 'normal' || b.type === 'moth') counts[b.color] = (counts[b.color] || 0) + 1;
    }
    const keys = Object.keys(counts);
    if (!keys.length) return COLOURS[Math.floor(rng() * COLOURS.length)];
    let total = 0;
    for (const k of keys) total += counts[k];
    let roll = rng() * total;
    for (const k of keys) { roll -= counts[k]; if (roll <= 0) return k; }
    return keys[0];
  }
  function nextLaunch() {
    const roll = rng();
    if (roll < 0.07) return makeBubble('rainbow');
    if (roll < 0.13) return makeBubble('bomb', pickBoardColour());
    if (roll < 0.18) return makeBubble('star', pickBoardColour());
    if (roll < 0.23) return makeBubble('freeze', pickBoardColour());
    return makeBubble('normal', pickBoardColour());
  }

  // ── BOARDS ─────────────────────────────────────────────────────────────────
  function boardGoal() {
    if (mode === 'story') {
      if (wave === 1) return { kind: 'fireflies', goal: 4 };
      if (wave === 2) return { kind: 'fireflies', goal: 6 };
      return { kind: 'boss', goal: 12 };
    }
    return { kind: 'clear', goal: Math.round((10 + (wave - 1) * 2) * DIFF[difficulty].target) };
  }

  function fillBoard() {
    makeGrid();
    const palette = COLOURS.slice(0, wave >= 2 ? 5 : 4);
    const rows = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        let type = 'normal';
        const roll = rng();
        if (mode === 'story' && wave === 3 && r === 0 && c === Math.floor(COLS / 2)) type = 'boss';
        else if (wave >= 2 && roll < 0.07) type = 'shadow';
        else if (wave >= 2 && roll < 0.11) type = 'moth';
        else if (roll < 0.14 && allBubbles().filter(b => b.type === 'firefly').length < (wave >= 2 ? 2 : 1)) type = 'firefly';
        else if (roll < 0.17) type = 'rainbow';
        const colour = palette[Math.floor(rng() * palette.length)];
        placeBubble(r, c, makeBubble(type, colour));
      }
    }
    // Always leave at least one firefly on a story board
    if ((mode === 'story' || wave >= 2) && !allBubbles().some(b => b.type === 'firefly')) {
      const b = makeBubble('firefly');
      placeBubble(rows - 1, Math.floor(COLS / 2), b);
    }
    bossHp = allBubbles().find(b => b.type === 'boss') ? 12 : 0;
    bossMax = bossHp;
  }

  function beginBoard(w) {
    wave = w;
    waveFireflies = 0;
    clearedThisWave = 0;
    boardComplete = false;
    nextBoardT = 0;
    shotsSinceDrop = 0;
    freezeShots = 0;
    target = boardGoal().goal;
    test.waveStarts++;
    fillBoard();
    current = nextLaunch();
    preview = nextLaunch();
    updateHud(true);
    announce('Board ' + wave + '. ' + goalText());
  }

  function goalText() {
    const g = boardGoal();
    if (g.kind === 'boss') return 'Wake and clear the Grumble-Grit';
    if (g.kind === 'fireflies') return 'Rescue ' + g.goal + ' fireflies';
    return 'Clear ' + g.goal + ' bubbles';
  }

  function scoreAdd(pts) { score += Math.round(pts); updateHud(); }

  function bumpCombo() {
    combo = Math.min(10, combo + 1);
    comboTimer = COMBO_WINDOW;
    if (combo > maxCombo) maxCombo = combo;
    if (combo === 5 || combo === 10) announce('Combo x' + combo + '.');
  }
  function breakCombo() { combo = 1; comboTimer = 0; }

  // ── CLEARING ───────────────────────────────────────────────────────────────
  function canMatch(b, colour) {
    if (!b) return false;
    if (b.type === 'rainbow') return true;
    return (b.type === 'normal' || b.type === 'moth') && b.color === colour;
  }

  function findGroup(r, c) {
    const start = grid[r][c];
    if (!start) return [];
    let colour = start.color;
    if (start.type === 'rainbow') {
      colour = null;
      for (const [nr, nc] of neighbourList(r, c)) {
        const b = grid[nr][nc];
        if (b && (b.type === 'normal' || b.type === 'moth')) { colour = b.color; break; }
      }
      if (!colour) return [];
    }
    if (start.type === 'shadow' || start.type === 'boss') return [];
    const seen = new Set();
    const stack = [[r, c]];
    const group = [];
    seen.add(r + ',' + c);
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const b = grid[cr][cc];
      if (!canMatch(b, colour)) continue;
      group.push([cr, cc]);
      for (const [nr, nc] of neighbourList(cr, cc)) {
        const key = nr + ',' + nc;
        if (seen.has(key)) continue;
        if (canMatch(grid[nr][nc], colour)) { seen.add(key); stack.push([nr, nc]); }
      }
    }
    return group;
  }

  function rescueFirefly(b) {
    fireflies++;
    waveFireflies++;
    meta.rescued++;
    test.collected++;
    bumpCombo();
    scoreAdd(60 * combo);
    glow = Math.min(100, glow + 2);
    sound('playCombo');
    floaters.push({ x: b.x || W / 2, y: b.y || 120, text: 'FIREFLY!', a: 1, vy: -48, color: '#fde047' });
    if (!reduceMotion) {
      for (let i = 0; i < 8; i++) bits.push({ x: b.x || W / 2, y: b.y || 120, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, a: 1, c: '#fef08a' });
    }
    announce('Firefly rescued. ' + fireflies + ' safe.');
  }

  function clearCell(r, c, toClear) {
    const b = grid[r][c];
    if (!b) return;
    grid[r][c] = null;
    clearedThisWave++;
    if (b.type === 'firefly') { rescueFirefly(b); return; }
    if (b.type === 'shadow' || b.type === 'moth') { threats++; scoreAdd(70 * combo); sound('playPop'); }
    else if (b.type === 'boss') {
      bossHp = Math.max(0, bossHp - 1);
      if (b.hp > 0) b.hp--;
      scoreAdd(90 * combo);
    } else {
      scoreAdd(40 * combo);
      if (b.type === 'bomb') {
        for (const [nr, nc] of neighbourList(r, c)) if (grid[nr][nc] && !toClear.has(nr + ',' + nc)) toClear.add(nr + ',' + nc);
        sound('playPop');
      } else if (b.type === 'star') {
        applyDrop('rapid');
        floaters.push({ x: b.x, y: b.y, text: 'STAR', a: 1, vy: -40, color: '#fde047' });
      } else if (b.type === 'freeze') {
        freezeShots += 6;
        floaters.push({ x: b.x, y: b.y, text: 'FREEZE', a: 1, vy: -40, color: '#7ef0ff' });
      } else {
        sound('playPop');
      }
    }
    test.hits++;
    if (!reduceMotion) {
      for (let i = 0; i < 6; i++) bits.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 150, vy: (Math.random() - 0.5) * 150, a: 1, c: b.type === 'shadow' ? '#a78bfa' : b.color });
    }
  }

  function clearGroup(group) {
    if (!group.length) return;
    bumpCombo();
    const toClear = new Set(group.map(([r, c]) => r + ',' + c));
    const rescueKeys = new Set();
    // Adjacent shadow bugs, moths, bosses and fireflies react to the match
    for (const [r, c] of group) {
      for (const [nr, nc] of neighbourList(r, c)) {
        const b = grid[nr][nc];
        if (!b) continue;
        const key = nr + ',' + nc;
        if (toClear.has(key)) continue;
        if (b.type === 'firefly') rescueKeys.add(key);
        if (b.type === 'shadow' || b.type === 'moth') toClear.add(key);
        if (b.type === 'bomb') toClear.add(key);
        if (b.type === 'boss') { bossHp = Math.max(0, bossHp - 1); b.hp = Math.max(0, b.hp - 1); }
      }
    }
    // Rescuing a neighbouring firefly is the heart of the puzzle
    for (const key of rescueKeys) {
      const [r, c] = key.split(',').map(Number);
      const b = grid[r][c];
      if (b && b.type === 'firefly') { grid[r][c] = null; clearedThisWave++; rescueFirefly(b); }
    }
    // Fireflies sitting inside the group are rescued directly
    for (const key of [...toClear]) {
      const [r, c] = key.split(',').map(Number);
      const b = grid[r][c];
      if (b && b.type === 'firefly') { grid[r][c] = null; clearedThisWave++; rescueFirefly(b); toClear.delete(key); }
    }
    // Clear bombs first so their blast is included
    for (const key of [...toClear]) {
      const [r, c] = key.split(',').map(Number);
      const b = grid[r][c];
      if (b && b.type === 'bomb') {
        for (const [nr, nc] of neighbourList(r, c)) if (grid[nr][nc]) toClear.add(nr + ',' + nc);
      }
    }
    for (const key of toClear) {
      const [r, c] = key.split(',').map(Number);
      clearCell(r, c, toClear);
    }
    dropFloating();
    afterBoardChange();
  }

  function dropFloating() {
    const anchored = new Set();
    const stack = [];
    for (let c = 0; c < COLS; c++) if (grid[0][c]) { stack.push([0, c]); anchored.add('0,' + c); }
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [nr, nc] of neighbourList(r, c)) {
        const key = nr + ',' + nc;
        if (anchored.has(key) || !grid[nr][nc]) continue;
        anchored.add(key); stack.push([nr, nc]);
      }
    }
    const dropped = [];
    for (let r = ROWS - 1; r >= 1; r--) {
      for (let c = 0; c < COLS; c++) {
        const b = grid[r][c];
        if (!b || anchored.has(r + ',' + c)) continue;
        grid[r][c] = null;
        dropped.push(b);
      }
    }
    for (const b of dropped) {
      if (b.type === 'firefly') rescueFirefly(b);
      else if (b.type === 'shadow' || b.type === 'moth') { threats++; }
      scoreAdd(15 * combo);
    }
    if (dropped.length) {
      sound('playSuccess');
      toast(dropped.length + ' bubbles dropped');
    }
  }

  function afterBoardChange() {
    updateHud(true);
    checkBoard();
  }

  function checkBoard() {
    if (finished || boardComplete || !run) return;
    const g = boardGoal();
    let done = false;
    if (g.kind === 'boss') done = bossHp <= 0;
    else if (g.kind === 'fireflies') done = waveFireflies >= g.goal || boardEmpty();
    else done = clearedThisWave >= g.goal || boardEmpty();
    if (done) completeBoard(false);
  }

  function completeBoard(instant) {
    if (boardComplete || finished) return;
    boardComplete = true;
    wavesCleared++;
    scoreAdd(100 * wave);
    glow = Math.min(100, glow + 4);
    sound('playSuccess');
    toast('Board ' + wave + ' cleared');
    announce('Board ' + wave + ' cleared.');
    if (mode === 'story' && wave >= STORY_WAVES) { finishRun('success'); return; }
    if (instant) { beginBoard(wave + 1); return; }
    nextBoardT = 1.3;
  }

  // ── LAUNCHING ──────────────────────────────────────────────────────────────
  function takeCurrent() {
    const b = current || makeBubble('normal', pickBoardColour());
    current = preview || nextLaunch();
    preview = nextLaunch();
    return b;
  }

  function shoot() {
    if (!run || paused || finished || cooldown > 0 || boardComplete) return;
    const dy = aim.y - (LAUNCHER.y - 20);
    const dx = aim.x - LAUNCHER.x;
    const baseAngle = Math.atan2(dy, dx);
    const angles = power.triple > 0 ? [baseAngle - 0.14, baseAngle, baseAngle + 0.14] : [baseAngle];
    const shot = takeCurrent();
    angles.forEach(angle => {
      flying.push({
        x: LAUNCHER.x, y: LAUNCHER.y - 26,
        vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720,
        b: { type: shot.type, color: shot.color, hp: shot.hp, maxHp: shot.maxHp }, t: 0
      });
    });
    shotsFired += angles.length;
    cooldown = power.rapid > 0 ? 0.09 : 0.2;
    sound('playTap');
    shotsSinceDrop++;
    if (shotsSinceDrop >= rowEvery()) { shotsSinceDrop = 0; pushShadowRow(); }
    updateHud();
  }

  function rowEvery() {
    const base = Math.max(4, 7 - Math.floor(wave / 2));
    return Math.round(base * (slowT > 0 ? 2 : 1));
  }

  function snapFlying(f, collided) {
    let best = null;
    if (collided) {
      let bestD = 1e9;
      for (const [nr, nc] of neighbourList(collided.r, collided.c)) {
        if (grid[nr][nc]) continue;
        const d = Math.hypot(cellX(nr, nc) - f.x, cellY(nr) - f.y);
        if (d < bestD) { bestD = d; best = [nr, nc]; }
      }
    }
    if (!best) {
      let bestD = 1e9;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c]) continue;
          const d = Math.hypot(cellX(r, c) - f.x, cellY(r) - f.y);
          if (d < bestD) { bestD = d; best = [r, c]; }
        }
      }
    }
    if (!best) return false;
    const [r, c] = best;
    const b = makeBubble(f.b.type, f.b.color);
    if (f.b.type === 'boss') { b.hp = f.b.hp; b.maxHp = f.b.maxHp; }
    placeBubble(r, c, b);
    shotsHit++;
    const group = findGroup(r, c);
    if (group.length >= 3) clearGroup(group);
    else { dropFloating(); afterBoardChange(); }
    return true;
  }

  function updateFlying(dt) {
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt;
      const speed = Math.hypot(f.vx, f.vy) || 1;
      const steps = Math.max(1, Math.ceil(speed * dt / (R * 0.7)));
      let landed = false;
      for (let s = 0; s < steps && !landed; s++) {
        f.x += f.vx * dt / steps;
        f.y += f.vy * dt / steps;
        if (f.x < R) { f.x = R; f.vx = Math.abs(f.vx); }
        if (f.x > W - R) { f.x = W - R; f.vx = -Math.abs(f.vx); }
        if (f.y <= TOP) { snapFlying(f, null); landed = true; break; }
        let collided = null;
        for (const b of allBubbles()) {
          if (Math.hypot(f.x - b.x, f.y - b.y) < R * 1.7) { collided = b; break; }
        }
        if (collided) {
          if (collided.type === 'firefly') {
            grid[collided.r][collided.c] = null;
            clearedThisWave++;
            rescueFirefly(collided);
            snapFlying(f, null);
          } else {
            snapFlying(f, collided);
          }
          landed = true;
          break;
        }
      }
      if (landed || f.y > H + 40 || f.t > 4) flying.splice(i, 1);
    }
  }

  // ── PRESSURE ───────────────────────────────────────────────────────────────
  function pushShadowRow(force) {
    if ((!run && !force) || finished || boardComplete) return;
    if (slowT > 0 || freezeShots > 0) {
      if (freezeShots > 0) freezeShots--;
      toast('The shadows hold still');
      return;
    }
    let overflow = false;
    for (let c = 0; c < COLS; c++) {
      if (grid[ROWS - 1][c]) { grid[ROWS - 1][c] = null; overflow = true; }
    }
    if (overflow) damageGarden(10);
    if (finished) return;
    for (let r = ROWS - 1; r >= 1; r--) {
      for (let c = 0; c < COLS; c++) {
        const b = grid[r - 1][c];
        grid[r][c] = b;
        if (b) { b.r = r; b.c = c; b.x = cellX(r, c); b.y = cellY(r); }
      }
    }
    for (let c = 0; c < COLS; c++) {
      const roll = rng();
      const type = roll < 0.42 ? 'shadow' : roll < 0.54 ? 'moth' : roll < 0.62 ? 'firefly' : 'normal';
      placeBubble(0, c, makeBubble(type, pickBoardColour()));
    }
    toast('Shadow row descends', false);
    announce('A shadow row descends.');
    afterBoardChange();
  }

  // ── DAMAGE / TOOLS ─────────────────────────────────────────────────────────
  function damageGarden(raw) {
    if (finished || !run) return;
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
    if (!reduceMotion) { shakeT = 0.25; test.shakeHits++; }
    announce('Garden glow down to ' + Math.round(glow) + ' percent.');
    updateHud(true);
    if (glow <= 0) finishRun('fail');
  }

  function useBurst() {
    if (!run || paused || finished || boardComplete) return;
    const hazards = allBubbles().filter(b => b.type === 'shadow' || b.type === 'moth' || b.type === 'boss');
    const flies = allBubbles().filter(b => b.type === 'firefly');
    if (!hazards.length && !flies.length) { toast('Nothing to clear yet'); return; }
    if (burst <= 0) { toast('No burst left', false); return; }
    burst--;
    sound('playSuccess');
    vibrate(25);
    for (const f of flies) {
      const r = f.r, c = f.c;
      grid[r][c] = null; clearedThisWave++;
      rescueFirefly(f);
    }
    for (const h of hazards) {
      if (grid[h.r][h.c] !== h) continue;
      if (h.type === 'boss') {
        bossHp = Math.max(0, bossHp - 3);
        h.hp = Math.max(0, h.hp - 3);
        scoreAdd(120 * combo);
        if (bossHp <= 0) { grid[h.r][h.c] = null; clearedThisWave++; bossKills++; }
      } else {
        grid[h.r][h.c] = null; clearedThisWave++; threats++;
        scoreAdd(50 * combo);
      }
    }
    dropFloating();
    afterBoardChange();
    updateHud(true);
    toast('Sunflower burst');
  }

  function useSlow() {
    if (!run || paused || finished || boardComplete) return;
    if (slow <= 0) { toast('No slow pollen left', false); return; }
    slow--;
    slowT = 5;
    freezeShots = 3;
    sound('playPowerup');
    toast('Slow pollen active');
    announce('Slow pollen active for five seconds.');
    updateHud(true);
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
    } else if (kind === 'freeze') {
      freezeShots += 6;
      toast('Frost holds the shadows');
    }
    sound('playPowerup');
    vibrate(12);
    announce('Power-up: ' + kind + '.');
    updateHud(true);
  }

  // ── START / END ────────────────────────────────────────────────────────────
  function resetRng() { rng = mulberry32(hashSeed(seed)); }

  function resetRun() {
    run = false; paused = false; finished = false; result = '';
    score = 0; wave = 1; glow = 100; combo = 1; comboTimer = 0; maxCombo = 1;
    threats = 0; target = boardGoal().goal; totalKills = 0; fireflies = 0;
    shotsFired = 0; shotsHit = 0; wavesCleared = 0; bossKills = 0;
    waveFireflies = 0; clearedThisWave = 0; bossHp = 0; bossMax = 0; boardComplete = false; nextBoardT = 0;
    flying = []; bits = []; floaters = []; makeGrid();
    cooldown = 0;
    burst = Math.min(4, 2 + Math.floor(meta.rescued / 25));
    slow = Math.min(3, 2 + Math.floor(meta.rescued / 50));
    slowT = 0; freezeShots = 0;
    power = { rapid: 0, triple: 0, shield: 0 };
    shotsSinceDrop = 0; shakeT = 0; coachT = 0; coachStep = 0;
    aim = { x: W / 2, y: 220 };
    runStartedAt = performance.now(); last = performance.now();
    resetRng();
    current = nextLaunch(); preview = nextLaunch();
    updateHud(true); updateSummary();
  }

  function beginCoach() {
    if (coachDone) { coachT = 0; return; }
    coachT = 13;
    coachStep = 0;
    announce('Coach: ' + COACH_LINES[0]);
  }
  function finishCoach() {
    coachT = 0;
    if (!coachDone) { coachDone = true; lsSet('jvds_ff_coach', '1'); }
  }

  function startRun() {
    if (run) return;
    resetRun();
    sys?.beginRun?.();
    beginBoard(1);
    beginCoach();
    run = true; paused = false; finished = false;
    hideStart(); hidePause();
    storyRun?.begin?.();
    if (storyRun) storyRun._pausedByGame = false;
    runStartedAt = performance.now(); last = performance.now();
    updateHud(true);
    toast('Board 1');
    announce('Run started. ' + goalText());
  }

  function restartRun() {
    resetRun();
    sys?.beginRun?.();
    beginBoard(1);
    beginCoach();
    run = true; paused = false; finished = false;
    hideStart(); hidePause();
    storyRun?.begin?.();
    if (storyRun) storyRun._pausedByGame = false;
    runStartedAt = performance.now(); last = performance.now();
    updateHud(true);
    toast('Board 1');
    announce('Run restarted. ' + goalText());
  }

  function finishRun(outcome) {
    if (finished || !run) return;
    run = false; paused = false;
    if (storyRun) { storyRun.setScore(score); storyRun.finish(outcome, score); return; }
    try {
      sys?.addScore?.(score);
      sys?.addXP?.(Math.max(8, Math.floor(score / 40)));
      sys?.recordGamePlay?.(Math.max(1000, Math.round(performance.now() - runStartedAt)));
      sys?.saveState?.();
    } catch (e) {}
    handleFinish(outcome);
  }

  function handleFinish(outcome) {
    finished = true; run = false; paused = false;
    result = outcome || 'partial';
    best = Math.max(best, score, safeNumber(sys && sys.state && sys.state.highScore));
    lsSet('jvds_lumo_best', String(best));
    lsSet('jvds_ff_rescued', String(meta.rescued));
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
    setTimeout(() => { try { window.JVDSOnboarding?.showTip?.(); } catch (e) {} }, 700);
    const message = result === 'success'
      ? 'Garden saved. ' + score + ' points.'
      : result === 'partial'
        ? 'Time up. ' + score + ' points.'
        : 'The glow ran out. ' + score + ' points.';
    announce(message);
  }

  function makeRunCard() {
    const cw = 540, ch = 620;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, ch);
    grd.addColorStop(0, '#0f172a'); grd.addColorStop(0.55, '#1e1b4b'); grd.addColorStop(1, '#14532d');
    g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.25 + Math.random() * 0.6;
      g.fillStyle = i % 7 === 0 ? '#fde047' : '#ffffff';
      g.fillRect((Math.random() * cw) | 0, (Math.random() * ch) | 0, 2, 2);
    }
    g.globalAlpha = 1;
    const R2 = 26, D2 = R2 * 2;
    const cols = COLOURS;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        const colour = cols[(row + col) % cols.length];
        const x = 84 + col * (D2 + 6) + (row % 2) * (R2 + 3);
        const y = 70 + row * 44;
        g.fillStyle = colour;
        g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill();
      }
    }
    g.strokeStyle = 'rgba(253,224,71,.45)'; g.lineWidth = 2; g.strokeRect(18, 18, cw - 36, ch - 36);
    g.textAlign = 'center';
    g.fillStyle = '#fde047'; g.font = '900 32px system-ui';
    g.fillText("LUMO'S", cw / 2, 244);
    g.fillStyle = '#f8fafc';
    g.fillText('FIREFLY GARDEN', cw / 2, 280);
    g.fillStyle = '#c4b5fd'; g.font = '800 15px system-ui';
    g.fillText('MATCH RUN CARD', cw / 2, 308);
    g.fillStyle = '#f8fafc'; g.font = '900 58px system-ui';
    g.fillText(String(score), cw / 2, 384);
    g.fillStyle = '#c4b5fd'; g.font = '700 14px system-ui';
    g.fillText('SCORE', cw / 2, 410);
    g.fillStyle = '#e2e8f0'; g.font = '600 18px system-ui';
    g.fillText(wavesCleared + ' board' + (wavesCleared === 1 ? '' : 's') + ' · ' + fireflies + ' fireflies · best combo x' + maxCombo, cw / 2, 458, cw - 80);
    g.fillText((mode === 'story' ? 'Story' : 'Endless') + ' · ' + DIFF[difficulty].label + ' pace', cw / 2, 486);
    g.fillStyle = '#7dd3fc'; g.font = '600 13px system-ui';
    g.fillText('Garden seed: ' + seed, cw / 2, 516, cw - 80);
    g.fillStyle = '#94a3b8'; g.font = '600 13px system-ui';
    g.fillText('JVDesignStudio · ' + new Date().toLocaleDateString(), cw / 2, ch - 40);
    return c;
  }

  function downloadRunCard() {
    try {
      const c = makeRunCard();
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = 'lumo-firefly-run-' + score + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { }
  }

  function addModalResult() {
    const card = document.querySelector('.sr-modal.show .sr-modal-card');
    if (!card || card.querySelector('.ff-modal-extra')) return;
    const line = document.createElement('p');
    line.className = 'ff-modal-extra';
    line.textContent = starText(starsFor(score)) + ' · Best ' + best + ' · ' + wavesCleared + ' board(s) · ' + fireflies + ' firefly rescue(s)';
    const stats = card.querySelector('.sr-stats');
    if (stats && stats.parentNode) stats.parentNode.insertBefore(line, stats.nextSibling);
    else card.insertBefore(line, card.querySelector('.sr-again'));

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'ff-run-card';
    save.textContent = 'Save run card';
    save.onclick = downloadRunCard;
    card.insertBefore(save, card.querySelector('.sr-again') || null);

    const book = document.createElement('div');
    book.className = 'ff-book-card';
    const cover = document.createElement('img');
    cover.src = '../lumo-front-cover-concept-v001.webp';
    cover.alt = 'Cover of Lumo and the Grumble-Grit';
    cover.width = 76; cover.height = 76;
    cover.loading = 'lazy'; cover.decoding = 'async';
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
    copy.appendChild(kicker); copy.appendChild(text); copy.appendChild(link);
    book.appendChild(cover); book.appendChild(copy);
    card.insertBefore(book, card.querySelector('.sr-back') || null);
  }

  function hideStart() { $('startScreen')?.classList.add('hidden'); }
  function hidePause() { $('pauseOverlay')?.classList.add('hidden'); }

  function pauseStory() { if (storyRun && storyRun.running) { storyRun.stop(); storyRun._pausedByGame = true; } }
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
    if (paused) { $('pauseOverlay')?.classList.remove('hidden'); pauseStory(); announce('Game paused.'); }
    else { hidePause(); resumeStory(); last = performance.now(); announce('Game resumed.'); }
  }

  // ── HUD / OPTIONS ──────────────────────────────────────────────────────────
  function updateSummary() {
    setText('sumWaves', wavesCleared);
    setText('sumFireflies', fireflies);
    setText('sumCombo', maxCombo);
    setText('sumAccuracy', (shotsFired ? Math.round((shotsHit / shotsFired) * 100) : 0) + '%');
    setText('sumBest', best);
  }

  function updateHud(force) {
    if (force) Object.keys(hudCache).forEach(key => { delete hudCache[key]; });
    const liveBest = Math.max(best, score);
    setText('score', score);
    setText('wave', wave);
    setText('glow', Math.max(0, Math.round(glow)) + '%');
    setText('combo', 'x' + combo);
    setText('best', liveBest);
    setText('bestVal', liveBest);
    setText('fireflies', fireflies);
    setText('goal', goalText());
    const g = boardGoal();
    const progress = g.kind === 'fireflies' ? waveFireflies : g.kind === 'boss' ? (bossMax - bossHp) : clearedThisWave;
    setText('waveGoal', (mode === 'story' ? 'Board ' + wave + ' of ' + STORY_WAVES : 'Board ' + wave) + ' · ' + Math.min(progress, target) + '/' + target);
    setText('modeLabel', mode === 'story' ? 'Story run' : 'Endless');
    setText('seedLabel', 'Garden seed: ' + seed);
    setText('burstCount', burst);
    setText('slowCount', slow);
    setText('stars', starText(starsFor(score)));
    setText('startStars', starText(starsFor(liveBest)));
    setText('previewBurst', burst);
    const bar = $('comboBar');
    if (bar) bar.style.width = (combo > 1 ? Math.max(0, Math.min(1, comboTimer / COMBO_WINDOW)) * 100 : 0) + '%';
    [['puRapid', power.rapid, 'Rapid fire ' + Math.ceil(power.rapid) + 's'],
     ['puTriple', power.triple, 'Triple shot ' + Math.ceil(power.triple) + 's'],
     ['puShield', power.shield, 'Shield ' + power.shield]].forEach(([id, value, text]) => {
      const el = $(id);
      if (!el) return;
      el.hidden = value <= 0;
      if (value > 0 && el.textContent !== text) el.textContent = text;
    });
    updateMetaLine();
  }

  let metaTextCache = '';
  function updateMetaLine() {
    const el = document.querySelector('.ff-meta');
    if (!el) return;
    const text = 'Fireflies saved in total: ' + meta.rescued + ' · Bonus burst: ' + burst + ' · Bonus slow: ' + slow + ' · Lantern: ' + lanternDef().name;
    if (metaTextCache !== text) { el.textContent = text; metaTextCache = text; }
  }

  function renderLanterns() {
    let row = document.querySelector('.ff-lanterns');
    if (!row) {
      const host = document.querySelector('.ff-best');
      if (!host || !host.parentNode) return;
      row = document.createElement('div');
      row.className = 'ff-lanterns';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Lantern colour');
      host.parentNode.insertBefore(row, host.nextSibling);
    }
    row.innerHTML = '';
    LANTERNS.forEach(l => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ff-lantern' + (l.id === lantern ? ' is-on' : '') + (lanternUnlocked(l) ? '' : ' locked');
      btn.style.background = l.colour;
      btn.title = l.name + (lanternUnlocked(l) ? '' : ' (rescue ' + (l.unlock - meta.rescued) + ' more fireflies)');
      btn.setAttribute('aria-label', l.name + ' lantern' + (lanternUnlocked(l) ? '' : ' locked'));
      btn.disabled = !lanternUnlocked(l);
      btn.onclick = () => {
        if (!lanternUnlocked(l)) return;
        lantern = l.id;
        lsSet('jvds_ff_lantern', l.id);
        renderLanterns();
        updateHud(true);
        toast(l.name + ' lantern');
      };
      row.appendChild(btn);
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
    const a11y = $('a11yBox'); if (a11y) a11y.checked = textMode;
    const haptics = $('hapticsBox'); if (haptics) haptics.checked = hapticsOn;
    updateSoundButton();
  }

  function setDifficulty(value) {
    if (!DIFF[value] || run) { if (run) toast('Finish this run first', false); return; }
    difficulty = value;
    lsSet('jvds_lumo_difficulty', difficulty);
    target = boardGoal().goal;
    syncOptions(); updateHud(true);
    toast('Pace: ' + DIFF[difficulty].label);
  }
  function setMode(value) {
    if (value !== 'story' && value !== 'endless') return;
    if (run) { toast('Finish this run first', false); return; }
    mode = value;
    lsSet('jvds_lumo_mode', mode);
    target = boardGoal().goal;
    syncOptions(); updateHud(true);
    toast(mode === 'story' ? 'Story run: three boards' : 'Endless run: clear as many boards as you can');
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

  // ── UPDATE / LOOP ──────────────────────────────────────────────────────────
  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (coachT > 0) {
      coachT -= dt;
      const before = coachStep;
      coachStep = Math.min(2, Math.floor((13 - Math.max(0, coachT)) / 4.1));
      if (coachStep !== before) announce('Coach: ' + COACH_LINES[coachStep]);
      if (coachT <= 0) finishCoach();
    }
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0 && combo > 1) breakCombo(); }
    slowT = Math.max(0, slowT - dt);
    power.rapid = Math.max(0, power.rapid - dt);
    power.triple = Math.max(0, power.triple - dt);
    shakeT = Math.max(0, shakeT - dt);
    updateFlying(dt);
    if (nextBoardT > 0) {
      nextBoardT -= dt;
      if (nextBoardT <= 0) { nextBoardT = 0; if (!finished && run) beginBoard(wave + 1); }
    }
    if (slowT <= 0 && freezeShots > 0) freezeShots = Math.max(0, freezeShots - dt);
    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 1.6;
      if (p.a <= 0) bits.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.y += f.vy * dt; f.a -= dt * 1.4;
      if (f.a <= 0) floaters.splice(i, 1);
    }
    checkBoard();
    updateHud();
  }

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (run && !paused && !finished) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ── DRAW ───────────────────────────────────────────────────────────────────
  const STARS = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + 0.4, a: 0.2 + Math.random() * 0.5, p: Math.random() * 6.28 }));

  function drawGlyph(shape, x, y, size, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = fill || 'rgba(15,23,42,.72)';
    if (shape === 'triangle') {
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.95, size * 0.8); ctx.lineTo(-size * 0.95, size * 0.8); ctx.closePath(); ctx.fill();
    } else if (shape === 'square') {
      ctx.fillRect(-size * 0.8, -size * 0.8, size * 1.6, size * 1.6);
    } else if (shape === 'diamond') {
      ctx.rotate(Math.PI / 4); ctx.fillRect(-size * 0.68, -size * 0.68, size * 1.36, size * 1.36);
    } else if (shape === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 ? size * 0.45 : size;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBubble(b, dim) {
    const t = performance.now() * 0.001 + b.wobble;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.type === 'shadow') {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#2b2140';
      ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(167,139,250,.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI / 2.5 + t;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8)); ctx.lineTo(Math.cos(a) * (R - 1), Math.sin(a) * (R - 1)); ctx.stroke();
      }
      ctx.fillStyle = '#a78bfa'; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(0, 0, 5 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'firefly') {
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#fde047'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.ellipse(-9, -4, 7, 4, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(9, -4, 7, 4, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#422006';
      ctx.beginPath(); ctx.arc(-4, 3, 1.8, 0, Math.PI * 2); ctx.arc(4, 3, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'boss') {
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.35, R * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath(); ctx.arc(-9, -4, 3.5, 0, Math.PI * 2); ctx.arc(9, -4, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 8 - 4, 10); ctx.lineTo(i * 8 + 4, 10); ctx.stroke(); }
    } else if (b.type === 'rainbow') {
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = COLOURS[i % COLOURS.length]; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(0, 0, R - 6, i * Math.PI / 3, (i + 1) * Math.PI / 3); ctx.stroke();
      }
      drawGlyph('star', 0, 0, 9, 'rgba(255,255,255,.92)');
    } else if (b.type === 'bomb') {
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R - 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(0, -R + 3, 3.5 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'star') {
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 ? 6 : 14;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    } else if (b.type === 'freeze') {
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 12, -Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke();
      }
    } else {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.32)';
      ctx.beginPath(); ctx.arc(-7, -8, 7, 0, Math.PI * 2); ctx.fill();
      drawGlyph(glyphFor(b.color), 0, 0, 7);
      if (b.type === 'moth') {
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath(); ctx.ellipse(-13, 0, 7, 4, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(13, 0, 7, 4, 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (dim) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawLumo() {
    const t = performance.now() * 0.001;
    const x = LAUNCHER.x, y = LAUNCHER.y;
    const FUR = '#a274b9', FUR_DARK = '#5a3d58', FUR_LIGHT = '#e7d0e9', LINE = '#3a2745';
    ctx.save();
    ctx.translate(x, y);
    // tail
    ctx.fillStyle = FUR; ctx.strokeStyle = LINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(7, 8); ctx.bezierCurveTo(22, 18, 35, 6, 31, -10); ctx.bezierCurveTo(29, -21, 19, -25, 16, -15); ctx.bezierCurveTo(14, -7, 12, 2, 7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = FUR_LIGHT; ctx.beginPath(); ctx.moveTo(16, -14); ctx.bezierCurveTo(18, -26, 30, -26, 33, -14); ctx.bezierCurveTo(35, -6, 30, -1, 25, -3); ctx.bezierCurveTo(21, -5, 18, -9, 16, -14); ctx.closePath(); ctx.fill();
    // ears
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1); ctx.fillStyle = FUR; ctx.strokeStyle = LINE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(12, -16); ctx.lineTo(21, -38); ctx.lineTo(2, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = FUR_LIGHT; ctx.beginPath(); ctx.moveTo(16.5, -31); ctx.lineTo(12.5, -18.5); ctx.lineTo(6, -22); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // body
    ctx.fillStyle = FUR; ctx.strokeStyle = LINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-11, 2); ctx.quadraticCurveTo(-14, 13, -8, 20); ctx.lineTo(8, 20); ctx.quadraticCurveTo(14, 13, 11, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = FUR_LIGHT; ctx.beginPath(); ctx.ellipse(0, 12, 7.5, 8, 0, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.fillStyle = FUR; ctx.strokeStyle = LINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -10, 14.5, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = FUR_LIGHT;
    ctx.beginPath(); ctx.ellipse(0, -2, 10.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    // eyes
    for (const ex of [-5.5, 5.5]) {
      ctx.fillStyle = '#f6eef9'; ctx.beginPath(); ctx.ellipse(ex, -9.5, 3.9, 4.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b3a78'; ctx.beginPath(); ctx.ellipse(ex, -9.5, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#231027'; ctx.beginPath(); ctx.ellipse(ex, -9.5, 1.7, 2.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1.2, -11.1, 0.95, 0, Math.PI * 2); ctx.fill();
    }
    // nose
    ctx.fillStyle = '#251427'; ctx.beginPath(); ctx.moveTo(-2.3, -1.4); ctx.quadraticCurveTo(0, -3.2, 2.3, -1.4); ctx.quadraticCurveTo(1.2, 1.2, 0, 1.7); ctx.quadraticCurveTo(-1.2, 1.2, -2.3, -1.4); ctx.closePath(); ctx.fill();
    // lantern
    const lx = 20, ly = -18 + Math.sin(t * 2) * 1.5;
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(lx, ly); ctx.stroke();
    const lc = lanternColour();
    ctx.fillStyle = lc; ctx.shadowColor = lc; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawCoach() {
    const msg = COACH_LINES[Math.min(2, coachStep)];
    const boxW = Math.min(W - 80, 420);
    const y = H - 150;
    ctx.fillStyle = 'rgba(6,10,24,.84)';
    ctx.strokeStyle = 'rgba(253,224,71,.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(W / 2 - boxW / 2, y - 28, boxW, 48);
    ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 12px system-ui';
    ctx.fillText('LUMO SAYS', W / 2, y - 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px system-ui';
    ctx.fillText(msg, W / 2, y + 11);
  }

  function draw() {
    ctx.save();
    if (shakeT > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#111827'); sky.addColorStop(0.55, '#1e1b4b'); sky.addColorStop(1, '#14532d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const now = performance.now();
    for (const s of STARS) {
      ctx.globalAlpha = s.a * (reduceMotion ? 0.8 : 0.7 + 0.3 * Math.sin(now * 0.001 + s.p));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // garden glow at the floor
    ctx.fillStyle = 'rgba(34,197,94,.16)';
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(i * 82 + 20, H - 30, 20 + (i % 3) * 8, 0, Math.PI * 2); ctx.fill(); }

    // danger line
    ctx.strokeStyle = 'rgba(244,63,94,.5)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(W, DANGER_Y); ctx.stroke(); ctx.setLineDash([]);

    // board
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c]) drawBubble(grid[r][c]);

    // aim guide
    if (run && !finished && !paused) {
      ctx.strokeStyle = 'rgba(253,224,71,.45)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
      const a = Math.atan2(aim.y - (LAUNCHER.y - 20), aim.x - LAUNCHER.x);
      ctx.beginPath(); ctx.moveTo(LAUNCHER.x, LAUNCHER.y - 24);
      ctx.lineTo(LAUNCHER.x + Math.cos(a) * 120, LAUNCHER.y - 24 + Math.sin(a) * 120); ctx.stroke(); ctx.setLineDash([]);
    }

    // flying bubbles
    for (const f of flying) {
      ctx.fillStyle = f.b.type === 'rainbow' ? '#fde047' : f.b.color;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(f.x, f.y, R - 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (f.b.type === 'shadow') { ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, Math.PI * 2); ctx.fill(); }
    }

    drawLumo();

    // launcher bubble + preview
    if (current) {
      const cb = { ...current, x: LAUNCHER.x, y: LAUNCHER.y - 40, wobble: 0 };
      drawBubble(cb);
    }
    if (preview) {
      ctx.globalAlpha = 0.5;
      const pb = { ...preview, x: LAUNCHER.x + 66, y: LAUNCHER.y - 8, wobble: 0 };
      drawBubble(pb);
      ctx.globalAlpha = 1;
    }

    for (const p of bits) {
      ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.a); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // boss bar
    if (bossMax > 0 && bossHp > 0) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(W / 2 - 140, 4, 280, 10);
      ctx.fillStyle = '#a855f7'; ctx.fillRect(W / 2 - 140, 4, 280 * (bossHp / bossMax), 10);
      ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.fillText('GRUMBLE-GRIT ' + bossHp + '/' + bossMax, W / 2, 28);
    }

    if (run && !finished && !paused && coachT > 0) drawCoach();

    if (!run && !finished) {
      ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = '30px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Tap Start wave', W / 2, H / 2);
    }
    ctx.restore();
  }

  // ── INPUT / WIRING ─────────────────────────────────────────────────────────
  function aimAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    aim.x = Math.max(0, Math.min(W, (clientX - rect.left) / rect.width * W));
    aim.y = Math.max(0, Math.min(H, (clientY - rect.top) / rect.height * H));
  }
  function canvasScale() { const rect = canvas.getBoundingClientRect(); return rect.width ? W / rect.width : 1; }
  function logicalScreenPx(px) { return Math.max(1, Math.min(220, px * canvasScale())); }
  function tapRadius() { return coarsePointer ? Math.max(44, logicalScreenPx(44)) : 30; }

  canvas.addEventListener('pointermove', (e) => aimAt(e.clientX, e.clientY));
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    aimAt(e.clientX, e.clientY);
    if (!run || paused || finished) return;
    shoot();
  });

  window.addEventListener('keydown', (event) => {
    const tag = (event.target && event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault();
      if (!run && !finished) startRun();
      else if (run && !paused) shoot();
      return;
    }
    if (event.code === 'Enter' && !run && !finished) { event.preventDefault(); startRun(); return; }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (run && !finished) { event.preventDefault(); togglePause(); }
      return;
    }
    if (event.code === 'KeyB' && run && !paused) { event.preventDefault(); useBurst(); return; }
    if (event.code === 'KeyS' && run && !paused) { event.preventDefault(); useSlow(); return; }
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
  $('a11yBox').addEventListener('change', (event) => {
    textMode = !!event.target.checked;
    lsSet('jvds_lumo_textmode', textMode ? '1' : '0');
    if (textMode) announce('Screen-reader game messages on.');
    else { const el = $('srStatus'); if (el) el.textContent = ''; }
  });
  $('hapticsBox').addEventListener('change', (event) => {
    hapticsOn = !!event.target.checked;
    lsSet('jvds_lumo_haptics', hapticsOn ? '1' : '0');
    if (hapticsOn) vibrate(12);
  });
  $('diffPills').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-diff]');
    if (btn) setDifficulty(btn.dataset.diff);
  });
  $('modePills').addEventListener('click', (event) => {
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
    const onMotionChange = (event) => {
      reduceMotion = event.matches;
      if (reduceMotion) { bits = []; shakeT = 0; }
    };
    if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', onMotionChange);
    else if (reducedQuery.addListener) reducedQuery.addListener(onMotionChange);
  }
  if (coarseQuery) {
    const onPointerChange = (event) => { coarsePointer = event.matches; };
    if (coarseQuery.addEventListener) coarseQuery.addEventListener('change', onPointerChange);
    else if (coarseQuery.addListener) coarseQuery.addListener(onPointerChange);
  }

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const scale = Math.min(canvas.width / W, canvas.height / H);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);
  setTimeout(fit, 30);
  setTimeout(fit, 250);

  // Lifetime meta line, injected so the shared markup stays untouched
  if (!document.querySelector('.ff-meta')) {
    const bestLine = document.querySelector('.ff-best');
    if (bestLine && bestLine.parentNode) {
      const metaLine = document.createElement('p');
      metaLine.className = 'ff-meta';
      metaLine.style.cssText = 'margin:6px 0 0;color:#fde68a;font-weight:800;font-size:.82rem;';
      bestLine.parentNode.insertBefore(metaLine, bestLine.nextSibling);
    }
  }

  syncOptions();
  updateMotionAndToggles();
  renderLanterns();
  resetRun();
  updateSummary();
  updateHud(true);
  requestAnimationFrame(loop);

  window.__lumoFirefly = {
    state: () => ({
      running: run, paused, finished, result, score, wave, glow, combo, comboTimer, maxCombo,
      threats, target, fireflies, shotsFired, shotsHit, wavesCleared, bossAlive: bossHp > 0, bossKills,
      bossHp, bossMax, waveFireflies, clearedThisWave, boardComplete,
      power: { ...power }, burst, slow, slowT, freezeShots, mode, difficulty, seed, best,
      soundOn, hapticsOn, textMode, reduceMotion, coarsePointer, tapRadius: tapRadius(),
      bugs: allBubbles().filter(b => b.type === 'firefly' || b.type === 'shadow' || b.type === 'moth' || b.type === 'boss').map(b => b.type),
      drops: [], startShown: !$('startScreen')?.classList.contains('hidden'),
      pauseShown: !$('pauseOverlay')?.classList.contains('hidden'),
      modal: !!document.querySelector('.sr-modal.show'), stats: { ...test },
      metaRescued: meta.rescued, board: allBubbles().length, glyphs: GLYPHS.slice(),
      coachActive: coachT > 0, coachStep, coachDone,
      lantern, lanternColour: lanternColour(), lanterns: LANTERNS.length
    }),
    start: startRun,
    restart: restartRun,
    pause: () => togglePause(true),
    resume: () => togglePause(false),
    togglePause: () => togglePause(),
    shoot,
    aim: (x, y) => { aim.x = Math.max(0, Math.min(W, x)); aim.y = Math.max(0, Math.min(H, y)); },
    setDifficulty, setMode, setSeed,
    setScore: value => { score = Math.max(0, Math.round(value)); updateHud(true); },
    setGlow: value => { glow = Math.max(0, Math.min(100, value)); updateHud(true); },
    setWave: value => { beginBoard(Math.max(1, Math.round(value))); updateHud(true); },
    damage: value => damageGarden(Math.max(0, value)),
    powerup: kind => applyDrop(kind),
    drop: (kind, x, y) => { floaters.push({ x: x ?? W / 2, y: y ?? 200, text: String(kind), a: 1, vy: -40, color: '#fde047' }); },
    spawn: type => {
      let free = null;
      for (let r = ROWS - 1; r >= 0 && !free; r--) for (let c = 0; c < COLS; c++) if (!grid[r][c]) { free = [r, c]; break; }
      if (!free) return null;
      const kind = type || (rng() < 0.45 ? 'shadow' : rng() < 0.5 ? 'moth' : rng() < 0.3 ? 'firefly' : 'normal');
      const b = makeBubble(kind, pickBoardColour());
      placeBubble(free[0], free[1], b);
      test.spawned++;
      updateHud(true);
      return b;
    },
    collect: type => {
      const b = makeBubble(type || 'firefly', '#fde047');
      b.x = W / 2; b.y = 120;
      rescueFirefly(b);
      updateHud(true);
    },
    kill: type => {
      const b = window.__lumoFirefly.spawn(type || 'shadow');
      if (b) {
        grid[b.r][b.c] = null;
        if (b.type === 'shadow' || b.type === 'moth') threats++;
        test.hits++;
      }
      updateHud(true);
    },
    clearWave: () => {
      if (!run || finished) return;
      if (mode === 'story' && wave >= STORY_WAVES) { wavesCleared++; finishRun('success'); return; }
      wavesCleared++;
      beginBoard(wave + 1);
    },
    finish: outcome => finishRun(outcome || 'success'),
    addScore: value => { scoreAdd(Math.max(0, Math.round(value))); },
    makeRunCard: () => { try { return makeRunCard().toDataURL('image/png'); } catch (e) { return ''; } },
    burstAll: useBurst,
    slowPollen: useSlow,
    shareLink,
    onScreen: () => allBubbles().filter(b => b.type === 'firefly' || b.type === 'shadow' || b.type === 'moth' || b.type === 'boss').map(b => b.type),
    debug: {
      board: () => allBubbles().map(b => ({ r: b.r, c: b.c, type: b.type, color: b.color, hp: b.hp })),
      count: () => allBubbles().length,
      clear: () => { makeGrid(); updateHud(true); return true; },
      place: (r, c, type, color) => {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || grid[r][c]) return false;
        placeBubble(r, c, makeBubble(type || 'normal', color || COLOURS[0]));
        return true;
      },
      groupAt: (r, c) => findGroup(r, c).length,
      resolveAt: (r, c) => {
        const group = findGroup(r, c);
        if (group.length < 3) return 0;
        clearGroup(group);
        return group.length;
      },
      dropFloating: () => { const before = allBubbles().length; dropFloating(); return before - allBubbles().length; },
      pushRow: () => { pushShadowRow(true); return allBubbles().length; },
      setBoss: (hp) => { bossHp = Math.max(0, hp | 0); bossMax = Math.max(bossMax, bossHp); return bossHp; },
      bossDamage: (n) => { bossHp = Math.max(0, bossHp - Math.max(0, n | 0)); return bossHp; },
      cell: (r, c) => ({ x: cellX(r, c), y: cellY(r) }),
      colours: () => COLOURS.slice(),
      glyphs: () => GLYPHS.slice(),
      glyphFor: (colour) => glyphFor(colour),
      endCoach: () => { finishCoach(); return coachDone; },
      lanterns: () => LANTERNS.map(l => ({ id: l.id, name: l.name, colour: l.colour, unlock: l.unlock, unlocked: lanternUnlocked(l) })),
      setMetaRescued: (n) => { meta.rescued = Math.max(0, n | 0); renderLanterns(); return meta.rescued; },
      pickLantern: (id) => {
        const l = LANTERNS.find(x => x.id === id);
        if (!l || !lanternUnlocked(l)) return false;
        lantern = l.id; lsSet('jvds_ff_lantern', l.id); renderLanterns(); updateHud(true); return true;
      },
      lanternColour: () => lanternColour()
    },
    reset: () => { resetRun(); hideStart(); hidePause(); }
  };
})();
