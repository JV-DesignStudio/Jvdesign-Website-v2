/* assets/js/game-onboarding.js
 *
 * First-screen goal + controls and a post-run Echo tip for every catalogued
 * arcade game. Reads the game's own registry entry (games-registry.js) so the
 * copy stays in one place.
 *
 *   - a small, dismissible card shows Goal, Controls and what the learner is
 *     practising before play. It stays until the run starts (or Hide).
 *   - after a run, Echo shows one concrete improvement tip.
 *
 * School-computer bar: no tutorial wall, no account, no install. The card is a
 * non-blocking corner note, not a modal.
 */
(function () {
  'use strict';
  if (window.JVDSOnboarding) return;
  if (window.top !== window.self) return;

  var TIPS = {
    rustfall: 'Bank scrap before a risky push, then spend it on one upgrade you will really use.',
    'echo-flight': 'Glide instead of flapping hard: small taps hold your line through the next gate.',
    'nova-siege': 'Save credits for one strong upgrade rather than spreading them across many small ones.',
    'arcane-citadel': 'Reposition before the wave lands and hold the choke point, not the open middle.',
    'tower-defence': 'Place a defender where two lanes meet so one tower covers both paths.',
    'ember-smash': 'Aim for the highest brick first; the bounce clears the ones below.',
    'gem-match': 'Look for a match that sets up a second one before the timer runs low.',
    'highway-dodge': 'Read the next two lanes and move once, early, instead of twice late.',
    'cozy-cafe-match': 'Name the tiles you have seen so the matching pair is easier to recall.',
    'biscuit-clicker': 'Buy the upgrade that raises your rate before the one that only adds a tap.',
    'sky-high-friends': 'Steer with small corrections; big drags cost you height.',
    'critter-whack': 'Read the habitat clue first, then sort. Speed follows the rule.',
    'crossy-crew': 'Plan the next two hops, not only the one in front of you.',
    'stardust-snake': 'Leave yourself an exit lane before you turn for the next star.'
  };

  var END_SELECTORS = [
    '#endScreen', '#endTitle', '#gameover', '#overModal', '#screen-gameover',
    '#screen-dead', '#death-overlay', '#win-overlay', '#ending-overlay',
    '#defeat-overlay', '#shiftResult', '#gameOverScreen', '.arcade-gameover'
  ];

  function registry() { return window.JVDS_GAMES || []; }

  function currentGame() {
    var base = (location.pathname.split('/').pop() || '').toLowerCase();
    var list = registry();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].file || '').toLowerCase() === base) return list[i];
    }
    return null;
  }

  function tipFor(game) {
    if (TIPS[game.id]) return TIPS[game.id];
    var first = String(game.learning || '').split('·')[0].trim();
    return first ? 'Next run, focus on ' + first.toLowerCase() + '.' : 'Next run, try one small change and see what improves.';
  }

  function linkStyles() {
    if (document.querySelector('link[data-jvds-onboard-css]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '../assets/css/game-onboarding.css';
    l.setAttribute('data-jvds-onboard-css', '1');
    (document.head || document.documentElement).appendChild(l);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function makeCard(id, heading, lines) {
    var card = el('div', id === 'jvds-onboard' ? 'jvds-onboard' : 'jvds-echo');
    card.id = id;
    card.setAttribute('role', id === 'jvds-onboard' ? 'note' : 'status');
    card.setAttribute('aria-live', id === 'jvds-onboard' ? 'off' : 'polite');
    var h = el('h2', null, heading);
    card.appendChild(h);
    lines.forEach(function (pair) {
      var p = el('p');
      p.appendChild(el('b', null, pair[0] + ' '));
      p.appendChild(document.createTextNode(pair[1]));
      card.appendChild(p);
    });
    var hide = el('button', 'jvds-hide', 'Hide');
    hide.type = 'button';
    hide.setAttribute('aria-label', 'Hide this note');
    card.appendChild(hide);
    return card;
  }

  var game = currentGame();
  if (!game) return;

  linkStyles();

  var guide = game.character || 'JVDS Arcade';
  var onboard = makeCard('jvds-onboard', guide + "'s how to play", [
    ['Goal:', game.objective || 'Play the game and beat your best.'],
    ['Controls:', game.controls || 'Follow the on-screen prompts.'],
    ['Practising:', game.learning || 'New skills.']
  ]);
  document.body.appendChild(onboard);

  var tipCard = makeCard('jvds-echo-tip', 'Echo says', [
    ['Next run:', tipFor(game)]
  ]);
  tipCard.hidden = true;
  document.body.appendChild(tipCard);

  var tipShown = false;
  var runActive = false;

  function hideOnboard() {
    onboard.hidden = true;
    try { sessionStorage.setItem('jvds_onboard_' + game.id, '1'); } catch (e) {}
  }
  function showTip() {
    if (tipShown || !runActive) return;
    tipShown = true;
    tipCard.hidden = false;
  }
  function startRun() {
    runActive = true;
    tipShown = false;
    tipCard.hidden = true;
    if (!navigator.webdriver) hideOnboard();
  }

  onboard.querySelector('.jvds-hide').addEventListener('click', hideOnboard);
  tipCard.querySelector('.jvds-hide').addEventListener('click', function () { tipCard.hidden = true; });

  try {
    if (sessionStorage.getItem('jvds_onboard_' + game.id) === '1') onboard.hidden = true;
  } catch (e) {}

  // A run starts when the player uses a start control. The test harness drives
  // clicks too, so startRun is safe to call more than once.
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b = t.closest('[data-jvds-play],#startBtn,#btnStart,#startGame,#start,#playBtn,#modalPrimary,.rune-btn,.btn-play,.pz-play');
    if (b) startRun();
  }, true);
  document.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && !runActive) startRun();
  }, true);

  // Primary trigger: the shared engine records each run exactly once.
  function wrapGameSystem() {
    var G = window.GameSystem;
    if (!G || !G.prototype || G.prototype.__jvdsOnboardWrapped) return !!G;
    var orig = G.prototype.recordGamePlay;
    if (typeof orig === 'function') {
      G.prototype.recordGamePlay = function () {
        var recorded = orig.apply(this, arguments);
        if (recorded) { runActive = true; showTip(); }
        return recorded;
      };
      G.prototype.__jvdsOnboardWrapped = true;
    }
    return true;
  }
  if (!wrapGameSystem()) {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (wrapGameSystem() || tries > 20) clearInterval(timer);
    }, 100);
  }

  // Fallback: watch for a run-end overlay becoming visible.
  if (window.MutationObserver) {
    function endVisible() {
      for (var i = 0; i < END_SELECTORS.length; i++) {
        var nodes = document.querySelectorAll(END_SELECTORS[i]);
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (n.hidden) continue;
          var s = getComputedStyle(n);
          if (s.display === 'none' || s.visibility === 'hidden') continue;
          var r = n.getBoundingClientRect();
          if (r.width > 1 && r.height > 1) return true;
        }
      }
      return false;
    }
    var queued = false;
    var obs = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        if (endVisible()) { runActive = true; showTip(); }
      }, 250);
    });
    obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  }

  window.JVDSOnboarding = {
    game: game,
    showTip: function () { runActive = true; showTip(); },
    hide: hideOnboard
  };
})();
