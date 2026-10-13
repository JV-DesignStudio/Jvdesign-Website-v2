// assets/js/ui-delegate.js (A1503/A1506/A1509): replaces site-wide inline handlers
// so they no longer need script-src 'unsafe-inline'.
(function () {
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
    var name = el.getAttribute('data-on');
    var parts = name.split('.');
    var recv = null, fn;
    if (parts.length > 1) { recv = resolve(parts.slice(0, -1).join('.')); fn = recv ? recv[parts[parts.length - 1]] : undefined; }
    else { fn = window[name]; }
    if (typeof fn !== 'function') return;
    var arg = el.getAttribute('data-on-arg');
    var hasArg = arg !== null;
    if (hasArg && el.hasAttribute('data-on-num')) arg = Number(arg);
    var plain = el.hasAttribute('data-on-plain');
    var args = plain ? (hasArg ? [arg] : []) : (hasArg ? [el, arg] : [el]);
    try { fn.apply(recv, args); } catch (err) { /* surface via the page's own error handling */ }
  });
})();
