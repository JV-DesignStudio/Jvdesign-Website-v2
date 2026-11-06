/* A2590: URL-hash size watchdog.
 * Shows how long a shared hash is, warns near the ~2,000 character browser-safe
 * limit, and offers a local JSON download when the payload is too large.
 * Hidden unless the URL actually carries a payload-like hash. */
(function () {
  'use strict';
  var DEFAULT_LIMIT = 2000;
  var LIMIT = Number(window.JVDS_HASH_LIMIT) > 0 ? Number(window.JVDS_HASH_LIMIT) : DEFAULT_LIMIT;
  var wrap = null;
  var valueEl = null;
  var fallbackEl = null;
  var timer = null;
  var lastText = '';
  var testHook = { downloaded: null };

  function hashPayload() {
    return location.hash.replace(/^#/, '');
  }
  function payloadLength() {
    return hashPayload().length;
  }
  function looksLikePayload(h) {
    if (!h) return false;
    return h.length > 32 || h.indexOf('=') !== -1 || /^(g|share|project|data|p)=/i.test(h);
  }
  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function ensure() {
    if (wrap) return;
    var css = document.createElement('style');
    css.id = 'hash-watchdog-css';
    css.textContent =
      '.hash-watchdog{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:2147481900;display:none;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:6px 10px;background:var(--card,#fff);border:1px solid var(--border,rgba(64,59,51,.2));border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.14);font-family:"JetBrains Mono",monospace;font-size:.68rem;color:var(--charcoal,#1a1208);white-space:nowrap}' +
      '.hash-watchdog.is-open{display:flex}' +
      '.hash-watchdog.is-near{border-color:var(--gold,#c98a2e);background:var(--gold-lt,#faf1e0)}' +
      '.hash-watchdog.is-over{border-color:var(--rose,#BC4749);background:var(--rose-lt,#f5e0e0);color:var(--rose-dk,#9b3a3c);font-weight:800}' +
      '.hash-watchdog-fallback{display:none;min-height:28px;padding:3px 10px;border-radius:999px;border:0;background:var(--teal-dk,#4e7d80);color:#fff;font:inherit;font-size:.66rem;font-weight:800;cursor:pointer}' +
      '.hash-watchdog.is-over .hash-watchdog-fallback{display:inline-flex;align-items:center}' +
      '@media(max-width:420px){.hash-watchdog{font-size:.6rem;padding:5px 8px;gap:6px}}';
    document.head.appendChild(css);

    wrap = document.createElement('div');
    wrap.id = 'hash-watchdog';
    wrap.className = 'hash-watchdog';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.innerHTML = '<span class="hash-watchdog-value"></span><button type="button" class="hash-watchdog-fallback">Download JSON</button>';
    valueEl = wrap.querySelector('.hash-watchdog-value');
    fallbackEl = wrap.querySelector('.hash-watchdog-fallback');
    fallbackEl.addEventListener('click', download);
    document.body.appendChild(wrap);
  }

  function download() {
    var data = {
      note: 'This shared link is too long for some browsers. Keep this file or import it back into the tool.',
      url: location.href,
      hash: location.hash,
      length: payloadLength(),
      savedAt: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'jvds-share-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    testHook.downloaded = { length: data.length, hash: data.hash };
    window.__hashWatchdog = testHook;
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
  }

  function update() {
    var h = hashPayload();
    if (!looksLikePayload(h)) {
      if (wrap) wrap.classList.remove('is-open');
      lastText = '';
      return;
    }
    ensure();
    var n = h.length;
    var near = n >= LIMIT * 0.8 && n < LIMIT;
    var over = n >= LIMIT;
    var text = 'Link ' + fmt(n) + ' / ' + fmt(LIMIT) + ' chars';
    if (over) text += ' - too long, download instead';
    if (text !== lastText) {
      valueEl.textContent = text;
      lastText = text;
    }
    wrap.classList.add('is-open');
    wrap.classList.toggle('is-near', near);
    wrap.classList.toggle('is-over', over);
    wrap.setAttribute('aria-label', over
      ? 'Shared link is too long. Download a JSON copy instead.'
      : 'Shared link is ' + fmt(n) + ' of ' + fmt(LIMIT) + ' characters.');
  }

  function boot() {
    ensure();
    update();
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    if (timer) clearInterval(timer);
    timer = setInterval(update, 800);
    window.HashWatchdog = {
      check: update,
      download: download,
      limit: LIMIT,
      get length() { return payloadLength(); },
      get testHook() { return testHook; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
