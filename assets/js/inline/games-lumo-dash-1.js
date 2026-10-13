(function(){
const C = document.getElementById('game'), ctx = C.getContext('2d');
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
const sys = window.GameSystem ? new GameSystem('lumo-dash',"Lumo's Dash",'lumo') : null;
const storyRun = window.__storyRun = window.StoryRun ? new StoryRun({
  id:'lumo-dash', gameSystem:sys, title:"Lumo's Dash", character:'Lumo',
  open:'Lumo the purple fox is dashing through the enchanted forest and the glow is fading.',
  objective:'Run as far as you can, collect stardust, and dodge every obstacle.',
  beats:[{at:0,text:'The forest path opens and the first obstacles appear.'},{at:.45,text:'The canopy thickens and the pace quickens.'},{at:.82,text:'Deep forest now. Every jump counts.'}],
  cap:300,
  result:{
    success:"Lumo's glow is blazing and the forest opens to a clearing.",
    partial:'The glow holds, but barely. Lumo rests before the next dash.',
    fail:'The glow flickers out, but Lumo knows the path better now.'
  },
  onRestart:function(){ startGame(); }
}) : null;

let W, H, dpr;
const GROUND_RATIO = .78;
let groundY;

let running = false, dead = false;
let player, obstacles, dusts, bgLayers, fgTufts, groundMarks, particles;
let score, dist, dustCount, speed, best;
let last = 0, spawnTimer = 0;

best = (sys ? GameSystem.getBestScore('lumo-dash') : 0) || 0;

// Lumo the purple fox. Falls back to a glow blob until the sprite decodes.
const foxImg = new Image();
foxImg.src = 'chars/lumo.png';

// Parallax forest: far ridge -> near trees, drawn behind the fox; foreground
// grass tufts and the ground texture scroll faster, in front of and under him.
// Each background layer has its own scroll speed (fraction of the world speed)
// and its own opacity for atmospheric perspective.
const BG_LAYERS = [
  { speed: .07, alpha: .20, color: '#4a3a86', minH: 130, maxH: 210, count: 12 },
  { speed: .15, alpha: .32, color: '#3b2a76', minH: 105, maxH: 175, count: 10 },
  { speed: .28, alpha: .48, color: '#2c1f63', minH: 80,  maxH: 145, count: 9 },
  { speed: .50, alpha: .66, color: '#1e1550', minH: 60,  maxH: 115, count: 8 }
];
const FG_SPEED = 1.2;
const GROUND_SPEED = 1;

// Read-only debug handle for tests (movement, death state and parallax speeds).
window.__lumo = {
  get running() { return running; },
  get dead() { return dead; },
  get score() { return score; },
  get grounded() { return player ? player.grounded : false; },
  get sliding() { return player ? player.sliding : false; },
  get y() { return player ? player.y : 0; },
  get groundY() { return groundY; },
  get parallax() {
    return {
      speeds: { foreground: FG_SPEED, ground: GROUND_SPEED, background: BG_LAYERS.map(l => l.speed) },
      layers: (bgLayers || []).map(l => l.items.map(i => i.x)),
      foreground: (fgTufts || []).map(t => t.x),
      ground: (groundMarks || []).map(m => m.x)
    };
  },
  get milestone() { return milestones ? milestones.next() : null; },
  get shake() { return shake ? shake.amount : 0; },
  get shakeHits() { return shake ? shake.hits : 0; }
};

// A952 showcase polish: distance goals that celebrate as you reach them, and a
// screen shake on the crash. Shared implementation in ../game-showcase.js.
const MISSION = [50, 100, 200, 400];
const milestones = window.JVDSShowcase ? new JVDSShowcase.Milestones(MISSION, function (m) {
  toast(m + 'm! Keep dashing!');
  try { audio?.playSuccess?.(); } catch(e) {}
  for (let i = 0; i < 14; i++) {
    particles.push({ x: player.x + (Math.random() - .5) * 50, y: player.y - player.h, vx: (Math.random() - .5) * 240, vy: -Math.random() * 240, life: 1, color: '#fde68a', size: 3 });
  }
}) : null;
const shake = window.JVDSShowcase ? new JVDSShowcase.Shake(14) : null;
let dustTimer = 0;

function buildAmbient() {
  if (!W || !dpr || !groundY) return;
  bgLayers = BG_LAYERS.map(cfg => {
    const items = [];
    for (let i = 0; i < cfg.count; i++) {
      items.push({
        x: Math.random() * (W + 160 * dpr) - 80 * dpr,
        h: (cfg.minH + Math.random() * (cfg.maxH - cfg.minH)) * dpr,
        w: (26 + Math.random() * 26) * dpr,
        pine: Math.random() < .6
      });
    }
    return { speed: cfg.speed, alpha: cfg.alpha, color: cfg.color, minH: cfg.minH, maxH: cfg.maxH, items };
  });
  fgTufts = [];
  for (let i = 0; i < 18; i++) {
    fgTufts.push({
      x: Math.random() * (W + 120 * dpr) - 60 * dpr,
      h: (12 + Math.random() * 26) * dpr,
      w: (8 + Math.random() * 14) * dpr
    });
  }
  groundMarks = [];
  for (let i = 0; i < 28; i++) {
    groundMarks.push({
      x: Math.random() * W,
      y: groundY + (H - groundY) * (.18 + Math.random() * .7),
      w: (3 + Math.random() * 7) * dpr,
      dash: Math.random() < .4
    });
  }
}

function fit() {
  const r = C.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.round(r.width * dpr);
  H = Math.round(r.height * dpr);
  C.width = W; C.height = H;
  groundY = H * GROUND_RATIO;
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
      x, y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 200,
      life: 1, color, size: 2 + Math.random() * 3
    });
  }
}

const obstacleTypes = [
  { type: 'gap', w: 60, h: 0 },
  { type: 'rock', w: 36, h: 42 },
  { type: 'log', w: 50, h: 36 },
  { type: 'branch', w: 80, h: 24 },
  { type: 'double', w: 40, h: 50 },
];

function makeObstacle() {
  const dFactor = Math.min(1, dist / 8000);
  const types = obstacleTypes.filter(t => {
    if (t.type === 'double' && dFactor < .3) return false;
    return true;
  });
  const tmpl = types[Math.floor(Math.random() * types.length)];
  const scale = dpr;
  return {
    type: tmpl.type,
    x: W + 50,
    y: tmpl.type === 'branch' ? groundY - 70 * scale : groundY,
    w: tmpl.w * scale,
    h: tmpl.h * scale,
    low: tmpl.type === 'branch',
    passed: false
  };
}

function makeDust() {
  const yOff = -20 - Math.random() * 80;
  return {
    x: W + 30 + Math.random() * 200,
    y: groundY + yOff * dpr,
    r: 10, collected: false, bob: Math.random() * 6
  };
}

function reset() {
  const scale = dpr;
  player = {
    x: W * .18,
    y: groundY,
    w: 28 * scale,
    h: 44 * scale,
    vy: 0,
    grounded: true,
    sliding: false,
    slideTimer: 0,
    runFrame: 0
  };
  obstacles = []; dusts = []; particles = [];
  buildAmbient();
  score = 0; dist = 0; dustCount = 0; speed = 320;
  spawnTimer = 1;
  dustTimer = 0;
  if (milestones) milestones.reset();
  if (shake) shake.reset();
}

function jump() {
  if (!running || dead) return;
  if (player.grounded) {
    player.vy = -580 * dpr;
    player.grounded = false;
    player.sliding = false;
    try { audio?.playPop?.(); } catch(e) {}
  }
}

function slide() {
  if (!running || dead) return;
  if (player.grounded && !player.sliding) {
    player.sliding = true;
    player.slideTimer = .45;
    try { audio?.playTap?.(); } catch(e) {}
  }
}

function startGame() {
  reset();
  running = true;
  dead = false;
  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  if ('ontouchstart' in window) $('touchControls').style.display = 'flex';
  sys?.beginRun?.();
  if (storyRun && !storyRun.running) storyRun.begin();
  last = performance.now();
}

function endGame(reason) {
  if (dead) return;
  dead = true;
  running = false;
  if (shake) shake.hit(16);
  if (score > best) {
    best = score;
    if (sys) GameSystem.saveScore('lumo-dash', best);
  }
  sys?.saveState?.();
  burst(player.x, player.y - player.h / 2, '#a78bfa', 24);
  try { audio?.playError?.(); } catch(e) {}
  toast(reason || 'Crashed!');
  if (storyRun) {
    storyRun.finish(score > 3000 ? 'success' : 'fail', score);
  } else {
    showEnd();
  }
}

function showEnd() {
  $('endTitle').textContent = score > 5000 ? 'Amazing Run!' : score > 2000 ? 'Good Run!' : 'Run Over';
  $('endStats').innerHTML = [
    ['Score', score], ['Distance', Math.floor(dist) + 'm'], ['Stardust', dustCount], ['Best', best]
  ].map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  $('endScreen').classList.remove('hidden');
}

function hud() {
  $('scoreHud').textContent = score;
  $('distHud').textContent = Math.floor(dist) + 'm';
  $('dustHud').textContent = dustCount;
  $('bestHud').textContent = best;
  const goal = milestones ? milestones.next() : null;
  $('goalHud').textContent = goal == null ? 'Done' : goal + 'm';
  if (storyRun) storyRun.setScore(score);
}

function update(dt) {
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
    p.life -= dt * 2;
  });
  particles = particles.filter(p => p.life > 0);

  if (!running || dead) return;

  speed = 320 + dist * .025;
  dist += speed * dt * .01;
  score += Math.ceil(dt * speed * .08);
  if (milestones) milestones.check(dist);

  player.runFrame += dt * speed * .02;

  // dust kicked up while the fox runs on the ground
  dustTimer -= dt;
  if (dustTimer <= 0 && player.grounded && !player.sliding && window.JVDSShowcase) {
    JVDSShowcase.dust(particles, player.x - player.w * .4, player.y, 'rgba(167,139,250,.8)', 2, { drift: 40, spread: 14, up: 60, size: 1.8 });
    dustTimer = .14;
  }
  player.vy += 1400 * dpr * dt;
  player.y += player.vy * dt;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.grounded = true;
  }

  if (player.sliding) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) player.sliding = false;
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    obstacles.push(makeObstacle());
    if (Math.random() < .6) dusts.push(makeDust());
    if (Math.random() < .3) dusts.push(makeDust());
    spawnTimer = Math.max(.55, 1.4 - dist * .0003) + Math.random() * .3;
  }

  const pH = player.sliding ? player.h * .4 : player.h;
  const pTop = player.y - pH;
  const pLeft = player.x - player.w / 2;
  const pRight = player.x + player.w / 2;

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed * dt;
    if (o.x + o.w < -20) { obstacles.splice(i, 1); continue; }

    if (!o.passed && o.x + o.w < pLeft) {
      o.passed = true;
      score += 30;
    }

    if (o.type === 'gap') {
      if (player.grounded && pRight > o.x + 8 && pLeft < o.x + o.w - 8) {
        endGame('Fell in the gap!');
        return;
      }
      continue;
    }

    const oTop = o.y - o.h;
    const oBot = o.y;
    const oLeft = o.x;
    const oRight = o.x + o.w;

    if (pRight > oLeft + 4 && pLeft < oRight - 4) {
      if (o.low) {
        if (pTop < oBot && !player.sliding) {
          endGame('Hit the branch!');
          return;
        }
      } else {
        if (player.y > oTop + 6) {
          endGame('Hit a ' + o.type + '!');
          return;
        }
      }
    }
  }

  for (let i = dusts.length - 1; i >= 0; i--) {
    const d = dusts[i];
    d.x -= speed * dt;
    d.bob += dt * 4;
    if (d.x < -20) { dusts.splice(i, 1); continue; }
    if (!d.collected && Math.abs(player.x - d.x) < 28 * dpr && Math.abs((player.y - pH / 2) - d.y) < 28 * dpr) {
      d.collected = true;
      dustCount++;
      score += 75;
      burst(d.x, d.y, '#fde68a', 8);
      toast('+Stardust!');
      try { audio?.playSuccess?.(); } catch(e) {}
    }
  }
  dusts = dusts.filter(d => !d.collected);

  for (const layer of bgLayers) {
    for (const t of layer.items) {
      t.x -= speed * dt * layer.speed;
      if (t.x < -90 * dpr) {
        t.x = W + 70 * dpr + Math.random() * 140 * dpr;
        t.h = (layer.minH + Math.random() * (layer.maxH - layer.minH)) * dpr;
      }
    }
  }
  fgTufts.forEach(t => {
    t.x -= speed * dt * FG_SPEED;
    if (t.x < -50 * dpr) t.x = W + 50 * dpr + Math.random() * 100 * dpr;
  });
  groundMarks.forEach(m => {
    m.x -= speed * dt * GROUND_SPEED;
    if (m.x < -12 * dpr) m.x = W + Math.random() * 40 * dpr;
  });

  hud();
}

function drawTree(t, base) {
  const baseY = base + 2 * dpr;
  ctx.fillRect(t.x - t.w * .12, baseY - t.h * .55, t.w * .24, t.h * .55 + 2);
  if (t.pine) {
    ctx.beginPath();
    ctx.moveTo(t.x, baseY - t.h);
    ctx.lineTo(t.x - t.w * .62, baseY - t.h * .28);
    ctx.lineTo(t.x + t.w * .62, baseY - t.h * .28);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(t.x, baseY - t.h * .68);
    ctx.lineTo(t.x - t.w * .74, baseY - t.h * .04);
    ctx.lineTo(t.x + t.w * .74, baseY - t.h * .04);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(t.x, baseY - t.h * .68, t.w * .62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(t.x - t.w * .1, baseY - t.h * .68, t.w * .2, t.h * .68);
  }
}

function drawBg() {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#0c0d2c');
  sky.addColorStop(.6, '#1a1040');
  sky.addColorStop(1, '#2e1065');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, groundY);

  for (let i = 0; i < 46; i++) {
    ctx.fillStyle = 'rgba(255,255,255,' + (.05 + (i % 6) * .015) + ')';
    ctx.fillRect((i * 97 + dist * 1.5) % W, 10 + (i * 31) % (groundY * .5), 2, 2);
  }

  ctx.fillStyle = 'rgba(192,132,252,.18)';
  ctx.beginPath();
  ctx.arc(W * .8, groundY * .2, 62 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.arc(W * .8, groundY * .2, 40, 0, Math.PI * 2);
  ctx.fill();

  bgLayers.forEach(layer => {
    ctx.globalAlpha = layer.alpha;
    ctx.fillStyle = layer.color;
    layer.items.forEach(t => drawTree(t, groundY));
  });
  ctx.globalAlpha = 1;

  const mist = ctx.createLinearGradient(0, groundY - 70 * dpr, 0, groundY + 12 * dpr);
  mist.addColorStop(0, 'rgba(150,140,230,0)');
  mist.addColorStop(1, 'rgba(150,140,230,.12)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, groundY - 70 * dpr, W, 82 * dpr);

  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = '#312e81';
  ctx.fillRect(0, groundY, W, 3);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  groundMarks.forEach(m => {
    if (m.dash) {
      ctx.fillRect(m.x, m.y, m.w * 2.2, 2);
    } else {
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.w, m.w * .5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawForeground() {
  ctx.globalAlpha = .95;
  ctx.fillStyle = '#0b0820';
  const baseY = groundY + 2 * dpr;
  fgTufts.forEach(t => {
    ctx.beginPath();
    ctx.moveTo(t.x - t.w * .55, baseY);
    ctx.quadraticCurveTo(t.x - t.w * .25, baseY - t.h * .7, t.x, baseY - t.h);
    ctx.quadraticCurveTo(t.x + t.w * .25, baseY - t.h * .7, t.x + t.w * .55, baseY);
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  const sliding = player.sliding;

  const runBob = (player.grounded && !sliding) ? Math.abs(Math.sin(player.runFrame * 1.2)) * 4 * dpr : 0;
  if (sliding) { ctx.scale(1, .62); ctx.translate(0, -4 * dpr); }
  ctx.translate(0, -runBob);

  ctx.shadowColor = '#a78bfa';
  ctx.shadowBlur = 18 + Math.sin(player.runFrame) * 8;

  const drawH = player.h * 1.15;
  const drawW = drawH * (205 / 224);
  if (foxImg.complete && foxImg.naturalWidth) {
    ctx.drawImage(foxImg, -drawW / 2, -drawH, drawW, drawH);
  } else {
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.ellipse(0, -player.h / 2, player.w / 2, player.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.ellipse(0, -player.h / 2, player.w / 3, player.h / 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  if (o.type === 'gap') {
    ctx.fillStyle = '#0c0d2c';
    ctx.fillRect(o.x, groundY, o.w, H - groundY);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(o.x, groundY, o.w, 4);
    ctx.setLineDash([]);
  } else if (o.low) {
    ctx.fillStyle = '#92400e';
    ctx.fillRect(o.x, o.y - o.h, o.w, o.h);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(o.x, o.y - o.h, o.w, 4);
    ctx.fillStyle = '#a16207';
    for (let lx = o.x + 8; lx < o.x + o.w - 6; lx += 14) {
      ctx.beginPath();
      ctx.arc(lx, o.y - o.h - 6, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const color = o.type === 'rock' ? '#6b7280' : o.type === 'log' ? '#78350f' : '#dc2626';
    ctx.fillStyle = color;
    if (o.type === 'rock') {
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y - o.h);
      ctx.lineTo(o.x + o.w, o.y);
      ctx.lineTo(o.x, o.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(o.x, o.y - o.h, o.w, o.h);
    }
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(o.x, o.y - 4, o.w, 4);
  }
  ctx.restore();
}

function drawDust(d) {
  ctx.save();
  ctx.translate(d.x, d.y + Math.sin(d.bob) * 4);
  ctx.shadowColor = '#fde68a';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(0, 0, d.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fef9c3';
  ctx.font = (12 * dpr) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', 0, 1);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBg();

  ctx.save();
  if (shake) shake.apply(ctx, dpr);

  obstacles.forEach(drawObstacle);
  dusts.forEach(drawDust);
  drawPlayer();
  drawForeground();

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

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

let touchStartY = 0;
C.addEventListener('pointerdown', e => {
  if (!running && !dead) { startGame(); return; }
  touchStartY = e.clientY;
  jump();
});
C.addEventListener('pointermove', e => {
  if (!running) return;
  if (e.clientY - touchStartY > 30) slide();
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (!running && !dead) startGame();
    else jump();
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); slide(); }
});

$('playBtn').onclick = startGame;
$('againBtn').onclick = startGame;
$('jumpBtn').onclick = jump;
$('slideBtn').onclick = slide;
$('soundBtn').onclick = function() {
  const on = localStorage.getItem('soundEnabled') !== 'false';
  localStorage.setItem('soundEnabled', on ? 'false' : 'true');
  if (audio) audio.setMasterVolume(on ? 0 : .5);
  $('soundBtn').textContent = on ? '🔇' : '🔊';
};

reset();
fit();
buildAmbient();
window.addEventListener('resize', function () { fit(); buildAmbient(); });
$('bestHud').textContent = best;
requestAnimationFrame(loop);
})();
