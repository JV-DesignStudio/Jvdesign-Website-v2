(function () {
  /* ---------- progress ---------- */
  var EPISODES = [
    'jvds-cpp-pong-v2', 'jvds-cpp-snake-v2', 'jvds-cpp-breakout-v2', 'jvds-cpp-platformer-v2',
    'jvds-cpp-platformer2-v2', 'jvds-cpp-tower-part1-v2', 'jvds-cpp-tower-part2-v2'
  ];
  var done = 0;
  EPISODES.forEach(function (k) {
    try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && d.total && Array.isArray(d.completed) && d.completed.length >= d.total) done++; } catch (e) {}
  });
  var pct = Math.round(done / EPISODES.length * 100);
  var t = document.getElementById('cppProgText'); if (t) t.textContent = done + ' / ' + EPISODES.length + ' episodes complete';
  var f = document.getElementById('cppProgFill'); if (f) f.style.width = pct + '%';
  var sub = document.getElementById('cppProgSub');
  if (sub) sub.textContent = done === 0 ? 'Lay out a level in the studio for a no-install head start.' : (done === EPISODES.length ? 'All done. You are a C++ Game Builder Pro.' : 'Nice progress. Keep going, one episode at a time.');
  var badge = document.getElementById('cppProgBadge');
  if (badge) badge.textContent = done >= EPISODES.length ? '⚙️ Badge unlocked: C++ Game Builder Pro!' : 'Finish all ' + EPISODES.length + ' episodes to earn the badge.';

  /* ---------- live breakout scene ---------- */
  var cv = document.getElementById('cppHero');
  var BGS = [
    { n: 'Night', top: '#0e1c2b', bot: '#16283c' },
    { n: 'Deep blue', top: '#0a2540', bot: '#123a5c' },
    { n: 'Slate', top: '#1c2430', bot: '#2b3648' },
    { n: 'Plum', top: '#241633', bot: '#392150' }
  ];
  var bgIdx = 0;
  var bx = 520, by = 200, bvx = 4, bvy = 3.4, paddleX = 520, bricks = [], t0 = 0;
  for (var r = 0; r < 3; r++) for (var c = 0; c < 9; c++) bricks.push({ x: 120 + c * 92, y: 40 + r * 26, alive: true });
  if (cv) {
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    function frame(ts) {
      if (!t0) t0 = ts;
      var bg = BGS[bgIdx];
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, bg.top); g.addColorStop(1, bg.bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      /* bricks */
      bricks.forEach(function (bk) {
        if (!bk.alive) return;
        ctx.fillStyle = '#3a86c8';
        ctx.fillRect(bk.x, bk.y, 84, 20);
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(bk.x, bk.y, 84, 20);
      });
      /* paddle follows the ball loosely */
      paddleX += (bx - 60 - paddleX) * 0.08;
      paddleX = Math.max(20, Math.min(W - 140, paddleX));
      ctx.fillStyle = '#e8eef6';
      ctx.fillRect(paddleX, H - 34, 120, 14);
      /* ball */
      bx += bvx; by += bvy;
      if (bx < 10 || bx > W - 10) bvx = -bvx;
      if (by < 10) bvy = -bvy;
      if (by > H - 44 && bx > paddleX && bx < paddleX + 120) bvy = -Math.abs(bvy);
      if (by > H + 20) { by = 120; bx = 200 + Math.random() * (W - 400); bvx = Math.random() > 0.5 ? 4 : -4; bvy = 3.4; bricks.forEach(function (bk) { bk.alive = true; }); }
      for (var i = 0; i < bricks.length; i++) {
        var bk = bricks[i];
        if (bk.alive && bx > bk.x && bx < bk.x + 84 && by > bk.y && by < bk.y + 20) { bk.alive = false; bvy = -bvy; break; }
      }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    function cycle() { bgIdx = (bgIdx + 1) % BGS.length; var i = document.getElementById('cppHeroInfo'); if (i) i.textContent = BGS[bgIdx].n; }
    cv.addEventListener('click', cycle);
    var cb = document.getElementById('cppHeroColour'); if (cb) cb.addEventListener('click', cycle);
  }
})();
