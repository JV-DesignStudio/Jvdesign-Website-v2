/* ── BUILDER GESTURES ────────────────────────────────────────────────────
   One shared touch layer for the 3D builder family (workshops/*-builder.html
   plus BuildLab). Before this, every page carried its own copy of the same
   touchstart / touchmove / touchend code, and they had drifted: the pirate
   pages never called preventDefault on touchstart and never set
   touch-action, so a drag could scroll the page; none of them had tap-select.

   This helper gives every builder the same behaviour that BuildLab uses:
     - one-finger drag orbits, but only after the finger moves past TAP_SLOP,
       so a still finger is still a tap (not a 1px orbit);
     - two-finger pinch zooms;
     - a tap that never moved fires onTap;
     - preventDefault on start/move/end plus touch-action:none, so the page
       never scrolls while the canvas is being dragged.

   The pages keep their own mouse handlers and just hand over their camera
   state through callbacks, so nothing about each builder's look changes.

   Load it before the page's own script:
     <script src="builder-gestures.js"></script>

   Pure module (no DOM at load time), so tests/builder-gestures-unit.js can
   require() it in plain Node.
   ─────────────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  var TAP_SLOP = 10; // px of finger jitter that still counts as a tap, not a drag

  function touchDist(a, b) {
    return Math.sqrt(
      (a.clientX - b.clientX) * (a.clientX - b.clientX) +
      (a.clientY - b.clientY) * (a.clientY - b.clientY)
    );
  }

  // Client coords -> normalized device coords for a canvas.
  function ndc(clientX, clientY, canvas) {
    var r = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) ||
      { left: 0, top: 0, width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
    var w = r.width || 1;
    var h = r.height || 1;
    return { x: ((clientX - r.left) / w) * 2 - 1, y: -((clientY - r.top) / h) * 2 + 1 };
  }

  /**
   * Attach the shared touch gestures to a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts
   *   onOrbit(dxPx, dyPx)     - one-finger drag (after TAP_SLOP). Required for orbit.
   *   onPinch(ratio, dist, prevDist) - two-finger pinch. ratio = prevDist/dist (>1 zoom out).
   *   onTap(clientX, clientY) - a touch that never moved.
   *   onDragStart() / onDragEnd() - so a page can pause its auto-rotate while dragging.
   *   tapSlop                 - override TAP_SLOP.
   * @returns {Function} detach - removes every listener it added.
   */
  function attach(canvas, opts) {
    opts = opts || {};
    var slop = opts.tapSlop != null ? opts.tapSlop : TAP_SLOP;

    // Stop the browser scrolling/zooming the page from this canvas, even
    // before the first touchmove. Pages may also set this in CSS.
    canvas.style.touchAction = 'none';
    canvas.style.webkitUserSelect = 'none';

    var startX = 0, startY = 0, lastX = 0, lastY = 0;
    var moved = false, dragging = false, prevDist = 0;

    function onStart(e) {
      if (e.touches.length === 1) {
        startX = lastX = e.touches[0].clientX;
        startY = lastY = e.touches[0].clientY;
        moved = false;
      } else if (e.touches.length === 2) {
        prevDist = touchDist(e.touches[0], e.touches[1]);
      }
      e.preventDefault();
    }

    function onMove(e) {
      if (e.touches.length === 1) {
        var t = e.touches[0];
        if (!moved) {
          var travelled = touchDist(t, { clientX: startX, clientY: startY });
          if (travelled < slop) { e.preventDefault(); return; } // still a tap
          moved = true;
          dragging = true;
          if (opts.onDragStart) opts.onDragStart();
        }
        var dx = t.clientX - lastX;
        var dy = t.clientY - lastY;
        lastX = t.clientX;
        lastY = t.clientY;
        if (opts.onOrbit) opts.onOrbit(dx, dy);
      } else if (e.touches.length === 2) {
        var d = touchDist(e.touches[0], e.touches[1]);
        if (prevDist > 0 && opts.onPinch) opts.onPinch(prevDist / d, d, prevDist);
        prevDist = d;
        moved = true;
      }
      e.preventDefault();
    }

    function onEnd(e) {
      if (dragging && opts.onDragEnd) opts.onDragEnd();
      dragging = false;
      if (!moved && e.changedTouches && e.changedTouches.length === 1 && opts.onTap) {
        var t = e.changedTouches[0];
        opts.onTap(t.clientX, t.clientY);
      }
      moved = false;
      e.preventDefault();
    }

    function onCancel(e) {
      if (dragging && opts.onDragEnd) opts.onDragEnd();
      dragging = false;
      moved = false;
      e.preventDefault();
    }

    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onCancel, { passive: false });

    return function detach() {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
      canvas.removeEventListener('touchcancel', onCancel);
    };
  }

  // A group can be passed directly or as a getter (builders rebuild their
  // group on every change, so the current one must be read at tap time).
  function resolveGroup(group) {
    return typeof group === 'function' ? group() : group;
  }

  // Raycast a tap against the model group. Returns the hit or null.
  function pick(clientX, clientY, canvas, camera, group) {
    if (typeof THREE === 'undefined' || !camera) return null;
    var g = resolveGroup(group);
    if (!g) return null;
    var p = ndc(clientX, clientY, canvas);
    var ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
    var hits = ray.intersectObject(g, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      if (o && o.isMesh && (!o.material || o.material.visible !== false)) return hits[i];
    }
    return null;
  }

  var boxes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function clearSelection(canvas) {
    if (!boxes) return;
    var box = boxes.get(canvas);
    if (box) {
      if (box.parent) box.parent.remove(box);
      if (box.geometry && box.geometry.dispose) box.geometry.dispose();
      boxes.delete(canvas);
    }
  }

  /**
   * attach() plus tap-select: tapping a part draws a highlight box around it.
   * @param {Function|Object} group - model group, or a getter returning it.
   * @param {Object} [opts] - same as attach(), plus onSelect(hit|null).
   */
  function attachTapSelect(canvas, camera, group, opts) {
    opts = opts || {};
    var merged = {
      tapSlop: opts.tapSlop,
      onOrbit: opts.onOrbit,
      onPinch: opts.onPinch,
      onDragStart: opts.onDragStart,
      onDragEnd: opts.onDragEnd,
      onTap: function (x, y) {
        var hit = pick(x, y, canvas, camera, group);
        clearSelection(canvas);
        if (hit && typeof THREE !== 'undefined') {
          var box = new THREE.BoxHelper(hit.object, 0xffcf40);
          box.material.depthTest = false;
          box.renderOrder = 999;
          var g = resolveGroup(group);
          var parent = (g && g.parent) || g;
          if (parent && parent.add) parent.add(box);
          if (boxes) boxes.set(canvas, box);
        }
        if (opts.onSelect) opts.onSelect(hit);
      }
    };
    return attach(canvas, merged);
  }

  var api = {
    attach: attach,
    attachTapSelect: attachTapSelect,
    pick: pick,
    clearSelection: clearSelection,
    TAP_SLOP: TAP_SLOP,
    _internals: { touchDist: touchDist, ndc: ndc, resolveGroup: resolveGroup }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BuilderGestures = api;
})(typeof window !== 'undefined' ? window : this);
