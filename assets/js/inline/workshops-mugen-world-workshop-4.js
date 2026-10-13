(function () {
  /* ---------- progress ---------- */
  var EPISODES = [
    'jvds-mugen-world-ep1-setup-v2',
    'jvds-mugen-world-ep2-fighter-files-v2',
    'jvds-mugen-world-ep3-sprites-palette-v2',
    'jvds-mugen-world-ep4-animations-v2',
    'jvds-mugen-world-ep5-commands-v2',
    'jvds-mugen-world-ep6-states-v2',
    'jvds-mugen-world-ep7-hitboxes-v2',
    'jvds-mugen-world-ep8-stage-v2',
    'jvds-mugen-world-ep9-ai-v2',
    'jvds-mugen-world-ep10-game-v2'
  ];
  var done = 0;
  EPISODES.forEach(function (k) {
    try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && d.total && Array.isArray(d.completed) && d.completed.length >= d.total) done++; } catch (e) {}
  });
  var pct = Math.round(done / EPISODES.length * 100);
  var t = document.getElementById('mgnProgText'); if (t) t.textContent = done + ' / ' + EPISODES.length + ' episodes complete';
  var f = document.getElementById('mgnProgFill'); if (f) f.style.width = pct + '%';
  var sub = document.getElementById('mgnProgSub');
  if (sub) sub.textContent = done === 0 ? 'Open the Studio for a no-install head start.' : (done === EPISODES.length ? 'All done. You are a Fighter Sensei.' : 'Nice progress. Keep going, one episode at a time.');
  var badge = document.getElementById('mgnProgBadge');
  if (badge) badge.textContent = done >= EPISODES.length ? '🥊 Badge unlocked: Fighter Sensei!' : 'Finish all ' + EPISODES.length + ' episodes to earn the badge.';
  var xpEl = document.createElement('div');
  try { var xp = parseInt(localStorage.getItem('jvds-mugen-studio-xp') || '0', 10); if (xp > 0 && badge) badge.textContent += ' Studio XP: ' + xp; } catch (e) {}

  /* ---------- live fight scene ---------- */
  var cv = document.getElementById('mgnHero'); if (!cv) return;
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, t0 = 0, lit = true;
  function fighter(x, dir, col, t) {
    var floorY = H * 0.72;
    var bob = Math.sin(t * 0.12) * 3;
    var punch = Math.max(0, Math.sin(t * 0.05));
    var reach = punch * 26 * dir;
    ctx.fillStyle = col;
    ctx.fillRect(x - 12, floorY - 66 + bob, 24, 44);
    ctx.fillStyle = '#f0c9a0';
    ctx.fillRect(x - 9, floorY - 86 + bob, 18, 18);
    ctx.fillStyle = col;
    ctx.fillRect(x - 14, floorY - 60 + bob, 10, 30);
    ctx.fillRect(x + 4, floorY - 60 + bob, 10, 30);
    ctx.fillRect(x + (dir > 0 ? 12 : -12) + reach, floorY - 60 + bob, 22 * dir, 10);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, floorY + 2, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  function bar(x, y, w, frac, flip) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 2, y - 2, w + 4, 20);
    ctx.fillStyle = '#3a1010'; ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = frac > 0.5 ? '#5ad35a' : (frac > 0.25 ? '#e0a63a' : '#d32f2f');
    var bw = w * frac;
    if (flip) ctx.fillRect(x + (w - bw), y, bw, 16); else ctx.fillRect(x, y, bw, 16);
  }
  function draw() {
    t0 += 1;
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    if (lit) { g.addColorStop(0, '#2a1550'); g.addColorStop(.6, '#5a1f4a'); g.addColorStop(1, '#7a2a2a'); }
    else { g.addColorStop(0, '#0b0620'); g.addColorStop(.6, '#241035'); g.addColorStop(1, '#3a1414'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.72);
    /* crowd lights */
    for (var i = 0; i < 26; i++) {
      var cx = (i * 61) % W, cy = 20 + ((i * 37) % 70);
      ctx.fillStyle = (lit && (i + Math.floor(t0 * 0.1)) % 4 === 0) ? '#ffd76a' : 'rgba(140,120,190,.5)';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    }
    /* floor */
    ctx.fillStyle = lit ? '#5a2f2f' : '#3a1c1c'; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
    for (var fx = 0; fx < W; fx += 46) { ctx.beginPath(); ctx.moveTo(fx, H * 0.72); ctx.lineTo(fx - 40, H); ctx.stroke(); }
    /* fighters */
    fighter(W * 0.34, 1, '#d32f2f', t0);
    fighter(W * 0.66, -1, '#3f6fd8', t0 + 30);
    /* health bars */
    bar(30, 24, W * 0.36, Math.max(0.15, 0.9 - 0.0001 * (t0 % 600)), false);
    bar(W - 30 - W * 0.36, 24, W * 0.36, Math.max(0.15, 0.85 - 0.0001 * (t0 % 700)), true);
    /* round text */
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
    ctx.fillText('ROUND 1', W / 2, H * 0.34);
    ctx.textAlign = 'left';
    requestAnimationFrame(draw);
  }
  function toggle() { lit = !lit; var i = document.getElementById('mgnHeroInfo'); if (i) i.textContent = lit ? 'Lights up' : 'Lights down'; }
  cv.addEventListener('click', toggle);
  var tb = document.getElementById('mgnHeroLight'); if (tb) tb.addEventListener('click', toggle);
  draw();
})();
