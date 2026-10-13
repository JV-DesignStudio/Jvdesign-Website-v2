(function(){
'use strict';
const C = document.getElementById('game'), ctx = C.getContext('2d');
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
if (localStorage.getItem('soundEnabled') === 'false' && audio) audio.setMasterVolume(0);
const sys = window.GameSystem ? new GameSystem('echo-flight', "Echo's Swim", 'echo') : null;
const KEY = 'echo_swim_flappy_v1';

// ---- state -------------------------------------------------------------
let vw = 0, vh = 0, dpr = 1;
let state = 'menu';               // menu | waiting | playing | over
let echo, gates, bubbles, sparkles, trail;
let score = 0, passed = 0, collected = 0;
let spawnX = 0, speed = 0, last = 0, trailTimer = 0;
let echoBest = loadBest();

function loadBest(){
  try { return (JSON.parse(localStorage.getItem(KEY) || '{}').best) | 0; } catch(e){ return 0; }
}
function saveBest(v){
  try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); o.best = Math.max(v, o.best|0); localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){}
}

// ---- sizing / tuning ---------------------------------------------------
function fit(){
  const r = C.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = Math.max(1, Math.round(r.width));
  vh = Math.max(1, Math.round(r.height));
  if (C.width !== Math.round(vw*dpr) || C.height !== Math.round(vh*dpr)) {
    C.width = Math.round(vw*dpr);
    C.height = Math.round(vh*dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);

function gapSize(cleared){
  const base = Math.max(200, Math.min(262, vh * 0.36));
  return Math.max(172, base - Math.min(48, (cleared || 0) * 2.3));
}
function currentSpeed(){ return Math.min(286, 148 + passed * 1.9); }
function spawnGap(){ return Math.max(272, Math.min(400, vw * 0.7)); }

// ---- reset / start -----------------------------------------------------
function reset(){
  fit();
  score = 0; passed = 0; collected = 0;
  echo = { x: vw * 0.32, y: vh * 0.45, vy: 0, rot: 0, r: 20, bob: Math.random() * 6.28 };
  gates = [];
  bubbles = [];
  sparkles = [];
  trail = [];
  trailTimer = 0;
  speed = currentSpeed();
  spawnX = vw + 80;
  for (let i = 0; i < 4; i++) addGate(spawnX + i * spawnGap());
  updateHud();
}

function addGate(x){
  const gap = gapSize(passed);
  const margin = 46;
  const top = margin + Math.random() * Math.max(20, vh - gap - margin * 2);
  const g = { x: x, top: top, gap: gap, scored: false };
  gates.push(g);
  // put a bubble in the gap about 65% of the time
  if (Math.random() < 0.65){
    bubbles.push({ x: x + 34, y: top + gap / 2 + (Math.random() - .5) * gap * .5, r: 11, got: false });
  }
}

function beginSwim(){
  reset();
  state = 'waiting';
  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  $('hint').classList.add('show');
  echo.vy = 0;
  try { sys && sys.beginRun && sys.beginRun(); } catch(e){}
}

function flap(){
  if (state === 'menu') { beginSwim(); return; }
  if (state === 'over' ) return;
  if (state === 'waiting') { state = 'playing'; $('hint').classList.remove('show'); }
  if (state === 'playing'){
    echo.vy = -Math.max(368, vh * 0.52);
    echo.rot = -0.45;
    if (audio) { try { audio.playPop(); } catch(e){} }
    for (let i = 0; i < 4; i++) sparkle(echo.x - 14, echo.y + 14);
  }
}

// ---- update ------------------------------------------------------------
function step(dt){
  // ambient bubbles drift regardless of state
  if (state === 'waiting'){
    echo.bob += dt * 3;
    echo.y = vh * 0.45 + Math.sin(echo.bob) * 8;
    echo.rot = Math.sin(echo.bob) * 0.06;
  }

  if (state !== 'playing') return;

  const grav = 1400, maxFall = 620;
  echo.vy = Math.min(maxFall, echo.vy + grav * dt);
  echo.y += echo.vy * dt;
  const targetRot = Math.max(-0.5, Math.min(0.78, echo.vy / 860));
  echo.rot += (targetRot - echo.rot) * Math.min(1, dt * 10);

  const sp = currentSpeed();
  for (const g of gates){
    g.x -= sp * dt;
    if (!g.scored && g.x + 72 < echo.x){
      g.scored = true; passed++; score += 1;
      if (audio) { try { audio.playSuccess(); } catch(e){} }
      sparkle(echo.x, echo.y);
    }
  }
  for (const b of bubbles){
    b.x -= sp * dt;
    if (!b.got && Math.hypot(b.x - echo.x, b.y - echo.y) < echo.r + b.r){
      b.got = true; collected++; score += 5;
      if (audio) { try { audio.playPop(); } catch(e){} }
      for (let i = 0; i < 6; i++) sparkle(b.x, b.y);
    }
  }

  // a soft bubble trail so Echo reads as swimming, not floating
  trailTimer -= dt;
  if (trailTimer <= 0){
    trailTimer = 0.055;
    trail.push({ x: echo.x - 32, y: echo.y + (Math.random() - .5) * 12, r: 2 + Math.random() * 3.5, life: .85 });
  }
  for (const p of trail){ p.life -= dt; p.x -= sp * 0.45 * dt; p.y -= 14 * dt; }
  trail = trail.filter(p => p.life > 0);

  gates = gates.filter(g => g.x > -90);
  bubbles = bubbles.filter(b => b.x > -40 && !b.got);
  while (gates.length < 4){
    const lastX = gates.length ? gates[gates.length - 1].x : (vw + 80);
    addGate(lastX + spawnGap());
  }

  for (const p of sparkles){ p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  sparkles = sparkles.filter(p => p.life > 0);

  // collisions - circle vs gate bars, with a forgiving hitbox
  const r = echo.r * 0.72;
  for (const g of gates){
    const withinX = echo.x + r > g.x && echo.x - r < g.x + 72;
    if (withinX && (echo.y - r < g.top || echo.y + r > g.top + g.gap)) return crash();
  }
  if (echo.y - echo.r < 0) { echo.y = echo.r; echo.vy = 0; }
  if (echo.y + echo.r > vh) return crash();

  updateHud();
}

function sparkle(x, y){
  sparkles.push({ x: x, y: y, vx: -20 - Math.random()*40, vy: -20 + Math.random()*40, life: .5, r: 2 + Math.random()*3 });
}

function crash(){
  state = 'over';
  if (audio) { try { audio.playError(); } catch(e){} }
  for (let i = 0; i < 12; i++) sparkle(echo.x, echo.y);
  if (score > echoBest){ echoBest = score; saveBest(echoBest); }
  try { if (sys) { sys.addScore && sys.addScore(score); sys.saveState && sys.saveState(); } } catch(e){}
  $('endTitle').textContent = passed >= 10 ? 'Great swim!' : 'Nice try!';
  $('endStats').innerHTML = [['Score', score], ['Gates', passed], ['Bubbles', collected], ['Best', echoBest]]
    .map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  $('endLine').textContent = passed === 0
    ? 'Tap gently to swim up, then let Echo glide between taps.'
    : 'Echo reached ' + passed + ' gate' + (passed === 1 ? '' : 's') + '. Can you beat ' + echoBest + '?';
  $('endScreen').classList.remove('hidden');
  updateHud();
}

function updateHud(){
  $('scoreHud').textContent = score;
  $('gateHud').textContent = passed;
  $('bubbleHud').textContent = collected;
  $('bestHud').textContent = echoBest;
}

// ---- drawing -----------------------------------------------------------
function draw(){
  fit();
  const t = performance.now() / 1000;

  // lagoon background
  const bg = ctx.createLinearGradient(0, 0, 0, vh);
  bg.addColorStop(0, '#38bdf8');
  bg.addColorStop(0.55, '#0ea5e9');
  bg.addColorStop(1, '#075985');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, vw, vh);

  // light rays
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#e0f2fe';
  for (let i = 0; i < 5; i++){
    const bx = ((i * 137 + t * 12) % (vw + 120)) - 60;
    ctx.beginPath();
    ctx.moveTo(bx, 0); ctx.lineTo(bx + 34, 0); ctx.lineTo(bx + 90, vh); ctx.lineTo(bx + 24, vh);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // ambient bubbles
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 16; i++){
    const bx = (i * 97 + t * 20) % (vw + 40) - 20;
    const by = (i * 151 + t * 26) % (vh + 40) - 20;
    ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 4) * 2, 0, 6.284); ctx.fill();
  }

  // seabed
  ctx.fillStyle = '#164e63';
  ctx.fillRect(0, vh - 26, vw, 26);

  // swaying kelp to keep the lagoon alive
  ctx.strokeStyle = 'rgba(74,222,128,.30)';
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++){
    const kx = 30 + i * (vw - 60) / 4;
    const sway = Math.sin(t * 0.9 + i) * 12;
    const kh = 78 + (i % 3) * 34;
    ctx.beginPath();
    ctx.moveTo(kx, vh - 20);
    ctx.quadraticCurveTo(kx + sway * .5, vh - 20 - kh * .6, kx + sway, vh - 20 - kh);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // gates (coral)
  for (const g of gates) drawCoral(g);

  // bubbles to collect
  for (const b of bubbles){
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.284); ctx.fill();
    ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // swim trail
  for (const p of trail){
    ctx.globalAlpha = Math.max(0, p.life * 0.5);
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284); ctx.fill();
  }

  // sparkles
  for (const p of sparkles){
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (echo) drawEcho(echo, t);

  requestAnimationFrame(draw);
}

function drawCoral(g){
  const w = 72, gapTop = g.top, gapBot = g.top + g.gap;
  ctx.fillStyle = '#fb7185';
  roundRect(g.x, 0, w, gapTop, 10);
  roundRect(g.x, gapBot, w, vh - gapBot, 10);
  ctx.fillStyle = '#fda4af';
  for (let y = 18; y < gapTop - 6; y += 46){ ctx.beginPath(); ctx.arc(g.x + 18 + (y % 3) * 16, y, 12, 0, 6.284); ctx.fill(); }
  for (let y = gapBot + 24; y < vh - 8; y += 46){ ctx.beginPath(); ctx.arc(g.x + 22 + (y % 3) * 14, y, 12, 0, 6.284); ctx.fill(); }
}

function roundRect(x, y, w, h, r){
  if (h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath(); ctx.fill();
}

function drawEcho(e, t){
  const swim = state === 'playing';
  const phase = (t || 0) * (swim ? 13 : 5);
  const wag = Math.sin(phase) * (swim ? 7 : 3);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(Math.max(-0.6, Math.min(0.9, e.rot)));
  // tail
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(-38, 0); ctx.quadraticCurveTo(-64, -16 + wag, -74, wag); ctx.quadraticCurveTo(-64, 16 + wag, -38, 0);
  ctx.fill();
  // body
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath(); ctx.ellipse(0, 0, 40, 25, 0, 0, 6.284); ctx.fill();
  // gill frills flutter as Echo swims
  ctx.fillStyle = '#f472b6';
  const frills = [[-20,-22],[-6,-27],[10,-26],[24,-20],[-22,22],[-8,27],[8,26],[22,20]];
  for (let i = 0; i < frills.length; i++){
    const gx = frills[i][0], gy = frills[i][1];
    const flutter = Math.sin(phase + i * 0.9) * (swim ? 2.4 : 1);
    ctx.beginPath(); ctx.ellipse(gx, gy + flutter, 6, 13, 0, 0, 6.284); ctx.fill();
  }
  // belly
  ctx.fillStyle = '#fbcfe8';
  ctx.beginPath(); ctx.ellipse(4, 6, 26, 13, 0, 0, 6.284); ctx.fill();
  // cheek
  ctx.fillStyle = 'rgba(244,114,182,.7)';
  ctx.beginPath(); ctx.arc(16, 6, 5, 0, 6.284); ctx.fill();
  // eye
  ctx.fillStyle = '#111827';
  ctx.beginPath(); ctx.arc(18, -6, 4, 0, 6.284); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(19.5, -7.5, 1.4, 0, 6.284); ctx.fill();
  // smile
  ctx.strokeStyle = '#9d174d'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.arc(20, 4, 7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  ctx.restore();
}

// ---- input -------------------------------------------------------------
function pointerFlap(e){ if (e) e.preventDefault(); flap(); }
C.addEventListener('pointerdown', pointerFlap);
document.addEventListener('keydown', function(e){
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW'){
    e.preventDefault();
    if (state === 'over') { beginSwim(); } else { flap(); }
  }
});
$('startBtn').addEventListener('click', beginSwim);
$('againBtn').addEventListener('click', beginSwim);
$('soundBtn').addEventListener('click', function(){
  const on = localStorage.getItem('soundEnabled') !== 'false';
  localStorage.setItem('soundEnabled', on ? 'false' : 'true');
  if (audio) audio.setMasterVolume(on ? 0 : .5);
  $('soundBtn').textContent = on ? '🔇' : '🔊';
});

// Optional test hook, only when ?debug is in the URL, so the smoke test can
// prove a run is winnable without exposing globals in normal play.
if (location.search.indexOf('debug') !== -1){
  window.__echoSwim = {
    flap: flap,
    start: beginSwim,
    state: function(){
      const ahead = gates.filter(function(g){ return g.x + 72 > echo.x; }).sort(function(a, b){ return a.x - b.x; })[0];
      return {
        phase: state,
        y: echo ? echo.y : 0,
        passed: passed,
        score: score,
        next: ahead ? { x: ahead.x, top: ahead.top, gap: ahead.gap, center: ahead.top + ahead.gap / 2 } : null
      };
    }
  };
}

// ---- boot --------------------------------------------------------------
echo = { x: 0, y: 0, vy: 0, rot: 0, bob: 0, r: 20 };
gates = []; bubbles = []; sparkles = []; trail = [];
fit();
$('bestHud').textContent = echoBest;
requestAnimationFrame(function frame(ts){
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;
  step(dt);
  requestAnimationFrame(frame);
});
requestAnimationFrame(draw);
})();
