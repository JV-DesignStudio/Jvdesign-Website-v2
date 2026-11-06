/* Prefill the game title and genre from the maker's Publish button. */
(function () {
  'use strict';
  function param(name) {
    try { return new URLSearchParams(location.search).get(name); }
    catch (e) { return null; }
  }
  var t = param('title'), g = param('genre');
  var titleEl = document.getElementById('pubTitle');
  var genreEl = document.getElementById('pubGenre');
  if (t && titleEl) titleEl.value = t;
  if (g && genreEl) genreEl.value = g;
})();

/* A2640: a parent or guardian must agree before an under-13 submission is sent. */
(function () {
  'use strict';
  var form = document.getElementById('publishForm');
  if (!form) return;
  var block = document.getElementById('guardianBlock');
  var guardianName = document.getElementById('guardianName');
  var guardianConsent = document.getElementById('guardianConsent');
  var radios = Array.prototype.slice.call(form.querySelectorAll('input[name="age"]'));
  if (!block || !radios.length) return;

  function isUnder13() {
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked && radios[i].value === 'under13') return true;
    }
    return false;
  }

  function sync() {
    var under = isUnder13();
    block.hidden = !under;
    if (guardianName) guardianName.required = under;
    if (guardianConsent) {
      guardianConsent.required = under;
      if (!under) guardianConsent.checked = false;
    }
  }

  radios.forEach(function (radio) { radio.addEventListener('change', sync); });

  form.addEventListener('submit', function (event) {
    sync();
    if (isUnder13() && guardianConsent && !guardianConsent.checked) {
      event.preventDefault();
      guardianConsent.focus();
    }
  });

  sync();
})();
