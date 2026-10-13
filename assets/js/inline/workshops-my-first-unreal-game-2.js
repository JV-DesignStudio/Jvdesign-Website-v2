/* Series progress dashboard for My First Unreal Game (matches the Stardew/Unity pattern). */
(function () {
  var EPISODES = ['jvds-unreal-basics-v2','jvds-unreal-bp-shooter-v2','jvds-unreal-clicker-v2','jvds-unreal-2d-platformer-v2','jvds-unreal-fighter-v2','jvds-unreal-zombie-v2','jvds-unreal-top-down-v2','jvds-unreal-advanced-v2','jvds-unreal-multiplayer-v2'];
  function doneCount() {
    var n = 0;
    EPISODES.forEach(function (k) {
      try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && Array.isArray(d.completed) && typeof d.total === 'number' && d.completed.length >= d.total) n++; } catch (e) {}
    });
    return n;
  }
  try {
    var n = doneCount(), total = EPISODES.length;
    var t = document.getElementById('unrealProgText'); if (t) t.textContent = n + ' / ' + total + ' episodes complete';
    var f = document.getElementById('unrealProgFill'); if (f) f.style.width = (n / total * 100) + '%';
    var b = document.getElementById('unrealProgBadge');
    if (b) { if (n >= total) { b.textContent = '🔺 Badge unlocked: Unreal Builder!'; } else { b.textContent = (total - n) + ' episode' + (total - n === 1 ? '' : 's') + ' to go for the badge.'; } }
    var s = document.getElementById('unrealProgSub'); if (s && n > 0) s.textContent = 'Nice. Keep going, one game at a time.';
    var p = null; try { p = JSON.parse(localStorage.getItem('jvds_profile') || 'null'); } catch (e) {}
    var xp = document.getElementById('unrealProgXp'); if (xp && p) { var st = p.state || p; xp.textContent = 'Level ' + (st.level || 1) + ' · ' + (st.globalXP || 0) + ' XP across the studio'; }
  } catch (e) {}
})();
