/* ============================================================
   assets/js/studio/studio-preview.js - sandboxed live preview

   Runs learner code in /assets/preview-host.html inside an iframe
   with sandbox="allow-scripts" and no allow-same-origin. The host
   is a separate origin from the page, so the code cannot read the
   real page, its storage or its cookies, and its own CSP blocks the
   network. Code arrives by postMessage and runs as a blob module,
   which works under the site CSP without unsafe-inline or unsafe-eval.
   ============================================================ */
(function () {
  'use strict';
  var S = window.JVDSStudio = window.JVDSStudio || {};
  var api = S.preview = S.preview || {};

  var HOST = '/assets/preview-host.html';

  var STYLE = [
    ':root{color-scheme:dark light}',
    'html,body{margin:0;min-height:100%;background:#0d0d14;color:#f0f0f0;font:16px/1.55 Inter,system-ui,sans-serif}',
    'body{padding:18px}',
    'canvas,img,svg{max-width:100%;height:auto}',
    'button,input,select{font:inherit;min-height:36px}',
    'pre{white-space:pre-wrap;word-break:break-word;background:#13131f;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px}'
  ].join('');

  function standalone(code, type) {
    var safe = String(code == null ? '' : code).replace(/<\/script/gi, '<\\/script');
    var body;
    if (type === 'html') body = safe;
    else if (type === 'css') body = '<style>' + safe + '</style><div class="demo"><h1>Preview</h1><p>This is a sample paragraph so your CSS has something to style.</p><button>Button</button></div>';
    else body = '<canvas id="game" width="480" height="320" style="border-radius:10px;background:#111;max-width:100%"></canvas>' +
      '<canvas id="canvas" width="480" height="320" hidden></canvas><div id="app"></div><script>' + safe + '<\/script>';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + STYLE + '</style></head><body>' + body + '</body></html>';
  }

  api.open = function (code, opts) {
    opts = opts || {};
    var type = opts.type || 'js';
    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('title', 'Live preview');
    frame.setAttribute('src', HOST);
    frame.style.cssText = 'width:100%;min-height:320px;height:46vh;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#0d0d14';

    var status = document.createElement('p');
    status.className = 'jvs-hint';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading the sandbox...';

    function send() {
      status.textContent = 'Running in the sandbox. No network, no access to this page.';
      try { frame.contentWindow.postMessage({ type: 'jvds-preview', code: String(code == null ? '' : code), kind: type }, '*'); }
      catch (e) { status.textContent = 'The sandbox could not start. Download preview.html instead.'; }
    }

    frame.addEventListener('load', send);
    var onMessage = function (event) {
      if (event.source !== frame.contentWindow) return;
      var data = event.data;
      if (!data) return;
      if (data.type === 'jvds-preview-ready') send();
      if (data.type === 'jvds-preview-result') {
        status.textContent = data.ok ? 'Finished. Press Reload to run it again.' : ('Preview error: ' + (data.message || 'the code stopped.'));
      }
    };
    window.addEventListener('message', onMessage);

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;gap:10px';
    wrap.appendChild(frame);
    wrap.appendChild(status);

    var modal = S.modal({
      title: 'Live preview',
      body: wrap,
      actions: [
        S._h('button', { type: 'button', text: 'Download preview.html', onclick: function () {
          var fileUrl = URL.createObjectURL(new Blob([standalone(code, type)], { type: 'text/html' }));
          var a = document.createElement('a');
          a.href = fileUrl;
          a.download = 'preview.html';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { try { a.remove(); URL.revokeObjectURL(fileUrl); } catch (e) {} }, 1000);
        } }),
        S._h('button', { type: 'button', class: 'jvs-btn-primary', text: 'Reload', onclick: function () {
          status.textContent = 'Reloading...';
          frame.src = HOST + '?t=' + Date.now();
        } }),
        S._h('button', { type: 'button', text: 'Close', onclick: function () { modal.close(); } })
      ],
      onClose: function () {
        window.removeEventListener('message', onMessage);
      }
    });
    return modal;
  };
})();
