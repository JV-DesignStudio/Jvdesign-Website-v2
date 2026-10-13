/* Mod-Studio LiveEdit integration.
   Loaded after studio-liveedit.js and the mod-studio's own script.
   Discovers the studio's exposed API and wires up code editing + palette drag. */
(function () {
  'use strict';
  if (!window.JVDSLiveEdit) return;
  var LE = window.JVDSLiveEdit;

  /* Each mod-studio exposes window.JVDS_MOD_STUDIO = {
       getScriptCode()   -> full code string shown in the scripts preview
       getFieldMeta()    -> [{key, min, max}] editable constants
       getValues()       -> {key: currentValue}
       setValue(key, v)   -> update one value
       resetValues()      -> restore defaults
       refresh()          -> re-render all previews
       paletteEl          -> palette container element (optional)
     }
     If the studio hasn't exposed this API, we bail gracefully. */

  function init() {
    var api = window.JVDS_MOD_STUDIO;
    if (!api) return;

    /* Detect CSS prefix from the page (gms-, dms-, rbxs-, gdms-, mcms-) */
    var cssPrefix = 'gms';
    var prefixes = ['gms', 'dms', 'rbxs', 'gdms', 'mcms'];
    for (var pi = 0; pi < prefixes.length; pi++) {
      if (document.querySelector('.' + prefixes[pi] + '-card')) { cssPrefix = prefixes[pi]; break; }
    }

    /* Code editor */
    var previewEl = document.getElementById('gmScriptPreview') ||
                    document.getElementById('rbScriptPreview') ||
                    document.getElementById('msScriptPreview');
    if (previewEl && api.getScriptCode) {
      var wrap = document.createElement('div');
      wrap.className = cssPrefix + '-card';
      wrap.style.marginTop = '16px';
      wrap.innerHTML =
        '<h3>Edit your code</h3>' +
        '<p style="font-size:.84rem;color:var(--muted);margin:0 0 10px">' +
        'Change a number next to <code>=</code> and press Apply. ' +
        'Only safe number changes flow into the preview.</p>' +
        '<textarea id="msCodeEdit" rows="10" spellcheck="false" ' +
        'style="width:100%;font-family:\'JetBrains Mono\',monospace;font-size:.78rem;' +
        'border:1.5px solid var(--border);border-radius:10px;padding:10px;' +
        'background:#1e1e1e;color:#eee;resize:vertical" ' +
        'aria-label="Editable code"></textarea>' +
        '<div style="display:flex;gap:8px;margin:10px 0">' +
        '<button type="button" class="' + cssPrefix + '-btn ' + cssPrefix + '-btn--primary" id="msCodeApply">Apply</button>' +
        '<button type="button" class="' + cssPrefix + '-btn" id="msCodeReset">Reset</button>' +
        '</div>' +
        '<p class="' + cssPrefix + '-msg" id="msCodeMsg" role="status" aria-live="polite"></p>';

      var parent = previewEl.parentNode;
      parent.insertBefore(wrap, previewEl.nextSibling);

      LE.bindCodeEditor({
        textareaId: 'msCodeEdit',
        applyId:    'msCodeApply',
        resetId:    'msCodeReset',
        statusId:   'msCodeMsg',
        getCode:       function () { return api.getScriptCode(); },
        getFieldMeta:  function () { return api.getFieldMeta(); },
        getValues:     function () { return api.getValues(); },
        setValue:       function (k, v) { api.setValue(k, v); },
        resetValues:   function () { api.resetValues(); },
        refresh:       function () { api.refresh(); }
      });
    }

    /* Palette drag-and-drop */
    if (api.paletteEl) {
      LE.armPalette(api.paletteEl, function (value) {
        if (api.onPalettePick) api.onPalettePick(value);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
