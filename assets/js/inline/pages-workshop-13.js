/* pages-workshop-13.js - Progress dashboard, sort, difficulty badges, high-contrast toggle */
(function () {
  /* ── Progress Dashboard ── */
  var dash = document.getElementById('wsProgressDashboard');
  if (dash) {
    try {
      var totalXp = 0, totalCompleted = 0, maxLevel = 1;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('workshop') === -1 && k.indexOf('ws_') === -1) continue;
        try {
          var d = JSON.parse(localStorage.getItem(k));
          if (d && d.xp) { totalXp += d.xp; if (d.level > maxLevel) maxLevel = d.level; }
          if (d && d.completed && d.total && d.completed.length === d.total) totalCompleted++;
        } catch (e) {}
      }
      var streak = { count: 0 };
      try { streak = JSON.parse(localStorage.getItem('jvds_daily_streak') || '{}'); } catch (e) {}

      if (totalXp > 0 || totalCompleted > 0) {
        document.getElementById('wsDashXp').textContent = totalXp;
        document.getElementById('wsDashCompleted').textContent = totalCompleted;
        document.getElementById('wsDashStreak').textContent = streak.count || 0;
        document.getElementById('wsDashLevel').textContent = maxLevel;
        dash.style.display = '';
      }
    } catch (e) {}
  }

  /* ── Sort ── */
  var sortEl = document.getElementById('workshopSort');
  if (sortEl) {
    sortEl.addEventListener('change', function () {
      var grid = document.getElementById('catalogueGrid');
      if (!grid) return;
      var cards = [].slice.call(grid.querySelectorAll('.course-card'));
      if (!cards.length) return;
      var val = sortEl.value;
      if (!val) return;
      var DIFF_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };
      cards.sort(function (a, b) {
        if (val === 'az') return (a.textContent || '').trim().localeCompare((b.textContent || '').trim());
        if (val === 'za') return (b.textContent || '').trim().localeCompare((a.textContent || '').trim());
        if (val === 'difficulty') {
          var da = DIFF_ORDER[a.dataset.difficulty] !== undefined ? DIFF_ORDER[a.dataset.difficulty] : 1;
          var db = DIFF_ORDER[b.dataset.difficulty] !== undefined ? DIFF_ORDER[b.dataset.difficulty] : 1;
          return da - db;
        }
        return 0;
      });
      cards.forEach(function (c) { grid.appendChild(c); });
    });
  }

  /* ── Difficulty badges on cards ── */
  var diffColors = {
    beginner: { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.4)', color: '#16a34a', label: 'Beginner' },
    intermediate: { bg: 'rgba(234,179,8,.15)', border: 'rgba(234,179,8,.4)', color: '#ca8a04', label: 'Intermediate' },
    advanced: { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.4)', color: '#dc2626', label: 'Advanced' }
  };
  document.querySelectorAll('.course-card[data-difficulty]').forEach(function (card) {
    var d = card.dataset.difficulty;
    var c = diffColors[d];
    if (!c || card.querySelector('.ws-diff-badge')) return;
    var badge = document.createElement('span');
    badge.className = 'ws-diff-badge';
    badge.textContent = c.label;
    badge.style.cssText = 'position:absolute;top:8px;left:8px;z-index:5;font-size:.62rem;font-weight:800;' +
      'letter-spacing:.04em;padding:3px 9px;border-radius:999px;pointer-events:none;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';color:' + c.color + ';';
    card.style.position = 'relative';
    card.appendChild(badge);
  });

  /* ── High-contrast toggle ── */
  var footer = document.querySelector('.site-footer, footer');
  if (footer && !document.querySelector('.ws-contrast-toggle')) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ws-contrast-toggle';
    btn.textContent = '◐ High Contrast';
    btn.title = 'Toggle high-contrast mode';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin:12px auto;' +
      'background:rgba(64,59,51,.08);border:1px solid rgba(64,59,51,.15);color:var(--charcoal-lt,#6b6560);' +
      'font-size:.75rem;font-weight:700;padding:6px 14px;border-radius:999px;cursor:pointer;';
    var isHC = false;
    try { isHC = localStorage.getItem('jvds_contrast') === 'high'; } catch (e) {}
    if (isHC) document.documentElement.setAttribute('data-contrast', 'high');
    btn.addEventListener('click', function () {
      isHC = !isHC;
      if (isHC) document.documentElement.setAttribute('data-contrast', 'high');
      else document.documentElement.removeAttribute('data-contrast');
      try { localStorage.setItem('jvds_contrast', isHC ? 'high' : 'off'); } catch (e) {}
    });
    footer.insertBefore(btn, footer.firstChild);
  }
})();
