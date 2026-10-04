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

  var JVDSFunnel = {
    start: function (d) { return fire('start', d); },
    complete: function (d) { return fire('complete', d); },
    share: function (d) { return fire('share', d); },
    raw: function (name, params) { return emit(name, params || {}); },
    steps: function () { return Object.keys(NAMES); }
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

  window.JVDSFunnel = JVDSFunnel;
})();
