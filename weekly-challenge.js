/* ═══════════════════════════════════════════════════════════
   Weekly Challenge — the Daily Challenge's bigger sibling
   ─────────────────────────────────────────────────────────────
   One rotating goal per week, shared by every player that week,
   built from the same XP-source stream as the daily (see
   player-profile.js -> getWeeklyActivity). Bigger goals, bigger
   payouts, and a 7-day window so it survives a busy day or two.

   Public API:
     WeeklyChallenge.thisWeek()            -> this week's challenge object
     WeeklyChallenge.progress()            -> { done, current, goal, pct, claimed }
     WeeklyChallenge.render(target, opts)  -> paint into an element; opts.shout
                                              overrides the celebration toast fn
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (typeof window === 'undefined') return;

  /* No workshop metric here: workshops exist on the website but not inside
     the packaged app, so a weekly goal could become impossible there. */
  var CHALLENGES = [
    { id: 'w-wide-net',    icon: '🧭', title: 'Wide Net',      metric: 'distinctGames', goal: 5,  xp: 150, verb: 'Try 5 different games this week' },
    { id: 'w-long-haul',   icon: '🏃', title: 'Long Haul',     metric: 'runs',          goal: 15, xp: 150, verb: 'Finish 15 runs this week' },
    { id: 'w-harvest',     icon: '💎', title: 'Point Harvest', metric: 'xp',            goal: 600, xp: 200, verb: 'Earn 600 XP this week' },
    { id: 'w-curious',     icon: '🌟', title: 'Curious Week',  metric: 'distinctGames', goal: 8,  xp: 220, verb: 'Play 8 different games this week' },
    { id: 'w-relentless',  icon: '🔥', title: 'Relentless',    metric: 'runs',          goal: 30, xp: 250, verb: 'Finish 30 runs this week' }
  ];

  function weekIndex() {
    var n = new Date();
    return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000 / 7);
  }

  function dayNumber() {
    var n = new Date();
    return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000);
  }

  // Days until the weekly bucket rolls over (7..1, shown as "resets in Nd").
  function daysLeft() {
    return 7 - (dayNumber() % 7);
  }

  function profile() {
    try { return typeof playerProfile !== 'undefined' ? playerProfile : (window.playerProfile || null); }
    catch (e) { return window.playerProfile || null; }
  }

  function currentFor(ch, act) {
    switch (ch.metric) {
      case 'distinctGames': return (act.games || []).length;
      case 'runs':          return act.runs || 0;
      case 'xp':            return act.xp || 0;
      default:              return 0;
    }
  }

  function thisWeek() {
    return CHALLENGES[((weekIndex() % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
  }

  function progress() {
    var p = profile();
    var ch = thisWeek();
    if (!p) return { done: false, current: 0, goal: ch.goal, pct: 0, claimed: false, challenge: ch };
    var act = p.getWeeklyActivity();
    var cur = currentFor(ch, act);
    return {
      done: cur >= ch.goal,
      current: cur,
      goal: ch.goal,
      pct: Math.max(0, Math.min(100, Math.round((cur / ch.goal) * 100))),
      claimed: act.claimed === ch.id,
      challenge: ch
    };
  }

  // Safe to call repeatedly; the profile guards against double-awarding.
  function tryClaim() {
    var p = profile();
    if (!p) return false;
    var st = progress();
    if (st.done && !st.claimed) {
      return p.claimWeeklyChallenge(st.challenge.id, st.challenge.xp);
    }
    return false;
  }

  /* ── Styles (injected once) ── */
  var stylesReady = false;
  function ensureStyles() {
    if (stylesReady || typeof document === 'undefined' || !document.head) return;
    stylesReady = true;
    var st = document.createElement('style');
    st.textContent =
      '.jvds-weekly{border-radius:20px;padding:16px 20px;margin:-14px 0 26px;' +
      'background:linear-gradient(150deg,#111d17,#14161f 70%);' +
      'border:1px solid rgba(143,203,127,.22);color:#eef2e6;position:relative;overflow:hidden;' +
      'font-family:Inter,system-ui,sans-serif}' +
      '.jvds-weekly::before{content:"";position:absolute;inset:0;pointer-events:none;' +
      'background:radial-gradient(ellipse at 100% 0%,rgba(143,203,127,.10),transparent 55%)}' +
      '.jvds-weekly-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;position:relative}' +
      '.jvds-weekly-eyebrow{font-size:.66rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#8FCB7F}' +
      '.jvds-weekly-left{font-size:.72rem;font-weight:700;color:rgba(238,242,230,.55);white-space:nowrap}' +
      '.jvds-weekly-body{display:flex;align-items:center;gap:14px;position:relative}' +
      '.jvds-weekly-icon{font-size:1.7rem;line-height:1;flex:none}' +
      '.jvds-weekly-main{flex:1;min-width:0}' +
      '.jvds-weekly-title{font-weight:700;font-size:.98rem;margin:0 0 2px}' +
      '.jvds-weekly-verb{font-size:.78rem;color:rgba(238,242,230,.62);margin:0 0 8px}' +
      '.jvds-weekly-bar{height:8px;border-radius:8px;background:rgba(255,255,255,.10);overflow:hidden}' +
      '.jvds-weekly-fill{height:100%;width:0;border-radius:8px;' +
      'background:linear-gradient(90deg,#8FCB7F,#F0C040);transition:width .5s cubic-bezier(.4,0,.2,1)}' +
      '.jvds-weekly-meta{display:flex;justify-content:space-between;margin-top:7px;font-size:.74rem;font-weight:700;color:rgba(238,242,230,.75)}' +
      '.jvds-weekly-reward{color:#F0C040;font-weight:800;font-size:.78rem}' +
      '.jvds-weekly.done{border-color:rgba(143,203,127,.5)}' +
      '.jvds-weekly.done .jvds-weekly-fill{background:linear-gradient(90deg,#8FCB7F,#d9f2cf)}';
    document.head.appendChild(st);
  }

  // Fallback toast for pages without a hub-provided shout function.
  function defaultShout(msg) {
    if (typeof document === 'undefined' || !document.body) return;
    ensureStyles();
    var t = document.createElement('div');
    t.className = 'jvds-daily-toast'; // reuses the injected daily-toast look when present
    t.textContent = msg;
    t.style.cssText += ';bottom:96px;';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.remove(); }, 400);
    }, 3200);
  }

  /* ── Widget ── */
  function paint(el) {
    if (!el) return;
    ensureStyles();
    var st = progress();
    var ch = st.challenge;
    el.className = 'jvds-weekly' + (st.done ? ' done' : '');
    el.innerHTML =
      '<div class="jvds-weekly-top">' +
        '<span class="jvds-weekly-eyebrow">🗓 Weekly Challenge</span>' +
        '<span class="jvds-weekly-left">resets in ' + daysLeft() + 'd</span>' +
      '</div>' +
      '<div class="jvds-weekly-body">' +
        '<div class="jvds-weekly-icon">' + ch.icon + '</div>' +
        '<div class="jvds-weekly-main">' +
          '<p class="jvds-weekly-title">' + ch.title + '</p>' +
          '<p class="jvds-weekly-verb">' + ch.verb + '</p>' +
          '<div class="jvds-weekly-bar"><div class="jvds-weekly-fill" style="width:' + st.pct + '%"></div></div>' +
          '<div class="jvds-weekly-meta">' +
            '<span>' + st.current + ' / ' + ch.goal + '</span>' +
            (st.claimed
              ? '<span class="jvds-weekly-reward">✓ +' + ch.xp + ' XP claimed</span>'
              : '<span class="jvds-weekly-reward">Reward: +' + ch.xp + ' XP</span>') +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function render(target, opts) {
    opts = opts || {};
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    var shout = typeof opts.shout === 'function' ? opts.shout : defaultShout;

    var claimed = tryClaim(); // may award if the goal was met while playing
    paint(el);
    if (claimed) shout('🗓 Weekly Challenge done! +' + thisWeek().xp + ' XP');

    if (!render._wired) {
      render._wired = true;
      window.addEventListener('xp-gained', repaint);
      window.addEventListener('profile-saved', repaint);
    }
    render._els = render._els || [];
    if (render._els.indexOf(el) === -1) render._els.push(el);

    function repaint() {
      var again = tryClaim();
      (render._els || []).forEach(function (n) { if (n && n.isConnected) paint(n); });
      if (again) shout('🗓 Weekly Challenge done! +' + thisWeek().xp + ' XP');
    }
  }

  window.WeeklyChallenge = {
    thisWeek: thisWeek,
    progress: progress,
    daysLeft: daysLeft,
    render: render
  };
})();
