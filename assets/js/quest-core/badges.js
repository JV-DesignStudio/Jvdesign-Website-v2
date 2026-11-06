/* Quest milestone badges (A2548)
   Local-only achievements: four milestone badges, a few cross-tool unlocks and
   one Reset control. Nothing leaves the device. Everything persists in
   localStorage under jvds_quest_badges_v1.

   Public API (window.QuestBadges):
     award(id)         mark a badge earned, returns true the first time
     has(id)           true when the badge is earned
     list()            every definition with earnedAt
     evaluate(signals) award from quest/export/code signals
     unlock(key)       persist a cross-tool unlock
     hasUnlock(key)    true when the unlock is available
     reset()           clear every quest badge and unlock
     render(el)        draw one panel (auto-mounts [data-quest-badges]) */
(function (global) {
  'use strict';

  var KEY = 'jvds_quest_badges_v1';

  var DEFS = [
    {
      id: 'physics-master',
      name: 'Physics Master',
      glyph: '\u25CF',
      desc: 'Finish a physics quest step.',
      unlock: 'palette-neon'
    },
    {
      id: '3d-architect',
      name: '3D Architect',
      glyph: '\u25B2',
      desc: 'Export a 3D model.',
      unlock: 'buildlab-parts'
    },
    {
      id: 'sprite-virtuoso',
      name: 'Sprite Virtuoso',
      glyph: '\u25C6',
      desc: 'Save or export a sprite.',
      unlock: 'pixel-palette-sunset'
    },
    {
      id: 'algorithm-ace',
      name: 'Algorithm Ace',
      glyph: '\u2605',
      desc: 'Pass a code challenge.',
      unlock: 'skin-circuit'
    }
  ];

  function empty() {
    return { badges: {}, unlocks: {} };
  }

  function read() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return empty();
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return empty();
      if (!data.badges || typeof data.badges !== 'object') data.badges = {};
      if (!data.unlocks || typeof data.unlocks !== 'object') data.unlocks = {};
      return data;
    } catch (e) {
      return empty();
    }
  }

  function write(data) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function defFor(id) {
    for (var i = 0; i < DEFS.length; i++) {
      if (DEFS[i].id === id) return DEFS[i];
    }
    return null;
  }

  function award(id) {
    var def = defFor(id);
    if (!def) return false;
    var data = read();
    if (data.badges[id]) return false;
    data.badges[id] = new Date().toISOString();
    if (def.unlock) data.unlocks[def.unlock] = data.badges[id];
    write(data);
    renderAll();
    return true;
  }

  function has(id) {
    return !!read().badges[id];
  }

  function list() {
    var data = read();
    return DEFS.map(function (def) {
      return {
        id: def.id,
        name: def.name,
        glyph: def.glyph,
        desc: def.desc,
        unlock: def.unlock,
        earnedAt: data.badges[def.id] || null
      };
    });
  }

  function evaluate(signals) {
    var s = signals && typeof signals === 'object' ? signals : {};
    var changed = [];
    if (s.physicsQuest || s.quest === 'physics-master') {
      if (award('physics-master')) changed.push('physics-master');
    }
    if (s.export3d) {
      if (award('3d-architect')) changed.push('3d-architect');
    }
    if (s.sprite) {
      if (award('sprite-virtuoso')) changed.push('sprite-virtuoso');
    }
    if (s.codePass) {
      if (award('algorithm-ace')) changed.push('algorithm-ace');
    }
    return changed;
  }

  function unlock(key) {
    var name = String(key == null ? '' : key).trim();
    if (!name) return false;
    var data = read();
    if (data.unlocks[name]) return false;
    data.unlocks[name] = new Date().toISOString();
    write(data);
    return true;
  }

  function hasUnlock(key) {
    return !!read().unlocks[String(key == null ? '' : key)];
  }

  function unlockMap() {
    var data = read();
    var out = {};
    for (var key in data.unlocks) {
      if (Object.prototype.hasOwnProperty.call(data.unlocks, key)) out[key] = data.unlocks[key];
    }
    return out;
  }

  function reset() {
    try {
      global.localStorage.removeItem(KEY);
    } catch (e) {}
    renderAll();
    return true;
  }

  function el(tag, className, text) {
    var node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render(container) {
    if (!container) return null;
    var data = read();
    container.innerHTML = '';

    var grid = el('div', 'ach-grid');
    DEFS.forEach(function (def) {
      var earned = !!data.badges[def.id];
      var card = el('div', 'ach-card ' + (earned ? 'unlocked' : 'locked'));
      card.setAttribute('data-badge-id', def.id);
      card.appendChild(el('div', 'ach-emoji', def.glyph));
      card.appendChild(el('div', 'ach-name', def.name));
      card.appendChild(el('div', 'ach-desc', def.desc));
      if (earned) card.appendChild(el('span', 'ach-check', '\u2713'));
      grid.appendChild(card);
    });
    container.appendChild(grid);

    var actions = el('div', 'quest-badges-actions');
    actions.style.marginTop = '12px';
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.alignItems = 'center';
    actions.style.flexWrap = 'wrap';

    var button = el('button', 'quest-badges-reset', 'Reset my badges');
    button.type = 'button';
    button.setAttribute('data-quest-badges-reset', '');
    button.style.cssText = 'font:inherit;font-weight:800;border-radius:8px;padding:8px 14px;cursor:pointer;background:transparent;color:var(--text-primary,#f0ead6);border:1.5px solid rgba(240,234,214,.28)';
    button.addEventListener('click', function () { reset(); });
    actions.appendChild(button);

    var note = el('span', 'quest-badges-note', 'Kept only in this browser. Reset clears quest badges, not workshop XP.');
    note.style.cssText = 'font-size:.78rem;color:var(--text-secondary,rgba(240,234,214,.65))';
    actions.appendChild(note);

    container.appendChild(actions);
    return container;
  }

  function renderAll() {
    if (!global.document) return;
    var nodes = global.document.querySelectorAll('[data-quest-badges]');
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  }

  global.QuestBadges = {
    KEY: KEY,
    DEFS: DEFS,
    award: award,
    has: has,
    list: list,
    evaluate: evaluate,
    unlock: unlock,
    hasUnlock: hasUnlock,
    unlocks: unlockMap,
    reset: reset,
    render: render,
    renderAll: renderAll
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', renderAll);
    } else {
      renderAll();
    }
    global.addEventListener('storage', function (e) {
      if (!e || e.key === KEY) renderAll();
    });
  }
})(typeof window !== 'undefined' ? window : this);
