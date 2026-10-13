(function(){
const C = document.getElementById('game'), ctx = C.getContext('2d');
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
const sys = window.GameSystem ? new GameSystem('little-steps','Little Steps','pip') : null;
const storyRun = window.StoryRun ? new StoryRun({
  id:'little-steps', gameSystem:sys, title:'Little Steps', character:'Pip',
  open:'Pip is at the start of a forest trail and camp is waiting at the end.',
  objective:'Walk through the trail, collect stars, and reach camp.',
  beats:[{at:0,text:'The trail opens through the trees.'},{at:.45,text:'The path winds and the puddles get bigger.'},{at:.8,text:'Camp is close! Find the last stretch.'}],
  cap:300,
  result:{
    success:'Pip reaches camp with pockets full of stars.',
    partial:'Almost there! A few more steps next time.',
    fail:'The trail loops back, but Pip knows the way now.'
  },
  onRestart:function(){ startGame(); }
}) : null;

let W, H, dpr;
const GRID = 7;
let cellSize;
let player, grid, stars, steps, trail, totalStars, campPos;
let running = false, won = false;
let best = (sys ? GameSystem.getBestScore('little-steps') : 0) || 0;
let moveAnim = 0;

const EMPTY = 0, TREE = 1, PUDDLE = 2, STAR = 3, CAMP = 4, FLOWER = 5;

function fit() {
  const r = C.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.round(r.width * dpr);
  H = Math.round(r.height * dpr);
  C.width = W; C.height = H;
  cellSize = Math.min(W, H) / (GRID + 1);
}

function generateTrail() {
  grid = [];
  for (let r = 0; r < GRID; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID; c++) {
      grid[r][c] = EMPTY;
    }
  }

  for (let i = 0; i < 6 + trail; i++) {
    let r, c;
    do { r = Math.floor(Math.random() * GRID); c = Math.floor(Math.random() * GRID); }
    while ((r === 0 && c === Math.floor(GRID/2)) || (r === GRID-1 && c === Math.floor(GRID/2)) || grid[r][c] !== EMPTY);
    grid[r][c] = TREE;
  }

  for (let i = 0; i < 3 + Math.floor(trail * .5); i++) {
    let r, c;
    do { r = Math.floor(Math.random() * GRID); c = Math.floor(Math.random() * GRID); }
    while ((r === 0 && c === Math.floor(GRID/2)) || (r === GRID-1 && c === Math.floor(GRID/2)) || grid[r][c] !== EMPTY);
    grid[r][c] = PUDDLE;
  }

  totalStars = 0;
  for (let i = 0; i < 3 + trail; i++) {
    let r, c;
    do { r = Math.floor(Math.random() * GRID); c = Math.floor(Math.random() * GRID); }
    while ((r === 0 && c === Math.floor(GRID/2)) || (r === GRID-1 && c === Math.floor(GRID/2)) || grid[r][c] !== EMPTY);
    grid[r][c] = STAR;
    totalStars++;
  }

  for (let i = 0; i < 2; i++) {
    let r, c;
    do { r = Math.floor(Math.random() * GRID); c = Math.floor(Math.random() * GRID); }
    while (grid[r][c] !== EMPTY);
    grid[r][c] = FLOWER;
  }

  campPos = { r: GRID - 1, c: Math.floor(GRID/2) };
  grid[campPos.r][campPos.c] = CAMP;

  player = { r: 0, c: Math.floor(GRID/2) };
  grid[player.r][player.c] = EMPTY;
}

function move(dr, dc) {
  if (!running || won) return;
  const nr = player.r + dr;
  const nc = player.c + dc;
  if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return;
  if (grid[nr][nc] === TREE) return;

  if (grid[nr][nc] === PUDDLE) {
    steps += 2;
    try { audio?.playError?.(); } catch(e) {}
  } else {
    steps++;
  }

  if (grid[nr][nc] === STAR) {
    stars++;
    try { audio?.playSuccess?.(); } catch(e) {}
  }

  if (grid[nr][nc] === FLOWER) {
    try { audio?.playPop?.(); } catch(e) {}
  }

  player.r = nr;
  player.c = nc;
  moveAnim = .2;

  if (grid[nr][nc] === CAMP) {
    winTrail();
    return;
  }

  if (grid[nr][nc] !== TREE && grid[nr][nc] !== PUDDLE) {
    grid[nr][nc] = EMPTY;
  }

  try { if (grid[nr][nc] !== PUDDLE) audio?.playTap?.(); } catch(e) {}
  hud();
}

function winTrail() {
  won = true;
  running = false;
  const bonus = stars * 30 + Math.max(0, 100 - steps * 2) + trail * 20;
  const total = (best || 0) + bonus;
  if (total > best) { best = total; if (sys) GameSystem.saveScore('little-steps', best); }
  sys?.saveState?.();
  try { audio?.playSuccess?.(); } catch(e) {}

  $('endTitle').textContent = stars >= totalStars ? 'All Stars!' : 'Camp Reached!';
  $('endStats').innerHTML = [['Stars', stars + '/' + totalStars],['Steps', steps],['Trail', trail + 1],['Score', bonus]].map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  $('endScreen').classList.remove('hidden');

  if (storyRun) storyRun.setScore(bonus);
}

function nextTrail() {
  trail++;
  stars = 0;
  steps = 0;
  won = false;
  running = true;
  generateTrail();
  $('endScreen').classList.add('hidden');
  hud();
}

function hud() {
  $('starsHud').textContent = stars;
  $('trailHud').textContent = trail + 1;
  $('stepsHud').textContent = steps;
  $('bestHud').textContent = best;
  if (storyRun) storyRun.setScore(stars * 30);
}

function startGame() {
  trail = 0; stars = 0; steps = 0;
  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  running = true;
  won = false;
  sys?.beginRun?.();
  if (storyRun && !storyRun.running) storyRun.begin();
  generateTrail();
  hud();
}

function screenPos(r, c) {
  const ox = (W - GRID * cellSize) / 2;
  const oy = (H - GRID * cellSize) / 2;
  return { x: ox + c * cellSize + cellSize / 2, y: oy + r * cellSize + cellSize / 2 };
}

function draw() {
  fit();
  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fef3c7');
  bg.addColorStop(1, '#d9f99d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (!grid) { requestAnimationFrame(draw); return; }

  moveAnim = Math.max(0, moveAnim - .016);

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const p = screenPos(r, c);
      const s = cellSize * .42;

      ctx.fillStyle = 'rgba(101,163,13,.08)';
      ctx.fillRect(p.x - cellSize/2 + 2, p.y - cellSize/2 + 2, cellSize - 4, cellSize - 4);
      ctx.strokeStyle = 'rgba(101,163,13,.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - cellSize/2 + 2, p.y - cellSize/2 + 2, cellSize - 4, cellSize - 4);

      const tile = grid[r][c];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = Math.round(s * 1.4) + 'px serif';

      if (tile === TREE) {
        ctx.fillStyle = '#166534';
        ctx.fillText('🌲', p.x, p.y);
      } else if (tile === PUDDLE) {
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('💧', p.x, p.y);
      } else if (tile === STAR) {
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.fillText('⭐', p.x, p.y);
        ctx.shadowBlur = 0;
      } else if (tile === CAMP) {
        ctx.fillText('⛺', p.x, p.y);
      } else if (tile === FLOWER) {
        ctx.fillText('🌸', p.x, p.y);
      }
    }
  }

  const pp = screenPos(player.r, player.c);
  const bounce = moveAnim > 0 ? Math.sin(moveAnim / .2 * Math.PI) * 6 : 0;
  ctx.font = Math.round(cellSize * .55) + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 10;
  ctx.fillText('🐾', pp.x, pp.y - bounce);
  ctx.shadowBlur = 0;

  requestAnimationFrame(draw);
}

let swX = 0, swY = 0;
C.addEventListener('pointerdown', e => { swX = e.clientX; swY = e.clientY; });
C.addEventListener('pointerup', e => {
  if (!running) return;
  const dx = e.clientX - swX, dy = e.clientY - swY;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 10 && ady < 10) { move(1, 0); return; }
  if (adx > ady) move(0, dx > 0 ? 1 : -1);
  else move(dy > 0 ? 1 : -1, 0);
});

document.addEventListener('keydown', e => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); move(-1, 0); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); move(1, 0); }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); move(0, -1); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); move(0, 1); }
  if (e.code === 'Space') { e.preventDefault(); if (!running) startGame(); }
});

$('playBtn').onclick = startGame;
$('againBtn').onclick = nextTrail;
// On-screen controls on phones (engine runtime v2.4). The pad dispatches the
// same arrow-key events the game already listens for, so no game logic changes,
// and the CSS hides it on desktop.
if (window.JVDSEngine && JVDSEngine.runtime && JVDSEngine.runtime.touch) {
  JVDSEngine.runtime.touch({ dpad: true, target: document });
}
$('soundBtn').onclick = function() {
  const on = localStorage.getItem('soundEnabled') !== 'false';
  localStorage.setItem('soundEnabled', on ? 'false' : 'true');
  if (audio) audio.setMasterVolume(on ? 0 : .5);
  $('soundBtn').textContent = on ? '🔇' : '🔊';
};

fit();
$('bestHud').textContent = best;
requestAnimationFrame(draw);
})();
