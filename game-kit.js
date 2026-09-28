/* JVDS Game Kit - one shared quality layer for arcade games.
 *
 * Include on a game page with:
 *   <script defer src="../game-kit.js"></script>
 *
 * Opt in by marking a mount element:
 *   <div data-game-kit
 *        data-kit-id="crypt-crawlers"
 *        data-kit-goal="Clear five rooms, then beat the Lich"
 *        data-kit-skill="Spatial awareness, risk and reward"
 *        data-kit-session="3-5 min"
 *        data-kit-build="../tools/level-designer.html"
 *        data-kit-build-label="Design a dungeon in Level Designer"
 *        data-kit-daily="120"            (optional daily target)
 *        data-kit-daily-label="earn £120 in one shift"></div>
 *
 * Then, from the game:
 *   JVDSGameKit.coach('Oven 2 is nearly ready');       // live coaching line
 *   var d = JVDSGameKit.daily(); d.report(coins);      // daily + streak
 *   JVDSGameKit.track(score);                          // GameSystem score hook
 *   JVDSGameKit.float('+£12', x, y); JVDSGameKit.shake(el);
 *
 * Every helper is a no-op when its mount/element is absent, so the kit never
 * breaks a game that has not adopted it yet.
 */
(function () {
  if (window.JVDSGameKit) return;
  var CSS_ID = 'jvds-kit-css';

  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var css = document.createElement('style');
    css.id = CSS_ID;
    css.textContent =
      '.jvds-kit-panel{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 16px}' +
      '.jvds-kit-card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:12px}' +
      '.jvds-kit-card b{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:#ffd166;margin-bottom:4px}' +
      '.jvds-kit-card span{font-size:.84rem;line-height:1.4;color:rgba(255,255,255,.88)}' +
      '.jvds-kit-card a{color:#7fe0ff;font-weight:800}' +
      '.jvds-kit-daily{margin:0 0 14px;font-size:.85rem;line-height:1.5;color:#ffe0b3}' +
      '.jvds-kit-daily .jvds-kit-streak{font-weight:800;color:#7be07b}' +
      '.jvds-kit-coach{background:rgba(127,224,255,.1);border:1px solid rgba(127,224,255,.32);border-radius:12px;padding:9px 11px;margin:8px 0;font-size:.86rem;line-height:1.4;color:#eaf6ff}' +
      '.jvds-kit-coach b{display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:#7fe0ff;margin-bottom:3px}' +
      '.jvds-float{position:fixed;z-index:2147483200;pointer-events:none;font:900 16px system-ui,sans-serif;color:#ffe066;text-shadow:0 2px 6px rgba(0,0,0,.5);transform:translate(-50%,-50%);animation:jvdsFloat .9s ease-out forwards}' +
      '@keyframes jvdsFloat{to{transform:translate(-50%,-160%);opacity:0}}' +
      '.jvds-shake{animation:jvdsShake .32s ease-in-out}' +
      '@keyframes jvdsShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}' +
      '@media(max-width:900px){.jvds-kit-panel{grid-template-columns:1fr 1fr}}' +
      '@media(max-width:560px){.jvds-kit-panel{grid-template-columns:1fr}}';
    (document.head || document.documentElement).appendChild(css);
  }

  // -- quality panel + daily mount -------------------------------
  function mount(host) {
    var d = host.dataset;
    if (!q('.jvds-kit-panel', host)) {
      var html = '<div class="jvds-kit-panel" aria-label="How this game works">' +
        card('Goal', d.kitGoal) + card('Skill', d.kitSkill) + card('Session', d.kitSession) +
        '<div class="jvds-kit-card"><b>Build next</b><span><a href="' + esc(d.kitBuild || '../tools/arcade-game-maker.html') + '">' +
        esc(d.kitBuildLabel || 'Build something related in the JVDS toolbox') + '</a></span></div></div>';
      host.insertAdjacentHTML('afterbegin', html);
    }
    if (d.kitDaily && !q('.jvds-kit-daily', host)) {
      host.insertAdjacentHTML('beforeend', '<div class="jvds-kit-daily" data-kit-daily-line></div>');
    }
    host.setAttribute('data-kit-mounted', '1');
  }
  function card(label, value) {
    return '<div class="jvds-kit-card"><b>' + esc(label) + '</b><span>' + esc(value || '') + '</span></div>';
  }

  function kitHost() { return q('[data-game-kit]'); }

  // -- live coach ------------------------------------------------
  function coachHost() {
    var el = q('[data-kit-coach]') || q('.jvds-kit-coach');
    if (el) return el;
    var host = kitHost();
    if (!host) return null;
    el = document.createElement('div');
    el.className = 'jvds-kit-coach';
    el.innerHTML = '<b>Coach</b><span></span>';
    host.insertAdjacentElement('afterend', el);
    return el;
  }
  function coach(text) {
    var el = coachHost();
    if (!el) return;
    var span = el.tagName === 'SPAN' ? el : q('span', el) || el;
    if ('textContent' in span) span.textContent = text;
  }

  // -- daily + streak --------------------------------------------
  function dayKey(prev) { var d = new Date(); if (prev) d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function daily() {
    var host = kitHost();
    var id = (host && host.dataset.kitId) || location.pathname.replace(/\W+/g, '-');
    var target = Number(host && host.dataset.kitDaily) || 0;
    var key = 'jvds_daily_' + id;
    var m; try { m = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { m = {}; }
    m.streak = m.streak || 0; m.last = m.last || '';
    function render() {
      var line = q('[data-kit-daily-line]');
      if (!line) return;
      var label = (host && host.dataset.kitDailyLabel) || ('score ' + target);
      var done = m.last === dayKey();
      line.innerHTML = '🔥 Daily: ' + esc(label) + '. Streak: <span class="jvds-kit-streak">' + m.streak + '</span> day' + (m.streak === 1 ? '' : 's') + (done ? ' · done today ✅' : '');
    }
    function report(value) {
      if (target && value < target) return false;
      if (m.last === dayKey()) return false;
      m.streak = (m.last === dayKey(true) ? m.streak : 0) + 1;
      m.last = dayKey();
      try { localStorage.setItem(key, JSON.stringify(m)); } catch (e) {}
      render();
      return true;
    }
    render();
    return { target: target, streak: m.streak, done: m.last === dayKey(), report: report, render: render };
  }

  // -- GameSystem hook -------------------------------------------
  function track(score, meta) {
    try {
      var host = kitHost();
      var id = (host && host.dataset.kitId) || window.GAME_ID || location.pathname.replace(/\W+/g, '-');
      var gs = window.__jvdsKitGS || (window.GameSystem ? new GameSystem(id, document.title.split('|')[0].trim(), (host && host.dataset.kitMascot) || 'echo') : null);
      window.__jvdsKitGS = gs;
      if (!gs) return null;
      if (typeof score === 'number') gs.addScore(score);
      if (gs.recordGamePlay) gs.recordGamePlay(Date.now());
      if (gs.saveState) gs.saveState(meta);
      return gs;
    } catch (e) { return null; }
  }

  // -- juice -----------------------------------------------------
  function float(text, x, y) {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var el = document.createElement('div');
      el.className = 'jvds-float';
      el.textContent = text;
      el.style.left = (x == null ? window.innerWidth / 2 : x) + 'px';
      el.style.top = (y == null ? window.innerHeight / 2 : y) + 'px';
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.remove(); }, 1000);
    } catch (e) {}
  }
  function shake(el) {
    try {
      if (!el) return;
      el.classList.remove('jvds-shake');
      void el.offsetWidth;
      el.classList.add('jvds-shake');
      setTimeout(function () { el.classList.remove('jvds-shake'); }, 400);
    } catch (e) {}
  }

  function boot() {
    injectCss();
    qa('[data-game-kit]').forEach(mount);
    daily();
  }

  window.JVDSGameKit = {
    mount: mount, coach: coach, daily: daily, track: track, float: float, shake: shake,
    enter: function () { if (window.JVDSGameShell) window.JVDSGameShell.enter(); },
    exit: function () { if (window.JVDSGameShell) window.JVDSGameShell.exit(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
