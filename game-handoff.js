/* game-handoff.js
 * Injects a next-game recommendation and daily challenge into any game page
 * that has an #endScreen overlay. Works offline, account-free, no PII.
 *
 * Daily challenge: seeded by today's date string - stable for the calendar day,
 * resets at midnight. No streak counter - every day is independent so a missed
 * day costs nothing.
 *
 * Config (optional, read from window.JVDS_HANDOFF before this script loads):
 *   { gameId, challengeLabel, challengeTarget(seed) -> number, scoreFn() -> number }
 *
 * CSS: minimal inline styles; honours prefers-color-scheme via CSS vars when available.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  // ── Daily-seed helper ─────────────────────────────────────────────────────
  // Returns a stable pseudo-random number in [0,1) for a given string key.
  function seedRand(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return (h >>> 0) / 0x100000000;
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // ── Next-game picker ──────────────────────────────────────────────────────
  // Picks one game from the registry that is not the current game, seeded by
  // today + current game so it is stable for the day per game.
  var FALLBACK_GAMES = [
    { id: 'rustfall',       title: 'Rustfall',                  file: 'rustfall.html' },
    { id: 'echo-flight',    title: "Echo's Swim",               file: 'echos-flight.html' },
    { id: 'nova-siege',     title: 'Nova Siege',                file: 'nova-siege.html' },
    { id: 'ember-smash',    title: 'Ember Smash: Brick Forge',  file: 'ember-smash.html' },
    { id: 'gem-match',      title: 'Gem Match',                 file: 'gem_match.html' },
    { id: 'highway-dodge',  title: 'Highway Dodge',             file: 'highway-dodge.html' },
    { id: 'sky-high-friends', title: 'Sky High With Friends',   file: 'sky_high_with_friends.html' },
    { id: 'critter-whack',  title: 'Critter Whack: Ranger Sort', file: 'critter-whack-page.html' },
    { id: 'crossy-crew',    title: 'Crossy Crew',               file: 'crossy-crew.html' },
    { id: 'stardust-snake', title: 'Stardust Snake',            file: 'stardust-snake.html' },
    { id: 'tower-defence',  title: 'Tower Defence',             file: 'tower-defence.html' },
    { id: 'arcane-citadel', title: 'Arcane Citadel',            file: 'arcane_citadel_page.html' },
  ];

  function pickNextGame(currentId) {
    var registry = FALLBACK_GAMES;
    try {
      var w = window;
      if (w.JVDS_GAMES && Array.isArray(w.JVDS_GAMES)) registry = w.JVDS_GAMES;
    } catch (e) {}
    var others = registry.filter(function (g) { return g.id !== currentId; });
    if (!others.length) return null;
    var idx = Math.floor(seedRand(todayKey() + ':' + (currentId || 'x')) * others.length);
    return others[idx] || others[0];
  }

  // ── Daily challenge ───────────────────────────────────────────────────────
  function getDailyTarget(cfg) {
    var seed = seedRand(todayKey() + ':' + (cfg.gameId || 'game') + ':challenge');
    return cfg.challengeTarget ? cfg.challengeTarget(seed) : null;
  }

  function getTodayBest(gameId) {
    try {
      var raw = localStorage.getItem('jvds_daily_' + gameId);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj.date === todayKey() ? obj.best : null;
    } catch (e) { return null; }
  }

  function saveTodayBest(gameId, score) {
    try {
      var cur = getTodayBest(gameId);
      if (cur !== null && cur >= score) return;
      localStorage.setItem('jvds_daily_' + gameId, JSON.stringify({ date: todayKey(), best: score }));
    } catch (e) {}
  }

  // ── Inject panel ─────────────────────────────────────────────────────────
  function injectPanel(endScreen, cfg) {
    if (endScreen.querySelector('.jvds-handoff')) return;

    var gameId = cfg.gameId || '';
    var nextGame = pickNextGame(gameId);
    var dailyTarget = getDailyTarget(cfg);
    var currentScore = cfg.scoreFn ? cfg.scoreFn() : null;

    if (currentScore !== null && gameId) saveTodayBest(gameId, currentScore);
    var todayBest = gameId ? getTodayBest(gameId) : null;

    var html = '<div class="jvds-handoff" role="region" aria-label="After this run">';

    // Daily challenge block
    if (dailyTarget !== null) {
      var met = currentScore !== null && currentScore >= dailyTarget;
      var bestStr = todayBest !== null ? '' + todayBest : '-';
      html += '<div class="jvds-hf-daily">';
      html += '<span class="jvds-hf-label">Today\'s challenge</span>';
      html += '<span class="jvds-hf-target">Beat ' + dailyTarget + ' ' + (cfg.challengeLabel || 'points') + '</span>';
      html += '<span class="jvds-hf-status' + (met ? ' jvds-hf-met' : '') + '">' + (met ? '✓ Done!' : 'Your best today: ' + bestStr) + '</span>';
      html += '</div>';
    }

    // Next-game recommendation
    if (nextGame) {
      var href = '/games/' + nextGame.file;
      html += '<div class="jvds-hf-next">';
      html += '<span class="jvds-hf-label">Try next</span>';
      html += '<a class="jvds-hf-link" href="' + href + '">' + nextGame.title + ' &rarr;</a>';
      html += '</div>';
    }

    html += '</div>';

    // Inject before the first button in endScreen, or at the end
    var firstBtn = endScreen.querySelector('button, a');
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    var panel = wrapper.firstElementChild;
    if (firstBtn) {
      endScreen.insertBefore(panel, firstBtn);
    } else {
      endScreen.appendChild(panel);
    }

    // Announce game-over to screen readers via the existing aria-live mechanism
    // or by focusing the end screen title.
    try {
      var title = endScreen.querySelector('h2, h1, [id$="Title"], [id$="title"]');
      if (title && !title.hasAttribute('tabindex')) {
        title.setAttribute('tabindex', '-1');
        // Small delay so the DOM is settled before focus moves.
        setTimeout(function () { try { title.focus(); } catch (e) {} }, 80);
      }
    } catch (e) {}
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('jvds-handoff-css')) return;
    var s = document.createElement('style');
    s.id = 'jvds-handoff-css';
    s.textContent = [
      '.jvds-handoff{display:flex;flex-direction:column;gap:8px;margin:12px 0 8px;padding:10px 14px;background:rgba(255,255,255,.06);border-radius:10px;border:1px solid rgba(255,255,255,.1);font-size:.82rem;text-align:left}',
      '.jvds-hf-daily,.jvds-hf-next{display:flex;flex-direction:column;gap:2px}',
      '.jvds-hf-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;opacity:.55}',
      '.jvds-hf-target{font-weight:700;color:var(--jv-text,#F0EAD6)}',
      '.jvds-hf-status{color:var(--jv-text-muted,#b0a990)}',
      '.jvds-hf-status.jvds-hf-met{color:#4ade80;font-weight:700}',
      '.jvds-hf-link{color:var(--jv-accent,#8CC7CB);text-decoration:none;font-weight:700}',
      '.jvds-hf-link:hover,.jvds-hf-link:focus{text-decoration:underline;outline:2px solid currentColor;outline-offset:2px}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Aria-live announcement for game-over ──────────────────────────────────
  function ensureAriaLive(endScreen) {
    if (!endScreen.hasAttribute('aria-live')) {
      endScreen.setAttribute('aria-live', 'polite');
      endScreen.setAttribute('aria-atomic', 'true');
    }
    if (!endScreen.hasAttribute('role')) {
      endScreen.setAttribute('role', 'dialog');
      endScreen.setAttribute('aria-modal', 'false');
    }
  }

  // ── Watch endScreen ───────────────────────────────────────────────────────
  function watchEndScreen(endScreen, cfg) {
    ensureAriaLive(endScreen);
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (!endScreen.classList.contains('hidden')) {
            injectPanel(endScreen, cfg);
          }
        }
      }
    });
    obs.observe(endScreen, { attributes: true });
    // Also handle if it's already visible on load
    if (!endScreen.classList.contains('hidden')) injectPanel(endScreen, cfg);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  // Config can come from window.JVDS_HANDOFF or from data-* attributes on the
  // script tag itself (CSP-safe; no inline script needed):
  //   <script src="../game-handoff.js"
  //           data-game-id="stardust-snake"
  //           data-challenge-label="stars"
  //           data-challenge-min="5"
  //           data-challenge-max="16"
  //           data-score-fn="__stardustSnake.score()"></script>
  function readDataCfg() {
    var el = document.currentScript ||
      document.querySelector('script[src*="game-handoff"]');
    if (!el) return {};
    var gameId = el.dataset.gameId || el.getAttribute('data-game-id') || '';
    var label  = el.dataset.challengeLabel || el.getAttribute('data-challenge-label') || 'points';
    var minV   = parseFloat(el.dataset.challengeMin || el.getAttribute('data-challenge-min') || '0') || 0;
    var maxV   = parseFloat(el.dataset.challengeMax || el.getAttribute('data-challenge-max') || '0') || 0;
    var scoreFnStr = el.dataset.scoreFn || el.getAttribute('data-score-fn') || '';
    var cfg = { gameId: gameId, challengeLabel: label };
    if (maxV > minV) {
      cfg.challengeTarget = function (s) { return Math.round(minV + s * (maxV - minV)); };
    }
    if (scoreFnStr) {
      cfg.scoreFn = function () {
        try { return Function('return window.' + scoreFnStr)(); } catch (e) { return 0; }
      };
    }
    return cfg;
  }

  function init() {
    var cfg = (typeof window !== 'undefined' && window.JVDS_HANDOFF) || readDataCfg();
    var endScreen = document.getElementById('endScreen');
    if (!endScreen) return;
    injectStyles();
    watchEndScreen(endScreen, cfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
