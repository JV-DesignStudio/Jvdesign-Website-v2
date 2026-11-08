/* echo-feedback.js - Echo's one next step on the creator tools (A2803).
 *
 * The Improve beat of the loop should not stop at Pixel Studio. This module
 * reads the save each tool already makes and returns one short, specific,
 * kind line: something the learner can actually change next.
 *
 * Loaded by creation-share.js on tool pages. creation-keepsake.js shows the
 * line in the finish strip. Everything stays on the device; nothing is sent.
 *
 * API: window.EchoFeedback = { line(tool), has(tool) }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.EchoFeedback) return;

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function json(key, fallback) {
    var raw = read(key);
    if (raw == null) return fallback;
    try { var v = JSON.parse(raw); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function arr(key) {
    var v = json(key, []);
    return Array.isArray(v) ? v.filter(Boolean) : [];
  }

  var LINES = {
    'colour-palette': function () {
      var cur = json('jvds_palette_current', null);
      var cols = cur && Array.isArray(cur.cols) ? cur.cols.filter(Boolean) : [];
      if (!cols.length) return 'Echo: pick one main colour, then add a lighter tint and a darker shade.';
      if (cols.length < 3) return 'Echo: add one lighter tint and one darker shade so your palette has depth.';
      if (cols.length > 10) return 'Echo: try a tighter palette. Fewer colours often look more together.';
      return 'Echo: choose one colour as the accent, and use it only once or twice.';
    },
    'level-designer': function () {
      var slots = arr('jvds_level_slots_v2');
      if (!slots.length) return 'Echo: build one clear path first, then add a second route.';
      return 'Echo: put one reward at the end of the path so players know where to go.';
    },
    'story-editor': function () {
      var slots = arr('jvds_story_slots');
      if (slots.length < 2) return 'Echo: write the next scene so your character has a problem to solve.';
      return 'Echo: read the last line out loud. If it is hard to say, make it shorter.';
    },
    'sound-studio': function () {
      var auto = json('jvds_sound_auto', null);
      if (!auto) return 'Echo: lay down one four-beat drum loop, then add a melody on top.';
      return 'Echo: copy the chorus once and change one note so it feels different.';
    },
    'trading-card-designer': function () {
      var lib = arr('jvds_trading_card_library');
      if (!lib.length) return 'Echo: make one card, then a second card that beats it.';
      return 'Echo: check the card reads at a glance: one big title and one clear picture.';
    },
    'bitmap-font-maker': function () {
      var font = json('jvds_bitmapfont', null);
      if (!font) return 'Echo: make the capital letters first, then reuse their shapes for lowercase.';
      return 'Echo: put two letters side by side. If the spacing is uneven, nudge one across.';
    },
    'sprite-animator': function () {
      var project = json('jvds_sprite_anim', null);
      if (!project) return 'Echo: add a second frame that moves one limb by a single pixel.';
      return 'Echo: preview it small. If it reads at that size, you do not need more detail.';
    },
    'gdd-builder': function () {
      var gdd = json('jvds_gdd', null);
      if (!gdd) return 'Echo: fill in the core loop first: what does the player do, and why?';
      return 'Echo: pick one idea to cut. A smaller game is easier to finish.';
    },
    'game-idea-generator': function () {
      var history = arr('jvds_gameidea_history');
      if (!history.length) return 'Echo: save one idea, then write the first 30 seconds of play.';
      return 'Echo: take one idea and describe the very first thing the player does.';
    },
    'particle-designer': function () {
      var saves = arr('jvds_pd_saves_v1');
      if (!saves.length) return 'Echo: make one burst, then change its colour for a second effect.';
      return 'Echo: try fewer particles. Small effects often read better in a game.';
    },
    'icon-generator': function () {
      var icon = json('jvds_icon_gen', null);
      if (!icon) return 'Echo: start with one strong shape, then add one colour.';
      return 'Echo: shrink it to 32px. If it still reads, it will work as a real icon.';
    },
    'game-logo-maker': function () {
      var logo = json('jvds_gamelogo_saved', null);
      if (!logo) return 'Echo: make the title big and readable before you add effects.';
      return 'Echo: check the logo at small size. If the title blurs, simplify the background.';
    },
    'screenshot-generator': function () {
      var shot = json('jvds_screenshot', null);
      if (!shot) return 'Echo: pick your best moment of play, then add a short caption.';
      return 'Echo: add one line of text that tells the player what is happening.';
    },
    'store-page-builder': function () {
      var page = json('jvds_store_page', null);
      if (!page) return 'Echo: write one sentence that says what the player does.';
      return 'Echo: put the most exciting picture first, then the description.';
    },
    'buildlab': function () {
      var saves = arr('jvds_builder_saves');
      if (!saves.length) return 'Echo: build one block, then a second that supports it.';
      return 'Echo: add one detail that shows scale, like a door or a step.';
    }
  };

  var FALLBACK = 'Echo: try one small change, then save a new version.';

  window.EchoFeedback = {
    has: function (tool) { return !!(LINES[tool]); },
    line: function (tool) {
      try {
        var fn = LINES[tool];
        var text = fn ? fn() : FALLBACK;
        return text || FALLBACK;
      } catch (e) {
        return FALLBACK;
      }
    }
  };
})();
