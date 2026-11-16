/* A2311: one visible undo / redo / autosave status bar for the editors.
   It finds the page's own undo, redo and save controls and mirrors them, so
   the status is the same everywhere without replacing each studio's history.
   Tools opt in by loading this script. */
(function () {
  'use strict';
  if (window.EditorStatus) return;
  var path = String(location.pathname || '');
  var m = path.match(/\/(?:tools|workshops)\/([^/]+?)\.html$/);
  var tool = m ? m[1] : 'studio';
  var KEY = 'jvds_editor_status:' + tool;
  var bar = null, stateEl = null, saveBtn = null, undoBtn = null, redoBtn = null;
  var dirtyTimer = null;

  function visible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    var cs = window.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function pick(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (visible(el)) return el;
    }
    return null;
  }
  function byText(re) {
    var nodes = [].slice.call(document.querySelectorAll('button,[role="button"],a,input[type="button"]'));
    for (var i = 0; i < nodes.length; i++) {
      var text = (nodes[i].textContent || nodes[i].value || '').trim();
      if (re.test(text) && visible(nodes[i])) return nodes[i];
    }
    return null;
  }
  function findUndo() {
    return pick(['[data-on="undo"]', '#undo', '#undoBtn', '#ttUndo', '[data-on*="undo" i]', '[aria-label="Undo"]', '[aria-label*="undo" i]']) || byText(/^undo\b/i);
  }
  function findRedo() {
    return pick(['[data-on="redo"]', '#redo', '#redoBtn', '#ttRedo', '[data-on*="redo" i]', '[aria-label="Redo"]', '[aria-label*="redo" i]']) || byText(/^redo\b/i);
  }
  function findSave() {
    return pick(['[data-on="saveProject"]', '[data-on="saveToLibrary"]', '[data-on="save"]', '#ttSave', '#saveBtn', '[data-on*="save" i]', '[aria-label*="save" i]']) || byText(/^save\b/i);
  }

  function timeNow() {
    try {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }
  function readSaved() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && v.at ? v : null;
    } catch (e) {
      return null;
    }
  }
  function writeSaved() {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now() })); } catch (e) {}
  }

  function setState(mode, text) {
    if (!bar || !stateEl) return;
    bar.setAttribute('data-state', mode);
    stateEl.textContent = text;
  }
  function markDirty() {
    if (!bar) return;
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(function () { setState('dirty', 'Unsaved changes'); }, 120);
  }
  function markSaved() {
    if (!bar) return;
    writeSaved();
    setState('saved', 'Saved ' + timeNow());
  }
  function refresh() {
    if (!bar) return;
    var saved = readSaved();
    setState(saved ? 'saved' : 'auto', saved ? 'Saved ' + new Date(saved.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Autosave on');
  }

  function build() {
    if (document.getElementById('editor-status')) return;
    bar = document.createElement('div');
    bar.id = 'editor-status';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Editor status');
    bar.innerHTML =
      '<button type="button" data-es="undo" aria-label="Undo">&#8630; Undo</button>' +
      '<button type="button" data-es="redo" aria-label="Redo">&#8631; Redo</button>' +
      '<span data-es="state" aria-live="polite">Autosave on</span>' +
      '<button type="button" data-es="save" aria-label="Save">Save</button>';
    var host = document.getElementById('main-content') || document.querySelector('main') || document.body;
    host.insertBefore(bar, host.firstChild);

    var style = document.createElement('style');
    style.textContent =
      '#editor-status{position:sticky;top:0;z-index:45;display:flex;align-items:center;gap:8px;flex-wrap:wrap;' +
      'padding:6px 12px;background:rgba(20,16,10,.86);color:#f5efe0;border-bottom:1px solid rgba(240,234,214,.16);' +
      'font:600 .72rem/1.2 Inter,system-ui,sans-serif;backdrop-filter:blur(8px);}' +
      '#editor-status button{font:inherit;color:#f5efe0;background:rgba(255,255,255,.08);border:1px solid rgba(240,234,214,.25);' +
      'border-radius:999px;padding:4px 10px;cursor:pointer;min-height:28px;}' +
      '#editor-status button:hover{background:rgba(255,255,255,.16);}' +
      '#editor-status button:focus-visible{outline:3px solid #7c3aed;outline-offset:2px;}' +
      '#editor-status button[disabled]{opacity:.4;cursor:not-allowed;}' +
      '#editor-status [data-es="state"]{margin-left:auto;color:#d9cfbd;}' +
      '#editor-status[data-state="dirty"] [data-es="state"]{color:#f5c842;}' +
      '#editor-status[data-state="saved"] [data-es="state"]{color:#74d99f;}';
    document.head.appendChild(style);

    stateEl = bar.querySelector('[data-es="state"]');
    saveBtn = bar.querySelector('[data-es="save"]');
    undoBtn = bar.querySelector('[data-es="undo"]');
    redoBtn = bar.querySelector('[data-es="redo"]');

    var undo = findUndo(), redo = findRedo(), save = findSave();
    var undoFn = undo ? null : (window.undo || window.undoDraw || window.cardUndo || window.palUndo);
    var redoFn = redo ? null : (window.redo || window.redoDraw || window.cardRedo || window.palRedo);
    if (!undo && !undoFn) undoBtn.disabled = true;
    if (!redo && !redoFn) redoBtn.disabled = true;
    if (!save) saveBtn.hidden = true;

    if (undo) undoBtn.addEventListener('click', function () { undo.click(); markDirty(); });
    else if (undoFn) undoBtn.addEventListener('click', function () { undoFn(); markDirty(); });
    if (redo) redoBtn.addEventListener('click', function () { redo.click(); markDirty(); });
    else if (redoFn) redoBtn.addEventListener('click', function () { redoFn(); markDirty(); });
    if (save) {
      saveBtn.addEventListener('click', function () { save.click(); setTimeout(markSaved, 350); });
      save.addEventListener('click', function () { setTimeout(markSaved, 350); }, true);
    }
    document.querySelectorAll('[data-on*="restore" i], [data-on*="Restore"]').forEach(function (el) {
      el.addEventListener('click', function () { setTimeout(markSaved, 400); });
    });

    refresh();
  }

  function watch() {
    var host = document.getElementById('main-content') || document.querySelector('main') || document.body;
    ['input', 'change', 'pointerdown', 'keydown'].forEach(function (type) {
      host.addEventListener(type, function (e) {
        if (bar && bar.contains(e.target)) return;
        markDirty();
      }, true);
    });
  }

  function init() {
    build();
    watch();
  }

  window.EditorStatus = { markDirty: markDirty, markSaved: markSaved, refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
