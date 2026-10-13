(function(){
const C = document.getElementById('game'), ctx = C.getContext('2d');
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
const sys = window.GameSystem ? new GameSystem('crossy-crew','Crossy Crew','pip') : null;
const storyRun = window.__storyRun = window.StoryRun ? new StoryRun({
  id:'crossy-crew', gameSystem:sys, title:'Crossy Crew', character:'Pip',
  open:'Pip and Echo are at the edge of a busy crossing and the road stretches on forever.',
  objective:'Hop as far as you can without getting squished or swept away.',
  beats:[{at:0,text:'The first road has slow traffic. Time it.'},{at:.4,text:'Rivers appear. Ride the logs across.'},{at:.8,text:'Traffic is thick and the logs are small.'}],
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
let last = 0, idleTimer = 0, particles = [];
let hopAnim = 0;

// A952 showcase polish: distance goals that celebrate as you hit them, and a
// screen shake on death. Shared implementation in ../game-showcase.js.
const MISSION = [10, 25, 50, 100];
const milestones = window.JVDSShowcase ? new JVDSShowcase.Milestones(MISSION, function (m) {
  toast('Goal reached: ' + m + ' rows!');
  try { audio?.playSuccess?.(); } catch(e) {}
  for (let i = 0; i < 14; i++) {
    particles.push({ x: player.col * cellW + cellW / 2, y: screenY(player.row) + cellH / 2, vx: (Math.random() - .5) * 240, vy: -Math.random() * 240, life: 1, color: '#86efac', size: 3 });
  }
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
  get shakeHits() { return shake ? shake.hits : 0; }
};

const ROAD = 'road', RIVER = 'river', GRASS = 'grass', SAFE = 'safe';
const carColors = ['#ef4444','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];

function fit() {
  const r = C.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.round(r.width * dpr);
  H = Math.round(r.height * dpr);
  C.width = W; C.height = H;
  cellW = W / COLS;
  cellH = H / VISIBLE_ROWS;
}

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

function makeRow(index) {
  if (index <= 0) return { type: SAFE, items: [], color: '#166534', index };
  if (index % 8 === 0) return { type: GRASS, items: makeTreeRow(), color: '#14532d', index, hasCoin: Math.random() < .3 ? Math.floor(Math.random() * COLS) : -1 };

  const difficulty = Math.min(1, index / 60);
  const r = Math.random();

  if (r < .45) {
    const dir = Math.random() < .5 ? 1 : -1;
    const spd = (40 + Math.random() * 60 + difficulty * 80) * dir;
    const count = 2 + Math.floor(Math.random() * 2 + difficulty);
    const gap = COLS / count;
    const cars = [];
    for (let i = 0; i < count; i++) {
      const cw = (1.2 + Math.random() * .6) * cellW;
      cars.push({
        x: i * gap * cellW + Math.random() * cellW,
        w: cw, h: cellH * .65,
        color: carColors[Math.floor(Math.random() * carColors.length)]
      });
    }
    return { type: ROAD, items: cars, speed: spd, color: '#374151', index, hasCoin: Math.random() < .25 ? Math.floor(Math.random() * COLS) : -1 };
  }

  if (r < .7 && index > 5) {
    const dir = Math.random() < .5 ? 1 : -1;
    const spd = (30 + Math.random() * 40 + difficulty * 50) * dir;
    const count = 2 + Math.floor(Math.random() * 2);
    const gap = COLS / count;
    const logs = [];
    for (let i = 0; i < count; i++) {
      const lw = (1.5 + Math.random() * 1.5 - difficulty * .4) * cellW;
      logs.push({ x: i * gap * cellW + Math.random() * cellW * 2, w: Math.max(cellW * 1.2, lw), h: cellH * .7 });
    }
    return { type: RIVER, items: logs, speed: spd, color: '#1d4ed8', index, hasCoin: Math.random() < .3 ? Math.floor(Math.random() * COLS) : -1 };
  }

  return { type: GRASS, items: makeTreeRow(), color: '#14532d', index, hasCoin: Math.random() < .35 ? Math.floor(Math.random() * COLS) : -1 };
}

function makeTreeRow() {
  const trees = [];
  for (let c = 0; c < COLS; c++) {
    if (Math.random() < .25) trees.push(c);
  }
  return trees;
}

function getRow(index) {
  if (!rows[index]) rows[index] = makeRow(index);
  return rows[index];
}

function reset() {
  player = { col: Math.floor(COLS / 2), row: 0, x: 0, y: 0, targetX: 0, targetY: 0, onLog: null, alive: true };
  rows = {};
  rows[0] = { type: SAFE, items: [], color: '#166534', index: 0 };
  for (let i = -2; i < VISIBLE_ROWS + 5; i++) getRow(i);
  cameraY = 0;
  furthest = 0;
  score = 0;
  coins = 0;
  hops = 0;
  idleTimer = 0;
  particles = [];
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
  if (targetRow.type === GRASS && targetRow.items.includes(newCol)) return;

  player.col = newCol;
  player.row = newRow;
  player.onLog = null;
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
  burst(player.x, player.y, '#ef4444', 20);
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

  if (!running || dead) return;

  const targetCamY = Math.max(0, furthest - 4);
  cameraY += (targetCamY - cameraY) * Math.min(1, dt * 5);

  idleTimer += dt;
  if (idleTimer > 6) { die('Too slow!'); return; }

  hopAnim = Math.max(0, hopAnim - dt);

  // little puffs as the crew hops along
  dustTimer -= dt;
  if (dustTimer <= 0 && window.JVDSShowcase) {
    JVDSShowcase.dust(particles, player.col * cellW + cellW / 2, screenY(player.row) + cellH, '#86efac', 2, { drift: 30, spread: 18, up: 40, size: 1.5 });
    dustTimer = .16;
  }

  for (let r = Math.floor(cameraY) - 2; r < Math.floor(cameraY) + VISIBLE_ROWS + 5; r++) {
    const row = getRow(r);
    if (row.type === ROAD || row.type === RIVER) {
      row.items.forEach(item => {
        item.x += row.speed * dt;
        if (row.speed > 0 && item.x > W + item.w) item.x = -item.w - Math.random() * cellW * 2;
        if (row.speed < 0 && item.x + item.w < -item.w) item.x = W + Math.random() * cellW * 2;
      });
    }
  }

  const pRow = getRow(player.row);
  const px = player.col * cellW + cellW / 2;
  const py = screenY(player.row) + cellH / 2;

  if (pRow.type === ROAD) {
    for (const car of pRow.items) {
      const carL = car.x;
      const carR = car.x + car.w;
      if (px > carL + 4 && px < carR - 4) {
        die('Squished by a car!');
        return;
      }
    }
  }

  if (pRow.type === RIVER) {
    let onAny = false;
    for (const log of pRow.items) {
      const logL = log.x;
      const logR = log.x + log.w;
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
    const newX = px + logSpeed * dt;
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

function drawRow(row) {
  const y = screenY(row.index);
  if (y > H + cellH || y < -cellH * 2) return;

  ctx.fillStyle = row.color;
  ctx.fillRect(0, y, W, cellH + 1);

  if (row.type === ROAD) {
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(0, y + cellH / 2);
    ctx.lineTo(W, y + cellH / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    row.items.forEach(car => {
      ctx.fillStyle = car.color;
      const cy = y + (cellH - car.h) / 2;
      ctx.beginPath();
      ctx.roundRect(car.x, cy, car.w, car.h, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.fillRect(car.x + 4, cy + 3, car.w * .3, car.h * .35);

      ctx.fillStyle = '#fbbf24';
      const isLeft = getRow(row.index).speed > 0;
      if (isLeft) {
        ctx.fillRect(car.x + car.w - 6, cy + 4, 4, 4);
        ctx.fillRect(car.x + car.w - 6, cy + car.h - 8, 4, 4);
      } else {
        ctx.fillRect(car.x + 2, cy + 4, 4, 4);
        ctx.fillRect(car.x + 2, cy + car.h - 8, 4, 4);
      }
    });
  }

  if (row.type === RIVER) {
    for (let wx = 0; wx < W; wx += 30) {
      ctx.strokeStyle = 'rgba(96,165,250,.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, y + cellH * .3 + Math.sin(wx * .05 + performance.now() * .002) * 3);
      ctx.lineTo(wx + 18, y + cellH * .3 + Math.sin((wx + 18) * .05 + performance.now() * .002) * 3);
      ctx.stroke();
    }

    row.items.forEach(log => {
      const ly = y + (cellH - log.h) / 2;
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.roundRect(log.x, ly, log.w, log.h, 6);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(log.x + 6, ly + 3, log.w - 12, 3);
      ctx.fillRect(log.x + 8, ly + log.h - 6, log.w - 16, 3);
    });
  }

  if (row.type === GRASS) {
    row.items.forEach(col => {
      const tx = col * cellW + cellW / 2;
      const ty = y + cellH / 2;
      ctx.fillStyle = '#166534';
      ctx.fillRect(tx - 4, ty - 14, 8, 18);
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(tx, ty - 18, 14, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (row.hasCoin >= 0) {
    const cx = row.hasCoin * cellW + cellW / 2;
    const cy = y + cellH / 2;
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPlayer() {
  const px = player.x || player.targetX;
  const py = (player.y || player.targetY) + cellH / 2;
  const bounce = hopAnim > 0 ? Math.sin(hopAnim / .15 * Math.PI) * 8 : 0;

  ctx.save();
  ctx.translate(px, py - bounce);

  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 12;

  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.ellipse(0, 0, cellW * .32, cellH * .28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.ellipse(0, -2, cellW * .2, cellH * .16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#052e16';
  ctx.beginPath();
  ctx.arc(-5, -4, 3, 0, Math.PI * 2);
  ctx.arc(5, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 4, .1, Math.PI - .1);
  ctx.stroke();

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#0f172a';
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

  if (idleTimer > 4 && running && !dead) {
    ctx.fillStyle = 'rgba(239,68,68,.7)';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('HOP! ' + Math.ceil(6 - idleTimer) + 's', W / 2, H * .15);
  }

  ctx.restore();
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
