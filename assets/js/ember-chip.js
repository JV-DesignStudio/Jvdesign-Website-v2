/* A2591: Ember companion chip.
 * A small, dismissible, session-scoped hint that reacts to four states:
 *   empty-search, blank-canvas, malformed-share, export-failed.
 * Tools can dispatch:
 *   document.dispatchEvent(new CustomEvent('jvds:canvas-empty'))
 *   document.dispatchEvent(new CustomEvent('jvds:export-failed'))
 * or call window.EmberChip.show('blank-canvas').
 * It never blocks the page: the chip is fixed, small and dismissible. */
(function () {
  'use strict';
  var DISMISS_KEY = 'jvds_ember_chip_dismissed';
  var state = null;
  var wrap = null;
  var textEl = null;
  var actionEl = null;

  var HINTS = {
    'empty-search': {
      text: 'No tools match that word yet. Try a simpler word, or clear the search and browse.',
      action: 'Clear the search',
      run: function () {
        var input = document.getElementById('toolSearch');
        if (!input) return;
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        try { input.focus(); } catch (e) {}
      }
    },
    'blank-canvas': {
      text: 'This canvas is still blank. Draw one pixel, or borrow a starter from the 15-minute project.',
      action: 'Open the starter project',
      href: '/create#first-project'
    },
    'malformed-share': {
      text: 'That shared link looks broken. Open a fresh copy and we can start again.',
      action: 'Open a fresh copy',
      run: function () {
        location.href = location.pathname + location.search;
      }
    },
    'export-failed': {
      text: 'The export did not finish. Try again, or make the sprite a little smaller.',
      action: 'Try the export again',
      run: function () {
        var btn = document.querySelector('[data-on="exportPNG"]') || document.getElementById('exportPNGBtn');
        if (btn) { btn.click(); return; }
        location.reload();
      }
    }
  };

  function dismissed() {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function setDismissed() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  }

  function ensure() {
    if (wrap) return;
    var css = document.createElement('style');
    css.textContent =
      '.ember-chip{position:fixed;left:16px;bottom:16px;z-index:2147483000;display:none;align-items:flex-start;gap:10px;max-width:min(340px,calc(100vw - 32px));padding:10px 12px;background:var(--card,#fff);border:1.5px solid var(--jade,#70A3A7);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-family:Inter,system-ui,sans-serif;font-size:.82rem;line-height:1.4;color:var(--charcoal,#1a1208)}' +
      '.ember-chip.is-open{display:flex}' +
      '.ember-chip img{flex:0 0 auto;width:36px;height:36px;border-radius:50%;object-fit:cover}' +
      '.ember-chip-body{min-width:0;display:flex;flex-direction:column;gap:4px}' +
      '.ember-chip-body strong{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--jade-dk,#4e7d80)}' +
      '.ember-chip-action{align-self:flex-start;margin-top:2px;min-height:36px;display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:var(--jade-dk,#4e7d80);color:#fff;font-weight:800;font-size:.78rem;text-decoration:none;border:0;cursor:pointer}' +
      '.ember-chip-action:hover{filter:brightness(1.08)}' +
      '.ember-chip-close{flex:0 0 auto;min-width:32px;min-height:32px;border:0;background:transparent;color:inherit;font-size:1rem;line-height:1;cursor:pointer;border-radius:8px;opacity:.7}' +
      '.ember-chip-close:hover{opacity:1}' +
      '@media(prefers-reduced-motion:reduce){.ember-chip{transition:none}}';
    document.head.appendChild(css);

    wrap = document.createElement('div');
    wrap.id = 'ember-chip';
    wrap.className = 'ember-chip';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-atomic', 'true');
    wrap.innerHTML =
      '<img src="/games/chars/ember.png" alt="" width="36" height="36">' +
      '<div class="ember-chip-body"><strong>Ember says</strong><span class="ember-chip-text"></span><button type="button" class="ember-chip-action"></button></div>' +
      '<button type="button" class="ember-chip-close" aria-label="Dismiss Ember hint">\u00D7</button>';
    textEl = wrap.querySelector('.ember-chip-text');
    actionEl = wrap.querySelector('.ember-chip-action');
    wrap.querySelector('.ember-chip-close').addEventListener('click', dismiss);
    document.body.appendChild(wrap);
  }

  function show(name) {
    var hint = HINTS[name];
    if (!hint || dismissed()) return;
    ensure();
    state = name;
    textEl.textContent = hint.text;
    actionEl.textContent = hint.action;
    if (hint.href) {
      actionEl.onclick = null;
      actionEl.setAttribute('role', 'link');
      actionEl.setAttribute('tabindex', '0');
      actionEl.dataset.href = hint.href;
      actionEl.onclick = function () { location.href = hint.href; };
      actionEl.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.href = hint.href; } };
    } else {
      actionEl.onclick = hint.run || null;
      actionEl.onkeydown = null;
      actionEl.removeAttribute('role');
      actionEl.removeAttribute('tabindex');
    }
    wrap.classList.add('is-open');
  }

  function hide() {
    state = null;
    if (wrap) wrap.classList.remove('is-open');
  }

  function dismiss() {
    setDismissed();
    hide();
  }

  function visibleResults() {
    return [].slice.call(document.querySelectorAll('.tool-card, .reference-pill')).filter(function (el) {
      return el.style.display !== 'none' && el.offsetParent !== null;
    }).length;
  }

  function checkSearch() {
    var input = document.getElementById('toolSearch');
    if (!input) return;
    var q = (input.value || '').trim();
    if (q.length < 2) { if (state === 'empty-search') hide(); return; }
    if (visibleResults() === 0) show('empty-search');
    else if (state === 'empty-search') hide();
  }

  function looksLikeBadShare() {
    var raw = (location.hash.slice(1) + '&' + location.search.slice(1));
    var m = raw.match(/(?:^|&)(share|project|data)=([^&]*)/i);
    if (!m) return false;
    if (!m[2]) return true;
    try {
      var decoded = decodeURIComponent(m[2]);
      try { JSON.parse(decoded); return false; } catch (e) {}
      try { atob(decoded); return false; } catch (e) {}
      return true;
    } catch (e) { return true; }
  }

  function boot() {
    if (!document.body) return;
    var input = document.getElementById('toolSearch');
    if (input) {
      var t;
      input.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(checkSearch, 220);
      });
      if (document.querySelector('.tool-card')) checkSearch();
    }
    if (looksLikeBadShare()) show('malformed-share');
    document.addEventListener('jvds:canvas-empty', function () { show('blank-canvas'); });
    document.addEventListener('jvds:export-failed', function () { show('export-failed'); });
    window.EmberChip = { show: show, hide: hide, dismiss: dismiss, get state() { return state; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
