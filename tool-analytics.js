/* ═══════════════════════════════════════════════════════════════════════════
   tool-analytics.js , per-tool usage analytics on top of the existing GA4 setup.

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

   The make funnel (A1550) adds one named event per step so the drop-off is
   visible in GA4 as a funnel, not inferred from free-form actions:

     tool_open          once per visit       { tool_id }
     tool_template_used a template started   { tool_id, label }
     tool_export        a finished export    { tool_id, label }
     tool_handoff_click an art hand-off      { tool_id, label }

   ToolAnalytics.readout() prints the local per-tool funnel and returns it with
   a template_to_export_rate, so the weakest tool can be found without guessing.

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

  // ── the make funnel (A1550) ───────────────────────────────────────────────
  // Named GA4 events, one per step, mapped to a short local step name.
  var FUNNEL_STEP = {
    tool_open: 'open',
    tool_template_used: 'template_used',
    tool_export: 'export',
    tool_handoff_click: 'handoff_click'
  };
  var FUNNEL_KEY = 'jvds_funnel_v1';

  // A small on-device tally so readout() can show the per-tool funnel. It is
  // first-party, never transmitted, so it is kept even before a consent choice.
  function tally(step) {
    if (!step) return;
    try {
      var all = JSON.parse(localStorage.getItem(FUNNEL_KEY) || '{}');
      var t = all[TOOL_ID] || { open: 0, template_used: 0, export: 0, handoff_click: 0 };
      t[step] = (t[step] || 0) + 1;
      all[TOOL_ID] = t;
      localStorage.setItem(FUNNEL_KEY, JSON.stringify(all));
    } catch (e) { /* storage full or blocked, analytics is best-effort */ }
  }

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
    if (FUNNEL_STEP[name]) tally(FUNNEL_STEP[name]);
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
    var l = label || 'download';
    send('tool_export', { label: l });
    send('tool_action', { action: 'export', label: l }); // keep the old event too
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

  // ── hand-off tracking (A1550) ─────────────────────────────────────────────
  // Tools send art to Game Maker through JVDSHandoff.sendToGameMaker(). Wrap it
  // so the last funnel step shows up whatever the script load order was.
  var lastHandoff = 0;
  function reportHandoff(slot) {
    var now = Date.now();
    if (now - lastHandoff < 800) return;      // one hand-off per gesture
    lastHandoff = now;
    var l = slot ? String(slot).slice(0, 40) : 'player';
    send('tool_handoff_click', { label: l });
    send('tool_action', { action: 'handoff_click', label: l }); // keep the old log
  }
  function patchHandoff() {
    var h = window.JVDSHandoff;
    if (!h || h.__jvdsTraced || typeof h.sendToGameMaker !== 'function') return false;
    var orig = h.sendToGameMaker;
    h.sendToGameMaker = function (slot) {
      reportHandoff(slot);
      return orig.apply(this, arguments);
    };
    h.__jvdsTraced = true;
    return true;
  }
  if (!patchHandoff()) {
    var _handoff;
    try {
      Object.defineProperty(window, 'JVDSHandoff', {
        configurable: true,
        get: function () { return _handoff; },
        set: function (v) { _handoff = v; patchHandoff(); }
      });
    } catch (e) { /* tool-handoff.js may simply load later, the poll covers it */ }
    var handoffPoll = setInterval(function () { if (patchHandoff()) clearInterval(handoffPoll); }, 300);
    setTimeout(function () { clearInterval(handoffPoll); }, 15000);
  }

  // ── public API ────────────────────────────────────────────────────────────
  window.ToolAnalytics = {
    toolId: TOOL_ID,
    /* ToolAnalytics.event('template_used', 'fire') */
    event: function (action, label) {
      if (!action) return;
      var a = String(action).slice(0, 40);
      var l = label === undefined ? '' : String(label).slice(0, 60);
      var funnel = { template_used: 'tool_template_used', export: 'tool_export', handoff_click: 'tool_handoff_click' };
      if (funnel[a]) send(funnel[a], { label: l });
      send('tool_action', { action: a, label: l });
    },
    /* Local per-tool funnel with a template-to-export rate. true logs a table. */
    readout: function (log) {
      var all = {};
      try { all = JSON.parse(localStorage.getItem(FUNNEL_KEY) || '{}'); } catch (e) {}
      var out = {};
      Object.keys(all).forEach(function (id) {
        var t = all[id] || {};
        var used = t.template_used || 0;
        var exp = t.export || 0;
        out[id] = {
          open: t.open || 0,
          template_used: used,
          export: exp,
          handoff_click: t.handoff_click || 0,
          template_to_export_rate: used ? Math.round((exp / used) * 1000) / 10 : null
        };
      });
      if (log) { try { console.table(out); } catch (e) { /* no console, fine */ } }
      return out;
    },
    /* Seconds of engaged time so far, for debugging. */
    engagedSeconds: function () { return Math.round(engagedMs / 1000); }
  };
})();
