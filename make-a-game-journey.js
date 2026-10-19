/* make-a-game-journey.js , A1718
 *
 * One visible three-step path across Pixel Studio, Sprite Animator and the
 * Arcade Game Maker: draw a character, animate it, then play it in a game.
 * The art is carried by the existing jvds-project-bundle.js handoff, so the
 * learner only draws it once.
 *
 * It adds a small "Make a game" pill (bottom centre) plus a step sheet. The
 * next-step button drives the tool's own Open-in buttons, so nothing here
 * needs to know how a tool builds its project. Arriving through a handoff
 * (JVDSProjectBundle.openIn) auto-opens the sheet on the next tool, so the
 * whole path is three taps: Next, Next, Play.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (!/^\/tools\//.test(location.pathname)) return;
  if (window.JVDSMakeAGameJourney) return;

  var TOOL = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');

  var TOOLS = {
    'pixel-studio': {
      step: 1, title: 'Draw your character', who: 'Ember',
      next: 'Animate it', action: 'openInSpriteAnimator'
    },
    'sprite-animator': {
      step: 2, title: 'Animate it', who: 'Ember',
      next: 'Play it in a game', action: 'openInGameMaker'
    },
    'arcade-game-maker': {
      step: 3, title: 'Build and play your game', who: 'Pip',
      next: 'Play your game', action: '#runGameBtn'
    }
  };
  var CFG = TOOLS[TOOL];
  if (!CFG) return;

  var STEPS = [
    { n: 1, label: 'Draw it', who: 'Ember' },
    { n: 2, label: 'Animate it', who: 'Ember' },
    { n: 3, label: 'Play it', who: 'Pip' }
  ];

  var LS_CONT = 'jvds_mj_continue';
  var STEP_KEY = 'jvds_mj_step';

  var CSS = [
    '.mj-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:9003;',
    'display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:10px 16px;',
    'background:#28241e;color:#f5efe0;border:1px solid rgba(240,234,214,.22);border-radius:999px;',
    'font:800 .78rem/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.34);white-space:nowrap}',
    '.mj-pill:hover{filter:brightness(1.12)}',
    '.mj-pill:focus-visible{outline:3px solid #BC4749;outline-offset:2px}',
    '.mj-pill b{font-weight:800}',
    '.mj-pill .mj-pill-dot{width:8px;height:8px;border-radius:50%;background:#4CC9C0;flex-shrink:0}',
    '.mj-sheet{position:fixed;inset:0;z-index:9005;display:none;align-items:center;justify-content:center;',
    'background:rgba(20,17,12,.55);padding:16px}',
    '.mj-sheet.open{display:flex}',
    '.mj-card{width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#28241e;color:#f5efe0;',
    'border:1px solid rgba(240,234,214,.18);border-radius:16px;padding:20px;position:relative;',
    'font:400 .9rem/1.5 Inter,system-ui,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.5)}',
    '.mj-close{position:absolute;top:8px;right:10px;background:none;border:none;color:#cbbf9f;font-size:1.3rem;',
    'line-height:1;cursor:pointer;padding:6px 9px;border-radius:8px}',
    '.mj-close:hover{color:#fff;background:rgba(255,255,255,.08)}',
    '.mj-kicker{margin:0 0 4px;font-size:.66rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8fd6d1}',
    '.mj-card h2{margin:0 0 6px;font-family:Fredoka,Inter,system-ui,sans-serif;font-size:1.3rem;font-weight:600;color:#fff}',
    '.mj-sub{margin:0 0 14px;color:#cbbf9f;font-size:.82rem}',
    '.mj-steps{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:8px}',
    '.mj-step{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;',
    'border:1px solid rgba(240,234,214,.12);background:rgba(255,255,255,.03)}',
    '.mj-step.on{border-color:#4CC9C0;background:rgba(76,201,192,.12)}',
    '.mj-step.done{border-color:rgba(122,199,79,.5)}',
    '.mj-num{flex-shrink:0;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;',
    'justify-content:center;font-weight:800;font-size:.8rem;background:rgba(255,255,255,.08);color:#e8ddd0}',
    '.mj-step.on .mj-num{background:#4CC9C0;color:#10231f}',
    '.mj-step.done .mj-num{background:#7AC74F;color:#10230a}',
    '.mj-step-txt{display:flex;flex-direction:column;min-width:0}',
    '.mj-step-txt b{font-size:.9rem;font-weight:700;color:#fff}',
    '.mj-step-txt small{font-size:.7rem;color:#a99f8a}',
    '.mj-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.mj-next{flex:1 1 190px;min-height:48px;background:#4e7d80;color:#fff;border:none;border-radius:11px;',
    'font:800 .9rem/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #3d6366}',
    '.mj-next:hover{filter:brightness(1.08)}',
    '.mj-next:focus-visible{outline:3px solid #BC4749;outline-offset:2px}',
    '.mj-start{font:700 .76rem/1 Inter,system-ui,sans-serif;color:#8fd6d1;text-decoration:none;white-space:nowrap}',
    '.mj-start:hover{text-decoration:underline}',
    '@media (max-width:560px){.mj-card{padding:16px}.mj-card h2{font-size:1.15rem}.mj-pill{font-size:.72rem;padding:9px 13px}}'
  ].join('');

  var sheet, pill, nextBtn, stepsEl;

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  function stepDone(n) {
    if (n === 1) return !!(ls('jvds_pixel') || ls('jvds_pixel_auto') || ls('jvds_pixel_keepsake'));
    if (n === 2) return !!(ls('jvds_sprite_anim') || ls('jvds_sprite_player'));
    if (n === 3) return !!(ls('jv_arcade_autosave') || ls('jv_arcade_slot_0'));
    return false;
  }

  function renderSteps() {
    if (!stepsEl) return;
    stepsEl.innerHTML = STEPS.map(function (s) {
      var cls = 'mj-step';
      if (s.n === CFG.step) cls += ' on';
      else if (stepDone(s.n)) cls += ' done';
      var tag = stepDone(s.n) ? ' (done)' : (s.n === CFG.step ? ' (you are here)' : '');
      return '<li class="' + cls + '">' +
        '<span class="mj-num" aria-hidden="true">' + (stepDone(s.n) ? '✓' : s.n) + '</span>' +
        '<span class="mj-step-txt"><b>' + s.n + '. ' + s.label + '</b>' +
        '<small>' + s.who + tag + '</small></span></li>';
    }).join('');
  }

  function nextActionEl() {
    if (CFG.action.charAt(0) === '#') return document.querySelector(CFG.action);
    var byHandler = document.querySelector('[data-on="' + CFG.action + '"]');
    if (byHandler) return byHandler;
    return null;
  }

  function goNext() {
    var el = nextActionEl();
    if (el) { el.click(); close(); return; }
    if (typeof window[CFG.action] === 'function') {
      try { window[CFG.action](); close(); return; } catch (e) {}
    }
    /* Fall back to the tool's own button by its tooltip, then give up gently. */
    var alt = document.querySelector('[data-on="openInSpriteAnimator"], [data-on="openInGameMaker"], #runGameBtn');
    if (alt) { alt.click(); close(); }
  }

  function open() {
    if (!sheet) build();
    renderSteps();
    if (nextBtn) nextBtn.textContent = CFG.next + ' →';
    sheet.classList.add('open');
    if (nextBtn) { try { nextBtn.focus(); } catch (e) {} }
  }

  function close() {
    if (sheet) sheet.classList.remove('open');
  }

  function build() {
    var style = document.createElement('style');
    style.id = 'mj-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    pill = document.createElement('button');
    pill.id = 'mj-pill';
    pill.className = 'mj-pill';
    pill.type = 'button';
    pill.setAttribute('aria-haspopup', 'dialog');
    pill.innerHTML = '<span class="mj-pill-dot" aria-hidden="true"></span>' +
      'Make a game <b>' + CFG.step + '/3</b>';
    pill.addEventListener('click', open);
    document.body.appendChild(pill);

    sheet = document.createElement('div');
    sheet.id = 'mj-sheet';
    sheet.className = 'mj-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'mj-title');
    sheet.innerHTML =
      '<div class="mj-card">' +
      '<button id="mj-close" class="mj-close" type="button" aria-label="Close">×</button>' +
      '<p class="mj-kicker">JVDS make-a-game path</p>' +
      '<h2 id="mj-title">Make a game this lunchtime</h2>' +
      '<p class="mj-sub">Three steps. Your art comes with you, so you only draw it once.</p>' +
      '<ol class="mj-steps" id="mj-steps"></ol>' +
      '<div class="mj-actions">' +
      '<button id="mj-next" class="mj-next" type="button">Next →</button>' +
      '<a class="mj-start" href="/tools/pixel-studio.html#make-a-game">Start at step 1</a>' +
      '</div></div>';
    document.body.appendChild(sheet);

    stepsEl = document.getElementById('mj-steps');
    nextBtn = document.getElementById('mj-next');
    nextBtn.addEventListener('click', goNext);
    document.getElementById('mj-close').addEventListener('click', close);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* Record that a hand-off is in flight so the next tool can continue the path. */
  try {
    var PB = window.JVDSProjectBundle;
    if (PB && typeof PB.openIn === 'function' && !PB.__mjWrapped) {
      var orig = PB.openIn;
      PB.openIn = function () {
        ssSet(LS_CONT, '1');
        return orig.apply(this, arguments);
      };
      PB.__mjWrapped = true;
    }
  } catch (e) {}

  function boot() {
    if (!document.body) return;
    build();
    var marked = /(^|[#&?])make-a-game\b/.test(location.hash + location.search);
    if (marked || ss(LS_CONT)) {
      ssDel(LS_CONT);
      open();
    }
    ssSet(STEP_KEY, String(CFG.step));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.JVDSMakeAGameJourney = { open: open, close: close, tool: TOOL, step: CFG.step };
})();
