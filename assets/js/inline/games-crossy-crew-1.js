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
let best = (sys ? GameSystem.getBestScore('crossy-crew') : 0) || 0;
let last = 0, idleTimer = 0, particles = [], popups = [];
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
  get zone() { return furthest == null ? '' : biomeAt(furthest).name; }
};

const ROAD = 'road', RIVER = 'river', GRASS = 'grass', SAFE = 'safe', RAIL = 'rail';
const carColors = ['#ef4444','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#e11d48'];
const trainColors = ['#dc2626','#2563eb','#facc15','#16a34a','#7c3aed'];
const flowerColors = ['#f9a8d4','#fcd34d','#fca5a5','#c4b5fd','#fdba74'];

// Biomes cycle every 40 rows: richer greens, then autumn, then twilight.
const BIOMES = [
  { name:'Meadow',   grassA:'#4f9d5d', grassB:'#459153', tree:'#2f7d43', treeDark:'#1e5a2f', bg:'#123322', tint:null, water:'#2f6fb0' },
  { name:'Autumn',   grassA:'#8b9a3f', grassB:'#7e8f37', tree:'#c06f2a', treeDark:'#8a4a1c', bg:'#2a2415', tint:'rgba(214,150,50,.10)', water:'#2b6499' },
  { name:'Twilight', grassA:'#3a716b', grassB:'#346661', tree:'#2a5a58', treeDark:'#1e4241', bg:'#0e1e2c', tint:'rgba(46,74,150,.16)', water:'#26527e' }
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
  if (type === GRASS || type === SAFE) {
    for (let c = 0; c < COLS; c++) {
      const g = rnd(index * 31 + c * 7);
      if (g < .18) decor.push({ kind: 'flower', u: c + .2 + g, v: .35 + rnd(c + index) * .3, c: pick(flowerColors) });
      else if (g < .3) decor.push({ kind: 'tuft', u: c + .3 + g, v: .3 + rnd(c * 3 + index) * .4 });
      else if (g < .36) decor.push({ kind: 'stone', u: c + .4, v: .6 + rnd(c + index * 5) * .2 });
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
  for (let c = 0; c < COLS; c++) {
    if (rnd(index * 53 + c * 11) < .26) {
      trees.push({ col: c, size: .85 + rnd(index + c) * .4, lean: (rnd(c * 5 + index) - .5) * 6, conifer: rnd(index * 7 + c) < .3 });
    }
  }
  return trees;
}

function makeRow(index) {
  if (index <= 0) return { type: SAFE, items: [], decor: makeDecor(SAFE, 0), hasCoin: -1, index };

  const difficulty = Math.min(1, index / 60);
  const biome = biomeAt(index);
  const r = Math.random();

  if (index % 8 === 0) {
    return { type: GRASS, items: makeTreeRow(index), decor: makeDecor(GRASS, index), biome, index, hasCoin: Math.random() < .3 ? Math.floor(Math.random() * COLS) : -1 };
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

  return { type: GRASS, items: makeTreeRow(index), decor: makeDecor(GRASS, index), biome, index, hasCoin: Math.random() < .35 ? Math.floor(Math.random() * COLS) : -1 };
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
  hopAnim = 0;
  dustTimer = 0;
  if (milestones) milestones.reset();
  if (shake) shake.reset();
  syncPlayerPos();
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

  player.col = newCol;
  player.row = newRow;
  player.onLog = null;
  if (dy > 0) player.facing = 'up';
  else if (dy < 0) player.facing = 'down';
  else if (dx > 0) player.facing = 'right';
  else if (dx < 0) player.facing = 'left';
  hops++;
  hopAnim = .15;

  if (newRow > furthest) {
    const diff = newRow - furthest;
    furthest = newRow;
    score += diff * 10;
    if (milestones) milestones.check(furthest);
  }

  if (targetRow.hasCoin === newCol) {
    targetRow.hasCoin = -1;
    coins++;
    score += 50;
    burst(player.col * cellW + cellW / 2, screenY(player.row) + cellH / 2, '#fbbf24', 10);
    popups.push({ x: player.col * cellW + cellW / 2, y: screenY(player.row) + cellH * .4, text: '+50', life: 1, color: '#fbbf24', size: 20 });
    toast('+Coin!');
    try { audio?.playSuccess?.(); } catch(e) {}
  } else {
    try { audio?.playTap?.(); } catch(e) {}
  }

  idleTimer = 0;
  syncPlayerPos();
  hud();
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
  if (!player.alive) return;
  player.alive = false;
  dead = true;
  running = false;
  if (shake) shake.hit(16);
  burst(player.x || player.targetX, player.y || player.targetY, '#ef4444', 20);
  try { audio?.playError?.(); } catch(e) {}
  if (score > best) {
    best = score;
    if (sys) GameSystem.saveScore('crossy-crew', best);
  }
  sys?.saveState?.();
  toast(reason);
  if (storyRun) {
    storyRun.finish(score > 200 ? 'success' : 'fail', score);
  } else {
    showEnd(reason);
  }
}

function showEnd(reason) {
  $('endTitle').textContent = score > 500 ? 'Epic Crossing!' : score > 200 ? 'Nice Hops!' : (reason || 'Squished!');
  $('endStats').innerHTML = [
    ['Score', score], ['Distance', furthest], ['Coins', coins], ['Best', best]
  ].map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  $('endScreen').classList.remove('hidden');
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

  if (!running || dead) return;

  const targetCamY = Math.max(0, furthest - 4);
  cameraY += (targetCamY - cameraY) * Math.min(1, dt * 5);

  idleTimer += dt;
  if (idleTimer > 6) { die('Too slow!'); return; }

  hopAnim = Math.max(0, hopAnim - dt);

  dustTimer -= dt;
  if (dustTimer <= 0 && window.JVDSShowcase) {
    JVDSShowcase.dust(particles, player.col * cellW + cellW / 2, screenY(player.row) + cellH, '#86efac', 2, { drift: 30, spread: 18, up: 40, size: 1.5 });
    dustTimer = .16;
  }

  for (let r = Math.floor(cameraY) - 2; r < Math.floor(cameraY) + VISIBLE_ROWS + 5; r++) {
    const row = getRow(r);
    if (row.type === ROAD || row.type === RIVER || row.type === RAIL) {
      row.items.forEach(item => {
        item.x += row.speed * dt;
        if (row.speed > 0 && item.x > COLS + item.w) item.x = -item.w - Math.random() * 2;
        if (row.speed < 0 && item.x + item.w < -item.w) item.x = COLS + Math.random() * 2;
      });
    }
  }

  const pRow = getRow(player.row);
  const px = player.col * cellW + cellW / 2;

  if (pRow.type === ROAD) {
    for (const car of pRow.items) {
      const carL = car.x * cellW, carR = carL + car.w * cellW;
      if (px > carL + 4 && px < carR - 4) {
        die('Squished by a car!');
        return;
      }
    }
  }

  if (pRow.type === RAIL) {
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
      die('Fell in the river!');
      return;
    }
  } else {
    player.onLog = null;
  }

  if (player.onLog) {
    const logSpeed = getRow(player.row).speed;
    const newX = px + logSpeed * cellW * dt;
    const newCol = Math.floor(newX / cellW);
    if (newCol < 0 || newCol >= COLS) {
      die('Swept off screen!');
      return;
    }
    player.col = newCol;
  }

  syncPlayerPos();
  player.x += (player.targetX - player.x) * Math.min(1, dt * 15);
  player.y += (player.targetY - player.y) * Math.min(1, dt * 15);

  if (screenY(player.row) > H + cellH * 2) {
    die('Left behind!');
    return;
  }

  hud();
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
    }
  });
}

function drawGrassRow(row, y) {
  const biome = row.biome || biomeAt(row.index);
  for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = ((row.index + c) % 2 === 0) ? biome.grassA : biome.grassB;
    ctx.fillRect(c * cellW, y, cellW + 1, cellH + 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(0, y, W, cellH * .18);
  drawDecor(row.decor, y, row);

  row.items.forEach(t => {
    const cx = t.col * cellW + cellW / 2;
    const base = y + cellH * .62;
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(cx + 3, base + cellH * .18, cellW * .3, cellH * .12, 0, 0, Math.PI * 2); ctx.fill();
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
    } else {
      ctx.fillStyle = biome.treeDark;
      ctx.beginPath(); ctx.arc(cx + t.lean * .3, base - cellH * .12, cellW * .36 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = biome.tree;
      ctx.beginPath(); ctx.arc(cx - cellW * .05, base - cellH * .2, cellW * .31 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(biome.tree, 40);
      ctx.beginPath(); ctx.arc(cx - cellW * .14, base - cellH * .28, cellW * .14 * s, 0, Math.PI * 2); ctx.fill();
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

  const cx = Math.floor(COLS / 2) * cellW + cellW / 2;
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

function drawCoin(row) {
  if (row.hasCoin < 0) return;
  const cx = row.hasCoin * cellW + cellW / 2;
  const cy = screenY(row.index) + cellH / 2;
  const bob = Math.sin(performance.now() * .005 + row.index) * 2;
  ctx.save();
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx, cy + bob, cellW * .13, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(cx - 2, cy + bob - 2, cellW * .05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy + bob, cellW * .09, 0, Math.PI * 2); ctx.stroke();
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
}

function drawPlayer() {
  const px = player.x || player.targetX;
  const py = (player.y || player.targetY) + cellH / 2;
  const t = hopAnim > 0 ? Math.sin(hopAnim / .15 * Math.PI) : 0;
  const bounce = t * 8;
  const sw = 1 - t * .12, sq = 1 + t * .18;
  const r = cellW * .3, rb = cellH * .3;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(px, py + cellH * .28, r * sw, rb * .42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(px, py - bounce);
  ctx.scale(sw, sq);

  ctx.fillStyle = '#15803d';
  fillRR(-r * 1.15, rb * .1, r * .75, rb * .6, 5, '#15803d');
  fillRR(r * .4, rb * .1, r * .75, rb * .6, 5, '#15803d');

  ctx.fillStyle = '#16a34a';
  ctx.beginPath(); ctx.ellipse(0, 0, r, rb, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath(); ctx.ellipse(-r * .16, -rb * .22, r * .74, rb * .68, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#dcfce7';
  ctx.beginPath(); ctx.ellipse(0, rb * .28, r * .5, rb * .4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(20,90,45,.55)';
  ctx.beginPath(); ctx.arc(-r * .5, -rb * .35, r * .16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * .38, rb * .05, r * .13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * .2, rb * .5, r * .1, 0, Math.PI * 2); ctx.fill();

  const ex = player.facing === 'left' ? -r * .28 : player.facing === 'right' ? r * .28 : 0;
  const ey = player.facing === 'down' ? rb * .05 : -rb * .1;
  const eyeY = -rb * .62 + ey;
  [-1, 1].forEach(side => {
    const x = side * r * .34 + ex;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(x, eyeY, r * .3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#052e16';
    ctx.beginPath(); ctx.arc(x + ex * .12, eyeY + 1, r * .15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - r * .06, eyeY - r * .06, r * .05, 0, Math.PI * 2); ctx.fill();
  });

  ctx.strokeStyle = '#14532d';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(ex, rb * .16, r * .28, .15, Math.PI - .15);
  ctx.stroke();
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

  if (player.alive) drawPlayer();

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

  if (idleTimer > 4 && running && !dead) {
    ctx.fillStyle = 'rgba(239,68,68,.85)';
    ctx.font = '900 ' + Math.round(cellH * .5) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOP! ' + Math.ceil(6 - idleTimer) + 's', W / 2, H * .15);
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

let swStartX = 0, swStartY = 0;
C.addEventListener('pointerdown', e => {
  if (!running && !dead) { startGame(); return; }
  swStartX = e.clientX;
  swStartY = e.clientY;
});
C.addEventListener('pointerup', e => {
  if (!running) return;
  const dx = e.clientX - swStartX;
  const dy = e.clientY - swStartY;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 10 && ady < 10) { hop(0, 1); return; }
  if (adx > ady) hop(dx > 0 ? 1 : -1, 0);
  else hop(0, dy < 0 ? 1 : -1);
});

document.addEventListener('keydown', e => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!running && !dead) startGame(); else hop(0, 1); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); hop(0, -1); }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); hop(-1, 0); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); hop(1, 0); }
  if (e.code === 'Space') { e.preventDefault(); if (!running) startGame(); else hop(0, 1); }
});

$('playBtn').onclick = startGame;
$('againBtn').onclick = startGame;
$('dUp').onclick = () => hop(0, 1);
$('dDown').onclick = () => hop(0, -1);
$('dLeft').onclick = () => hop(-1, 0);
$('dRight').onclick = () => hop(1, 0);
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
})();
