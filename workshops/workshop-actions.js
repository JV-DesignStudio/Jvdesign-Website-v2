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
})();
