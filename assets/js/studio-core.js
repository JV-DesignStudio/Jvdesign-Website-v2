/* ============================================================
   assets/js/studio-core.js - JVDS Studio Core

   One shared, dependency-free layer that every creator tool can use.
   It turns the cross-cutting audit items into a single small API:

     JVDSStudio.settings      personal preferences (theme, density...)
     JVDSStudio.theme         light / dark / system, persisted
     JVDSStudio.toast         friendly status messages
     JVDSStudio.modal         accessible dialog + focus trap
     JVDSStudio.drawer        accessible side sheet
     JVDSStudio.panel         the "Studio tools" drawer
     JVDSStudio.share         compressed, copyable project links
     JVDSStudio.bundle        .jvzip export / import (lazy)
     JVDSStudio.storage       IndexedDB snapshots + revisions (lazy)
     JVDSStudio.preview       sandboxed live code preview (lazy)
     JVDSStudio.inspector     accessibility inspector (lazy)
     JVDSStudio.templates     remixable starters (lazy)
     JVDSStudio.quota         storage health + quota guard
     JVDSStudio.autosave      rolling snapshots
     JVDSStudio.pointer       unified mouse / touch / pen events
     JVDSStudio.raf           frame-synced render loop
     JVDSStudio.dom           fragment batching helpers
     JVDSStudio.worker        off-main-thread helpers (lazy)
     JVDSStudio.lifecycle     cleanup hooks
     JVDSStudio.layout        3-pane workspace + toolbar overflow
     JVDSStudio.metadata      author / watermark export metadata
     JVDSStudio.print         print / save as PDF
     JVDSStudio.board         copy a board-ready bug report

   Loaded once from partials/footer-tools.html. Everything is wrapped
   in try/catch so a tool page can never be broken by the core.
   ============================================================ */
(function () {
  'use strict';
  if (window.JVDSStudio && window.JVDSStudio.core === true) return;

  var VERSION = '1.0.0';
  var SETTINGS_KEY = 'jvds_studio_settings';
  var LAST_TAB_KEY = 'jvds_studio_tab';
  var SAVE_PREFIX = /^(jvds_|jv_|qb-|wkp_|pixel|sound|buildlab|arcade|csg|gdd|level|sprite|story|map|tileset|card|tabletop|voxel|world|drum|music|sfx|palette|colour|icon|logo|screenshot|store-page)/i;
  var NEVER_SHARE = /token|secret|password|apikey|gh_pat|gh_gist|^ga4_|^_ga|consent|studio_settings|studio_tab/i;
  // Progress, profile and device choices are not part of a project. Keeping
  // them out of links, snapshots and bundles avoids sending a learner's name
  // or history to whoever receives a share link.
  var PERSONAL = /(profile|cosmetic|progress|visited|streak|challenge|daily|weekly|funnel|activity|accessibility|first.creation|teacher_mode|session)/i;

  var W = window;
  var D = document;
  var S = W.JVDSStudio = W.JVDSStudio || {};

  S.core = true;
  S.version = VERSION;
  S.tool = toolId();

  /* ---------------------------------------------------------------- */
  /* Small utilities                                                   */
  /* ---------------------------------------------------------------- */

  function ready(fn) {
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function idle(fn) {
    if ('requestIdleCallback' in W) W.requestIdleCallback(fn, { timeout: 1200 });
    else setTimeout(fn, 1);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function h(tag, attrs, kids) {
    var el = D.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { el.style[p] = v[p]; });
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (kid) {
      if (kid == null) return;
      el.appendChild(typeof kid === 'string' ? D.createTextNode(kid) : kid);
    });
    return el;
  }

  function toolId() {
    var m = String(location.pathname || '').match(/\/(?:tools|workshops|create|learn)\/([^/]+?)\.html$/);
    return m ? m[1] : '';
  }

  function isToolPage() {
    return /\/tools\//.test(location.pathname) || D.body && D.body.hasAttribute('data-studio-tool');
  }

  function readJSON(store, key, fallback) {
    try { var v = JSON.parse(store.getItem(key) || 'null'); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }

  function safeLS() {
    try { return W.localStorage; } catch (e) { return null; }
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* ---------------------------------------------------------------- */
  /* Settings                                                          */
  /* ---------------------------------------------------------------- */

  var DEFAULT_SETTINGS = {
    theme: 'system',
    density: 'comfortable',
    autosave: true,
    autosaveSeconds: 60,
    keepRevisions: 5,
    author: '',
    watermark: false,
    license: '',
    exportFormat: 'json',
    indent: '2',
    wrapper: 'none',
    seenWalkthrough: false,
    tips: true
  };

  function allSettings() {
    var store = safeLS();
    var saved = store ? readJSON(store, SETTINGS_KEY, {}) : {};
    var out = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      out[k] = saved && Object.prototype.hasOwnProperty.call(saved, k) ? saved[k] : DEFAULT_SETTINGS[k];
    });
    return out;
  }

  function saveSettings(patch) {
    var store = safeLS();
    var next = allSettings();
    if (patch) Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
    if (store) {
      try { store.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) { quotaWarn(); }
    }
    try { D.dispatchEvent(new CustomEvent('jvds:settings', { detail: next })); } catch (e) {}
    return next;
  }

  S.settings = {
    all: allSettings,
    get: function (key) { return allSettings()[key]; },
    set: function (key, value) { var p = {}; p[key] = value; return saveSettings(p); },
    patch: saveSettings,
    reset: function () {
      var store = safeLS();
      if (store) { try { store.removeItem(SETTINGS_KEY); } catch (e) {} }
      saveSettings({});
      return allSettings();
    }
  };

  function applySettings() {
    var s = allSettings();
    D.body && D.body.classList.toggle('jvs-compact', s.density === 'compact');
    applyTheme(s.theme, false);
  }

  /* ---------------------------------------------------------------- */
  /* Theme                                                             */
  /* ---------------------------------------------------------------- */

  function systemTheme() {
    try { return W.matchMedia && W.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    catch (e) { return 'dark'; }
  }

  function applyTheme(pref, persist) {
    var mode = pref || allSettings().theme || 'system';
    var resolved = mode === 'system' ? systemTheme() : mode;
    if (resolved === 'dark') D.documentElement.setAttribute('data-theme', 'dark');
    else D.documentElement.setAttribute('data-theme', 'light');
    var meta = D.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0b10' : '#fbf8f2');
    if (persist !== false) {
      S.settings.set('theme', mode);
      // Share the choice with theme-init.js and nav.js so the next page paints
      // in the right theme before Studio Core loads.
      try {
        if (mode === 'system') W.localStorage.removeItem('jvds-theme');
        else W.localStorage.setItem('jvds-theme', resolved);
      } catch (e) {}
    }
    try { D.dispatchEvent(new CustomEvent('jvds:theme', { detail: { mode: mode, resolved: resolved } })); } catch (e) {}
    return resolved;
  }

  S.theme = {
    get: function () { return allSettings().theme; },
    resolved: function () {
      var m = allSettings().theme;
      return m === 'system' ? systemTheme() : m;
    },
    set: function (mode) { return applyTheme(mode, true); },
    toggle: function () {
      var next = S.theme.resolved() === 'dark' ? 'light' : 'dark';
      return applyTheme(next, true);
    },
    apply: applyTheme
  };

  try {
    if (W.matchMedia) {
      var mq = W.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (allSettings().theme === 'system') applyTheme('system', false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  } catch (e) {}

  /* ---------------------------------------------------------------- */
  /* Quota                                                             */
  /* ---------------------------------------------------------------- */

  var quotaState = { usage: 0, quota: 0, ratio: 0, source: 'unknown' };
  var quotaWarned = false;

  function lsBytes() {
    var store = safeLS();
    if (!store) return 0;
    var total = 0;
    try {
      for (var i = 0; i < store.length; i++) {
        var k = store.key(i);
        var v = store.getItem(k) || '';
        total += (k.length + v.length) * 2;
      }
    } catch (e) {}
    return total;
  }

  function estimateQuota() {
    return new Promise(function (resolve) {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(function (est) {
          quotaState = {
            usage: est.usage || 0,
            quota: est.quota || 0,
            ratio: est.quota ? (est.usage || 0) / est.quota : 0,
            source: 'storage'
          };
          resolve(quotaState);
        }).catch(function () {
          var used = lsBytes();
          quotaState = { usage: used, quota: 5 * 1024 * 1024, ratio: clamp(used / (5 * 1024 * 1024), 0, 1), source: 'local' };
          resolve(quotaState);
        });
      } else {
        var used = lsBytes();
        quotaState = { usage: used, quota: 5 * 1024 * 1024, ratio: clamp(used / (5 * 1024 * 1024), 0, 1), source: 'local' };
        resolve(quotaState);
      }
    });
  }

  function humanBytes(n) {
    if (!n) return '0 KB';
    if (n > 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(n / 1024) + ' KB';
  }

  function quotaWarn() {
    if (quotaWarned) return;
    quotaWarned = true;
    S.toast('Storage is nearly full. Export your work from Studio tools before saving more.', { tone: 'danger', timeout: 9000 });
    try { D.dispatchEvent(new CustomEvent('jvds:quota-exceeded')); } catch (e) {}
    if (S.panel) S.panel.open();
  }

  function hookStorageErrors() {
    try {
      var proto = W.Storage && W.Storage.prototype;
      if (!proto || proto.__jvsQuotaHooked) return;
      var original = proto.setItem;
      proto.setItem = function (key, value) {
        try {
          return original.call(this, key, value);
        } catch (e) {
          var name = String(e && (e.name + ' ' + e.message));
          if (/quota|exceed|full/i.test(name)) quotaWarn();
          throw e;
        }
      };
      proto.__jvsQuotaHooked = true;
    } catch (e) {}
  }

  function watchQuota() {
    var update = function () {
      estimateQuota().then(function (q) {
        try { D.dispatchEvent(new CustomEvent('jvds:quota', { detail: q })); } catch (e) {}
        if (q.ratio >= 0.9) quotaWarn();
      });
    };
    idle(update);
    setInterval(update, 60000);
    W.addEventListener('pagehide', function () {}, { once: true });
  }

  S.quota = {
    estimate: estimateQuota,
    state: function () { return quotaState; },
    human: humanBytes,
    warn: quotaWarn
  };

  /* ---------------------------------------------------------------- */
  /* Toast                                                             */
  /* ---------------------------------------------------------------- */

  function toastStack() {
    var el = D.querySelector('.jvs-toast-stack');
    if (!el) {
      el = h('div', { class: 'jvs-toast-stack', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
      D.body.appendChild(el);
    }
    return el;
  }

  S.toast = function (text, opts) {
    opts = opts || {};
    var el = h('div', {
      class: 'jvs-toast',
      'data-tone': opts.tone || 'info',
      'data-show': 'false'
    }, [h('span', { text: text })]);
    toastStack().appendChild(el);
    requestAnimationFrame(function () { el.setAttribute('data-show', 'true'); });
    var timeout = opts.timeout == null ? 3800 : opts.timeout;
    var close = function () {
      el.setAttribute('data-show', 'false');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    };
    if (timeout > 0) setTimeout(close, timeout);
    return { close: close, el: el };
  };

  /* ---------------------------------------------------------------- */
  /* Focus trap + dialog helpers                                       */
  /* ---------------------------------------------------------------- */

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function trapFocus(root, onEscape) {
    var previous = D.activeElement;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onEscape) onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      var items = Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE)).filter(function (el) {
        return el.offsetParent !== null || el === D.activeElement;
      });
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && D.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && D.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    D.addEventListener('keydown', onKey, true);
    var firstFocus = root.querySelector('[autofocus]') || root.querySelector(FOCUSABLE);
    if (firstFocus) setTimeout(function () { try { firstFocus.focus(); } catch (e) {} }, 20);
    return function release() {
      D.removeEventListener('keydown', onKey, true);
      if (previous && previous.focus) { try { previous.focus(); } catch (e) {} }
    };
  }

  function createSheet(opts) {
    opts = opts || {};
    var backdrop = h('div', { class: 'jvs-backdrop' });
    var sheet = h('div', {
      class: 'jvs-sheet',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'jvsSheetTitle',
      'data-open': 'false'
    }, [
      h('div', { class: 'jvs-sheet-head' }, [
        h('h2', { class: 'jvs-sheet-title', id: 'jvsSheetTitle', text: opts.title || 'Studio tools' }),
        h('button', { class: 'jvs-sheet-close', type: 'button', 'aria-label': 'Close Studio tools', text: '\u00d7' })
      ]),
      h('div', { class: 'jvs-sheet-body' }, opts.children || [])
    ]);
    D.body.appendChild(backdrop);
    D.body.appendChild(sheet);
    var release = trapFocus(sheet, close);
    function close() {
      sheet.setAttribute('data-open', 'false');
      setTimeout(function () {
        release();
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }, 220);
      if (opts.onClose) opts.onClose();
    }
    sheet.querySelector('.jvs-sheet-close').addEventListener('click', close);
    backdrop.addEventListener('click', close);
    requestAnimationFrame(function () { sheet.setAttribute('data-open', 'true'); });
    return { el: sheet, body: sheet.querySelector('.jvs-sheet-body'), close: close };
  }

  S.drawer = function (opts) {
    opts = opts || {};
    var body = [];
    if (typeof opts.content === 'string') body.push(h('div', { html: opts.content }));
    else if (opts.content) body.push(opts.content);
    return createSheet({ title: opts.title, children: body, onClose: opts.onClose });
  };

  S.modal = function (opts) {
    opts = opts || {};
    var wrap = h('div', { class: 'jvs-modal-wrap' });
    var body = h('div', {
      class: 'jvs-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'jvsModalTitle'
    }, [
      h('div', { class: 'jvs-modal-head' }, [
        h('h2', { class: 'jvs-modal-title', id: 'jvsModalTitle', text: opts.title || 'Studio' }),
        h('button', { type: 'button', 'aria-label': 'Close', text: '\u00d7', style: { width: '44px', padding: '0' } })
      ]),
      h('div', { class: 'jvs-modal-body' }, opts.body ? [opts.body] : []),
      h('div', { class: 'jvs-modal-foot' }, opts.actions || [])
    ]);
    wrap.appendChild(body);
    D.body.appendChild(wrap);
    var release = trapFocus(body, close);
    function close() {
      release();
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (opts.onClose) opts.onClose();
    }
    body.querySelector('.jvs-modal-head button').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    return { el: body, body: body.querySelector('.jvs-modal-body'), close: close };
  };

  S.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (value) { if (done) return; done = true; m.close(); resolve(value); };
      var m = S.modal({
        title: opts.title || 'Are you sure?',
        body: h('p', { text: opts.message || 'This cannot be undone.', style: { margin: '0', lineHeight: '1.6' } }),
        actions: [
          h('button', { type: 'button', text: opts.cancel || 'Cancel', onclick: function () { finish(false); } }),
          h('button', {
            type: 'button',
            class: opts.danger ? 'jvs-btn-danger' : 'jvs-btn-primary',
            text: opts.confirm || 'Continue',
            onclick: function () { finish(true); }
          })
        ],
        onClose: function () { if (!done) { done = true; resolve(false); } }
      });
    });
  };

  /* ---------------------------------------------------------------- */
  /* Contextual character help                                         */
  /* ---------------------------------------------------------------- */

  var HELPERS = {
    lumo: { name: 'Lumo', letter: 'L', job: 'learning' },
    echo: { name: 'Echo', letter: 'E', job: 'improving' },
    ember: { name: 'Ember', letter: 'E', job: 'creating' },
    pip: { name: 'Pip', letter: 'P', job: 'playing' },
    stardust: { name: 'Stardust', letter: 'S', job: 'imagining' }
  };

  S.help = function (character, message, opts) {
    opts = opts || {};
    var who = HELPERS[String(character || 'echo').toLowerCase()] || HELPERS.echo;
    var body = h('div', {}, [
      h('div', { class: 'jvs-tip', style: { marginBottom: '12px' } }, [
        h('span', { class: 'jvs-tip-avatar', 'aria-hidden': 'true', text: who.letter }),
        h('div', {}, [h('strong', { text: who.name + ' says' }), h('p', { text: message || 'Try the smallest next step. You can undo it after.' })])
      ])
    ]);
    if (opts.actions && opts.actions.length) body.appendChild(h('div', { class: 'jvs-actions' }, opts.actions));
    return S.drawer({ title: who.name + ' can help', content: body });
  };

  /* ---------------------------------------------------------------- */
  /* Tabs and accordion                                                */
  /* ---------------------------------------------------------------- */

  S.tabs = function (root) {
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[role="tabpanel"]'));
    function select(index) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        if (panels[i]) panels[i].hidden = !on;
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
        if (next != null) { e.preventDefault(); tabs[next].focus(); select(next); }
      });
    });
    select(Math.max(0, tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; })));
  };

  S.accordion = function (root) {
    if (!root) return;
    Array.prototype.slice.call(root.querySelectorAll('details')).forEach(function (d) {
      d.addEventListener('toggle', function () {
        try { D.dispatchEvent(new CustomEvent('jvds:accordion', { detail: { open: d.open, id: d.id } })); } catch (e) {}
      });
    });
  };

  /* ---------------------------------------------------------------- */
  /* Save collection (shared by share / bundle / snapshots)            */
  /* ---------------------------------------------------------------- */

  function collectSaves() {
    var store = safeLS();
    var out = {};
    if (!store) return out;
    try {
      for (var i = 0; i < store.length; i++) {
        var key = store.key(i);
        if (!key || key === SETTINGS_KEY || key === LAST_TAB_KEY) continue;
        if (NEVER_SHARE.test(key) || PERSONAL.test(key)) continue;
        if (!SAVE_PREFIX.test(key)) continue;
        var value = store.getItem(key);
        if (value == null) continue;
        if (value.length > 2 * 1024 * 1024) continue;
        out[key] = value;
      }
    } catch (e) {}
    return out;
  }

  function hashString(input) {
    var hash = 5381;
    for (var i = 0; i < input.length; i++) hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    return (hash >>> 0).toString(36);
  }

  function savesHash(saves) {
    var keys = Object.keys(saves).sort();
    return hashString(keys.map(function (k) { return k + '=' + saves[k].length; }).join('|')) + ':' + keys.length;
  }

  function applySaves(saves, opts) {
    var store = safeLS();
    if (!store) throw new Error('This browser will not let the page save work.');
    var written = 0;
    Object.keys(saves || {}).forEach(function (key) {
      if (!SAVE_PREFIX.test(key) || NEVER_SHARE.test(key) || PERSONAL.test(key)) return;
      try { store.setItem(key, saves[key]); written++; } catch (e) { if (opts && opts.onError) opts.onError(key, e); }
    });
    return written;
  }

  S._collectSaves = collectSaves;
  S._savesHash = savesHash;
  S._applySaves = applySaves;
  S._humanBytes = humanBytes;
  S._esc = esc;
  S._h = h;

  /* ---------------------------------------------------------------- */
  /* Share: compressed URL state                                       */
  /* ---------------------------------------------------------------- */

  function bytesToBase64(bytes) {
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64ToBytes(text) {
    var b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var binary = atob(b64);
    var out = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function utf8Bytes(str) { return new TextEncoder().encode(str); }
  function utf8String(bytes) { return new TextDecoder().decode(bytes); }

  function lzwEncode(text) {
    var dict = {};
    var code = 256;
    var w = '';
    var codes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      var wc = w + c;
      if (Object.prototype.hasOwnProperty.call(dict, wc)) {
        w = wc;
      } else {
        codes.push(w === '' ? c.charCodeAt(0) : dict[w]);
        if (code < 65535) dict[wc] = code++;
        else { dict = {}; code = 256; }
        w = c;
      }
    }
    if (w !== '') codes.push(dict[w]);
    var packed = '';
    for (var j = 0; j < codes.length; j++) packed += String.fromCharCode(codes[j]);
    return packed;
  }

  function lzwDecode(packed) {
    var dict = {};
    var code = 256;
    var w = packed.charAt(0);
    var result = w;
    for (var i = 1; i < packed.length; i++) {
      var k = packed.charCodeAt(i);
      var entry;
      if (k < 256) entry = String.fromCharCode(k);
      else if (dict[k] != null) entry = dict[k];
      else entry = w + w.charAt(0);
      result += entry;
      if (code < 65535) dict[code++] = w + entry.charAt(0);
      w = entry;
    }
    return result;
  }

  function deflate(text) {
    if (!W.CompressionStream) return Promise.resolve(null);
    try {
      var stream = new Blob([utf8Bytes(text)]).stream().pipeThrough(new W.CompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function inflate(bytes) {
    if (!W.DecompressionStream) return Promise.resolve(null);
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new W.DecompressionStream('deflate-raw'));
      return new Response(stream).text().catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function encodeState(payload) {
    var json = JSON.stringify(payload);
    return deflate(json).then(function (compressed) {
      if (compressed && compressed.length) return 'v1d:' + bytesToBase64(compressed);
      return 'v1l:' + bytesToBase64(utf8Bytes(lzwEncode(json)));
    });
  }

  function decodeState(text) {
    if (!text) return Promise.resolve(null);
    if (text.slice(0, 4) === 'v1d:') {
      return inflate(base64ToBytes(text.slice(4))).then(function (json) {
        return json ? JSON.parse(json) : null;
      }).catch(function () { return null; });
    }
    if (text.slice(0, 4) === 'v1l:') {
      try {
        var lzw = utf8String(base64ToBytes(text.slice(4)));
        return Promise.resolve(JSON.parse(lzwDecode(lzw)));
      } catch (e) { return Promise.resolve(null); }
    }
    try { return Promise.resolve(JSON.parse(decodeURIComponent(text))); }
    catch (e) { return Promise.resolve(null); }
  }

  function sharePayload() {
    return {
      kind: 'jvds-studio-share',
      v: 1,
      tool: S.tool,
      at: new Date().toISOString(),
      author: allSettings().author || '',
      saves: collectSaves()
    };
  }

  function shareLink() {
    return encodeState(sharePayload()).then(function (encoded) {
      var base = location.origin + location.pathname + location.search;
      return base + '#studio=' + encoded;
    });
  }

  function shareIsTooLong(link) {
    return String(link || '').length > 60000;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var area = D.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      D.body.appendChild(area);
      area.select();
      var ok = D.execCommand && D.execCommand('copy');
      D.body.removeChild(area);
      return !!ok;
    } catch (e) { return false; }
  }

  S.share = {
    payload: sharePayload,
    encode: encodeState,
    decode: decodeState,
    link: shareLink,
    copy: function () {
      return shareLink().then(function (link) {
        if (shareIsTooLong(link)) {
          S.toast('This project is too big for a link. Export a bundle instead.', { tone: 'warn', timeout: 7000 });
          return '';
        }
        return copyText(link).then(function (ok) {
          S.toast(ok ? 'Share link copied. It holds your saves, so send it only to people you trust.' : 'Could not copy. Long project? Export a bundle instead.', { tone: ok ? 'ok' : 'warn' });
          return ok ? link : '';
        });
      });
    },
    copyText: copyText
  };

  function restoreFromHash() {
    var match = String(location.hash || '').match(/[#&]studio=([^&]+)/);
    if (!match) return;
    decodeState(decodeURIComponent(match[1])).then(function (payload) {
      if (!payload || payload.kind !== 'jvds-studio-share' || !payload.saves) return;
      var count = Object.keys(payload.saves).length;
      if (!count) return;
      var preview = Object.keys(payload.saves).slice(0, 6).map(function (k) {
        return h('li', { text: k + '  (' + humanBytes((payload.saves[k] || '').length * 2) + ')' });
      });
      var dismiss = function () {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      };
      var modal = S.modal({
        title: 'Someone shared a project with you',
        body: h('div', {}, [
          h('p', { text: 'This link holds ' + count + ' saved item(s) from ' + (payload.tool || 'a studio tool') + '. Restoring replaces the matching saves in this browser.', style: { lineHeight: '1.6' } }),
          h('ul', { class: 'jvs-list' }, preview)
        ]),
        actions: [
          h('button', { type: 'button', text: 'Not now', onclick: function () { dismiss(); modal.close(); } }),
          h('button', {
            type: 'button',
            class: 'jvs-btn-primary',
            text: 'Restore this project',
            onclick: function () {
              var written = applySaves(payload.saves);
              S.toast('Restored ' + written + ' saved item(s). Reloading...', { tone: 'ok' });
              setTimeout(function () { location.reload(); }, 900);
            }
          })
        ],
        onClose: dismiss
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Storage module (lazy)                                             */
  /* ---------------------------------------------------------------- */

  var loaded = {};
  function loadModule(name) {
    if (S[name] && S[name]._ready) return Promise.resolve(S[name]);
    if (loaded[name]) return loaded[name];
    loaded[name] = new Promise(function (resolve, reject) {
      var script = D.createElement('script');
      script.src = '/assets/js/studio/studio-' + name + '.js';
      script.async = true;
      script.onload = function () {
        var api = S[name];
        if (api) api._ready = true;
        resolve(api || true);
      };
      script.onerror = function () { reject(new Error('Could not load Studio ' + name)); };
      D.head.appendChild(script);
    });
    return loaded[name];
  }
  S.load = loadModule;

  /* ---------------------------------------------------------------- */
  /* Autosave                                                          */
  /* ---------------------------------------------------------------- */

  var autosaveTimer = null;
  var lastHash = '';

  function autosaveNow(label) {
    var s = allSettings();
    if (!s.autosave) return Promise.resolve(null);
    return loadModule('storage').then(function (storage) {
      var saves = collectSaves();
      var hash = savesHash(saves);
      if (hash === lastHash && !label) return null;
      lastHash = hash;
      return storage.saveSnapshot({
        label: label || 'Auto save',
        tool: S.tool,
        saves: saves,
        keep: s.keepRevisions,
        force: !!label
      }).then(function (snap) {
        try { D.dispatchEvent(new CustomEvent('jvds:autosave', { detail: snap })); } catch (e) {}
        return snap;
      });
    }).catch(function () { return null; });
  }

  function startAutosave() {
    var s = allSettings();
    if (!s.autosave) return;
    stopAutosave();
    var seconds = clamp(Number(s.autosaveSeconds) || 60, 15, 300);
    autosaveTimer = setInterval(function () { autosaveNow(); }, seconds * 1000);
    window.addEventListener('pagehide', function () { autosaveNow('Session end'); });
    idle(function () { autosaveNow('Session start'); });
  }

  function stopAutosave() {
    if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; }
  }

  S.autosave = {
    start: startAutosave,
    stop: stopAutosave,
    now: autosaveNow
  };

  /* ---------------------------------------------------------------- */
  /* Multi-tab guard                                                   */
  /* ---------------------------------------------------------------- */

  function hookMultiTab() {
    W.addEventListener('storage', function (e) {
      if (!e.key || e.key === SETTINGS_KEY) return;
      if (!SAVE_PREFIX.test(e.key)) return;
      if (e.key === LAST_TAB_KEY) return;
      var last = 0;
      try { last = Number(sessionStorage.getItem(LAST_TAB_KEY) || 0); } catch (err) {}
      if (Date.now() - last < 8000) return;
      try { sessionStorage.setItem(LAST_TAB_KEY, String(Date.now())); } catch (err) {}
      S.toast('Another tab changed your save. Reload this tab before editing so neither copy is lost.', { tone: 'warn', timeout: 9000 });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Pointer / RAF / DOM / lifecycle / layout / worker helpers          */
  /* ---------------------------------------------------------------- */

  S.pointer = {
    on: function (el, handlers, opts) {
      opts = opts || {};
      var down = false;
      function pos(e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        return { x: x, y: y, nx: rect.width ? x / rect.width : 0, ny: rect.height ? y / rect.height : 0, pressure: e.pressure || 0, pointerType: e.pointerType || 'mouse' };
      }
      function onDown(e) {
        if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return;
        down = true;
        if (opts.capture !== false && el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
        if (handlers.down) handlers.down(pos(e), e);
      }
      function onMove(e) {
        if (handlers.move && (down || opts.hover)) handlers.move(pos(e), e);
        if (down && opts.preventDefault !== false && e.cancelable) e.preventDefault();
      }
      function onUp(e) {
        if (!down) return;
        down = false;
        if (handlers.up) handlers.up(pos(e), e);
      }
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove, { passive: opts.passive === true });
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      if (opts.touchAction !== false) el.style.touchAction = 'none';
      return {
        off: function () {
          el.removeEventListener('pointerdown', onDown);
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
        }
      };
    }
  };

  S.raf = {
    loop: function (fn) {
      var running = true;
      var last = performance.now();
      function frame(now) {
        if (!running) return;
        var dt = Math.min(100, now - last);
        last = now;
        try { fn(dt / 1000, now); } catch (e) { running = false; throw e; }
        if (running) W.requestAnimationFrame(frame);
      }
      W.requestAnimationFrame(frame);
      var onHide = function () { if (D.hidden) { running = false; } };
      D.addEventListener('visibilitychange', onHide);
      return function stop() {
        running = false;
        D.removeEventListener('visibilitychange', onHide);
      };
    }
  };

  S.dom = {
    batch: function (parent, nodes) {
      var frag = D.createDocumentFragment();
      (nodes || []).forEach(function (node) { if (node) frag.appendChild(node); });
      parent.appendChild(frag);
      return parent;
    },
    eachChunk: function (items, size, render) {
      var i = 0;
      size = size || 50;
      function step() {
        if (i >= items.length) return;
        var slice = items.slice(i, i + size);
        i += size;
        render(slice);
        if (i < items.length) idle(step);
      }
      step();
    }
  };

  /* ---------------------------------------------------------------- */
  /* Code style: indentation, wrappers and a readable copy             */
  /* ---------------------------------------------------------------- */

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var box = el.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    var style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function findCode() {
    var codeEl = D.querySelector('code.csg-code, [id^="code-"]');
    if (codeEl && codeEl.querySelector('.code-line')) {
      return Array.prototype.slice.call(codeEl.querySelectorAll('.code-line')).map(function (line) {
        return line.textContent;
      }).join('\n');
    }
    var blocks = Array.prototype.slice.call(D.querySelectorAll('pre code, pre, textarea')).filter(isVisible);
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      var text = el.value != null ? el.value : el.textContent;
      if (text && text.trim()) return text;
    }
    return '';
  }

  function indentColumns(line) {
    var match = String(line).match(/^[ \t]*/);
    var lead = match ? match[0] : '';
    var cols = 0;
    for (var i = 0; i < lead.length; i++) cols += lead.charAt(i) === '\t' ? 2 : 1;
    return cols;
  }

  function restyle(text, opts) {
    opts = opts || {};
    var target = opts.indent || allSettings().indent || '2';
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var unit = 2;
    for (var i = 0; i < lines.length; i++) {
      var cols = indentColumns(lines[i]);
      if (cols > 0) { unit = cols; break; }
    }
    var out = lines.map(function (line) {
      if (!line.trim()) return '';
      var cols = indentColumns(line);
      var level = unit ? Math.round(cols / unit) : 0;
      var pad = target === 'tab' ? new Array(level + 1).join('\t') : new Array(level * (Number(target) || 2) + 1).join(' ');
      return pad + line.replace(/^[ \t]+/, '');
    });
    return out.join('\n');
  }

  function wrapCode(text, opts) {
    opts = opts || {};
    var wrapper = opts.wrapper || allSettings().wrapper || 'none';
    var s = allSettings();
    var indent = s.indent === 'tab' ? '\t' : new Array((Number(s.indent) || 2) + 1).join(' ');
    var body = restyle(text, { indent: s.indent }).split('\n').map(function (line) {
      return line ? indent + line : '';
    }).join('\n');
    if (wrapper === 'function') return 'function main() {\n' + body + '\n}\n\nmain();\n';
    if (wrapper === 'iife') return '(function () {\n' + indent + "'use strict';\n" + body + '\n})();\n';
    if (wrapper === 'html') {
      return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + indent + '<meta charset="utf-8">\n' +
        indent + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        indent + '<title>My game</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
    }
    return restyle(text, { indent: s.indent }) + '\n';
  }

  S.code = {
    find: findCode,
    restyle: restyle,
    wrap: wrapCode,
    copy: function (opts) {
      var code = findCode();
      if (!code) { S.toast('No code found on this page. Open a snippet first.', { tone: 'warn' }); return Promise.resolve(false); }
      var styled = wrapCode(code, opts || {});
      return copyText(styled).then(function (ok) {
        S.toast(ok ? 'Styled code copied.' : 'Could not copy the code.', { tone: ok ? 'ok' : 'warn' });
        return ok;
      });
    }
  };

  S.lifecycle = {
    onLeave: function (fn) {
      var run = function () { try { fn(); } catch (e) {} };
      W.addEventListener('pagehide', run, { once: true });
      W.addEventListener('beforeunload', run, { once: true });
      return function () {
        W.removeEventListener('pagehide', run);
        W.removeEventListener('beforeunload', run);
      };
    }
  };

  S.layout = {
    threePane: function (root) {
      if (!root) return null;
      root.classList.add('jvs-3pane');
      return {
        toggleLeft: function () { root.dataset.left = root.dataset.left === 'collapsed' ? '' : 'collapsed'; },
        toggleRight: function () { root.dataset.right = root.dataset.right === 'collapsed' ? '' : 'collapsed'; }
      };
    },
    autoOverflow: function (bar, opts) {
      if (!bar) return function () {};
      opts = opts || {};
      bar.classList.add('jvs-toolbar');
      var more = h('details', { class: 'jvs-toolbar-more' }, [
        h('summary', { 'aria-label': 'More tools', text: 'More' }),
        h('div', {})
      ]);
      bar.appendChild(more);
      var menu = more.querySelector('div');
      function measure() {
        if (more.open) return;
        var children = Array.prototype.slice.call(bar.children).filter(function (el) { return el !== more; });
        children.forEach(function (el) { if (el.dataset.jvsOverflow) { menu.removeChild(el); bar.insertBefore(el, more); delete el.dataset.jvsOverflow; } });
        var limit = opts.limit || bar.clientWidth;
        var used = 0;
        children.forEach(function (el) {
          used += el.getBoundingClientRect().width + 6;
          if (used > limit * 0.72) { el.dataset.jvsOverflow = '1'; menu.appendChild(el); }
        });
      }
      if ('ResizeObserver' in W) {
        var ro = new W.ResizeObserver(measure);
        ro.observe(bar);
      } else {
        W.addEventListener('resize', measure);
      }
      measure();
      return measure;
    }
  };

  S.worker = {
    create: function (fn, opts) {
      var source = typeof fn === 'function' ? '(' + fn.toString() + ')()' : String(fn);
      var blob = new Blob([source], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      var worker = new Worker(url, opts);
      S.lifecycle.onLeave(function () { try { worker.terminate(); } catch (e) {} URL.revokeObjectURL(url); });
      return worker;
    },
    run: function (kind, data) {
      var source = function () {
        self.onmessage = function (e) {
          var kind = e.data.kind;
          var data = e.data.data;
          var out;
          if (kind === 'crunch') {
            out = String(data.text || '').replace(/\s+/g, ' ').trim();
          } else if (kind === 'search') {
            var q = String(data.query || '').toLowerCase();
            out = (data.items || []).filter(function (item) {
              return String(item).toLowerCase().indexOf(q) !== -1;
            });
          } else {
            out = data;
          }
          self.postMessage({ kind: kind, result: out });
        };
      };
      var worker = S.worker.create(source);
      return new Promise(function (resolve, reject) {
        worker.onmessage = function (e) { resolve(e.data.result); worker.terminate(); };
        worker.onerror = function (e) { reject(e); worker.terminate(); };
        worker.postMessage({ kind: kind, data: data });
      });
    }
  };

  S.metadata = {
    stamp: function () {
      var s = allSettings();
      var bits = [];
      if (s.author) bits.push('Made by ' + s.author);
      if (s.watermark) bits.push('JVDesignStudio');
      if (s.license) bits.push(s.license);
      return bits.join(' | ');
    },
    applyToCanvas: function (canvas) {
      var s = allSettings();
      if (!canvas || !s.watermark) return canvas;
      try {
        var ctx = canvas.getContext('2d');
        var text = 'JVDesignStudio' + (s.author ? ' / ' + s.author : '');
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.font = Math.max(10, Math.round(canvas.width / 50)) + 'px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 3;
        var pad = Math.round(canvas.width / 60);
        ctx.textAlign = 'right';
        ctx.strokeText(text, canvas.width - pad, canvas.height - pad);
        ctx.fillText(text, canvas.width - pad, canvas.height - pad);
        ctx.restore();
      } catch (e) {}
      return canvas;
    }
  };

  S.print = function () {
    try { W.print(); } catch (e) {}
  };

  S.board = {
    report: function (summary) {
      var s = allSettings();
      var lines = [
        'Studio report',
        'Tool: ' + (S.tool || location.pathname),
        'Page: ' + location.href,
        'Browser: ' + navigator.userAgent,
        'When: ' + new Date().toISOString(),
        'Theme: ' + S.theme.resolved(),
        'Storage: ' + (quotaState.source === 'local' ? humanBytes(quotaState.usage) + ' (estimated)' : humanBytes(quotaState.usage) + ' of ' + humanBytes(quotaState.quota)),
        'Settings: ' + JSON.stringify(s),
        '',
        'What happened:',
        summary || '(describe what you expected and what happened)'
      ];
      var text = lines.join('\n');
      S.modal({
        title: 'Report a problem',
        body: h('div', {}, [
          h('p', { text: 'Copy this into a board card or an email. No project data is included.', style: { lineHeight: '1.6' } }),
          h('label', { class: 'jvs-field' }, [
            h('span', { text: 'What happened?' }),
            h('textarea', { id: 'jvsReportText', text: summary || '' })
          ])
        ]),
        actions: [
          h('button', { type: 'button', text: 'Close', onclick: function () { this.closest('.jvs-modal-wrap').remove(); } }),
          h('button', {
            type: 'button',
            class: 'jvs-btn-primary',
            text: 'Copy report',
            onclick: function () {
              var area = D.getElementById('jvsReportText');
              lines[lines.length - 1] = area ? area.value : '';
              copyText(lines.join('\n')).then(function (ok) {
                S.toast(ok ? 'Report copied. Paste it into the board.' : 'Could not copy the report.', { tone: ok ? 'ok' : 'warn' });
              });
            }
          })
        ]
      });
    }
  };

  /* ---------------------------------------------------------------- */
  /* The Studio tools panel                                            */
  /* ---------------------------------------------------------------- */

  var panel = null;

  function section(title, children, open) {
    return h('details', { class: 'jvs-accordion', open: !!open }, [
      h('summary', { text: title }),
      h('div', {}, children)
    ]);
  }

  function quotaBlock() {
    var meter = h('div', { class: 'jvs-meter', 'data-state': 'ok', role: 'progressbar', 'aria-label': 'Browser storage used', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, [h('span')]);
    var label = h('div', { class: 'jvs-meta' }, [h('span', { text: 'Checking storage...' }), h('span', { text: '' })]);
    function update() {
      estimateQuota().then(function (q) {
        var pct = Math.round(q.ratio * 100);
        meter.dataset.state = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : 'ok';
        meter.querySelector('span').style.width = clamp(pct, 1, 100) + '%';
        meter.setAttribute('aria-valuenow', String(pct));
        label.firstChild.textContent = humanBytes(q.usage) + ' used';
        label.lastChild.textContent = q.quota ? humanBytes(q.quota) + ' available' : 'estimated';
      });
    }
    update();
    D.addEventListener('jvds:quota', update);
    return h('div', { class: 'jvs-group' }, [
      h('div', { class: 'jvs-meta' }, [h('strong', { text: 'This device' }), h('span', { text: pctText() })]),
      meter,
      label,
      h('p', { class: 'jvs-hint', text: 'Saves live in this browser on this device. Export before you change computer.' })
    ]);
  }

  function pctText() { return 'saved locally'; }

  function revisionList(host) {
    host.innerHTML = '';
    host.appendChild(h('p', { class: 'jvs-hint', text: 'Loading revisions...' }));
    loadModule('storage').then(function (storage) {
      return storage.list().then(function (rows) {
        host.innerHTML = '';
        if (!rows.length) {
          host.appendChild(h('p', { class: 'jvs-hint', text: 'No snapshots yet. One is saved every minute while you work.' }));
          return;
        }
        var list = h('ul', { class: 'jvs-list' });
        rows.forEach(function (row) {
          list.appendChild(h('li', {}, [
            h('div', {}, [
              h('strong', { text: row.label || 'Snapshot' }),
              h('small', { text: new Date(row.at).toLocaleString() + '  -  ' + humanBytes(row.bytes || 0) })
            ]),
            h('button', {
              type: 'button',
              text: 'Restore',
              onclick: function () {
                S.confirm({
                  title: 'Restore this snapshot?',
                  message: 'This replaces the matching saves in this browser with the ones from ' + new Date(row.at).toLocaleString() + '.',
                  confirm: 'Restore'
                }).then(function (ok) {
                  if (!ok) return;
                  storage.get(row.id).then(function (snap) {
                    var written = applySaves(snap.saves || {});
                    S.toast('Restored ' + written + ' saved item(s). Reloading...', { tone: 'ok' });
                    setTimeout(function () { location.reload(); }, 900);
                  });
                });
              }
            })
          ]));
        });
        host.appendChild(list);
      });
    }).catch(function () {
      host.innerHTML = '';
      host.appendChild(h('p', { class: 'jvs-hint', text: 'This browser will not open the snapshot store. Use Export JSON instead.' }));
    });
  }

  function filePicker(accept, onFile) {
    var input = h('input', { type: 'file', accept: accept, style: { display: 'none' } });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) onFile(file);
      input.value = '';
    });
    D.body.appendChild(input);
    input.click();
    setTimeout(function () { if (input.parentNode) input.parentNode.removeChild(input); }, 30000);
  }

  var TOOL_TIPS = {
    'code-snippet-generator': ['Ember', 'Change one option at a time, then press Preview and Copy. Small changes are easier to understand.'],
    'gdd-builder': ['Lumo', 'Fill the one-sentence pitch first. Everything else is easier once the idea fits in one line.'],
    'pixel-studio': ['Ember', 'Start with one colour and a 16 by 16 canvas. A tiny sprite that exists beats a big one that is only planned.'],
    'sound-studio': ['Pip', 'Make a short sound first. Twelve short effects are more fun than one long track.'],
    'level-designer': ['Pip', 'Build one screen you can finish in 20 seconds, then test it with a friend.'],
    'arcade-game-maker': ['Pip', 'Play the starter game before you change anything. Notice the one moment that feels good.'],
    'sprite-animator': ['Ember', 'Four frames is enough for a first walk. Draw the start and end pose first, then fill the middle.'],
    'tabletop-studio': ['Stardust', 'Design the board small. A six by six board is easier to playtest than a huge one.']
  };

  function buildPanel() {
    var tips = [];
    var own = TOOL_TIPS[S.tool];
    if (own) tips.push(tip(own[0].charAt(0), own[0], own[1]));
    tips.push(tip('L', 'Lumo', 'Lumo says: export one copy before you try a big change. Then you can always come back.'));
    tips.push(tip('E', 'Echo', 'Echo asks: what is the one thing you want to improve next? Save, change it, compare.'));
    tips.push(tip('P', 'Pip', 'Pip says: press the share button to send a friend a link to exactly this project.'));
    tips = h('div', { class: 'jvs-tips' }, tips);

    var revisionsHost = h('div');
    var children = [
      h('div', { class: 'jvs-actions' }, [
        h('button', { type: 'button', class: 'jvs-btn-primary', text: 'Switch Studio menu light / dark', onclick: function () {
          S.theme.toggle();
          S.toast('Studio menu: ' + S.theme.resolved(), { tone: 'ok', timeout: 1800 });
        } })
      ]),
      quotaBlock(),
      section('Keep your work', [
        h('div', { class: 'jvs-actions' }, [
          h('button', { type: 'button', class: 'jvs-btn-primary', text: 'Save a snapshot', onclick: function () {
            autosaveNow('Manual snapshot').then(function (snap) {
              if (!snap) { S.toast('Nothing to snapshot yet. Make something first.', { tone: 'warn' }); return; }
              S.toast('Snapshot saved in this browser.', { tone: 'ok' });
              revisionList(revisionsHost);
            }).catch(friendlyError);
          } }),
          h('button', { type: 'button', text: 'Export bundle (.jvzip)', onclick: function () { S.bundle.export().catch(friendlyError); } }),
          h('button', { type: 'button', text: 'Export JSON', onclick: function () { S.bundle.exportJSON().catch(friendlyError); } }),
          h('button', { type: 'button', text: 'Import a file', onclick: function () { filePicker('.json,.zip,.jvzip,application/json', function (file) { S.bundle.import(file).catch(friendlyError); }); } })
        ]),
        h('p', { class: 'jvs-hint', text: 'Export is the only copy that leaves this device. Keep it somewhere safe.' })
      ], true),
      section('Revision history', [
        revisionsHost,
        h('button', { type: 'button', text: 'Refresh list', onclick: function () { revisionList(revisionsHost); } })
      ]),
      section('Share a project', [
        h('div', { class: 'jvs-actions' }, [
          h('button', { type: 'button', class: 'jvs-btn-primary', text: 'Copy share link', onclick: function () { S.share.copy(); } }),
          h('button', { type: 'button', text: 'Copy report code', onclick: function () { S.board.report(''); } })
        ]),
        h('p', { class: 'jvs-hint', text: 'The link is compressed and lives in the URL. Very large projects should travel as a bundle instead.' })
      ]),
      section('Print or save a PDF', [
        h('p', { class: 'jvs-hint', text: 'Print styles hide the toolbars and keep your writing and images on the page.' }),
        h('button', { type: 'button', text: 'Print this page', onclick: function () { S.print(); } })
      ]),
      section('Start from a template', [
        h('p', { class: 'jvs-hint', text: 'Small, safe starters you can load and then make your own.' }),
        h('button', { type: 'button', text: 'Open templates', onclick: function () { S.templates.open(); } })
      ]),
      section('Check accessibility', [
        h('p', { class: 'jvs-hint', text: 'Checks contrast, image text alternatives, tiny text and tab order on this page.' }),
        h('button', { type: 'button', text: 'Run the check', onclick: function () { S.inspector.run(); } })
      ]),
      section('Settings', [
        h('label', { class: 'jvs-field' }, [
          h('span', { text: 'Studio menu theme' }),
          h('select', {
            onchange: function () { S.theme.set(this.value); }
          }, [
            h('option', { value: 'system', text: 'Match this device' }),
            h('option', { value: 'light', text: 'Light' }),
            h('option', { value: 'dark', text: 'Dark' })
          ])
        ]),
        h('label', { class: 'jvs-field' }, [
          h('span', { text: 'Layout density' }),
          h('select', {
            onchange: function () { S.settings.set('density', this.value); applySettings(); }
          }, [
            h('option', { value: 'comfortable', text: 'Comfortable' }),
            h('option', { value: 'compact', text: 'Compact' })
          ])
        ]),
        h('label', { class: 'jvs-field' }, [
          h('span', { text: 'Auto-save every (seconds)' }),
          h('input', { type: 'number', min: '15', max: '300', step: '15', onchange: function () { S.settings.set('autosaveSeconds', clamp(Number(this.value) || 60, 15, 300)); startAutosave(); } })
        ]),
        h('label', { class: 'jvs-field' }, [
          h('span', { text: 'Your name (used on exports)' }),
          h('input', { type: 'text', maxlength: '60', placeholder: 'Optional', oninput: function () { S.settings.set('author', this.value); } })
        ]),
        h('label', { class: 'jvs-field' }, [
          h('span', { text: 'Licence note' }),
          h('input', { type: 'text', maxlength: '80', placeholder: 'e.g. CC BY 4.0', oninput: function () { S.settings.set('license', this.value); } })
        ]),
        h('label', { class: 'jvs-row' }, [
          h('span', { text: 'Add studio watermark to image exports' }),
          h('input', { type: 'checkbox', onchange: function () { S.settings.set('watermark', this.checked); } })
        ])
      ]),
      section('Code style', [
        h('label', { class: 'jvs-field' }, [
          h('span', { text: 'Indentation' }),
          h('select', { id: 'jvsIndent', onchange: function () { S.settings.set('indent', this.value); } }, [
            h('option', { value: '2', text: '2 spaces' }),
            h('option', { value: '4', text: '4 spaces' }),
            h('option', { value: 'tab', text: 'Tabs' })
          ])
        ]),
        h('label', { class: 'jvs-field' }, [
          h('span', { text: 'Wrapper' }),
          h('select', { id: 'jvsWrapper', onchange: function () { S.settings.set('wrapper', this.value); } }, [
            h('option', { value: 'none', text: 'Bare code' }),
            h('option', { value: 'function', text: 'Function + call' }),
            h('option', { value: 'iife', text: 'Strict IIFE' }),
            h('option', { value: 'html', text: 'Full HTML page' })
          ])
        ]),
        h('p', { class: 'jvs-hint', text: 'Reads the code on this page, restyles the indentation and copies it ready to paste.' }),
        h('button', { type: 'button', class: 'jvs-btn-primary', text: 'Copy styled code', onclick: function () { S.code.copy(); } })
      ]),
      section('Character tips', [tips]),
      section('This device', [
        h('p', { class: 'jvs-hint', text: 'Saves stay in this browser. Clearing browser data deletes them. On a school computer, export before you log off.' }),
        h('div', { class: 'jvs-actions' }, [
          h('button', { type: 'button', text: 'Clear revision history', class: 'jvs-btn-danger', onclick: function () {
            S.confirm({ title: 'Clear revisions?', message: 'This deletes the snapshots, not your current saves.', confirm: 'Clear revisions', danger: true }).then(function (ok) {
              if (!ok) return;
              loadModule('storage').then(function (storage) { return storage.clear(); }).then(function () { revisionList(revisionsHost); S.toast('Revision history cleared.', { tone: 'ok' }); });
            });
          } }),
          h('button', { type: 'button', text: 'Report a problem', onclick: function () { S.board.report(''); } })
        ])
      ])
    ];

    // Wire current settings into the controls after they are in the DOM.
    var wrap = h('div', {}, children);
    var s = allSettings();
    var selects = wrap.querySelectorAll('select');
    if (selects[0]) selects[0].value = s.theme;
    if (selects[1]) selects[1].value = s.density;
    if (selects[2]) selects[2].value = s.indent;
    if (selects[3]) selects[3].value = s.wrapper;
    var number = wrap.querySelector('input[type="number"]');
    if (number) number.value = s.autosaveSeconds;
    var text = wrap.querySelector('input[type="text"]');
    if (text) text.value = s.author || '';
    var licence = wrap.querySelectorAll('input[type="text"]')[1];
    if (licence) licence.value = s.license || '';
    var check = wrap.querySelector('input[type="checkbox"]');
    if (check) check.checked = !!s.watermark;

    revisionList(revisionsHost);
    return wrap;
  }

  function tip(letter, name, text) {
    return h('div', { class: 'jvs-tip' }, [
      h('span', { class: 'jvs-tip-avatar', 'aria-hidden': 'true', text: letter }),
      h('div', {}, [h('strong', { text: name }), h('p', { text: text })])
    ]);
  }

  function friendlyError(err) {
    var text = (err && err.message) || 'That did not work. Try Export JSON instead.';
    S.toast('Echo says: ' + text, { tone: 'warn', timeout: 8000 });
  }

  S.panel = {
    open: function () {
      if (panel) return panel;
      panel = createSheet({ title: 'Studio tools', children: [buildPanel()], onClose: function () { panel = null; } });
      return panel;
    },
    close: function () { if (panel) panel.close(); panel = null; },
    toggle: function () { if (panel) S.panel.close(); else S.panel.open(); }
  };

  /* ---------------------------------------------------------------- */
  /* First-run walkthrough                                             */
  /* ---------------------------------------------------------------- */

  var TOUR = [
    { title: 'Make something small', text: 'Pick one tool and make the smallest version you can. You can improve it after it exists.' },
    { title: 'Keep your work', text: 'Open Studio tools and export a copy. Saves live in this browser, not on a server.' },
    { title: 'Share or print', text: 'Copy a link to send your project, or print it as a PDF for your folder.' }
  ];

  function maybeTour() {
    var s = allSettings();
    if (s.seenWalkthrough || !S.tool) return;
    setTimeout(function () {
      var step = 0;
      var overlay = h('div', { class: 'jvs-tour', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'jvsTourTitle' });
      var card = h('div', { class: 'jvs-tour-card' });
      overlay.appendChild(card);
      var release = trapFocus(overlay, finish);
      function draw() {
        var item = TOUR[step];
        card.innerHTML = '';
        card.appendChild(h('div', { class: 'jvs-tour-steps', 'aria-hidden': 'true' }, TOUR.map(function (_, i) {
          return h('span', { class: 'jvs-tour-dot', 'data-active': i === step ? 'true' : 'false' });
        })));
        card.appendChild(h('h2', { id: 'jvsTourTitle', text: item.title }));
        card.appendChild(h('p', { text: item.text }));
        card.appendChild(h('div', { class: 'jvs-tour-actions' }, [
          h('button', { type: 'button', text: 'Skip', onclick: finish }),
          h('button', { type: 'button', class: 'jvs-btn-primary', text: step === TOUR.length - 1 ? 'Start making' : 'Next', onclick: function () { step++; if (step >= TOUR.length) finish(); else draw(); } })
        ]));
      }
      function finish() {
        release();
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        S.settings.set('seenWalkthrough', true);
      }
      draw();
      D.body.appendChild(overlay);
    }, 1800);
  }

  /* ---------------------------------------------------------------- */
  /* Boot                                                              */
  /* ---------------------------------------------------------------- */

  function ensureFab() {
    if (D.getElementById('jvsStudioFab')) return;
    if (D.querySelector('[data-studio-hide-fab]')) return;
    var fab = h('button', {
      id: 'jvsStudioFab',
      class: 'jvs-fab',
      type: 'button',
      'aria-label': 'Open Studio tools',
      'aria-haspopup': 'dialog',
      title: 'Studio tools (Alt+Shift+S)',
      onclick: function () { S.panel.toggle(); }
    }, [
      h('span', { class: 'jvs-fab-icon', 'aria-hidden': 'true', text: '+' }),
      h('span', { class: 'jvs-fab-label', text: 'Studio' })
    ]);
    D.body.appendChild(fab);
  }

  function boot() {
    try { applySettings(); } catch (e) {}
    try { hookStorageErrors(); } catch (e) {}
    if (!isToolPage()) return;
    try { ensureFab(); } catch (e) {}
    try { watchQuota(); } catch (e) {}
    try { hookMultiTab(); } catch (e) {}
    try {
      idle(function () {
        loadModule('storage').then(function () { startAutosave(); }).catch(function () {});
      });
    } catch (e) {}
    try { restoreFromHash(); } catch (e) {}
    try { maybeTour(); } catch (e) {}
    D.addEventListener('keydown', function (e) {
      if (e.altKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        var tag = (D.activeElement && D.activeElement.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        S.panel.toggle();
      }
    });
    try { S.lifecycle.onLeave(function () { autosaveNow('Leaving'); }); } catch (e) {}
  }

  ready(boot);

  /* ---------------------------------------------------------------- */
  /* Expose lazy module proxies that load on first use                 */
  /* ---------------------------------------------------------------- */

  ['storage', 'bundle', 'preview', 'inspector', 'templates'].forEach(function (name) {
    if (S[name]) return;
    S[name] = {};
    ['saveSnapshot', 'list', 'get', 'restore', 'prune', 'clear', 'estimate', 'usable', 'putAsset', 'getAsset', 'deleteAsset', 'listAssets', 'export', 'exportJSON', 'import', 'open', 'run', 'apply', 'download'].forEach(function (method) {
      S[name][method] = function () {
        var args = arguments;
        return loadModule(name).then(function (api) {
          if (!api || typeof api[method] !== 'function') throw new Error('Studio ' + name + ' is not available.');
          return api[method].apply(api, args);
        });
      };
    });
  });
})();
