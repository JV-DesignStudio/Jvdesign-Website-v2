(function () {
  /* ---------- progress ---------- */
  var EPISODES = [
    'jvds-openrct2-world-ep1-setup-v2',
    'jvds-openrct2-world-ep2-first-plugin-v2',
    'jvds-openrct2-world-ep3-events-v2',
    'jvds-openrct2-world-ep4-read-the-park-v2',
    'jvds-openrct2-world-ep5-guests-v2',
    'jvds-openrct2-world-ep6-swim-rescue-v2',
    'jvds-openrct2-world-ep7-test-debug-v2',
    'jvds-openrct2-world-ep8-design-share-v2'
  ];
  var done = 0;
  EPISODES.forEach(function (k) {
    try {
      var d = JSON.parse(localStorage.getItem(k) || 'null');
      if (d && d.total && Array.isArray(d.completed) && d.completed.length >= d.total) done++;
    } catch (e) {}
  });
  var pct = Math.round(done / EPISODES.length * 100);
  var t = document.getElementById('rctProgText'); if (t) t.textContent = done + ' / ' + EPISODES.length + ' episodes complete';
  var f = document.getElementById('rctProgFill'); if (f) f.style.width = pct + '%';
  var sub = document.getElementById('rctProgSub');
  if (sub) sub.textContent = done === 0 ? 'Start Episode 1 to get set up.' : (done === EPISODES.length ? 'All done. You are a Coaster Marshal.' : 'Nice progress. Keep going, one episode at a time.');
  var badge = document.getElementById('rctProgBadge');
  if (badge) badge.textContent = done >= EPISODES.length ? '🎢 Badge unlocked: Coaster Marshal!' : 'Finish all ' + EPISODES.length + ' episodes to earn the badge.';

  /* ---------- live park scene ---------- */
  var cv = document.getElementById('rctHero'); if (!cv) return;
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height;
  var night = false, t0 = 0;
  /* track path as a simple coaster profile across the width */
  function trackY(x) {
    var base = H * 0.62;
    return base - 40 * Math.sin(x * 0.012) - 26 * Math.sin(x * 0.031 + 1);
  }
  function draw() {
    t0 += 1;
    var skyTop = night ? '#0b1026' : '#6fb7e8';
    var skyBot = night ? '#22345c' : '#bfe0f5';
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.66);
    g.addColorStop(0, skyTop); g.addColorStop(1, skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.66);
    /* sun / moon */
    ctx.beginPath(); ctx.arc(W * 0.82, H * 0.2, night ? 20 : 26, 0, Math.PI * 2);
    ctx.fillStyle = night ? '#e8ecf5' : '#ffe06a'; ctx.fill();
    /* clouds */
    ctx.fillStyle = night ? 'rgba(200,210,235,.5)' : 'rgba(255,255,255,.85)';
    for (var i = 0; i < 3; i++) { var cx = ((t0 * (0.3 + i * 0.2)) % (W + 220)) - 110; ctx.fillRect(cx, 34 + i * 26, 96, 22); ctx.fillRect(cx + 20, 18 + i * 26, 60, 20); }
    /* ground */
    ctx.fillStyle = night ? '#2f6b2c' : '#6ab04c';
    ctx.fillRect(0, H * 0.66, W, H * 0.34);
    ctx.fillStyle = night ? '#245a22' : '#4f8a2f';
    ctx.fillRect(0, H * 0.66, W, 6);
    /* coaster track (supports + rails) */
    ctx.strokeStyle = night ? '#8a3a2e' : '#d94f3d'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (var x = 0; x <= W; x += 6) { var y = trackY(x); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = night ? 'rgba(220,220,220,.5)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (var x2 = 0; x2 <= W; x2 += 6) { var y2 = trackY(x2) - 5; if (x2 === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2); }
    ctx.stroke();
    /* supports */
    ctx.strokeStyle = 'rgba(60,60,60,.45)'; ctx.lineWidth = 2;
    for (var sx = 40; sx < W; sx += 90) { var sy = trackY(sx); ctx.beginPath(); ctx.moveTo(sx, sy + 6); ctx.lineTo(sx, H * 0.66); ctx.stroke(); }
    /* train riding the track */
    var tx = (t0 * 2.4) % W;
    var ty = trackY(tx) - 12;
    ctx.fillStyle = '#e0a63a'; ctx.fillRect(tx - 22, ty - 6, 44, 14);
    ctx.fillStyle = '#c8402f'; ctx.fillRect(tx - 22, ty - 6, 14, 14);
    ctx.fillStyle = '#2c5a29'; ctx.fillRect(tx + 8, ty - 6, 14, 14);
    /* guests on the paths */
    for (var gI = 0; gI < 8; gI++) {
      var gx = (gI * 137 + t0 * (0.6 + (gI % 3) * 0.2)) % W;
      var gy = H * 0.78 + (gI % 3) * 12;
      ctx.fillStyle = ['#3757c9', '#c93a6a', '#f0a030', '#2fa07a'][gI % 4];
      ctx.fillRect(gx, gy, 6, 12);
      ctx.fillStyle = '#f2d3b3'; ctx.fillRect(gx, gy - 5, 6, 6);
    }
    requestAnimationFrame(draw);
  }
  function toggle() { night = !night; var i = document.getElementById('rctHeroInfo'); if (i) i.textContent = night ? 'Nighttime' : 'Daytime'; }
  cv.addEventListener('click', toggle);
  var tb = document.getElementById('rctHeroTime'); if (tb) tb.addEventListener('click', toggle);
  draw();
})();
