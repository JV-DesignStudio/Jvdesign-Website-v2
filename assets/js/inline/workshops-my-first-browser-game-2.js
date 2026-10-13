/* Series progress dashboard for My First Browser Game.
   Reads the six workshop keys so the hub matches the Stardew/Minecraft pattern. */
(function () {
  var EPISODES = ['jvds-js-flappy-v2','jvds-js-memory-v2','jvds-js-breakout-v2','jvds-js-snake-v2','jvds-js-platformer-v2','jvds-js-platformer2-v2'];
  function doneCount() {
    var n = 0;
    EPISODES.forEach(function (k) {
      try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && Array.isArray(d.completed) && typeof d.total === 'number' && d.completed.length >= d.total) n++; } catch (e) {}
    });
    return n;
  }
  try {
    var n = doneCount(), total = EPISODES.length;
    var t = document.getElementById('jsProgText'); if (t) t.textContent = n + ' / ' + total + ' episodes complete';
    var f = document.getElementById('jsProgFill'); if (f) f.style.width = (n / total * 100) + '%';
    var b = document.getElementById('jsProgBadge');
    if (b) { if (n >= total) { b.textContent = '🟨 Badge unlocked: Browser Game Builder!'; } else { b.textContent = (total - n) + ' episode' + (total - n === 1 ? '' : 's') + ' to go for the badge.'; } }
    var s = document.getElementById('jsProgSub'); if (s && n > 0) s.textContent = 'Nice. Keep going, one game at a time.';
    var p = null; try { p = JSON.parse(localStorage.getItem('jvds_profile') || 'null'); } catch (e) {}
    var xp = document.getElementById('jsProgXp'); if (xp && p) { var st = p.state || p; xp.textContent = 'Level ' + (st.level || 1) + ' · ' + (st.globalXP || 0) + ' XP across the studio'; }
  } catch (e) {}
})();
