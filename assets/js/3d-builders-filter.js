/* 3d-builders-filter.js , search + type filter for pages/3d-builders.html (A1581).
 * External so it needs no CSP hash. Types are mapped by page slug so a new
 * builder only has to be added to TYPES here (unknown slugs fall back to Studio).
 */
(function () {
  'use strict';

  var grid = document.querySelector('.builders-grid');
  if (!grid) return;

  var TYPES = {
    'rocket-builder': 'space',
    'space-station-builder': 'space',
    'robot-builder': 'characters',
    'pirate-ship-builder': 'vehicles',
    'steampunk-airship-builder': 'vehicles',
    'race-car-builder': 'vehicles',
    'submarine-builder': 'vehicles',
    'castle-builder': 'building',
    'fairy-tale-builder': 'building',
    'phone-stand-builder': 'print3d',
    'tinkercad-mod-studio': 'print3d',
    'voxel-studio': 'studio',
    'world-builder-3d': 'studio',
    'blender-mod-studio': 'studio'
  };

  var cards = [].slice.call(grid.querySelectorAll('.bcard'));
  var q = document.getElementById('bf-q');
  var chips = [].slice.call(document.querySelectorAll('#bf-chips .bf-chip'));
  var count = document.getElementById('bf-count');
  var empty = document.getElementById('bf-empty');
  var type = 'all';

  // Tag each card with its type and a lowercased name, once.
  cards.forEach(function (card) {
    var href = card.getAttribute('href') || '';
    var slug = (href.split('/').pop() || '').replace(/\.html$/, '');
    var name = card.querySelector('.bcard-name');
    card.setAttribute('data-type', TYPES[slug] || 'studio');
    if (name) card.setAttribute('data-name', name.textContent.trim().toLowerCase());
  });

  function apply() {
    var term = (q && q.value ? q.value : '').trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (card) {
      var okType = type === 'all' || card.getAttribute('data-type') === type;
      var okTerm = !term || (card.getAttribute('data-name') || '').indexOf(term) > -1;
      var on = okType && okTerm;
      if (on) { card.removeAttribute('hidden'); shown++; } else { card.setAttribute('hidden', ''); }
    });
    if (count) {
      count.textContent = shown === cards.length ? '' : 'Showing ' + shown + ' of ' + cards.length + ' builders';
    }
    if (empty) empty.hidden = shown !== 0;
  }

  if (q) q.addEventListener('input', apply);

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      type = chip.getAttribute('data-type') || 'all';
      chips.forEach(function (other) {
        var on = other === chip;
        other.classList.toggle('is-on', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      apply();
    });
  });

  // Honour ?type= and ?q= so a link can deep-link to a filtered view.
  try {
    var params = new URLSearchParams(location.search);
    var wantType = params.get('type');
    var wantQ = params.get('q');
    if (wantType) {
      var match = chips.filter(function (c) { return c.getAttribute('data-type') === wantType; })[0];
      if (match) match.click();
    }
    if (wantQ && q) { q.value = wantQ; apply(); }
  } catch (e) { /* older browser without URLSearchParams, filter still works */ }

  apply();
})();
