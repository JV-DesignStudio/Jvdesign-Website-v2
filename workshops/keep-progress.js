(function () {
  'use strict';

  var DISMISS_KEY = 'jvds-kp-dismissed';
  var STYLE_ID = 'keep-progress-css';

  function isWorkshop() {
    return !!document.querySelector('[data-workshop-outcome], .progress-wrap, #finishBanner, main.workshop');
  }

  function dismissed() {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    document.querySelectorAll('.kp-block').forEach(function (el) { el.remove(); });
  }

  function backpack() {
    if (window.JVDS && window.JVDS.backpack) return Promise.resolve(window.JVDS.backpack);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/jvds-store.js';
      s.async = true;
      s.onload = function () {
        if (window.JVDS && window.JVDS.backpack) resolve(window.JVDS.backpack);
        else reject(new Error('Could not load the save helper'));
      };
      s.onerror = function () { reject(new Error('Could not load the save helper')); };
      document.head.appendChild(s);
    });
  }

  function say(block, msg, isError) {
    var el = block.querySelector('.kp-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('kp-err', !!isError);
  }

  function download(block, pack) {
    var code = block.querySelector('.kp-code');
    if (code) { code.value = JSON.stringify(pack); code.hidden = false; }
    try {
      var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'my-jvds-progress-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) {}
    say(block, 'Saved ' + pack.count + ' items. The code above can also be copied to another computer.');
  }

  function exportProgress(block) {
    backpack().then(function (bp) {
      download(block, bp.collect());
    }).catch(function (e) {
      say(block, e.message || 'Could not export your progress', true);
    });
  }

  function applyCode(block, text) {
    var t = String(text || '').trim();
    if (!t) { say(block, 'Paste a code first, or choose a file.', true); return; }
    var data;
    try { data = JSON.parse(t); } catch (e) { say(block, 'That does not look like a progress code.', true); return; }
    backpack().then(function (bp) {
      if (!confirm('Bring this progress onto this computer? Matching saves will be overwritten.')) return;
      var n;
      try { n = bp.restore(data); } catch (e) { say(block, e.message || 'Could not import that code', true); return; }
      say(block, 'Restored ' + n + ' items. Reloading so your steps update...');
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) {
      say(block, e.message || 'Could not import that code', true);
    });
  }

  function toggleImport(block) {
    var panel = block.querySelector('.kp-import-panel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      var code = panel.querySelector('.kp-code');
      if (code) code.focus();
      say(block, 'Paste a code or choose a file, then press Restore.');
    }
  }

  function makeBlock(position) {
    var sec = document.createElement('section');
    sec.className = 'kp-block kp-block--' + position;
    sec.setAttribute('aria-label', 'Keep your progress');
    sec.innerHTML =
      '<div class="kp-inner">' +
        '<p class="kp-kicker"><img src="/assets/mascots/echo-badge.webp" alt="" width="22" height="22" loading="lazy"> Echo\'s save check</p>' +
        '<h2 class="kp-title">Keep your progress</h2>' +
        '<p class="kp-text">Your workshop progress saves on this computer only. Export it to carry on at home or on another school computer. No account needed.</p>' +
        '<div class="kp-actions">' +
          '<button type="button" class="kp-btn kp-btn--primary" data-kp="export">Download my progress</button>' +
          '<button type="button" class="kp-btn" data-kp="import" aria-expanded="false">Bring my progress here</button>' +
          '<button type="button" class="kp-btn kp-btn--quiet" data-kp="dismiss">Not now</button>' +
        '</div>' +
        '<div class="kp-import-panel" hidden>' +
          '<textarea class="kp-code" rows="3" spellcheck="false" aria-label="Progress code" placeholder="Paste your progress code here"></textarea>' +
          '<div class="kp-actions">' +
            '<button type="button" class="kp-btn" data-kp="restore">Restore</button>' +
            '<label class="kp-file-label">Choose a progress file <input type="file" class="kp-file" accept="application/json,.json"></label>' +
          '</div>' +
        '</div>' +
        '<p class="kp-status" role="status" aria-live="polite"></p>' +
      '</div>';

    sec.querySelector('[data-kp="export"]').addEventListener('click', function () { exportProgress(sec); });
    sec.querySelector('[data-kp="import"]').addEventListener('click', function (e) {
      var open = (sec.querySelector('.kp-import-panel') || {}).hidden === false;
      e.currentTarget.setAttribute('aria-expanded', open ? 'false' : 'true');
      toggleImport(sec);
    });
    sec.querySelector('[data-kp="dismiss"]').addEventListener('click', dismiss);
    sec.querySelector('[data-kp="restore"]').addEventListener('click', function () {
      applyCode(sec, sec.querySelector('.kp-code').value);
    });
    sec.querySelector('.kp-file').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { applyCode(sec, reader.result); };
      reader.onerror = function () { say(sec, 'Could not read that file.', true); };
      reader.readAsText(f);
      this.value = '';
    });

    return sec;
  }

  function place(sec, position) {
    var anchor = null;
    if (position === 'start') {
      anchor = document.querySelector('.progress-wrap') || document.querySelector('main.workshop');
      if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(sec, anchor); return; }
      anchor = document.querySelector('[data-workshop-outcome]') || document.querySelector('.hero');
      if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(sec, anchor.nextSibling); return; }
      anchor = document.querySelector('main');
      if (anchor) { anchor.insertBefore(sec, anchor.firstChild); return; }
    } else {
      anchor = document.querySelector('#finishBanner') || document.querySelector('main.workshop');
      if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(sec, anchor.nextSibling); return; }
      anchor = document.querySelector('.next-route') || document.querySelector('main');
      if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(sec, anchor.nextSibling); return; }
    }
    document.body.appendChild(sec);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.kp-block{max-width:820px;margin:16px auto;padding:0 16px;box-sizing:border-box}' +
      '.kp-block--end{margin-top:8px;margin-bottom:40px}' +
      '.kp-inner{background:var(--card,#fff);border:1.5px solid var(--border,rgba(64,59,51,.14));border-radius:14px;padding:14px 16px;color:var(--charcoal,#1a1208);box-shadow:0 2px 8px rgba(0,0,0,.05)}' +
      '.kp-kicker{display:flex;align-items:center;gap:6px;margin:0 0 4px;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--teal-dk,#4e7d80)}' +
      '.kp-title{font-family:Fredoka,Inter,sans-serif;font-size:1.05rem;margin:0 0 4px}' +
      '.kp-text{margin:0 0 10px;font-size:.86rem;line-height:1.5;color:var(--charcoal-lt,#3d3224)}' +
      '.kp-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.kp-btn{font:inherit;font-weight:800;font-size:.82rem;border-radius:999px;padding:8px 14px;cursor:pointer;border:1.5px solid var(--border,rgba(64,59,51,.2));background:var(--beige,#F0EAD6);color:var(--charcoal,#1a1208)}' +
      '.kp-btn--primary{background:var(--teal-dk,#4e7d80);border-color:var(--teal-dk,#4e7d80);color:#fff}' +
      '.kp-btn--quiet{background:transparent;border-color:transparent;text-decoration:underline;padding-left:6px;padding-right:6px}' +
      '.kp-btn:focus-visible{outline:3px solid var(--gold,#c98a2e);outline-offset:2px}' +
      '.kp-import-panel{display:grid;gap:8px;margin-top:10px}' +
      '.kp-import-panel[hidden]{display:none}' +
      '.kp-code{width:100%;box-sizing:border-box;font-family:\'JetBrains Mono\',monospace;font-size:.76rem;padding:8px;border-radius:8px;border:1.5px solid var(--border,rgba(64,59,51,.2));background:var(--bg,#fbf8f2);color:var(--charcoal,#1a1208);resize:vertical}' +
      '.kp-file-label{font-size:.8rem;font-weight:700;color:var(--charcoal-lt,#3d3224)}' +
      '.kp-file{display:block;margin-top:4px;max-width:100%;font:inherit;font-size:.78rem}' +
      '.kp-status{margin:8px 0 0;font-size:.8rem;font-weight:700;color:var(--teal-dk,#4e7d80)}' +
      '.kp-status.kp-err{color:var(--rose,#BC4749)}' +
      '@media (max-width:480px){.kp-btn{width:100%}.kp-block{padding:0 12px}}';
    document.head.appendChild(style);
  }

  function run() {
    if (!isWorkshop() || dismissed() || document.querySelector('.kp-block')) return;
    injectStyles();
    place(makeBlock('start'), 'start');
    place(makeBlock('end'), 'end');
  }

  window.JVDSKeepProgress = {
    collect: function () { return backpack().then(function (bp) { return bp.collect(); }); },
    restore: function (code) {
      return backpack().then(function (bp) { return bp.restore(JSON.parse(String(code))); });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else setTimeout(run, 0);
})();
