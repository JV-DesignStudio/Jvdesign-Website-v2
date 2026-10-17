/* jvds-project-bundle.js , A1587
   One downloadable project bundle shared by Pixel Studio, Sprite Animator and
   the Arcade Game Maker, plus an "Open in..." handoff between them.

   Bundle (JSON) envelope:
     {
       app: 'jvds-tool-bundle', v: 1,
       tool: 'pixel-studio' | 'sprite-animator' | 'arcade-game-maker',
       name: string,
       createdAt: ISO string,
       project: <native project object for that tool>,
       sprite:  { dataUrl, frameW, frameH, frameCount } | null,
       preview: dataUrl | null
     }

   "Open in..." uses the same localStorage convention as tool-handoff.js:
   stash the bundle under jvds_tool_bundle with a jvds_tool_bundle_to marker,
   navigate, and the target consumes it on boot with takePending(tool).
*/
(function () {
  'use strict';

  var APP = 'jvds-tool-bundle';
  var VERSION = 1;
  var LS_PENDING = 'jvds_tool_bundle';
  var LS_TARGET = 'jvds_tool_bundle_to';

  var LABELS = {
    'pixel-studio': 'Pixel Studio',
    'sprite-animator': 'Sprite Animator',
    'arcade-game-maker': 'Game Maker'
  };

  function isBundle(o) { return !!o && o.app === APP && o.v === VERSION; }

  function make(opts) {
    opts = opts || {};
    return {
      app: APP,
      v: VERSION,
      tool: opts.tool || '',
      name: String(opts.name || 'project').slice(0, 60),
      createdAt: new Date().toISOString(),
      project: opts.project == null ? null : opts.project,
      sprite: opts.sprite || null,
      preview: opts.preview || null
    };
  }

  function slug(s) {
    return String(s || 'project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'project';
  }

  function fileName(bundle) {
    return slug(bundle.tool) + '-' + slug(bundle.name) + '-jvds-project.json';
  }

  function fallbackDownload(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function download(bundle) {
    var name = fileName(bundle);
    var blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
    if (typeof window.downloadBlob === 'function') window.downloadBlob(blob, name);
    else fallbackDownload(blob, name);
    return name;
  }

  function parse(text) {
    try {
      var o = JSON.parse(text);
      return isBundle(o) ? o : null;
    } catch (e) { return null; }
  }

  function readFile(file) {
    return new Promise(function (resolve) {
      if (!file) { resolve(null); return; }
      var r = new FileReader();
      r.onload = function () { resolve(parse(String(r.result))); };
      r.onerror = function () { resolve(null); };
      r.readAsText(file);
    });
  }

  function openIn(targetTool, bundle, href) {
    try {
      localStorage.setItem(LS_PENDING, JSON.stringify(bundle));
      localStorage.setItem(LS_TARGET, targetTool);
    } catch (e) { return false; }
    location.href = href || (targetTool + '.html');
    return true;
  }

  function takePending(targetTool) {
    var raw = null, to = null;
    try { raw = localStorage.getItem(LS_PENDING); to = localStorage.getItem(LS_TARGET); } catch (e) { return null; }
    if (!raw) return null;
    if (to && targetTool && to !== targetTool) return null;
    try { localStorage.removeItem(LS_PENDING); localStorage.removeItem(LS_TARGET); } catch (e) {}
    return parse(raw);
  }

  window.JVDSProjectBundle = {
    APP: APP,
    VERSION: VERSION,
    TOOLS: ['pixel-studio', 'sprite-animator', 'arcade-game-maker'],
    labels: LABELS,
    label: function (t) { return LABELS[t] || t; },
    isBundle: isBundle,
    make: make,
    download: download,
    parse: parse,
    readFile: readFile,
    openIn: openIn,
    takePending: takePending,
    fileName: fileName
  };
})();
