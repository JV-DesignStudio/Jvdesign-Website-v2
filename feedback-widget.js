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

  var STYLE = [
    '#jvfb-btn{position:fixed;left:16px;z-index:9000;background:#BC4749;color:#fff;border:none;border-radius:999px;padding:10px 16px;font:700 .82rem/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #9b3a3c,0 8px 24px rgba(64,59,51,.25)}',
    '#jvfb-btn:hover{filter:brightness(1.06)}',
    '#jvfb-btn:focus-visible{outline:3px solid #4e7d80;outline-offset:2px}',
    '#jvfb-panel{position:fixed;left:16px;z-index:9001;width:min(320px,calc(100vw - 32px));background:#F0EAD6;color:#403B33;border:1.5px solid #D2B48C;border-radius:14px;padding:16px;box-shadow:0 12px 40px rgba(64,59,51,.3);font:400 .85rem/1.5 Inter,system-ui,sans-serif}',
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
    '@media(max-width:480px){#jvfb-panel{left:8px;right:8px;width:auto}}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.id = 'jvfb-style';
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  var wrap = document.createElement('div');
  wrap.id = 'jvds-feedback-widget';

  var btn = document.createElement('button');
  btn.id = 'jvfb-btn';
  btn.type = 'button';
  btn.textContent = 'Did this work?';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'jvfb-panel');

  var panel = document.createElement('div');
  panel.id = 'jvfb-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', 'Feedback for this page');

  wrap.appendChild(btn);
  wrap.appendChild(panel);
  document.body.appendChild(wrap);

  function place() {
    var banner = document.getElementById('cookie-banner');
    var base = 16 + (banner ? banner.offsetHeight + 12 : 0);
    btn.style.bottom = base + 'px';
    panel.style.bottom = (base + 46) + 'px';
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
    if (wrap.contains(e.target)) return;
    closePanel();
  });
  window.addEventListener('resize', place);
  place();
  ensureAnalyticsBootstrap();

  window.JVDSFeedback = {
    open: openPanel,
    close: closePanel,
    record: record,
    addNote: addNote,
    getAll: getAll,
    clear: function () { writeJSON(STORE_KEY, []); }
  };
})();
