/* assets/js/engine-hub.js (A1540)
   Filters the engine hub cards. Progressive enhancement: with no JS every
   card stays visible and the buttons simply do nothing. */
(function () {
  var bar = document.getElementById('hubFilter');
  if (!bar) return;

  var buttons = bar.querySelectorAll('button[data-filter]');
  var cards = document.querySelectorAll('[data-hub-grid] .course-card');
  var sections = document.querySelectorAll('[data-hub-section]');
  var countEl = document.getElementById('hubFilterCount');
  var active = 'all';

  function visible(card) {
    if (active === 'install') return card.getAttribute('data-install') === 'false';
    if (active === 'level') return card.getAttribute('data-level') === 'beginner';
    return true;
  }

  function apply() {
    var shown = 0;
    for (var i = 0; i < cards.length; i++) {
      var ok = visible(cards[i]);
      cards[i].hidden = !ok;
      if (ok) shown++;
    }
    for (var j = 0; j < sections.length; j++) {
      sections[j].hidden = !sections[j].querySelector('.course-card:not([hidden])');
    }
    if (countEl) countEl.textContent = shown + (shown === 1 ? ' workshop shown' : ' workshops shown');
  }

  for (var k = 0; k < buttons.length; k++) {
    buttons[k].addEventListener('click', function () {
      active = this.getAttribute('data-filter');
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].setAttribute('aria-pressed', buttons[b] === this ? 'true' : 'false');
      }
      apply();
    });
  }

  apply();
})();
