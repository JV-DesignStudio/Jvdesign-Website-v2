(function(){
  var TYPE_LABEL = { workshop: 'Workshop', tool: 'Tool', game: 'Game' };
  function init() {
    try {
      var raw = localStorage.getItem('jvds_last_activity');
      if (!raw) return;
      var act = JSON.parse(raw);
      if (!act || !act.url || !act.title) return;
      var card = document.getElementById('continue-card');
      var link = document.getElementById('continue-card-link');
      var titleEl = document.getElementById('continue-card-title');
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
      card.removeAttribute('hidden');
    } catch (e) { /* storage blocked or malformed */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
