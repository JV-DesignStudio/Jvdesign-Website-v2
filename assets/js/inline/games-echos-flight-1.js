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
let echo, gates, bubbles, sparkles, trail, pops;
let score = 0, passed = 0, collected = 0;
let spawnX = 0, speed = 0, last = 0, trailTimer = 0, scroll = 0, shake = 0;
const MAX_HEARTS = 3;
let hearts = MAX_HEARTS, invuln = 0;
let echoBest = loadBest();
let dailyGoal = getDailyGoal();
let streakData = loadStreakData();

function loadBest(){
  try { return (JSON.parse(localStorage.getItem(KEY) || '{}').best) | 0; } catch(e){ return 0; }
}
function saveBest(v){
  try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); o.best = Math.max(v, o.best|0); localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){}
}
function getDayKey(){ return new Date().toISOString().slice(0, 10); }
function getDailyGoal(){
  const d = new Date();
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return 3 + (dayOfYear % 10);
}
function loadStreakData(){
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    const today = getDayKey();
    return { streak: o.streak | 0, lastDay: o.lastDay || '', doneToday: o.lastDay === today };
  } catch(e){ return { streak: 0, lastDay: '', doneToday: false }; }
}
function saveStreakData(streak, day){
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    o.streak = streak; o.lastDay = day;
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch(e){}
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
function refitPlayfield(){
  fit();
  if (!echo) return;
  // a rotate must never drop Echo through the seabed or leave the gates stranded
  echo.x = Math.max(echo.r + 24, Math.min(vw * 0.32, vw - 120));
  if (state === 'playing' || state === 'waiting'){
    for (const g of gates){
      if (g.top < 40 || g.top + g.gap > vh - 30){
        g.top = Math.max(46, Math.min(vh - g.gap - 46, g.top));
      }
    }
  }
  if (state === 'playing'){
    const ahead = gates.filter(g => g.x + 72 > echo.x).sort((a, b) => a.x - b.x)[0];
    if (ahead){
      const safeTop = ahead.top + echo.r + 6;
      const safeBot = ahead.top + ahead.gap - echo.r - 6;
      if (echo.y < safeTop || echo.y > safeBot){
        echo.y = (safeTop + safeBot) / 2;
        echo.vy = Math.min(echo.vy, 0);
      }
    }
  }
  echo.y = Math.max(echo.r + 2, Math.min(vh - echo.r - 4, echo.y));
}
window.addEventListener('resize', refitPlayfield);
window.addEventListener('orientationchange', refitPlayfield);

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
  hearts = MAX_HEARTS; invuln = 0;
  echo = { x: vw * 0.32, y: vh * 0.45, vy: 0, rot: 0, r: 20, bob: Math.random() * 6.28 };
  gates = [];
  bubbles = [];
  sparkles = [];
  trail = [];
  trailTimer = 0;
  pops = [];
  scroll = 0;
  shake = 0;
  speed = currentSpeed();
  spawnX = vw + 80;
  for (let i = 0; i < 4; i++) addGate(spawnX + i * spawnGap());
  updateHud();
}

function addGate(x){
  const gap = gapSize(passed);
  const margin = 46;
  const top = margin + Math.random() * Math.max(20, vh - gap - margin * 2);
  const g = { x: x, top: top, gap: gap, scored: false, variant: Math.floor(Math.random() * 3), ph: Math.random() * 6.28 };
  gates.push(g);
  // put a bubble in the gap about 65% of the time
  if (Math.random() < 0.65){
    bubbles.push({ x: x + 34, y: top + gap / 2 + (Math.random() - .5) * gap * .5, r: 11, got: false });
  }
}

function updateDailyHint(){
  const done = streakData.doneToday;
  const streakStr = done && streakData.streak >= 2 ? ' (' + streakData.streak + '-day streak)' : '';
  $('dailyHint').textContent = done
    ? '✅ Daily complete' + streakStr
    : '🎯 Today: beat ' + dailyGoal + ' gates';
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
  // parallax scroll, screen shake and score popups run in every state
  shake = Math.max(0, shake - dt * 34);
  if (state === 'playing') scroll += currentSpeed() * dt;
  else if (state !== 'menu') scroll += 26 * dt;
  for (const p of pops){ p.life -= dt; p.y -= 34 * dt; }
  pops = pops.filter(p => p.life > 0);

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
      shake = Math.max(shake, 4.5);
      pops.push({ x: echo.x + 8, y: echo.y - 26, text: '+1', life: .9 });
      if (audio) { try { audio.playSuccess(); } catch(e){} }
      sparkle(echo.x, echo.y);
    }
  }
  for (const b of bubbles){
    b.x -= sp * dt;
    if (!b.got && Math.hypot(b.x - echo.x, b.y - echo.y) < echo.r + b.r){
      b.got = true; collected++; score += 5;
      pops.push({ x: b.x, y: b.y, text: '+5', life: .9 });
      if (audio) { try { audio.playPop(); } catch(e){} }
      for (let i = 0; i < 6; i++) sparkle(b.x, b.y);
    }
  }

  // a soft bubble trail so Echo reads as swimming, not floating
  trailTimer -= dt;
  if (trailTimer <= 0){
    trailTimer = 0.055;
    // bubbles leave from the tail tip, which swings with Echo as she turns
    const cos = Math.cos(echo.rot), sin = Math.sin(echo.rot);
    const jitter = (Math.random() - .5) * 10;
    trail.push({
      x: echo.x - 72 * cos - jitter * sin,
      y: echo.y - 72 * sin + jitter * cos,
      r: 2 + Math.random() * 3.5,
      life: .85
    });
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

  // keep Echo under the surface before testing the coral
  if (echo.y - echo.r < 0) { echo.y = echo.r; echo.vy = 0; }

  // collisions - circle vs gate bars. A graze costs a heart and bounces Echo
  // back into the gap, so one touch does not end the whole swim.
  if (invuln > 0) invuln = Math.max(0, invuln - dt);
  const r = echo.r * 0.72;
  if (invuln <= 0){
    for (const g of gates){
      const withinX = echo.x + r > g.x && echo.x - r < g.x + 72;
      if (withinX && (echo.y - r < g.top || echo.y + r > g.top + g.gap)) { bump(g); break; }
    }
  }
  if (state !== 'playing') return;
  if (echo.y + echo.r > vh) return crash();

  updateHud();
}

function sparkle(x, y){
  sparkles.push({ x: x, y: y, vx: -20 - Math.random()*40, vy: -20 + Math.random()*40, life: .5, r: 2 + Math.random()*3 });
}

function bump(g){
  hearts--;
  updateHud();
  if (hearts <= 0) return crash();
  invuln = 1.15;
  // slide Echo back into the gap and give a soft upward bounce
  const mid = g.top + g.gap / 2;
  echo.y = Math.max(g.top + echo.r + 4, Math.min(g.top + g.gap - echo.r - 4, mid));
  echo.vy = -Math.max(240, vh * 0.34);
  echo.rot = -0.25;
  shake = Math.max(shake, 9);
  pops.push({ x: echo.x, y: echo.y - 32, text: 'Bonk!', life: .9 });
  for (let i = 0; i < 8; i++) sparkle(echo.x, echo.y);
  if (audio) { try { audio.playError(); } catch(e){} }
}

function crash(){
  state = 'over';
  if (audio) { try { audio.playError(); } catch(e){} }
  for (let i = 0; i < 12; i++) sparkle(echo.x, echo.y);
  if (score > echoBest){ echoBest = score; saveBest(echoBest); }
  try { if (sys) { sys.addScore && sys.addScore(score); sys.saveState && sys.saveState(); } } catch(e){}

  // daily challenge + streak
  if (passed >= dailyGoal && !streakData.doneToday) {
    const today = getDayKey();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = (streakData.lastDay === yesterday) ? streakData.streak + 1 : 1;
    streakData = { streak: newStreak, lastDay: today, doneToday: true };
    saveStreakData(newStreak, today);
  }
  const dailyDone = streakData.doneToday;
  const dailyMsg = dailyDone
    ? (streakData.streak >= 7 ? '🔥 ' + streakData.streak + '-day streak!' : streakData.streak >= 3 ? '🔥 ' + streakData.streak + '-day streak!' : '✅ Daily done!')
    : '🎯 Today: beat ' + dailyGoal + ' gates';

  $('endTitle').textContent = passed >= 10 ? 'Great swim!' : 'Nice try!';
  $('endStats').innerHTML = [['Score', score], ['Gates', passed], ['Bubbles', collected], ['Best', echoBest]]
    .map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  $('endLine').textContent = passed === 0
    ? 'Tap gently to swim up, then let Echo glide between taps.'
    : 'Echo reached ' + passed + ' gate' + (passed === 1 ? '' : 's') + '. Can you beat ' + echoBest + '?';
  $('dailyLine').textContent = dailyMsg;
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

  ctx.save();
  if (shake > 0.3) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);

  // lagoon background (oversized so the shake never reveals an edge)
  const bg = ctx.createLinearGradient(0, 0, 0, vh);
  bg.addColorStop(0, '#38bdf8');
  bg.addColorStop(0.55, '#0ea5e9');
  bg.addColorStop(1, '#075985');
  ctx.fillStyle = bg;
  ctx.fillRect(-8, -8, vw + 16, vh + 16);

  // vignette: sink the edges so Echo and the coral hold their shape
  const vg = ctx.createRadialGradient(vw * 0.45, vh * 0.4, Math.min(vw, vh) * 0.18, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.8);
  vg.addColorStop(0, 'rgba(3,26,40,0)');
  vg.addColorStop(0.6, 'rgba(3,26,40,.14)');
  vg.addColorStop(1, 'rgba(2,16,28,.6)');
  ctx.fillStyle = vg;
  ctx.fillRect(-8, -8, vw + 16, vh + 16);

  // parallax depth: distant reefs, then mid-ground rocks
  reefLayer(scroll * 0.12, vh * 0.60, 96, 'rgba(6,58,88,.45)');
  reefLayer(scroll * 0.30 + 90, vh * 0.78, 58, 'rgba(8,74,102,.4)');

  // depth haze: gates fade up out of the darker right edge as they arrive
  const haze = ctx.createLinearGradient(vw * 0.6, 0, vw + 8, 0);
  haze.addColorStop(0, 'rgba(2,18,30,0)');
  haze.addColorStop(1, 'rgba(2,18,30,.4)');
  ctx.fillStyle = haze;
  ctx.fillRect(vw * 0.6, 0, vw * 0.4 + 8, vh);

  // light rays
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#e0f2fe';
  for (let i = 0; i < 6; i++){
    const bx = ((i * 131 + t * 12) % (vw + 120)) - 60;
    ctx.beginPath();
    ctx.moveTo(bx, 0); ctx.lineTo(bx + 34, 0); ctx.lineTo(bx + 90, vh); ctx.lineTo(bx + 24, vh);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // drifting plankton specks and ambient bubbles
  ctx.fillStyle = 'rgba(224,242,254,.45)';
  for (let i = 0; i < 20; i++){
    const px = ((i * 61 + t * 13) % (vw + 30)) - 15;
    const py = ((i * 89 + t * 9) % (vh + 30)) - 15;
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < 13; i++){
    const bx = (i * 97 + t * 20) % (vw + 40) - 20;
    const by = (i * 151 + t * 26) % (vh + 40) - 20;
    ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 4) * 2, 0, 6.284); ctx.fill();
  }

  // seabed
  ctx.fillStyle = '#164e63';
  ctx.fillRect(0, vh - 26, vw, 26);

  // caustic light dancing on the sand
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#e0f2fe';
  for (let i = 0; i < 6; i++){
    const cx = ((i * 173 + t * 30) % (vw + 120)) - 60;
    const cy = vh - 38 - (i % 3) * 9;
    ctx.beginPath(); ctx.ellipse(cx, cy, 62 - (i % 3) * 12, 7, 0, 0, 6.284); ctx.fill();
  }
  ctx.restore();

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
  for (const g of gates) drawCoral(g, t);

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

  drawLives();

  if (echo) drawEcho(echo, t);

  // floating +score popups, drawn last so Echo never covers them
  ctx.textAlign = 'center';
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.lineJoin = 'round';
  // dark halo first, so the yellow score popup survives the bright water
  ctx.strokeStyle = 'rgba(3,22,34,.9)';
  ctx.lineWidth = 5;
  for (const p of pops){
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
    ctx.strokeText(p.text, p.x, p.y);
  }
  ctx.fillStyle = '#fef08a';
  for (const p of pops){
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.lineJoin = 'miter';
  ctx.textAlign = 'start';

  ctx.restore();
  requestAnimationFrame(draw);
}

// Rolling silhouette hills for the parallax reef layers
function reefLayer(offset, baseY, h, color){
  const period = 250;
  const o = ((offset % period) + period) % period;
  ctx.fillStyle = color;
  for (let i = -1; i <= Math.ceil(vw / period) + 1; i++){
    const x = i * period - o;
    const hh = h + ((i % 3 + 3) % 3) * 24;
    ctx.beginPath();
    ctx.moveTo(x - period * 0.6, baseY);
    ctx.quadraticCurveTo(x, baseY - hh, x + period * 0.6, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCoral(g, t){
  const w = 72, gapTop = g.top, gapBot = g.top + g.gap;
  const palettes = [
    ['#fb7185', '#fda4af'],
    ['#a78bfa', '#c4b5fd'],
    ['#fb923c', '#fdba74']
  ];
  const pal = palettes[g.variant || 0];
  const pulse = 1 + Math.sin((t || 0) * 3 + (g.ph || 0)) * 0.08;

  // dark rim first so the coral separates from the bright water
  ctx.strokeStyle = 'rgba(4,24,36,.8)';
  ctx.lineWidth = 6;
  if (roundRectPath(g.x, 0, w, gapTop, 10)) ctx.stroke();
  if (roundRectPath(g.x, gapBot, w, vh - gapBot, 10)) ctx.stroke();

  ctx.fillStyle = pal[0];
  roundRect(g.x, 0, w, gapTop, 10);
  roundRect(g.x, gapBot, w, vh - gapBot, 10);

  // nubs get a dark halo too, so the coral cap reads as a raised edge
  ctx.fillStyle = 'rgba(4,24,36,.7)';
  for (let y = 18; y < gapTop - 6; y += 46){ ctx.beginPath(); ctx.arc(g.x + 18 + (y % 3) * 16, y, 12 * pulse + 2.5, 0, 6.284); ctx.fill(); }
  for (let y = gapBot + 24; y < vh - 8; y += 46){ ctx.beginPath(); ctx.arc(g.x + 22 + (y % 3) * 14, y, 12 * pulse + 2.5, 0, 6.284); ctx.fill(); }
  ctx.fillStyle = pal[1];
  for (let y = 18; y < gapTop - 6; y += 46){ ctx.beginPath(); ctx.arc(g.x + 18 + (y % 3) * 16, y, 12 * pulse, 0, 6.284); ctx.fill(); }
  for (let y = gapBot + 24; y < vh - 8; y += 46){ ctx.beginPath(); ctx.arc(g.x + 22 + (y % 3) * 14, y, 12 * pulse, 0, 6.284); ctx.fill(); }
}

function roundRectPath(x, y, w, h, r){
  if (h <= 0) return false;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  return true;
}

function roundRect(x, y, w, h, r){
  if (roundRectPath(x, y, w, h, r)) ctx.fill();
}

function heartPath(){
  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.bezierCurveTo(-14, -1, -7, -13, 0, -5);
  ctx.bezierCurveTo(7, -13, 14, -1, 0, 9);
  ctx.closePath();
}

function drawLives(){
  const n = Math.max(0, hearts);
  for (let i = 0; i < MAX_HEARTS; i++){
    ctx.save();
    ctx.translate(20 + i * 26, 22);
    heartPath();
    if (i < n){
      ctx.fillStyle = '#fb7185';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEcho(e, t){
  const swim = state === 'playing';
  const phase = (t || 0) * (swim ? 12 : 5);
  const wag = Math.sin(phase) * (swim ? 6 : 2.5);

  // a soft ring says "still safe" without flickering her whole body
  if (invuln > 0 && swim){
    const pulse = 1 + Math.sin((t || 0) * 6) * 0.07;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.strokeStyle = 'rgba(186,230,253,' + (0.2 + Math.min(1, invuln) * 0.35).toFixed(3) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 42 * pulse, 0, 6.284); ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(Math.max(-0.6, Math.min(0.9, e.rot)));

  // dark silhouette a step larger, so the whole axolotl keeps an outline
  ctx.save();
  ctx.scale(1.09, 1.13);
  ctx.fillStyle = 'rgba(4,22,33,.85)';
  ctx.beginPath();
  ctx.moveTo(-24, -2);
  ctx.quadraticCurveTo(-48, -26 + wag, -70, -14 + wag);
  ctx.quadraticCurveTo(-80, -6 + wag, -70, 2 + wag);
  ctx.quadraticCurveTo(-58, 12 + wag, -70, 22 + wag);
  ctx.quadraticCurveTo(-46, 26 + wag, -24, 4);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-2, 2, 30, 21, 0, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.ellipse(17, -1, 25, 22, 0, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-16, 17, 7, 5, -0.2, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, 18, 7, 5, 0.15, 0, 6.284); ctx.fill();
  ctx.restore();

  // finned tail
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(-24, -2);
  ctx.quadraticCurveTo(-48, -26 + wag, -70, -14 + wag);
  ctx.quadraticCurveTo(-80, -6 + wag, -70, 2 + wag);
  ctx.quadraticCurveTo(-58, 12 + wag, -70, 22 + wag);
  ctx.quadraticCurveTo(-46, 26 + wag, -24, 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.quadraticCurveTo(-50, -12 + wag, -64, -6 + wag);
  ctx.quadraticCurveTo(-54, 2 + wag, -64, 12 + wag);
  ctx.quadraticCurveTo(-50, 12 + wag, -34, 3);
  ctx.closePath(); ctx.fill();

  // body and belly
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath(); ctx.ellipse(-2, 2, 30, 21, 0, 0, 6.284); ctx.fill();
  ctx.fillStyle = '#fbcfe8';
  ctx.beginPath(); ctx.ellipse(0, 9, 21, 11, 0, 0, 6.284); ctx.fill();

  // little arms / legs
  ctx.fillStyle = '#f472b6';
  ctx.beginPath(); ctx.ellipse(-16, 17, 7, 5, -0.2, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, 18, 7, 5, 0.15, 0, 6.284); ctx.fill();

  // feathery gills, three each side, fanning back from the head
  const gills = [
    [4, -16, -26, -40, -6],
    [12, -19, -6, -50, 2],
    [20, -19, 10, -48, 8],
    [6, 15, -22, 34, -6],
    [15, 17, -4, 40, 2],
    [23, 16, 10, 36, 8]
  ];
  ctx.lineCap = 'round';
  // dark under-stroke keeps the feathery gills readable over the lagoon
  ctx.strokeStyle = 'rgba(4,22,33,.75)';
  ctx.lineWidth = 9;
  for (let i = 0; i < gills.length; i++){
    const b = gills[i];
    const flutter = Math.sin(phase + i * 0.8) * (swim ? 2.2 : 1);
    const tx = b[2] + flutter, ty = b[3];
    const mx = (b[0] + tx) / 2 + b[4], my = (b[1] + ty) / 2;
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
  }
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 4;
  for (let i = 0; i < gills.length; i++){
    const b = gills[i];
    const flutter = Math.sin(phase + i * 0.8) * (swim ? 2.2 : 1);
    const tx = b[2] + flutter, ty = b[3];
    const mx = (b[0] + tx) / 2 + b[4], my = (b[1] + ty) / 2;
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
    ctx.fillStyle = '#fb7bb5';
    for (let k = 1; k <= 3; k++){
      const u = k / 3.6;
      const px = (1-u)*(1-u)*b[0] + 2*(1-u)*u*mx + u*u*tx;
      const py = (1-u)*(1-u)*b[1] + 2*(1-u)*u*my + u*u*ty;
      ctx.beginPath(); ctx.ellipse(px, py, 3.4, 6 - u * 2, b[4] < 0 ? -0.7 : 0.7, 0, 6.284); ctx.fill();
    }
  }
  ctx.lineCap = 'butt';

  // wide axolotl head
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath(); ctx.ellipse(17, -1, 25, 22, 0, 0, 6.284); ctx.fill();

  // rosy cheeks
  ctx.fillStyle = 'rgba(244,114,182,.55)';
  ctx.beginPath(); ctx.arc(8, 8, 5.5, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.arc(30, 8, 5.5, 0, 6.284); ctx.fill();

  // big shiny eyes
  ctx.fillStyle = '#1f2937';
  ctx.beginPath(); ctx.ellipse(9, -4, 5.5, 6.5, 0, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.ellipse(28, -4, 5.5, 6.5, 0, 0, 6.284); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(10.5, -6, 2, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.arc(29.5, -6, 2, 0, 6.284); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.arc(7.5, -1.5, 1.1, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.arc(26.5, -1.5, 1.1, 0, 6.284); ctx.fill();

  // friendly smile
  ctx.strokeStyle = '#9d174d';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(18, 3, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
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
    dailyGoal: function(){ return dailyGoal; },
    streak: function(){ return streakData; },
    state: function(){
      const ahead = gates.filter(function(g){ return g.x + 72 > echo.x; }).sort(function(a, b){ return a.x - b.x; })[0];
      return {
        phase: state,
        y: echo ? echo.y : 0,
        passed: passed,
        score: score,
        hearts: hearts,
        invuln: invuln,
        next: ahead ? { x: ahead.x, top: ahead.top, gap: ahead.gap, center: ahead.top + ahead.gap / 2 } : null
      };
    }
  };
}

// ---- boot --------------------------------------------------------------
echo = { x: 0, y: 0, vy: 0, rot: 0, bob: 0, r: 20 };
gates = []; bubbles = []; sparkles = []; trail = []; pops = [];
fit();
$('bestHud').textContent = echoBest;
updateDailyHint();
requestAnimationFrame(function frame(ts){
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;
  step(dt);
  requestAnimationFrame(frame);
});
requestAnimationFrame(draw);
})();
