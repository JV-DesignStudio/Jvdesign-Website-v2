/**
 * workshop-hud.js - Gamified Player Card HUD
 * Floating persistent player card with animated XP bar, completion toasts,
 * Web Audio chimes, and CSS particle bursts.
 * Zero dependencies - reads from window.playerProfile (player-profile.js).
 */
(function () {
  'use strict';

  // ── INJECTED STYLES ─────────────────────────────────────────────────
  const CSS = `
    .jvhud-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 9000;
      background: var(--jv-lumo, #7C6CF0);
      color: #fff; border: none; border-radius: 50px;
      padding: 10px 16px 10px 12px;
      font-family: var(--jv-font-display, 'Fredoka', 'Inter', sans-serif);
      font-size: .88rem; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 20px rgba(124,108,240,.35);
      transition: transform .2s, box-shadow .2s;
      line-height: 1; user-select: none;
    }
    .jvhud-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(124,108,240,.5); }
    .jvhud-btn:focus-visible { outline: 2px solid var(--jv-teal,#70A3A7); outline-offset: 3px; }
    .jvhud-btn-avatar { font-size: 1.15rem; }
    .jvhud-btn-text { display: flex; flex-direction: column; gap: 1px; }
    .jvhud-btn-name { font-size: .82rem; }
    .jvhud-btn-lvl { font-size: .64rem; opacity: .7; }

    .jvhud-card {
      position: fixed; bottom: 78px; right: 20px; z-index: 9001;
      background: var(--jv-charcoal, #403B33);
      border: 1px solid rgba(124,108,240,.28);
      border-radius: 18px; padding: 18px 20px; width: 260px;
      box-shadow: 0 8px 40px rgba(0,0,0,.45);
      transform: translateY(16px) scale(.96); opacity: 0;
      pointer-events: none;
      transition: transform .28s cubic-bezier(.34,1.56,.64,1), opacity .2s;
    }
    .jvhud-card.open { transform: none; opacity: 1; pointer-events: auto; }
    .jvhud-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .jvhud-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--jv-lumo, #7C6CF0);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; flex-shrink: 0;
    }
    .jvhud-player-name {
      font-family: var(--jv-font-display, 'Fredoka', 'Inter', sans-serif);
      font-size: .95rem; font-weight: 700;
      color: var(--jv-beige, #F0EAD6);
    }
    .jvhud-player-sub { font-size: .68rem; color: rgba(240,234,214,.5); margin-top: 1px; }

    .jvhud-xp-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 5px;
    }
    .jvhud-xp-tag {
      font-size: .66rem; text-transform: uppercase; letter-spacing: .08em;
      color: rgba(240,234,214,.45); font-weight: 700;
    }
    .jvhud-xp-val { font-size: .72rem; color: var(--jv-teal, #70A3A7); font-weight: 700; }
    .jvhud-bar {
      height: 9px; background: rgba(255,255,255,.1);
      border-radius: 99px; overflow: hidden; margin-bottom: 14px;
    }
    .jvhud-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--jv-teal,#70A3A7), var(--jv-lumo,#7C6CF0));
      border-radius: 99px; width: 0%;
      transition: width .9s cubic-bezier(.22,1,.36,1);
    }
    .jvhud-stats {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 7px; margin-bottom: 12px;
    }
    .jvhud-stat {
      background: rgba(255,255,255,.05); border-radius: 10px;
      padding: 8px 4px; text-align: center;
    }
    .jvhud-stat-val {
      font-family: var(--jv-font-display, 'Fredoka', 'Inter', sans-serif);
      font-size: 1.15rem; font-weight: 700;
      color: var(--jv-beige, #F0EAD6); line-height: 1; display: block;
    }
    .jvhud-stat-lbl {
      font-size: .6rem; text-transform: uppercase; letter-spacing: .07em;
      color: rgba(240,234,214,.4); display: block; margin-top: 3px;
    }
    .jvhud-progress-link {
      display: block; text-align: center; font-size: .76rem; font-weight: 700;
      color: var(--jv-teal, #70A3A7); text-decoration: none;
      border-top: 1px solid rgba(255,255,255,.08); padding-top: 10px;
    }
    .jvhud-progress-link:hover { opacity: .8; }

    /* Toast */
    .jvhud-toast {
      position: fixed; bottom: 92px; right: 20px; z-index: 9002;
      background: var(--jv-charcoal, #403B33);
      border: 1px solid rgba(112,163,167,.3); border-radius: 14px;
      padding: 12px 16px; max-width: 280px; min-width: 220px;
      box-shadow: 0 6px 30px rgba(0,0,0,.4);
      transform: translateX(calc(100% + 30px));
      transition: transform .4s cubic-bezier(.34,1.56,.64,1);
      display: flex; align-items: center; gap: 12px; pointer-events: none;
    }
    .jvhud-toast.show { transform: none; }
    .jvhud-toast-icon { font-size: 1.5rem; flex-shrink: 0; }
    .jvhud-toast-title {
      font-family: var(--jv-font-display, 'Fredoka', 'Inter', sans-serif);
      font-size: .88rem; font-weight: 700;
      color: var(--jv-beige, #F0EAD6); line-height: 1.25;
    }
    .jvhud-toast-sub { font-size: .72rem; color: var(--jv-teal, #70A3A7); margin-top: 2px; }

    /* Particles */
    .jvhud-particle {
      position: fixed; width: 8px; height: 8px; border-radius: 50%;
      pointer-events: none; z-index: 9003;
      animation: jvhud-pop .65s ease-out forwards;
    }
    @keyframes jvhud-pop {
      0%   { opacity: 1; transform: translate(0,0) scale(1.2); }
      100% { opacity: 0; transform: var(--jvhud-tx,translate(0,-60px)) scale(0); }
    }

    /* Mark-complete button (injected into workshop articles) */
    .jvhud-mark-wrap {
      text-align: center; padding: 28px 20px; border-top: 1px dashed rgba(112,163,167,.25);
      margin-top: 32px;
    }
    .jvhud-mark-hint {
      font-size: .78rem; color: rgba(64,59,51,.5); margin-bottom: 10px;
    }
    [data-theme="dark"] .jvhud-mark-hint { color: rgba(240,234,214,.4); }
    .jvhud-mark-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--jv-teal, #70A3A7);
      color: #fff; border: none; border-radius: 10px;
      padding: 11px 22px;
      font-family: var(--jv-font-display, 'Fredoka', 'Inter', sans-serif);
      font-size: .92rem; font-weight: 700; cursor: pointer;
      box-shadow: 0 3px 14px rgba(112,163,167,.3);
      transition: transform .15s, box-shadow .15s;
    }
    .jvhud-mark-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(112,163,167,.5); }
    .jvhud-mark-btn:focus-visible { outline: 2px solid var(--jv-lumo,#7C6CF0); outline-offset: 3px; }
    .jvhud-mark-btn.jvhud-done {
      background: rgba(112,163,167,.18);
      color: var(--jv-teal, #70A3A7);
      cursor: default; pointer-events: none;
      box-shadow: none;
    }

    @media (max-width: 480px) {
      .jvhud-card { right: 12px; bottom: 72px; width: calc(100vw - 24px); max-width: 300px; }
      .jvhud-btn { bottom: 14px; right: 12px; }
      .jvhud-toast { right: 12px; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'jvhud-styles';
  document.head.appendChild(styleEl);
  styleEl.textContent = CSS;

  // ── BUILD DOM ────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'jvhudBtn';
  btn.className = 'jvhud-btn';
  btn.setAttribute('aria-label', 'Open player card');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'jvhudCard');
  btn.innerHTML =
    `<span class="jvhud-btn-avatar" aria-hidden="true">🦊</span>` +
    `<span class="jvhud-btn-text">` +
      `<span class="jvhud-btn-name" id="jvhudBtnName">My Studio</span>` +
      `<span class="jvhud-btn-lvl" id="jvhudBtnLvl">Level 1</span>` +
    `</span>`;

  const card = document.createElement('div');
  card.id = 'jvhudCard';
  card.className = 'jvhud-card';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'Player card');
  card.innerHTML =
    `<div class="jvhud-head">` +
      `<div class="jvhud-avatar" aria-hidden="true">🦊</div>` +
      `<div>` +
        `<div class="jvhud-player-name" id="jvhudPlayerName">My Studio</div>` +
        `<div class="jvhud-player-sub" id="jvhudPlayerSub">Level 1 · 0 XP</div>` +
      `</div>` +
    `</div>` +
    `<div class="jvhud-xp-row">` +
      `<span class="jvhud-xp-tag">XP Progress</span>` +
      `<span class="jvhud-xp-val" id="jvhudXpVal">0 / 100</span>` +
    `</div>` +
    `<div class="jvhud-bar"><div class="jvhud-bar-fill" id="jvhudBarFill"></div></div>` +
    `<div class="jvhud-stats">` +
      `<div class="jvhud-stat"><span class="jvhud-stat-val" id="jvhudStatLvl">1</span><span class="jvhud-stat-lbl">Level</span></div>` +
      `<div class="jvhud-stat"><span class="jvhud-stat-val" id="jvhudStatDone">0</span><span class="jvhud-stat-lbl">Done</span></div>` +
      `<div class="jvhud-stat"><span class="jvhud-stat-val" id="jvhudStatStreak">0</span><span class="jvhud-stat-lbl">Streak</span></div>` +
    `</div>` +
    `<a class="jvhud-progress-link" href="/workshops/my-progress.html">View all progress →</a>`;

  const toast = document.createElement('div');
  toast.id = 'jvhudToast';
  toast.className = 'jvhud-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML =
    `<span class="jvhud-toast-icon" id="jvhudToastIcon" aria-hidden="true">⭐</span>` +
    `<div>` +
      `<div class="jvhud-toast-title" id="jvhudToastTitle">Workshop Complete!</div>` +
      `<div class="jvhud-toast-sub" id="jvhudToastSub">Progress saved</div>` +
    `</div>`;

  document.body.appendChild(btn);
  document.body.appendChild(card);
  document.body.appendChild(toast);

  // ── TOGGLE ───────────────────────────────────────────────────────────
  let isOpen = false;
  function open() {
    isOpen = true;
    card.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    refreshCard();
  }
  function close() {
    isOpen = false;
    card.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function toggle() { isOpen ? close() : open(); }

  btn.addEventListener('click', toggle);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });
  document.addEventListener('click', (e) => {
    if (isOpen && !card.contains(e.target) && !btn.contains(e.target)) close();
  });

  // ── PROFILE READER ───────────────────────────────────────────────────
  function getStats() {
    try {
      if (window.playerProfile && typeof window.playerProfile.getStats === 'function') {
        return window.playerProfile.getStats();
      }
    } catch (e) {}
    return null;
  }

  function getPlayerName() {
    try { return localStorage.getItem('jvds-player-name') || 'My Studio'; } catch (e) { return 'My Studio'; }
  }

  function refreshCard() {
    const stats = getStats();
    if (!stats) return;
    const name = getPlayerName();
    const prog = stats.xpProgress;

    document.getElementById('jvhudBtnName').textContent = name;
    document.getElementById('jvhudBtnLvl').textContent = 'Level ' + stats.level;
    document.getElementById('jvhudPlayerName').textContent = name;
    document.getElementById('jvhudPlayerSub').textContent = 'Level ' + stats.level + ' · ' + stats.totalXP + ' XP total';
    document.getElementById('jvhudXpVal').textContent = prog.current + ' / ' + prog.max;
    document.getElementById('jvhudStatLvl').textContent = stats.level;
    document.getElementById('jvhudStatDone').textContent = stats.workshopsCompleted;
    document.getElementById('jvhudStatStreak').textContent = stats.dailyStreak || 0;

    const fill = document.getElementById('jvhudBarFill');
    fill.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.width = prog.percentage.toFixed(1) + '%';
    }));
  }

  // ── WEB AUDIO CHIME ──────────────────────────────────────────────────
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      function tone(freq, t0, dur, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + t0);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t0 + dur);
        osc.start(ctx.currentTime + t0);
        osc.stop(ctx.currentTime + t0 + dur + 0.05);
      }
      tone(659.25, 0,    0.18, 0.16);  // E5
      tone(880,   0.22, 0.32, 0.20);   // A5
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 700);
    } catch (_) {}
  }

  // ── PARTICLES ────────────────────────────────────────────────────────
  const PCOLS = ['#70A3A7', '#7C6CF0', '#BC4749', '#FFD23C', '#F0EAD6', '#06d6a0'];
  function burst(cx, cy) {
    const N = 14;
    for (let i = 0; i < N; i++) {
      const el = document.createElement('div');
      el.className = 'jvhud-particle';
      const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
      const dist = 44 + Math.random() * 52;
      const tx = `translate(${(Math.cos(angle) * dist).toFixed(1)}px,${(Math.sin(angle) * dist).toFixed(1)}px)`;
      el.style.cssText =
        `left:${(cx - 4).toFixed(0)}px;top:${(cy - 4).toFixed(0)}px;` +
        `background:${PCOLS[i % PCOLS.length]};--jvhud-tx:${tx};` +
        `animation-delay:${(i * 0.022).toFixed(3)}s`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }
  }

  // ── TOAST ────────────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(icon, title, sub, originEl) {
    if (toastTimer) { clearTimeout(toastTimer); toast.classList.remove('show'); }
    document.getElementById('jvhudToastIcon').textContent = icon;
    document.getElementById('jvhudToastTitle').textContent = title;
    document.getElementById('jvhudToastSub').textContent = sub;
    requestAnimationFrame(() => {
      toast.classList.add('show');
      if (originEl) {
        const r = originEl.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2);
      }
    });
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toastTimer = null;
    }, 4500);
  }

  // ── GLOBAL EVENTS ────────────────────────────────────────────────────
  window.addEventListener('workshop-completed', () => {
    playChime();
    showToast('✅', 'Workshop Complete!', 'Marked as done · Progress saved', btn);
    setTimeout(refreshCard, 200);
  });
  window.addEventListener('xp-gained', () => refreshCard());
  window.addEventListener('level-up', (e) => {
    const d = e.detail || {};
    playChime();
    showToast('🎉', 'Level Up!', 'You reached Level ' + (d.newLevel || ''), btn);
    setTimeout(refreshCard, 200);
  });

  // ── MARK-COMPLETE BUTTON ─────────────────────────────────────────────
  function injectMarkBtn() {
    const bd = document.body;
    if (!bd || document.querySelector('.jvhud-mark-wrap')) return;
    // Only inject on actual workshop article pages (body has data-workshop-key / data-profile-id)
    const key = bd.dataset.workshopKey || bd.dataset.profileId;
    if (!key) return;

    const isAlreadyDone = (() => {
      try {
        return window.playerProfile ? window.playerProfile.isWorkshopCompleted(key) : false;
      } catch (_) { return false; }
    })();

    const wrap = document.createElement('div');
    wrap.className = 'jvhud-mark-wrap';

    const hint = document.createElement('p');
    hint.className = 'jvhud-mark-hint';
    hint.textContent = isAlreadyDone ? 'You\'ve finished this workshop.' : 'Finished? Mark it complete to track your progress.';

    const markBtn = document.createElement('button');
    markBtn.type = 'button';
    markBtn.className = 'jvhud-mark-btn' + (isAlreadyDone ? ' jvhud-done' : '');
    markBtn.setAttribute('aria-label', isAlreadyDone ? 'Workshop already completed' : 'Mark this workshop as complete');
    markBtn.textContent = isAlreadyDone ? '✓ Completed' : '⭐ Mark as Complete';

    if (!isAlreadyDone) {
      markBtn.addEventListener('click', () => {
        try {
          if (window.playerProfile) window.playerProfile.markWorkshopCompleted(key);
        } catch (_) {}
        markBtn.className = 'jvhud-mark-btn jvhud-done';
        markBtn.textContent = '✓ Completed';
        markBtn.setAttribute('aria-label', 'Workshop completed');
        hint.textContent = 'You\'ve finished this workshop.';
        playChime();
        const r = markBtn.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2);
        showToast('✅', 'Workshop Complete!', 'Your progress is saved · Keep going!', markBtn);
        setTimeout(refreshCard, 200);
      });
    }

    wrap.appendChild(hint);
    wrap.appendChild(markBtn);

    // Insert before site footer, after main content
    const footer = document.querySelector('footer.site-footer');
    const insertBefore = footer || null;
    (insertBefore ? insertBefore.parentNode : document.body)
      .insertBefore(wrap, insertBefore);
  }

  // ── INIT ─────────────────────────────────────────────────────────────
  function init() {
    refreshCard();
    injectMarkBtn();
  }

  if (window.playerProfile) {
    init();
  } else {
    let attempts = 0;
    const poll = setInterval(() => {
      if (window.playerProfile || ++attempts > 30) {
        clearInterval(poll);
        if (window.playerProfile) init();
        else refreshCard(); // show defaults if no profile
      }
    }, 100);
  }

  // Public API
  window.jvHUD = { showToast, playChime, burst, refreshCard };
})();
