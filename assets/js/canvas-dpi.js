// Shared high-DPI canvas sizing for browser games.
// A game often has a fixed internal resolution (Rustfall is 480x672) that CSS
// stretches to fit the screen. Up close on a 2x phone or Chromebook that looks
// soft because the backing store never grew. This sizes the backing store from
// the CSS box and the device pixel ratio, then scales the drawing context so the
// game can keep drawing in its original coordinates.
//
//   const scale = window.JVDS_DPR(canvas, ctx, CW, CH, cssW, cssH, { maxPixels: 1250000 });
//
// maxPixels is a fill-rate guard for weak school GPUs: above it the backing
// store is scaled down proportionally instead of being allowed to balloon.
(function () {
  'use strict';

  window.JVDS_DPR = function (canvas, ctx, logicalW, logicalH, cssW, cssH, opts) {
    if (!canvas || !logicalW || !logicalH) return 1;
    var o = opts || {};
    var maxDpr = o.maxDpr || 2;
    var maxPixels = o.maxPixels || 1250000;
    var raw = (typeof window.devicePixelRatio === 'number' && window.devicePixelRatio) || 1;
    var ratio = Math.min(raw, maxDpr);

    var w = Math.max(1, Math.round((cssW || logicalW) * ratio));
    var h = Math.max(1, Math.round((cssH || logicalH) * ratio));
    var k = Math.min(1, Math.sqrt(maxPixels / (w * h)));
    if (k < 1) { w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k)); }

    canvas.width = w;
    canvas.height = h;
    var sx = w / logicalW;
    var sy = h / logicalH;
    if (ctx && typeof ctx.setTransform === 'function') ctx.setTransform(sx, 0, 0, sy, 0, 0);
    try { window.__jvdsCanvasScale = sx; } catch (e) {}
    return sx;
  };
})();
