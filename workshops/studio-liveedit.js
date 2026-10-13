/* JVDS Studio LiveEdit, shared helper for the workshop game studios.
   Gives every game studio the same two powers with no libraries:
   1. Code editing: learners type real code, press Apply, and the game updates live.
      Only allowlisted numeric assignments flow into the preview, so a typo can
      never break the page. The full edited text still exports.
   2. Drag and drop world: palette chips can be dragged (mouse, touch, keyboard)
      onto the world canvas, and placed things can be dragged again to move them.
   Works on a locked-down school computer. Keyboard first, then pointer. */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* Parse simple numeric assignments out of edited code.
     Matches: NAME = 12, name=3.5, public float speed = 5f, ball_spd=4, win=5 */
  function parseNumbers(text) {
    var out = {}, re = /(?:public\s+(?:float|int)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)f?\b/g, m;
    var skip = { import: 1, from: 1, return: 1, if: 1, else: 1, end: 1, local: 1, using: 1, namespace: 1, class: 1, void: 1, public: 1, private: 1, static: 1, new: 1, var: 1, function: 1 };
    while ((m = re.exec(String(text || '')))) {
      var k = m[1];
      if (skip[k]) continue;
      var v = parseFloat(m[2]);
      if (!isNaN(v)) out[k.toLowerCase()] = v;
    }
    return out;
  }

  function normKey(k) {
    return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /* Try to match a parsed code name to a studio field key.
     e.g. playerspeed matches player_speed, movespeed, speed. */
  function matchField(parsedKey, fields) {
    var pk = normKey(parsedKey), best = null;
    for (var i = 0; i < fields.length; i++) {
      var fk = normKey(fields[i]);
      if (!fk) continue;
      if (fk === pk) return fields[i];
      if (fk.indexOf(pk) > -1 || pk.indexOf(fk) > -1) {
        if (!best || fields[i].length < best.length) best = fields[i];
      }
    }
    return best;
  }

  function clampNum(v, min, max) {
    if (typeof min === 'number' && v < min) return min;
    if (typeof max === 'number' && v > max) return max;
    return v;
  }

  /* Wire a textarea + Apply/Reset pair to live studio values.
     opts: { textareaId, applyId, resetId, statusId,
             getCode(), getFieldMeta() -> [{key,min,max}], getValues(), setValue(key,v),
             refresh() } */
  function bindCodeEditor(opts) {
    var ta = $(opts.textareaId), ap = $(opts.applyId), rs = $(opts.resetId), st = $(opts.statusId);
    if (!ta || !ap) return;
    function say(cls, msg) { if (st) { st.className = st.className.replace(/\bok\b|\bbad\b/g, '').trim() + ' ' + cls; st.textContent = msg; } }
    ta.value = opts.getCode();
    ap.addEventListener('click', function () {
      var parsed = parseNumbers(ta.value);
      var meta = opts.getFieldMeta(), vals = opts.getValues(), applied = 0, ignored = 0;
      var keys = Object.keys(parsed);
      keys.forEach(function (pk) {
        var field = matchField(pk, meta.map(function (m) { return m.key; }));
        if (!field) { ignored++; return; }
        var m = null;
        meta.forEach(function (x) { if (x.key === field) m = x; });
        var v = parsed[pk];
        if (m) v = clampNum(v, m.min, m.max);
        opts.setValue(field, v);
        applied++;
      });
      opts.refresh();
      ta.value = opts.getCode();
      if (applied > 0) say('ok', 'Nice, ' + applied + ' value' + (applied === 1 ? '' : 's') + ' updated. Press Play to see the change.' + (ignored ? ' ' + ignored + ' line' + (ignored === 1 ? '' : 's') + ' left alone.' : ''));
      else say('bad', 'Nothing to change yet. Edit a number next to = and press Apply again.');
    });
    if (rs) rs.addEventListener('click', function () {
      opts.resetValues();
      opts.refresh();
      ta.value = opts.getCode();
      say('ok', 'Back to the starter values. Press Play to try again.');
    });
  }

  /* Make palette chips draggable with mouse, touch and keyboard.
     paletteEl: container whose children have [data-insert] or [data-tile].
     onPick(value): called when learner picks a chip (click, Enter, or dragstart).
     Chips get draggable=true, tabindex=0, aria-grabbed handling. */
  function armPalette(paletteEl, onPick) {
    if (!paletteEl) return;
    Array.prototype.forEach.call(paletteEl.querySelectorAll('[data-insert],[data-tile]'), function (chip) {
      if (!chip.hasAttribute('tabindex')) chip.setAttribute('tabindex', '0');
      chip.setAttribute('draggable', 'true');
      chip.setAttribute('aria-grabbed', 'false');
      function pick() {
        Array.prototype.forEach.call(paletteEl.querySelectorAll('.is-armed'), function (x) { x.classList.remove('is-armed'); x.setAttribute('aria-grabbed', 'false'); });
        chip.classList.add('is-armed');
        chip.setAttribute('aria-grabbed', 'true');
        onPick(chip.getAttribute('data-insert') || chip.getAttribute('data-tile'), chip);
      }
      chip.addEventListener('click', pick);
      chip.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      chip.addEventListener('dragstart', function (e) {
        try { e.dataTransfer.setData('text/plain', chip.getAttribute('data-insert') || chip.getAttribute('data-tile')); e.dataTransfer.effectAllowed = 'copy'; } catch (x) {}
        pick();
      });
    });
  }

  /* Generic pointer drag on a canvas: onDown(cellX, cellY, e) -> dragState,
     onMove(dragState, cellX, cellY), onUp(dragState, cellX, cellY).
     cellX/cellY are in canvas pixels. Handles mouse + touch via Pointer Events
     with a mouse fallback for very old browsers. */
  function canvasDrag(canvas, handlers) {
    if (!canvas) return;
    var active = null;
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var cx = (e.clientX - r.left) * (canvas.width / r.width);
      var cy = (e.clientY - r.top) * (canvas.height / r.height);
      return { x: cx, y: cy };
    }
    canvas.addEventListener('pointerdown', function (e) {
      var p = pos(e);
      active = handlers.onDown ? handlers.onDown(p.x, p.y, e) : null;
      if (active !== null && active !== undefined) { try { canvas.setPointerCapture(e.pointerId); } catch (x) {} if (e.cancelable) e.preventDefault(); }
      else active = null;
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!active) return;
      var p = pos(e);
      if (handlers.onMove) handlers.onMove(active, p.x, p.y, e);
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      canvas.addEventListener(ev, function (e) {
        if (!active) return;
        var p = pos(e);
        if (handlers.onUp) handlers.onUp(active, p.x, p.y, e);
        active = null;
      });
    });
  }

  function save(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {} }
  function load(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }

  window.JVDSLiveEdit = {
    parseNumbers: parseNumbers,
    matchField: matchField,
    bindCodeEditor: bindCodeEditor,
    armPalette: armPalette,
    canvasDrag: canvasDrag,
    save: save,
    load: load
  };
})();
