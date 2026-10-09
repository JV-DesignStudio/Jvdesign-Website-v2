/**
 * workshop-enhancements.js
 * Shared enhancements for all My First Minecraft Mod workshop pages.
 * Features: copy buttons, localStorage progress, teacher mode, sticky progress, Stuck? collapsibles, reset.
 */
(function () {
  'use strict';

  // ── INJECTED STYLES ──────────────────────────────────────────────────────────
  const css = `
    /* Copy button */
    .code-label { justify-content: space-between !important; align-items: center; }
    .copy-btn {
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.14);
      color: rgba(232,234,242,.55);
      font-size: .63rem;
      font-weight: 800;
      letter-spacing: .07em;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all .15s;
      font-family: 'Inter',sans-serif;
      flex-shrink: 0;
      line-height: 1;
    }
    .copy-btn:hover { background: rgba(255,255,255,.14); color: #fff; }
    .copy-btn.copied { background: rgba(6,214,160,.18); border-color: rgba(6,214,160,.35); color: #06d6a0; }

    /* Teacher mode toggle */
    .teacher-toggle-btn {
      background: rgba(255,209,102,.08);
      border: 1px solid rgba(255,209,102,.22);
      color: rgba(255,209,102,.7);
      font-size: .73rem;
      font-weight: 700;
      padding: 5px 11px;
      border-radius: 8px;
      cursor: pointer;
      transition: all .15s;
      white-space: nowrap;
      font-family: 'Inter',sans-serif;
    }
    .teacher-toggle-btn:hover,
    .teacher-toggle-btn.active { background: rgba(255,209,102,.16); border-color: rgba(255,209,102,.45); color: #ffd166; }
    @media(max-width:860px){ .teacher-toggle-btn { display: none !important; } }
    /* A802 lesson plan link stays visible on small screens (it is a link, not a toggle) */
    a.teacher-toggle-btn.lesson-plan-btn { text-decoration: none; }
    @media(max-width:860px){ a.teacher-toggle-btn.lesson-plan-btn { display: inline-block !important; } }

    /* Teacher notes */
    .teacher-note {
      display: none;
      background: rgba(255,209,102,.05);
      border: 1px solid rgba(255,209,102,.18);
      border-left: 3px solid #ffd166;
      border-radius: 10px;
      padding: 12px 15px;
      margin: 14px 0;
      font-size: .82rem;
      line-height: 1.65;
      color: rgba(255,230,150,.85);
    }
    .teacher-note > strong {
      display: block;
      font-size: .7rem;
      letter-spacing: .09em;
      text-transform: uppercase;
      color: #ffd166;
      margin-bottom: 5px;
    }
    body.teacher-mode .teacher-note { display: block; }

    /* Stuck? collapsible */
    .stuck-section {
      margin: 14px 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(248,113,113,.22);
    }
    .stuck-title {
      background: rgba(248,113,113,.07);
      padding: 10px 14px;
      font-size: .82rem;
      font-weight: 700;
      color: rgba(248,113,113,.85);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      transition: background .15s;
      list-style: none;
    }
    .stuck-title:hover { background: rgba(248,113,113,.12); }
    .stuck-arrow { margin-left: auto; font-size: .72rem; color: rgba(248,113,113,.55); }
    .stuck-body {
      background: rgba(248,113,113,.04);
      padding: 13px 15px;
      font-size: .83rem;
      line-height: 1.65;
      color: rgba(232,234,242,.75);
      border-top: 1px solid rgba(248,113,113,.12);
    }
    .stuck-body ul { padding-left: 18px; margin: 6px 0; }
    .stuck-body li { margin-bottom: 6px; }
    .stuck-body strong { color: #fff; }
    .stuck-body code {
      background: #2a2d3a;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: .78rem;
      font-family: 'JetBrains Mono','Courier New',monospace;
      color: #c9d1e0;
    }

    /* Sticky progress bar */
    .progress-wrap.progress-sticky {
      position: sticky;
      top: 68px;
      z-index: 89;
      background: rgba(10,11,16,.96);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(255,255,255,.06);
      padding-bottom: 14px;
      margin-left: 0;
      margin-right: 0;
      max-width: 100%;
    }
    .progress-wrap.progress-sticky .progress-header,
    .progress-wrap.progress-sticky .progress-track,
    .progress-wrap.progress-sticky .step-dots {
      max-width: 1100px;
      margin-left: auto;
      margin-right: auto;
    }

    /* Reset button */
    .reset-progress-btn {
      background: none;
      border: 1px solid rgba(255,255,255,.08);
      color: rgba(255,255,255,.2);
      font-size: .68rem;
      padding: 4px 11px;
      border-radius: 6px;
      cursor: pointer;
      transition: all .15s;
      font-family: 'Inter',sans-serif;
      margin-top: 6px;
    }
    .reset-progress-btn:hover { border-color: rgba(248,113,113,.35); color: rgba(248,113,113,.7); }

    /* Report issue button */
    .report-issue-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 900;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(26,29,42,.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(232,234,242,.6);
      font-family: 'Fredoka',cursive;
      font-size: .78rem;
      font-weight: 600;
      padding: 9px 16px;
      border-radius: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: all .2s;
      box-shadow: 0 4px 16px rgba(0,0,0,.25);
    }
    .report-issue-fab:hover {
      background: rgba(248,113,113,.12);
      border-color: rgba(248,113,113,.35);
      color: #f87171;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,.3);
    }
    .report-issue-fab .report-icon { font-size: 1rem; line-height: 1; }
    @media(max-width:480px) {
      .report-issue-fab { bottom: 16px; right: 16px; font-size: .72rem; padding: 8px 12px; }
    }

    /* Interactive improvements */
    .quiz-feedback.show, .cc-feedback.show, .cf-feedback.show, .tf-feedback.show {
      animation: feedbackSlide .3s ease-out;
    }
    @keyframes feedbackSlide {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .quiz-opt.disabled {
      opacity: 0.35 !important;
      pointer-events: none !important;
      text-decoration: line-through;
    }
    .quiz-opt:not(.disabled):not(.correct):not(.wrong):hover {
      transform: translateX(4px);
      transition: transform .15s ease;
    }
    .quiz-next-btn.show {
      animation: btnPulse .6s ease-out;
    }
    @keyframes btnPulse {
      0% { transform: scale(0.9); opacity: 0; }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }
    .cc-blank:focus, .cf-blank:focus {
      outline: 2px solid rgba(124,108,240,.5);
      outline-offset: 2px;
      box-shadow: 0 0 0 4px rgba(124,108,240,.15);
    }
    .cc-blank.correct, .cf-blank.correct {
      background: rgba(6,214,160,.12) !important;
      border-color: rgba(6,214,160,.5) !important;
    }
    .cc-blank.wrong, .cf-blank.wrong {
      background: rgba(248,113,113,.12) !important;
      border-color: rgba(248,113,113,.5) !important;
      animation: shake .4s ease;
    }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-3px); }
      80% { transform: translateX(3px); }
    }
    .quiz-opt.wrong {
      animation: shake .4s ease;
    }
    .order-item {
      transition: border-color .3s ease, transform .15s ease;
    }
    .order-item:hover:not(.locked) {
      transform: translateX(4px);
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'workshop-enhancements-css';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── STORAGE KEY ─────────────────────────────────────────────────────────────
  const storageKey = 'wkp_' + location.pathname.replace(/\W+/g, '_').replace(/^_|_$/g, '');

  // ── COPY BUTTONS ────────────────────────────────────────────────────────────
  function initCopyButtons() {
    document.querySelectorAll('.code-wrap').forEach(function (wrap) {
      var label = wrap.querySelector('.code-label');
      var body = wrap.querySelector('.code-body');
      if (!label || !body) return;

      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');

      btn.onclick = function (e) {
        e.stopPropagation();
        var text = body.innerText || body.textContent || '';
        var done = function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
        } else {
          fallbackCopy(text, done);
        }
      };

      label.appendChild(btn);
    });
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { /* silent */ }
    document.body.removeChild(ta);
  }

  // ── TEACHER MODE ─────────────────────────────────────────────────────────────
  function initTeacherMode() {
    var active = localStorage.getItem('teacher_mode') === '1';
    if (active) document.body.classList.add('teacher-mode');

    var btn = document.createElement('button');
    btn.className = 'teacher-toggle-btn' + (active ? ' active' : '');
    btn.textContent = active ? '🎓 Teacher ON' : '🎓 Teacher';
    btn.title = 'Toggle teacher notes for each step';

    btn.onclick = function () {
      var on = document.body.classList.toggle('teacher-mode');
      localStorage.setItem('teacher_mode', on ? '1' : '0');
      btn.textContent = on ? '🎓 Teacher ON' : '🎓 Teacher';
      btn.classList.toggle('active', on);
    };

    var header = document.querySelector('.header-inner');
    var navToggle = document.getElementById('navToggle');
    if (header && navToggle) header.insertBefore(btn, navToggle);
    else if (header) header.appendChild(btn);
  }

  // ── LESSON PLAN LINK (A802) ─────────────────────────────────────────────
  // Workshops with a printable teacher plan on /teachers expose it here,
  // next to the teacher toggle, so a teacher finds it without hunting.
  var LESSON_PLANS = {
    'scratch-catch-workshop': 'plan-scratch-catch',
    'python-catch-workshop': 'plan-python-catch',
    'js-snake-workshop': 'plan-js-snake'
  };
  function initLessonPlanLink() {
    var seg = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var anchor = LESSON_PLANS[seg];
    if (!anchor || document.getElementById('lessonPlanBtn')) return;
    var header = document.querySelector('.header-inner');
    if (!header) return;
    var a = document.createElement('a');
    a.id = 'lessonPlanBtn';
    a.href = '/teachers#' + anchor;
    a.className = 'teacher-toggle-btn lesson-plan-btn';
    a.textContent = '📋 Lesson plan';
    a.title = 'Open the printable teacher lesson plan for this workshop';
    var navToggle = document.getElementById('navToggle');
    if (header && navToggle) header.insertBefore(a, navToggle);
    else header.appendChild(a);
  }

  // ── STUCK? COLLAPSIBLES ──────────────────────────────────────────────────────
  function initStuckSections() {
    document.querySelectorAll('.stuck-section').forEach(function (section) {
      var title = section.querySelector('.stuck-title');
      var body = section.querySelector('.stuck-body');
      if (!title || !body) return;

      var arrow = document.createElement('span');
      arrow.className = 'stuck-arrow';
      arrow.textContent = '▶';
      title.appendChild(arrow);

      body.style.display = 'none';

      title.onclick = function () {
        var open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        arrow.textContent = open ? '▶' : '▼';
      };
    });
  }

  // ── STICKY PROGRESS ──────────────────────────────────────────────────────────
  function initStickyProgress() {
    var prog = document.querySelector('.progress-wrap');
    var hero = document.querySelector('.hero');
    if (!prog || !hero || typeof IntersectionObserver === 'undefined') return;

    var obs = new IntersectionObserver(function (entries) {
      prog.classList.toggle('progress-sticky', !entries[0].isIntersecting);
    }, { threshold: 0 });
    obs.observe(hero);
  }

  // ── LEARNING MAP ────────────────────────────────────────────────────────────
  function initLearningMap() {
    if (document.querySelector('.lesson-map')) return;

    var stepCards = document.querySelectorAll('.step-card[id^="step-"]');
    var builder = document.querySelector('.main-layout .steps-panel, .main-layout .game-panel, .layout .steps-col, .layout .game-col');
    var progress = document.querySelector('.progress-wrap');
    var xp = document.querySelector('.xp-wrap');
    if (!stepCards.length && !builder) return;

    var total = window.WORKSHOP_TOTAL || stepCards.length || 0;
    var active = 1;
    stepCards.forEach(function (card, idx) {
      if (card.classList.contains('active-step') || card.classList.contains('open')) active = idx + 1;
    });

    var title = document.querySelector('h1');
    var cleanTitle = title ? title.textContent.replace(/\s+/g, ' ').trim() : 'this workshop';
    var map = document.createElement('section');
    map.className = 'lesson-map';
    map.setAttribute('aria-label', 'Workshop learning path');

    var totalText = total ? total + ' guided steps' : 'guided build';
    var mode = builder ? 'Interactive builder' : 'Step-by-step workshop';
    map.innerHTML =
      '<div class="lesson-map-card">' +
        '<div class="lesson-map-kicker">' + mode + '</div>' +
        '<div class="lesson-map-title">Build, test, then unlock the next piece.</div>' +
        '<div class="lesson-map-text">' + cleanTitle + ' is designed as a visible path: make one working part, prove you understand it, then keep moving.</div>' +
      '</div>' +
      '<div class="lesson-map-card lesson-map-step">' +
        '<div class="lesson-map-num">1</div><div class="lesson-map-small">Build<span>Follow the action list</span></div>' +
      '</div>' +
      '<div class="lesson-map-card lesson-map-step">' +
        '<div class="lesson-map-num">2</div><div class="lesson-map-small">Check<span>Answer or test it</span></div>' +
      '</div>' +
      '<div class="lesson-map-card lesson-map-step">' +
        '<div class="lesson-map-num">3</div><div class="lesson-map-small">Unlock<span>' + totalText + '</span></div>' +
      '</div>';

    var anchor = progress || xp || document.querySelector('.hero');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(map, anchor.nextSibling);
    }

    if (stepCards.length) {
      stepCards.forEach(function (card, idx) {
        var header = card.querySelector('.step-header');
        if (!header) return;
        header.setAttribute('aria-label', 'Step ' + (idx + 1) + ' of ' + total + '. Open this step.');
      });
    }

    document.documentElement.style.setProperty('--workshop-active-step', active);
  }

  // ── BLUEPRINT COACH ─────────────────────────────────────────────────────────
  function initBlueprintCoach() {
    if (document.querySelector('.blueprint-coach')) return;

    var hasBlueprintSurface = document.querySelector('.bp-outer, .bp-canvas-wrap');
    var hasBuilderShell = document.querySelector('.main-layout, .layout');
    if (!hasBlueprintSurface || !hasBuilderShell) return;

    var coach = document.createElement('section');
    coach.className = 'blueprint-coach';
    coach.setAttribute('aria-label', 'Blueprint workshop guide');
    coach.innerHTML =
      '<div class="blueprint-coach-card blueprint-coach-lead">' +
        '<div class="blueprint-coach-kicker">Blueprint build loop</div>' +
        '<strong>Wire the graph, apply the feature, then test the game.</strong>' +
        '<span>Each step should feel like Unreal: connect the nodes, apply the change and check the live preview before moving on.</span>' +
      '</div>' +
      '<div class="blueprint-coach-card"><b>Read pins</b><span>Outputs on the right connect to inputs on the left.</span></div>' +
      '<div class="blueprint-coach-card"><b>Type values</b><span>Click value fields and enter the exact number or label asked for.</span></div>' +
      '<div class="blueprint-coach-card"><b>Test preview</b><span>After applying a step, look for the visible change in the game.</span></div>';

    var anchor = document.querySelector('.lesson-map') || document.querySelector('.xp-wrap') || document.querySelector('.hero');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(coach, anchor.nextSibling);
    }

    document.querySelectorAll('.task-list').forEach(function (list) {
      list.setAttribute('aria-label', 'Blueprint wiring checklist');
    });

    document.querySelectorAll('.bp-canvas-wrap, .bp-outer').forEach(function (wrap) {
      if (!wrap.hasAttribute('tabindex')) wrap.setAttribute('tabindex', '0');
    });
  }

  // ── PROGRESS PERSISTENCE ─────────────────────────────────────────────────────
  function saveStep(n) {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (saved.indexOf(n) === -1) { saved.push(n); localStorage.setItem(storageKey, JSON.stringify(saved)); }
    } catch (e) { /* silent */ }
  }

  function restoreProgress() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!saved.length) return;

      var TOTAL = window.TOTAL || 12;
      // dedupe + sort
      var sorted = saved.map(Number).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(function (a, b) { return a - b; });

      sorted.forEach(function (n) {
        // Sync internal Set if accessible (requires var completed in page)
        if (window.completed) window.completed.add(n);

        var card = document.getElementById('step-' + n);
        if (!card) return;
        card.classList.remove('open', 'active-step', 'locked');
        card.classList.add('completed');

        var statusEl = document.getElementById('status-' + n);
        if (statusEl) { statusEl.textContent = 'Done ✓'; statusEl.className = 'step-status ss-done'; }

        var dot = document.getElementById('dot-' + n);
        if (dot) { dot.classList.remove('active'); dot.classList.add('done'); dot.textContent = '✓'; }
      });

      var lastDone = sorted[sorted.length - 1];

      // Unlock the next incomplete step
      if (lastDone < TOTAL) {
        var nextCard = document.getElementById('step-' + (lastDone + 1));
        if (nextCard && !nextCard.classList.contains('completed')) {
          nextCard.classList.remove('locked');
          nextCard.classList.add('open', 'active-step');
          var ns = document.getElementById('status-' + (lastDone + 1));
          if (ns) { ns.textContent = 'In Progress'; ns.className = 'step-status ss-active'; }
          var nd = document.getElementById('dot-' + (lastDone + 1));
          if (nd) nd.classList.add('active');
        }
      }

      // Update progress bar
      var count = window.completed ? window.completed.size : sorted.length;
      var pct = Math.round((count / TOTAL) * 100);
      var fill = document.getElementById('progressFill');
      if (fill) fill.style.width = pct + '%';
      var countEl = document.getElementById('progressCount');
      if (countEl) countEl.textContent = count + ' / ' + TOTAL + ' Steps';

      if (count >= TOTAL) {
        var banner = document.getElementById('finishBanner');
        if (banner) banner.classList.add('show');
      }
    } catch (e) {
      console.warn('[Workshop] Progress restore error:', e);
    }
  }

  function patchCompleteStep() {
    var orig = window.completeStep;
    if (typeof orig !== 'function') return;
    window.completeStep = function (n) {
      saveStep(n);
      orig(n);
    };
  }

  // ── RESET BUTTON (footer) ────────────────────────────────────────────────────
  function initResetButton() {
    var footer = document.querySelector('.footer-inner');
    if (!footer) return;
    var btn = document.createElement('button');
    btn.className = 'reset-progress-btn';
    btn.textContent = '↺ Reset my progress';
    btn.onclick = function () {
      if (confirm('Reset all progress for this workshop? This cannot be undone.')) {
        localStorage.removeItem(storageKey);
        location.reload();
      }
    };
    footer.appendChild(btn);
  }

  // ── NEXT-WORKSHOP SIGNPOST (A350) ─────────────────────────────────────
  function initNextSignpost(){
    var banner=document.getElementById('finishBanner');
    if(!banner || banner.querySelector('.next-ep-btn, .jvds-next')) return;
    var slug=(location.pathname.split('/').pop()||'').replace('.html','');
    var isLocal=location.protocol==='file:';
    function injectNext(nextUrl, label, overviewUrl){
      if(!nextUrl && !overviewUrl) return;
      var wrap=document.createElement('div');
      wrap.className='jvds-next';
      wrap.style.cssText='margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center';
      if(nextUrl){
        var a=document.createElement('a');
        a.href=nextUrl; a.className='next-ep-btn'; a.textContent=label||'Next Workshop →';
        a.style.cssText='display:inline-flex;align-items:center;gap:8px;background:#f5c842;color:#2a1e05;padding:10px 18px;border-radius:999px;font:800 .9rem Fredoka,sans-serif;text-decoration:none';
        wrap.appendChild(a);
      }
      if(overviewUrl){
        var o=document.createElement('a');
        o.href=overviewUrl; o.textContent='← Back to track';
        o.style.cssText='display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;padding:10px 16px;border-radius:999px;font:700 .8rem Inter,sans-serif;text-decoration:none';
        wrap.appendChild(o);
      }
      // place after final-stats but before gallery if exists
      var anchor=banner.querySelector('.final-stats');
      if(anchor && anchor.nextSibling) anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      else banner.insertBefore(wrap, banner.firstChild.nextSibling || null);
    }
    function fallback(){
      // generic fallback: link to workshop hub
      injectNext(null, null, '/workshop');
    }
    if(isLocal){ fallback(); return; }
    fetch('/content/paths.json', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(paths){
      for(var i=0;i<paths.length;i++){
        var p=paths[i];
        for(var lv=0; lv<p.levels.length; lv++){
          var ws=p.levels[lv].workshops;
          var idx=ws.indexOf(slug);
          if(idx!==-1){
            var next= idx+1<ws.length ? ws[idx+1] : (p.levels[lv+1] ? p.levels[lv+1].workshops[0] : null);
            if(next) injectNext('/workshops/'+next+'.html','Next: '+next.replace(/-/g,' ')+' →', '/workshop#'+p.id);
            else injectNext(null, null, '/workshop#'+p.id);
            return;
          }
        }
      }
      // not in any track: try workshops.json order as generic next
      return fetch('/content/workshops.json', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(all){
        var idx2=-1; for(var j=0;j<all.length;j++){ if(all[j].id===slug){ idx2=j; break; } }
        if(idx2!==-1 && idx2+1<all.length) injectNext(all[idx2+1].url, 'Next Workshop →', '/workshop');
        else fallback();
      }).catch(fallback);
    }).catch(fallback);
  }

  // ── REPORT ISSUE BUTTON ──────────────────────────────────────────────────────
  function initReportButton() {
    var title = document.title || 'Workshop page';
    var page = location.pathname.split('/').pop() || location.pathname;
    var subject = encodeURIComponent('Issue: ' + title);
    var body = encodeURIComponent(
      'Hi! I found an issue on this workshop:\n\n' +
      'Page: ' + title + '\n' +
      'URL: ' + location.href + '\n' +
      'Browser: ' + navigator.userAgent + '\n\n' +
      'What went wrong:\n(describe what happened)\n\n' +
      'What step were you on:\n(e.g. Step 3)\n'
    );
    var href = 'mailto:joshhyyymakes@gmail.com?subject=' + subject + '&body=' + body;
    var btn = document.createElement('a');
    btn.className = 'report-issue-fab';
    btn.href = href;
    btn.innerHTML = '<span class="report-icon">🐛</span> Report Issue';
    btn.title = 'Something not working? Let us know!';
    document.body.appendChild(btn);
  }

  // ── INTERACTIVE IMPROVEMENTS ──────────────────────────────────────────────────
  function patchInteractives() {
    // Track wrong attempts per quiz gate for progressive hints
    var quizAttempts = {};

    // Enhance quiz wrong-answer feedback using event delegation
    // This catches the quiz-opt.wrong class being added and improves feedback
    document.addEventListener('click', function (e) {
      var submitBtn = e.target.closest('.quiz-submit');
      if (!submitBtn) return;
      var gate = submitBtn.closest('.quiz-gate');
      if (!gate || gate.classList.contains('passed')) return;

      var id = gate.id || 'q';
      // Wait a tick for the original checkQuiz to run and set classes
      setTimeout(function () {
        var fb = gate.querySelector('.quiz-feedback');
        if (!fb || !fb.classList.contains('wrong')) return;

        quizAttempts[id] = (quizAttempts[id] || 0) + 1;
        var attempts = quizAttempts[id];

        if (attempts === 1) {
          fb.innerHTML = '<span class="fb-icon">❌</span><span>Not quite! Read the question again carefully and try another option.</span>';
        } else if (attempts >= 2) {
          // After 2 wrong tries, eliminate one wrong option
          var keyRaw = gate.dataset.k || gate.dataset.a || '';
          var correct;
          try { correct = parseInt(decodeURIComponent(atob(keyRaw))); } catch (err) { correct = -1; }
          var opts = gate.querySelectorAll('.quiz-opt');
          var eliminated = false;
          for (var i = 0; i < opts.length; i++) {
            var o = opts[i];
            if (parseInt(o.dataset.idx) !== correct && !o.classList.contains('disabled')) {
              o.classList.add('disabled');
              eliminated = true;
              break;
            }
          }
          if (eliminated) {
            fb.innerHTML = '<span class="fb-icon">💡</span><span>Here\'s a hint: one wrong answer has been crossed out. Try again!</span>';
          } else {
            fb.innerHTML = '<span class="fb-icon">💡</span><span>Almost there! Look carefully at the remaining option.</span>';
          }
        }
      }, 50);
    }, true);

    // Patch checkOrderChallenge to show which items are misplaced
    if (typeof window.checkOrder === 'function') {
      var origCheckOrder = window.checkOrder;
      window.checkOrder = function (btn) {
        origCheckOrder(btn);
        var challenge = btn.closest('.order-challenge');
        if (!challenge || challenge.classList.contains('passed')) return;
        var items = challenge.querySelectorAll('.order-item');
        items.forEach(function (item) {
          var num = item.querySelector('.order-num');
          if (!num) return;
          var picked = parseInt(num.textContent);
          var expected = parseInt(item.dataset.pos);
          if (picked && expected && picked !== expected) {
            item.style.borderColor = 'rgba(248,113,113,.5)';
          } else if (picked && expected && picked === expected) {
            item.style.borderColor = 'rgba(6,214,160,.5)';
          }
        });
      };
    }

    // Add keyboard support: Enter key submits the active quiz/challenge
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var active = document.activeElement;
      if (!active) return;

      // Enter in a fill-in-the-blank input triggers its check button
      if (active.classList.contains('cf-blank') || active.classList.contains('cc-blank')) {
        var wrap = active.closest('.concept-fill, .code-challenge');
        if (wrap) {
          var checkBtn = wrap.querySelector('.cf-check-btn, .cc-check-btn');
          if (checkBtn && !checkBtn.disabled) checkBtn.click();
        }
        e.preventDefault();
      }
    });

    // Add animated confetti burst on step completion
    if (typeof window.completeStep === 'function') {
      var origComplete = window.completeStep;
      window.completeStep = function (n) {
        origComplete(n);
        showStepConfetti();
      };
    }
  }

  function showStepConfetti() {
    var colors = ['#06d6a0', '#ffd166', '#7c6cf0', '#f87171', '#38bdf8'];
    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden';
    document.body.appendChild(container);

    for (var i = 0; i < 30; i++) {
      var particle = document.createElement('div');
      var size = Math.random() * 8 + 4;
      var x = Math.random() * 100;
      var color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.cssText = 'position:absolute;top:-10px;left:' + x + '%;width:' + size + 'px;height:' + size + 'px;background:' + color + ';border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';opacity:0.9';
      container.appendChild(particle);

      var duration = Math.random() * 1200 + 800;
      var drift = (Math.random() - 0.5) * 200;
      particle.animate([
        { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: 1 },
        { transform: 'translateY(' + (window.innerHeight + 20) + 'px) translateX(' + drift + 'px) rotate(' + (Math.random() * 720) + 'deg)', opacity: 0 }
      ], { duration: duration, easing: 'cubic-bezier(.25,.46,.45,.94)' });
    }

    setTimeout(function () { container.remove(); }, 2200);
  }

  // ── INIT ─────────────────────────────────────────────────────────────────────
  function init() {
    initCopyButtons();
    initTeacherMode();
    initLessonPlanLink();
    initStuckSections();
    initStickyProgress();
    initLearningMap();
    initBlueprintCoach();
    initResetButton();
    initNextSignpost();
    patchCompleteStep();
    initReportButton();
    patchInteractives();
    // Restore after buildDots() has run (it's called at DOMContentLoaded inline)
    setTimeout(restoreProgress, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

})();

/* Workshop brief (A954). The 3D builder workshops opened straight into the
   builder with no "what you'll make / before you start / what you'll learn"
   intro. Add a consistent brief from this map, only when the page has no intro
   of its own. Scoped by page id so it never touches workshops that already
   explain themselves. */
(function () {
  'use strict';

  var BRIEFS = {
    'robot-builder': { build: "Design and build your own 3D robot step by step, then export it as a 3D model.", before: "Best for ages 7-9 with a grown-up. No install and no account, it runs in your browser.", learn: "3D shape building, colour and proportion, and how the parts fit together." },
    'rocket-builder': { build: "Design and build your own 3D rocket with nose cones, fins and boosters.", before: "Ages 10-14. No install and no account, it runs in your browser.", learn: "3D modelling, symmetry and balancing a design." },
    'space-station-builder': { build: "Design and build your own 3D space station from modules and solar panels.", before: "Ages 10-14. No install and no account, it runs in your browser.", learn: "Modular 3D building, scale and layout planning." },
    'submarine-builder': { build: "Design and build your own 3D submarine with a hull, fins and a propeller.", before: "Ages 10-14. No install and no account, it runs in your browser.", learn: "3D modelling, curves and balance." },
    'castle-builder': { build: "Design and build your own 3D medieval castle with towers, walls and a gate.", before: "Ages 10-14. No install and no account, it runs in your browser.", learn: "3D building, structure and layout planning." },
    'pirate-ship-builder': { build: "Build and sail a pirate ship in your browser.", before: "Ages 10+. No install and no account, it runs in your browser.", learn: "3D modelling, ship parts and how a build moves." },
    'pirate-cannon-builder': { build: "Build a pirate cannon game in your browser.", before: "Ages 10+. No install and no account, it runs in your browser.", learn: "Aiming, angles and simple game logic." },
    'race-car-builder': { build: "Design and build your own 3D race car with a body, wheels and a spoiler.", before: "Ages 10-14. No install and no account, it runs in your browser.", learn: "3D modelling, symmetry and how design affects speed." },
    'steampunk-airship-builder': { build: "Build and fly a steampunk airship in your browser.", before: "Ages 10+. No install and no account, it runs in your browser.", learn: "3D building, balloon and propeller design." },
    'phone-stand-builder': { build: "Design and build your own 3D printable phone stand.", before: "Ages 10+. No install and no account, it runs in your browser.", learn: "3D modelling for printing, scale and stability." },
    'fairy-tale-builder': { build: "Design and build your own 3D fairy tale cottage.", before: "Best for ages 7-9 with a grown-up. No install and no account, it runs in your browser.", learn: "3D shape building, colour and decoration." },
    'mugen-ai-workshop': { build: "Build a fighting game character for MUGEN with AI opponents.", before: "Ages 10+. You will need MUGEN (free) on your computer.", learn: "Character setup, states and simple AI." }
  };

  function pageId() {
    return (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  }

  function hasIntro() {
    return !!document.querySelector('.workshop-brief, .hero-sub, .hero-desc, .lead, .badge-row, .hero-pills, .hero-tags, .intro-brief');
  }

  function makeBrief(b) {
    var sec = document.createElement('section');
    sec.className = 'workshop-brief';
    sec.setAttribute('aria-label', 'Workshop overview');
    sec.style.cssText = 'max-width:900px;margin:16px auto;padding:16px 18px;background:var(--beige,#F0EAD6);border:1.5px solid rgba(64,59,51,.16);border-radius:12px;color:var(--charcoal,#1a1208);font-size:.92rem;line-height:1.6;';
    sec.innerHTML =
      '<h2 style="font-family:Fredoka,Inter,sans-serif;font-size:1.1rem;margin:0 0 8px;">What you\'ll make</h2>' +
      '<p style="margin:0 0 12px;">' + b.build + '</p>' +
      '<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">' +
        '<div><h3 style="font-size:.86rem;margin:0 0 4px;">Before you start</h3><p style="margin:0;">' + b.before + '</p></div>' +
        '<div><h3 style="font-size:.86rem;margin:0 0 4px;">What you\'ll learn</h3><p style="margin:0;">' + b.learn + '</p></div>' +
      '</div>';
    return sec;
  }

  function place(sec) {
    var hdr = document.querySelector('header.hdr');
    if (hdr && hdr.parentNode) { hdr.parentNode.insertBefore(sec, hdr.nextSibling); return true; }
    var app = document.getElementById('app');
    if (app) { app.insertBefore(sec, app.firstChild); return true; }
    var main = document.querySelector('main') || document.body;
    if (main) { main.insertBefore(sec, main.firstChild); return true; }
    return false;
  }

  function run() {
    var b = BRIEFS[pageId()];
    if (!b || hasIntro()) return;
    place(makeBrief(b));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
