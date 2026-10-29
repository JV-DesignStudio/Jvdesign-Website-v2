/**
 * builder-test-btn.js - "Test Your Build!" shortcut overlay
 * Injects a prominent sticky "Test It!" button into 3D builder pages
 * that fires the builder's own LAUNCH/POWER UP/Test action, then
 * plays a dopamine particle burst + chime via jvHUD if available.
 */
(function () {
  'use strict';

  // Only run on builder pages
  var isBuilderPage = !!(
    document.querySelector('#rocketCanvas, #robotCanvas, [data-bs-css], .main-layout.builder-layout') ||
    /\b(rocket|robot|race|pirate|castle|submarine|airship|station|fairy|cannon|phone)\b.*builder/i.test(document.title)
  );
  if (!isBuilderPage) return;

  var CSS = `
    .jvbt-btn {
      position: fixed; bottom: 74px; left: 50%; transform: translateX(-50%);
      z-index: 8000;
      background: linear-gradient(135deg, var(--jv-rose,#BC4749), #d05a5c);
      color: #fff; border: none; border-radius: 50px;
      padding: 13px 28px;
      font-family: var(--jv-font-display,'Fredoka','Inter',sans-serif);
      font-size: 1rem; font-weight: 700;
      cursor: pointer; white-space: nowrap;
      box-shadow: 0 4px 24px rgba(188,71,73,.45);
      transition: transform .2s, box-shadow .2s, opacity .3s;
      display: flex; align-items: center; gap: 10px;
      opacity: 0; pointer-events: none;
    }
    .jvbt-btn.ready { opacity: 1; pointer-events: auto; }
    .jvbt-btn:hover { transform: translateX(-50%) translateY(-2px); box-shadow: 0 7px 28px rgba(188,71,73,.6); }
    .jvbt-btn:active { transform: translateX(-50%) scale(.97); }
    @media (max-width: 600px) {
      .jvbt-btn { bottom: 14px; font-size: .88rem; padding: 11px 20px; }
    }
  `;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'jvbtTestBtn';
  btn.className = 'jvbt-btn';
  btn.setAttribute('aria-label', 'Test your build');
  btn.innerHTML = '<span aria-hidden="true">🧪</span> Test Your Build!';
  document.body.appendChild(btn);

  // Detect builder type from DOM
  function getLaunchTarget() {
    // Rocket / most builders: data-on="launch"
    var launchEl = document.querySelector('[data-on="launch"]');
    if (launchEl) return launchEl;
    // Robot: data-on="powerUp"
    var powerEl = document.querySelector('[data-on="powerUp"], .run-btn');
    if (powerEl) return powerEl;
    // Race car: data-on="driveTest"  or closest run-btn
    var runEl = document.querySelector('.run-btn');
    if (runEl) return runEl;
    return null;
  }

  function PCOLS() { return ['#BC4749','#70A3A7','#7C6CF0','#FFD23C','#F0EAD6']; }
  function burstAt(el) {
    var r = el.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var cols = PCOLS();
    for (var i = 0; i < 16; i++) {
      var p = document.createElement('div');
      var angle = (i / 16) * 2 * Math.PI;
      var dist = 50 + Math.random() * 60;
      var tx = (Math.cos(angle) * dist).toFixed(1) + 'px,' + (Math.sin(angle) * dist).toFixed(1) + 'px';
      p.style.cssText =
        'position:fixed;width:9px;height:9px;border-radius:50%;pointer-events:none;z-index:9010;' +
        'left:' + (cx - 4.5).toFixed(0) + 'px;top:' + (cy - 4.5).toFixed(0) + 'px;' +
        'background:' + cols[i % cols.length] + ';' +
        'animation:jvbt-pop .7s ease-out ' + (i * 0.025).toFixed(3) + 's forwards;' +
        '--jvbt-tx:translate(' + tx + ')';
      document.body.appendChild(p);
      setTimeout(function (el) { el.remove(); }, 900, p);
    }
  }

  if (!document.getElementById('jvbt-anim')) {
    var anim = document.createElement('style');
    anim.id = 'jvbt-anim';
    anim.textContent = '@keyframes jvbt-pop{0%{opacity:1;transform:translate(0,0) scale(1.2)}100%{opacity:0;transform:var(--jvbt-tx,translate(0,-50px)) scale(0)}}';
    document.head.appendChild(anim);
  }

  function playTestChime() {
    if (window.jvHUD && window.jvHUD.playChime) { window.jvHUD.playChime(); return; }
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function t(f, t0, dur) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0, ctx.currentTime + t0);
        g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t0 + dur);
        o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.04);
      }
      t(523, 0, 0.15); t(659, 0.16, 0.15); t(784, 0.32, 0.28);
      setTimeout(function () { try { ctx.close(); } catch (_) {} }, 800);
    } catch (_) {}
  }

  btn.addEventListener('click', function () {
    var target = getLaunchTarget();
    if (!target) return;
    burstAt(btn);
    playTestChime();
    // Scroll target into view, then click
    try { target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
    setTimeout(function () { target.click(); }, 200);
    // Toast via HUD if present
    if (window.jvHUD && window.jvHUD.showToast) {
      window.jvHUD.showToast('🧪', 'Testing your build!', 'Watch the action below', btn);
    }
  });

  // Show the test button once the user has interacted (made at least 1 step)
  var shown = false;
  function tryShow() {
    if (shown) return;
    // Look for any indication that building has started (progFill, step completed, etc.)
    var fill = document.getElementById('progFill');
    if (fill) {
      var w = parseFloat(fill.style.width || '0');
      if (w > 3) { shown = true; btn.classList.add('ready'); return; }
    }
    var doneDots = document.querySelectorAll('.dot.done, .step-item.completed, .si.done');
    if (doneDots.length > 0) { shown = true; btn.classList.add('ready'); return; }
  }

  // Poll briefly until the builder boots, then watch for progress
  var poll = setInterval(function () {
    tryShow();
    if (shown) clearInterval(poll);
  }, 300);
  setTimeout(function () { clearInterval(poll); }, 30000);

  // Also show after a longish idle in case the progress tracking doesn't fire
  setTimeout(function () {
    if (!shown) { shown = true; btn.classList.add('ready'); }
  }, 8000);

  // Screenshot exporter enhancement - inject a "Save Picture" banner near the canvas if none exists
  setTimeout(function () {
    var canvas = document.querySelector('#rocketCanvas, #robotCanvas, canvas[id$="Canvas"]');
    if (!canvas || document.querySelector('[data-on="screenshotPNG"], .save-pic-btn')) return;
    var savePic = document.createElement('button');
    savePic.type = 'button';
    savePic.className = 'save-pic-btn';
    savePic.style.cssText =
      'position:absolute;top:8px;right:8px;z-index:50;' +
      'background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:8px;' +
      'padding:6px 10px;font-size:.74rem;font-weight:700;cursor:pointer;' +
      'display:flex;align-items:center;gap:5px;backdrop-filter:blur(4px);' +
      'transition:background .15s';
    savePic.innerHTML = '📷 Save Picture';
    savePic.setAttribute('aria-label', 'Save a picture of your build');
    savePic.addEventListener('mouseover', function () { this.style.background = 'rgba(0,0,0,.75)'; });
    savePic.addEventListener('mouseout',  function () { this.style.background = 'rgba(0,0,0,.55)'; });
    savePic.addEventListener('click', function () {
      try {
        var url = canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'my-3d-build.png';
        a.click();
        burstAt(savePic);
        if (window.jvHUD && window.jvHUD.showToast) {
          window.jvHUD.showToast('📷', 'Picture saved!', 'Check your downloads folder', savePic);
        }
      } catch (e) {
        alert('To save: right-click the 3D view and choose "Save image as..."');
      }
    });
    var wrap = canvas.closest('.scene-wrap, .viewport-wrap') || canvas.parentNode;
    if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(savePic); }
  }, 2000);
})();
