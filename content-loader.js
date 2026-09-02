/**
 * content-loader.js — Client-side content helpers for JVDesignStudio
 *
 * Requires: content-data.js (loaded before this script)
 *
 * Usage:
 *   JVDS.content.workshops({ engine: 'Godot', difficulty: 'beginner' })
 *   JVDS.content.games({ category: 'Puzzle' })
 *   JVDS.content.tools({ category: 'Art & Design' })
 *   JVDS.content.search('platformer')
 *   JVDS.content.stats()
 */
(function () {
  'use strict';

  window.JVDS = window.JVDS || {};

  var C = window.JVDS_CONTENT || {};

  /* ── Helpers ─────────────────────────────────────────── */

  function matches(item, filters) {
    if (!filters) return true;
    for (var key in filters) {
      if (!filters.hasOwnProperty(key)) continue;
      var val = filters[key];
      if (val === undefined || val === null || val === '') continue;
      if (Array.isArray(val)) {
        if (val.length === 0) continue;
        var itemVal = item[key];
        if (Array.isArray(itemVal)) {
          if (!val.some(function (v) { return itemVal.indexOf(v) !== -1; })) return false;
        } else {
          if (val.indexOf(itemVal) === -1) return false;
        }
      } else {
        if (String(item[key]).toLowerCase().indexOf(String(val).toLowerCase()) === -1) return false;
      }
    }
    return true;
  }

  function sortItems(items, sortBy) {
    if (!sortBy) return items;
    return items.slice().sort(function (a, b) {
      var av = a[sortBy] || '', bv = b[sortBy] || '';
      return String(av).localeCompare(String(bv));
    });
  }

  /* ── Public API ──────────────────────────────────────── */

  var api = {
    workshops: function (filters, sortBy) {
      var items = C.workshops || [];
      return sortItems(items.filter(function (w) { return matches(w, filters); }), sortBy);
    },

    games: function (filters, sortBy) {
      var items = C.games || [];
      return sortItems(items.filter(function (g) { return matches(g, filters); }), sortBy);
    },

    tools: function (filters, sortBy) {
      var items = C.tools || [];
      return sortItems(items.filter(function (t) { return matches(t, filters); }), sortBy);
    },

    books: function (filters, sortBy) {
      var items = C.books || [];
      return sortItems(items.filter(function (b) { return matches(b, filters); }), sortBy);
    },

    characters: function (filters) {
      var items = C.characters || [];
      return items.filter(function (c) { return matches(c, filters); });
    },

    paths: function (filters) {
      var items = C.paths || [];
      return items.filter(function (p) { return matches(p, filters); });
    },

    stats: function () {
      return C.stats || {};
    },

    engines: function () {
      var stats = C.stats || {};
      return Object.keys(stats.engines || {}).sort();
    },

    toolCategories: function () {
      var stats = C.stats || {};
      return Object.keys(stats.toolCategories || {}).sort();
    },

    search: function (query, filters) {
      if (!query || query.length < 2) return [];
      var q = query.toLowerCase();
      var results = [];

      var collections = [
        { type: 'workshop', items: C.workshops || [] },
        { type: 'game', items: C.games || [] },
        { type: 'tool', items: C.tools || [] },
        { type: 'book', items: C.books || [] }
      ];

      collections.forEach(function (col) {
        col.items.forEach(function (item) {
          var text = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.tags || []).join(' ')).toLowerCase();
          if (text.indexOf(q) !== -1) {
            if (matches(item, filters)) {
              results.push(Object.assign({}, item, { type: col.type }));
            }
          }
        });
      });

      return results.sort(function (a, b) {
        var aTitle = (a.title || '').toLowerCase().indexOf(q);
        var bTitle = (b.title || '').toLowerCase().indexOf(q);
        return aTitle - bTitle;
      });
    },

    /* Card rendering helpers */
    renderCard: function (item, type) {
      var a = document.createElement('a');
      a.className = 'content-card reveal';
      a.href = item.url || '#';

      var badge = '';
      if (type === 'workshop') badge = '<span class="content-card-badge" style="background:#478cbf;">Workshop</span>';
      else if (type === 'game') badge = '<span class="content-card-badge" style="background:#e94560;">Game</span>';
      else if (type === 'tool') badge = '<span class="content-card-badge" style="background:#7c3aed;">Tool</span>';
      else if (type === 'book') badge = '<span class="content-card-badge" style="background:#6b4fa0;">Book</span>';

      var tags = '';
      if (item.engine) tags += '<span class="content-card-tag">' + item.engine + '</span>';
      if (item.category) tags += '<span class="content-card-tag">' + item.category + '</span>';
      if (item.difficulty) tags += '<span class="content-card-tag">' + item.difficulty + '</span>';
      if (item.ageRange) tags += '<span class="content-card-tag">' + item.ageRange + '</span>';
      if (item.theme) tags += '<span class="content-card-tag">' + item.theme + '</span>';

      a.innerHTML =
        '<div class="content-card-header">' +
          badge +
          (item.emoji ? '<span class="content-card-emoji">' + item.emoji + '</span>' : '') +
        '</div>' +
        '<div class="content-card-body">' +
          '<h3 class="content-card-title">' + (item.title || '') + '</h3>' +
          '<p class="content-card-desc">' + (item.desc || '').substring(0, 120) + '</p>' +
          '<div class="content-card-tags">' + tags + '</div>' +
        '</div>';

      return a;
    }
  };

  JVDS.content = api;
})();
