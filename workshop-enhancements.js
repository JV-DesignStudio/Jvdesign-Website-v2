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

  // ── INIT ─────────────────────────────────────────────────────────────────────
  function init() {
    initCopyButtons();
    initTeacherMode();
    initStuckSections();
    initStickyProgress();
    initResetButton();
    patchCompleteStep();
    // Restore after buildDots() has run (it's called at DOMContentLoaded inline)
    setTimeout(restoreProgress, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

})();
