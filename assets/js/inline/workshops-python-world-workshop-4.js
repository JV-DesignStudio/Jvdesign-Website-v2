(function () {
  /* ---------- progress ---------- */
  var EPISODES = [
    'jvds-python-catch-v2', 'jvds-python-platformer-v2', 'jvds-python-dodge-v2', 'jvds-python-maze-v2',
    'jvds-python-breakout-v2', 'jvds-python-breakout2-v2', 'jvds-python-platformer2-v2'
  ];
  var done = 0;
  EPISODES.forEach(function (k) {
    try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && d.total && Array.isArray(d.completed) && d.completed.length >= d.total) done++; } catch (e) {}
  });
  var pct = Math.round(done / EPISODES.length * 100);
  var t = document.getElementById('pyProgText'); if (t) t.textContent = done + ' / ' + EPISODES.length + ' episodes complete';
  var f = document.getElementById('pyProgFill'); if (f) f.style.width = pct + '%';
  var sub = document.getElementById('pyProgSub');
  if (sub) sub.textContent = done === 0 ? 'Lay out a level in the studio for a no-install head start.' : (done === EPISODES.length ? 'All done. You are a Python Game Builder Pro.' : 'Nice progress. Keep going, one episode at a time.');
  var badge = document.getElementById('pyProgBadge');
  if (badge) badge.textContent = done >= EPISODES.length ? '🐍 Badge unlocked: Python Game Builder Pro!' : 'Finish all ' + EPISODES.length + ' episodes to earn the badge.';

  /* ---------- live catch game ---------- */
  var cv = document.getElementById('pyHero');
  var SKIES = [
    { n: 'Daytime', top: '#8ec9f0', bot: '#e6f4ff' },
    { n: 'Sunset', top: '#f5a15a', bot: '#ffe6c4' },
    { n: 'Night', top: '#16223c', bot: '#324a72' },
    { n: 'Meadow', top: '#5aa06a', bot: '#cdeecf' }
  ];
  var skyIdx = 0;
  var fruits = [], score = 0, spawnT = 0, t0 = 0;
  if (cv) {
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    function frame(ts) {
      if (!t0) t0 = ts;
      var sky = SKIES[skyIdx];
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      /* spawn fruit */
      spawnT += 1;
      if (spawnT > 48) { spawnT = 0; fruits.push({ x: 80 + Math.random() * (W - 160), y: -20, r: 13, vy: 2 + Math.random() * 1.6 }); }
      /* basket follows a sine path */
      var basketX = W / 2 + Math.sin(ts / 900) * (W / 2 - 140);
      var basketY = H - 70;
      /* update + draw fruit */
      for (var i = fruits.length - 1; i >= 0; i--) {
        var fr = fruits[i];
        fr.y += fr.vy;
        ctx.beginPath(); ctx.arc(fr.x, fr.y, fr.r, 0, Math.PI * 2);
        ctx.fillStyle = '#e8622c'; ctx.fill();
        ctx.strokeStyle = 'rgba(120,40,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
        if (fr.y > basketY - 6 && Math.abs(fr.x - basketX) < 46) { fruits.splice(i, 1); score += 1; }
        else if (fr.y > H + 20) { fruits.splice(i, 1); }
      }
      /* basket */
      ctx.fillStyle = '#3776ab';
      ctx.beginPath();
      ctx.moveTo(basketX - 46, basketY);
      ctx.lineTo(basketX + 46, basketY);
      ctx.lineTo(basketX + 34, basketY + 40);
      ctx.lineTo(basketX - 34, basketY + 40);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b5f8c';
      ctx.fillRect(basketX - 46, basketY, 92, 7);
      /* score */
      ctx.fillStyle = 'rgba(20,40,60,.85)';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText('Score: ' + score, 20, 34);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    function cycle() { skyIdx = (skyIdx + 1) % SKIES.length; var i = document.getElementById('pyHeroInfo'); if (i) i.textContent = SKIES[skyIdx].n; }
    cv.addEventListener('click', cycle);
    var cb = document.getElementById('pyHeroColour'); if (cb) cb.addEventListener('click', cycle);
  }
})();
