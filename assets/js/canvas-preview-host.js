(function () {
  'use strict';
  var stage = document.getElementById('cw-stage');

  // The stage is a sandboxed srcdoc frame, so its origin is opaque and the
  // host cannot read stage.contentDocument. Instead the stage gets a small
  // bootstrap that creates and loads the code blobs from inside its own
  // origin. Blob URLs work there without allow-same-origin, and learner code
  // still cannot reach the workshop page.
  function buildStage(cfg) {
    var parts = {
      artKit: cfg.artKit || '',
      presetup: cfg.presetup || '',
      blobSrc: cfg.blobSrc || '',
      afterBlob: cfg.afterBlob ? '(function(){' + cfg.afterBlob + '})();' : ''
    };
    // Escape closing tags so learner code cannot end the bootstrap script early.
    var json = JSON.stringify(parts).replace(/<\//g, '<\\/');
    var boot = 'var _p=' + json + ';' +
      'var _q=["artKit","presetup","blobSrc","afterBlob"];' +
      'function _run(i){' +
      'if(i>=_q.length)return;' +
      'var c=_p[_q[i]];' +
      'if(!c){_run(i+1);return;}' +
      'var b=new Blob([c],{type:"text/javascript"});' +
      'var u=URL.createObjectURL(b);' +
      'var s=document.createElement("script");' +
      's.src=u;' +
      's.onload=function(){URL.revokeObjectURL(u);_run(i+1);};' +
      's.onerror=function(){URL.revokeObjectURL(u);_run(i+1);};' +
      'document.head.appendChild(s);' +
      '}' +
      '_run(0);';
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + (cfg.css || '') +
      '</head><body>' + (cfg.canvas || '') + (cfg.fxOverlay || '') +
      '<script>' + boot + '</script></body></html>';
  }

  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.cwParts) {
      stage.srcdoc = buildStage(e.data.cwParts);
    } else if (typeof e.data.cwPreview === 'string') {
      stage.srcdoc = e.data.cwPreview;
    }
  });
})();
