(function () {
  'use strict';
  var stage = document.getElementById('cw-stage');

  function injectBlob(doc, code, onDone) {
    if (!doc || !doc.createElement) { if (onDone) onDone(); return; }
    var blob = new Blob([code], { type: 'text/javascript' });
    var url = URL.createObjectURL(blob);
    var s = doc.createElement('script');
    s.src = url;
    s.onload = function () { URL.revokeObjectURL(url); if (onDone) onDone(); };
    s.onerror = function () { URL.revokeObjectURL(url); if (onDone) onDone(); };
    doc.head.appendChild(s);
  }

  function runSequential(doc, steps, i) {
    if (i >= steps.length) return;
    var code = steps[i];
    if (!code) { runSequential(doc, steps, i + 1); return; }
    injectBlob(doc, code, function () { runSequential(doc, steps, i + 1); });
  }

  function runParts(cfg) {
    var shell = '<!DOCTYPE html><html><head><meta charset="UTF-8">' + cfg.css +
      '</head><body>' + cfg.canvas + (cfg.fxOverlay || '') + '</body></html>';
    stage.srcdoc = shell;
    stage.addEventListener('load', function onload() {
      stage.removeEventListener('load', onload);
      var doc = stage.contentDocument;
      if (!doc) return;
      var steps = [];
      if (cfg.artKit) steps.push(cfg.artKit);
      steps.push(cfg.presetup);
      steps.push(cfg.blobSrc);
      if (cfg.afterBlob) steps.push('(function(){' + cfg.afterBlob + '})();');
      runSequential(doc, steps, 0);
    });
  }

  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.cwParts) {
      runParts(e.data.cwParts);
    } else if (typeof e.data.cwPreview === 'string') {
      stage.srcdoc = e.data.cwPreview;
    }
  });
})();
