/* JVDesignStudio Workshop Engine
   Shared interactive engine for "My First ..." workshop pages.
   Page must define before loading this file:
     window.WORKSHOP_TOTAL, number of steps
     window.WORKSHOP_KEY, localStorage key (matches my-progress.html SERIES)
     window.WORKSHOP_PROFILE_ID, id reported to player-profile.js on completion

   Answer attributes on .cc-blank / .cf-blank inputs and .quiz-gate:
     data-a / data-k, base64(encodeURIComponent(value)); "|" separates accepted
                      alternates, first alternate is canonical
     data-answer / data-correct, legacy plain-text fallback
*/
(function () {
var TOTAL = window.WORKSHOP_TOTAL;
var STORAGE_KEY = window.WORKSHOP_KEY;
var PROFILE_ID = window.WORKSHOP_PROFILE_ID;

var completed = new Set();
var xp = 0;
var level = 1;
var streak = 0;
var bestStreak = 0;
var totalQuizzes = 0;
var correctFirst = 0;
var workshopStartTime = Date.now();

var XP_PER_LEVEL = 100;
var XP_QUIZ = 15;
var XP_CODE = 20;
var XP_STREAK_BONUS = 5;

/* ── ANSWER DECODING ── */
function decodeAnswers(el) {
  var raw = '';
  if (el.dataset.a) {
    try { raw = decodeURIComponent(atob(el.dataset.a)); } catch (e) { raw = ''; }
  } else if (el.dataset.answer !== undefined) {
    raw = el.dataset.answer;
  }
  return raw.split('|');
}

function canonicalAnswer(el) {
  return decodeAnswers(el)[0];
}

function matchesAnswer(el, value) {
  var v = value.trim().toLowerCase();
  return decodeAnswers(el).some(function (a) { return a.trim().toLowerCase() === v; });
}

function correctIndex(gate) {
  if (gate.dataset.k) {
    try { return parseInt(decodeURIComponent(atob(gate.dataset.k)), 10); } catch (e) { return -1; }
  }
  return parseInt(gate.dataset.correct, 10);
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completed: [...completed], total: TOTAL, xp: xp, level: level, streak: streak,
      bestStreak: bestStreak, totalQuizzes: totalQuizzes, correctFirst: correctFirst,
      quizzesPassed: [...document.querySelectorAll('.quiz-gate.passed')].map(function(q){ return q.id; }),
      challengesPassed: [...document.querySelectorAll('.code-challenge.passed')].map(function(c){ return c.id; }),
      fillsPassed: [...document.querySelectorAll('.concept-fill.passed')].map(function(c){ return c.id; })
    }));
    localStorage.setItem('jvds_last_workshop', location.pathname);
  } catch(e) {}
}

function loadProgress() {
  try {
    var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data) return;
    if (data.xp) { xp = data.xp; level = data.level || 1; streak = data.streak || 0; bestStreak = data.bestStreak || 0; totalQuizzes = data.totalQuizzes || 0; correctFirst = data.correctFirst || 0; }
    if (data.completed && data.completed.length) {
      data.completed.forEach(function(n) {
        completed.add(n);
        var card = document.getElementById('step-' + n);
        if (!card) return;
        card.classList.remove('active-step', 'open', 'locked');
        card.classList.add('completed');
        card.querySelector('.step-status').className = 'step-status ss-done';
        card.querySelector('.step-status').textContent = '✓ Done';
        card.querySelector('.step-body').style.display = 'none';
      });
      var next = getActiveStep();
      if (next <= TOTAL) {
        var nc = document.getElementById('step-' + next);
        if (nc) { nc.classList.remove('locked'); nc.classList.add('active-step', 'open'); nc.querySelector('.step-status').className = 'step-status ss-active'; nc.querySelector('.step-status').textContent = 'Current'; }
      }
      if (data.completed.length === TOTAL) showFinish();
    }
    if (data.quizzesPassed) data.quizzesPassed.forEach(function(id) {
      var q = document.getElementById(id);
      if (q) { q.classList.add('passed'); q.querySelector('.quiz-next-btn').classList.add('show'); q.querySelector('.quiz-submit').style.display = 'none'; q.querySelectorAll('.quiz-opt').forEach(function(o){ o.classList.add('disabled'); }); }
    });
    if (data.challengesPassed) data.challengesPassed.forEach(function(id) {
      var c = document.getElementById(id);
      if (c) { c.classList.add('passed'); c.querySelector('.cc-check-btn').disabled = true; c.querySelectorAll('.cc-blank').forEach(function(b){ b.value = canonicalAnswer(b); b.disabled = true; b.classList.add('correct'); }); }
    });
    if (data.fillsPassed) data.fillsPassed.forEach(function(id) {
      var c = document.getElementById(id);
      if (c) { c.classList.add('passed'); c.querySelector('.cf-check-btn').disabled = true; c.querySelectorAll('.cf-blank').forEach(function(b){ b.value = canonicalAnswer(b); b.disabled = true; b.classList.add('correct'); }); }
    });
    updateXpDisplay();
  } catch(e) {}
}

function getActiveStep() {
  for (var i = 1; i <= TOTAL; i++) { if (!completed.has(i)) return i; }
  return TOTAL;
}

function buildDots() {
  var c = document.getElementById('stepDots');
  if (!c) return;
  c.innerHTML = '';
  for (var i = 1; i <= TOTAL; i++) {
    var d = document.createElement('div');
    d.className = 'step-dot' + (completed.has(i) ? ' done' : (i === getActiveStep() ? ' active' : ''));
    d.textContent = i;
    (function(idx){
      d.onclick = function() { var el = document.getElementById('step-' + idx); if (el && !el.classList.contains('locked')) el.scrollIntoView({behavior:'smooth',block:'start'}); };
    })(i);
    c.appendChild(d);
  }
}

function updateProgress() {
  var n = completed.size;
  document.getElementById('progressCount').textContent = n + ' / ' + TOTAL + ' steps';
  document.getElementById('progressFill').style.width = (n / TOTAL * 100) + '%';
  buildDots();
}

function updateXpDisplay() {
  var xpInLevel = xp % XP_PER_LEVEL;
  document.getElementById('xpLabel').textContent = xp + ' XP';
  document.getElementById('xpFill').style.width = (xpInLevel / XP_PER_LEVEL * 100) + '%';
  document.getElementById('xpLevel').textContent = 'Level ' + level;
  document.getElementById('streakCount').textContent = streak;
  document.getElementById('xpStreak').classList.toggle('hot', streak >= 3);
}

function awardXp(amount, label) {
  var oldLevel = level;
  xp += amount;
  level = Math.floor(xp / XP_PER_LEVEL) + 1;
  updateXpDisplay();
  document.getElementById('xpLabel').classList.add('xp-pop');
  setTimeout(function(){ document.getElementById('xpLabel').classList.remove('xp-pop'); }, 400);
  showXpToast('+' + amount + ' XP' + (label ? ' · ' + label : ''));
  // A correct quiz/code-challenge/concept-fill answer only ever showed the
  // same fixed toast, the "hot" streak state (streak>=3) was already there
  // but purely cosmetic (a colour + pulse), nothing actually scaled with
  // how long the streak had gotten. This is called right after streak is
  // incremented at all 3 call sites, so it reflects the current run.
  if (streak >= 3) streakFx(streak);
  if (level > oldLevel) setTimeout(function(){ showLevelUp(level); }, 600);
  saveProgress();
}

function streakFx(s) {
  var tier = Math.min(Math.floor(s / 3), 4);
  var anchor = document.getElementById('xpLabel');
  if (!anchor) return;
  var r = anchor.getBoundingClientRect();
  var n = 3 + tier * 2;
  for (var i = 0; i < n; i++) {
    var p = document.createElement('span');
    p.textContent = '✨';
    var angle = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 30;
    p.style.cssText = 'position:fixed;left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;font-size:' + (12 + tier) + 'px;pointer-events:none;z-index:9999;--dx:' + (Math.cos(angle) * dist).toFixed(1) + 'px;--dy:' + (Math.sin(angle) * dist).toFixed(1) + 'px;animation:streakPop .55s ease-out forwards;';
    document.body.appendChild(p);
    (function (el) { setTimeout(function () { el.remove(); }, 570); })(p);
  }
  if (tier >= 2) {
    document.body.classList.add('streak-shake');
    setTimeout(function () { document.body.classList.remove('streak-shake'); }, 300);
  }
}

function showXpToast(text) {
  var existing = document.querySelector('.xp-toast');
  if (existing) existing.remove();
  var t = document.createElement('div');
  t.className = 'xp-toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(function(){ t.classList.add('out'); setTimeout(function(){ t.remove(); }, 300); }, 2000);
}

function showLevelUp(lvl) {
  var overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = '<div class="levelup-card"><div class="lvl-icon">🏆</div><div class="lvl-title">Level ' + lvl + '!</div><div class="lvl-sub">Amazing work, keep going!</div><button>Continue</button></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('button').onclick = function(){ overlay.remove(); };
  overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
}

/* ── QUIZ SYSTEM ── */
function selectQuizOpt(el) {
  var gate = el.closest('.quiz-gate');
  if (!gate || gate.classList.contains('passed')) return;
  gate.querySelectorAll('.quiz-opt').forEach(function(o){ o.classList.remove('selected'); });
  el.classList.add('selected');
  var submitBtn = gate.querySelector('.quiz-submit');
  if (submitBtn) submitBtn.classList.add('show');
}

function checkQuiz(btn) {
  var gate = btn.closest('.quiz-gate');
  var selected = gate.querySelector('.quiz-opt.selected');
  if (!selected) return;
  var correct = correctIndex(gate);
  var chosenIdx = parseInt(selected.dataset.idx);
  var fb = gate.querySelector('.quiz-feedback');
  totalQuizzes++;

  if (chosenIdx === correct) {
    selected.classList.add('correct');
    fb.className = 'quiz-feedback correct show';
    fb.innerHTML = '<span class="fb-icon">✅</span><span>Correct! Great job.</span>';
    gate.classList.add('passed');
    btn.style.display = 'none';
    gate.querySelector('.quiz-next-btn').classList.add('show');
    gate.querySelectorAll('.quiz-opt').forEach(function(o){ if (!o.classList.contains('correct')) o.classList.add('disabled'); });
    streak++;
    if (streak > bestStreak) bestStreak = streak;
    correctFirst++;
    var bonus = XP_QUIZ;
    var label = 'Quiz correct';
    if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + 🔥 streak bonus'; }
    awardXp(bonus, label);
  } else {
    selected.classList.add('wrong');
    fb.className = 'quiz-feedback wrong show';
    fb.innerHTML = '<span class="fb-icon">❌</span><span>Not quite, try again!</span>';
    streak = 0;
    updateXpDisplay();
    setTimeout(function() {
      selected.classList.remove('wrong', 'selected');
      fb.classList.remove('show');
    }, 1500);
  }
  gaTrack('quiz_attempt', {
    workshop_id: PROFILE_ID,
    quiz_id: gate.id || '',
    quiz_passed: chosenIdx === correct,
    attempt_number: totalQuizzes
  });
  saveProgress();
}

/* ── CODE CHALLENGE SYSTEM ── */
function checkCodeChallenge(btn) {
  var challenge = btn.closest('.code-challenge');
  var blanks = challenge.querySelectorAll('.cc-blank');
  var fb = challenge.querySelector('.cc-feedback');
  var hint = challenge.querySelector('.cc-hint');
  var allCorrect = true;

  blanks.forEach(function(b) {
    if (matchesAnswer(b, b.value)) {
      b.classList.remove('wrong');
      b.classList.add('correct');
    } else {
      b.classList.remove('correct');
      b.classList.add('wrong');
      allCorrect = false;
    }
  });

  if (allCorrect) {
    fb.className = 'cc-feedback correct show';
    fb.innerHTML = '<span class="fb-icon">✅</span><span>Perfect! Your code is correct.</span>';
    challenge.classList.add('passed');
    btn.disabled = true;
    blanks.forEach(function(b){ b.value = canonicalAnswer(b); b.disabled = true; });
    if (hint) hint.classList.remove('show');
    streak++;
    if (streak > bestStreak) bestStreak = streak;
    correctFirst++;
    totalQuizzes++;
    var bonus = XP_CODE;
    var label = 'Code challenge';
    if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + 🔥 streak bonus'; }
    awardXp(bonus, label);
  } else {
    fb.className = 'cc-feedback wrong show';
    fb.innerHTML = '<span class="fb-icon">❌</span><span>Some answers are not quite right, check the highlighted blanks and try again.</span>';
    if (hint) hint.classList.add('show');
    streak = 0;
    updateXpDisplay();
    totalQuizzes++;
  }
  saveProgress();
}

/* ── CONCEPT FILL SYSTEM ── */
function checkConceptFill(btn) {
  var wrap = btn.closest('.concept-fill');
  var blanks = wrap.querySelectorAll('.cf-blank');
  var fb = wrap.querySelector('.cf-feedback');
  var allCorrect = true;
  blanks.forEach(function(b) {
    if (matchesAnswer(b, b.value)) {
      b.classList.remove('wrong'); b.classList.add('correct');
    } else {
      b.classList.remove('correct'); b.classList.add('wrong'); allCorrect = false;
    }
  });
  if (allCorrect) {
    fb.className = 'cf-feedback correct show';
    fb.innerHTML = '<span class="fb-icon">✅</span><span>Perfect!</span>';
    wrap.classList.add('passed'); btn.disabled = true;
    blanks.forEach(function(b){ b.value = canonicalAnswer(b); b.disabled = true; });
    streak++; if (streak > bestStreak) bestStreak = streak;
    correctFirst++; totalQuizzes++;
    var bonus = XP_QUIZ, label = 'Concept fill';
    if (streak >= 3) { bonus += XP_STREAK_BONUS; label += ' + 🔥 streak bonus'; }
    awardXp(bonus, label);
  } else {
    fb.className = 'cf-feedback wrong show';
    fb.innerHTML = '<span class="fb-icon">❌</span><span>Some blanks are not right, try again!</span>';
    streak = 0; updateXpDisplay(); totalQuizzes++;
  }
  saveProgress();
}

/* ── STEP COMPLETION ── */
function showFinish() {
  var banner = document.getElementById('finishBanner');
  banner.classList.add('show');
  document.getElementById('finalXp').textContent = xp;
  document.getElementById('finalLevel').textContent = level;
  document.getElementById('finalStreak').textContent = bestStreak;
  document.getElementById('finalAccuracy').textContent = totalQuizzes ? Math.round(correctFirst / totalQuizzes * 100) + '%' : '0%';
}

// Fire-and-forget GA4 helper. Consent is handled centrally by
// analytics-loader.js (Consent Mode v2), so these are safe to call.
function gaTrack(name, params) {
  if (typeof gtag !== 'function') return;
  try { gtag('event', name, params || {}); } catch (e) { /* never break the lesson */ }
}

function completeStep(n) {
  completed.add(n);
  // Step-level funnel: this is what shows WHERE learners drop off, rather
  // than only whether they finished.
  gaTrack('workshop_progress', {
    workshop_id: PROFILE_ID,
    step: n,
    total_steps: TOTAL,
    percent_complete: TOTAL ? Math.round((completed.size / TOTAL) * 100) : 0
  });
  var card = document.getElementById('step-' + n);
  card.classList.remove('active-step', 'open');
  card.classList.add('completed');
  card.querySelector('.step-status').className = 'step-status ss-done';
  card.querySelector('.step-status').textContent = '✓ Done';
  card.querySelector('.step-body').style.display = 'none';
  var next = document.getElementById('step-' + (n + 1));
  if (next) {
    next.classList.remove('locked');
    next.classList.add('active-step', 'open');
    next.querySelector('.step-status').className = 'step-status ss-active';
    next.querySelector('.step-status').textContent = 'Current';
    setTimeout(function(){ next.scrollIntoView({behavior:'smooth',block:'start'}); }, 150);
  }
  if (completed.size === TOTAL) {
    showFinish();
    setTimeout(function(){ document.getElementById('finishBanner').scrollIntoView({behavior:'smooth',block:'start'}); }, 200);
    if (typeof playerProfile !== 'undefined') {
      playerProfile.markWorkshopCompleted(PROFILE_ID);
      // Track time spent in this workshop session (minutes)
      var elapsed = Math.round((Date.now() - workshopStartTime) / 60000);
      if (elapsed > 0) {
        playerProfile.state.totalPlayTime = (playerProfile.state.totalPlayTime || 0) + elapsed;
        playerProfile.saveProfile();
      }
    }
  }
  updateProgress();
  saveProgress();
}

function toggleStep(header) {
  var card = header.closest('.step-card');
  if (card.classList.contains('locked')) return;
  var body = card.querySelector('.step-body');
  var isOpen = card.classList.contains('open');
  card.classList.toggle('open', !isOpen);
  body.style.display = isOpen ? 'none' : 'block';
}

/* ── QUIZ OPTION SHUFFLE ── */
function shuffleQuizOptions() {
  document.querySelectorAll('.quiz-gate .quiz-options').forEach(function(opts) {
    var kids = [...opts.children];
    for (var i = kids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = kids[i]; kids[i] = kids[j]; kids[j] = tmp;
    }
    kids.forEach(function(k){ opts.appendChild(k); });
    var letters = ['A', 'B', 'C', 'D', 'E'];
    opts.querySelectorAll('.opt-letter').forEach(function(l, i){ l.textContent = letters[i] || ''; });
  });
}

/* ── KEYBOARD ACCESS ── */
function initKeyboardAccess() {
  function activate(el) {
    return function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    };
  }
  document.querySelectorAll('.quiz-opt').forEach(function(o) {
    o.setAttribute('role', 'button');
    o.setAttribute('tabindex', '0');
    o.addEventListener('keydown', activate(o));
  });
  document.querySelectorAll('.step-header').forEach(function(h) {
    h.setAttribute('role', 'button');
    h.setAttribute('tabindex', '0');
    h.addEventListener('keydown', activate(h));
  });
}

/* pages call these from inline onclick handlers */
window.selectQuizOpt = selectQuizOpt;
window.checkQuiz = checkQuiz;
window.checkCodeChallenge = checkCodeChallenge;
window.checkConceptFill = checkConceptFill;
window.completeStep = completeStep;
window.toggleStep = toggleStep;

shuffleQuizOptions();
initKeyboardAccess();
loadProgress();
updateProgress();
updateXpDisplay();
try { localStorage.setItem('jvds_last_workshop', location.pathname); } catch(e) {}
})();
