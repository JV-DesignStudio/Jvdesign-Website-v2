/* engine-runtime.js - shared runtime kit for the JVDS arcade engine (A939).
 *
 * Optional, additive layer on top of the versioned engine. Load it after the
 * other engine files on a game page:
 *
 *   <script src="../game-system-score.js"></script>
 *   <script src="../game-system-save.js"></script>
 *   <script src="../game-system.js"></script>
 *   <script src="../engine-runtime.js"></script>
 *
 * Then opt in from the game. Every helper is safe to call even if this file is
 * not loaded, because games should feature-detect first:
 *
 *   var rt = window.JVDSEngine && window.JVDSEngine.runtime;
 *   if (rt) {
 *     var input = rt.input(canvas);
 *     var loop = rt.loop({ input: input, update: step, render: draw, autostart: true });
 *     // each frame: input.isDown('arrowleft'), input.pointer.x
 *     if (rt.collide.aabb(player, coin)) rt.juice.burst(input.pointer.x, input.pointer.y);
 *   }
 *
 * Nothing here runs on its own. Motion helpers become no-ops when the player
 * has prefers-reduced-motion set, so accessibility is handled once.
 */
(function (root) {
  'use strict';
  var api = root.JVDSEngine = root.JVDSEngine || {};
  api.version = api.version || '2.1.0';

  function reducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function noop() {}

  // ---------------------------------------------------------------- loop ----
  // Fixed-timestep loop with an accumulator. update(step, elapsed) runs a whole
  // number of times per frame so physics is frame-rate independent; render(alpha,
  // dt) runs once with the interpolation factor. Pauses on tab-away (and only
  // auto-resumes from a tab-away pause, never over an explicit pause).
  function loop(opts) {
    opts = opts || {};
    var update = typeof opts.update === 'function' ? opts.update : noop;
    var render = typeof opts.render === 'function' ? opts.render : null;
    var input = opts.input || null;
    var step = opts.step > 0 ? opts.step : 1 / 60;
    var maxSubSteps = opts.maxSubSteps > 0 ? opts.maxSubSteps : 5;
    var watchVisibility = opts.autoPause !== false;

    var running = false, paused = false, destroyed = false;
    var rafId = 0, last = 0, acc = 0, elapsed = 0, autoPaused = false;

    function frame(now) {
      if (!running || destroyed) return;
      rafId = root.requestAnimationFrame(frame);
      if (paused) { last = now; return; }
      var dt = (now - last) / 1000;
      last = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 0.25) dt = 0.25;               // clamp after a long stall
      acc += dt;
      var steps = 0;
      while (acc >= step && steps < maxSubSteps) {
        update(step, elapsed);
        elapsed += step;
        acc -= step;
        steps++;
      }
      if (steps >= maxSubSteps) acc = 0;       // drop the backlog, never spiral
      if (input && input.endFrame) input.endFrame();
      if (render) render(acc / step, dt);
    }

    function onVisibility() {
      if (root.document && root.document.visibilityState === 'hidden') {
        if (!paused) { autoPaused = true; pause(); }
      } else if (autoPaused) {
        autoPaused = false; resume();
      }
    }

    function start() {
      if (running || destroyed) return controller;
      running = true; paused = false; autoPaused = false;
      last = root.performance ? root.performance.now() : Date.now();
      acc = 0;
      rafId = root.requestAnimationFrame(frame);
      return controller;
    }
    function stop() {
      running = false;
      if (rafId && root.cancelAnimationFrame) root.cancelAnimationFrame(rafId);
      rafId = 0;
      return controller;
    }
    function pause() {
      if (paused) return controller;
      paused = true;
      if (typeof opts.onPause === 'function') { try { opts.onPause(); } catch (e) {} }
      return controller;
    }
    function resume() {
      if (!paused) return controller;
      paused = false;
      last = root.performance ? root.performance.now() : Date.now();
      if (typeof opts.onResume === 'function') { try { opts.onResume(); } catch (e) {} }
      return controller;
    }
    function toggle() { return paused ? resume() : pause(); }
    function destroy() {
      stop();
      destroyed = true;
      if (watchVisibility && root.document) root.document.removeEventListener('visibilitychange', onVisibility);
    }

    var controller = {
      start: start, stop: stop, pause: pause, resume: resume, toggle: toggle, destroy: destroy,
      get running() { return running; },
      get paused() { return paused; },
      get elapsed() { return elapsed; }
    };

    if (watchVisibility && root.document) root.document.addEventListener('visibilitychange', onVisibility);
    if (opts.autostart) start();
    return controller;
  }

  // --------------------------------------------------------------- input ----
  // Unified keyboard + pointer/touch state. Keys are looked up case-insensitively
  // by e.key ('arrowleft') or by e.code ('ArrowLeft'). One-shot flags
  // (wasPressed/wasReleased, pointer.pressed/released, pointer.dx/dy) are cleared
  // by endFrame(), which loop() calls after each update.
  function input(target) {
    target = target || root;
    var isEl = !!(target && target.addEventListener && target.nodeType);
    var down = {}, pressed = {}, released = {};
    var pointer = {
      x: 0, y: 0, dx: 0, dy: 0,
      down: false, pressed: false, released: false, inside: false
    };
    var listeners = [];

    function add(el, type, fn, o) { el.addEventListener(type, fn, o); listeners.push([el, type, fn, o]); }
    function normKey(e) { return e.key ? String(e.key).toLowerCase() : ''; }

    function onKeyDown(e) {
      var k = normKey(e), c = e.code || '';
      if (k && !down[k]) pressed[k] = true;
      if (c && !down[c]) pressed[c] = true;
      if (k) down[k] = true;
      if (c) down[c] = true;
    }
    function onKeyUp(e) {
      var k = normKey(e), c = e.code || '';
      if (k) { down[k] = false; released[k] = true; }
      if (c) { down[c] = false; released[c] = true; }
    }
    function localXY(e) {
      if (isEl && target.getBoundingClientRect) {
        var r = target.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      return { x: e.clientX, y: e.clientY };
    }
    function onPointerDown(e) {
      var p = localXY(e);
      pointer.x = p.x; pointer.y = p.y;
      if (!pointer.down) pointer.pressed = true;
      pointer.down = true; pointer.inside = true;
    }
    function onPointerMove(e) {
      var p = localXY(e);
      pointer.dx += p.x - pointer.x;
      pointer.dy += p.y - pointer.y;
      pointer.x = p.x; pointer.y = p.y; pointer.inside = true;
    }
    function onPointerUp() {
      if (pointer.down) pointer.released = true;
      pointer.down = false;
    }
    function onPointerLeave() { pointer.inside = false; }

    add(root, 'keydown', onKeyDown);
    add(root, 'keyup', onKeyUp);
    var pointerTarget = isEl ? target : root;
    if (root.PointerEvent) {
      add(pointerTarget, 'pointerdown', onPointerDown);
      add(pointerTarget, 'pointermove', onPointerMove);
      add(pointerTarget, 'pointerup', onPointerUp);
      add(pointerTarget, 'pointercancel', onPointerUp);
      add(pointerTarget, 'pointerleave', onPointerLeave);
    } else {
      add(pointerTarget, 'mousedown', onPointerDown);
      add(pointerTarget, 'mousemove', onPointerMove);
      add(root, 'mouseup', onPointerUp);
      add(pointerTarget, 'touchstart', function (e) { if (e.touches[0]) onPointerDown(e.touches[0]); }, { passive: true });
      add(pointerTarget, 'touchmove', function (e) { if (e.touches[0]) onPointerMove(e.touches[0]); }, { passive: true });
      add(root, 'touchend', onPointerUp);
    }

    function isDown(name) { return !!down[name] || !!down[String(name).toLowerCase()]; }
    function wasPressed(name) { return !!pressed[name] || !!pressed[String(name).toLowerCase()]; }
    function wasReleased(name) { return !!released[name] || !!released[String(name).toLowerCase()]; }
    function axis(neg, pos) {
      neg = Array.isArray(neg) ? neg : [neg];
      pos = Array.isArray(pos) ? pos : [pos];
      var v = 0;
      neg.forEach(function (k) { if (isDown(k)) v -= 1; });
      pos.forEach(function (k) { if (isDown(k)) v += 1; });
      return v < 0 ? -1 : v > 0 ? 1 : 0;
    }
    function endFrame() {
      pressed = {}; released = {};
      pointer.pressed = false; pointer.released = false;
      pointer.dx = 0; pointer.dy = 0;
    }
    function destroy() {
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      listeners.length = 0;
      down = {}; pressed = {}; released = {};
    }

    return {
      isDown: isDown, wasPressed: wasPressed, wasReleased: wasReleased,
      axis: axis, endFrame: endFrame, destroy: destroy,
      get pointer() { return pointer; }
    };
  }

  // ------------------------------------------------------------ collide ----
  // Rects are {x, y, w, h} with x/y = top-left. Circles are {x, y, r} centred.
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }
  function circle(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r;
    return dx * dx + dy * dy <= rr * rr;
  }
  function circleRect(c, r) {
    var nx = Math.max(r.x, Math.min(c.x, r.x + r.w));
    var ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
    var dx = c.x - nx, dy = c.y - ny;
    return dx * dx + dy * dy <= c.r * c.r;
  }
  // Intersection rect, or null when the rects do not overlap.
  function overlap(a, b) {
    var x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    var r = Math.min(a.x + a.w, b.x + b.w), b2 = Math.min(a.y + a.h, b.y + b.h);
    if (r <= x || b2 <= y) return null;
    return { x: x, y: y, w: r - x, h: b2 - y };
  }
  // Push rect a out of rect b along the axis of least penetration.
  // Returns the {x, y} correction that was applied to a.
  function resolve(a, b) {
    var o = overlap(a, b);
    if (!o) return { x: 0, y: 0 };
    var corrX = (a.x + a.w / 2 < b.x + b.w / 2) ? -o.w : o.w;
    var corrY = (a.y + a.h / 2 < b.y + b.h / 2) ? -o.h : o.h;
    var c;
    if (Math.abs(corrX) <= Math.abs(corrY)) { a.x += corrX; c = { x: corrX, y: 0 }; }
    else { a.y += corrY; c = { x: 0, y: corrY }; }
    return c;
  }

  // -------------------------------------------------------------- juice ----
  // All motion helpers respect prefers-reduced-motion: they snap to the end
  // state instead of animating, and never create throwaway DOM nodes.
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeLinear(t) { return t; }

  function shake(el, o) {
    o = o || {};
    if (!el || reducedMotion() || !el.animate) return;
    var intensity = o.intensity || 6;
    var duration = o.duration || 320;
    try {
      el.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(' + -intensity + 'px)' },
        { transform: 'translateX(' + intensity + 'px)' },
        { transform: 'translateX(' + -(intensity / 2) + 'px)' },
        { transform: 'translateX(0)' }
      ], { duration: duration, easing: 'ease-in-out' });
    } catch (e) {}
  }

  function float(text, x, y, o) {
    o = o || {};
    if (reducedMotion() || !root.document || !root.document.body) return null;
    var el = root.document.createElement('div');
    el.className = 'jvdse-float';
    el.textContent = text;
    el.style.left = (x == null ? root.innerWidth / 2 : x) + 'px';
    el.style.top = (y == null ? root.innerHeight / 2 : y) + 'px';
    if (o.color) el.style.color = o.color;
    root.document.body.appendChild(el);
    root.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, o.duration || 900);
    return el;
  }

  function tween(o) {
    o = o || {};
    var from = o.from || 0, to = o.to == null ? 1 : o.to;
    var duration = o.duration || 400;
    var ease = o.easing || easeOutCubic;
    var onUpdate = o.onUpdate || noop;
    var onComplete = o.onComplete || noop;
    if (reducedMotion() || duration <= 0) { onUpdate(to); onComplete(); return { cancel: noop }; }
    var start = root.performance ? root.performance.now() : Date.now();
    var raf = 0, cancelled = false;
    function frame(now) {
      if (cancelled) return;
      var p = Math.min(1, (now - start) / duration);
      onUpdate(from + (to - from) * ease(p));
      if (p < 1) raf = root.requestAnimationFrame(frame);
      else onComplete();
    }
    raf = root.requestAnimationFrame(frame);
    return { cancel: function () { cancelled = true; if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf); } };
  }

  // Screen-space particle burst. Quick reward feedback without a canvas.
  function burst(x, y, o) {
    o = o || {};
    if (reducedMotion() || !root.document || !root.document.body) return;
    var count = o.count || 12;
    var colors = o.colors || ['#ffe066', '#7fe0ff', '#ff9f68', '#7be07b'];
    var distance = o.distance || 60;
    var size = o.size || 6;
    var duration = o.duration || 620;
    var frag = root.document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var p = root.document.createElement('div');
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      var dist = distance * (0.5 + Math.random() * 0.5);
      p.className = 'jvdse-particle';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--jvdse-dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
      p.style.setProperty('--jvdse-dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
      p.style.animationDuration = duration + 'ms';
      frag.appendChild(p);
    }
    root.document.body.appendChild(frag);
    root.setTimeout(function () {
      var nodes = root.document.querySelectorAll('.jvdse-particle');
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].parentNode) nodes[j].parentNode.removeChild(nodes[j]);
      }
    }, duration + 60);
  }

  function injectCss() {
    if (!root.document || root.document.getElementById('jvdse-css')) return;
    var css = root.document.createElement('style');
    css.id = 'jvdse-css';
    css.textContent =
      '.jvdse-float{position:fixed;z-index:2147483200;pointer-events:none;font:900 16px system-ui,sans-serif;color:#ffe066;text-shadow:0 2px 6px rgba(0,0,0,.5);transform:translate(-50%,-50%);animation:jvdseFloat .9s ease-out forwards}' +
      '@keyframes jvdseFloat{to{transform:translate(-50%,-160%);opacity:0}}' +
      '.jvdse-particle{position:fixed;z-index:2147483200;pointer-events:none;border-radius:50%;transform:translate(-50%,-50%);animation:jvdseParticle .62s ease-out forwards}' +
      '@keyframes jvdseParticle{to{transform:translate(calc(-50% + var(--jvdse-dx,0px)),calc(-50% + var(--jvdse-dy,0px)));opacity:0}}';
    root.document.head.appendChild(css);
  }
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', injectCss);
    else injectCss();
  }

  api.runtime = {
    version: '2.1.0',
    loop: loop,
    input: input,
    collide: {
      aabb: aabb, pointInRect: pointInRect, circle: circle, circleRect: circleRect,
      overlap: overlap, resolve: resolve
    },
    juice: {
      shake: shake, float: float, tween: tween, burst: burst,
      easing: { outCubic: easeOutCubic, inOutQuad: easeInOutQuad, linear: easeLinear }
    }
  };
})(typeof window !== 'undefined' ? window : this);
