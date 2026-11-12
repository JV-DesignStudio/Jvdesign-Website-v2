/* Godot Lab - A2959.
   The editor is self-hosted under editor/ and the page is made cross-origin
   isolated by coi-serviceworker.js. This script waits for isolation, then
   loads the editor iframe and can preload the starter ZIP in one click. */
(function () {
  'use strict';

  var frame = document.getElementById('godot-frame');
  var statusEl = document.querySelector('[data-gl-status]');
  var loadBtn = document.querySelector('[data-gl-load]');
  var fallback = document.querySelector('[data-gl-fallback]');

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || '';
  }
  function showFallback() {
    if (fallback) fallback.hidden = false;
  }
  function editorDoc() {
    try { return frame && frame.contentDocument; } catch (e) { return null; }
  }
  function reveal() {
    if (!window.crossOriginIsolated) {
      setStatus('Preparing the lab. If this stays, your browser or network is blocking service workers.');
      showFallback();
      return;
    }
    if (frame && !frame.getAttribute('src')) {
      frame.setAttribute('src', frame.getAttribute('data-src') || 'editor/index.html');
      setStatus('Editor loading. The first Start downloads about 96 MB.');
    }
  }
  function loadStarter() {
    var doc = editorDoc();
    if (!doc || !doc.getElementById('zip-file') || !doc.getElementById('startButton')) {
      setStatus('The editor is still loading. Wait a moment, then try again.');
      return;
    }
    setStatus('Loading the starter project...');
    fetch('starter.zip').then(function (r) { return r.blob(); }).then(function (blob) {
      var file = new File([blob], 'starter.zip', { type: 'application/zip' });
      var dt = new DataTransfer();
      dt.items.add(file);
      doc.getElementById('zip-file').files = dt.files;
      doc.getElementById('startButton').click();
      setStatus('Starting the real editor. The first load can take about a minute.');
    }).catch(function () {
      setStatus('Could not load the starter zip. Download it and use Preload project ZIP in the editor.');
      showFallback();
    });
  }

  if (loadBtn) loadBtn.addEventListener('click', loadStarter);
  if (frame) {
    frame.addEventListener('load', function () {
      if (window.crossOriginIsolated) setStatus('Editor ready. Press Load starter project.');
    });
  }

  if (window.crossOriginIsolated) {
    reveal();
  } else {
    setStatus('Preparing the lab...');
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function () {
        if (window.crossOriginIsolated) reveal();
      }).catch(function () {});
    }
    setTimeout(function () {
      if (!window.crossOriginIsolated) reveal();
      else if (frame && !frame.getAttribute('src')) reveal();
    }, 4000);
  }
})();
