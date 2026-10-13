(function () {
  /* ---------- progress ---------- */
  var EPISODES = [
    'jvds-blender-cube-v2', 'jvds-blender-character-v2', 'jvds-blender-rigging-v2', 'jvds-blender-animation-v2',
    'jvds-blender-materials-v2', 'jvds-blender-lighting-v2', 'jvds-blender-scene-v2', 'jvds-blender-v2'
  ];
  var done = 0;
  EPISODES.forEach(function (k) {
    try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && d.total && Array.isArray(d.completed) && d.completed.length >= d.total) done++; } catch (e) {}
  });
  var pct = Math.round(done / EPISODES.length * 100);
  var t = document.getElementById('blProgText'); if (t) t.textContent = done + ' / ' + EPISODES.length + ' episodes complete';
  var f = document.getElementById('blProgFill'); if (f) f.style.width = pct + '%';
  var sub = document.getElementById('blProgSub');
  if (sub) sub.textContent = done === 0 ? 'Sketch a blockout for a no-install head start.' : (done === EPISODES.length ? 'All done. You are a 3D Artist Pro.' : 'Nice progress. Keep going, one episode at a time.');
  var badge = document.getElementById('blProgBadge');
  if (badge) badge.textContent = done >= EPISODES.length ? '🎨 Badge unlocked: 3D Artist Pro!' : 'Finish all ' + EPISODES.length + ' episodes to earn the badge.';

  /* ---------- live wireframe cube ---------- */
  var cv = document.getElementById('blHero');
  var COLORS = [{ n: 'Blender orange', c: '#f5792a' }, { n: 'Blender pink', c: '#ff70b8' }, { n: 'Cool blue', c: '#3f8fd8' }, { n: 'Mint', c: '#3ec9a7' }];
  var colIdx = 0, ang = 0;
  function project(p, a, W, H) {
    var x = p[0] * Math.cos(a) - p[2] * Math.sin(a);
    var z = p[0] * Math.sin(a) + p[2] * Math.cos(a);
    var y = p[1] * Math.cos(0.5) - z * Math.sin(0.5);
    var zz = p[1] * Math.sin(0.5) + z * Math.cos(0.5);
    var f = 620 / (620 + zz);
    return [W / 2 + x * f, H / 2 - y * f, zz];
  }
  if (cv) {
    var ctx = cv.getContext('2d'); var W = cv.width, H = cv.height, S = 62;
    var V = [];
    for (var i = 0; i < 8; i++) V.push([((i & 1) ? 1 : -1) * S, ((i & 2) ? 1 : -1) * S, ((i & 4) ? 1 : -1) * S]);
    var E = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
    (function frame() {
      ang += 0.01;
      var g = ctx.createRadialGradient(W/2, H*0.1, 40, W/2, H/2, H);
      g.addColorStop(0, '#2a2340'); g.addColorStop(1, '#0c0a12');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      /* floor grid */
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
      for (var gx = -3; gx <= 3; gx++) { var a = project([gx*S, -S, -3*S], ang, W, H), b = project([gx*S, -S, 3*S], ang, W, H); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      for (var gz = -3; gz <= 3; gz++) { var c = project([-3*S, -S, gz*S], ang, W, H), d = project([3*S, -S, gz*S], ang, W, H); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
      var pts = V.map(function (p) { return project([p[0], p[1] + S * 0.4, p[2]], ang, W, H); });
      ctx.strokeStyle = COLORS[colIdx].c; ctx.lineWidth = 3; ctx.globalAlpha = 0.95;
      E.forEach(function (e) { ctx.beginPath(); ctx.moveTo(pts[e[0]][0], pts[e[0]][1]); ctx.lineTo(pts[e[1]][0], pts[e[1]][1]); ctx.stroke(); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); });
      requestAnimationFrame(frame);
    })();
    function cycle() { colIdx = (colIdx + 1) % COLORS.length; var i = document.getElementById('blHeroInfo'); if (i) i.textContent = COLORS[colIdx].n; }
    cv.addEventListener('click', cycle);
    var cb = document.getElementById('blHeroColour'); if (cb) cb.addEventListener('click', cycle);
  }
})();
