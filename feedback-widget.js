/* feedback-widget.js - anonymous one-tap feedback for JVDS tools and workshops.
 *
 * Privacy model: no account, no PII. Every answer is saved on the device first.
 * An anonymised event is sent only when analytics consent was already granted
 * (see cookie-consent.js), and the optional note is capped at 140 characters.
 *
 * Activates on /tools/ and /workshops/ pages. Override with
 * <meta name="jvds-feedback" content="on|off">.
 *
 * API: window.JVDSFeedback = { open, close, record(worked, note), addNote(id, note), getAll, clear }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSFeedback) return;

  var SECTION = (location.pathname.match(/^\/(tools|workshops)\//) || [])[1] || null;
  var metaEl = document.querySelector('meta[name="jvds-feedback"]');
  var forced = metaEl ? String(metaEl.getAttribute('content') || '').toLowerCase() : '';
  if (forced === 'off') return;
  if (!SECTION && forced !== 'on') return;
  SECTION = SECTION || 'page';

  /* A2902: tool pages stay focused on the tool. The tool's own toolbar owns
     save, export and share, so the shared action dock is not mounted here.
     The no-op dock keeps the other helpers from falling back to floating
     pills, while their APIs stay available to the tool itself. */
  if (SECTION === 'tools') {
    window.JVDSDock = {
      el: function () { return null; },
      add: function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); return el; },
      place: function () {},
      sync: function () {}
    };
    return;
  }

  var STORE_KEY = 'jvds-feedback';
  var MAX_NOTE = 140;
  var MAX_ENTRIES = 100;
  var CHAR = SECTION === 'workshops'
    ? { name: 'Lumo', line: 'Lumo here. Did this workshop make sense?' }
    : { name: 'Ember', line: 'Ember here. Did this tool do the job?' };

  function readJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  function consentGranted() {
    try {
      var m = document.cookie.match(/(?:^|; )jvds-cookie-consent=([^;]*)/);
      if (m && decodeURIComponent(m[1]) === 'accepted') return true;
      if (localStorage.getItem('jvds-cookie-consent') === 'accepted') return true;
    } catch (e) {}
    return false;
  }
  function track(name, params) {
    if (!consentGranted()) return false;
    try {
      if (typeof window.gtag === 'function') { window.gtag('event', name, params); return true; }
      if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        window.dataLayer.push(['event', name, params]);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* Some tool pages do not include the shared GA bootstrap. Load it on demand so
   * feedback still submits, while keeping the measurement ID in one file. */
  function ensureAnalyticsBootstrap() {
    if (typeof window.gtag === 'function') return;
    window.dataLayer = window.dataLayer || [];
    if (document.querySelector('script[src*="analytics-loader.js"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = '/analytics-loader.js';
    document.head.appendChild(s);
  }
  function getAll() {
    var a = readJSON(STORE_KEY, []);
    return Array.isArray(a) ? a : [];
  }
  function saveAll(a) {
    if (!Array.isArray(a)) a = [];
    writeJSON(STORE_KEY, a.slice(-MAX_ENTRIES));
  }

  function record(worked, note) {
    var entry = {
      id: 'fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      ts: new Date().toISOString(),
      section: SECTION,
      page: location.pathname,
      worked: !!worked,
      note: typeof note === 'string' ? note.slice(0, MAX_NOTE) : ''
    };
    var all = getAll();
    all.push(entry);
    saveAll(all);
    track('jvds_feedback', {
      section: entry.section,
      page_path: entry.page,
      worked: entry.worked ? 'yes' : 'no'
    });
    return entry;
  }

  function addNote(id, note) {
    var all = getAll(), found = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].note = String(note || '').slice(0, MAX_NOTE);
        found = all[i];
      }
    }
    saveAll(all);
    if (found) {
      track('jvds_feedback_note', {
        section: found.section,
        page_path: found.page,
        worked: found.worked ? 'yes' : 'no',
        note: found.note
      });
    }
    return found;
  }

  /* A2376: one compact action dock replaces the separate floating helpers.
     The keepsake, move-code, share, feedback and companion controls all live in
     this row instead of stacking over the bottom of the tool. */
  var STYLE = [
    '#jvds-action-dock{position:fixed;left:50%;right:auto;bottom:12px;transform:translateX(-50%);z-index:9000;display:flex;align-items:center;gap:5px;padding:5px;max-width:calc(100vw - 24px);box-sizing:border-box;background:rgba(40,36,30,.96);border:1px solid rgba(240,234,214,.2);border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35)}',
    '#jvds-action-dock[hidden]{display:none}',
    '#jvds-action-dock > *{position:static!important;inset:auto!important;right:auto!important;bottom:auto!important;left:auto!important;top:auto!important;flex:0 0 auto;margin:0!important}',
    '#jvds-action-dock > #jvfb-btn,#jvds-action-dock > #jvds-share-btn,#jvds-action-dock > #jvds-project-btn,#jvds-action-dock #jk-keep-export{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;padding:0!important;border-radius:999px!important;font-size:0!important;line-height:1!important;display:inline-flex!important;align-items:center;justify-content:center;box-shadow:none!important;flex:0 0 auto}',
    '#jvds-action-dock > #jvfb-btn::before,#jvds-action-dock > #jvds-share-btn::before,#jvds-action-dock > #jvds-project-btn::before,#jvds-action-dock #jk-keep-export::before{font-size:1.1rem!important;line-height:1;display:block;margin:0!important}',
    '#jvds-action-dock > #jvfb-btn::before{content:"\\1F4AC"}',
    '#jvds-action-dock > #jvds-share-btn::before{content:"\\2197"}',
    '#jvds-action-dock > #jvds-project-btn::before{content:"\\21C4"}',
    '#jvds-action-dock #jk-keep-export::before{content:"\\1F4BE"}',
    '#jvds-action-dock > .mascot-companion{order:-1;width:38px!important;height:38px!important;min-width:38px!important;border-width:2px!important;box-shadow:none!important}',
    '#jvds-action-dock #jvds-keepsake-strip{position:static!important;display:flex;align-items:center;gap:5px;max-width:none!important;background:none!important;border:0!important;box-shadow:none!important;padding:0!important}',
    '#jvds-action-dock #jvds-keepsake-strip .jk-txt{display:none!important}',
    '#jvds-action-dock #jk-keep-cert{display:inline-flex;align-items:center;justify-content:center;width:36px;height:44px;font-size:0!important;overflow:hidden;text-decoration:none;color:#e7c98a}',
    '#jvds-action-dock #jk-keep-cert::before{content:"\\1F393";font-size:1rem;line-height:1}',
    'body.jvds-dock-mounted .mascot-companion-bubble{left:50%;right:auto;transform:translateX(-50%);bottom:calc(var(--jvds-dock-bottom,12px) + 60px)}',
    '#jvfb-btn{background:#BC4749;color:#fff;border:none;border-radius:999px;padding:10px 16px;font:700 .82rem/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #9b3a3c,0 8px 24px rgba(64,59,51,.25);display:inline-flex;align-items:center;justify-content:center;min-height:44px}',
    '#jvfb-btn:hover{filter:brightness(1.06)}',
    '#jvfb-btn:focus-visible{outline:3px solid #4e7d80;outline-offset:2px}',
    '#jvfb-panel{position:fixed;left:50%;right:auto;transform:translateX(-50%);z-index:9100;width:min(320px,calc(100vw - 24px));bottom:calc(var(--jvds-dock-bottom,12px) + 60px);background:#F0EAD6;color:#403B33;border:1.5px solid #D2B48C;border-radius:14px;padding:16px;box-shadow:0 12px 40px rgba(64,59,51,.3);font:400 .85rem/1.5 Inter,system-ui,sans-serif}',
    '#jvfb-panel[hidden]{display:none}',
    '#jvfb-panel .jvfb-char{font-weight:800;color:#4e7d80;margin:0 0 6px}',
    '#jvfb-panel .jvfb-q{font-weight:700;margin:0 0 12px;font-size:.95rem}',
    '#jvfb-panel .jvfb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '#jvfb-panel .jvfb-btn{border-radius:9px;padding:9px 14px;font:700 .82rem Inter,system-ui,sans-serif;cursor:pointer;border:1.5px solid transparent}',
    '#jvfb-panel .jvfb-yes{background:#4e7d80;color:#fff}',
    '#jvfb-panel .jvfb-no{background:transparent;color:#9b3a3c;border-color:#BC4749}',
    '#jvfb-panel .jvfb-ghost{background:transparent;color:#5a5449;border-color:#D2B48C}',
    '#jvfb-panel .jvfb-note{width:100%;box-sizing:border-box;margin-top:10px;border:1.5px solid #D2B48C;border-radius:9px;padding:8px 10px;font:400 .82rem Inter,system-ui,sans-serif;resize:vertical;min-height:56px;background:#fff;color:#403B33}',
    '#jvfb-panel .jvfb-thanks{font-weight:800;margin:0 0 6px;color:#3d3224;font-size:.95rem}',
    '#jvfb-panel .jvfb-sub{color:#5a5449;margin:0 0 10px;font-size:.78rem}',
    '#jvfb-panel .jvfb-close{position:absolute;top:6px;right:8px;background:none;border:none;font-size:1.05rem;line-height:1;color:#5a5449;cursor:pointer;padding:4px 7px;border-radius:7px}',
    '#jvfb-panel .jvfb-close:hover{background:rgba(64,59,51,.08)}',
    '@media(max-width:480px){#jvfb-panel{left:8px;right:8px;width:auto;transform:none}}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.id = 'jvfb-style';
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  function ensureDock() {
    var dock = document.getElementById('jvds-action-dock');
    if (dock) return dock;
    dock = document.createElement('div');
    dock.id = 'jvds-action-dock';
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-label', 'Page actions');
    document.body.appendChild(dock);
    document.body.classList.add('jvds-dock-mounted');
    /* A page may render a helper before this script runs; move it in. */
    ['#jvds-keepsake-strip', '#jvds-project-btn', '#jvds-share-btn', '.mascot-companion'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el && el.parentNode !== dock) dock.appendChild(el);
    });
    return dock;
  }

  var dock = ensureDock();

  var btn = document.createElement('button');
  btn.id = 'jvfb-btn';
  btn.type = 'button';
  btn.textContent = 'Did this work?';
  btn.title = 'Did this work? Tell us in one tap';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'jvfb-panel');
  dock.appendChild(btn);

  var panel = document.createElement('div');
  panel.id = 'jvfb-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', 'Feedback for this page');
  document.body.appendChild(panel);

  function bottomBar() {
    var bar = document.getElementById('bottom-bar') || document.getElementById('mobToolbar');
    if (bar) return bar;
    var tabs = document.querySelector('.bb-tabs');
    return tabs ? tabs.parentElement : null;
  }

  function syncDock() {
    var d = document.getElementById('jvds-action-dock');
    if (!d) return;
    var shown = false;
    for (var i = 0; i < d.children.length; i++) {
      var el = d.children[i];
      var cs = getComputedStyle(el);
      if (cs.display !== 'none' && cs.visibility !== 'hidden') {
        shown = true;
        break;
      }
    }
    d.hidden = !shown;
  }

  function place() {
    var d = document.getElementById('jvds-action-dock');
    if (!d) return;
    /* Sit above whatever currently owns the bottom of the screen: the cookie
       banner and/or a tool bottom bar. Take the highest of the two rather than
       stacking their heights, because one can already sit above the other. */
    var tops = [];
    var banner = document.getElementById('cookie-banner');
    if (banner && banner.offsetHeight) {
      var br = banner.getBoundingClientRect();
      if (br.top > window.innerHeight * 0.35) tops.push(br.top);
    }
    var bar = bottomBar();
    if (bar) {
      var st = getComputedStyle(bar);
      var rr = bar.getBoundingClientRect();
      if (st.display !== 'none' && rr.height > 0 && rr.top > window.innerHeight * 0.35) tops.push(rr.top);
    }
    var base = 12;
    if (tops.length) base = Math.max(base, Math.round(window.innerHeight - Math.min.apply(null, tops) + 8));
    d.style.bottom = base + 'px';
    document.documentElement.style.setProperty('--jvds-dock-bottom', base + 'px');
    syncDock();
  }

  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function closeBtn() {
    var b = make('button', 'jvfb-close', '\u00d7');
    b.type = 'button';
    b.setAttribute('aria-label', 'Close feedback');
    b.addEventListener('click', closePanel);
    return b;
  }

  function renderQuestion() {
    panel.textContent = '';
    panel.appendChild(closeBtn());
    panel.appendChild(make('p', 'jvfb-char', CHAR.line));
    panel.appendChild(make('p', 'jvfb-q', 'Did this work for you?'));
    var row = make('div', 'jvfb-row');
    var yes = make('button', 'jvfb-btn jvfb-yes', 'Yes, it worked');
    var no = make('button', 'jvfb-btn jvfb-no', 'Not quite');
    yes.type = 'button';
    no.type = 'button';
    yes.addEventListener('click', function () { onTap(true); });
    no.addEventListener('click', function () { onTap(false); });
    row.appendChild(yes);
    row.appendChild(no);
    panel.appendChild(row);
    var first = panel.querySelector('.jvfb-yes');
    if (first) first.focus();
  }

  function renderNote(entry) {
    panel.textContent = '';
    panel.appendChild(closeBtn());
    panel.appendChild(make('p', 'jvfb-thanks', entry.worked ? 'Thank you.' : 'Thanks for being honest.'));
    panel.appendChild(make('p', 'jvfb-sub', 'Want to say more? It stays anonymous, so please do not add personal details.'));
    var ta = make('textarea', 'jvfb-note');
    ta.maxLength = MAX_NOTE;
    ta.placeholder = 'What got stuck, or what would help? (optional)';
    panel.appendChild(ta);
    var row = make('div', 'jvfb-row');
    var send = make('button', 'jvfb-btn jvfb-yes', 'Send');
    var skip = make('button', 'jvfb-btn jvfb-ghost', 'No thanks');
    send.type = 'button';
    skip.type = 'button';
    send.addEventListener('click', function () {
      addNote(entry.id, ta.value);
      renderDone();
    });
    skip.addEventListener('click', function () { renderDone(); });
    row.appendChild(send);
    row.appendChild(skip);
    panel.appendChild(row);
    ta.focus();
  }

  var hideTimer = null;

  function renderDone() {
    panel.textContent = '';
    panel.appendChild(closeBtn());
    panel.appendChild(make('p', 'jvfb-thanks', 'Saved.'));
    panel.appendChild(make('p', 'jvfb-sub', 'Your answer is kept on this device. Thanks for helping us improve.'));
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(closePanel, 2600);
  }

  function onTap(worked) {
    var entry = record(worked);
    renderNote(entry);
  }

  function openPanel() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    renderQuestion();
    place();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  }
  function closePanel() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }

  btn.addEventListener('click', function () {
    if (panel.hidden) openPanel(); else closePanel();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) closePanel();
  });
  document.addEventListener('click', function (e) {
    if (panel.hidden) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    closePanel();
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, { passive: true });
  window.addEventListener('orientationchange', place);
  document.addEventListener('click', function () { setTimeout(place, 0); }, true);
  place();
  [0, 300, 1200].forEach(function (ms) { setTimeout(place, ms); });
  try {
    var dockBar = bottomBar();
    if (dockBar && window.ResizeObserver) new ResizeObserver(place).observe(dockBar);
  } catch (e) {}
  try {
    if (window.MutationObserver) {
      new MutationObserver(function () { setTimeout(place, 0); })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  } catch (e) {}
  ensureAnalyticsBootstrap();

  /* A2376: the shared dock. Other helper scripts append their control here so
     the bottom of the page keeps one small row instead of several floating
     pills. */
  window.JVDSDock = {
    el: function () { return ensureDock(); },
    add: function (el) { ensureDock().appendChild(el); place(); return el; },
    place: place,
    sync: place
  };

  window.JVDSFeedback = {
    open: openPanel,
    close: closePanel,
    record: record,
    addNote: addNote,
    getAll: getAll,
    clear: function () { writeJSON(STORE_KEY, []); }
  };
})();
