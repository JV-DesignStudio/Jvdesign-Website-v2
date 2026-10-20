/**
 * related-items.js - shared "More to explore" component (A1644)
 *
 * Mount: add a div with id="jvds-related" and data attributes before </main>
 *
 *   <div id="jvds-related"
 *        data-type="workshop"      <!-- workshop | tool | game -->
 *        data-engine="Godot"       <!-- engine name, workshops only -->
 *        data-tags="2d platformer" <!-- space-separated tags -->
 *        data-current-url="/workshops/my-first-video-game.html"
 *        data-label="More Godot workshops">  <!-- optional heading override -->
 *   </div>
 *
 * Requires content-data.js to be loaded first (window.JVDS_CONTENT).
 */
(function () {
  'use strict';

  var mount = document.getElementById('jvds-related');
  if (!mount) return;

  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(function () {
    var data = window.JVDS_CONTENT;
    if (!data) return;

    var cfg = mount.dataset;
    var type       = cfg.type || 'workshop';
    var engine     = cfg.engine || '';
    var tags       = (cfg.tags || '').toLowerCase().split(/\s+/).filter(Boolean);
    var currentUrl = cfg.currentUrl || '';
    var label      = cfg.label || defaultLabel(type, engine);

    var pool = getPool(data, type);

    // Score each item: engine match = 3, each shared tag = 1, difficulty match = 0.5
    var scored = pool.map(function (item) {
      var url = item.url || '';
      if (currentUrl && normUrl(url) === normUrl(currentUrl)) return null;
      var score = 0;
      if (engine && item.engine && item.engine.toLowerCase() === engine.toLowerCase()) score += 3;
      (item.tags || []).forEach(function (t) {
        if (tags.indexOf(t.toLowerCase()) !== -1) score += 1;
      });
      if (score === 0 && engine && item.engine && item.engine.toLowerCase() === engine.toLowerCase()) score = 1;
      return score > 0 ? { item: item, score: score } : null;
    }).filter(Boolean);

    // Sort by score desc, then shuffle within same score tier for variety
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5;
    });

    var picks = scored.slice(0, 4).map(function (s) { return s.item; });
    if (picks.length === 0) { mount.hidden = true; return; }

    mount.innerHTML = buildHTML(label, picks, type);
    mount.removeAttribute('hidden');
  });

  function normUrl(u) { return u.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, ''); }

  function defaultLabel(type, engine) {
    if (type === 'workshop' && engine) return 'More ' + engine + ' workshops';
    if (type === 'workshop') return 'More workshops';
    if (type === 'tool') return 'Related tools';
    if (type === 'game') return 'More games';
    return 'More to explore';
  }

  function getPool(data, type) {
    if (type === 'workshop') return data.workshops || [];
    if (type === 'tool') return (data.tools || []).filter(function (t) { return !t.comingSoon; });
    if (type === 'game') return data.games || [];
    return (data.workshops || []).concat(data.tools || []).concat(data.games || []);
  }

  function typeLabel(item) {
    if (item.engine) return item.engine;
    if (item.category) return item.category;
    return '';
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildHTML(label, picks, type) {
    var cards = picks.map(function (item) {
      var url = item.url || '#';
      var sub = '';
      if (item.engine) sub += '<span class="ri-pill">' + esc(item.engine) + '</span>';
      if (item.difficulty) sub += '<span class="ri-pill">' + esc(item.difficulty) + '</span>';
      if (item.ageRange) sub += '<span class="ri-pill">' + esc(item.ageRange) + '</span>';
      if (!sub && item.category) sub += '<span class="ri-pill">' + esc(item.category) + '</span>';
      return '<a class="ri-card" href="' + esc(url) + '">' +
        '<div class="ri-title">' + esc(item.title) + '</div>' +
        (sub ? '<div class="ri-pills">' + sub + '</div>' : '') +
        '<div class="ri-desc">' + esc((item.desc || '').slice(0, 90)) + (item.desc && item.desc.length > 90 ? '...' : '') + '</div>' +
        '</a>';
    }).join('');

    return '<section class="ri-section" aria-labelledby="ri-heading">' +
      '<h2 class="ri-heading" id="ri-heading">' + esc(label) + '</h2>' +
      '<div class="ri-grid">' + cards + '</div>' +
      '<a class="ri-browse-link" href="/browse">Browse everything &rarr;</a>' +
      '</section>';
  }
})();
