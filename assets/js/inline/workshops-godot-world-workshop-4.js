(function () {
  /* ---------- progress ---------- */
  var EPISODES = [
    'jvds-godot-tutorial-v2', 'jvds-godot-gdscript-v2', 'jvds-godot-racing-v2', 'jvds-godot-racing2-v2',
    'jvds-godot-gatekeeper3d-p1-v2', 'jvds-godot-gatekeeper3d-p2-v2', 'jvds-godot-templates-v2'
  ];
  var done = 0;
  EPISODES.forEach(function (k) {
    try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && d.total && Array.isArray(d.completed) && d.completed.length >= d.total) done++; } catch (e) {}
  });
  var pct = Math.round(done / EPISODES.length * 100);
  var t = document.getElementById('gdProgText'); if (t) t.textContent = done + ' / ' + EPISODES.length + ' episodes complete';
  var f = document.getElementById('gdProgFill'); if (f) f.style.width = pct + '%';
  var sub = document.getElementById('gdProgSub');
  if (sub) sub.textContent = done === 0 ? 'Lay out a scene in the studio for a no-install head start.' : (done === EPISODES.length ? 'All done. You are a Godot Game Dev Pro.' : 'Nice progress. Keep going, one episode at a time.');
  var badge = document.getElementById('gdProgBadge');
  if (badge) badge.textContent = done >= EPISODES.length ? '🐙 Badge unlocked: Godot Game Dev Pro!' : 'Finish all ' + EPISODES.length + ' episodes to earn the badge.';

  /* ---------- live platformer scene ---------- */
  var cv = document.getElementById('gdHero');
  var SKIES = [
    { n: 'Daytime', top: '#8ec9f0', bot: '#dff0ff' },
    { n: 'Sunset', top: '#f5a15a', bot: '#ffe0b8' },
    { n: 'Night', top: '#1b2a4a', bot: '#3a4d78' },
    { n: 'Forest', top: '#3f7d5a', bot: '#bde7c9' }
  ];
  var skyIdx = 0, px = 90, vy = 0, t0 = 0;
  var PLATS = [[60, 220, 180], [300, 190, 120], [480, 230, 160], [700, 180, 140], [900, 220, 180]];
  var GAP_FROM = 420, GAP_TO = 480;
  if (cv) {
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    function frame(ts) {
      if (!t0) t0 = ts;
      var sky = SKIES[skyIdx];
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      /* platforms */
      ctx.fillStyle = 'rgba(60,90,60,.85)';
      PLATS.forEach(function (p) { ctx.fillRect(p[0], p[1], p[2], 18); });
      /* gap marker */
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(GAP_FROM, 170, GAP_TO - GAP_FROM, 120);
      /* the player runs, and jumps the gap */
      px += 3.2;
      if (px > W + 30) px = -30;
      var onGround = !(px > GAP_FROM && px < GAP_TO);
      var py = 200 + Math.sin(px / 34) * 3 - (onGround ? 0 : 26);
      /* coin */
      var cx = 560, cy = 200 + Math.sin(ts / 300) * 6;
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,130,0,.6)'; ctx.lineWidth = 2; ctx.stroke();
      /* player */
      ctx.fillStyle = '#478cbf';
      ctx.fillRect(px - 13, py - 26, 26, 30);
      ctx.fillStyle = '#2f6f9e';
      ctx.fillRect(px - 13, py - 26 + 26, 26, 6);
      /* eyes */
      ctx.fillStyle = '#fff'; ctx.fillRect(px - 6, py - 20, 5, 5); ctx.fillRect(px + 2, py - 20, 5, 5);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    function cycle() { skyIdx = (skyIdx + 1) % SKIES.length; var i = document.getElementById('gdHeroInfo'); if (i) i.textContent = SKIES[skyIdx].n; }
    cv.addEventListener('click', cycle);
    var cb = document.getElementById('gdHeroColour'); if (cb) cb.addEventListener('click', cycle);
  }
})();
