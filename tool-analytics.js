/* ═══════════════════════════════════════════════════════════════════════════
   tool-analytics.js — per-tool usage analytics on top of the existing GA4 setup.

   Include on tool pages AFTER analytics-loader.js has defined window.gtag:
     <script src="../tool-analytics.js"></script>

   GA4 already reports page views and average engagement time per URL, which
   answers "which tool is opened most". This adds the parts GA4 cannot infer:

     tool_open      once per visit          { tool_id }
     tool_time      at engaged-time milestones
                                            { tool_id, seconds }
     tool_engaged   once, when leaving      { tool_id, engaged_seconds }
     tool_action    whenever a tool reports a meaningful action
                                            { tool_id, action, label }

   "Engaged" time counts only while the tab is VISIBLE and the student has
   interacted within the last IDLE_MS. A tool left open in a background tab
   overnight therefore does not report twelve hours of use.

   Consent: the cookie banner promises Google Analytics only if accepted, so
   nothing is sent until 'jvds-cookie-consent' === 'accepted'. Events raised
   before a decision are buffered and flushed if the student accepts.

   Tools can report their own actions:
     ToolAnalytics.event('export', 'png');
     ToolAnalytics.event('template_used', 'fire');
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (!/\/tools\//.test(location.pathname)) return;

  var CONSENT_KEY = 'jvds-cookie-consent';
  var TOOL_ID = (location.pathname.split('/').pop() || 'tool').replace(/\.html$/, '');
  var IDLE_MS = 60000;                        // no input for this long = not engaged
  var MILESTONES = [15, 30, 60, 120, 300, 600, 1200];

  // ── consent ───────────────────────────────────────────────────────────────
  function consent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  var queue = [];
  function flushQueue() {
    if (consent() !== 'accepted') return;
    while (queue.length) {
      var q = queue.shift();
      try { window.gtag('event', q[0], q[1]); } catch (e) { /* gtag not ready */ }
    }
  }
  function send(name, params) {
    var p = params || {};
    p.tool_id = TOOL_ID;
    var c = consent();
    if (c === 'declined') return;             // respect the banner
    if (c !== 'accepted') { if (queue.length < 40) queue.push([name, p]); return; }
    if (typeof window.gtag !== 'function') { if (queue.length < 40) queue.push([name, p]); return; }
    try { window.gtag('event', name, p); } catch (e) { /* never break the tool */ }
  }
  // The banner writes the key then calls gtag; poll briefly so an accept mid-session
  // starts reporting without needing a reload.
  var consentPoll = setInterval(function () {
    if (consent() === 'accepted') { clearInterval(consentPoll); flushQueue(); }
    else if (consent() === 'declined') { clearInterval(consentPoll); queue.length = 0; }
  }, 2000);

  // ── engaged time ──────────────────────────────────────────────────────────
  var engagedMs = 0, lastTick = Date.now(), lastInput = Date.now();
  var hitMilestones = {}, finalSent = false;

  function engaged() { return !document.hidden && (Date.now() - lastInput) < IDLE_MS; }

  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastInput = Date.now(); },
      { passive: true, capture: true });
  });

  setInterval(function () {
    var now = Date.now();
    if (engaged()) engagedMs += now - lastTick;
    lastTick = now;

    var secs = Math.round(engagedMs / 1000);
    for (var i = 0; i < MILESTONES.length; i++) {
      var m = MILESTONES[i];
      if (secs >= m && !hitMilestones[m]) {
        hitMilestones[m] = true;
        send('tool_time', { seconds: m });
      }
    }
  }, 1000);

  // ── lifecycle ─────────────────────────────────────────────────────────────
  send('tool_open', {});

  function sendFinal() {
    if (finalSent) return;
    var secs = Math.round(engagedMs / 1000);
    if (secs < 3) return;                     // ignore instant bounces
    finalSent = true;
    send('tool_engaged', { engaged_seconds: secs });
  }
  // pagehide is the reliable one; visibilitychange->hidden covers mobile tab switches
  window.addEventListener('pagehide', sendFinal);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) sendFinal();
  });

  // ── automatic action tracking ─────────────────────────────────────────────
  // Programmatic downloads, the way most of these tools export.
  var origClick = HTMLAnchorElement.prototype.click;
  var lastExport = 0;
  function reportExport(label) {
    var now = Date.now();
    if (now - lastExport < 1200) return;      // dedupe multi-file exports
    lastExport = now;
    send('tool_action', { action: 'export', label: label || 'download' });
  }
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute && this.hasAttribute('download')) {
      var name = this.getAttribute('download') || '';
      var ext = (name.split('.').pop() || '').toLowerCase().slice(0, 12);
      setTimeout(function () { reportExport(ext || 'download'); }, 0);
    }
    return origClick.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a) {
      var name = a.getAttribute('download') || '';
      reportExport((name.split('.').pop() || 'download').toLowerCase().slice(0, 12));
    }
  }, true);

  // ── public API ────────────────────────────────────────────────────────────
  window.ToolAnalytics = {
    toolId: TOOL_ID,
    /* ToolAnalytics.event('template_used', 'fire') */
    event: function (action, label) {
      if (!action) return;
      send('tool_action', {
        action: String(action).slice(0, 40),
        label: label === undefined ? '' : String(label).slice(0, 60)
      });
    },
    /* Seconds of engaged time so far, for debugging. */
    engagedSeconds: function () { return Math.round(engagedMs / 1000); }
  };
})();
