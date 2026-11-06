/* A2563: low-spec performance sentinel.
 * Samples real requestAnimationFrame frame rate. When it stays below 45 FPS it
 * drops to low quality (smaller render scale, no heavy effects) and tells the
 * page with a jvds:quality event; when the frame rate recovers it switches back.
 * No install, no account, no network. */
(function (root) {
  'use strict';
  if (root.JVDSPerf && root.JVDSPerf.version) return;

  var DEFAULTS = { lowFps: 45, highFps: 55, windowMs: 1000, lowWindows: 2, highWindows: 3, lowScale: 0.75 };
  var config = {};
  Object.keys(DEFAULTS).forEach(function (k) { config[k] = DEFAULTS[k]; });

  var state = {
    level: 'high',
    scale: 1,
    fps: 60,
    frames: 0,
    windows: 0,
    lowStreak: 0,
    highStreak: 0,
    running: false
  };

  var rafOriginal = null;
  var rafWrapped = false;
  var timer = null;
  var windowStart = 0;
  var windowFrames = 0;
  var styleEl = null;

  function now() {
    return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
  }

  function emit(level) {
    if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
      root.dispatchEvent(new root.CustomEvent('jvds:quality', { detail: { level: level, scale: state.scale, fps: state.fps } }));
    }
    if (typeof document !== 'undefined') {
      try { document.dispatchEvent(new root.CustomEvent('jvds:quality', { detail: { level: level, scale: state.scale, fps: state.fps } })); } catch (e) { /* older browser */ }
    }
  }

  function applyStyle() {
    if (typeof document === 'undefined' || styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'jvds-perf-style';
    styleEl.textContent = 'html.jvds-low-perf .jvds-heavy,html.jvds-low-perf [data-jvds-heavy]{animation:none!important;transition:none!important;filter:none!important;box-shadow:none!important}';
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function setLevel(level, fps) {
    if (level === state.level) return;
    state.level = level;
    state.scale = level === 'low' ? config.lowScale : 1;
    state.fps = Math.round(fps);
    root.JVDS_LOW_PERF = level === 'low';
    if (typeof document !== 'undefined') {
      var html = document.documentElement;
      if (html) {
        html.dataset.jvdsQuality = level;
        html.classList.toggle('jvds-low-perf', level === 'low');
      }
    }
    if (level === 'low') applyStyle();
    emit(level);
  }

  function evaluate(fps) {
    state.fps = Math.round(fps);
    state.windows++;
    if (fps < config.lowFps) {
      state.lowStreak++;
      state.highStreak = 0;
    } else if (fps > config.highFps) {
      state.highStreak++;
      state.lowStreak = 0;
    } else {
      state.lowStreak = 0;
      state.highStreak = 0;
    }
    if (state.level !== 'low' && state.lowStreak >= config.lowWindows) setLevel('low', fps);
    else if (state.level !== 'high' && state.highStreak >= config.highWindows) setLevel('high', fps);
  }

  function tick() {
    var t = now();
    if (!windowStart) { windowStart = t; windowFrames = 0; return; }
    var elapsed = t - windowStart;
    if (elapsed < config.windowMs) return;
    var fps = windowFrames * 1000 / elapsed;
    windowFrames = 0;
    windowStart = t;
    evaluate(fps);
  }

  function onFrame(timestamp) {
    state.frames++;
    windowFrames++;
    if (!windowStart) windowStart = now();
    else if (now() - windowStart >= config.windowMs) tick();
    return timestamp;
  }

  function wrapRaf() {
    if (rafWrapped || typeof root.requestAnimationFrame !== 'function') return;
    rafOriginal = root.requestAnimationFrame;
    root.requestAnimationFrame = function (callback) {
      return rafOriginal.call(root, function (timestamp) {
        onFrame(timestamp);
        return callback(timestamp);
      });
    };
    rafWrapped = true;
  }

  function unwrapRaf() {
    if (!rafWrapped || !rafOriginal) return;
    root.requestAnimationFrame = rafOriginal;
    rafWrapped = false;
    rafOriginal = null;
  }

  function start(options) {
    if (options) Object.keys(options).forEach(function (k) { if (k in config) config[k] = options[k]; });
    if (state.running) return api;
    state.running = true;
    windowStart = now();
    windowFrames = 0;
    wrapRaf();
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.jvdsQuality = state.level;
    }
    return api;
  }

  function stop() {
    state.running = false;
    unwrapRaf();
    if (timer) { clearInterval(timer); timer = null; }
    setLevel('high', state.fps);
    return api;
  }

  function getState() {
    return {
      level: state.level,
      scale: state.scale,
      fps: state.fps,
      frames: state.frames,
      windows: state.windows,
      lowStreak: state.lowStreak,
      highStreak: state.highStreak,
      running: state.running,
      config: {
        lowFps: config.lowFps,
        highFps: config.highFps,
        windowMs: config.windowMs,
        lowWindows: config.lowWindows,
        highWindows: config.highWindows,
        lowScale: config.lowScale
      }
    };
  }

  var api = {
    version: '1.0.0',
    start: start,
    stop: stop,
    getState: getState,
    configure: function (options) { if (options) Object.keys(options).forEach(function (k) { if (k in config) config[k] = options[k]; }); return api; },
    _testFps: function (fps) { evaluate(Number(fps) || 0); return getState(); }
  };

  root.JVDSPerf = api;
  if (!root.JVDS_PERF_MANUAL) {
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { start(); });
    } else {
      start();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
