/* workshops/workshop-actions.js
 *
 * Shared delegated click handler for [data-action] controls used across the
 * workshop pages. It replaces the old inline onclick handlers so the site can
 * run without script-src 'unsafe-inline'. Each workshop page loads this file
 * last, after its own inline scripts, so the target functions are already
 * defined when a learner clicks.
 *
 * A click on (or inside) an element with data-action="name" calls name(...)
 * from window. Arguments come from data-arg, data-arg2 ... data-arg5:
 *   - the token "this" passes the element itself
 *   - "true" / "false" pass booleans
 *   - a numeric value passes a number
 *   - anything else passes the string as written
 *
 * A few DOM actions are built in:
 *   print          window.print() (skipped if ui-delegate already handles it)
 *   removeClosest  remove the nearest ancestor matching data-arg
 *   removeId       remove the element with the id in data-arg
 *
 * Step builders keep some actions on the step object (for example
 * data-action="onRun" data-arg="19" calls STEPS[19].onRun()), so if there is no
 * matching global function the step method is used instead.
 */
(function () {
  'use strict';
  if (window.__jvdsWorkshopActions) return;
  window.__jvdsWorkshopActions = true;

  function argValue(raw, el) {
    if (raw === 'this') return el;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
    return raw;
  }

  function collectArgs(el) {
    var args = [];
    for (var i = 1; i <= 5; i++) {
      var attr = i === 1 ? 'data-arg' : 'data-arg' + i;
      if (el.hasAttribute(attr)) args.push(argValue(el.getAttribute(attr), el));
    }
    return args;
  }

  function handleClick(el, ev) {
    var name = el.getAttribute('data-action');
    if (!name) return;

    if (name === 'print') {
      if (!window.__jvdsUiDelegateLoaded) { try { window.print(); } catch (e) {} }
      return;
    }
    if (name === 'removeClosest') {
      var sel = el.getAttribute('data-arg');
      var target = sel ? el.closest(sel) : null;
      if (target) target.remove();
      return;
    }
    if (name === 'removeId') {
      var idEl = document.getElementById(el.getAttribute('data-arg'));
      if (idEl) idEl.remove();
      return;
    }

    var args = collectArgs(el);
    var fn = window[name];
    if (typeof fn === 'function') { fn.apply(el, args); return; }

    // Step builders keep some actions on the step object: STEPS[i].onRun().
    // Top-level const/let are visible to later classic scripts, so STEPS can be
    // referenced here even though it is not a window property.
    try {
      if (typeof STEPS !== 'undefined' && STEPS) {
        var step = STEPS[Number(el.getAttribute('data-arg'))];
        if (step && typeof step[name] === 'function') step[name].apply(step, args);
      }
    } catch (e) { /* no step collection on this page */ }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest('[data-action]');
    if (!el) return;
    if (el.hasAttribute('data-stop')) e.stopPropagation();
    if (el.hasAttribute('data-prevent')) e.preventDefault();
    handleClick(el, e);
  }, false);

  // Form controls inside builders. These replace the old inline oninput /
  // onchange handlers that referenced page-local state, so they are resolved
  // the same way as data-action: a named function on window, called with the
  // element as `this` (some helpers still read data-arg from `this`).
  function formatParam(v, fmt) {
    if (!fmt) return String(v);
    var m;
    if ((m = /^f(\d+)(.*)$/.exec(fmt))) return Number(v).toFixed(Number(m[1])) + m[2];
    if ((m = /^int(.*)$/.exec(fmt))) return String(Math.round(Number(v))) + m[1];
    if ((m = /^raw(.*)$/.exec(fmt))) return String(v) + m[1];
    return String(v) + fmt;
  }

  function resolvePath(path) {
    var parts = String(path || '').split('.');
    var obj = window[parts[0]];
    if (obj == null) return null;
    for (var i = 1; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (obj == null) return null;
    }
    return { parent: obj, key: parts[parts.length - 1] };
  }

  // data-param="P.wallHeight" data-parse="float" data-divisor="10"
  // data-display="whVal" data-fmt="f1m" data-rebuild="buildCastle"
  function applyParam(el) {
    var target = resolvePath(el.getAttribute('data-param'));
    if (!target) return false;
    var parse = el.getAttribute('data-parse') || (el.type === 'checkbox' ? 'checked' : 'raw');
    var val;
    if (parse === 'checked') {
      val = el.checked;
      if (el.hasAttribute('data-checked-true')) {
        val = el.checked ? parseFloat(el.getAttribute('data-checked-true'))
                         : parseFloat(el.getAttribute('data-checked-false') || '0');
      }
    } else if (parse === 'float') val = parseFloat(el.value);
    else if (parse === 'int') val = parseInt(el.value, 10);
    else val = el.value;

    var divisor = parseFloat(el.getAttribute('data-divisor'));
    if (isFinite(divisor) && divisor) val = val / divisor;

    target.parent[target.key] = val;

    var display = el.getAttribute('data-display');
    if (display && display !== 'next') {
      var dEl = document.getElementById(display);
      if (dEl) dEl.textContent = formatParam(val, el.getAttribute('data-fmt'));
    }

    var rebuild = el.getAttribute('data-rebuild');
    if (rebuild) {
      var fn = window[rebuild];
      if (typeof fn === 'function') fn();
    }
    return true;
  }

  function handleFormEvent(el, kind) {
    if (el.hasAttribute('data-param')) {
      var type = (el.type || '').toLowerCase();
      // input fires continuously for range/colour; change is the settle event.
      if (kind === 'input' && (type === 'checkbox' || type === 'radio' || el.tagName === 'SELECT')) return;
      if (kind === 'change' && (type === 'range' || type === 'color' || type === 'number')) return;
      applyParam(el);
      return;
    }
    var attr = kind === 'input' ? 'data-action-input' : 'data-action-change';
    var name = el.getAttribute(attr);
    if (!name) return;
    var fn = window[name];
    if (typeof fn !== 'function') return;
    var first = kind === 'input' ? el.value : el.checked;
    fn.apply(el, [first, el].concat(collectArgs(el)));
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest('[data-param],[data-action-input]');
    if (el) handleFormEvent(el, 'input');
  }, false);

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest('[data-param],[data-action-change]');
    if (el) handleFormEvent(el, 'change');
  }, false);
})();
