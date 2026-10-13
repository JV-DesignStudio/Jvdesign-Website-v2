(function(){
const C = document.getElementById('game'), ctx = C.getContext('2d');
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
const sys = window.GameSystem ? new GameSystem('highway-dodge','Highway Dodge','ember') : null;
const storyRun = window.__storyRun = window.StoryRun ? new StoryRun({
  id:'highway-dodge', gameSystem:sys, title:'Highway Dodge', character:'Ember',
  open:'Ember is racing down the highway and the traffic is getting heavier.',
  objective:'Dodge as many cars as you can and keep driving.',
  beats:[{at:0,text:'The first wave of traffic appears.'},{at:.4,text:'Speed picks up and the lanes get busy.'},{at:.8,text:'Rush hour. Every gap counts.'}],
  cap:300,
  result:{
    success:'Ember clears the rush and the highway opens up ahead.',
    partial:'A few bumps, but Ember keeps the engine running.',
    fail:'The traffic wins this time, but Ember knows the lanes now.'
  },
  onRestart:function(){ startGame(); }
}) : null;

let W, H, dpr;
const LANE_COUNT = 3;
let laneW, roadL, roadR;
// 1 unit = the lane width of the original phone design (78 device px at dpr 1).
// Small details (lights, road markings, pickups) scale by this so the game
// looks the same at every screen size instead of only when the lane is 78px.
let U = 1;

let running = false, dead = false, paused = false;
let player, cars, pickups, particles, roadLines;
let score, speed, dist, nearMiss, combo, fuel;
let best = (sys ? GameSystem.getBestScore('highway-dodge') : 0) || 0;
let last = 0, spawnTimer = 0;
let swipeStartX = 0, swipeStartY = 0, swiping = false;

// Read-only debug handle so tests can verify death state and that same-lane
// traffic never overlaps.
window.__highway = {
  get running() { return running; },
  get dead() { return dead; },
  get score() { return score; },
  get playerLane() { return player ? player.lane : -1; },
  cars() { return cars.map(c => ({ lane: c.lane, y: c.y, h: c.h })); },
  get overlaps() {
    let n = 0;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        if (a.lane === b.lane && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 1) n++;
      }
    }
    return n;
  },
  get milestone() { return milestones ? milestones.next() : null; },
  get shake() { return shake ? shake.amount : 0; },
  get shakeHits() { return shake ? shake.hits : 0; },
  get playerX() { return player ? player.x : -1; },
  get laneW() { return laneW; },
  get roadL() { return roadL; },
  get roadR() { return roadR; }
};

// A952 showcase polish: score goals that celebrate as you hit them, and a
// screen shake on the crash. Shared implementation in ../game-showcase.js.
const MISSION = [500, 1500, 3000, 6000];
const milestones = window.JVDSShowcase ? new JVDSShowcase.Milestones(MISSION, function (m) {
  toast('Goal reached: ' + m + '!');
  try { audio?.playSuccess?.(); } catch(e) {}
  for (let i = 0; i < 16; i++) {
    particles.push({ x: player.x + (Math.random() - .5) * 60, y: H - player.h, vx: (Math.random() - .5) * 260, vy: -Math.random() * 260, life: 1, color: '#fbbf24', size: 3 });
  }
}) : null;
const shake = window.JVDSShowcase ? new JVDSShowcase.Shake(14) : null;
let dustTimer = 0;

let fitW = 0, fitH = 0;

// Lane x positions move whenever the canvas is resized (e.g. entering
// fullscreen after Start), so re-anchor the player, cars and pickups onto their
// lanes. Without this the player is left behind off the new road.
function remapLanes() {
  if (!player) return;
  player.x = player.targetX = laneX(player.lane);
  cars.forEach(c => { c.x = laneX(c.lane); });
  pickups.forEach(p => { p.x = laneX(p.lane); });
}

function fit() {
  const r = C.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  const nW = Math.round(r.width * dpr), nH = Math.round(r.height * dpr);
  if (nW === fitW && nH === fitH) return;   // no size change this frame
  const resized = fitW !== 0;
  fitW = nW; fitH = nH;
  W = nW; H = nH;
  C.width = W; C.height = H;
  // Size a lane from the width, but never let the road balloon on wide or short
  // screens: cap the lane by the canvas height so roughly the same number of car
  // lengths stays visible everywhere, then centre the road.
  laneW = Math.min(W / (LANE_COUNT + 2), H / 7.5);
  U = laneW / 78;
  roadL = (W - laneW * LANE_COUNT) / 2;
  roadR = roadL + laneW * LANE_COUNT;
  if (resized) remapLanes();
}

function laneX(lane) { return roadL + laneW / 2 + lane * laneW; }

const carColors = ['#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#06b6d4'];
const truckColors = ['#64748b','#475569','#78716c','#92400e'];
// Every car in a lane moves at the same pace (the lane multiplier is applied to
// the live speed each frame), so traffic in a lane can never overtake or overlap.
const LANE_SPEED = [0.85, 1.0, 1.15];

// True when the top of the road is clear enough in this lane to drop in a car
// of height newH without it touching the traffic already there.
function laneClear(lane, newH) {
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (c.lane !== lane) continue;
    const gap = (c.y - c.h / 2) - (-newH / 2); // existing top vs new car's tail
    if (gap < laneW * 0.5) return false;
  }
  return true;
}

function addTraffic() {
  const order = [0, 1, 2].sort(() => Math.random() - .5);
  for (let oi = 0; oi < order.length; oi++) {
    const lane = order[oi];
    const isTruck = Math.random() < .2 + dist * .00002;
    const w = isTruck ? laneW * .72 : laneW * .52;
    const h = isTruck ? laneW * 1.6 : laneW * 1.1;
    if (!laneClear(lane, h)) continue;
    const colors = isTruck ? truckColors : carColors;
    cars.push({
      x: laneX(lane), y: -h, w, h, lane, isTruck,
      mul: LANE_SPEED[lane],
      color: colors[Math.floor(Math.random() * colors.length)],
      nearCounted: false
    });
    return true;
  }
  return false;
}

function makePickup() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const type = Math.random() < .3 ? 'shield' : 'fuel';
  return { x: laneX(lane), y: -40 * U, lane, type, r: laneW * .26, bob: 0 };
}

function reset() {
  player = { lane: 1, x: 0, targetX: 0, w: laneW * .48, h: laneW * 1.05, shield: 0, tilt: 0 };
  player.x = laneX(1);
  player.targetX = player.x;
  cars = []; pickups = []; particles = []; roadLines = [];
  score = 0; speed = 280; dist = 0; nearMiss = 0; combo = 0; fuel = 100;
  spawnTimer = 0;
  dustTimer = 0;
  if (milestones) milestones.reset();
  if (shake) shake.reset();
  for (let i = 0; i < 20; i++) {
    roadLines.push({ y: i * (H / 8), x: 0 });
  }
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 800);
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300,
      life: 1, color, size: 2 + Math.random() * 4
    });
  }
}

function moveLane(dir) {
  if (!running || dead) return;
  const newLane = Math.max(0, Math.min(LANE_COUNT - 1, player.lane + dir));
  if (newLane !== player.lane) {
    player.lane = newLane;
    player.targetX = laneX(newLane);
    player.tilt = dir * .3;
    try { audio?.playTap?.(); } catch(e) {}
  }
}

function startGame() {
  reset();
  running = true;
  dead = false;
  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  sys?.beginRun?.();
  if (storyRun && !storyRun.running) storyRun.begin();
  last = performance.now();
}

function endGame() {
  if (dead) return;
  dead = true;
  running = false;
  if (shake) shake.hit(16);
  if (score > best) {
    best = score;
    if (sys) GameSystem.saveScore('highway-dodge', best);
  }
  sys?.saveState?.();
  burst(player.x, H - player.h * 1.5, '#ef4444', 30);
  try { audio?.playError?.(); } catch(e) {}
  if (storyRun) {
    storyRun.finish(score > 2000 ? 'success' : 'fail', score);
  } else {
    showEnd();
  }
}

function showEnd() {
  $('endTitle').textContent = score > 5000 ? 'Epic Run!' : score > 2000 ? 'Nice Drive!' : 'Crashed!';
  $('endStats').innerHTML = [
    ['Score', score], ['Near Misses', nearMiss], ['Top Speed', Math.round(60 + dist * .008)], ['Best', best]
  ].map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  $('endScreen').classList.remove('hidden');
}

function hud() {
  $('scoreHud').textContent = score;
  $('speedHud').textContent = Math.round(60 + dist * .008);
  $('nearHud').textContent = nearMiss;
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
  dist += speed * dt;
  speed = 280 + dist * .04;
  score += Math.ceil(dt * speed * .15);
  if (milestones) milestones.check(score);

  player.x += (player.targetX - player.x) * Math.min(1, dt * 14);
  player.tilt *= .92;

  // tyre smoke trailing the car
  dustTimer -= dt;
  if (dustTimer <= 0 && window.JVDSShowcase) {
    JVDSShowcase.dust(particles, player.x, H - player.h * .1, 'rgba(148,163,184,.9)', 2, { drift: 40, spread: 16, up: 40, size: 2 });
    dustTimer = .12;
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const gap = Math.max(.28, .9 - dist * .00004);
    if (addTraffic()) {
      spawnTimer = gap + Math.random() * gap * .5;
      if (Math.random() < .12) pickups.push(makePickup());
    } else {
      spawnTimer = 0.08; // every lane is still busy; try again shortly
    }
  }

  const pTop = H - player.h * 1.8;
  const pBot = H - player.h * .5;
  const pHalfW = player.w / 2;

  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    c.y += speed * (1 - c.mul) * dt + speed * dt * .6;

    if (c.y > H + c.h) { cars.splice(i, 1); continue; }

    const cTop = c.y - c.h / 2;
    const cBot = c.y + c.h / 2;
    const cHalfW = c.w / 2;

    if (Math.abs(player.x - c.x) < pHalfW + cHalfW &&
        pTop < cBot && pBot > cTop) {
      if (player.shield > 0) {
        player.shield = 0;
        cars.splice(i, 1);
        score += 200;
        burst(c.x, c.y, '#22d3ee', 20);
        toast('Shield saved you!');
        try { audio?.playPop?.(); } catch(e) {}
        continue;
      }
      endGame();
      return;
    }

    if (!c.nearCounted && c.y > pTop - 10 && c.y < pBot + 10) {
      const gap = Math.abs(player.x - c.x) - pHalfW - cHalfW;
      if (gap > 0 && gap < laneW * .25) {
        c.nearCounted = true;
        nearMiss++;
        combo++;
        const bonus = 50 + combo * 25;
        score += bonus;
        toast('Near Miss x' + combo + ' +' + bonus);
        burst(player.x, pTop, '#fbbf24', 8);
        try { audio?.playSuccess?.(); } catch(e) {}
      }
    }
    if (c.nearCounted && c.y > pBot + laneW) combo = 0;
  }

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.y += speed * dt * .7;
    p.bob += dt * 5;
    if (p.y > H + 40) { pickups.splice(i, 1); continue; }
    if (Math.abs(player.x - p.x) < pHalfW + p.r && Math.abs((pTop + pBot) / 2 - p.y) < player.h / 2 + p.r) {
      if (p.type === 'shield') {
        player.shield = 1;
        toast('Shield!');
        score += 100;
      } else {
        score += 150;
        toast('+Fuel!');
      }
      burst(p.x, p.y, p.type === 'shield' ? '#22d3ee' : '#22c55e', 12);
      try { audio?.playPop?.(); } catch(e) {}
      pickups.splice(i, 1);
    }
  }

  roadLines.forEach(l => {
    l.y += speed * dt;
    if (l.y > H + 20) l.y -= H * 1.3;
  });

  hud();
}

function drawRoad() {
  const grad = ctx.createLinearGradient(roadL, 0, roadR, 0);
  grad.addColorStop(0, '#1e293b');
  grad.addColorStop(.5, '#334155');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(roadL, 0, roadR - roadL, H);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, roadL, H);
  ctx.fillRect(roadR, 0, W - roadR, H);

  const edge = Math.max(2, laneW * .04);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(roadL - edge, 0, edge, H);
  ctx.fillRect(roadR, 0, edge, H);

  ctx.fillStyle = 'rgba(255,255,255,.35)';
  const dashW = Math.max(2, laneW * .05);
  const dashH = laneW * .4;
  roadLines.forEach(l => {
    for (let i = 1; i < LANE_COUNT; i++) {
      ctx.fillRect(roadL + i * laneW - dashW / 2, l.y, dashW, dashH);
    }
  });
}

function drawCar(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  const hw = c.w / 2, hh = c.h / 2;

  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, c.w, c.h, 6 * U);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(-hw + 4 * U, -hh + 4 * U, c.w - 8 * U, c.h * .25);

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-hw + 2 * U, hh - 8 * U, 8 * U, 6 * U);
  ctx.fillRect(hw - 10 * U, hh - 8 * U, 8 * U, 6 * U);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-hw + 2 * U, -hh + 2 * U, 8 * U, 6 * U);
  ctx.fillRect(hw - 10 * U, -hh + 2 * U, 8 * U, 6 * U);

  if (c.isTruck) {
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.fillRect(-hw + 3 * U, -hh + c.h * .35, c.w - 6 * U, c.h * .5);
  }
  ctx.restore();
}

function drawPlayer() {
  const py = H - player.h * 1.3;
  ctx.save();
  ctx.translate(player.x, py);
  ctx.rotate(player.tilt);

  if (player.shield > 0) {
    ctx.strokeStyle = 'rgba(34,211,238,.6)';
    ctx.lineWidth = 3 * U;
    ctx.beginPath();
    ctx.arc(0, 0, player.w * .8, 0, Math.PI * 2);
    ctx.stroke();
  }

  const hw = player.w / 2, hh = player.h / 2;

  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 18 * U;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, player.w, player.h, 8 * U);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-hw + 3 * U, -hh + player.h * .15, player.w - 6 * U, player.h * .28);

  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(-hw + 4 * U, -hh + 3 * U, player.w - 8 * U, player.h * .12);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-hw + 3 * U, hh - 8 * U, 10 * U, 6 * U);
  ctx.fillRect(hw - 13 * U, hh - 8 * U, 10 * U, 6 * U);

  const flame = (8 + Math.sin(dist * .05) * 5) * U;
  ctx.fillStyle = 'rgba(251,146,60,.7)';
  ctx.beginPath();
  ctx.moveTo(-hw + 8 * U, hh);
  ctx.lineTo(-hw + 4 * U, hh + flame);
  ctx.lineTo(-hw + 16 * U, hh);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hw - 8 * U, hh);
  ctx.lineTo(hw - 4 * U, hh + flame);
  ctx.lineTo(hw - 16 * U, hh);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPickup(p) {
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(p.bob) * 4 * U);
  ctx.fillStyle = p.type === 'shield' ? '#22d3ee' : '#22c55e';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 14 * U;
  ctx.beginPath();
  ctx.arc(0, 0, 16 * U, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + (16 * U) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.type === 'shield' ? '🛡' : '⛽', 0, 1);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (shake) shake.apply(ctx, dpr);

  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(255,255,255,' + (.02 + (i % 5) * .01) + ')';
    ctx.fillRect((i * 67 + dist * .02) % W, (i * 43) % (H * .3), 2, 2);
  }

  drawRoad();
  pickups.forEach(drawPickup);
  cars.forEach(drawCar);
  drawPlayer();

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (combo > 1) {
    ctx.fillStyle = 'rgba(251,191,36,.8)';
    ctx.font = 'bold ' + (20 * U) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('COMBO x' + combo, W / 2, H * .12);
  }

  if (!running && !dead) {
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(0, 0, W, H);
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

C.addEventListener('pointerdown', e => {
  if (!running && !dead) { startGame(); return; }
  swipeStartX = e.clientX;
  swipeStartY = e.clientY;
  swiping = true;
});
C.addEventListener('pointermove', e => {
  if (!swiping) return;
  const dx = e.clientX - swipeStartX;
  if (Math.abs(dx) > 25) {
    moveLane(dx > 0 ? 1 : -1);
    swipeStartX = e.clientX;
  }
});
C.addEventListener('pointerup', () => swiping = false);

document.addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLane(-1);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') moveLane(1);
  if (e.code === 'Space') { if (!running) startGame(); }
  if (['ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});

$('playBtn').onclick = startGame;
// On-screen lane buttons on phones (engine runtime v2.4; hidden on desktop).
if (window.JVDSEngine && JVDSEngine.runtime && JVDSEngine.runtime.touch) {
  JVDSEngine.runtime.touch({ buttons: [{ label: '◀', code: 'ArrowLeft' }, { label: '▶', code: 'ArrowRight' }] });
}
$('againBtn').onclick = startGame;
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
