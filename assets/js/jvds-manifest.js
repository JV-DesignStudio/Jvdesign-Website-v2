/* jvds-manifest.js - one documented save namespace + manifest export/import (A1614)
 *
 * JVDS tools save into localStorage under a few key families. This module is the
 * single place that knows them, so any tool can export a manifest and any tool can
 * read one back.
 *
 * Namespace (key prefixes):  jvds_  jvds-  jv_  qb-  pixel  sound  level
 * Manifest shape:            { app:"jvds-manifest", v:1, exported:", keys:{ "<key>":"<string value>" } }
 *
 * API (all on window.JVDSManifest):
 *   isKey(k)         -> true when k belongs to the JVDS namespace
 *   collect()        -> { key: value } of everything in the namespace, right now
 *   make(extra)      -> a manifest object (optionally merged with extra)
 *   download(name)   -> download the current manifest as JSON
 *   apply(obj)       -> write a manifest (or a bare { key: value }) into localStorage, returns count
 *   readFile(file)   -> Promise<manifest> from a File
 *   openManifest()   -> file picker -> apply -> reload so the tool re-reads saves
 */
(function () {
  var RE = /^(jvds_|jvds-|jv_|qb-|pixel|sound|level)/;
  function isKey(k) { return typeof k === 'string' && RE.test(k); }

  function collect() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && isKey(k)) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }

  function make(extra) {
    var m = { app: 'jvds-manifest', v: 1, exported: new Date().toISOString(), keys: collect() };
    if (extra && typeof extra === 'object') Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
    return m;
  }

  function download(name) {
    try {
      var blob = new Blob([JSON.stringify(make(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name || 'jvds-manifest.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return true;
    } catch (e) { return false; }
  }

  function apply(obj) {
    var keys = (obj && obj.keys) ? obj.keys : obj;
    if (!keys || typeof keys !== 'object') return 0;
    var n = 0;
    Object.keys(keys).forEach(function (k) {
      if (!isKey(k)) return;
      try {
        var v = keys[k];
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        n++;
      } catch (e) {}
    });
    return n;
  }

  function readFile(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { try { res(JSON.parse(r.result)); } catch (e) { rej(e); } };
      r.onerror = rej;
      r.readAsText(file);
    });
  }

  function openManifest() {
    var inp = document.getElementById('jvdsManifestFile');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file';
      inp.id = 'jvdsManifestFile';
      inp.accept = '.json,application/json';
      inp.style.display = 'none';
      inp.setAttribute('aria-label', 'Open a JVDS manifest');
      document.body.appendChild(inp);
    }
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      inp.value = '';
      if (!f) return;
      readFile(f).then(function (m) {
        var n = apply(m);
        if (n > 0) { try { location.reload(); } catch (e) {} }
        else if (typeof showToast === 'function') showToast('No tool saves found in that file');
      }).catch(function () { if (typeof showToast === 'function') showToast('Not a valid manifest file'); });
    };
    inp.click();
  }

  window.JVDSManifest = { isKey: isKey, collect: collect, make: make, download: download, apply: apply, readFile: readFile, openManifest: openManifest };
  window.openManifest = openManifest;
})();
