/* jvds-funnel.js - first-creation funnel for JVDesignStudio.
 *
 * Tracks one number: the share of sessions where a learner makes something and
 * saves, exports or shares it. Fires three GA4 events, once per session:
 *   first_create_start    - the learner started interacting with the surface
 *   first_create_complete - a creation was exported or saved
 *   first_create_share    - a creation was shared
 *
 * Consent Mode v2 (analytics-loader.js) gates delivery, so these are safe to
 * call unconditionally. No PII. Every event carries section, page_path,
 * page_id and surface so the studio can filter by type.
 *
 * API: window.JVDSFunnel = { start(d), complete(d), share(d), raw(event, params) }
 * Tools can also dispatch document/window events 'jvds:created' and 'jvds:shared'.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSFunnel) return;

  var SESSION_PREFIX = 'jvds_funnel_';
  var NAMES = { start: 'first_create_start', complete: 'first_create_complete', share: 'first_create_share' };
  var HUB_PAGES = ['/', '/index.html', '/arcade.html', '/workshop.html', '/create', '/dev-tools.html', '/dev-tools', '/learn-hub.html'];
  var GAME_SECTION = /^\/(games)\//;

  function section() {
    var m = location.pathname.match(/^\/(tools|workshops|games|books)\//);
    return m ? m[1] : 'site';
  }
  function pageId() {
    return (location.pathname.split('/').pop() || 'page').replace(/\.html$/, '');
  }
  function sentThisSession(step) {
    try { return sessionStorage.getItem(SESSION_PREFIX + step) === '1'; }
    catch (e) { return false; }
  }
  function markSent(step) {
    try { sessionStorage.setItem(SESSION_PREFIX + step, '1'); } catch (e) {}
  }
  function emit(event, params) {
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', event, params); return true; } catch (e) { return false; }
    }
    if (window.dataLayer && typeof window.dataLayer.push === 'function') {
      try { window.dataLayer.push(['event', event, params]); return true; } catch (e) { return false; }
    }
    return false;
  }
  function fire(step, detail) {
    var event = NAMES[step];
    if (!event) return false;
    var surface = (detail && detail.surface) || section();
    var key = step + '_' + surface;
    if (sentThisSession(key)) return false;
    var params = { section: section(), page_path: location.pathname, page_id: pageId(), surface: surface };
    if (detail) { for (var k in detail) { if (detail[k] != null) params[k] = detail[k]; } }
    var ok = emit(event, params);
    if (ok) markSent(key);
    return ok;
  }

  // A2618: privacy-safe, local-only funnel ledger. These steps never call
  // gtag or fetch; they only write counters in localStorage so the first
  // creation path survives a reload and can be inspected on this device.
  // Nothing leaves the device, so this works without consent. The GA4 events
  // above stay consent-gated as before.
  var LOCAL_KEY = 'jvds_funnel_local';
  var LOCAL_STEPS = ['home_first_make_opened', 'studio_opened', 'first_pixel_painted', 'first_save', 'first_export'];

  function readLocal() {
    try {
      var o = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if (!o || typeof o !== 'object' || Array.isArray(o)) o = { v: 1, counts: {}, order: [], firstSeen: Date.now() };
      if (!o.counts || typeof o.counts !== 'object' || Array.isArray(o.counts)) o.counts = {};
      if (!Array.isArray(o.order)) o.order = [];
      if (!o.firstSeen) o.firstSeen = Date.now();
      return o;
    } catch (e) {
      return { v: 1, counts: {}, order: [], firstSeen: Date.now() };
    }
  }
  function writeLocal(o) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function localStep(step, detail) {
    if (!step) return false;
    var o = readLocal();
    o.lastSeen = Date.now();
    o.counts[step] = (o.counts[step] || 0) + 1;
    if (o.order.indexOf(step) === -1) o.order.push(step);
    if (detail && typeof detail === 'object' && detail.surface) o.lastSurface = String(detail.surface);
    return writeLocal(o);
  }
  function localOnce(step, detail) {
    var o = readLocal();
    if (o.counts[step] > 0) return false;
    return localStep(step, detail);
  }
  function localReport() { return readLocal(); }

  var JVDSFunnel = {
    start: function (d) { return fire('start', d); },
    complete: function (d) { return fire('complete', d); },
    share: function (d) { return fire('share', d); },
    raw: function (name, params) { return emit(name, params || {}); },
    steps: function () { return Object.keys(NAMES); },
    local: localStep,
    localOnce: localOnce,
    localReport: localReport,
    LOCAL_KEY: LOCAL_KEY,
    LOCAL_STEPS: LOCAL_STEPS
  };

  function onFirstInteraction() {
    JVDSFunnel.start({ trigger: 'interaction' });
    document.removeEventListener('pointerdown', onFirstInteraction, true);
    document.removeEventListener('keydown', onFirstInteraction, true);
    document.removeEventListener('touchstart', onFirstInteraction, true);
  }
  document.addEventListener('pointerdown', onFirstInteraction, true);
  document.addEventListener('keydown', onFirstInteraction, true);
  document.addEventListener('touchstart', onFirstInteraction, true);

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a) JVDSFunnel.complete({ trigger: 'download' });
  }, true);

  window.addEventListener('jvds:created', function () { JVDSFunnel.complete({ trigger: 'event' }); });
  window.addEventListener('jvds:shared', function () { JVDSFunnel.share({ trigger: 'event' }); });

  if (navigator.share && !navigator._jvdsFunnelWrapped) {
    try {
      var origShare = navigator.share.bind(navigator);
      navigator.share = function (data) { JVDSFunnel.share({ trigger: 'native' }); return origShare(data); };
      navigator._jvdsFunnelWrapped = true;
    } catch (e) {}
  }

  // ── Arrival hub ──────────────────────────────────────────────────────────
  // Fire once per session when landing on a major hub page.
  (function fireArrival() {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var isHub = HUB_PAGES.indexOf(path) !== -1 || HUB_PAGES.indexOf(path + '.html') !== -1;
    if (!isHub) return;
    if (sentThisSession('arrival_hub')) return;
    var ok = emit('arrival_hub', { section: 'hub', page_path: path, page_id: pageId() });
    if (ok) markSent('arrival_hub');
  })();

  // ── Play start ───────────────────────────────────────────────────────────
  // Fire once per session on game pages when the learner interacts.
  (function wirePlayStart() {
    if (!GAME_SECTION.test(location.pathname)) return;
    function onPlay() {
      if (sentThisSession('play_start')) return;
      var ok = emit('play_start', { section: 'games', page_path: location.pathname, page_id: pageId() });
      if (ok) markSent('play_start');
      document.removeEventListener('pointerdown', onPlay, true);
      document.removeEventListener('keydown', onPlay, true);
    }
    document.addEventListener('pointerdown', onPlay, true);
    document.addEventListener('keydown', onPlay, true);
  })();

  // ── Return visit ─────────────────────────────────────────────────────────
  // Fire once per session when a learner who has visited before comes back.
  (function fireReturn() {
    var VISIT_KEY = 'jvds_visited';
    var hasVisited = false;
    try { hasVisited = !!localStorage.getItem(VISIT_KEY); } catch(e) {}
    if (hasVisited && !sentThisSession('return_visit')) {
      var ok = emit('return_visit', { section: section(), page_path: location.pathname, page_id: pageId() });
      if (ok) markSent('return_visit');
    }
    try { localStorage.setItem(VISIT_KEY, '1'); } catch(e) {}
  })();

  // A2618: wire the local first-creation steps without editing each tool page.
  (function wireLocalFunnel() {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var isHome = path === '/' || path === '/index.html';
    var isPixel = /^\/tools\/pixel-studio(\.html)?$/.test(location.pathname);

    // Pixel Studio opened.
    if (isPixel) localOnce('studio_opened', { surface: 'tools' });

    // Homepage first-make opened: the section scrolls into view, or the CTA is used.
    if (isHome) {
      var sectionEl = document.getElementById('first-make');
      if (sectionEl && typeof IntersectionObserver === 'function') {
        try {
          var io = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].isIntersecting) {
                localOnce('home_first_make_opened', { surface: 'site' });
                io.disconnect();
                return;
              }
            }
          }, { threshold: 0.4 });
          io.observe(sectionEl);
        } catch (e) {}
      }
      document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest
          ? e.target.closest('#fmStart, #first-make a[href*="pixel-studio"], [data-first-make]')
          : null;
        if (t) localOnce('home_first_make_opened', { surface: 'site' });
      }, true);
    }

    // First pixel painted: a real pointer, touch or mouse on Pixel Studio's canvas.
    if (isPixel) {
      var paint = function (e) {
        var t = e.target;
        if (t && t.id === 'main-canvas') localOnce('first_pixel_painted', { surface: 'tools' });
      };
      document.addEventListener('pointerdown', paint, true);
      document.addEventListener('touchstart', paint, true);
      document.addEventListener('mousedown', paint, true);
    }

    // First save: any Save control, or Ctrl/Cmd+S.
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest
        ? e.target.closest('[data-on="saveProject"],[data-on="saveStory"],[data-on="invokeSave"]')
        : null;
      if (t) localStep('first_save', { surface: section() });
    }, true);
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        localStep('first_save', { surface: section() });
      }
    }, true);

    // First export/download: export controls, download links and the shared
    // standalone-export event from creation-standalone.js.
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest
        ? e.target.closest('[data-on^="export"],a[download],[data-on="downloadProjectBundle"],[data-on="sendGameToFriend"]')
        : null;
      if (t) localStep('first_export', { surface: section() });
    }, true);
    window.addEventListener('jvds:standalone-exported', function () {
      localStep('first_export', { surface: section() });
    });
  })();

  // Dev-only view: /me.html?funnel=1 shows the local first-creation ledger.
  (function renderDevFunnel() {
    if (!/[?&]funnel=1/.test(location.search)) return;
    if (!/\/(me|me\.html)$/.test(location.pathname)) return;
    var report = localReport();
    var steps = LOCAL_STEPS.map(function (s) { return s + ': ' + (report.counts[s] || 0); }).join(' | ');
    var box = document.createElement('div');
    box.id = 'jvds-funnel-debug';
    box.setAttribute('role', 'status');
    box.style.cssText = 'max-width:900px;margin:16px auto;padding:12px 16px;border:1px solid rgba(64,59,51,.2);' +
      'border-radius:10px;background:#fffdf8;color:#1a1208;font:600 .8rem/1.45 Inter,system-ui,sans-serif;';
    box.textContent = 'First-creation funnel (local only): ' + (steps || 'no steps yet') +
      '. Order: ' + (report.order.join(' -> ') || 'none') + '.';
    (document.body || document.documentElement).appendChild(box);
  })();

  window.JVDSFunnel = JVDSFunnel;
})();
