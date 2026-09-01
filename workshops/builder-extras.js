/* JVDesignStudio Builder Extras
   Shared features for all 3D builders.
   Include after builder-quiz.js in each builder page.
   Expects: scene, camera, renderer, shipGroup/robotGroup/rocketGroup, P/R, rebuild/buildRocket/buildRobot, toast(), computeStats(), updateStats(), currentStep */

(function() {
  'use strict';

  /* ═══════════════════════════════════════
     CAMERA PRESETS
     ═══════════════════════════════════════ */
  window.builderCameraPresets = {
    front:  { theta: Math.PI * 0.5,  phi: Math.PI * 0.45, dist: 18 },
    side:   { theta: 0,              phi: Math.PI * 0.45, dist: 18 },
    top:    { theta: Math.PI * 0.5,  phi: 0.15,           dist: 22 },
    iso:    { theta: 0.6,            phi: 0.65,           dist: 20 },
  };

  window.builderSetCamera = function(preset) {
    var p = window.builderCameraPresets[preset];
    if (!p) return;
    if (typeof cTheta !== 'undefined') { cTheta = p.theta; cPhi = p.phi; cDist = p.dist; }
    if (typeof window._cTheta !== 'undefined') { window._cTheta = p.theta; window._cPhi = p.phi; window._cDist = p.dist; }
    toast('Camera: ' + preset.charAt(0).toUpperCase() + preset.slice(1));
  };

  /* ═══════════════════════════════════════
     SHARE LINK (URL STATE)
     ═══════════════════════════════════════ */
  window.builderShareBuild = function() {
    try {
      var state = window._builderGetState ? window._builderGetState() : {};
      var json = JSON.stringify(state);
      var compressed = btoa(unescape(encodeURIComponent(json)));
      var url = window.location.origin + window.location.pathname + '#build=' + compressed;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
          toast('Build link copied to clipboard!');
        }).catch(function() {
          toast('Link generated — check address bar');
          history.replaceState(null, '', '#build=' + compressed);
        });
      } else {
        history.replaceState(null, '', '#build=' + compressed);
        toast('Build saved to URL');
      }
    } catch(e) {
      toast('Could not generate link');
    }
  };

  window.builderLoadFromURL = function() {
    try {
      var hash = window.location.hash;
      if (!hash || hash.indexOf('#build=') !== 0) return false;
      var compressed = hash.substring(7);
      var json = decodeURIComponent(escape(atob(compressed)));
      var state = JSON.parse(json);
      if (window._builderApplyState) { window._builderApplyState(state); return true; }
    } catch(e) {}
    return false;
  };

  /* ═══════════════════════════════════════
     ONBOARDING TOOLTIP
     ═══════════════════════════════════════ */
  function showOnboarding() {
    if (localStorage.getItem('jvds-builder-seen')) return;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    overlay.innerHTML = '<div style="background:linear-gradient(145deg,#1a1d2a,#141722);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:28px 32px;max-width:400px;width:90%;text-align:center;font-family:Nunito,sans-serif">' +
      '<div style="font-size:2.5rem;margin-bottom:12px">🛠️</div>' +
      '<h3 style="font-family:Bebas Neue,sans-serif;font-size:1.4rem;color:#fff;margin-bottom:8px;letter-spacing:.04em">Welcome to the Builder</h3>' +
      '<p style="font-size:.85rem;color:rgba(232,238,248,.6);line-height:1.7;margin-bottom:20px">Use the <strong style="color:#fff">sidebar steps</strong> to build your creation. Drag the viewport to orbit, scroll to zoom. Try <strong style="color:#fff">Random</strong> for instant inspiration!</p>' +
      '<button style="background:linear-gradient(135deg,#e8543a,#b03020);color:#fff;font-family:Bebas Neue,sans-serif;font-size:1rem;letter-spacing:.08em;padding:10px 32px;border:none;border-radius:8px;cursor:pointer;box-shadow:0 3px 0 #8b2015" onclick="this.closest(\'div\').parentElement.remove();localStorage.setItem(\'jvds-builder-seen\',\'1\')">Let\'s Build!</button>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════
     BUILD TIMER + STEP COMPLETION FX
     ═══════════════════════════════════════ */
  var buildStartTime = Date.now();
  var stepCompletionTimes = {};

  window.builderStepComplete = function(stepIdx) {
    if (stepCompletionTimes[stepIdx]) return;
    stepCompletionTimes[stepIdx] = Date.now();
    // Visual FX: pulse the step number
    var items = document.querySelectorAll('.si');
    if (items[stepIdx]) {
      items[stepIdx].style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1)';
      items[stepIdx].style.transform = 'scale(1.08)';
      setTimeout(function() { items[stepIdx].style.transform = ''; }, 300);
    }
  };

  window.builderGetBuildTime = function() {
    var elapsed = Math.floor((Date.now() - buildStartTime) / 1000);
    var min = Math.floor(elapsed / 60);
    var sec = elapsed % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  };

  /* ═══════════════════════════════════════
     SOUND EFFECTS (Web Audio API)
     ═══════════════════════════════════════ */
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return audioCtx;
  }

  function playTone(freq, dur, vol, type) {
    var ctx = getAudioCtx();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.15));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (dur || 0.15));
  }

  window.builderSound = {
    click: function() { playTone(800, 0.06, 0.05, 'sine'); },
    apply: function() { playTone(523, 0.1, 0.06, 'sine'); setTimeout(function() { playTone(659, 0.1, 0.06, 'sine'); }, 80); },
    complete: function() { playTone(523, 0.12, 0.07, 'sine'); setTimeout(function() { playTone(659, 0.12, 0.07, 'sine'); }, 100); setTimeout(function() { playTone(784, 0.2, 0.07, 'sine'); }, 200); },
    error: function() { playTone(220, 0.2, 0.06, 'sawtooth'); },
  };

  /* ═══════════════════════════════════════
     MOBILE RIGHTBAR DRAWER
     ═══════════════════════════════════════ */
  function setupMobileDrawer() {
    var rb = document.getElementById('rightbar');
    if (!rb) return;
    var btn = document.createElement('button');
    btn.id = 'rbDrawerToggle';
    btn.textContent = '⚙️';
    btn.title = 'Quick Controls';
    btn.style.cssText = 'display:none;position:fixed;bottom:16px;right:16px;z-index:80;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--acc,#e8543a),var(--acc-dk,#b03020));color:#fff;border:none;font-size:1.3rem;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:transform .15s';
    btn.addEventListener('click', function() {
      var isOpen = rb.classList.toggle('drawer-open');
      btn.style.transform = isOpen ? 'rotate(90deg)' : '';
    });
    document.body.appendChild(btn);

    var style = document.createElement('style');
    style.textContent = '@media(max-width:860px){#rightbar{display:block!important;position:fixed;top:0;right:-300px;width:280px;height:100vh;z-index:100;transition:right .3s ease;overflow-y:auto;border-left:1px solid var(--border,#fff1)}#rightbar.drawer-open{right:0}#rbDrawerToggle{display:block!important}}';
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════
     UNDO / REDO
     ═══════════════════════════════════════ */
  var undoStack = [];
  var redoStack = [];
  var MAX_UNDO = 30;

  window.builderPushUndo = function() {
    var state = window._builderGetState ? window._builderGetState() : {};
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  };

  window.builderUndo = function() {
    if (undoStack.length === 0) { toast('Nothing to undo'); return; }
    var current = window._builderGetState ? JSON.stringify(window._builderGetState()) : '{}';
    redoStack.push(current);
    var prev = JSON.parse(undoStack.pop());
    if (window._builderApplyState) window._builderApplyState(prev);
    toast('Undo');
  };

  window.builderRedo = function() {
    if (redoStack.length === 0) { toast('Nothing to redo'); return; }
    var current = window._builderGetState ? JSON.stringify(window._builderGetState()) : '{}';
    undoStack.push(current);
    var next = JSON.parse(redoStack.pop());
    if (window._builderApplyState) window._builderApplyState(next);
    toast('Redo');
  };

  /* ═══════════════════════════════════════
     KEYBOARD SHORTCUTS (extend existing)
     ═══════════════════════════════════════ */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); window.builderUndo(); }
      if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); window.builderRedo(); }
      if (e.key === 'y')                { e.preventDefault(); window.builderRedo(); }
      if (e.key === 's')                { e.preventDefault(); if (window.openSaveModal) window.openSaveModal(); }
    }
  });

  /* ═══════════════════════════════════════
     INIT — inject camera + share + drawer into all builders
     ═══════════════════════════════════════ */
  function injectBuilderExtras() {
    // Add camera/share/undo buttons to all .hdr-right or .hdr-btns
    var hdrRight = document.querySelector('.hdr-right') || document.querySelector('.hdr-btns');
    if (hdrRight) {
      var camBtn = document.createElement('button');
      camBtn.className = hdrRight.querySelector('button') ? hdrRight.querySelector('button').className : 'quick-btn';
      camBtn.textContent = '📷 Camera';
      camBtn.onclick = function() {
        var presets = window.builderCameraPresets;
        var names = Object.keys(presets);
        var current = names.indexOf('_current') >= 0 ? names.indexOf('_current') : 0;
        var next = (current + 1) % names.length;
        window.builderSetCamera(names[next]);
      };
      camBtn.title = 'Cycle camera views (front/side/top/iso)';
      hdrRight.insertBefore(camBtn, hdrRight.children[1] || null);

      var shareBtn = document.createElement('button');
      shareBtn.className = camBtn.className;
      shareBtn.textContent = '🔗 Share';
      shareBtn.onclick = window.builderShareBuild;
      shareBtn.title = 'Copy shareable link';
      hdrRight.insertBefore(shareBtn, camBtn.nextSibling);
    }

    setupMobileDrawer();
    showOnboarding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBuilderExtras);
  } else {
    injectBuilderExtras();
  }

})();
