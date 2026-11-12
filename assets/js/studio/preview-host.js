/* ============================================================
   assets/js/studio/preview-host.js - sandbox document for previews

   Runs inside /assets/preview-host.html in an iframe with
   sandbox="allow-scripts" (no same-origin). Parent and child are
   different origins, so learner code here cannot read the real
   page, its storage or its cookies.

   The code arrives by postMessage and runs as a blob module, which
   the page CSP allows without needing 'unsafe-inline' or 'unsafe-eval'.
   ============================================================ */
(function () {
  'use strict';

  function clear() {
    document.body.innerHTML = '';
    Array.prototype.slice.call(document.querySelectorAll('style[data-preview]')).forEach(function (el) {
      el.remove();
    });
  }

  function showError(err) {
    var box = document.createElement('pre');
    box.textContent = 'Preview error: ' + (err && err.message ? err.message : String(err));
    document.body.appendChild(box);
  }

  function run(code, kind) {
    clear();
    try {
      if (kind === 'html') {
        document.body.innerHTML = code;
        return;
      }
      if (kind === 'css') {
        var style = document.createElement('style');
        style.setAttribute('data-preview', '1');
        style.textContent = code;
        document.head.appendChild(style);
        document.body.innerHTML = '<div class="demo"><h1>Preview</h1><p>This is a sample paragraph so your CSS has something to style.</p><button>Button</button></div>';
        return;
      }
      // Give game snippets something to draw on. Snippets that make their own
      // canvas simply ignore this one.
      document.body.innerHTML = '<canvas id="game" width="480" height="320" style="border-radius:10px;background:#111;max-width:100%"></canvas>' +
        '<canvas id="canvas" width="480" height="320" hidden></canvas>' +
        '<div id="app"></div>';
      var blob = new Blob([String(code)], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      import(url).then(function () {
        URL.revokeObjectURL(url);
        try { parent.postMessage({ type: 'jvds-preview-result', ok: true }, '*'); } catch (e) {}
      }).catch(function (err) {
        URL.revokeObjectURL(url);
        showError(err);
        try { parent.postMessage({ type: 'jvds-preview-result', ok: false, message: String(err && err.message || err) }, '*'); } catch (e) {}
      });
    } catch (err) {
      showError(err);
      try { parent.postMessage({ type: 'jvds-preview-result', ok: false, message: String(err && err.message || err) }, '*'); } catch (e) {}
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || data.type !== 'jvds-preview') return;
    run(String(data.code == null ? '' : data.code), data.kind || 'js');
  });

  try { window.parent.postMessage({ type: 'jvds-preview-ready' }, '*'); } catch (e) {}
})();
