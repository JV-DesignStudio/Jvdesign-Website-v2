(function(){
const C = document.getElementById('game'), ctx = C.getContext('2d');
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
const sys = window.GameSystem ? new GameSystem('crossy-crew','Crossy Crew','pip') : null;
const storyRun = window.__storyRun = window.StoryRun ? new StoryRun({
  id:'crossy-crew', gameSystem:sys, title:'Crossy Crew', character:'Pip',
  open:'Pip and Echo are at the edge of a busy crossing and the road stretches on forever.',
  objective:'Hop as far as you can without getting squished or swept away.',
  beats:[{at:0,text:'The first road has slow traffic. Time it.'},{at:.4,text:'Rivers appear. Ride the logs across.'},{at:.8,text:'Traffic is thick, trains run, and the logs are small.'}],
  cap:300,
  result:{
    success:'Pip and Echo reach the meadow on the far side.',
    partial:'Close call. One more hop and they would have made it.',
    fail:'Splat. But they study the traffic pattern for next time.'
  },
  onRestart:function(){ startGame(); }
}) : null;

let W, H, dpr;
const COLS = 9;
const VISIBLE_ROWS = 12;
let cellW, cellH;
let running = false, dead = false;
let player, rows, cameraY, furthest, score, coins, hops;
let echo = null, combo = 0, comboPop = 0, shield = false, magnetT = 0, slowT = 0, graceT = 0;
let forwardStreak = 0;
let secondUsed = false, savedPending = false, pendingReason = '';
let best = (sys ? GameSystem.getBestScore('crossy-crew') : 0) || 0;

const CREW = [
  {id:'pip',      name:'Pip',      emoji:'🐢', unlock:null},
  {id:'echo',     name:'Echo',     emoji:'🐟', unlock:{type:'score',n:200}},
  {id:'stardust', name:'Stardust', emoji:'⭐', unlock:{type:'score',n:500}},
  {id:'lumo',     name:'Lumo',     emoji:'🦊', unlock:{type:'score',n:1000}},
];
let selectedChar = 'pip';
try { selectedChar = localStorage.getItem('jvds_cc_char') || 'pip'; } catch(e) {}
function isUnlocked(c) { return !c.unlock || best >= c.unlock.n; }
if (!CREW.find(c => c.id === selectedChar && isUnlocked(c))) selectedChar = 'pip';

let last = 0, idleTimer = 0, particles = [], popups = [], motes = [];
let lastBiomeName = '';
let hopAnim = 0;
let vignette = null, vigKey = '';

const MISSION = [10, 25, 50, 100];
const milestones = window.JVDSShowcase ? new JVDSShowcase.Milestones(MISSION, function (m) {
  toast('Goal reached: ' + m + ' rows!');
  try { audio?.playSuccess?.(); } catch(e) {}
  for (let i = 0; i < 14; i++) {
    particles.push({ x: player.col * cellW + cellW / 2, y: screenY(player.row) + cellH / 2, vx: (Math.random() - .5) * 240, vy: -Math.random() * 240, life: 1, color: '#86efac', size: 3 });
  }
  popups.push({ x: W / 2, y: H * .3, text: 'GOAL ' + m, life: 1.4, color: '#bbf7d0', size: 26 });
}) : null;
const shake = window.JVDSShowcase ? new JVDSShowcase.Shake(14) : null;
let dustTimer = 0;

// Read-only debug handle so tests can verify mobile movement, death state and
// showcase progression without poking at canvas pixels.
window.__crossy = {
  get col() { return player ? player.col : -1; },
  get row() { return player ? player.row : -1; },
  get hops() { return hops; },
  get score() { return score; },
  get dead() { return dead; },
  get running() { return running; },
  get milestone() { return milestones ? milestones.next() : null; },
  get shake() { return shake ? shake.amount : 0; },
  get shakeHits() { return shake ? shake.hits : 0; },
  get echo() { return !!echo; },
  get hasCompanion() { return !!echo; },
  get combo() { return combo; },
  get shield() { return shield; },
  get magnet() { return magnetT > 0; },
  get slow() { return slowT > 0; },
  get zone() { return furthest == null ? '' : biomeAt(furthest).name; },
  get forwardStreak() { return forwardStreak; },
  get selectedChar() { return selectedChar; },
  get crew() { return CREW.map(c => ({ id:c.id, name:c.name, emoji:c.emoji, unlocked:isUnlocked(c) })); }
};
// Narrow test hooks so the browser suite can reach the new systems without
// poking at canvas pixels. Not used by gameplay.
window.__crossyTest = {
  setCoins: n => { coins = n; hud(); },
  grant: k => applyPower(k),
  kill: r => die(r || 'Test splat'),
  restart: () => startGame(),
  forcePowerRow: () => { const r = getRow(player.row); r.hasPower = { col: player.col, kind: 'shield' }; }
};

const ROAD = 'road', RIVER = 'river', GRASS = 'grass', SAFE = 'safe', RAIL = 'rail';
const carColors = ['#ef4444','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#e11d48'];
const trainColors = ['#dc2626','#2563eb','#facc15','#16a34a','#7c3aed'];
const flowerColors = ['#f9a8d4','#fcd34d','#fca5a5','#c4b5fd','#fdba74'];

// Biomes cycle every 40 rows: 8 environments each with distinct flora and weather.
const BIOMES = [
  { name:'Meadow',   grassA:'#4f9d5d', grassB:'#459153', tree:'#2f7d43', treeDark:'#1e5a2f', bg:'#123322', tint:null,                    water:'#2f6fb0', weather:null },
  { name:'Autumn',   grassA:'#8b9a3f', grassB:'#7e8f37', tree:'#c06f2a', treeDark:'#8a4a1c', bg:'#2a2415', tint:'rgba(214,150,50,.10)',  water:'#2b6499', weather:null },
  { name:'Twilight', grassA:'#3a716b', grassB:'#346661', tree:'#2a5a58', treeDark:'#1e4241', bg:'#0e1e2c', tint:'rgba(46,74,150,.16)',   water:'#26527e', weather:null },
  { name:'Desert',   grassA:'#c8a86b', grassB:'#b8994f', tree:'#5a8a3a', treeDark:'#3d6025', bg:'#3d2a0e', tint:'rgba(200,140,60,.08)', water:'#4a7a9b', weather:null },
  { name:'Snow',     grassA:'#d4e8f0', grassB:'#c2d8e6', tree:'#2d5a3a', treeDark:'#1e3f28', bg:'#0d1828', tint:'rgba(180,220,255,.08)',water:'#3a7a9a', weather:'snow' },
  { name:'Beach',    grassA:'#d4b96e', grassB:'#c8a85a', tree:'#2a7a3a', treeDark:'#1e5828', bg:'#192e1a', tint:'rgba(200,180,100,.06)',water:'#1e88b4', weather:null },
  { name:'City',     grassA:'#5a6068', grassB:'#505660', tree:'#3a4248', treeDark:'#2a3038', bg:'#1a1e24', tint:'rgba(30,50,80,.12)',   water:'#2a4866', weather:'rain' },
  { name:'Night',    grassA:'#2a3a4a', grassB:'#243040', tree:'#1e2e3e', treeDark:'#141e2a', bg:'#050810', tint:'rgba(20,20,60,.20)',   water:'#182438', weather:'firefly' }
];
function biomeAt(row) { return BIOMES[Math.floor(Math.max(0, row) / 40) % BIOMES.length]; }

const pick = a => a[Math.floor(Math.random() * a.length)];
function rnd(seed) { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function fit() {
  const r = C.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.round(r.width * dpr);
  H = Math.round(r.height * dpr);
  C.width = W; C.height = H;
  cellW = W / COLS;
  cellH = H / VISIBLE_ROWS;
  vigKey = '';
}

function rr(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(x, y, w, h, r, color) { ctx.fillStyle = color; rr(x, y, w, h, r); ctx.fill(); }

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 700);
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .5) * 200,
      life: 1, color, size: 2 + Math.random() * 3
    });
  }
}

// Item geometry is stored in cell units (x/w as fractions of a column, h as a
// fraction of a row) so a resize never leaves stale pixel sizes behind.
function makeDecor(type, index) {
  const decor = [];
  const biome = biomeAt(index);
  if (type === GRASS || type === SAFE) {
    for (let c = 0; c < COLS; c++) {
      const g = rnd(index * 31 + c * 7);
      if (biome.name === 'Desert') {
        if (g < .10) decor.push({ kind:'sandswirl', u: c+.3+g*.4, v:.5+rnd(c+index)*.3 });
      } else if (biome.name === 'Snow') {
        if (g < .24) decor.push({ kind:'snowdrift', u: c+.2+g*.4, v:.52+rnd(c+index)*.3 });
      } else if (biome.name === 'Beach') {
        if (g < .18) decor.push({ kind:'shell', u: c+.2+g, v:.4+rnd(c+index)*.4, c:pick(['#f9e4b7','#f0c28a','#e8a87c']) });
        else if (g < .24) decor.push({ kind:'seaweed', u: c+.4+g*.3, v:.3+rnd(c*2+index)*.4 });
      } else if (biome.name === 'City') {
        if (g < .10) decor.push({ kind:'puddle', u: c+.3+g*.5, v:.5+rnd(c+index)*.3 });
      } else if (biome.name === 'Night') {
        if (g < .08) decor.push({ kind:'mushroom', u: c+.3+g, v:.45+rnd(c+index)*.3 });
      } else {
        if (g < .18) decor.push({ kind: 'flower', u: c + .2 + g, v: .35 + rnd(c + index) * .3, c: biome.name === 'Twilight' ? pick(['#c4b5fd','#818cf8','#93c5fd']) : pick(flowerColors) });
        else if (g < .3) decor.push({ kind: 'tuft', u: c + .3 + g, v: .3 + rnd(c * 3 + index) * .4 });
        else if (g < .36) decor.push({ kind: 'stone', u: c + .4, v: .6 + rnd(c + index * 5) * .2 });
      }
    }
  } else if (type === ROAD) {
    for (let c = 0; c < COLS; c += 2) {
      if (rnd(index * 17 + c) < .3) decor.push({ kind: 'patch', u: c + .3, v: .2 + rnd(c + index) * .5 });
    }
    if (rnd(index) < .5) decor.push({ kind: 'manhole', u: .5 + rnd(index * 3) * (COLS - 1), v: .5 });
  } else if (type === RIVER) {
    if (rnd(index) < .6) decor.push({ kind: 'lily', u: .4 + rnd(index * 2) * (COLS - 1), v: .25 + rnd(index * 9) * .5 });
    decor.push({ kind: 'reed', u: .1, v: .2 });
    decor.push({ kind: 'reed', u: COLS - .1, v: .55 });
  } else if (type === RAIL) {
    for (let i = 0; i < 26; i++) decor.push({ kind: 'gravel', u: rnd(index * 41 + i) * COLS, v: rnd(index * 13 + i * 3) });
  }
  return decor;
}

function makeTreeRow(index) {
  const trees = [];
  const biome = biomeAt(index);
  const density = biome.name === 'City' ? .18 : biome.name === 'Desert' ? .13 : .26;
  for (let c = 0; c < COLS; c++) {
    if (rnd(index * 53 + c * 11) < density) {
      let kind = 'tree';
      if (biome.name === 'Desert') kind = 'cactus';
      else if (biome.name === 'Beach') kind = 'palm';
      else if (biome.name === 'City') kind = 'building';
      else if (biome.name === 'Night' && rnd(index * 7 + c * 3) < .35) kind = 'lamp';
      const conifer = kind === 'tree' && (biome.name === 'Snow' || rnd(index * 7 + c) < .3);
      trees.push({ col: c, size: .85 + rnd(index + c) * .4, lean: (rnd(c * 5 + index) - .5) * 6, conifer, kind });
    }
  }
  return trees;
}

function maybePower(index) {
  if (index < 6) return null;
  if (Math.random() < .09) return { col: Math.floor(Math.random() * COLS), kind: ['shield', 'magnet', 'slow', 'dash'][Math.floor(Math.random() * 4)] };
  return null;
}

function makeRow(index) {
  if (index <= 0) return { type: SAFE, items: [], decor: makeDecor(SAFE, 0), hasCoin: -1, index };

  const difficulty = Math.min(1, index / 60);
  const biome = biomeAt(index);
  const r = Math.random();

  if (index % 8 === 0) {
    return { type: GRASS, items: makeTreeRow(index), decor: makeDecor(GRASS, index), biome, index, hasCoin: Math.random() < .3 ? Math.floor(Math.random() * COLS) : -1, hasPower: maybePower(index) };
  }

  if (index > 10 && r < .13) {
    const dir = Math.random() < .5 ? 1 : -1;
    const spd = (2.4 + Math.random() * 1.6 + difficulty * 1.8) * dir;
    const count = Math.random() < .35 ? 2 : 1;
    const trains = [];
    for (let i = 0; i < count; i++) {
      trains.push({
        x: i * COLS * .62 + (Math.random() - .5),
        w: 2.4 + Math.random() * 1.8,
        h: .62,
        color: trainColors[(index + i) % trainColors.length],
        cars: Math.round(2 + Math.random() * 2)
      });
    }
    return { type: RAIL, items: trains, speed: spd, biome, decor: makeDecor(RAIL, index), index, hasCoin: -1 };
  }

  if (r < .5) {
    const dir = Math.random() < .5 ? 1 : -1;
    const spd = (0.55 + Math.random() * .7 + difficulty * 1.2) * dir;
    const count = 2 + Math.floor(Math.random() * 2 + difficulty);
    const gap = COLS / count;
    const cars = [];
    for (let i = 0; i < count; i++) {
      const truck = difficulty > .12 && Math.random() < .22;
      const cw = truck ? (1.9 + Math.random() * .7) : (1.0 + Math.random() * .5);
      cars.push({
        x: i * gap + (Math.random() - .5) * .7,
        w: cw, h: truck ? .74 : .62,
        color: pick(carColors), kind: truck ? 'truck' : 'car'
      });
    }
    return { type: ROAD, items: cars, speed: spd, biome, decor: makeDecor(ROAD, index), index, hasCoin: Math.random() < .25 ? Math.floor(Math.random() * COLS) : -1 };
  }

  if (r < .78 && index > 5) {
    const dir = Math.random() < .5 ? 1 : -1;
    const spd = (0.4 + Math.random() * .5 + difficulty * .7) * dir;
    const count = 2 + Math.floor(Math.random() * 2);
    const gap = COLS / count;
    const logs = [];
    for (let i = 0; i < count; i++) {
      logs.push({
        x: i * gap + (Math.random() - .5) * .9,
        w: Math.max(1.1, 1.4 + Math.random() * 1.4 - difficulty * .3),
        h: .68
      });
    }
    return { type: RIVER, items: logs, speed: spd, biome, decor: makeDecor(RIVER, index), index, hasCoin: Math.random() < .3 ? Math.floor(Math.random() * COLS) : -1 };
  }

  return { type: GRASS, items: makeTreeRow(index), decor: makeDecor(GRASS, index), biome, index, hasCoin: Math.random() < .35 ? Math.floor(Math.random() * COLS) : -1, hasPower: maybePower(index) };
}

function getRow(index) {
  if (!rows[index]) rows[index] = makeRow(index);
  return rows[index];
}

function reset() {
  player = { col: Math.floor(COLS / 2), row: 0, x: 0, y: 0, targetX: 0, targetY: 0, onLog: null, alive: true, facing: 'up' };
  rows = {};
  rows[0] = { type: SAFE, items: [], decor: makeDecor(SAFE, 0), hasCoin: -1, index: 0 };
  for (let i = -2; i < VISIBLE_ROWS + 5; i++) getRow(i);
  cameraY = 0;
  furthest = 0;
  score = 0;
  coins = 0;
  hops = 0;
  idleTimer = 0;
  particles = [];
  popups = [];
  motes = [];
  hopAnim = 0;
  dustTimer = 0;
  combo = 0; comboPop = 0; shield = false; magnetT = 0; slowT = 0; graceT = 0;
  forwardStreak = 0;
  lastBiomeName = '';
  secondUsed = false; savedPending = false; pendingReason = '';
  if (milestones) milestones.reset();
  if (shake) shake.reset();
  syncPlayerPos();
  echo = { col: player.col, row: player.row, x: player.targetX, y: player.targetY, targetX: player.targetX, targetY: player.targetY, facing: 'up', hopAnim: 0 };
}

function syncPlayerPos() {
  player.targetX = player.col * cellW + cellW / 2;
  player.targetY = screenY(player.row);
}

function screenY(row) {
  return H - (row - cameraY) * cellH - cellH;
}

function hop(dx, dy) {
  if (!running || dead) return;
  const newCol = player.col + dx;
  const newRow = player.row + dy;

  if (newCol < 0 || newCol >= COLS) return;

  const targetRow = getRow(newRow);
  if (targetRow.type === GRASS && targetRow.items.some(t => t.col === newCol)) return;

  const fromRow = getRow(player.row);
  const oldPx = player.col * cellW + cellW / 2;

  if (echo) {
    echo.col = player.col; echo.row = player.row;
    echo.facing = player.facing; echo.hopAnim = .15;
  }

  player.col = newCol;
  player.row = newRow;
  player.onLog = null;
  if (dy > 0) player.facing = 'up';
  else if (dy < 0) player.facing = 'down';
  else if (dx > 0) player.facing = 'right';
  else if (dx < 0) player.facing = 'left';
  hops++;
  hopAnim = .15;

  if (dy > 0) {
    forwardStreak++;
    if (forwardStreak > 1 && forwardStreak % 5 === 0) {
      const bonus = forwardStreak * 5;
      score += bonus;
      popups.push({ x: player.col * cellW + cellW / 2, y: screenY(player.row) + cellH * .2, text: forwardStreak + ' STREAK! +' + bonus, life: 1.2, color: '#fde047', size: 16 });
    }
  } else {
    forwardStreak = 0;
  }

  if (newRow > furthest) {
    const diff = newRow - furthest;
    furthest = newRow;
    score += diff * 10;
    if (milestones) milestones.check(furthest);
  }

  // Near-miss: leaving a busy road or rail just as a vehicle sweeps through.
  let near = false;
  if (fromRow.type === ROAD || fromRow.type === RAIL) {
    for (const v of fromRow.items) {
      const vl = v.x * cellW, vr = vl + v.w * cellW;
      const gap = Math.max(vl - oldPx, oldPx - vr);
      if (gap < cellW * .7) { near = true; break; }
    }
  }
  if (near) {
    combo++;
    comboPop = 1;
    score += 20 * combo;
    popups.push({ x: player.col * cellW + cellW / 2, y: screenY(player.row) + cellH * .3, text: 'COMBO x' + combo, life: 1, color: '#fde047', size: 18 });
    if (shake) shake.hit(4 + combo);
    try { audio?.playSuccess?.(); } catch(e) {}
  } else if (combo > 0 && fromRow.type === GRASS) {
    combo = 0;
  }

  if (targetRow.hasCoin === newCol) {
    targetRow.hasCoin = -1;
    coins++;
    score += 50;
    burst(player.col * cellW + cellW / 2, screenY(player.row) + cellH / 2, '#fbbf24', 10);
    popups.push({ x: player.col * cellW + cellW / 2, y: screenY(player.row) + cellH * .4, text: '+50', life: 1, color: '#fbbf24', size: 20 });
    toast('+Coin!');
    vibrate(18);
    try { audio?.playSuccess?.(); } catch(e) {}
  } else {
    try { audio?.playTap?.(); } catch(e) {}
  }

  if (targetRow.hasPower && targetRow.hasPower.col === newCol) {
    applyPower(targetRow.hasPower.kind);
    targetRow.hasPower = null;
  }

  idleTimer = 0;
  syncPlayerPos();
  hud();
}

function applyPower(kind) {
  const px = player.col * cellW + cellW / 2, py = screenY(player.row) + cellH / 2;
  if (kind === 'shield') { shield = true; toast('Leaf shield!'); }
  else if (kind === 'magnet') { magnetT = 8; toast('Coin magnet!'); }
  else if (kind === 'slow') { slowT = 6; toast('Slow time!'); }
  else if (kind === 'dash') { toast('Dash! Hop x2!'); hop(0, 1); hop(0, 1); }
  burst(px, py, '#a7f3d0', 12);
  popups.push({ x: px, y: py - cellH * .3, text: kind.toUpperCase(), life: 1, color: '#a7f3d0', size: 18 });
  try { audio?.playSuccess?.(); } catch(e) {}
}

function startGame() {
  reset();
  running = true;
  dead = false;
  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  if ('ontouchstart' in window) $('dpad').style.display = 'grid';
  sys?.beginRun?.();
  if (storyRun && !storyRun.running) storyRun.begin();
  last = performance.now();
}

function die(reason) {
  if (!player.alive || savedPending) return;
  if (shield) {
    shield = false;
    graceT = 1.4;
    combo = 0;
    burst(player.x || player.targetX, (player.y || player.targetY) + cellH / 2, '#a7f3d0', 18);
    toast('Leaf shield saved you!');
    try { audio?.playError?.(); } catch(e) {}
    return;
  }
  if (!secondUsed && coins >= 5) {
    savedPending = true;
    pendingReason = reason;
    running = false;
    dead = true;
    const t = $('saveMeText');
    if (t) t.textContent = 'Spend 5 coins to be put back on solid ground? You have ' + coins + ' coins.';
    $('saveMeScreen').classList.remove('hidden');
    return;
  }
  gameOver(reason);
}

function gameOver(reason) {
  player.alive = false;
  dead = true;
  running = false;
  savedPending = false;
  if (shake) shake.hit(16);
  burst(player.x || player.targetX, player.y || player.targetY, '#ef4444', 20);
  try { audio?.playError?.(); } catch(e) {}
  if (score > best) {
    best = score;
    if (sys) GameSystem.saveScore('crossy-crew', best);
  }
  sys?.saveState?.();
  if (sys) { const charName = CREW.find(c => c.id === selectedChar)?.name || 'You'; sys.addToLeaderboard(charName, score); }
  updateCrewUI();
  toast(reason);
  if (storyRun) {
    storyRun.finish(score > 200 ? 'success' : 'fail', score);
  } else {
    showEnd(reason);
  }
}

function revive() {
  secondUsed = true;
  savedPending = false;
  coins = Math.max(0, coins - 5);
  dead = false;
  running = true;
  player.alive = true;
  graceT = 2;
  combo = 0;
  idleTimer = 0;
  player.row -= 1;
  const r = getRow(player.row);
  if (r.items) {
    const px = player.col * cellW + cellW / 2;
    r.items = r.items.filter(v => { const vl = v.x * cellW, vr = vl + v.w * cellW; return !(px > vl - cellW * .6 && px < vr + cellW * .6); });
  }
  player.onLog = null;
  $('saveMeScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  last = performance.now();
  syncPlayerPos();
  hud();
  toast('Second chance!');
}

function surrender() {
  savedPending = false;
  $('saveMeScreen').classList.add('hidden');
  gameOver(pendingReason || 'Squished!');
}

function showEnd(reason) {
  $('endTitle').textContent = score > 500 ? 'Epic Crossing!' : score > 200 ? 'Nice Hops!' : (reason || 'Squished!');
  $('endStats').innerHTML = [
    ['Score', score], ['Distance', furthest], ['Coins', coins], ['Best', best]
  ].map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  const lb = sys ? sys.getLeaderboard().slice(0, 5) : [];
  const lbWrap = $('lbWrap');
  if (lbWrap) {
    lbWrap.innerHTML = lb.length
      ? '<p style="font-size:11px;color:#64748b;margin:0 0 4px;text-align:center">TOP RUNS</p>' +
        lb.map((e, i) => '<div class="lb-row"><span>' + (i + 1) + '. ' + e.name + '</span><b>' + e.score + '</b></div>').join('')
      : '';
    lbWrap.style.display = lb.length ? '' : 'none';
  }
  const shareBtn = $('shareBtn');
  if (shareBtn) shareBtn.style.display = '';
  $('endScreen').classList.remove('hidden');
}

function shareRunCard() {
  const oc = document.createElement('canvas');
  oc.width = 560; oc.height = 320;
  const c2 = oc.getContext('2d');
  const char = CREW.find(c => c.id === selectedChar) || CREW[0];
  c2.fillStyle = '#0f2318'; c2.fillRect(0, 0, 560, 320);
  c2.fillStyle = '#16a34a'; c2.fillRect(0, 0, 560, 6);
  c2.font = '72px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillText(char.emoji, 100, 130);
  c2.fillStyle = '#4ade80'; c2.font = '900 26px system-ui,sans-serif'; c2.textAlign = 'left';
  c2.fillText('Crossy Crew', 170, 72);
  c2.fillStyle = '#86efac'; c2.font = '600 17px system-ui,sans-serif';
  c2.fillText('Playing as ' + char.name, 170, 100);
  const stats = [['Score', score], ['Distance', furthest + ' rows'], ['Coins', coins], ['Best', best]];
  stats.forEach(([l, v], i) => {
    const col = 170 + (i % 2) * 192, row = 138 + Math.floor(i / 2) * 42;
    c2.fillStyle = '#475569'; c2.font = '500 14px system-ui,sans-serif'; c2.fillText(l, col, row);
    c2.fillStyle = '#e2e8f0'; c2.font = '700 20px system-ui,sans-serif'; c2.fillText(v, col, row + 22);
  });
  c2.fillStyle = '#1e3a2e'; c2.fillRect(0, 272, 560, 48);
  c2.fillStyle = '#4ade80'; c2.font = '500 13px system-ui,sans-serif'; c2.textAlign = 'center';
  c2.fillText('jvdesignstudio.co.uk - Free games for young creators', 280, 300);
  const link = document.createElement('a');
  link.download = 'crossy-crew-' + score + '.png';
  link.href = oc.toDataURL('image/png');
  link.click();
}

function buildCrewSelect() {
  const wrap = $('crewSelect');
  if (!wrap) return;
  updateCrewUI();
}

function updateCrewUI() {
  const wrap = $('crewSelect');
  if (!wrap) return;
  wrap.innerHTML = CREW.map(c => {
    const unlocked = isUnlocked(c);
    const sel = selectedChar === c.id;
    let progressHtml = '';
    if (!unlocked && c.unlock) {
      const pct = Math.min(100, Math.round(best / c.unlock.n * 100));
      progressHtml = '<div class="unlock-bar"><div class="unlock-fill" style="width:' + pct + '%"></div></div>' +
        '<span style="font-size:10px;opacity:.7">' + best + ' / ' + c.unlock.n + '</span>';
    }
    return '<button class="crew-btn' + (sel ? ' selected' : '') + (unlocked ? '' : ' locked') + '"' +
      ' data-char="' + c.id + '"' + (unlocked ? '' : ' disabled') +
      ' title="' + (unlocked ? c.name : 'Score ' + c.unlock.n + ' to unlock') + '">' +
      '<span style="font-size:26px">' + c.emoji + '</span>' +
      '<span>' + c.name + '</span>' +
      progressHtml +
      '</button>';
  }).join('');
  wrap.querySelectorAll('.crew-btn:not([disabled])').forEach(btn => {
    btn.onclick = () => {
      selectedChar = btn.dataset.char;
      try { localStorage.setItem('jvds_cc_char', selectedChar); } catch(e) {}
      updateCrewUI();
    };
  });
}

function drawPlayerEmoji(emoji) {
  const px = player.x || player.targetX;
  const py = (player.y || player.targetY) + cellH / 2;
  const t = hopAnim > 0 ? Math.sin(hopAnim / .15 * Math.PI) : 0;
  const bounce = t * 8;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(px, py + cellH * .28, cellW * .3, cellH * .1, 0, 0, Math.PI * 2); ctx.fill();
  const sz = Math.round(cellW * .65);
  ctx.font = sz + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, px, py - bounce);
  ctx.restore();
}

function hud() {
  $('scoreHud').textContent = score;
  $('hopsHud').textContent = hops;
  $('coinsHud').textContent = coins;
  $('bestHud').textContent = best;
  const goal = milestones ? milestones.next() : null;
  $('goalHud').textContent = goal == null ? 'Done' : goal;
  if (storyRun) storyRun.setScore(score);
}

function update(dt) {
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 2;
  });
  particles = particles.filter(p => p.life > 0);

  popups.forEach(p => { p.y -= 34 * dt; p.life -= dt * 1.1; });
  popups = popups.filter(p => p.life > 0);

  // Ambient life: pollen/leaves for calm biomes; weather particles for weather biomes.
  const bioName = biomeAt(furthest || 0).name;
  const curBiome = biomeAt(furthest || 0);
  const wx = curBiome.weather;
  const wxCount = motes.reduce((n, m) => n + (m.wx ? 1 : 0), 0);
  const ambCount = motes.length - wxCount;
  if (wx && wxCount < (wx === 'rain' ? 55 : 30) && Math.random() < (wx === 'rain' ? .85 : .35)) {
    if (wx === 'snow') motes.push({ x: Math.random() * W, y: -4, vx: (Math.random() - .3) * 18, vy: 35 + Math.random() * 25, r: .8 + Math.random() * 1.4, life: 1, bio: bioName, wx: true, type: 'snow' });
    else if (wx === 'rain') motes.push({ x: Math.random() * W, y: -4, vx: -8, vy: 220 + Math.random() * 80, r: .5 + Math.random() * .7, life: 1, bio: bioName, wx: true, type: 'rain' });
    else if (wx === 'firefly') motes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 12, r: 1 + Math.random() * 1.4, life: 1, bio: bioName, wx: true, type: 'firefly' });
  }
  if (!wx && ambCount < 22 && Math.random() < .25) {
    motes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * 14, vy: 8 + Math.random() * 16, r: 1 + Math.random() * 1.8, life: 1, bio: bioName });
  }
  motes.forEach(m => { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= m.wx ? dt * .35 : dt * .05; });
  motes = motes.filter(m => m.life > 0 && m.y < H + 20 && m.x > -20 && m.x < W + 20);

  if (!running || dead) return;

  const curBiomeName = biomeAt(furthest || 0).name;
  if (lastBiomeName && curBiomeName !== lastBiomeName) {
    popups.push({ x: W / 2, y: H * .25, text: curBiomeName.toUpperCase(), life: 1.8, color: '#a5f3fc', size: 22 });
  }
  lastBiomeName = curBiomeName;

  const targetCamY = Math.max(0, furthest - 4);
  cameraY += (targetCamY - cameraY) * Math.min(1, dt * 5);

  idleTimer += dt;
  if (idleTimer > 6) { die('Too slow!'); return; }

  hopAnim = Math.max(0, hopAnim - dt);
  comboPop = Math.max(0, comboPop - dt * 1.5);
  if (graceT > 0) graceT = Math.max(0, graceT - dt);
  if (magnetT > 0) magnetT = Math.max(0, magnetT - dt);
  if (slowT > 0) slowT = Math.max(0, slowT - dt);
  if (echo) {
    echo.targetX = echo.col * cellW + cellW / 2;
    echo.targetY = screenY(echo.row) + cellH / 2;
    echo.x += (echo.targetX - echo.x) * Math.min(1, dt * 12);
    echo.y += (echo.targetY - echo.y) * Math.min(1, dt * 12);
    echo.hopAnim = Math.max(0, echo.hopAnim - dt);
  }

  dustTimer -= dt;
  if (dustTimer <= 0 && window.JVDSShowcase) {
    JVDSShowcase.dust(particles, player.col * cellW + cellW / 2, screenY(player.row) + cellH, '#86efac', 2, { drift: 30, spread: 18, up: 40, size: 1.5 });
    dustTimer = .16;
  }

  const speedScale = slowT > 0 ? .35 : 1;
  for (let r = Math.floor(cameraY) - 2; r < Math.floor(cameraY) + VISIBLE_ROWS + 5; r++) {
    const row = getRow(r);
    if (row.type === ROAD || row.type === RIVER || row.type === RAIL) {
      const spd = row.speed * speedScale;
      row.items.forEach(item => {
        item.x += spd * dt;
        if (row.speed > 0 && item.x > COLS + item.w) item.x = -item.w - Math.random() * 2;
        if (row.speed < 0 && item.x + item.w < -item.w) item.x = COLS + Math.random() * 2;
      });
    }
  }

  const pRow = getRow(player.row);
  const px = player.col * cellW + cellW / 2;
  const safe = graceT > 0;

  if (!safe && pRow.type === ROAD) {
    for (const car of pRow.items) {
      const carL = car.x * cellW, carR = carL + car.w * cellW;
      if (px > carL + 4 && px < carR - 4) {
        die('Squished by a car!');
        return;
      }
    }
  }

  if (!safe && pRow.type === RAIL) {
    for (const train of pRow.items) {
      const tl = train.x * cellW, tr = tl + train.w * cellW;
      if (px > tl + 4 && px < tr - 4) {
        die('Clipped by a train!');
        return;
      }
    }
  }

  if (pRow.type === RIVER) {
    let onAny = false;
    for (const log of pRow.items) {
      const logL = log.x * cellW, logR = logL + log.w * cellW;
      if (px > logL + 2 && px < logR - 2) {
        onAny = true;
        player.onLog = log;
        break;
      }
    }
    if (!onAny) {
      player.onLog = null;
      if (!safe) { die('Fell in the river!'); return; }
    }
  } else {
    player.onLog = null;
  }

  if (player.onLog) {
    const logSpeed = getRow(player.row).speed * speedScale;
    const newX = px + logSpeed * cellW * dt;
    const newCol = Math.floor(newX / cellW);
    if (newCol < 0 || newCol >= COLS) {
      if (!safe) { die('Swept off screen!'); return; }
    } else {
      player.col = newCol;
    }
  }

  syncPlayerPos();
  player.x += (player.targetX - player.x) * Math.min(1, dt * 15);
  player.y += (player.targetY - player.y) * Math.min(1, dt * 15);

  if (magnetT > 0) collectNearbyCoins();

  if (screenY(player.row) > H + cellH * 2 && !safe) {
    die('Left behind!');
    return;
  }

  hud();
}

function collectNearbyCoins() {
  for (let r = player.row - 2; r <= player.row + 2; r++) {
    const row = rows[r];
    if (!row || row.hasCoin < 0) continue;
    if (Math.abs(row.hasCoin - player.col) <= 2) {
      row.hasCoin = -1;
      coins++;
      score += 50;
      popups.push({ x: player.col * cellW + cellW / 2, y: screenY(player.row) + cellH * .4, text: '+50', life: 1, color: '#fbbf24', size: 18 });
      try { audio?.playTap?.(); } catch(e) {}
    }
  }
}

function drawDecor(decor, y, row) {
  if (!decor) return;
  const biome = row.biome || biomeAt(row.index);
  decor.forEach(d => {
    const x = d.u * cellW, yy = y + cellH * d.v;
    if (d.kind === 'flower') {
      ctx.fillStyle = d.c;
      for (let a = 0; a < 5; a++) {
        const ang = a / 5 * Math.PI * 2 + row.index;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * 3, yy + Math.sin(ang) * 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(x, yy, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'tuft') {
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, yy + 4); ctx.lineTo(x - 3, yy - 3);
      ctx.moveTo(x, yy + 4); ctx.lineTo(x + 3, yy - 3);
      ctx.stroke();
    } else if (d.kind === 'stone') {
      ctx.fillStyle = 'rgba(120,113,108,.55)';
      ctx.beginPath(); ctx.ellipse(x, yy, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'patch') {
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      ctx.beginPath(); ctx.ellipse(x, yy, cellW * .18, cellH * .1, 0, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'manhole') {
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.arc(x, yy, cellW * .14, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'lily') {
      ctx.fillStyle = '#2f9e44';
      ctx.beginPath(); ctx.ellipse(x, yy, cellW * .16, cellH * .12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.beginPath(); ctx.arc(x - 2, yy - 2, 2, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'reed') {
      ctx.strokeStyle = 'rgba(21,128,61,.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, yy + 8); ctx.lineTo(x - 3, yy - 8);
      ctx.moveTo(x + 3, yy + 8); ctx.lineTo(x + 5, yy - 6);
      ctx.stroke();
    } else if (d.kind === 'gravel') {
      ctx.fillStyle = rnd(d.u * 97 + d.v * 13) < .5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.14)';
      ctx.fillRect(x, yy, 2.2, 2.2);
    } else if (d.kind === 'snowdrift') {
      ctx.fillStyle = 'rgba(200,230,255,.45)';
      ctx.beginPath(); ctx.ellipse(x, yy, cellW * .22, cellH * .1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath(); ctx.ellipse(x - cellW * .05, yy - cellH * .03, cellW * .12, cellH * .06, 0, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'shell') {
      ctx.fillStyle = d.c || '#f9e4b7';
      ctx.beginPath(); ctx.arc(x, yy, 3.5, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)';
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(x - 2, yy); ctx.lineTo(x, yy - 3); ctx.lineTo(x + 2, yy); ctx.stroke();
    } else if (d.kind === 'seaweed') {
      ctx.strokeStyle = 'rgba(20,140,80,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, yy + 6); ctx.quadraticCurveTo(x - 4, yy, x + 2, yy - 6);
      ctx.stroke();
    } else if (d.kind === 'puddle') {
      ctx.fillStyle = 'rgba(60,100,150,.32)';
      ctx.beginPath(); ctx.ellipse(x, yy, cellW * .2, cellH * .08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(180,220,255,.2)';
      ctx.beginPath(); ctx.ellipse(x - 3, yy - 2, cellW * .06, cellH * .03, 0, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'mushroom') {
      ctx.fillStyle = '#cc3333';
      ctx.beginPath(); ctx.arc(x, yy - 3, 4.5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(x - 1.5, yy - 3, 3, 5);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(x + 1.5, yy - 5, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 1.5, yy - 6.5, .8, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'sandswirl') {
      ctx.strokeStyle = 'rgba(180,150,80,.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, yy, cellW * .09, 0, Math.PI * 1.6); ctx.stroke();
    }
  });
}

function drawGrassRow(row, y) {
  const biome = row.biome || biomeAt(row.index);
  for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = ((row.index + c) % 2 === 0) ? biome.grassA : biome.grassB;
    ctx.fillRect(c * cellW, y, cellW + 1, cellH + 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let c = 0; c < COLS; c += 2) ctx.fillRect(c * cellW, y, cellW + 1, cellH + 1);
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c < COLS; c++) {
    for (let k = 0; k < 3; k++) {
      const bx = (c + rnd(row.index * 13 + c * 5 + k)) * cellW;
      const by = y + cellH * (.2 + rnd(c * 7 + k * 3 + row.index) * .7);
      ctx.moveTo(bx, by + 3); ctx.lineTo(bx - 2, by - 2);
    }
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(0, y, W, cellH * .18);
  drawDecor(row.decor, y, row);

  row.items.forEach(t => {
    const cx = t.col * cellW + cellW / 2;
    const base = y + cellH * .62;
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(cx + 3, base + cellH * .18, cellW * .3, cellH * .12, 0, 0, Math.PI * 2); ctx.fill();

    if (t.kind === 'cactus') {
      ctx.fillStyle = '#5a8a3a';
      ctx.fillRect(cx - cellW * .07, base - cellH * .72, cellW * .14, cellH * .72);
      ctx.fillRect(cx - cellW * .3, base - cellH * .52, cellW * .2, cellH * .11);
      ctx.fillRect(cx - cellW * .3, base - cellH * .63, cellW * .1, cellH * .14);
      ctx.fillRect(cx + cellW * .09, base - cellH * .42, cellW * .2, cellH * .11);
      ctx.fillRect(cx + cellW * .18, base - cellH * .53, cellW * .1, cellH * .14);
      ctx.fillStyle = '#72a852';
      ctx.fillRect(cx - cellW * .04, base - cellH * .72, cellW * .05, cellH * .72);
    } else if (t.kind === 'palm') {
      ctx.fillStyle = '#8b6940';
      const lean = (rnd(t.col * 5 + t.size) - .5) * .28;
      ctx.save(); ctx.translate(cx, base); ctx.rotate(lean);
      ctx.fillRect(-3, -cellH * .65, 6, cellH * .65);
      ctx.lineCap = 'round';
      for (let a = 0; a < 7; a++) {
        const ang = (a / 7) * Math.PI * 2;
        ctx.strokeStyle = a % 2 === 0 ? '#2a8a3a' : '#3aaa4a';
        ctx.lineWidth = Math.max(2, cellW * .07);
        ctx.beginPath();
        ctx.moveTo(0, -cellH * .62);
        const ex = Math.cos(ang) * cellW * .55, ey = -cellH * .62 + Math.sin(ang) * cellH * .38 + cellH * .12;
        ctx.quadraticCurveTo(Math.cos(ang) * cellW * .28, -cellH * .62 + Math.sin(ang) * cellH * .18, ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    } else if (t.kind === 'building') {
      const bw = cellW * (.38 + rnd(t.col * 3 + t.size) * .35);
      const bh = cellH * (1.0 + rnd(t.col + t.size * 2) * .9);
      const bx = cx - bw / 2, by = base - bh;
      ctx.fillStyle = '#3a4050';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#4a5060';
      ctx.fillRect(bx, by, bw * .35, bh);
      const winH = cellH * .1, winW = bw * .22;
      for (let wy = by + cellH * .12; wy < base - cellH * .08; wy += cellH * .22) {
        for (let wx = bx + bw * .08; wx < bx + bw - winW; wx += bw * .32) {
          ctx.fillStyle = rnd(wx * 7 + wy * 3) > .35 ? 'rgba(255,235,120,.45)' : 'rgba(80,90,110,.4)';
          ctx.fillRect(wx, wy, winW, winH);
        }
      }
    } else if (t.kind === 'lamp') {
      ctx.fillStyle = '#5a5a6a';
      ctx.fillRect(cx - 2, base - cellH * .78, 4, cellH * .78);
      ctx.fillStyle = '#888898';
      ctx.fillRect(cx - cellW * .1, base - cellH * .8, cellW * .2, cellH * .05);
      ctx.fillStyle = 'rgba(255,240,160,.95)';
      ctx.beginPath(); ctx.arc(cx, base - cellH * .83, cellW * .07, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,120,.1)';
      ctx.beginPath(); ctx.arc(cx, base - cellH * .83, cellW * .28, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#7a4f2a';
      ctx.fillRect(cx - 3, base - 2, 6, cellH * .3);
      const s = t.size;
      if (t.conifer) {
        ctx.fillStyle = biome.treeDark;
        ctx.beginPath();
        ctx.moveTo(cx, base - cellH * .72 * s);
        ctx.lineTo(cx - cellW * .34 * s, base + 2);
        ctx.lineTo(cx + cellW * .34 * s, base + 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = biome.tree;
        ctx.beginPath();
        ctx.moveTo(cx, base - cellH * .66 * s);
        ctx.lineTo(cx - cellW * .26 * s, base + 2);
        ctx.lineTo(cx + cellW * .26 * s, base + 2);
        ctx.closePath(); ctx.fill();
        if (biome.name === 'Snow') {
          ctx.fillStyle = 'rgba(215,238,255,.82)';
          ctx.beginPath();
          ctx.moveTo(cx, base - cellH * .72 * s);
          ctx.lineTo(cx - cellW * .15 * s, base - cellH * .44 * s);
          ctx.lineTo(cx + cellW * .15 * s, base - cellH * .44 * s);
          ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = biome.treeDark;
        ctx.beginPath(); ctx.arc(cx + t.lean * .3, base - cellH * .12, cellW * .36 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = biome.tree;
        ctx.beginPath(); ctx.arc(cx - cellW * .05, base - cellH * .2, cellW * .31 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(biome.tree, 40);
        ctx.beginPath(); ctx.arc(cx - cellW * .14, base - cellH * .28, cellW * .14 * s, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
}

function drawRoadRow(row, y) {
  ctx.fillStyle = '#3f434b';
  ctx.fillRect(0, y, W, cellH + 1);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(0, y, W, 2);
  ctx.fillRect(0, y + cellH - 2, W, 2);
  drawDecor(row.decor, y, row);

  ctx.strokeStyle = 'rgba(250,250,210,.5)';
  ctx.lineWidth = Math.max(2, cellH * .04);
  ctx.setLineDash([cellW * .32, cellW * .3]);
  ctx.beginPath();
  ctx.moveTo(0, y + cellH / 2);
  ctx.lineTo(W, y + cellH / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  row.items.forEach(v => drawVehicle(v, y, row.speed > 0));
}

function drawVehicle(v, y, dir) {
  const x = v.x * cellW, w = v.w * cellW, h = v.h * cellH;
  const top = y + (cellH - h) / 2;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  fillRR(x + 3, top + h * .62, w, h * .34, 4, 'rgba(0,0,0,.28)');

  if (v.kind === 'truck') {
    fillRR(x, top, w * .7, h, 4, v.color);
    fillRR(x, top, w * .7, h * .42, 4, shade(v.color, 34));
    fillRR(x + w * .7, top + h * .08, w * .3, h * .92, 4, shade(v.color, -26));
    ctx.fillStyle = '#bfe3ff';
    fillRR(dir ? x + w * .74 : x + w * .74, top + h * .2, w * .2, h * .34, 2, '#bfe3ff');
  } else {
    fillRR(x, top, w, h, Math.min(7, h * .4), v.color);
    fillRR(x + w * .06, top + h * .06, w * .88, h * .34, 4, shade(v.color, 40));
    fillRR(x + w * .24, top + h * .14, w * .5, h * .44, 4, 'rgba(20,26,40,.55)');
    ctx.fillStyle = 'rgba(191,227,255,.75)';
    fillRR(x + w * .28, top + h * .18, w * .42, h * .16, 2, 'rgba(191,227,255,.75)');
  }

  ctx.fillStyle = '#1f2430';
  fillRR(x + w * .16, top + h * .02, w * .13, h * .16, 2, '#1f2430');
  fillRR(x + w * .71, top + h * .02, w * .13, h * .16, 2, '#1f2430');
  fillRR(x + w * .16, top + h * .82, w * .13, h * .16, 2, '#1f2430');
  fillRR(x + w * .71, top + h * .82, w * .13, h * .16, 2, '#1f2430');

  ctx.fillStyle = '#fef08a';
  if (dir) { fillRR(x + w - 5, top + 3, 4, 4, 1, '#fef08a'); fillRR(x + w - 5, top + h - 7, 4, 4, 1, '#fef08a'); }
  else { fillRR(x + 1, top + 3, 4, 4, 1, '#fef08a'); fillRR(x + 1, top + h - 7, 4, 4, 1, '#fef08a'); }
}

function drawRiverRow(row, y) {
  const biome = row.biome || biomeAt(row.index);
  const g = ctx.createLinearGradient(0, y, 0, y + cellH);
  g.addColorStop(0, shade(biome.water, 22));
  g.addColorStop(1, shade(biome.water, -26));
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, cellH + 1);

  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.fillRect(0, y, W, 2);
  ctx.fillRect(0, y + cellH - 2, W, 2);

  const t = performance.now() * .002;
  ctx.strokeStyle = 'rgba(160,205,255,.35)';
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let wx = 0; wx <= W; wx += 20) {
      const yy = y + cellH * (.28 + k * .22) + Math.sin(wx * .04 + t * (1 + k * .3) + row.index) * 3;
      if (wx === 0) ctx.moveTo(wx, yy); else ctx.lineTo(wx, yy);
    }
    ctx.stroke();
  }
  const nowp = performance.now();
  for (let s = 0; s < 7; s++) {
    const seed = s * 7.3 + row.index * 2.1;
    const raw = (rnd(seed) * W) + nowp * .015 * (s % 2 ? 1 : -1);
    const sx = ((raw % W) + W) % W;
    const sy = y + cellH * (.16 + rnd(seed + .3) * .68);
    const a = .18 + .22 * Math.abs(Math.sin(nowp * .003 + s));
    ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
    ctx.fillRect(sx, sy, 3, 1.4);
  }
  drawDecor(row.decor, y, row);

  row.items.forEach(log => {
    const x = log.x * cellW, w = log.w * cellW, h = log.h * cellH;
    const top = y + (cellH - h) / 2;
    fillRR(x + 3, top + h * .7, w, h * .3, 6, 'rgba(0,0,0,.22)');
    fillRR(x, top, w, h, h * .42, '#8a5a2b');
    fillRR(x + h * .12, top + h * .1, Math.max(0, w - h * .24), h * .45, h * .3, '#a9713a');
    ctx.fillStyle = '#6f4520';
    ctx.beginPath(); ctx.ellipse(x + h * .42, top + h / 2, h * .18, h * .42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w - h * .42, top + h / 2, h * .18, h * .42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(80,48,20,.5)';
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 2; i++) {
      const gx = x + w * (i / 3);
      ctx.beginPath(); ctx.moveTo(gx, top + h * .2); ctx.lineTo(gx + 6, top + h * .8); ctx.stroke();
    }
  });
}

function drawRailRow(row, y) {
  ctx.fillStyle = '#6a6154';
  ctx.fillRect(0, y, W, cellH + 1);
  drawDecor(row.decor, y, row);

  ctx.fillStyle = '#4b3b2a';
  for (let x = 6; x < W; x += Math.max(16, cellW * .3)) {
    ctx.fillRect(x, y + cellH * .16, Math.max(4, cellW * .08), cellH * .68);
  }
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, y + cellH * .28, W, Math.max(2, cellH * .05));
  ctx.fillRect(0, y + cellH * .66, W, Math.max(2, cellH * .05));
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(0, y + cellH * .28, W, 1);
  ctx.fillRect(0, y + cellH * .66, W, 1);

  const blink = Math.sin(performance.now() * .01) > 0;
  ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
  ctx.beginPath(); ctx.arc(7, y + cellH * .5, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 7, y + cellH * .5, 4, 0, Math.PI * 2); ctx.fill();

  row.items.forEach(tr => {
    const x = tr.x * cellW, w = tr.w * cellW, h = tr.h * cellH;
    const top = y + (cellH - h) / 2;
    fillRR(x + 3, top + h * .68, w, h * .32, 4, 'rgba(0,0,0,.28)');
    fillRR(x, top, w, h, Math.min(7, h * .35), tr.color);
    fillRR(x, top + h * .58, w, h * .34, Math.min(6, h * .3), shade(tr.color, -42));
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < tr.cars; i++) {
      const cwx = x + w * (.12 + i * .68 / tr.cars);
      fillRR(cwx, top + h * .16, w * .5 / tr.cars, h * .3, 2, 'rgba(191,227,255,.8)');
    }
    ctx.fillStyle = '#fef08a';
    const fx = row.speed > 0 ? x + w - 7 : x + 2;
    ctx.beginPath(); ctx.arc(fx, top + h * .5, 3.2, 0, Math.PI * 2); ctx.fill();
  });
}

function drawSafeRow(row, y) {
  const biome = biomeAt(0);
  ctx.fillStyle = biome.grassA;
  ctx.fillRect(0, y, W, cellH + 1);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fillRect(0, y, W, 3);
  drawDecor(row.decor, y, row);

  const cx = 1 * cellW + cellW / 2;
  const base = y + cellH * .78;
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(cx - 2, base - cellH * .5, 4, cellH * .5);
  fillRR(cx - cellW * .22, base - cellH * .74, cellW * .44, cellH * .24, 3, '#f8fafc');
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.moveTo(cx, base - cellH * .68);
  ctx.lineTo(cx, base - cellH * .52);
  ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, base - cellH * .68);
  ctx.lineTo(cx + cellW * .12, base - cellH * .62);
  ctx.lineTo(cx, base - cellH * .56);
  ctx.closePath(); ctx.fill();
}

function drawPower(row) {
  const p = row.hasPower;
  if (!p) return;
  const cx = p.col * cellW + cellW / 2;
  const cy = screenY(row.index) + cellH / 2;
  const bob = Math.sin(performance.now() * .005 + row.index) * 2;
  const r = cellW * .16;
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.shadowColor = p.kind === 'slow' ? '#93c5fd' : p.kind === 'magnet' ? '#fca5a5' : p.kind === 'dash' ? '#fde047' : '#86efac';
  ctx.shadowBlur = 12;
  if (p.kind === 'dash') {
    ctx.fillStyle = '#fde047';
    const ar = r * .9;
    ctx.beginPath();
    ctx.moveTo(-ar * .2, -ar); ctx.lineTo(ar * .6, 0); ctx.lineTo(-ar * .2, ar); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-ar * .8, -ar * .7); ctx.lineTo(-ar * .1, 0); ctx.lineTo(-ar * .8, ar * .7); ctx.closePath(); ctx.fill();
  } else if (p.kind === 'shield') {
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r, -r * .3); ctx.lineTo(r, r * .5);
    ctx.lineTo(0, r); ctx.lineTo(-r, r * .5); ctx.lineTo(-r, -r * .3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a7f3d0';
    ctx.beginPath(); ctx.moveTo(0, -r * .7); ctx.lineTo(0, r * .7); ctx.lineTo(-r * .6, 0); ctx.closePath(); ctx.fill();
  } else if (p.kind === 'magnet') {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = r * .5;
    ctx.beginPath(); ctx.arc(0, 0, r * .8, Math.PI * .15, Math.PI * .85, true); ctx.stroke();
  } else {
    ctx.fillStyle = '#bfdbfe';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -r * .5); ctx.lineTo(0, r * .1); ctx.lineTo(r * .45, r * .1); ctx.stroke();
  }
  ctx.restore();
}

function drawEcho() {
  if (!echo) return;
  const ex = echo.x || echo.targetX;
  const ey = echo.y || echo.targetY;
  const t = echo.hopAnim > 0 ? Math.sin(echo.hopAnim / .15 * Math.PI) : 0;
  const bounce = t * 7;
  const R = cellW * .24, Rb = cellH * .24;
  const TEAL = '#2eb5a5', TEAL_D = '#1f8f83', TEAL_L = '#63d8cb', GILL = '#ff9db0', EYE = '#12303a';

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(ex, ey + cellH * .26, R * 1.0, Rb * .4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(ex, ey - bounce);

  ctx.fillStyle = TEAL_D;
  ctx.beginPath(); ctx.ellipse(0, Rb * .84, R * .3, Rb * .48, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = GILL;
  [-1, 1].forEach(s => {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(s * R * .78, -Rb * .12 + i * Rb * .3, R * .28, Rb * .12, s * .5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ell(0, Rb * .22, R * .85, Rb * .96, 0, TEAL);
  ell(-R * .12, Rb * .1, R * .66, Rb * .7, 0, TEAL_L);
  ell(0, -Rb * .6, R * .82, Rb * .76, 0, TEAL);
  ell(-R * .1, -Rb * .68, R * .62, Rb * .56, 0, TEAL_L);

  [-1, 1].forEach(s => {
    ell(s * R * .3, -Rb * .58, R * .2, R * .22, 0, EYE);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(s * R * .3 - R * .07, -Rb * .66, R * .08, 0, Math.PI * 2); ctx.fill();
  });

  ctx.strokeStyle = TEAL_D;
  ctx.lineWidth = Math.max(1, R * .12);
  ctx.beginPath(); ctx.arc(0, -Rb * .34, R * .2, .2, Math.PI - .2); ctx.stroke();
  ctx.restore();
}

function drawCoin(row) {
  if (row.hasCoin < 0) return;
  const cx = row.hasCoin * cellW + cellW / 2;
  const cy = screenY(row.index) + cellH / 2;
  const bob = Math.sin(performance.now() * .005 + row.index) * 2;
  const spin = Math.abs(Math.cos(performance.now() * .007 + row.index * 2.1)) * .9 + .1;
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(spin, 1);
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(0, 0, cellW * .13, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(-2, -2, cellW * .05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, cellW * .09, 0, Math.PI * 2); ctx.stroke();
  const sr = cellW * (.13 + .04 * Math.sin(performance.now() * .004 + row.index));
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-sr, 0); ctx.lineTo(sr, 0);
  ctx.moveTo(0, -sr); ctx.lineTo(0, sr);
  ctx.stroke();
  ctx.restore();
}

function drawMotes() {
  if (!motes.length) return;
  const now = performance.now();
  ctx.save();
  motes.forEach(m => {
    const a = Math.max(0, Math.min(1, m.life));
    if (m.type === 'snow') {
      ctx.globalAlpha = a * .72;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e8f4ff';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    } else if (m.type === 'rain') {
      ctx.globalAlpha = a * .48;
      ctx.strokeStyle = '#88aacc';
      ctx.lineWidth = m.r;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - 3, m.y - 8); ctx.stroke();
    } else if (m.type === 'firefly') {
      ctx.globalAlpha = a * (.5 + .5 * Math.abs(Math.sin(now * .005 + m.x)));
      ctx.shadowColor = '#aaff88';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ccff88';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (m.bio === 'Twilight') {
      ctx.globalAlpha = a * (.45 + .45 * Math.abs(Math.sin(now * .004 + m.x)));
      ctx.shadowColor = '#a5f3fc';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#d8fff8';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (m.bio === 'Autumn') {
      ctx.globalAlpha = a * .5;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e0a35a';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.globalAlpha = a * .45;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fdf3c4';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRow(row) {
  const y = screenY(row.index);
  if (y > H + cellH || y < -cellH * 2) return;

  if (row.type === GRASS) drawGrassRow(row, y);
  else if (row.type === ROAD) drawRoadRow(row, y);
  else if (row.type === RIVER) drawRiverRow(row, y);
  else if (row.type === RAIL) drawRailRow(row, y);
  else drawSafeRow(row, y);

  if (row.hasCoin >= 0) drawCoin(row);
  if (row.hasPower) drawPower(row);
}

function ell(x, y, rx, ry, rot, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2);
  ctx.fill();
}

// Pip the turtle, drawn from the studio character sheet: green skin, a
// dark-green hood, a warm tan plastron and a brown shell with a lighter rim.
function drawPlayer() {
  const px = player.x || player.targetX;
  const py = (player.y || player.targetY) + cellH / 2;
  const t = hopAnim > 0 ? Math.sin(hopAnim / .15 * Math.PI) : 0;
  const bounce = t * 8;
  const sw = 1 - t * .12, sq = 1 + t * .18;
  const R = cellW * .3, Rb = cellH * .3;
  const face = player.facing || 'up';
  const breathe = 1 + Math.sin(performance.now() * .004) * .02;

  const SKIN = '#7ac74f', SKIN_D = '#59a338', SKIN_L = '#a9e57d', SPOT = '#5f9c3c';
  const CLOAK = '#2f5d3a', CLOAK_L = '#3f7a4b';
  const BELLY = '#e6c88c', BELLY_L = '#f2dca6';
  const SHELL = '#8a6a45', SHELL_D = '#63492c', SHELL_L = '#a98459';
  const EYE = '#22331d';

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(px, py + cellH * .3, R * 1.05, Rb * .42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(px, py - bounce);
  ctx.scale(sw, sq * breathe);

  const showBack = face === 'up';
  const side = face === 'left' || face === 'right';
  const dirx = face === 'left' ? -1 : 1;
  const hy = -Rb * .5;

  ell(-R * .5, Rb * .92, R * .34, Rb * .2, 0, SKIN_D);
  ell(R * .5, Rb * .92, R * .34, Rb * .2, 0, SKIN_D);

  if (showBack) {
    ell(0, Rb * .18, R * .88, Rb * .84, 0, SKIN);
    ell(0, Rb * .12, R * 1.0, Rb * .96, 0, SHELL_D);
    ell(0, Rb * .08, R * .86, Rb * .8, 0, SHELL);
    ctx.strokeStyle = SHELL_D;
    ctx.lineWidth = Math.max(1, R * .1);
    ctx.beginPath(); ctx.arc(0, Rb * .08, R * .5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, Rb * .08, R * .26, 0, Math.PI * 2); ctx.stroke();
    ell(0, -Rb * .14, R * .14, Rb * .12, 0, SHELL_L);
    ell(-R * .9, Rb * .26, R * .2, Rb * .28, 0, SKIN_D);
    ell(R * .9, Rb * .26, R * .2, Rb * .28, 0, SKIN_D);
    ell(0, hy, R * .72, Rb * .68, 0, CLOAK);
    ell(0, hy - Rb * .12, R * .58, Rb * .5, 0, CLOAK_L);
    ell(0, Rb * .98, R * .18, Rb * .14, 0, SKIN);
  } else {
    if (side) {
      ell(-dirx * R * .68, Rb * .14, R * .42, Rb * .8, 0, SHELL);
      ell(-dirx * R * .76, Rb * .14, R * .28, Rb * .6, 0, SHELL_D);
    }
    ell(0, Rb * .2, R * .9, Rb * .88, 0, SKIN);
    ell(-R * .14, Rb * .04, R * .7, Rb * .62, 0, SKIN_L);
    const bx = side ? dirx * R * .36 : 0;
    ell(bx, Rb * .4, R * .5, Rb * .54, 0, BELLY);
    ell(bx, Rb * .32, R * .4, Rb * .4, 0, BELLY_L);
    ell(-R * .9, Rb * .24, R * .22, Rb * .3, 0, SKIN_D);
    ell(R * .9, Rb * .24, R * .22, Rb * .3, 0, SKIN_D);
    ell(0, hy, R * .86, Rb * .82, 0, CLOAK);
    ell(0, hy - Rb * .16, R * .72, Rb * .6, 0, CLOAK_L);
    ell(0, hy + Rb * .14, R * .66, Rb * .64, 0, SKIN);
    ell(-R * .12, hy + Rb * .04, R * .5, Rb * .44, 0, SKIN_L);
    ell(-R * .42, hy + Rb * .1, R * .1, Rb * .09, 0, SPOT);
    ell(R * .44, hy - Rb * .16, R * .09, Rb * .08, 0, SPOT);

    const brow = hy + Rb * .16;
    const eyeR = R * .2;
    const drawEye = (x) => {
      ell(x, brow, eyeR, eyeR * 1.12, 0, EYE);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x - eyeR * .38, brow - eyeR * .4, eyeR * .34, 0, Math.PI * 2); ctx.fill();
    };
    if (side) drawEye(dirx * R * .22);
    else { drawEye(-R * .28); drawEye(R * .28); }

    const mx = side ? dirx * R * .3 : 0;
    ctx.strokeStyle = SKIN_D;
    ctx.lineWidth = Math.max(1, R * .1);
    ctx.beginPath();
    ctx.arc(mx, hy + Rb * .46, R * .16, .2, Math.PI - .2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(224,110,120,.4)';
    ctx.beginPath(); ctx.arc(-R * .5, brow + Rb * .28, R * .13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(R * .5, brow + Rb * .28, R * .13, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function draw() {
  if (!W || !H) return;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = biomeAt(furthest || 0).bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (shake) shake.apply(ctx, dpr);

  const startRow = Math.floor(cameraY) - 2;
  const endRow = Math.ceil(cameraY) + VISIBLE_ROWS + 3;
  for (let r = startRow; r <= endRow; r++) {
    drawRow(getRow(r));
  }

  drawMotes();

  if (player.alive) drawEcho();
  if (player.alive) {
    if (selectedChar === 'pip') drawPlayer();
    else drawPlayerEmoji(CREW.find(c => c.id === selectedChar)?.emoji || '🐢');
  }

  if (shield && player.alive) {
    const sx = player.x || player.targetX, sy = (player.y || player.targetY) + cellH / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(134,239,172,.9)';
    ctx.lineWidth = Math.max(2, cellW * .05);
    ctx.beginPath(); ctx.arc(sx, sy, cellW * .42, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  popups.forEach(p => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.font = '900 ' + (p.size || 20) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  const tint = biomeAt(furthest || 0).tint;
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }

  const key = W + 'x' + H;
  if (vigKey !== key) {
    vigKey = key;
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.38)');
  }
  if (vignette) { ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H); }

  if (idleTimer > 3 && running && !dead) {
    const danger = Math.min(1, (idleTimer - 3) / 3);
    const pulse = .55 + .45 * Math.sin(performance.now() * .009 * (1 + danger * 2));
    const vig2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .22, W / 2, H / 2, Math.max(W, H) * .65);
    vig2.addColorStop(0, 'rgba(239,68,68,0)');
    vig2.addColorStop(1, 'rgba(239,68,68,' + (danger * .38 * pulse).toFixed(3) + ')');
    ctx.fillStyle = vig2;
    ctx.fillRect(0, 0, W, H);
  }
  if (idleTimer > 4 && running && !dead) {
    ctx.fillStyle = 'rgba(239,68,68,.85)';
    ctx.font = '900 ' + Math.round(cellH * .5) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOP! ' + Math.ceil(6 - idleTimer) + 's', W / 2, H * .15);
  }

  ctx.textAlign = 'center';
  if (combo > 1) {
    ctx.fillStyle = 'rgba(253,224,71,.95)';
    ctx.font = '900 ' + Math.round(cellH * .34) + 'px system-ui,sans-serif';
    ctx.fillText('COMBO x' + combo, W / 2, H * .07);
  }
  const statusIcons = [];
  if (shield) statusIcons.push('🍃 SHIELD');
  if (magnetT > 0) statusIcons.push('MAGNET ' + Math.ceil(magnetT) + 's');
  if (slowT > 0) statusIcons.push('SLOW ' + Math.ceil(slowT) + 's');
  if (statusIcons.length) {
    ctx.fillStyle = 'rgba(167,243,208,.95)';
    ctx.font = '800 ' + Math.round(cellH * .24) + 'px system-ui,sans-serif';
    ctx.fillText(statusIcons.join('    '), W / 2, H * .12);
  }

  if (shake) shake.decay();
}

function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  fit();
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function vibrate(ms) { try { navigator.vibrate?.(ms); } catch(e) {} }

let swStartX = 0, swStartY = 0, swActive = false;
C.addEventListener('pointerdown', e => {
  if (!running && !dead) { startGame(); return; }
  swStartX = e.clientX;
  swStartY = e.clientY;
  swActive = true;
});
C.addEventListener('pointerup', e => {
  if (!running || !swActive) return;
  swActive = false;
  const dx = e.clientX - swStartX;
  const dy = e.clientY - swStartY;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 18 && ady < 18) { hop(0, 1); return; }
  // Require 1.3:1 dominance ratio to avoid diagonal misfires
  if (adx > ady * 1.3) hop(dx > 0 ? 1 : -1, 0);
  else if (ady > adx * 1.3) hop(0, dy < 0 ? 1 : -1);
  else hop(0, 1); // ambiguous diagonal → hop forward
});
C.addEventListener('pointercancel', () => { swActive = false; });

document.addEventListener('keydown', e => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!running && !dead) startGame(); else hop(0, 1); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); hop(0, -1); }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); hop(-1, 0); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); hop(1, 0); }
  if (e.code === 'Space') { e.preventDefault(); if (!running) startGame(); else hop(0, 1); }
});

function showHowToPlay() {
  $('startScreen').classList.add('hidden');
  $('howToPlay').classList.remove('hidden');
}
function hideHowToPlay() {
  $('howToPlay').classList.add('hidden');
  $('startScreen').classList.remove('hidden');
  try { localStorage.setItem('jvds_cc_seen_howto', '1'); } catch(e) {}
}
try { if (!localStorage.getItem('jvds_cc_seen_howto')) showHowToPlay(); } catch(e) {}
$('gotItBtn').onclick = hideHowToPlay;
$('helpBtn').onclick = showHowToPlay;

$('playBtn').onclick = startGame;
$('againBtn').onclick = startGame;
const saveBtnEl = $('saveBtn'), giveUpBtnEl = $('giveUpBtn');
if (saveBtnEl) saveBtnEl.onclick = revive;
if (giveUpBtnEl) giveUpBtnEl.onclick = surrender;
function bindDpad(id, dx, dy) {
  const btn = $(id);
  if (!btn) return;
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    btn.classList.add('pressed');
    hop(dx, dy);
    vibrate(8);
  });
  btn.addEventListener('pointerup', () => btn.classList.remove('pressed'));
  btn.addEventListener('pointercancel', () => btn.classList.remove('pressed'));
  btn.addEventListener('pointerleave', () => btn.classList.remove('pressed'));
}
bindDpad('dUp', 0, 1);
bindDpad('dDown', 0, -1);
bindDpad('dLeft', -1, 0);
bindDpad('dRight', 1, 0);
$('soundBtn').onclick = function() {
  const on = localStorage.getItem('soundEnabled') !== 'false';
  localStorage.setItem('soundEnabled', on ? 'false' : 'true');
  if (audio) audio.setMasterVolume(on ? 0 : .5);
  $('soundBtn').textContent = on ? '🔇' : '🔊';
};

reset();
fit();
$('bestHud').textContent = best;
requestAnimationFrame(loop);
buildCrewSelect();
const shareBtnEl = $('shareBtn');
if (shareBtnEl) shareBtnEl.onclick = shareRunCard;
})();
