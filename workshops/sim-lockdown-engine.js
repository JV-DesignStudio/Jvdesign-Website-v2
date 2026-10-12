/* SIM LOCKDOWN workshop engine (shared by the 3 episodes).
 * Ported from the roblox-obby workshop inline engine so the step cards, quiz
 * gates, concept-fill, code-challenge, true/false, order and predict blocks
 * behave identically. Each page sets window.WORKSHOP_KEY and
 * window.WORKSHOP_TOTAL before this file loads.
 */
(function () {
  const TOTAL = window.WORKSHOP_TOTAL || 6;
  const STORAGE_KEY = window.WORKSHOP_KEY || 'jvds-sim-lockdown';
  // workshop-enhancements.js reads a global window.TOTAL (it falls back to 12),
  // so publish it too or its progress restore rewrites the counter wrongly.
  window.WORKSHOP_TOTAL = window.WORKSHOP_TOTAL || TOTAL;
  window.TOTAL = window.TOTAL || TOTAL;

  let completed = new Set();
  let xp = 0, level = 1, streak = 0, bestStreak = 0, totalQuizzes = 0, correctFirst = 0;
  const XP_PER_LEVEL = 100;
  const XP_QUIZ = 15;
  const XP_CODE = 20;
  const XP_STREAK_BONUS = 5;

  /* -- answer decoding (base64 + plain fallbacks) -- */
  function _dec(el, k) {
    const e = el.dataset[k];
    if (e !== undefined) { try { return decodeURIComponent(atob(e)); } catch (_) { return ''; } }
    return k === 'a' ? (el.dataset.answer || '') : (el.dataset.correct || '');
  }
  function _answers(el) { return _dec(el, 'a').split('|'); }
  function _canon(el) { return _answers(el)[0]; }
  function _match(el, val) {
    const v = val.trim().toLowerCase();
    return _answers(el).some(a => a.trim().toLowerCase() === v);
  }
  function _key(el) { return parseInt(_dec(el, 'k'), 10); }
  function _shuffleQuiz() {
    document.querySelectorAll('.quiz-options').forEach(function (o) {
      const k = [].slice.call(o.children);
      for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = k[i]; k[i] = k[j]; k[j] = t; }
      k.forEach(c => o.appendChild(c));
      const L = ['A', 'B', 'C', 'D', 'E'];
      o.querySelectorAll('.opt-letter').forEach((l, i) => { l.textContent = L[i] || ''; });
    });
  }
  function _initKbd() {
    function act(el) { return function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }; }
    document.querySelectorAll('.quiz-opt').forEach(o => { o.setAttribute('role', 'button'); o.setAttribute('tabindex', '0'); o.addEventListener('keydown', act(o)); });
    document.querySelectorAll('.step-header').forEach(h => { h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0'); h.addEventListener('keydown', act(h)); });
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        completed: [...completed], total: TOTAL, xp, level, streak, bestStreak, totalQuizzes, correctFirst,
        quizzesPassed: [...document.querySelectorAll('.quiz-gate.passed')].map(q => q.id),
        challengesPassed: [...document.querySelectorAll('.code-challenge.passed')].map(c => c.id)
      }));
    } catch (e) {}
  }

  function loadProgress() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) return;
      if (data.xp) { xp = data.xp; level = data.level || 1; streak = data.streak || 0; bestStreak = data.bestStreak || 0; totalQuizzes = data.totalQuizzes || 0; correctFirst = data.correctFirst || 0; }
      if (data.completed && data.completed.length) {
        data.completed.forEach(n => {
          completed.add(n);
          const card = document.getElementById('step-' + n);
          if (!card) return;
          card.classList.remove('active-step', 'open', 'locked');
          card.classList.add('completed');
          card.querySelector('.step-status').className = 'step-status ss-done';
          card.querySelector('.step-status').textContent = '\u2713 Done';
          card.querySelector('.step-body').style.display = 'none';
        });
        const next = getActiveStep();
        if (next <= TOTAL) {
          const nc = document.getElementById('step-' + next);
          if (nc) { nc.classList.remove('locked'); nc.classList.add('active-step', 'open'); nc.querySelector('.step-status').className = 'step-status ss-active'; nc.querySelector('.step-status').textContent = 'Current'; }
        }
        if (data.completed.length === TOTAL) { const fb = document.getElementById('finishBanner'); if (fb) fb.classList.add('show'); }
      }
      if (data.quizzesPassed) data.quizzesPassed.forEach(id => {
        const q = document.getElementById(id);
        if (q) { q.classList.add('passed'); q.querySelector('.quiz-next-btn').classList.add('show'); q.querySelector('.quiz-submit').style.display = 'none'; q.querySelectorAll('.quiz-opt').forEach(o => o.classList.add('disabled')); }
      });
      if (data.challengesPassed) data.challengesPassed.forEach(id => {
        const c = document.getElementById(id);
        if (c) { c.classList.add('passed'); c.querySelector('.cc-check-btn').disabled = true; c.querySelectorAll('.cc-blank').forEach(b => { b.value = _canon(b); b.disabled = true; b.classList.add('correct'); }); }
      });
      updateXpDisplay();
    } catch (e) {}
  }

  function getActiveStep() {
    for (let i = 1; i <= TOTAL; i++) { if (!completed.has(i)) return i; }
    return TOTAL;
  }

  function buildDots() {
    const c = document.getElementById('stepDots');
    if (!c) return;
    c.innerHTML = '';
    for (let i = 1; i <= TOTAL; i++) {
      const d = document.createElement('div');
      d.className = 'step-dot' + (completed.has(i) ? ' done' : (i === getActiveStep() ? ' active' : ''));
      d.textContent = i;
      d.onclick = () => { const el = document.getElementById('step-' + i); if (el && !el.classList.contains('locked')) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      c.appendChild(d);
    }
  }

  function updateProgress() {
    const n = completed.size;
    const pc = document.getElementById('progressCount'); if (pc) pc.textContent = n + ' / ' + TOTAL + ' steps';
    const pf = document.getElementById('progressFill'); if (pf) pf.style.width = (n / TOTAL * 100) + '%';
    buildDots();
  }

  function updateXpDisplay() {
    const xpInLevel = xp % XP_PER_LEVEL;
    const xl = document.getElementById('xpLabel'); if (xl) xl.textContent = xp + ' XP';
    const xf = document.getElementById('xpFill'); if (xf) xf.style.width = (xpInLevel / XP_PER_LEVEL * 100) + '%';
    const lv = document.getElementById('xpLevel'); if (lv) lv.textContent = 'Level ' + level;
    const sc = document.getElementById('streakCount'); if (sc) sc.textContent = streak;
    const se = document.getElementById('xpStreak'); if (se) se.classList.toggle('hot', streak >= 3);
  }

  function awardXp(amount, label) {
    const oldLevel = level;
    xp += amount;
    level = Math.floor(xp / XP_PER_LEVEL) + 1;
    updateXpDisplay();
    const xl = document.getElementById('xpLabel');
    if (xl) { xl.classList.add('xp-pop'); setTimeout(() => xl.classList.remove('xp-pop'), 400); }
    showXpToast('+' + amount + ' XP' + (label ? ' \u00b7 ' + label : ''));
    if (streak >= 3) streakFx(streak);
    if (level > oldLevel) setTimeout(() => showLevelUp(level), 600);
    saveProgress();
  }

  function streakFx(s) {
    const tier = Math.min(Math.floor(s / 3), 4);
    const anchor = document.getElementById('xpLabel');
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const n = 3 + tier * 2;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.textContent = '\u2728';
      const angle = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 30;
      p.style.cssText = 'position:fixed;left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;font-size:' + (12 + tier) + 'px;pointer-events:none;z-index:9999;--dx:' + (Math.cos(angle) * dist).toFixed(1) + 'px;--dy:' + (Math.sin(angle) * dist).toFixed(1) + 'px;animation:streakPop .55s ease-out forwards;';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 570);
    }
    if (tier >= 2) { document.body.classList.add('streak-shake'); setTimeout(() => document.body.classList.remove('streak-shake'), 300); }
  }

  function showXpToast(text) {
    const existing = document.querySelector('.xp-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'xp-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2000);
  }

  function showLevelUp(lvl) {
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = '<div class="levelup-card"><div class="lvl-icon">\ud83c\udfc6</div><div class="lvl-title">Level ' + lvl + '!</div><div class="lvl-sub">You\'re doing amazing, keep going!</div><button onclick="this.closest(\'.levelup-overlay\').remove()">Continue</button></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  /* -- QUIZ -- */
  function selectQuizOpt(el) {
    const gate = el.closest('.quiz-gate') || el.closest('.predict-challenge');
    if (!gate || gate.classList.contains('passed')) return;
    gate.querySelectorAll('.quiz-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const submitBtn = gate.querySelector('.quiz-submit');
    if (submitBtn) submitBtn.classList.add('show');
  }

  function checkQuiz(btn) {
    const gate = btn.closest('.quiz-gate');
    const selected = gate.querySelector('.quiz-opt.selected');
    if (!selected) return;
    const correct = _key(gate);
    const chosenIdx = parseInt(selected.dataset.idx);
    const fb = gate.querySelector('.quiz-feedback');
    totalQuizzes++;
    if (chosenIdx === correct) {
      selected.classList.add('correct');
      fb.className = 'quiz-feedback correct show';
      fb.innerHTML = '<span class="fb-icon">\u2705</span><span>That\'s right! Great job.</span>';
      gate.classList.add('passed');
      btn.style.display = 'none';
      gate.querySelector('.quiz-next-btn').classList.add('show');
      gate.querySelectorAll('.quiz-opt').forEach(o => { if (!o.classList.contains('correct')) o.classList.add('disabled'); });
      streak++; if (streak > bestStreak) bestStreak = streak;
      correctFirst++;
      let bonus = XP_QUIZ, label = 'Quiz correct';
      if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + \ud83d\udd25 streak bonus'; }
      awardXp(bonus, label);
    } else {
      selected.classList.add('wrong');
      fb.className = 'quiz-feedback wrong show';
      fb.innerHTML = '<span class="fb-icon">\u274c</span><span>Not quite, try again!</span>';
      streak = 0; updateXpDisplay();
      setTimeout(() => { selected.classList.remove('wrong', 'selected'); fb.classList.remove('show'); }, 1500);
    }
    saveProgress();
  }

  /* -- CODE CHALLENGE -- */
  function checkCodeChallenge(btn) {
    const challenge = btn.closest('.code-challenge');
    const blanks = challenge.querySelectorAll('.cc-blank');
    const fb = challenge.querySelector('.cc-feedback');
    const hint = challenge.querySelector('.cc-hint');
    let allCorrect = true;
    blanks.forEach(b => {
      if (_match(b, b.value)) { b.classList.remove('wrong'); b.classList.add('correct'); }
      else { b.classList.remove('correct'); b.classList.add('wrong'); allCorrect = false; }
    });
    if (allCorrect) {
      fb.className = 'cc-feedback correct show';
      fb.innerHTML = '<span class="fb-icon">\u2705</span><span>Perfect! Your code is correct.</span>';
      challenge.classList.add('passed');
      btn.disabled = true;
      blanks.forEach(b => { b.value = _canon(b); b.disabled = true; });
      if (hint) hint.classList.remove('show');
      streak++; if (streak > bestStreak) bestStreak = streak;
      correctFirst++; totalQuizzes++;
      let bonus = XP_CODE, label = 'Code challenge';
      if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + \ud83d\udd25 streak bonus'; }
      awardXp(bonus, label);
    } else {
      fb.className = 'cc-feedback wrong show';
      fb.innerHTML = '<span class="fb-icon">\u274c</span><span>Some answers aren\'t quite right, check the highlighted blanks and try again.</span>';
      if (hint) hint.classList.add('show');
      streak = 0; updateXpDisplay(); totalQuizzes++;
    }
    saveProgress();
  }

  function checkConceptFill(btn) {
    const wrap = btn.closest('.concept-fill');
    const blanks = wrap.querySelectorAll('.cf-blank');
    const fb = wrap.querySelector('.cf-feedback');
    let allCorrect = true;
    blanks.forEach(b => {
      if (_match(b, b.value)) { b.classList.remove('wrong'); b.classList.add('correct'); }
      else { b.classList.remove('correct'); b.classList.add('wrong'); allCorrect = false; }
    });
    if (allCorrect) {
      fb.className = 'cf-feedback correct show';
      fb.innerHTML = '<span class="fb-icon">\u2705</span><span>Perfect!</span>';
      wrap.classList.add('passed'); btn.disabled = true;
      blanks.forEach(b => { b.value = _canon(b); b.disabled = true; });
      streak++; if (streak > bestStreak) bestStreak = streak;
      correctFirst++; totalQuizzes++;
      let bonus = XP_QUIZ, label = 'Concept fill';
      if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + \ud83d\udd25 streak bonus'; }
      awardXp(bonus, label);
    } else {
      fb.className = 'cf-feedback wrong show';
      fb.innerHTML = '<span class="fb-icon">\u274c</span><span>Some blanks aren\'t right, try again!</span>';
      streak = 0; updateXpDisplay(); totalQuizzes++;
    }
    saveProgress();
  }

  /* -- TRUE / FALSE -- */
  function pickTF(btn, value) {
    const item = btn.closest('.tf-item');
    item.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    btn.dataset.picked = value;
  }
  function checkTF(btn) {
    const round = btn.closest('.tf-round');
    const items = round.querySelectorAll('.tf-item');
    const fb = round.querySelector('.tf-feedback');
    let allAnswered = true, allCorrect = true;
    items.forEach(item => {
      const selected = item.querySelector('.tf-btn.selected');
      if (!selected) { allAnswered = false; return; }
      const correct = _dec(item, 'a').trim().toLowerCase();
      const picked = selected.dataset.picked;
      item.classList.add('answered');
      if (picked === correct) { selected.classList.add('correct-answer'); }
      else { selected.classList.add('wrong-answer'); allCorrect = false; }
    });
    if (!allAnswered) { fb.className = 'tf-feedback wrong show'; fb.innerHTML = '<span class="fb-icon">\u26a0\ufe0f</span><span>Answer all statements first!</span>'; return; }
    if (allCorrect) {
      fb.className = 'tf-feedback correct show';
      fb.innerHTML = '<span class="fb-icon">\u2705</span><span>All correct! Nice one.</span>';
      round.classList.add('passed'); btn.disabled = true;
      streak++; if (streak > bestStreak) bestStreak = streak;
      correctFirst++; totalQuizzes++;
      let bonus = XP_QUIZ, label = 'True/False';
      if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + \ud83d\udd25 streak bonus'; }
      awardXp(bonus, label);
    } else {
      fb.className = 'tf-feedback wrong show';
      fb.innerHTML = '<span class="fb-icon">\u274c</span><span>Not all correct, look at the highlighted answers and try again next time.</span>';
      streak = 0; updateXpDisplay(); totalQuizzes++;
      setTimeout(() => {
        items.forEach(item => { item.classList.remove('answered'); item.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected', 'correct-answer', 'wrong-answer')); });
        fb.classList.remove('show');
      }, 2500);
    }
    saveProgress();
  }

  /* -- ORDER CHALLENGE -- */
  let orderCounters = {};
  function pickOrder(el) {
    const challenge = el.closest('.order-challenge');
    const id = challenge.id;
    if (!orderCounters[id]) orderCounters[id] = 0;
    if (el.classList.contains('picked')) return;
    orderCounters[id]++;
    el.classList.add('picked');
    const n = el.querySelector('.oc-num'); if (n) n.textContent = orderCounters[id];
    el.dataset.userOrder = orderCounters[id];
  }
  function resetOrder(btn) {
    const challenge = btn.closest('.order-challenge');
    orderCounters[challenge.id] = 0;
    challenge.querySelectorAll('.oc-item').forEach(item => {
      item.classList.remove('picked', 'correct-pos', 'wrong-pos');
      const n = item.querySelector('.oc-num'); if (n) n.textContent = '';
      delete item.dataset.userOrder;
    });
    challenge.querySelector('.oc-feedback').classList.remove('show');
  }
  function checkOrder(btn) {
    const challenge = btn.closest('.order-challenge');
    const items = challenge.querySelectorAll('.oc-item');
    const fb = challenge.querySelector('.oc-feedback');
    let allPicked = true, allCorrect = true;
    items.forEach(item => {
      if (!item.dataset.userOrder) { allPicked = false; return; }
      if (parseInt(item.dataset.userOrder) === _key(item)) item.classList.add('correct-pos');
      else { item.classList.add('wrong-pos'); allCorrect = false; }
    });
    if (!allPicked) { fb.className = 'oc-feedback wrong show'; fb.innerHTML = '<span class="fb-icon">\u26a0\ufe0f</span><span>Click all items in order first!</span>'; return; }
    if (allCorrect) {
      fb.className = 'oc-feedback correct show';
      fb.innerHTML = '<span class="fb-icon">\u2705</span><span>Perfect order!</span>';
      challenge.classList.add('passed'); btn.disabled = true;
      const rb = challenge.querySelector('.oc-reset-btn'); if (rb) rb.style.display = 'none';
      streak++; if (streak > bestStreak) bestStreak = streak;
      correctFirst++; totalQuizzes++;
      let bonus = XP_QUIZ, label = 'Order challenge';
      if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + \ud83d\udd25 streak bonus'; }
      awardXp(bonus, label);
    } else {
      fb.className = 'oc-feedback wrong show';
      fb.innerHTML = '<span class="fb-icon">\u274c</span><span>Not quite right, hit Reset and try again!</span>';
      streak = 0; updateXpDisplay(); totalQuizzes++;
    }
    saveProgress();
  }

  /* -- PREDICT -- */
  function checkPredict(btn) {
    const challenge = btn.closest('.predict-challenge');
    const selected = challenge.querySelector('.quiz-opt.selected');
    if (!selected) return;
    const correct = _key(challenge);
    const chosenIdx = parseInt(selected.dataset.idx);
    const fb = challenge.querySelector('.quiz-feedback');
    totalQuizzes++;
    if (chosenIdx === correct) {
      selected.classList.add('correct');
      fb.className = 'quiz-feedback correct show';
      fb.innerHTML = '<span class="fb-icon">\u2705</span><span>Great prediction! You really understand how this works.</span>';
      challenge.classList.add('passed'); btn.style.display = 'none';
      challenge.querySelectorAll('.quiz-opt').forEach(o => { if (!o.classList.contains('correct')) o.classList.add('disabled'); });
      streak++; if (streak > bestStreak) bestStreak = streak;
      correctFirst++;
      let bonus = XP_QUIZ, label = 'Prediction';
      if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + \ud83d\udd25 streak bonus'; }
      awardXp(bonus, label);
    } else {
      selected.classList.add('wrong');
      fb.className = 'quiz-feedback wrong show';
      fb.innerHTML = '<span class="fb-icon">\u274c</span><span>Not quite, think about it again!</span>';
      streak = 0; updateXpDisplay();
      setTimeout(() => { selected.classList.remove('wrong', 'selected'); fb.classList.remove('show'); }, 1500);
    }
    saveProgress();
  }

  /* -- STEP COMPLETION -- */
  function completeStep(n) {
    completed.add(n);
    const card = document.getElementById('step-' + n);
    if (!card) return;
    card.classList.remove('active-step', 'open');
    card.classList.add('completed');
    card.querySelector('.step-status').className = 'step-status ss-done';
    card.querySelector('.step-status').textContent = '\u2713 Done';
    card.querySelector('.step-body').style.display = 'none';
    const next = document.getElementById('step-' + (n + 1));
    if (next) {
      next.classList.remove('locked');
      next.classList.add('active-step', 'open');
      next.querySelector('.step-status').className = 'step-status ss-active';
      next.querySelector('.step-status').textContent = 'Current';
      setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
    if (completed.size === TOTAL) {
      const fb = document.getElementById('finishBanner');
      if (fb) {
        fb.classList.add('show');
        document.getElementById('finalXp').textContent = xp;
        document.getElementById('finalLevel').textContent = level;
        document.getElementById('finalStreak').textContent = bestStreak;
        document.getElementById('finalAccuracy').textContent = totalQuizzes ? Math.round(correctFirst / totalQuizzes * 100) + '%' : '0%';
        setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      }
    }
    updateProgress();
    saveProgress();
  }

  function toggleStep(header) {
    const card = header.closest('.step-card');
    if (card.classList.contains('locked')) return;
    const body = card.querySelector('.step-body');
    const isOpen = card.classList.contains('open');
    card.classList.toggle('open', !isOpen);
    body.style.display = isOpen ? 'none' : 'block';
  }

  /* expose for inline onclick handlers */
  window.toggleStep = toggleStep;
  window.completeStep = completeStep;
  window.selectQuizOpt = selectQuizOpt;
  window.checkQuiz = checkQuiz;
  window.checkCodeChallenge = checkCodeChallenge;
  window.checkConceptFill = checkConceptFill;
  window.pickTF = pickTF;
  window.checkTF = checkTF;
  window.pickOrder = pickOrder;
  window.resetOrder = resetOrder;
  window.checkOrder = checkOrder;
  window.checkPredict = checkPredict;

  _shuffleQuiz();
  _initKbd();
  loadProgress();
  updateProgress();
  updateXpDisplay();
})();
