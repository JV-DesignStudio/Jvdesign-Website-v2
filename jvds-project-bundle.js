/* jvds-project-bundle.js , A1587, A2296
   One downloadable .jvds project file shared by Pixel Studio, Sprite Animator
   and the Arcade Game Maker, plus an "Open in..." handoff between them.

   Format note: PROJECT_FILE_FORMAT.md

   Bundle (JSON) envelope:
     {
       app: 'jvds-tool-bundle', v: 2,
       tool: 'pixel-studio' | 'sprite-animator' | 'arcade-game-maker',
       name: string,
       createdAt: ISO string,
       project: <native project object for that tool,
                 includes the game data for arcade-game-maker>,
       sprite:  { dataUrl, frameW, frameH, frameCount } | null,
       sound:   { name, music, buffers, sounds } | null,
       level:   { map, entities } | null,
       preview: dataUrl | null
     }

   v1 files still open: parse() upgrades them to v2 with sound and level set
   to null, so an old download never becomes unreadable.

   "Open in..." uses the same localStorage convention as tool-handoff.js:
   stash the bundle under jvds_tool_bundle with a jvds_tool_bundle_to marker,
   navigate, and the target consumes it on boot with takePending(tool).
*/
(function () {
  'use strict';

  var APP = 'jvds-tool-bundle';
  var VERSION = 2;
  var SUPPORTED = [1, 2];
  var EXT = '.jvds';
  var LS_PENDING = 'jvds_tool_bundle';
  var LS_TARGET = 'jvds_tool_bundle_to';

  var LABELS = {
    'pixel-studio': 'Pixel Studio',
    'sprite-animator': 'Sprite Animator',
    'arcade-game-maker': 'Game Maker'
  };

  function isBundle(o) { return !!o && o.app === APP && SUPPORTED.indexOf(o.v) !== -1; }

  function normalise(o) {
    if (!isBundle(o)) return null;
    if (o.v === 1) o.v = VERSION;
    if (!('sound' in o) || o.sound === undefined) o.sound = null;
    if (!('level' in o) || o.level === undefined) o.level = null;
    if (!('sprite' in o) || o.sprite === undefined) o.sprite = null;
    if (!('project' in o) || o.project === undefined) o.project = null;
    return o;
  }

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
      sound: opts.sound || null,
      level: opts.level || null,
      preview: opts.preview || null
    };
  }

  function slug(s) {
    return String(s || 'project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'project';
  }

  function fileName(bundle) {
    return slug(bundle.tool) + '-' + slug(bundle.name) + EXT;
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
      return normalise(o);
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
    EXT: EXT,
    TOOLS: ['pixel-studio', 'sprite-animator', 'arcade-game-maker'],
    labels: LABELS,
    label: function (t) { return LABELS[t] || t; },
    isBundle: isBundle,
    normalise: normalise,
    make: make,
    download: download,
    parse: parse,
    readFile: readFile,
    openIn: openIn,
    takePending: takePending,
    fileName: fileName
  };
})();
