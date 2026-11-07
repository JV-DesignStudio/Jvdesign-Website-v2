/* A2592: optional 15-minute quick-win timer for the Create hub.
 * Opt-in, never pressures a learner, survives moving between tools and a
 * refresh via localStorage, and needs no notification permission. */
(function () {
  'use strict';
  var KEY = 'jvds_create_timer';
  var DURATION = 15 * 60 * 1000;
  var state = null;
  var tick = null;
  var wrap = null;
  var timeEl = null;
  var toggleEl = null;
  var statusEl = null;
  var lastMinute = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save(s) {
    state = s;
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }
  function fmt(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function announce(text) {
    if (statusEl) statusEl.textContent = text;
  }
  function remainingOf(s) {
    if (!s) return 0;
    if (s.mode === 'running') return Math.max(0, s.endAt - Date.now());
    return Math.max(0, s.remaining);
  }

  function ensureCss() {
    if (document.getElementById('create-timer-css')) return;
    var css = document.createElement('style');
    css.id = 'create-timer-css';
    css.textContent =
      '.create-timer{position:fixed;right:16px;bottom:16px;z-index:2147482000;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);padding:8px 10px;background:var(--card,#fff);border:1.5px solid var(--tan,#D2B48C);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.16);font-family:Inter,system-ui,sans-serif;font-size:.85rem;color:var(--charcoal,#1a1208)}' +
      '.create-timer[hidden]{display:none}' +
      '.create-timer-time{font-family:"JetBrains Mono",monospace;font-weight:800;font-size:1rem;min-width:3.4em;text-align:center;font-variant-numeric:tabular-nums}' +
      '.create-timer button{min-height:36px;padding:5px 10px;border-radius:8px;border:1px solid var(--border,rgba(64,59,51,.18));background:var(--beige,#F0EAD6);color:inherit;font:inherit;font-weight:700;font-size:.78rem;cursor:pointer}' +
      '.create-timer button:hover{filter:brightness(1.04)}' +
      '.create-timer button[data-act="dismiss"]{min-width:36px;padding:5px 8px;font-size:1rem;line-height:1}' +
      '.create-timer.is-expired{border-color:var(--gold,#c98a2e);background:var(--gold-lt,#faf1e0)}' +
      '.hub-project-timer{display:inline-flex;align-items:center;gap:6px;min-height:44px;margin:10px 0 0 8px;padding:9px 16px;border-radius:999px;border:1.5px solid var(--jv-line);background:var(--jv-surface-2);color:var(--jv-text);font:inherit;font-weight:800;font-size:.85rem;cursor:pointer}' +
      '.hub-project-timer:hover{border-color:var(--jv-ember);background:var(--jv-ember-soft)}' +
      '@media(prefers-reduced-motion:reduce){.create-timer,.create-timer *{animation:none!important;transition:none!important}}' +
      '@media(max-width:420px){.create-timer{right:10px;bottom:10px}.create-timer button{padding:5px 8px}}';
    document.head.appendChild(css);
  }

  function ensureWidget() {
    if (wrap) return;
    ensureCss();
    wrap = document.createElement('div');
    wrap.id = 'create-timer';
    wrap.className = 'create-timer';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', '15 minute quick-win timer');
    wrap.hidden = true;
    wrap.innerHTML =
      '<span class="create-timer-time" role="timer" aria-live="off">15:00</span>' +
      '<button type="button" data-act="toggle">Pause</button>' +
      '<button type="button" data-act="reset">Reset</button>' +
      '<button type="button" data-act="dismiss" aria-label="Dismiss timer">\u00D7</button>' +
      '<span class="create-timer-status" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0"></span>';
    timeEl = wrap.querySelector('.create-timer-time');
    toggleEl = wrap.querySelector('[data-act="toggle"]');
    statusEl = wrap.querySelector('.create-timer-status');
    wrap.querySelector('[data-act="toggle"]').addEventListener('click', toggle);
    wrap.querySelector('[data-act="reset"]').addEventListener('click', reset);
    wrap.querySelector('[data-act="dismiss"]').addEventListener('click', dismiss);
    document.body.appendChild(wrap);
  }

  function render() {
    ensureWidget();
    if (!state) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var rem = remainingOf(state);
    if (state.mode === 'expired') rem = 0;
    timeEl.textContent = fmt(rem);
    wrap.classList.toggle('is-expired', state.mode === 'expired');
    if (state.mode === 'expired') {
      toggleEl.textContent = 'Restart';
      toggleEl.disabled = false;
    } else if (state.mode === 'running') {
      toggleEl.textContent = 'Pause';
      toggleEl.disabled = false;
    } else {
      toggleEl.textContent = 'Resume';
      toggleEl.disabled = false;
    }
    var minute = Math.floor(rem / 60000);
    if (minute !== lastMinute) {
      lastMinute = minute;
      // Announce only the start, the last minute and expiry, not every second.
      if (minute === 0 && rem > 0) announce('One minute left.');
    }
  }

  function start() {
    save({ mode: 'running', endAt: Date.now() + DURATION, remaining: DURATION });
    lastMinute = null;
    announce('15 minute timer started.');
    render();
    loop();
  }
  function resume() {
    var rem = remainingOf(state) || DURATION;
    save({ mode: 'running', endAt: Date.now() + rem, remaining: rem });
    announce('Timer resumed.');
    render();
    loop();
  }
  function pause() {
    var rem = remainingOf(state);
    save({ mode: 'paused', endAt: null, remaining: rem });
    announce('Timer paused.');
    if (tick) { clearInterval(tick); tick = null; }
    render();
  }
  function reset() {
    save({ mode: 'paused', endAt: null, remaining: DURATION });
    lastMinute = null;
    announce('Timer reset to 15 minutes.');
    if (tick) { clearInterval(tick); tick = null; }
    render();
  }
  function dismiss() {
    save(null);
    if (tick) { clearInterval(tick); tick = null; }
    if (wrap) wrap.hidden = true;
    announce('Timer dismissed.');
  }
  function toggle() {
    if (!state) { start(); return; }
    if (state.mode === 'running') pause();
    else if (state.mode === 'expired') start();
    else resume();
  }

  function loop() {
    if (tick) clearInterval(tick);
    tick = setInterval(function () {
      if (!state || state.mode !== 'running') { clearInterval(tick); tick = null; return; }
      var rem = state.endAt - Date.now();
      if (rem <= 0) {
        save({ mode: 'expired', endAt: null, remaining: 0 });
        clearInterval(tick); tick = null;
        announce('Time is up. Save your work and take a breath.');
        render();
        return;
      }
      state.remaining = rem;
      render();
    }, 500);
  }

  function injectStartButton() {
    ensureCss();
    var host = document.querySelector('#first-project .hub-project-inner') || document.getElementById('first-project');
    if (!host || document.getElementById('startQuickTimer')) return;
    var b = document.createElement('button');
    b.id = 'startQuickTimer';
    b.type = 'button';
    b.className = 'hub-project-timer';
    b.textContent = 'Start a 15-minute timer';
    b.addEventListener('click', function () {
      if (state && state.mode === 'running') pause();
      else if (state && state.mode === 'paused') resume();
      else start();
    });
    var alt = host.querySelector('.hub-project-alt');
    if (alt && alt.parentNode) alt.parentNode.insertBefore(b, alt.nextSibling);
    else host.appendChild(b);
  }

  function boot() {
    state = load();
    if (state && state.mode === 'running') {
      if (remainingOf(state) <= 0) save({ mode: 'expired', endAt: null, remaining: 0 });
      else loop();
    }
    if (state) render();
    injectStartButton();
    window.CreateTimer = { start: start, pause: pause, resume: resume, reset: reset, dismiss: dismiss, get state() { return state; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
