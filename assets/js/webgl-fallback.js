/* A1694: honest fallback when WebGL is unavailable.
   Load straight after three.global.js on a 3D builder page, before the page's
   own scene script. On a device with WebGL switched off (some school and older
   machines) it:
   - marks the page with .jvds-no-webgl,
   - swaps THREE.WebGLRenderer for a no-op stand-in so the page does not throw
     and leave a blank canvas,
   - shows a clear message with links to tools that do work without WebGL.
   Call window.JVDSWebGL.supported to check, or .showFallback() to show it. */
(function () {
  'use strict';

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function stubRenderer() {
    if (!window.THREE || !window.THREE.WebGLRenderer) return;
    var Orig = window.THREE.WebGLRenderer;
    if (Orig && Orig.__jvdsNoWebGL) return;
    function StandIn() {
      var el = document.createElement('canvas');
      var base = { domElement: el, shadowMap: {}, capabilities: { isWebGL2: false }, info: { render: {} } };
      // Any unknown method is a harmless no-op, so the rest of the page can finish.
      return new Proxy(base, {
        get: function (t, k) { if (k in t) return t[k]; return function () {}; },
        set: function (t, k, v) { t[k] = v; return true; }
      });
    }
    StandIn.__jvdsNoWebGL = true;
    window.THREE.WebGLRenderer = StandIn;
  }

  function showFallback() {
    if (document.getElementById('jvds-webgl-fallback')) return;
    var host = document.querySelector('main') || document.getElementById('main-content') || document.querySelector('#app') || document.body;
    if (!host) return;
    var box = document.createElement('div');
    box.id = 'jvds-webgl-fallback';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'max-width:720px;margin:18px auto;padding:18px 20px;background:#F0EAD6;border:2px solid #D2B48C;border-radius:14px;color:#403B33;font-family:Inter,system-ui,sans-serif;line-height:1.55;box-sizing:border-box';
    box.innerHTML =
      '<strong style="display:block;font-size:1.05rem;margin-bottom:6px">This 3D builder needs WebGL, and it is switched off here.</strong>' +
      '<p style="margin:0 0 12px;font-size:.9rem">Some school and older computers turn 3D graphics off. You can still make something today:</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<a href="/tools/pixel-studio.html#first-mission" style="display:inline-block;background:#4E7D80;color:#fff;font-weight:700;text-decoration:none;padding:10px 16px;border-radius:10px">Make pixel art in Pixel Studio</a>' +
        '<a href="/tools/level-designer.html" style="display:inline-block;background:#fff;color:#403B33;font-weight:700;text-decoration:none;padding:10px 16px;border-radius:10px;border:1.5px solid #D2B48C">Open the 2D level designer</a>' +
        '<a href="/3d-builders" style="display:inline-block;color:#3D6B6E;font-weight:700;text-decoration:underline;padding:10px 4px">Back to 3D Builders</a>' +
      '</div>';
    host.insertBefore(box, host.firstChild);
  }

  var ok = hasWebGL();
  window.JVDSWebGL = { supported: ok, showFallback: showFallback };
  if (ok) return;

  document.documentElement.classList.add('jvds-no-webgl');
  stubRenderer();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showFallback);
  else showFallback();
  window.addEventListener('error', function (e) {
    var msg = (e && (e.message || '')) + '';
    if (/webgl|webgl2|3d context|context/i.test(msg)) showFallback();
  });
})();
