(function () {
  /* ---------- progress ---------- */
  var EPISODES = [
    'jvds-minecraft-world-ep1-setup-v2',
    'jvds-minecraft-world-ep2-first-recipe-v2',
    'jvds-minecraft-world-ep3-namespace-v2',
    'jvds-minecraft-world-ep4-functions-v2',
    'jvds-minecraft-world-ep5-loot-v2',
    'jvds-minecraft-world-ep6-tags-advancements-v2',
    'jvds-minecraft-world-ep7-debug-v2',
    'jvds-minecraft-world-ep8-design-share-v2'
  ];
  var done = 0;
  EPISODES.forEach(function (k) {
    try {
      var d = JSON.parse(localStorage.getItem(k) || 'null');
      if (d && d.total && Array.isArray(d.completed) && d.completed.length >= d.total) done++;
    } catch (e) {}
  });
  var pct = Math.round(done / EPISODES.length * 100);
  var t = document.getElementById('mcProgText'); if (t) t.textContent = done + ' / ' + EPISODES.length + ' episodes complete';
  var f = document.getElementById('mcProgFill'); if (f) f.style.width = pct + '%';
  var sub = document.getElementById('mcProgSub');
  if (sub) sub.textContent = done === 0 ? 'Open the Studio for a no-install head start.' : (done === EPISODES.length ? 'All done. You are a Redstone Architect.' : 'Nice progress. Keep going, one episode at a time.');
  var badge = document.getElementById('mcProgBadge');
  if (badge) badge.textContent = done >= EPISODES.length ? '🏗️ Badge unlocked: Redstone Architect!' : 'Finish all ' + EPISODES.length + ' episodes to earn the badge.';
  var xpEl = document.getElementById('mcProgXp');
  try { var xp = parseInt(localStorage.getItem('jvds-minecraft-studio-xp') || '0', 10); if (xpEl && xp > 0) xpEl.textContent = 'Studio XP earned: ' + xp; } catch (e) {}

  /* ---------- live blocky scene ---------- */
  var cv = document.getElementById('mcHero'); if (!cv) return;
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, S = 25;
  var night = false, t0 = 0, cloud = 0;
  function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x * S, y * S, w * S, h * S); }
  function draw() {
    var skyTop = night ? '#0b1026' : '#7fc6f2';
    var skyBot = night ? '#243b64' : '#bfe6f7';
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    g.addColorStop(0, skyTop); g.addColorStop(1, skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.55);
    /* sun / moon */
    ctx.beginPath();
    ctx.arc((cloud % W + 120) % (W + 200) - 60, H * 0.16, night ? 22 : 28, 0, Math.PI * 2);
    ctx.fillStyle = night ? '#e8ecf5' : '#ffe06a'; ctx.fill();
    /* clouds */
    for (var i = 0; i < 4; i++) {
      var cxp = ((cloud * (0.6 + i * 0.25)) % (W + 260)) - 130;
      var cyp = H * (0.08 + i * 0.07);
      ctx.fillStyle = night ? 'rgba(200,210,235,.5)' : 'rgba(255,255,255,.85)';
      ctx.fillRect(cxp, cyp, 110, 26); ctx.fillRect(cxp + 26, cyp - 20, 66, 24);
    }
    /* ground rows */
    var groundRow = Math.floor(H * 0.55 / S);
    for (var x = 0; x < Math.ceil(W / S); x++) {
      px(x, groundRow, 1, 1, night ? '#2f6b2c' : '#5aa03a');
      for (var y = groundRow + 1; y < Math.ceil(H / S); y++) {
        px(x, y, 1, 1, ((x + y) % 2 === 0) ? '#8a5a34' : '#7a4e2c');
      }
    }
    /* tree */
    var tx = 4, ty = groundRow - 1;
    px(tx, ty, 1, 2, '#6b4522'); px(tx + 1, ty, 1, 2, '#5a3a1d');
    px(tx - 1, ty - 2, 4, 2, night ? '#245a24' : '#3f8a2f'); px(tx, ty - 3, 2, 1, night ? '#245a24' : '#3f8a2f');
    /* a couple of blocks */
    px(12, groundRow - 1, 1, 1, '#6fd0e0'); /* diamond block */
    px(14, groundRow - 1, 1, 1, '#c8402f'); /* redstone block */
    px(16, groundRow - 1, 1, 1, night ? '#c9a53a' : '#e0a63a'); /* gold block */
    /* creeper-ish face block */
    var fx = 22, fy = groundRow - 1;
    px(fx, fy, 1, 1, night ? '#2f7a3a' : '#4fae52');
    ctx.fillStyle = '#0b2010';
    ctx.fillRect(fx * S + 5, fy * S + 6, 5, 5); ctx.fillRect(fx * S + 15, fy * S + 6, 5, 5);
    ctx.fillRect(fx * S + 9, fy * S + 12, 7, 8);
    cloud += 0.7;
    requestAnimationFrame(draw);
  }
  function toggle() { night = !night; var i = document.getElementById('mcHeroInfo'); if (i) i.textContent = night ? 'Nighttime' : 'Daytime'; }
  cv.addEventListener('click', toggle);
  var tb = document.getElementById('mcHeroTime'); if (tb) tb.addEventListener('click', toggle);
  draw();
})();
