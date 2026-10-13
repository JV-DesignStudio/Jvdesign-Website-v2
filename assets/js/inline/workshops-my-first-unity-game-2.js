/* Series progress dashboard for My First Unity Game (matches the Stardew/Minecraft pattern). */
(function () {
  var EPISODES = ['jvds-unity-pong-v2','jvds-unity-2d-platformer-v2','jvds-unity-breakout-v2','jvds-unity-top-down-v2','jvds-unity-3d-platformer-v2','jvds-unity-action-rpg-v2','jvds-unity-ui-menus-v2','jvds-unity-multiplayer-v2'];
  function doneCount() {
    var n = 0;
    EPISODES.forEach(function (k) {
      try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && Array.isArray(d.completed) && typeof d.total === 'number' && d.completed.length >= d.total) n++; } catch (e) {}
    });
    return n;
  }
  try {
    var n = doneCount(), total = EPISODES.length;
    var t = document.getElementById('unityProgText'); if (t) t.textContent = n + ' / ' + total + ' episodes complete';
    var f = document.getElementById('unityProgFill'); if (f) f.style.width = (n / total * 100) + '%';
    var b = document.getElementById('unityProgBadge');
    if (b) { if (n >= total) { b.textContent = '🔷 Badge unlocked: Unity Builder!'; } else { b.textContent = (total - n) + ' episode' + (total - n === 1 ? '' : 's') + ' to go for the badge.'; } }
    var s = document.getElementById('unityProgSub'); if (s && n > 0) s.textContent = 'Nice. Keep going, one game at a time.';
    var p = null; try { p = JSON.parse(localStorage.getItem('jvds_profile') || 'null'); } catch (e) {}
    var xp = document.getElementById('unityProgXp'); if (xp && p) { var st = p.state || p; xp.textContent = 'Level ' + (st.level || 1) + ' · ' + (st.globalXP || 0) + ' XP across the studio'; }
  } catch (e) {}
})();
