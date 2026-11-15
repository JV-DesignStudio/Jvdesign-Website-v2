(function(){
  var TYPE_LABEL = { workshop: 'Workshop', tool: 'Tool', game: 'Game' };
  var NEXT_STEP = {
    workshop: { label: 'Next step: practise in a tool', url: '/create' },
    tool: { label: 'Next step: learn the skill', url: '/workshop' },
    game: { label: 'Next step: make your own game', url: '/tools/arcade-game-maker.html' }
  };
  function init() {
    var start = document.getElementById('hero-next-start');
    try {
      var raw = localStorage.getItem('jvds_last_activity');
      if (!raw) return;
      var act = JSON.parse(raw);
      if (!act || !act.url || !act.title) return;
      var card = document.getElementById('continue-card');
      var link = document.getElementById('continue-card-link');
      var titleEl = document.getElementById('continue-card-title');
      var next = document.getElementById('continue-card-next');
      if (!card || !link || !titleEl) return;
      link.href = act.url;
      titleEl.textContent = act.title;
      var typeLabel = TYPE_LABEL[act.type] || '';
      if (typeLabel) {
        var span = document.createElement('span');
        span.className = 'continue-card__type';
        span.textContent = ' (' + typeLabel + ')';
        titleEl.appendChild(span);
      }
      var step = NEXT_STEP[act.type];
      if (step && next) {
        next.href = step.url;
        next.textContent = step.label;
      }
      card.removeAttribute('hidden');
      if (start) start.hidden = true;
    } catch (e) { /* storage blocked or malformed */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
