// assets/js/ui-delegate.js (A1503/A1506/A1509/A1485): replaces site-wide inline
// handlers so they no longer need script-src 'unsafe-inline'.
(function () {
  if (window.__jvdsUiDelegateLoaded) return; // idempotent: safe to include more than once
  window.__jvdsUiDelegateLoaded = true;

  // Image fallback (was: onerror="this.onerror=null;this.src='...'")
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.getAttribute && t.getAttribute('data-fallback')) {
      var fb = t.getAttribute('data-fallback');
      t.removeAttribute('data-fallback');
      t.onerror = null;
      t.src = fb;
    }
  }, true);

  function resolve(path) {
    return path.split('.').reduce(function (o, k) { return o ? o[k] : undefined; }, window);
  }

  // Hover styles (was: onmouseover/onmouseout="this.style.x='y';..."). Declarations
  // are camelCase properties, so assign via el.style[name] directly.
  function applyDecls(el, str) {
    if (!str) return;
    str.split(';').forEach(function (d) {
      var i = d.indexOf(':');
      if (i < 0) return;
      var k = d.slice(0, i).trim();
      var val = d.slice(i + 1).trim();
      if (k) { try { el.style[k] = val; } catch (e) {} }
    });
  }
  document.addEventListener('mouseover', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-hover]') : null;
    if (el) applyDecls(el, el.getAttribute('data-hover'));
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-hover-out]') : null;
    if (el) applyDecls(el, el.getAttribute('data-hover-out'));
  });

  // Compile an argument spec into real values. Tokens are separated by "|":
  //   this  value  checked  event  true  false  <number>  s:<urlenc string>  c:<selector>
  function parseArgs(spec, el, ev) {
    if (spec === null) return null;
    if (!spec) return [];
    return spec.split('|').map(function (t) {
      if (t === 'this') return el;
      if (t === 'value') return el.value;
      if (t === 'checked') return el.checked;
      if (t === 'event') return ev;
      if (t === 'true') return true;
      if (t === 'false') return false;
      if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
      if (t.slice(0, 2) === 'c:') return el.closest(t.slice(2));
      if (t.slice(0, 2) === 's:') { try { return decodeURIComponent(t.slice(2)); } catch (e) { return t.slice(2); } }
      return undefined;
    });
  }

  function buildArgs(el, ev) {
    if (el.hasAttribute('data-on-args')) return parseArgs(el.getAttribute('data-on-args'), el, ev);
    if (el.hasAttribute('data-on-closest')) return [el.closest(el.getAttribute('data-on-closest'))];
    var arg = el.getAttribute('data-on-arg');
    var hasArg = arg !== null;
    if (hasArg) {
      if (el.hasAttribute('data-on-num')) arg = Number(arg);
      else if (el.hasAttribute('data-on-bool')) arg = arg === 'true';
    }
    var plain = el.hasAttribute('data-on-plain');
    return plain ? (hasArg ? [arg] : []) : (hasArg ? [el, arg] : [el]);
  }

  function callHandler(el, ev) {
    var name = el.getAttribute('data-on');
    if (!name) return;
    var parts = name.split('.');
    var recv = null, fn;
    if (parts.length > 1) { recv = resolve(parts.slice(0, -1).join('.')); fn = recv ? recv[parts[parts.length - 1]] : undefined; }
    else { fn = window[name]; }
    if (typeof fn !== 'function') return;
    try { fn.apply(recv, buildArgs(el, ev)); } catch (err) { /* surface via the page's own error handling */ }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var cookie = t.closest('[data-cookie-settings]');
    if (cookie) { e.preventDefault(); if (window.JVDSCookies && typeof window.JVDSCookies.reopen === 'function') window.JVDSCookies.reopen(); return; }

    var go = t.closest('[data-go]');
    if (go) { e.preventDefault(); location.href = go.getAttribute('data-go'); return; }

    var rm = t.closest('[data-remove-closest]');
    if (rm) { var target = rm.closest(rm.getAttribute('data-remove-closest')); if (target) target.remove(); return; }

    var hc = t.closest('[data-hide-closest]');
    if (hc) { var hid = hc.closest(hc.getAttribute('data-hide-closest')); if (hid) hid.style.display = 'none'; return; }

    var tcls = t.closest('[data-toggle-class]');
    if (tcls) { tcls.classList.toggle(tcls.getAttribute('data-toggle-class')); return; }

    var act = t.closest('[data-action]');
    if (act) { if (act.getAttribute('data-action') === 'print') window.print(); return; }

    var el = t.closest('[data-on]');
    if (!el) return;
    var bound = el.getAttribute('data-on-event');
    if (bound && bound !== 'click') return; // handled by the matching event listener
    callHandler(el, e);
  });

  // Non-click events (mostly form controls and drag handles).
  function runEvent(type) {
    return function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var el = t.closest('[data-on-event="' + type + '"]');
      if (el) callHandler(el, e);
    };
  }
  ['input', 'change', 'keydown', 'keyup', 'keypress', 'submit', 'touchstart', 'touchend', 'touchmove']
    .forEach(function (ev) { document.addEventListener(ev, runEvent(ev), false); });
  ['focus', 'blur'].forEach(function (ev) { document.addEventListener(ev, runEvent(ev), true); });
})();
