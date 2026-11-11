(function () {
  'use strict';
  var stage = document.getElementById('cw-stage');

  // A2264: an optional executable test runs after the learner's code has
  // loaded, inside this same sandboxed stage. The test body gets a done()
  // callback and must call done(true|false, detail); a timeout fails it.
  function testSource(test) {
    var num = JSON.stringify(test.num == null ? 0 : test.num);
    var delay = Math.max(0, Number(test.delay) || 350);
    var timeout = Math.max(delay + 500, Number(test.timeout) || 3000);
    return '(function(){var _done=false;' +
      'function _finish(pass,detail){if(_done)return;_done=true;' +
      'parent.postMessage({cwTestResult:{num:' + num + ',pass:!!pass,detail:String(detail||"")}},"*");}' +
      'setTimeout(function(){try{(function(done){' + test.src + '})(_finish);}' +
      'catch(e){_finish(false,(e&&e.message)||"The test could not run.");}},' + delay + ');' +
      'setTimeout(function(){_finish(false,"The test timed out.");},' + timeout + ');})();';
  }

  // A2956: a learner can save a share card of the running game. The stage has
  // an opaque origin, so the workshop page cannot read its canvas. Capture from
  // inside the stage and hand the PNG back through the host.
  var CAPTURE = '(function(){' +
    'function reply(msg){try{parent.postMessage(msg,"*");}catch(e){}}' +
    'window.addEventListener("message",function(e){' +
    'if(!e.data||!e.data.cwCapture)return;' +
    'try{' +
    'var c=document.querySelector("canvas");' +
    'if(!c){reply({cwCaptureResult:{ok:false,reason:"no-canvas"}});return;}' +
    'var d=c.toDataURL("image/png");' +
    'if(!d||d.length<64){reply({cwCaptureResult:{ok:false,reason:"empty"}});return;}' +
    'reply({cwCaptureResult:{ok:true,data:d}});' +
    '}catch(err){reply({cwCaptureResult:{ok:false,reason:String((err&&err.message)||err)}});}' +
    '});' +
    '})();';

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
    if (cfg.cwTest && cfg.cwTest.src) parts.test = testSource(cfg.cwTest);
    // Escape closing tags so learner code cannot end the bootstrap script early.
    var json = JSON.stringify(parts).replace(/<\//g, '<\\/');
    var boot = 'var _p=' + json + ';' +
      'var _q=["artKit","presetup","blobSrc","afterBlob","test"];' +
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
      '_run(0);' +
      // A1981: Escape leaves the preview so keyboard users are never trapped.
      'document.addEventListener("keydown",function(e){if(e.key==="Escape"){parent.postMessage({cwPreviewEscape:true},"*");}});' +
      CAPTURE;
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + (cfg.css || '') +
      '</head><body>' + (cfg.canvas || '') + (cfg.fxOverlay || '') +
      '<script>' + boot + '</script></body></html>';
  }

  // Older templates return a complete HTML string instead of cwParts. Append
  // the test as its own script so those pages get executable checks too.
  function injectTest(html, test) {
    var src = '<script>' + testSource(test).replace(/<\//g, '<\\/') + '<\/script>';
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, src + '</body>') : html + src;
  }

  // A2956: give the legacy complete-HTML path the same capture listener.
  function injectCapture(html) {
    if (html.indexOf('cwCaptureResult') !== -1) return html;
    var src = '<script>' + CAPTURE + '<\/script>';
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, src + '</body>') : html + src;
  }

  // Tell the workshop page this host is ready. Pages that queue a test while
  // the iframe is still loading can send it now instead of retrying.
  try { parent.postMessage({ cwHostReady: true }, '*'); } catch (err) {}

  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.cwParts) {
      var cfg = e.data.cwParts;
      if (e.data.cwTest) cfg.cwTest = e.data.cwTest;
      stage.srcdoc = buildStage(cfg);
    } else if (typeof e.data.cwPreview === 'string') {
      var html = e.data.cwTest ? injectTest(e.data.cwPreview, e.data.cwTest) : e.data.cwPreview;
      stage.srcdoc = injectCapture(html);
    } else if (e.data.cwCapture) {
      try { stage.contentWindow.postMessage({ cwCapture: true }, '*'); } catch (err) {}
    } else if (e.data.cwCaptureResult) {
      // Forward the captured PNG to the workshop page.
      parent.postMessage(e.data, '*');
    } else if (e.data.cwTestResult) {
      // A test ran inside the sandboxed stage. Forward its verdict to the
      // workshop page, which is this host's parent.
      parent.postMessage(e.data, '*');
    } else if (e.data.cwPreviewEscape) {
      parent.postMessage({ cwPreviewEscape: true }, '*');
    } else if (e.data.cwPreviewFocus) {
      try { stage.focus(); } catch (err) {}
    }
  });
})();
