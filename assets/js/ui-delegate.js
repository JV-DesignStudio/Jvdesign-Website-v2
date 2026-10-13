// assets/js/ui-delegate.js (A1503): replaces a few site-wide inline handlers so
// they no longer need script-src 'unsafe-inline'.
//   1. img[data-fallback]  -> swap to the fallback image on load error
//   2. [data-cookie-settings] -> reopen the cookie banner
(function () {
  // 1. Image fallback (was: onerror="this.onerror=null;this.src='...'")
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.getAttribute && t.getAttribute('data-fallback')) {
      var fb = t.getAttribute('data-fallback');
      t.removeAttribute('data-fallback');
      t.onerror = null;
      t.src = fb;
    }
  }, true);

  // 2. Cookie settings link (was: onclick="if(window.JVDSCookies){...}return false;")
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
    if (!el) return;
    e.preventDefault();
    if (window.JVDSCookies && typeof window.JVDSCookies.reopen === 'function') window.JVDSCookies.reopen();
  });

  // 3. Delegated widget calls (was: inline onclick="fn(this)" etc. on repeated
  //    controls across the quiz/step/order widgets). data-on names the global
  //    function, data-on-arg is an optional literal, data-on-plain omits the element.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-on]') : null;
    if (!el) return;
    var fn = window[el.getAttribute('data-on')];
    if (typeof fn !== 'function') return;
    var arg = el.getAttribute('data-on-arg');
    var hasArg = arg !== null;
    if (hasArg && el.hasAttribute('data-on-num')) arg = Number(arg);
    var plain = el.hasAttribute('data-on-plain');
    try {
      if (plain) hasArg ? fn(arg) : fn();
      else hasArg ? fn(el, arg) : fn(el);
    } catch (err) { /* surface via the page's own error handling */ }
  });
})();
