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
