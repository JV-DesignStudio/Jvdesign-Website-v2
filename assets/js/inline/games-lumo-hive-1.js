(function () {
  const C = document.getElementById('game');
  const x = C.getContext('2d');
  const $ = id => document.getElementById(id);
  const sys = window.GameSystem ? new GameSystem('lumo-hive', "Lumo's Hive Strike", 'lumo') : null;
  const audio = window.AudioEffects ? new AudioEffects(0.4) : null;

  // Virtual canvas (portrait, scaled to fill)
  const W = 360, H = 620;

  function fit() {
    const r = C.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    C.width = Math.round(r.width * dpr);
    C.height = Math.round(r.height * dpr);
    x.setTransform(C.width / W, 0, 0, C.height / H, 0, 0);
  }
  addEventListener('resize', fit);
  setTimeout(fit, 50);

  function sfx(n) { try { audio?.[n]?.(); } catch (e) { } }

  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 1200);
  }

  // ── STATE ─────────────────────────────────────────────────────────────────
  let gameState = 'idle'; // idle | playing | waveclear | dead
  let score = 0, wave = 1, lives = 3, combo = 1, comboTimer = 0;
  let shootCool = 0, waveClearT = 0;
  let rapidT = 0, multiT = 0;
  let won = false, wavePerfect = true, goldFlash = 0, shakeUntil = 0;
  let best = parseInt(localStorage.getItem('jvds_lhs_best') || '0');

  const lumo = { x: W / 2, y: H - 55, invT: 0, flash: 0 };
  let bullets = []; // {x,y,vy,owner,c}
  let enemies = [];
  let particles = [];
  let powerups = [];
  let boss = null;

  // Formation geometry
  const ROWS = 5, COLS = 8;
  const FX0 = 24, FY0 = 70, FDX = 38, FDY = 40;
  let formX = 0, formVx = 28;

  // Dive timing
  let diveTimer = 0, nextDive = 2.8;

  // ── ENEMY TYPES ────────────────────────────────────────────────────────────
  function typeHP(t) { return { drone: 1, guard: 2, queen: 3 }[t]; }
  function typeScore(t) { return { drone: 10, guard: 25, queen: 50 }[t]; }
  function typeColor(t) { return { drone: '#fbbf24', guard: '#f97316', queen: '#7c3aed' }[t]; }
  function rowType(row) { return row === 0 ? 'queen' : row === 1 ? 'guard' : 'drone'; }

  function formPos(row, col) {
    const hex = (row % 2) * 0.5;
    return { fx: FX0 + (col + hex) * FDX, fy: FY0 + row * FDY };
  }

  // ── BUILD FORMATION ────────────────────────────────────────────────────────
  function buildFormation() {
    enemies = [];
    formX = 0;
    formVx = Math.min(60, 28 + wave * 2.5);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = rowType(r);
        const hp = typeHP(type);
        const { fx, fy } = formPos(r, c);
        enemies.push({
          row: r, col: c, type, hp, maxHp: hp,
          x: fx, y: fy - 350,
          fx, fy,
          state: 'enter',
          enterDelay: (r * COLS + c) * 0.038,
          divePath: null, angle: 0, shootCool: 0
        });
      }
    }
  }

  // ── BOSS ──────────────────────────────────────────────────────────────────
  function spawnBoss() {
    const maxHp = 10 + wave * 2;
    boss = { x: W / 2, y: 80, vx: 55 + wave * 3, hp: maxHp, maxHp, invT: 0, shootCool: 0 };
    enemies = [];
  }

  // ── START / END ────────────────────────────────────────────────────────────
  function startGame() {
    score = 0; wave = 1; lives = 3; combo = 1; comboTimer = 0;
    shootCool = 0; rapidT = 0; multiT = 0;
    won = false; wavePerfect = true; goldFlash = 0; shakeUntil = 0;
    bullets = []; particles = []; powerups = [];
    lumo.x = W / 2; lumo.invT = 0; lumo.flash = 0;
    boss = null;
    buildFormation();
    diveTimer = 0; nextDive = 2.8;
    gameState = 'playing';
    $('startScreen').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    $('againBtn').textContent = 'Try Again';
    sys?.beginRun?.();
    hud();
  }

  function endGame(victory) {
    gameState = 'dead';
    if (score > best) { best = score; localStorage.setItem('jvds_lhs_best', best); }
    hud();
    checkDailyOnEnd(score);
    if (victory) {
      $('endTitle').textContent = 'You protected the Logic Garden!';
      $('endStats').innerHTML =
        `<div><b>${score}</b><small>Score</small></div>` +
        `<div><b>${best}</b><small>Best</small></div>` +
        `<div><b>W${wave}</b><small>Wave</small></div>`;
      $('againBtn').textContent = 'Play Again';
    } else {
      const stars = score > 3000 ? '★★★' : score > 1200 ? '★★☆' : score > 400 ? '★☆☆' : '☆☆☆';
      $('endTitle').textContent = 'Hive Wins!';
      $('endStats').innerHTML =
        `<div><b>${score}</b><small>Score</small></div>` +
        `<div><b>W${wave}</b><small>Wave</small></div>` +
        `<div><b>${stars}</b><small>Rating</small></div>`;
      $('againBtn').textContent = 'Try Again';
    }
    $('endScreen').classList.remove('hidden');
    sys?.addScore?.(score);
    sys?.saveState?.();
  }

  function hud() {
    $('scoreHud').textContent = score;
    $('waveHud').textContent = wave;
    $('comboHud').textContent = 'x' + combo;
    $('livesHud').textContent = '🛡️'.repeat(Math.max(0, lives)) || '💀';
    $('bestHud').textContent = best;
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────
  const keys = {};
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); tryShoot(); }
    if ((e.code === 'Enter' || e.code === 'Space') && gameState === 'idle') startGame();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });

  // Touch: drag to slide Lumo left/right; tap = shoot
  let pointerX = null;
  C.addEventListener('pointerdown', e => {
    pointerX = e.clientX;
    tryShoot();
  });
  C.addEventListener('pointermove', e => {
    if (e.buttons && pointerX !== null) {
      const canvasW = C.getBoundingClientRect().width;
      const dx = (e.clientX - pointerX) / canvasW * W;
      lumo.x = Math.max(16, Math.min(W - 16, lumo.x + dx));
      pointerX = e.clientX;
    }
  });
  C.addEventListener('pointerup', () => { pointerX = null; });

  // On-screen buttons
  const leftHeld = { v: false }, rightHeld = { v: false };
  function bindBtn(id, obj) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('pointerdown', e => { e.preventDefault(); obj.v = true; });
    el.addEventListener('pointerup', () => { obj.v = false; });
    el.addEventListener('pointercancel', () => { obj.v = false; });
  }
  bindBtn('ctrlLeft', leftHeld);
  bindBtn('ctrlRight', rightHeld);
  const ctrlShoot = $('ctrlShoot');
  if (ctrlShoot) ctrlShoot.addEventListener('pointerdown', e => { e.preventDefault(); tryShoot(); });

  function tryShoot() {
    if (gameState !== 'playing' || shootCool > 0) return;
    shootCool = rapidT > 0 ? 0.11 : 0.26;
    lumo.flash = 0.18;
    const vy = -530;
    if (multiT > 0) {
      bullets.push({ x: lumo.x - 11, y: lumo.y - 22, vy, owner: 'player', c: '#c084fc' });
      bullets.push({ x: lumo.x, y: lumo.y - 26, vy, owner: 'player', c: '#e879f9' });
      bullets.push({ x: lumo.x + 11, y: lumo.y - 22, vy, owner: 'player', c: '#c084fc' });
    } else {
      bullets.push({ x: lumo.x, y: lumo.y - 26, vy, owner: 'player', c: '#e879f9' });
    }
    sfx('playTap');
  }

  // ── DIVE AI ────────────────────────────────────────────────────────────────
  function makeDivePath(e) {
    const p0 = { x: e.fx + formX, y: e.fy };
    const p1 = { x: p0.x + (Math.random() - 0.5) * 130, y: p0.y + 110 };
    const p2 = { x: lumo.x + (Math.random() - 0.5) * 90, y: H - 90 };
    const p3 = { x: lumo.x + (Math.random() - 0.5) * 25, y: H + 60 };
    return { p0, p1, p2, p3, t: 0, spd: 0.42 + wave * 0.018 + Math.random() * 0.18 };
  }

  function bezier(path, t) {
    const { p0, p1, p2, p3 } = path;
    const mt = 1 - t;
    return {
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    };
  }

  function triggerDive() {
    const pool = enemies.filter(e => e.state === 'form');
    if (!pool.length) return;
    const lower = pool.filter(e => e.row >= 2);
    const e = (lower.length ? lower : pool)[Math.floor(Math.random() * (lower.length || pool.length))];
    e.state = 'dive';
    e.divePath = makeDivePath(e);
    e.shootCool = 0.3 + Math.random() * 0.4;
  }

  // ── PARTICLES ──────────────────────────────────────────────────────────────
  function burst(px, py, c1, c2, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * 130;
      particles.push({ x: px, y: py, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, a: 1, c: Math.random() < 0.5 ? c1 : c2, r: 2 + Math.random() * 3 });
    }
  }

  function hexBurst(px, py, c, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 150;
      particles.push({
        x: px, y: py, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        a: 1, decay: 2.5, c, r: 2.5 + Math.random() * 2.5,
        shape: 'hex', rot: Math.random() * Math.PI
      });
    }
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────
  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (gameState === 'playing' || gameState === 'waveclear') update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    // Player movement
    const spd = 220;
    if (keys['ArrowLeft'] || keys['KeyA'] || leftHeld.v) lumo.x -= spd * dt;
    if (keys['ArrowRight'] || keys['KeyD'] || rightHeld.v) lumo.x += spd * dt;
    lumo.x = Math.max(16, Math.min(W - 16, lumo.x));

    shootCool -= dt;
    if (lumo.invT > 0) lumo.invT -= dt;
    if (lumo.flash > 0) lumo.flash -= dt;
    if (rapidT > 0) rapidT -= dt;
    if (multiT > 0) multiT -= dt;
    if (goldFlash > 0) goldFlash = Math.max(0, goldFlash - dt * 1.6);

    // Combo decay
    if (combo > 1) {
      comboTimer -= dt;
      if (comboTimer <= 0) { combo = 1; hud(); }
    }

    // Wave clear countdown
    if (gameState === 'waveclear') {
      waveClearT -= dt;
      if (waveClearT <= 0) nextWave();
      return;
    }

    // ── Formation drift ────────────────────────────────────────────────────
    const allInPlace = !enemies.some(e => e.state === 'enter');
    if (allInPlace) {
      formX += formVx * dt;
      const maxDrift = W - (FX0 + COLS * FDX + 20) - FX0;
      if (formX > maxDrift || formX < 0) { formVx *= -1; formX = Math.max(0, Math.min(maxDrift, formX)); }

      diveTimer += dt;
      if (diveTimer >= nextDive) {
        diveTimer = 0;
        nextDive = 1.6 + Math.random() * 2.0;
        triggerDive();
        if (wave >= 3 && Math.random() < 0.4) triggerDive();
      }
    }

    // ── Enemy updates ───────────────────────────────────────────────────────
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (e.state === 'enter') {
        e.enterDelay -= dt;
        if (e.enterDelay <= 0) {
          const tx = e.fx, ty = e.fy; // formX=0 during entry
          const dist = Math.hypot(tx - e.x, ty - e.y);
          if (dist < 3) { e.x = tx; e.y = ty; e.state = 'form'; }
          else {
            const move = Math.min(240 * dt, dist);
            e.x += (tx - e.x) / dist * move;
            e.y += (ty - e.y) / dist * move;
          }
        }
      } else if (e.state === 'form') {
        e.x = e.fx + formX;
        e.y = e.fy;
      } else if (e.state === 'dive') {
        const p = e.divePath;
        p.t += p.spd * dt;
        const pos = bezier(p, Math.min(1, p.t));
        e.angle = Math.atan2(pos.y - e.y, pos.x - e.x);
        e.x = pos.x; e.y = pos.y;

        // Shoot during dive
        e.shootCool -= dt;
        if (e.shootCool <= 0 && e.y < H - 50) {
          bullets.push({ x: e.x, y: e.y + 10, vy: 250 + wave * 12, owner: 'enemy', c: '#fbbf24' });
          e.shootCool = 0.55;
        }

        if (p.t >= 1) {
          // Return to formation from top
          e.state = 'return';
          e.x = e.fx + formX; e.y = e.fy - 100;
        }
      } else if (e.state === 'return') {
        const tx = e.fx + formX, ty = e.fy;
        const dist = Math.hypot(tx - e.x, ty - e.y);
        if (dist < 4) { e.x = tx; e.y = ty; e.state = 'form'; }
        else { const m = Math.min(260 * dt, dist); e.x += (tx - e.x) / dist * m; e.y += (ty - e.y) / dist * m; }
      }
    }

    // ── Boss update ─────────────────────────────────────────────────────────
    if (boss) {
      if (boss.invT > 0) boss.invT -= dt;
      boss.x += boss.vx * dt;
      if (boss.x < 45 || boss.x > W - 45) boss.vx *= -1;

      boss.shootCool -= dt;
      const rate = boss.hp < boss.maxHp * 0.5 ? 0.5 : 0.85;
      if (boss.shootCool <= 0) {
        boss.shootCool = rate;
        const spread = boss.hp < boss.maxHp * 0.5 ? [-18, 0, 18] : [0];
        spread.forEach(ox => {
          bullets.push({ x: boss.x + ox, y: boss.y + 38, vy: 270 + wave * 10, owner: 'enemy', c: '#f97316' });
        });
      }

      // Boss body collision
      if (lumo.invT <= 0 && Math.hypot(boss.x - lumo.x, boss.y - lumo.y) < 38) hitPlayer();
    }

    // ── Bullet updates ──────────────────────────────────────────────────────
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy * dt;
      if (b.y < -12 || b.y > H + 12) { bullets.splice(i, 1); continue; }

      if (b.owner === 'player') {
        // Hit boss
        if (boss && boss.invT <= 0 && Math.hypot(b.x - boss.x, b.y - boss.y) < 34) {
          bullets.splice(i, 1);
          boss.hp--;
          boss.invT = 0.1;
          burst(boss.x, boss.y, '#f97316', '#fef08a', 6);
          sfx('playPop');
          addScore(30);
          if (boss.hp <= 0) {
            const bx = boss.x, by = boss.y;
            burst(bx, by, '#a855f7', '#fef08a', 40);
            hexBurst(bx, by, '#a855f7', 16);
            sfx('playSuccess');
            addScore(600);
            boss = null;
            if (wave >= 10) {
              winGame();
            } else {
              showToast('Queen defeated! +600');
              beginWaveClear();
            }
          }
          continue;
        }

        // Hit enemy
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (e.state === 'enter' && e.enterDelay > 0) continue;
          const r = e.type === 'queen' ? 14 : e.type === 'guard' ? 12 : 10;
          if (Math.hypot(b.x - e.x, b.y - e.y) < r + 5) {
            bullets.splice(i, 1);
            e.hp--;
            burst(e.x, e.y, typeColor(e.type), '#fef08a', 7);
            sfx('playPop');
            if (e.hp <= 0) {
              addScore(typeScore(e.type) * combo);
              bumpCombo();
              hexBurst(e.x, e.y, typeColor(e.type), 6 + Math.floor(Math.random() * 3));
              if (Math.random() < 0.15) dropPowerup(e.x, e.y);
              enemies.splice(j, 1);
            }
            hit = true;
            break;
          }
        }
        if (hit) continue;

      } else {
        // Enemy bullet hits player
        if (lumo.invT <= 0 && Math.hypot(b.x - lumo.x, b.y - lumo.y) < 16) {
          bullets.splice(i, 1);
          hitPlayer();
        }
      }
    }

    // ── Diver body vs player ────────────────────────────────────────────────
    if (lumo.invT <= 0) {
      for (const e of enemies) {
        if (e.state === 'dive' && Math.hypot(e.x - lumo.x, e.y - lumo.y) < 20) {
          hitPlayer(); break;
        }
      }
    }

    // ── Power-up collection ─────────────────────────────────────────────────
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += 75 * dt;
      if (p.y > H + 20) { powerups.splice(i, 1); continue; }
      if (Math.hypot(p.x - lumo.x, p.y - lumo.y) < 22) {
        applyPowerup(p.type);
        powerups.splice(i, 1);
      }
    }

    // ── Particles ───────────────────────────────────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 70 * dt;
      if (p.shape === 'hex') p.rot += dt * 5;
      p.a -= dt * (p.decay || 1.9);
      if (p.a <= 0) particles.splice(i, 1);
    }

    // ── Wave clear check ────────────────────────────────────────────────────
    if (!won && !boss && enemies.length === 0 && gameState === 'playing') beginWaveClear();
  }

  function hitPlayer() {
    lives--;
    wavePerfect = false;
    shakeUntil = performance.now() + 300;
    lumo.invT = 2.2;
    burst(lumo.x, lumo.y, '#c084fc', '#ffffff', 18);
    sfx('playError');
    hud();
    if (lives <= 0) { gameState = 'dead'; setTimeout(endGame, 700); }
    else showToast('Shield hit! ' + '🛡️'.repeat(lives));
  }

  function addScore(pts) { score += Math.round(pts); hud(); }

  function bumpCombo() { combo = Math.min(8, combo + 1); comboTimer = 2.2; hud(); }

  function dropPowerup(px, py) {
    const types = ['rapid', 'shield', 'multi'];
    powerups.push({ x: px, y: py, type: types[Math.floor(Math.random() * 3)] });
  }

  function applyPowerup(type) {
    sfx('playSuccess');
    if (type === 'rapid') { rapidT = 7; showToast('⚡ Rapid fire!'); }
    else if (type === 'shield') { lives = Math.min(3, lives + 1); hud(); showToast('🛡️ Shield restored!'); }
    else if (type === 'multi') { multiT = 8; showToast('✨ Multi-shot!'); }
  }

  function beginWaveClear() {
    gameState = 'waveclear';
    waveClearT = 1.6;
    addScore(100 * wave);
    if (wavePerfect) {
      goldFlash = 1;
      showToast('Wave Clear! ✨');
    } else {
      showToast('Wave ' + wave + ' cleared! ✨');
    }
    sfx('playSuccess');
  }

  function nextWave() {
    wave++;
    wavePerfect = true;
    bullets = bullets.filter(b => b.owner === 'player');
    powerups = [];
    boss = null;
    if (wave % 5 === 0) {
      spawnBoss();
      showToast(wave >= 10 ? 'Final wave! Defeat the Queen' : '👑 Queen Boss!');
    } else {
      buildFormation();
      diveTimer = 0; nextDive = 2.2;
      showToast('Wave ' + wave);
    }
    gameState = 'playing';
    hud();
  }

  function winGame() {
    won = true;
    lumo.invT = 2.2;
    setTimeout(() => { bullets = bullets.filter(b => b.owner === 'player'); }, 0);
    showToast('You protected the Logic Garden!');
    sfx('playSuccess');
    setTimeout(() => { if (gameState !== 'dead') endGame(true); }, 1400);
  }

  // ── DRAW ────────────────────────────────────────────────────────────────────
  const STARS = Array.from({ length: 40 }, () => ({
    sx: Math.random() * W, sy: Math.random() * H,
    r: Math.random() * 1.2 + 0.4, a: 0.3 + Math.random() * 0.5
  }));

  function hexPath(cx, cy, r) {
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath();
  }

  function draw() {
    const now = performance.now();
    let sx = 0, sy = 0;
    if (now < shakeUntil) {
      const m = 6 * ((shakeUntil - now) / 300);
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
    }

    x.clearRect(-12, -12, W + 24, H + 24);
    x.save();
    x.translate(sx, sy);

    // Deep space gradient
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0f0c29');
    sky.addColorStop(1, '#1a1a2e');
    x.fillStyle = sky;
    x.fillRect(-12, -12, W + 24, H + 24);

    // Stars (static)
    x.fillStyle = '#ffffff';
    for (const s of STARS) {
      x.globalAlpha = s.a;
      x.beginPath(); x.arc(s.sx, s.sy, s.r, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;

    // Logic Garden floor
    drawGardenFloor();

    // Power-ups
    for (const p of powerups) {
      x.font = '18px system-ui';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText({ rapid: '⚡', shield: '🛡️', multi: '✨' }[p.type] || '?', p.x, p.y);
    }
    x.textBaseline = 'alphabetic';

    // Enemies
    for (const e of enemies) {
      if (e.state === 'enter' && e.enterDelay > 0) continue;
      drawBee(e);
    }

    // Boss
    if (boss) drawBoss();

    // Bullets
    for (const b of bullets) {
      if (b.owner === 'player') {
        x.strokeStyle = 'rgba(192,132,252,0.5)';
        x.lineWidth = 2.5;
        x.lineCap = 'round';
        x.beginPath(); x.moveTo(b.x, b.y + 10); x.lineTo(b.x, b.y); x.stroke();
        const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, 6);
        g.addColorStop(0, '#f5d0fe');
        g.addColorStop(0.45, '#c084fc');
        g.addColorStop(1, 'rgba(192,132,252,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(b.x, b.y, 6, 0, Math.PI * 2); x.fill();
      } else {
        x.beginPath(); x.arc(b.x, b.y, 5, 0, Math.PI * 2);
        x.fillStyle = b.c;
        x.shadowColor = b.c; x.shadowBlur = 8;
        x.fill(); x.shadowBlur = 0;
      }
    }

    // Particles
    for (const p of particles) {
      x.globalAlpha = Math.max(0, p.a);
      x.fillStyle = p.c;
      if (p.shape === 'hex') {
        x.save();
        x.translate(p.x, p.y);
        x.rotate(p.rot || 0);
        hexPath(0, 0, p.r);
        x.fill();
        x.restore();
      } else {
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, Math.PI * 2); x.fill();
      }
    }
    x.globalAlpha = 1;

    // Lumo (blink when invincible)
    if (gameState !== 'dead' && (lumo.invT <= 0 || Math.floor(lumo.invT * 8) % 2 === 0)) {
      drawLumo();
    }

    // Perfect wave gold flash
    if (goldFlash > 0) {
      const gf = x.createLinearGradient(0, 0, 0, 110);
      gf.addColorStop(0, 'rgba(250,204,21,' + (0.55 * goldFlash).toFixed(3) + ')');
      gf.addColorStop(1, 'rgba(250,204,21,0)');
      x.fillStyle = gf;
      x.fillRect(0, 0, W, 110);
    }

    // Wave-clear flash
    if (gameState === 'waveclear') {
      x.fillStyle = 'rgba(124,58,237,0.12)';
      x.fillRect(0, 0, W, H);
      x.fillStyle = '#e879f9';
      x.font = 'bold 26px system-ui';
      x.textAlign = 'center';
      x.fillText('Wave Cleared! ✨', W / 2, H / 2 - 12);
      x.font = '17px system-ui';
      x.fillStyle = '#c084fc';
      x.fillText('Score: ' + score, W / 2, H / 2 + 18);
    }

    // Power-up status strip
    if (rapidT > 0 || multiT > 0) {
      x.font = '12px system-ui';
      x.textAlign = 'left';
      x.fillStyle = '#e879f9';
      let px2 = 8;
      if (rapidT > 0) { x.fillText('⚡ ' + rapidT.toFixed(1) + 's', px2, H - 8); px2 += 65; }
      if (multiT > 0) { x.fillText('✨ ' + multiT.toFixed(1) + 's', px2, H - 8); }
    }

    x.restore();
  }

  function drawGardenFloor() {
    const top = H * 0.75;
    const r = 20, hw = Math.sqrt(3) * r, vh = 1.5 * r;
    x.strokeStyle = 'rgba(124,58,237,0.12)';
    x.lineWidth = 0.8;
    let row = 0;
    for (let cy = top; cy < H + r; cy += vh, row++) {
      const off = (row % 2) ? hw / 2 : 0;
      for (let cx = off; cx < W + hw; cx += hw) {
        hexPath(cx, cy, r);
        x.stroke();
      }
    }
  }

  function drawBee(e) {
    x.save();
    x.translate(e.x, e.y);
    if (e.state === 'dive') x.rotate(e.angle + Math.PI / 2);

    const r = e.type === 'queen' ? 14 : e.type === 'guard' ? 12 : 9;
    const c = typeColor(e.type);
    const t = performance.now() * 0.003;
    const flap = Math.sin(t * 9 + e.col * 0.7) * 0.25;

    // Wings behind the body
    const wingA = e.type === 'queen' ? 0.2 : 0.32;
    x.fillStyle = 'rgba(255,255,255,' + wingA + ')';
    x.beginPath(); x.ellipse(-r * 0.85, -r * 0.1, r * 0.75 + flap * r * 0.4, r * 0.38, -0.5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(r * 0.85, -r * 0.1, r * 0.75 + flap * r * 0.4, r * 0.38, 0.5, 0, Math.PI * 2); x.fill();

    // Antennae (drones)
    if (e.type === 'drone') {
      x.strokeStyle = '#fde68a';
      x.lineWidth = 1.4;
      x.lineCap = 'round';
      x.beginPath(); x.moveTo(-r * 0.35, -r * 0.8); x.quadraticCurveTo(-r * 0.7, -r * 1.5, -r * 0.4, -r * 1.7); x.stroke();
      x.beginPath(); x.moveTo(r * 0.35, -r * 0.8); x.quadraticCurveTo(r * 0.7, -r * 1.5, r * 0.4, -r * 1.7); x.stroke();
    }

    // Hex body
    if (e.type === 'queen') { x.shadowColor = c; x.shadowBlur = 14; }
    x.fillStyle = c;
    hexPath(0, 0, r);
    x.fill();
    x.shadowBlur = 0;

    // Glowing outline for the queen
    if (e.type === 'queen') {
      x.strokeStyle = 'rgba(216,180,254,0.9)';
      x.lineWidth = 1.5;
      hexPath(0, 0, r);
      x.stroke();
    }

    // Stripes
    x.strokeStyle = 'rgba(0,0,0,0.25)';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(-r * 0.62, -r * 0.22); x.lineTo(r * 0.62, -r * 0.22); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.62, r * 0.22); x.lineTo(r * 0.62, r * 0.22); x.stroke();

    // Eyes
    x.fillStyle = '#1e0a2e';
    x.beginPath(); x.arc(-r * 0.3, -r * 0.45, r * 0.13, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(r * 0.3, -r * 0.45, r * 0.13, 0, Math.PI * 2); x.fill();

    // Guard stinger
    if (e.type === 'guard') {
      x.fillStyle = '#7c2d12';
      x.beginPath(); x.moveTo(-r * 0.18, r * 0.9); x.lineTo(0, r * 1.5); x.lineTo(r * 0.18, r * 0.9); x.closePath(); x.fill();
    }

    // Queen crown (3 triangles)
    if (e.type === 'queen') {
      x.fillStyle = '#fef08a';
      for (const ox of [-r * 0.55, 0, r * 0.55]) {
        x.beginPath(); x.moveTo(ox - 4, -r * 0.9); x.lineTo(ox, -r * 1.5); x.lineTo(ox + 4, -r * 0.9); x.closePath(); x.fill();
      }
      x.fillRect(-r * 0.75, -r * 0.98, r * 1.5, 2.5);
    }

    // HP pips (guards/queens with >1 hp)
    if (e.maxHp > 1) {
      for (let i = 0; i < e.maxHp; i++) {
        x.fillStyle = i < e.hp ? '#ffffff' : 'rgba(255,255,255,0.18)';
        x.beginPath(); x.arc(-3 + i * 5, r + 4, 2, 0, Math.PI * 2); x.fill();
      }
    }

    x.restore();
  }

  function drawBoss() {
    const b = boss;
    x.save(); x.translate(b.x, b.y);

    const pulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.3;

    // Wings
    x.fillStyle = 'rgba(196,132,252,0.35)';
    x.beginPath(); x.ellipse(-36, -6, 28, 16, -0.4, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(36, -6, 28, 16, 0.4, 0, Math.PI * 2); x.fill();

    // Body glow
    x.shadowColor = '#a855f7';
    x.shadowBlur = 22 * pulse;
    x.fillStyle = b.invT > 0 ? '#ffffff' : '#7c3aed';
    hexPath(0, 0, 34);
    x.fill();
    x.shadowBlur = 0;

    // Glowing outline
    x.strokeStyle = 'rgba(216,180,254,0.9)';
    x.lineWidth = 2.5;
    hexPath(0, 0, 34);
    x.stroke();

    // Stripes
    x.strokeStyle = 'rgba(0,0,0,0.25)';
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(-26, -8); x.lineTo(26, -8); x.stroke();
    x.beginPath(); x.moveTo(-26, 8); x.lineTo(26, 8); x.stroke();

    // Eyes
    x.fillStyle = '#fef08a';
    x.beginPath(); x.arc(-11, -8, 5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(11, -8, 5, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1e0a2e';
    x.beginPath(); x.arc(-11, -8, 2, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(11, -8, 2, 0, Math.PI * 2); x.fill();

    // Crown (3 triangles)
    x.fillStyle = '#fef08a';
    for (const ox of [-18, 0, 18]) {
      x.beginPath(); x.moveTo(ox - 7, -32); x.lineTo(ox, -46); x.lineTo(ox + 7, -32); x.closePath(); x.fill();
    }
    x.fillRect(-26, -34, 52, 4);

    x.restore();

    // HP bar
    const bw = 110, bh = 7;
    const bx = b.x - bw / 2, by2 = b.y + 46;
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(bx - 1, by2 - 1, bw + 2, bh + 2);
    const hpPct = b.hp / b.maxHp;
    const barCol = hpPct > 0.5 ? '#a855f7' : '#ef4444';
    x.fillStyle = barCol; x.fillRect(bx, by2, bw * hpPct, bh);
    x.font = '10px system-ui'; x.textAlign = 'center'; x.fillStyle = '#fef08a';
    x.fillText('QUEEN  ' + b.hp + '/' + b.maxHp, b.x, by2 + bh + 10);
  }

  function drawLumo() {
    const t = performance.now() * 0.001;
    const shot = lumo.flash > 0 ? 1 : 0;
    const glow = 0.35 + Math.sin(t * 6) * 0.15 + shot * 0.5;
    x.save(); x.translate(lumo.x, lumo.y);

    // Bushy tail behind the body
    x.strokeStyle = '#a855f7';
    x.lineWidth = 5;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(7, 5);
    x.quadraticCurveTo(24, 8, 21, -7);
    x.stroke();
    x.fillStyle = '#a855f7';
    x.beginPath(); x.arc(21, -7, 6, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#c084fc';
    x.beginPath(); x.arc(22, -9, 3, 0, Math.PI * 2); x.fill();

    // Body glow
    x.shadowColor = '#c084fc';
    x.shadowBlur = 8 + shot * 14;

    // Silver body
    x.fillStyle = '#e2e8f0';
    x.beginPath();
    x.roundRect(-11, -12, 22, 22, 7);
    x.fill();
    x.shadowBlur = 0;

    // Pointy ears
    x.fillStyle = '#e2e8f0';
    x.beginPath(); x.moveTo(-10, -10); x.lineTo(-15, -25); x.lineTo(-2, -12); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(10, -10); x.lineTo(15, -25); x.lineTo(2, -12); x.closePath(); x.fill();
    x.fillStyle = '#a855f7';
    x.beginPath(); x.moveTo(-9, -12); x.lineTo(-12, -21); x.lineTo(-4, -13); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(9, -12); x.lineTo(12, -21); x.lineTo(4, -13); x.closePath(); x.fill();

    // Glowing eyes (brighter when shooting)
    x.fillStyle = '#7c3aed';
    x.shadowColor = '#7c3aed';
    x.shadowBlur = 4 + glow * 10;
    const er = 2.2 + shot * 1.2;
    x.beginPath(); x.arc(-4, -3, er, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(4, -3, er, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;

    // Nose
    x.fillStyle = '#a855f7';
    x.beginPath(); x.arc(0, 2, 2, 0, Math.PI * 2); x.fill();

    x.restore();
  }

  // ── DAILY CHALLENGE ─────────────────────────────────────────────────────────
  function getDayKey() { return new Date().toISOString().slice(0, 10); }
  function getDailyGoal() {
    const d = new Date();
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    return 350 + (doy % 18) * 50;
  }
  const dailyGoal = getDailyGoal();
  const LS_STREAK = 'jvds_lhs_streak';
  let streakData = (function () {
    try {
      const o = JSON.parse(localStorage.getItem(LS_STREAK) || '{}');
      const today = getDayKey();
      return { streak: o.streak | 0, lastDay: o.lastDay || '', doneToday: o.lastDay === today };
    } catch (e) { return { streak: 0, lastDay: '', doneToday: false }; }
  })();

  function saveStreakData(streak, day) {
    try { localStorage.setItem(LS_STREAK, JSON.stringify({ streak, lastDay: day })); } catch (e) { }
    streakData.streak = streak; streakData.lastDay = day; streakData.doneToday = true;
  }

  function updateDailyHint() {
    const el = $('dailyHint');
    if (!el) return;
    el.textContent = streakData.doneToday
      ? '✅ Daily done! Streak: ' + streakData.streak + ' 🔥'
      : '📅 Daily goal: score ' + dailyGoal + ' pts  ·  Streak: ' + streakData.streak;
  }

  function checkDailyOnEnd(runScore) {
    if (streakData.doneToday) return;
    const el = $('dailyLine');
    if (runScore >= dailyGoal) {
      const today = getDayKey();
      const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const ns = streakData.lastDay === yday ? streakData.streak + 1 : 1;
      saveStreakData(ns, today);
      if (el) el.textContent = '🎯 Daily goal hit! Streak: ' + ns + ' 🔥';
    } else {
      if (el) el.textContent = '📅 Daily goal: ' + dailyGoal + '  ·  Got: ' + runScore;
    }
  }

  // ── UI WIRING ───────────────────────────────────────────────────────────────
  $('playBtn').onclick = startGame;
  $('againBtn').onclick = startGame;
  $('htpLink').onclick = () => { $('startScreen').classList.add('hidden'); $('howToPlay').classList.remove('hidden'); };
  $('gotItBtn').onclick = () => { $('howToPlay').classList.add('hidden'); $('startScreen').classList.remove('hidden'); };
  $('helpBtn').onclick = () => { $('howToPlay').classList.remove('hidden'); };
  $('soundBtn').onclick = () => {
    if (audio) { audio.muted = !audio.muted; $('soundBtn').textContent = audio.muted ? '🔇' : '🔊'; }
  };
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => { location.href = el.dataset.go; });
  });

  updateDailyHint();
  hud();
  requestAnimationFrame(loop);
})();
