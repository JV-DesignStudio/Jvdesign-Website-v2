/* HiDPI canvas helper (A620)
 *
 * Canvas tools used to render at 1x, so previews looked blurry on Retina/HiDPI
 * phones and laptops. This helper scales a canvas backing store by
 * window.devicePixelRatio while keeping a logical (CSS-pixel) coordinate
 * system:
 *
 *   - the element keeps its logical CSS size
 *   - the drawing buffer becomes logical * dpr
 *   - the 2D context is transformed by dpr, so existing drawing code and
 *     hit-testing that work in logical pixels stay correct
 *
 * Exports render to their own offscreen canvases, so exported assets are
 * unchanged. On a 1x display dpr is 1 and nothing changes.
 */
(function () {
  function dpr() { return Math.max(1, window.devicePixelRatio || 1); }

  // Fit a canvas to cssW x cssH logical pixels at the current DPR.
  // Returns the (possibly supplied) 2D context, transformed to logical units.
  function fit(canvas, cssW, cssH, ctx) {
    if (!canvas) return null;
    var d = dpr();
    if (cssW != null) canvas.style.width = cssW + 'px';
    if (cssH != null) canvas.style.height = cssH + 'px';
    canvas.width = Math.max(1, Math.round(cssW * d));
    canvas.height = Math.max(1, Math.round(cssH * d));
    ctx = ctx || canvas.getContext('2d');
    if (ctx && ctx.setTransform) ctx.setTransform(d, 0, 0, d, 0, 0);
    return ctx;
  }

  // Re-apply the DPR transform to a context after the caller cleared it.
  function scale(ctx) {
    if (ctx && ctx.setTransform) ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    return ctx;
  }

  window.HiDPI = { dpr: dpr, fit: fit, scale: scale };
})();
