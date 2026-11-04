/* Resume last tool card (A2297).
   player-profile.js already writes jvds_last_activity on every tool page.
   This renders one resume card from that record so the hub can offer a
   one-click return plus a clear start-new route. No account, no network. */
(function () {
  var KEY = 'jvds_last_activity';

  function readLastTool() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var act = JSON.parse(raw);
      if (!act || act.type !== 'tool' || !act.url || !act.title) return null;
      return act;
    } catch (e) {
      return null;
    }
  }

  function init() {
    var cards = document.querySelectorAll('[data-resume-last]');
    if (!cards.length) return;
    var act = readLastTool();
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (!act) { card.hidden = true; continue; }
      var go = card.querySelector('[data-resume-go]');
      var name = card.querySelector('[data-resume-name]');
      if (go) go.href = act.url;
      if (name) name.textContent = act.title;
      card.hidden = false;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
