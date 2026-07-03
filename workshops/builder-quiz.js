/* JVDesignStudio Builder Quiz + Progress Add-on
   Adds a knowledge-check quiz, XP tracking and My Progress integration to
   builder / blueprint workshop pages that have their own bespoke layouts.

   Page must define before loading this file:
     window.BQ = {
       key:   'jvds-...-v2',        // localStorage key (matches my-progress.html SERIES)
       name:  'Workshop Name',      // shown in the completion banner
       profileId: 'page-slug',      // reported to player-profile.js on completion
       quiz: [ { q:'Question?', opts:['A','B','C','D'], a:1, why:'Explanation' }, ... ]
     }

   Progress schema matches workshop-engine.js so my-progress.html can read it:
     { completed:[...], total, xp, level, streak, bestStreak, totalQuizzes, correctFirst }
   Each passed quiz question counts as one completed "step".
   Pages with their own step systems can also call window.bqStepDone(id) to
   award bonus XP for build steps (does not affect completion count). */
(function () {
  var CFG = window.BQ;
  if (!CFG || !CFG.key || !CFG.quiz || !CFG.quiz.length) return;

  var XP_QUIZ = 15, XP_STEP = 10, XP_STREAK_BONUS = 5, XP_PER_LEVEL = 100;

  var state = {
    completed: [],          // indices of passed quiz questions
    xp: 0, level: 1, streak: 0, bestStreak: 0,
    totalQuizzes: 0, correctFirst: 0,
    steps: []               // bonus build-step ids already awarded
  };
  var attempted = {};        // question index -> wrong attempt made this pass

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(CFG.key) || 'null');
      if (!d) return;
      state.completed = d.completed || [];
      state.xp = d.xp || 0;
      state.level = d.level || 1;
      state.streak = d.streak || 0;
      state.bestStreak = d.bestStreak || 0;
      state.totalQuizzes = d.totalQuizzes || 0;
      state.correctFirst = d.correctFirst || 0;
      state.steps = d.steps || [];
    } catch (e) {}
  }

  function save() {
    try {
      localStorage.setItem(CFG.key, JSON.stringify({
        completed: state.completed, total: CFG.quiz.length,
        xp: state.xp, level: state.level, streak: state.streak,
        bestStreak: state.bestStreak, totalQuizzes: state.totalQuizzes,
        correctFirst: state.correctFirst, steps: state.steps
      }));
    } catch (e) {}
  }

  function awardXp(amount, label) {
    var oldLevel = state.level;
    state.xp += amount;
    state.level = Math.floor(state.xp / XP_PER_LEVEL) + 1;
    save();
    updateChip();
    toast('+' + amount + ' XP' + (label ? ' · ' + label : ''));
    if (state.level > oldLevel) setTimeout(function () { toast('⭐ Level ' + state.level + '!'); }, 700);
  }

  window.bqStepDone = function (id) {
    id = String(id);
    if (state.steps.indexOf(id) !== -1) return;
    state.steps.push(id);
    awardXp(XP_STEP, 'Build step');
  };

  /* ---------- UI ---------- */
  var css = [
    '.bq-wrap{max-width:900px;margin:36px auto;padding:0 20px;font-family:Inter,system-ui,sans-serif}',
    '.bq-panel{background:#141722;border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:26px 24px;color:#e8eaf2}',
    '.bq-title{font-family:Fredoka,Inter,cursive;font-size:1.4rem;color:#fff;margin:0 0 4px}',
    '.bq-sub{font-size:.85rem;color:rgba(232,234,242,.5);margin:0 0 18px;line-height:1.6}',
    '.bq-q{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px 18px;margin-bottom:14px;background:rgba(255,255,255,.02)}',
    '.bq-q.passed{border-color:rgba(6,214,160,.35)}',
    '.bq-qt{font-weight:700;font-size:.95rem;margin-bottom:12px;color:#fff}',
    '.bq-opt{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;margin-bottom:8px;cursor:pointer;font-size:.88rem;transition:border-color .15s,background .15s}',
    '.bq-opt:hover{border-color:rgba(255,209,102,.5)}',
    '.bq-opt.sel{border-color:#ffd166;background:rgba(255,209,102,.08)}',
    '.bq-opt.right{border-color:#06d6a0;background:rgba(6,214,160,.1)}',
    '.bq-opt.wrong{border-color:#f87171;background:rgba(248,113,113,.08)}',
    '.bq-opt.off{pointer-events:none;opacity:.55}',
    '.bq-letter{width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;flex-shrink:0}',
    '.bq-check{background:linear-gradient(135deg,#ffd166,#e6a800);color:#000;border:none;border-radius:9px;padding:9px 20px;font-weight:800;font-size:.85rem;cursor:pointer;font-family:Fredoka,Inter,cursive}',
    '.bq-check:disabled{opacity:.4;cursor:default}',
    '.bq-fb{font-size:.82rem;margin-top:10px;display:none;line-height:1.5}',
    '.bq-fb.show{display:block}',
    '.bq-fb.ok{color:#06d6a0}.bq-fb.no{color:#f87171}',
    '.bq-done{margin-top:18px;padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,rgba(6,214,160,.12),rgba(255,209,102,.08));border:1px solid rgba(6,214,160,.35);display:none}',
    '.bq-done.show{display:block}',
    '.bq-done-t{font-family:Fredoka,Inter,cursive;font-size:1.15rem;color:#06d6a0;margin-bottom:4px}',
    '.bq-done-s{font-size:.85rem;color:rgba(232,234,242,.6);line-height:1.6}',
    '.bq-done-s a{color:#ffd166}',
    '.bq-chip{position:fixed;right:14px;bottom:14px;z-index:900;background:#141722;border:1px solid rgba(255,209,102,.35);border-radius:999px;padding:8px 16px;display:flex;gap:10px;align-items:center;font-family:Fredoka,Inter,cursive;font-size:.8rem;color:#ffd166;box-shadow:0 4px 18px rgba(0,0,0,.45);cursor:pointer}',
    '.bq-chip .bq-lvl{color:rgba(232,234,242,.55);font-size:.72rem}',
    '.bq-toast{position:fixed;right:16px;bottom:64px;z-index:901;background:#1a1d2a;border:1px solid rgba(255,209,102,.4);color:#ffd166;font-family:Fredoka,Inter,cursive;font-size:.82rem;padding:8px 16px;border-radius:10px;opacity:0;transform:translateY(8px);transition:all .25s;pointer-events:none}',
    '.bq-toast.on{opacity:1;transform:none}'
  ].join('');

  function toast(msg) {
    var t = document.getElementById('bqToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  function updateChip() {
    var c = document.getElementById('bqChipXp');
    if (c) c.textContent = state.xp + ' XP';
    var l = document.getElementById('bqChipLvl');
    if (l) l.textContent = 'Lv ' + state.level + ' · ' + state.completed.length + '/' + CFG.quiz.length;
  }

  function checkDone() {
    if (state.completed.length >= CFG.quiz.length) {
      var d = document.getElementById('bqDone');
      if (d) d.classList.add('show');
      try {
        if (typeof playerProfile !== 'undefined' && playerProfile.markWorkshopCompleted && CFG.profileId) {
          playerProfile.markWorkshopCompleted(CFG.profileId, 75);
        }
      } catch (e) {}
    }
  }

  window.bqSelect = function (el) {
    var q = el.parentNode;
    if (q.classList.contains('passed')) return;
    var opts = q.querySelectorAll('.bq-opt');
    for (var i = 0; i < opts.length; i++) opts[i].classList.remove('sel');
    el.classList.add('sel');
    q.querySelector('.bq-check').disabled = false;
  };

  window.bqCheck = function (btn, qi) {
    var q = btn.closest('.bq-q');
    var sel = q.querySelector('.bq-opt.sel');
    if (!sel) return;
    var idx = parseInt(sel.getAttribute('data-i'), 10);
    var fb = q.querySelector('.bq-fb');
    var item = CFG.quiz[qi];
    if (idx === item.a) {
      q.classList.add('passed');
      sel.classList.remove('sel');
      sel.classList.add('right');
      var opts = q.querySelectorAll('.bq-opt');
      for (var i = 0; i < opts.length; i++) opts[i].classList.add('off');
      btn.style.display = 'none';
      fb.className = 'bq-fb show ok';
      fb.textContent = '✅ Correct! ' + (item.why || '');
      state.totalQuizzes++;
      if (!attempted[qi]) { state.correctFirst++; state.streak++; if (state.streak > state.bestStreak) state.bestStreak = state.streak; }
      else state.streak = 0;
      if (state.completed.indexOf(qi) === -1) state.completed.push(qi);
      var bonus = state.streak >= 3 ? XP_STREAK_BONUS : 0;
      awardXp(XP_QUIZ + bonus, bonus ? 'Streak bonus!' : 'Quiz passed');
      checkDone();
    } else {
      attempted[qi] = true;
      state.streak = 0;
      sel.classList.add('wrong');
      setTimeout(function () { sel.classList.remove('wrong', 'sel'); }, 900);
      fb.className = 'bq-fb show no';
      fb.textContent = '❌ Not quite. Have another look and try again.';
      save();
    }
  };

  function restore() {
    for (var i = 0; i < state.completed.length; i++) {
      var qi = state.completed[i];
      var q = document.getElementById('bq-q-' + qi);
      if (!q) continue;
      q.classList.add('passed');
      var opts = q.querySelectorAll('.bq-opt');
      for (var j = 0; j < opts.length; j++) {
        opts[j].classList.add('off');
        if (parseInt(opts[j].getAttribute('data-i'), 10) === CFG.quiz[qi].a) opts[j].classList.add('right');
      }
      var btn = q.querySelector('.bq-check');
      if (btn) btn.style.display = 'none';
      var fb = q.querySelector('.bq-fb');
      if (fb) { fb.className = 'bq-fb show ok'; fb.textContent = '✅ Correct! ' + (CFG.quiz[qi].why || ''); }
    }
    checkDone();
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'bq-wrap';
    var letters = ['A', 'B', 'C', 'D', 'E'];
    var html = '<div class="bq-panel"><h2 class="bq-title">🧠 Knowledge Check</h2>' +
      '<p class="bq-sub">Answer every question to complete this workshop and earn XP. Your progress is saved on this device and appears on <a href="my-progress.html" style="color:#ffd166">My Progress</a>.</p>';
    for (var i = 0; i < CFG.quiz.length; i++) {
      var item = CFG.quiz[i];
      html += '<div class="bq-q" id="bq-q-' + i + '"><div class="bq-qt">' + (i + 1) + '. ' + item.q + '</div>';
      for (var j = 0; j < item.opts.length; j++) {
        html += '<div class="bq-opt" data-i="' + j + '" onclick="bqSelect(this)"><span class="bq-letter">' + letters[j] + '</span><span>' + item.opts[j] + '</span></div>';
      }
      html += '<button class="bq-check" disabled onclick="bqCheck(this,' + i + ')">Check Answer</button><div class="bq-fb"></div></div>';
    }
    html += '<div class="bq-done" id="bqDone"><div class="bq-done-t">🏆 ' + (CFG.name || 'Workshop') + ' complete!</div>' +
      '<div class="bq-done-s">Brilliant work! Your completion is saved. View your XP, badges and print a certificate on the <a href="my-progress.html">My Progress</a> page.</div></div>';
    html += '</div>';
    wrap.innerHTML = html;

    var footer = document.querySelector('footer.site-footer, footer');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(wrap, footer);
    else document.body.appendChild(wrap);

    var chip = document.createElement('div');
    chip.className = 'bq-chip';
    chip.innerHTML = '⭐ <span id="bqChipXp">0 XP</span> <span class="bq-lvl" id="bqChipLvl"></span>';
    chip.title = 'Scroll to the Knowledge Check';
    chip.onclick = function () { wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    document.body.appendChild(chip);

    var t = document.createElement('div');
    t.className = 'bq-toast';
    t.id = 'bqToast';
    document.body.appendChild(t);

    updateChip();
    restore();
  }

  load();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
