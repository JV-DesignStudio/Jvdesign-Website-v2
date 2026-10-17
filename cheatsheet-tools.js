/* cheatsheet-tools.js - A1593
   Shared enhancements for the JVDS engine cheat sheets:
   - renders the pinned engine version from <meta name="engine-version">
   - adds a search box that filters the sheet cards
   - adds a Copy button to every code block
   Loaded as an external script so the pages keep a strict CSP. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var grid = document.querySelector('.sheet-grid');
    if (!grid) return;
    var wrap = document.querySelector('.sheet-wrap') || grid.parentNode;
    var hero = document.querySelector('.cheat-hero');

    // 1. Pinned engine version badge
    var meta = document.querySelector('meta[name="engine-version"]');
    if (meta && meta.content && hero && !hero.querySelector('.cheat-version')) {
      var badge = document.createElement('span');
      badge.className = 'cheat-version';
      badge.textContent = 'Pinned: ' + meta.content;
      var tag = hero.querySelector('.cheat-tag');
      if (tag && tag.parentNode) tag.parentNode.insertBefore(badge, tag.nextSibling);
      else hero.insertBefore(badge, hero.firstChild);
    }

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.sheet-card'));

    // 2. Search toolbar
    var bar = document.createElement('div');
    bar.className = 'cheat-toolbar no-print';
    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'cheat-search';
    input.setAttribute('aria-label', 'Search this cheat sheet');
    input.placeholder = 'Search this sheet';
    var count = document.createElement('span');
    count.className = 'cheat-count';
    var note = document.createElement('span');
    note.className = 'cheat-note';
    note.textContent = 'Use the Copy button on any card.';
    bar.appendChild(input);
    bar.appendChild(count);
    bar.appendChild(note);
    if (wrap && wrap.insertBefore) wrap.insertBefore(bar, grid);

    function apply() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        var hit = !q || c.textContent.toLowerCase().indexOf(q) >= 0;
        c.hidden = !hit;
        if (hit) shown++;
      });
      count.textContent = shown + ' / ' + cards.length + ' cards';
    }
    input.addEventListener('input', apply);
    apply();

    function copyFallback(text, done) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        done();
      } catch (e) { /* clipboard unavailable */ }
    }

    // 3. Copy button per code block
    cards.forEach(function (card) {
      var pre = card.querySelector('pre');
      var h2 = card.querySelector('h2');
      if (!pre || !h2 || h2.querySelector('.cheat-copy')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cheat-copy no-print';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy the ' + (h2.textContent || 'code').trim() + ' code');
      btn.addEventListener('click', function () {
        var text = pre.innerText;
        var done = function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () { copyFallback(text, done); });
        } else {
          copyFallback(text, done);
        }
      });
      h2.appendChild(btn);
    });
  });
})();
