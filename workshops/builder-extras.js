/* JVDesignStudio Builder Extras v2
   Shared features for all 3D builders.
   Include after builder-quiz.js in each builder page. */
(function() {
  'use strict';

  var soundEnabled = localStorage.getItem('jvds-sound') !== 'off';

  /* ═══════════════════════════════════════
     CAMERA PRESETS
     ═══════════════════════════════════════ */
  window.builderCameraPresets = {
    front:  { theta: Math.PI * 0.5,  phi: Math.PI * 0.45, dist: 18 },
    side:   { theta: 0,              phi: Math.PI * 0.45, dist: 18 },
    top:    { theta: Math.PI * 0.5,  phi: 0.15,           dist: 22 },
    iso:    { theta: 0.6,            phi: 0.65,           dist: 20 },
  };
  var camIdx = 0;
  window.builderSetCamera = function(preset) {
    var p = window.builderCameraPresets[preset];
    if (!p) return;
    if (typeof cTheta !== 'undefined') { cTheta = p.theta; cPhi = p.phi; cDist = p.dist; }
    toast('Camera: ' + preset.charAt(0).toUpperCase() + preset.slice(1));
  };
  window.builderCycleCamera = function() {
    var names = Object.keys(window.builderCameraPresets);
    camIdx = (camIdx + 1) % names.length;
    window.builderSetCamera(names[camIdx]);
  };

  /* ═══════════════════════════════════════
     SHARE LINK (URL STATE)
     ═══════════════════════════════════════ */
  window.builderShareBuild = function() {
    try {
      var state = window._builderGetState ? window._builderGetState() : {};
      var compressed = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      var url = location.origin + location.pathname + '#build=' + compressed;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() { toast('Build link copied!'); }).catch(function() {
          history.replaceState(null, '', '#build=' + compressed); toast('Link saved to URL');
        });
      } else { history.replaceState(null, '', '#build=' + compressed); toast('Link saved to URL'); }
    } catch(e) { toast('Could not generate link'); }
  };

  window.builderLoadFromURL = function() {
    try {
      var h = location.hash;
      if (!h || h.indexOf('#build=') !== 0) return false;
      var state = JSON.parse(decodeURIComponent(escape(atob(h.substring(7)))));
      if (window._builderApplyState) { window._builderApplyState(state); return true; }
    } catch(e) {}
    return false;
  };

  /* ═══════════════════════════════════════
     FULLSCREEN MODE
     ═══════════════════════════════════════ */
  window.builderToggleFullscreen = function() {
    var vp = document.getElementById('viewport');
    if (!vp) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      var el = vp.requestFullscreen || vp.webkitRequestFullscreen;
      if (el) el.call(vp);
      toast('Fullscreen on');
    } else {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) ex.call(document);
      toast('Fullscreen off');
    }
  };

  /* ═══════════════════════════════════════
     AUTO-SAVE
     ═══════════════════════════════════════ */
  var autoSaveKey = 'jvds-autosave-' + (location.pathname.split('/').pop() || 'builder');
  var autoSaveTimer = null;

  function doAutoSave() {
    try {
      var state = window._builderGetState ? window._builderGetState() : null;
      if (!state) return;
      state._autosaveTime = Date.now();
      localStorage.setItem(autoSaveKey, JSON.stringify(state));
    } catch(e) {}
  }

  window.builderScheduleAutoSave = function() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(doAutoSave, 2000);
  };

  window.builderLoadAutoSave = function() {
    try {
      var raw = localStorage.getItem(autoSaveKey);
      if (!raw) return false;
      var state = JSON.parse(raw);
      if (!state || !state._autosaveTime) return false;
      var age = Date.now() - state._autosaveTime;
      if (age > 86400000) return false; // older than 24h
      if (window._builderApplyState) { window._builderApplyState(state); toast('Restored auto-save'); return true; }
    } catch(e) {}
    return false;
  };

  window.builderClearAutoSave = function() {
    localStorage.removeItem(autoSaveKey);
  };

  /* ═══════════════════════════════════════
     ONBOARDING TOOLTIP
     ═══════════════════════════════════════ */
  function showOnboarding() {
    if (localStorage.getItem('jvds-builder-seen')) return;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)';
    overlay.innerHTML = '<div style="background:linear-gradient(145deg,#1a1d2a,#141722);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:28px 32px;max-width:420px;width:92%;text-align:center;font-family:Nunito,sans-serif">' +
      '<div style="font-size:2.8rem;margin-bottom:12px">🛠️</div>' +
      '<h3 style="font-family:Bebas Neue,sans-serif;font-size:1.5rem;color:#fff;margin-bottom:8px;letter-spacing:.04em">Welcome to the Builder</h3>' +
      '<p style="font-size:.85rem;color:rgba(232,238,248,.6);line-height:1.7;margin-bottom:8px">Use the <strong style="color:#fff">sidebar steps</strong> to build your creation step by step.</p>' +
      '<p style="font-size:.8rem;color:rgba(232,238,248,.45);line-height:1.6;margin-bottom:20px">Drag to orbit · Scroll to zoom · Arrow keys to navigate steps · Try <strong style="color:#fff">Random</strong> for instant inspiration!</p>' +
      '<button style="background:linear-gradient(135deg,#e8543a,#b03020);color:#fff;font-family:Bebas Neue,sans-serif;font-size:1rem;letter-spacing:.08em;padding:11px 36px;border:none;border-radius:8px;cursor:pointer;box-shadow:0 3px 0 #8b2015;transition:transform .1s" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" onclick="this.closest(\'div\').parentElement.remove();localStorage.setItem(\'jvds-builder-seen\',\'1\')">Let\'s Build!</button>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════
     LOADING ANIMATION
     ═══════════════════════════════════════ */
  function showLoadingAnimation() {
    var overlay = document.createElement('div');
    overlay.id = 'builderLoading';
    overlay.style.cssText = 'position:fixed;inset:0;background:#0a0b10;z-index:600;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .5s';
    overlay.innerHTML = '<div style="font-size:3rem;margin-bottom:16px;animation:bldPulse 1.2s ease-in-out infinite">🛠️</div>' +
      '<div style="font-family:Bebas Neue,sans-serif;font-size:1.2rem;color:#e8eef8;letter-spacing:.1em;animation:bldFade .8s ease-in-out infinite alternate">Loading Builder...</div>' +
      '<style>@keyframes bldPulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.15);opacity:1}}@keyframes bldFade{0%{opacity:.4}100%{opacity:1}}</style>';
    document.body.appendChild(overlay);
    return overlay;
  }

  window.builderHideLoading = function() {
    var el = document.getElementById('builderLoading');
    if (el) { el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 500); }
  };

  /* ═══════════════════════════════════════
     BUILD TIMER + STEP COMPLETION FX
     ═══════════════════════════════════════ */
  var buildStartTime = Date.now();
  var stepCompletionTimes = {};

  window.builderStepComplete = function(stepIdx) {
    if (stepCompletionTimes[stepIdx]) return;
    stepCompletionTimes[stepIdx] = Date.now();
    var items = document.querySelectorAll('.si');
    if (items[stepIdx]) {
      items[stepIdx].style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1)';
      items[stepIdx].style.transform = 'scale(1.08)';
      setTimeout(function() { items[stepIdx].style.transform = ''; }, 300);
    }
  };

  window.builderGetBuildTime = function() {
    var elapsed = Math.floor((Date.now() - buildStartTime) / 1000);
    return Math.floor(elapsed / 60) + ':' + (elapsed % 60 < 10 ? '0' : '') + (elapsed % 60);
  };

  /* ═══════════════════════════════════════
     SOUND EFFECTS (Web Audio API)
     ═══════════════════════════════════════ */
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    return audioCtx;
  }
  function playTone(freq, dur, vol, type) {
    if (!soundEnabled) return;
    var ctx = getAudioCtx(); if (!ctx) return;
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.15));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + (dur || 0.15));
  }

  window.builderSound = {
    click: function() { playTone(800, 0.06, 0.04, 'sine'); },
    apply: function() { playTone(523, 0.1, 0.05, 'sine'); setTimeout(function() { playTone(659, 0.1, 0.05, 'sine'); }, 80); },
    complete: function() { playTone(523, 0.12, 0.06, 'sine'); setTimeout(function() { playTone(659, 0.12, 0.06, 'sine'); }, 100); setTimeout(function() { playTone(784, 0.2, 0.06, 'sine'); }, 200); },
    error: function() { playTone(220, 0.2, 0.05, 'sawtooth'); },
  };

  window.builderToggleSound = function() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('jvds-sound', soundEnabled ? 'on' : 'off');
    toast(soundEnabled ? 'Sound on' : 'Sound off');
    var btn = document.getElementById('soundToggleBtn');
    if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
  };

  /* ═══════════════════════════════════════
     SHORTCUTS HELP OVERLAY
     ═══════════════════════════════════════ */
  window.builderShowShortcuts = function() {
    var existing = document.getElementById('shortcutsOverlay');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'shortcutsOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    var shortcuts = [
      ['← →', 'Navigate steps'],
      ['↑ ↓', 'Navigate steps'],
      ['Ctrl+Z', 'Undo'],
      ['Ctrl+Shift+Z', 'Redo'],
      ['Ctrl+S', 'Save'],
      ['Esc', 'Close dialogs'],
      ['F', 'Fullscreen'],
      ['?', 'This help'],
    ];
    var rows = shortcuts.map(function(s) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">' +
        '<kbd style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:5px;padding:3px 10px;font-family:JetBrains Mono,monospace;font-size:.75rem;color:#fff;min-width:90px;text-align:center">' + s[0] + '</kbd>' +
        '<span style="font-size:.82rem;color:rgba(232,238,248,.6)">' + s[1] + '</span></div>';
    }).join('');
    overlay.innerHTML = '<div style="background:linear-gradient(145deg,#1a1d2a,#141722);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:24px 28px;max-width:380px;width:90%">' +
      '<h3 style="font-family:Bebas Neue,sans-serif;font-size:1.2rem;color:#fff;margin-bottom:14px;letter-spacing:.04em">⌨️ Keyboard Shortcuts</h3>' + rows +
      '<button style="margin-top:14px;width:100%;padding:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:7px;color:rgba(232,238,248,.6);font-size:.8rem;cursor:pointer" onclick="this.closest(\'div\').parentElement.remove()">Close</button></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === e.currentTarget) overlay.remove(); });
  };

  /* ═══════════════════════════════════════
     STATS-ON-SCREENSHOT EXPORT
     ═══════════════════════════════════════ */
  window.builderExportStatsCard = function() {
    if (!renderer) return;
    renderer.render(scene, camera);
    var oc = document.createElement('canvas');
    oc.width = 600; oc.height = 400;
    var ctx = oc.getContext('2d');
    var stats = computeStats ? computeStats() : {};
    var name = (window.R ? R.name : window.P ? 'Ship' : 'Rocket') || 'Build';

    // Background
    ctx.fillStyle = '#0a0b10';
    ctx.fillRect(0, 0, 600, 400);
    // 3D render
    ctx.drawImage(renderer.domElement, 0, 0, 400, 400);
    // Stats panel
    ctx.fillStyle = 'rgba(10,11,16,0.92)';
    ctx.fillRect(400, 0, 200, 400);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, 400); ctx.stroke();
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Bebas Neue", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.substring(0, 18), 500, 36);
    ctx.fillStyle = 'rgba(232,238,248,0.4)';
    ctx.font = '9px monospace';
    ctx.fillText('JVDESIGNSTUDIO.CO.UK', 500, 52);
    // Stats bars
    var statNames = Object.keys(stats);
    var colors = ['#e8543a', '#38bdf8', '#4ade80', '#f5c842', '#a78bfa', '#fb923c'];
    statNames.forEach(function(k, i) {
      var y = 80 + i * 40;
      var val = stats[k];
      ctx.fillStyle = 'rgba(232,238,248,0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(k.toUpperCase(), 416, y + 10);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(416, y + 16, 168, 6);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(416, y + 16, 168 * Math.min(val, 10) / 10, 6);
      ctx.textAlign = 'right';
      ctx.fillText(val + '/10', 584, y + 10);
    });
    // Footer
    ctx.fillStyle = 'rgba(232,238,248,0.2)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Free · Browser-based · jvdesignstudio.co.uk', 500, 388);

    var a = document.createElement('a');
    a.href = oc.toDataURL('image/png');
    a.download = name.toLowerCase().replace(/\s+/g, '-') + '-stats-card.png';
    a.click();
    toast('Stats card exported!');
  };

  /* ═══════════════════════════════════════
     BUILD GALLERY
     ═══════════════════════════════════════ */
  window.builderShowGallery = function() {
    var savesKey = autoSaveKey.replace('jvds-autosave-', 'jvds-saves-');
    var saves = {};
    try { saves = JSON.parse(localStorage.getItem(savesKey) || '{}'); } catch(e) {}
    // Also check builder-specific saves
    var extraKeys = ['robotSaves', 'rocketSaves', 'shipSaves', 'airshipSaves'];
    extraKeys.forEach(function(k) {
      try {
        var d = JSON.parse(localStorage.getItem(k) || '{}');
        Object.keys(d).forEach(function(n) { if (!saves[n]) saves[n] = d[n]; });
      } catch(e) {}
    });
    var keys = Object.keys(saves);
    var existing = document.getElementById('galleryOverlay');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'galleryOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    var grid = '';
    if (keys.length === 0) {
      grid = '<p style="color:rgba(232,238,248,.4);font-size:.85rem;padding:20px 0;text-align:center">No saved builds yet. Use Save to store your creations!</p>';
    } else {
      grid = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;max-height:300px;overflow-y:auto;padding:4px">' +
        keys.map(function(k) {
          var d = saves[k];
          var date = d.date ? new Date(d.date).toLocaleDateString() : '';
          var thumb = d.thumbnail || '';
          return '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px;cursor:pointer;transition:border-color .15s;text-align:center" onmouseover="this.style.borderColor=\'rgba(255,255,255,.25)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\'" onclick="builderGalleryLoad(\'' + k.replace(/'/g, "\\'") + '\')">' +
            (thumb ? '<img src="' + thumb + '" style="width:100%;height:80px;object-fit:cover;border-radius:4px;margin-bottom:6px">' : '<div style="height:80px;background:rgba(255,255,255,.03);border-radius:4px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;font-size:1.5rem">🏗️</div>') +
            '<div style="font-size:.75rem;color:#e8eef8;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + k + '</div>' +
            '<div style="font-size:.6rem;color:rgba(232,238,248,.35)">' + date + '</div>' +
          '</div>';
        }).join('') + '</div>';
    }
    overlay.innerHTML = '<div style="background:linear-gradient(145deg,#1a1d2a,#141722);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:24px 28px;max-width:520px;width:92%">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="font-family:Bebas Neue,sans-serif;font-size:1.2rem;color:#fff;letter-spacing:.04em">📁 Build Gallery</h3>' +
      '<button style="background:none;border:none;color:rgba(232,238,248,.4);font-size:1.2rem;cursor:pointer" onclick="this.closest(\'div\').parentElement.parentElement.remove()">✕</button></div>' +
      grid + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === e.currentTarget) overlay.remove(); });
  };

  window.builderGalleryLoad = function(name) {
    // Try to load from any save system
    var found = false;
    ['robotSaves', 'rocketSaves', 'shipSaves', 'airshipSaves'].forEach(function(k) {
      if (found) return;
      try {
        var d = JSON.parse(localStorage.getItem(k) || '{}');
        if (d[name] && d[name].params) {
          if (window._builderApplyState) {
            window._builderApplyState({ params: d[name].params, step: d[name].step || 0 });
            found = true;
            toast('Loaded: ' + name);
          }
        }
      } catch(e) {}
    });
    var overlay = document.getElementById('galleryOverlay');
    if (overlay) overlay.remove();
  };

  /* ═══════════════════════════════════════
     MOBILE CONTROLS DRAWER
     ═══════════════════════════════════════ */
  function setupMobileDrawer() {
    var rb = document.getElementById('rightbar');
    var cpanel = document.getElementById('cpanel') || document.querySelector('.cpanel');
    var style = document.createElement('style');

    if (rb) {
      // Robot/Rocket: rightbar drawer
      var btn = document.createElement('button');
      btn.id = 'rbDrawerToggle';
      btn.textContent = '⚙️';
      btn.title = 'Quick Controls';
      btn.style.cssText = 'display:none;position:fixed;bottom:16px;right:16px;z-index:80;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--acc,#e8543a),var(--acc-dk,#b03020));color:#fff;border:none;font-size:1.3rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:transform .15s';
      btn.addEventListener('click', function() {
        rb.classList.toggle('drawer-open');
        btn.style.transform = rb.classList.contains('drawer-open') ? 'rotate(90deg)' : '';
      });
      document.body.appendChild(btn);
      style.textContent = '@media(max-width:860px){#rightbar{display:block!important;position:fixed;top:0;right:-300px;width:280px;height:100vh;z-index:100;transition:right .3s ease;overflow-y:auto;border-left:1px solid var(--border,#fff1)}#rightbar.drawer-open{right:0}#rbDrawerToggle{display:block!important}}';
    } else if (cpanel) {
      // Pirate/Airship: bottom-sheet controls
      var btn2 = document.createElement('button');
      btn2.id = 'rbDrawerToggle';
      btn2.textContent = '🎛️';
      btn2.title = 'Build Controls';
      btn2.style.cssText = 'display:none;position:fixed;bottom:16px;right:16px;z-index:80;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--gold,#d4a843),var(--rust,#8b4513));color:var(--sea,#0a1628);border:none;font-size:1.3rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:transform .15s';
      btn2.addEventListener('click', function() {
        var isOpen = cpanel.classList.toggle('mobile-drawer-open');
        btn2.style.transform = isOpen ? 'rotate(45deg)' : '';
      });
      document.body.appendChild(btn2);
      style.textContent = '@media(max-width:860px){.cpanel,#cpan{position:fixed!important;bottom:0!important;left:0!important;right:0!important;top:auto!important;max-height:55vh!important;width:100%!important;border-radius:14px 14px 0 0!important;z-index:100!important;transform:translateY(100%);transition:transform .3s ease!important;overflow-y:auto!important;box-shadow:0 -4px 20px rgba(0,0,0,.4)!important}.cpanel.mobile-drawer-open,#cpan.mobile-drawer-open{transform:translateY(0)!important}#rbDrawerToggle{display:block!important}.snav{position:sticky;bottom:0;background:var(--sea,#0a1628);z-index:101;border-top:1px solid rgba(212,168,67,.15)}}';
    }
    if (style.textContent) document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════
     UNDO / REDO
     ═══════════════════════════════════════ */
  var undoStack = [], redoStack = [], MAX_UNDO = 30;

  window.builderPushUndo = function() {
    var state = window._builderGetState ? window._builderGetState() : {};
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  };

  window.builderUndo = function() {
    if (!undoStack.length) { toast('Nothing to undo'); return; }
    redoStack.push(JSON.stringify(window._builderGetState ? window._builderGetState() : {}));
    if (window._builderApplyState) window._builderApplyState(JSON.parse(undoStack.pop()));
    toast('Undo');
  };

  window.builderRedo = function() {
    if (!redoStack.length) { toast('Nothing to redo'); return; }
    undoStack.push(JSON.stringify(window._builderGetState ? window._builderGetState() : {}));
    if (window._builderApplyState) window._builderApplyState(JSON.parse(redoStack.pop()));
    toast('Redo');
  };

  /* ═══════════════════════════════════════
     KEYBOARD SHORTCUTS
     ═══════════════════════════════════════ */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); window.builderShowShortcuts(); }
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); window.builderToggleFullscreen(); }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); window.builderUndo(); }
      if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); window.builderRedo(); }
      if (e.key === 'y')                { e.preventDefault(); window.builderRedo(); }
      if (e.key === 's')                { e.preventDefault(); if (window.openSaveModal) window.openSaveModal(); }
    }
  });

  /* ═══════════════════════════════════════
     BADGE / ACHIEVEMENT SYSTEM
     ═══════════════════════════════════════ */
  var BUILDER_ID = (location.pathname.split('/').pop() || '').replace('.html', '').replace('-builder', '');
  var BADGES_KEY = 'jvds-builder-badges';

  var ALL_BADGES = {
    'first-build':   { icon: '🏗️', name: 'First Build', desc: 'Completed your first builder' },
    'rocket-badge':  { icon: '🚀', name: 'Rocket Scientist', desc: 'Built a rocket' },
    'robot-badge':   { icon: '🤖', name: 'Robot Engineer', desc: 'Built a robot' },
    'pirate-badge':  { icon: '🏴‍☠️', name: 'Pirate Captain', desc: 'Built a pirate ship' },
    'airship-badge': { icon: '🛩️', name: 'Airship Pilot', desc: 'Built an airship' },
    'all-builders':  { icon: '🏆', name: 'Master Builder', desc: 'Completed all 4 builders' },
    'speed-builder': { icon: '⚡', name: 'Speed Builder', desc: 'Completed a build in under 2 minutes' },
    'randomizer':    { icon: '🎲', name: 'Randomizer', desc: 'Used the Random build feature' },
    'sharer':        { icon: '🔗', name: 'Shark Sharer', desc: 'Shared a build link' },
    'saver':         { icon: '💾', name: 'Pack Rat', desc: 'Saved 5 or more builds' },
  };

  function getBadges() {
    try { return JSON.parse(localStorage.getItem(BADGES_KEY) || '{}'); } catch(e) { return {}; }
  }

  function saveBadges(b) { localStorage.setItem(BADGES_KEY, JSON.stringify(b)); }

  window.builderAwardBadge = function(id) {
    var badges = getBadges();
    if (badges[id]) return;
    badges[id] = Date.now();
    saveBadges(badges);
    var b = ALL_BADGES[id];
    if (b && toast) toast('🏅 Badge: ' + b.name);
  };

  window.builderShowBadges = function() {
    var badges = getBadges();
    var existing = document.getElementById('badgeOverlay');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'badgeOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    var grid = Object.keys(ALL_BADGES).map(function(id) {
      var b = ALL_BADGES[id];
      var earned = badges[id];
      return '<div style="text-align:center;padding:10px 8px;border-radius:8px;border:1px solid ' + (earned ? 'rgba(255,209,102,.3)' : 'rgba(255,255,255,.06)') + ';background:' + (earned ? 'rgba(255,209,102,.06)' : 'rgba(255,255,255,.02)') + ';opacity:' + (earned ? '1' : '.4') + '">' +
        '<div style="font-size:1.8rem;margin-bottom:4px">' + (earned ? b.icon : '🔒') + '</div>' +
        '<div style="font-size:.72rem;font-weight:700;color:' + (earned ? '#ffd166' : 'rgba(232,238,248,.3)') + '">' + b.name + '</div>' +
        '<div style="font-size:.6rem;color:rgba(232,238,248,.35);margin-top:2px">' + b.desc + '</div>' +
        (earned ? '<div style="font-size:.5rem;color:rgba(232,238,248,.25);margin-top:3px">' + new Date(badges[id]).toLocaleDateString() + '</div>' : '') +
        '</div>';
    }).join('');
    var total = Object.keys(ALL_BADGES).length;
    var earned = Object.keys(badges).length;
    overlay.innerHTML = '<div style="background:linear-gradient(145deg,#1a1d2a,#141722);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:24px 28px;max-width:520px;width:92%">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="font-family:Bebas Neue,sans-serif;font-size:1.2rem;color:#fff;letter-spacing:.04em">🏅 Badges (' + earned + '/' + total + ')</h3>' +
      '<button style="background:none;border:none;color:rgba(232,238,248,.4);font-size:1.2rem;cursor:pointer" onclick="this.closest(\'div\').parentElement.parentElement.remove()">✕</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;max-height:350px;overflow-y:auto">' + grid + '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === e.currentTarget) overlay.remove(); });
  };

  window.builderTrackProgress = function() {
    var builders = {};
    try { builders = JSON.parse(localStorage.getItem('jvds-builder-progress') || '{}'); } catch(e) {}
    var page = location.pathname.split('/').pop();
    if (!builders[page]) builders[page] = { visits: 0, lastVisit: 0, completed: false };
    builders[page].visits++;
    builders[page].lastVisit = Date.now();
    localStorage.setItem('jvds-builder-progress', JSON.stringify(builders));
  };

  window.builderMarkComplete = function() {
    var builders = {};
    try { builders = JSON.parse(localStorage.getItem('jvds-builder-progress') || '{}'); } catch(e) {}
    var page = location.pathname.split('/').pop();
    if (!builders[page]) builders[page] = { visits: 0, lastVisit: 0, completed: false };
    builders[page].completed = true;
    builders[page].completedAt = Date.now();
    localStorage.setItem('jvds-builder-progress', JSON.stringify(builders));

    // Award builder-specific badge
    if (page.includes('rocket'))  window.builderAwardBadge('rocket-badge');
    if (page.includes('robot'))   window.builderAwardBadge('robot-badge');
    if (page.includes('pirate'))  window.builderAwardBadge('pirate-badge');
    if (page.includes('airship')) window.builderAwardBadge('airship-badge');
    window.builderAwardBadge('first-build');

    // Check if all builders complete
    var allDone = ['rocket-builder.html','robot-builder.html','pirate-ship-builder.html','steampunk-airship-builder.html'].every(function(p) {
      return builders[p] && builders[p].completed;
    });
    if (allDone) window.builderAwardBadge('all-builders');
  };

  window.builderShowProgress = function() {
    var builders = {};
    try { builders = JSON.parse(localStorage.getItem('jvds-builder-progress') || '{}'); } catch(e) {}
    var pages = [
      { key: 'rocket-builder.html', name: '🚀 Rocket Builder', icon: '🚀' },
      { key: 'robot-builder.html', name: '🤖 Robot Builder', icon: '🤖' },
      { key: 'pirate-ship-builder.html', name: '🏴‍☠️ Pirate Ship', icon: '🏴‍☠️' },
      { key: 'steampunk-airship-builder.html', name: '🛩️ Airship', icon: '🛩️' },
    ];
    var existing = document.getElementById('progressOverlay');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'progressOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    var rows = pages.map(function(p) {
      var d = builders[p.key];
      var done = d && d.completed;
      var visits = d ? d.visits : 0;
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06)">' +
        '<div style="font-size:1.5rem">' + (done ? '✅' : '⬜') + '</div>' +
        '<div style="flex:1"><div style="font-size:.85rem;color:' + (done ? '#4ade80' : 'var(--text)') + ';font-weight:700">' + p.name + '</div>' +
        '<div style="font-size:.65rem;color:rgba(232,238,248,.35)">' + (done ? 'Completed' : visits + ' visits') + '</div></div>' +
        '</div>';
    }).join('');
    var completed = pages.filter(function(p) { return builders[p.key] && builders[p.key].completed; }).length;
    overlay.innerHTML = '<div style="background:linear-gradient(145deg,#1a1d2a,#141722);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:24px 28px;max-width:400px;width:92%">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="font-family:Bebas Neue,sans-serif;font-size:1.2rem;color:#fff;letter-spacing:.04em">📊 Builder Progress (' + completed + '/4)</h3>' +
      '<button style="background:none;border:none;color:rgba(232,238,248,.4);font-size:1.2rem;cursor:pointer" onclick="this.closest(\'div\').parentElement.parentElement.remove()">✕</button></div>' +
      rows +
      '<div style="margin-top:14px;text-align:center"><button onclick="this.closest(\'div\').parentElement.parentElement.remove();builderShowBadges()" style="background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.25);color:#ffd166;padding:7px 18px;border-radius:6px;font-size:.78rem;cursor:pointer;font-weight:700">🏅 View Badges</button></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === e.currentTarget) overlay.remove(); });
  };

  /* ═══════════════════════════════════════
     ANALYTICS
     ═══════════════════════════════════════ */
  window.builderTrack = function(event, data) {
    try {
      var events = JSON.parse(localStorage.getItem('jvds-builder-analytics') || '[]');
      events.push({ event: event, data: data || {}, time: Date.now(), page: location.pathname.split('/').pop() });
      if (events.length > 100) events = events.slice(-100);
      localStorage.setItem('jvds-builder-analytics', JSON.stringify(events));
    } catch(e) {}
  };

  /* ═══════════════════════════════════════
     INIT
     ═══════════════════════════════════════ */
  function injectBuilderExtras() {
    showLoadingAnimation();
    setTimeout(function() { window.builderHideLoading(); }, 600);

    var hdrRight = document.querySelector('.hdr-right') || document.querySelector('.hdr-btns');
    if (hdrRight) {
      var btnClass = (hdrRight.querySelector('button') || {}).className || 'quick-btn';

      // Camera
      var camBtn = document.createElement('button');
      camBtn.className = btnClass; camBtn.textContent = '📷 Camera';
      camBtn.title = 'Cycle camera views'; camBtn.onclick = window.builderCycleCamera;
      hdrRight.insertBefore(camBtn, hdrRight.children[1] || null);

      // Share
      var shareBtn = document.createElement('button');
      shareBtn.className = btnClass; shareBtn.textContent = '🔗 Share';
      shareBtn.title = 'Copy shareable link'; shareBtn.onclick = window.builderShareBuild;
      hdrRight.insertBefore(shareBtn, camBtn.nextSibling);

      // Gallery
      var galBtn = document.createElement('button');
      galBtn.className = btnClass; galBtn.textContent = '📁 Gallery';
      galBtn.title = 'Saved builds'; galBtn.onclick = window.builderShowGallery;
      hdrRight.insertBefore(galBtn, shareBtn.nextSibling);

      // Fullscreen
      var fsBtn = document.createElement('button');
      fsBtn.className = btnClass; fsBtn.textContent = '⛶ Full';
      fsBtn.title = 'Toggle fullscreen (F)'; fsBtn.onclick = window.builderToggleFullscreen;
      hdrRight.insertBefore(fsBtn, galBtn.nextSibling);

      // Sound
      var sndBtn = document.createElement('button');
      sndBtn.id = 'soundToggleBtn'; sndBtn.className = btnClass;
      sndBtn.textContent = soundEnabled ? '🔊' : '🔇';
      sndBtn.title = 'Toggle sound'; sndBtn.onclick = window.builderToggleSound;
      hdrRight.appendChild(sndBtn);

      // Stats card
      var scBtn = document.createElement('button');
      scBtn.className = btnClass; scBtn.textContent = '📊 Stats Card';
      scBtn.title = 'Export stats card image'; scBtn.onclick = window.builderExportStatsCard;
      hdrRight.appendChild(scBtn);

      // Shortcuts
      var helpBtn = document.createElement('button');
      helpBtn.className = btnClass; helpBtn.textContent = '❓';
      helpBtn.title = 'Keyboard shortcuts (?)'; helpBtn.onclick = window.builderShowShortcuts;
      hdrRight.appendChild(helpBtn);

      // Progress
      var progBtn = document.createElement('button');
      progBtn.className = btnClass; progBtn.textContent = '📊 Progress';
      progBtn.title = 'Builder progress & badges'; progBtn.onclick = window.builderShowProgress;
      hdrRight.appendChild(progBtn);
    }

    setupMobileDrawer();
    showOnboarding();
    window.builderLoadFromURL();
    window.builderTrackProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBuilderExtras);
  } else {
    injectBuilderExtras();
  }

})();
