/* ═══════════════════════════════════════════════════════════
   Daily Challenge + Loud Streak
   ─────────────────────────────────────────────────────────────
   A once-a-day reason to come back. One rotating goal, shared by
   every player that day, built ENTIRELY from signals the profile
   already records (player-profile.js -> getDailyActivity). No game
   or workshop code is touched.

   This file is loaded only on the hub pages that show the widget
   (arcade, my-progress, quest board). The tracking that feeds it
   lives in player-profile.js, which loads everywhere, so progress
   made while playing is already saved by the time a hub renders.

   Public API:
     DailyChallenge.today()                 -> the challenge object for today
     DailyChallenge.progress()              -> { done, current, goal, pct, claimed }
     DailyChallenge.render(containerId, opts)-> paint the widget into an element
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (typeof window === 'undefined') return;

  /* ── Definitions ──
     metric maps to a counter on profile.getDailyActivity():
       distinctGames -> games.length   runs -> runs
       workshops     -> workshops       xp   -> xp
     Keep these achievable in a single sitting so the daily loop feels
     generous, not grindy. */
  var CHALLENGES = [
    { id: 'explorer',  icon: '🎮', title: 'Arcade Explorer', metric: 'distinctGames', goal: 3,   xp: 60, verb: 'Play 3 different games today' },
    { id: 'on-a-roll', icon: '🏁', title: 'On a Roll',       metric: 'runs',          goal: 5,   xp: 60, verb: 'Finish 5 game runs today' },
    { id: 'xp-rush',   icon: '⚡', title: 'XP Rush',         metric: 'xp',            goal: 150, xp: 75, verb: 'Earn 150 XP today' },
    { id: 'learner',   icon: '📚', title: 'Daily Learner',   metric: 'workshops',     goal: 1,   xp: 80, verb: 'Complete a workshop today' },
    { id: 'warm-up',   icon: '🌟', title: 'Warm Up',         metric: 'distinctGames', goal: 2,   xp: 50, verb: 'Play 2 different games today' },
    { id: 'marathon',  icon: '🔥', title: 'Marathon',        metric: 'runs',          goal: 8,   xp: 80, verb: 'Finish 8 game runs today' },
    { id: 'grind',     icon: '💎', title: 'Point Grind',     metric: 'xp',            goal: 250, xp: 90, verb: 'Earn 250 XP today' }
  ];

  var STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

  // Days since epoch in LOCAL time, so the challenge flips at local midnight
  // and every device shows the same one on a given calendar day.
  function dayNumber() {
    var n = new Date();
    return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000);
  }

  function profile() {
    try { return typeof playerProfile !== 'undefined' ? playerProfile : (window.playerProfile || null); }
    catch (e) { return window.playerProfile || null; }
  }

  function today() {
    var i = ((dayNumber() % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length;
    return CHALLENGES[i];
  }

  function currentFor(ch, act) {
    switch (ch.metric) {
      case 'distinctGames': return (act.games || []).length;
      case 'runs':          return act.runs || 0;
      case 'workshops':     return act.workshops || 0;
      case 'xp':            return act.xp || 0;
      default:              return 0;
    }
  }

  function progress() {
    var p = profile();
    var ch = today();
    if (!p) return { done: false, current: 0, goal: ch.goal, pct: 0, claimed: false, challenge: ch };
    var act = p.getDailyActivity();
    var current = currentFor(ch, act);
    var pct = Math.max(0, Math.min(100, Math.round((current / ch.goal) * 100)));
    return {
      done: current >= ch.goal,
      current: current,
      goal: ch.goal,
      pct: pct,
      claimed: act.claimed === ch.id,
      challenge: ch
    };
  }

  // Grants the bonus the moment the goal is met (and not yet claimed). Safe to
  // call repeatedly; the profile guards against double-awarding.
  function tryClaim() {
    var p = profile();
    if (!p) return false;
    var st = progress();
    if (st.done && !st.claimed) {
      return p.claimDailyChallenge(st.challenge.id, st.challenge.xp);
    }
    return false;
  }

  /* ── Streak context (the "loud" part) ── */
  function streakInfo() {
    var p = profile();
    if (!p) return { count: 0, active: false, atRisk: false, milestone: null };
    var count = p.state.dailyStreak || 0;
    var todayStr = new Date().toDateString();
    var last = p.state.lastPlayedDate ? new Date(p.state.lastPlayedDate).toDateString() : null;
    var earnedToday = last === todayStr;
    // At risk = you have a streak going, but you haven't earned anything today.
    // Lose it if the day ends with no activity.
    var atRisk = count > 0 && !earnedToday;
    var milestone = STREAK_MILESTONES.indexOf(count) !== -1 && earnedToday ? count : null;
    return { count: count, active: earnedToday, atRisk: atRisk, milestone: milestone };
  }

  /* ── Styles (injected once) ── */
  var stylesReady = false;
  function ensureStyles() {
    if (stylesReady || typeof document === 'undefined' || !document.head) return;
    stylesReady = true;
    var css =
      '.jvds-daily{--dc-rose:#BC4749;--dc-teal:#70A3A7;--dc-gold:#f5c842;' +
      'border-radius:20px;padding:20px 22px;margin:0 0 28px;' +
      'background:linear-gradient(150deg,#241a12 0%,#1a1410 55%,#101a1c 100%);' +
      'border:1px solid rgba(245,200,66,.18);box-shadow:0 12px 30px rgba(0,0,0,.28);' +
      'font-family:Inter,system-ui,sans-serif;color:#f0ead6;position:relative;overflow:hidden}' +
      '.jvds-daily::before{content:"";position:absolute;inset:0;pointer-events:none;' +
      'background:radial-gradient(ellipse at 100% 0%,rgba(245,200,66,.10),transparent 55%)}' +
      '.jvds-daily-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;position:relative}' +
      '.jvds-daily-eyebrow{font-size:.66rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--dc-teal)}' +
      '.jvds-streak{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:.9rem;' +
      'padding:6px 12px;border-radius:999px;background:rgba(245,200,66,.14);color:var(--dc-gold);white-space:nowrap}' +
      '.jvds-streak.risk{background:rgba(188,71,73,.22);color:#ffb3b4;animation:jvds-pulse 1.8s ease-in-out infinite}' +
      '@keyframes jvds-pulse{0%,100%{opacity:1}50%{opacity:.55}}' +
      '.jvds-daily-body{display:flex;align-items:center;gap:16px;position:relative}' +
      '.jvds-daily-icon{font-size:2.4rem;line-height:1;flex:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}' +
      '.jvds-daily-main{flex:1;min-width:0}' +
      '.jvds-daily-title{font-family:Fredoka,Fraunces,Inter,sans-serif;font-weight:700;font-size:1.15rem;margin:0 0 2px}' +
      '.jvds-daily-verb{font-size:.85rem;color:rgba(240,234,214,.62);margin:0 0 10px}' +
      '.jvds-daily-bar{height:10px;border-radius:8px;background:rgba(255,255,255,.10);overflow:hidden}' +
      '.jvds-daily-fill{height:100%;width:0;border-radius:8px;' +
      'background:linear-gradient(90deg,var(--dc-rose),var(--dc-gold));transition:width .5s cubic-bezier(.4,0,.2,1)}' +
      '.jvds-daily-meta{display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:10px}' +
      '.jvds-daily-count{font-size:.8rem;font-weight:700;color:rgba(240,234,214,.75)}' +
      '.jvds-daily-reward{font-size:.75rem;font-weight:800;color:var(--dc-gold)}' +
      '.jvds-daily.done{border-color:rgba(112,163,167,.5)}' +
      '.jvds-daily.done .jvds-daily-fill{background:linear-gradient(90deg,var(--dc-teal),#a7e0c8)}' +
      '.jvds-daily-done-pill{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:.8rem;' +
      'color:#0d0b08;background:linear-gradient(135deg,#a7e0c8,var(--dc-teal));padding:5px 12px;border-radius:999px}' +
      '.jvds-daily-risk-note{margin-top:12px;font-size:.78rem;font-weight:700;color:#ffb3b4;position:relative}' +
      '.jvds-daily-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(20px);' +
      'background:linear-gradient(135deg,var(--dc-gold),#e6a817);color:#2a1e05;padding:14px 24px;border-radius:14px;' +
      'font:800 .95rem/1.2 Fredoka,Inter,sans-serif;box-shadow:0 14px 34px rgba(0,0,0,.4);z-index:99999;' +
      'opacity:0;transition:opacity .35s,transform .35s}' +
      '.jvds-daily-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  function celebrate(msg) {
    if (typeof document === 'undefined' || !document.body) return;
    ensureStyles();
    var t = document.createElement('div');
    t.className = 'jvds-daily-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 400);
    }, 3400);
  }

  /* ── Widget ── */
  function widgetHTML() {
    var st = progress();
    var ch = st.challenge;
    var streak = streakInfo();

    var streakCls = 'jvds-streak' + (streak.atRisk ? ' risk' : '');
    // A brand-new player shouldn't be greeted by a sad "0-day streak".
    var streakLabel = !streak.count
      ? '✨ Start a streak today'
      : streak.atRisk
        ? '🔥 ' + streak.count + '-day streak at risk'
        : '🔥 ' + streak.count + '-day streak';

    var countLine = ch.metric === 'xp'
      ? st.current + ' / ' + st.goal + ' XP'
      : st.current + ' / ' + st.goal;

    var rightMeta = st.claimed
      ? '<span class="jvds-daily-done-pill">✓ +' + ch.xp + ' XP claimed</span>'
      : '<span class="jvds-daily-reward">Reward: +' + ch.xp + ' XP</span>';

    var riskNote = streak.atRisk
      ? '<div class="jvds-daily-risk-note">Do today’s challenge to keep your streak alive.</div>'
      : '';

    return '' +
      '<div class="jvds-daily-top">' +
        '<span class="jvds-daily-eyebrow">⭐ Daily Challenge</span>' +
        '<span class="' + streakCls + '">' + streakLabel + '</span>' +
      '</div>' +
      '<div class="jvds-daily-body">' +
        '<div class="jvds-daily-icon">' + ch.icon + '</div>' +
        '<div class="jvds-daily-main">' +
          '<p class="jvds-daily-title">' + ch.title + '</p>' +
          '<p class="jvds-daily-verb">' + ch.verb + '</p>' +
          '<div class="jvds-daily-bar"><div class="jvds-daily-fill" style="width:' + st.pct + '%"></div></div>' +
          '<div class="jvds-daily-meta">' +
            '<span class="jvds-daily-count">' + countLine + '</span>' +
            rightMeta +
          '</div>' +
        '</div>' +
      '</div>' +
      riskNote;
  }

  function paint(el) {
    if (!el) return;
    ensureStyles();
    var st = progress();
    el.className = 'jvds-daily' + (st.done ? ' done' : '');
    el.innerHTML = widgetHTML();
  }

  // Renders into #containerId (or an element), grants the bonus if earned,
  // and keeps itself live while the hub page is open.
  function render(target, opts) {
    opts = opts || {};
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;

    var claimed = tryClaim(); // may award if the player finished while on a game page
    paint(el);
    if (claimed) {
      celebrate('🎉 Daily Challenge done! +' + today().xp + ' XP');
    }

    // Streak milestone shout-out (once per page, only when earned today).
    var streak = streakInfo();
    if (streak.milestone && !render._shouted) {
      render._shouted = true;
      setTimeout(function () { celebrate('🔥 ' + streak.milestone + '-day streak!'); }, claimed ? 3800 : 300);
    }

    if (!render._wired) {
      render._wired = true;
      var repaint = function () {
        var again = tryClaim();
        // Repaint every mounted widget.
        (render._els || []).forEach(function (n) { if (n && n.isConnected) paint(n); });
        if (again) celebrate('🎉 Daily Challenge done! +' + today().xp + ' XP');
      };
      window.addEventListener('xp-gained', repaint);
      window.addEventListener('workshop-completed', repaint);
      window.addEventListener('profile-saved', repaint);
    }
    render._els = (render._els || []);
    if (render._els.indexOf(el) === -1) render._els.push(el);
  }

  window.DailyChallenge = {
    today: today,
    progress: progress,
    streakInfo: streakInfo,
    render: render
  };
})();
