/* JVDesignStudio Workshop Engine
   Shared interactive engine for "My First ..." workshop pages.
   Page identity comes from <body> data attributes (CSP-proof: inline
   scripts are hash-gated, so no per-page inline config may be relied on):
     data-workshop-total, data-workshop-key (matches my-progress.html SERIES),
     data-profile-id (reported to player-profile.js on completion),
     data-orphan-key (one-time forward migration, A1425).
   The legacy window.WORKSHOP_* globals still work as a fallback.

   Answer attributes on .cc-blank / .cf-blank inputs and .quiz-gate:
     data-a / data-k, base64(encodeURIComponent(value)); "|" separates accepted
                      alternates, first alternate is canonical
     data-answer / data-correct, legacy plain-text fallback
*/
(function () {
/* Resolve page identity: body data attributes win (they run under any CSP),
   legacy inline globals remain as a fallback. */
try {
  var bd = document.body;
  if (bd && bd.dataset) {
    if (bd.dataset.workshopKey) window.WORKSHOP_KEY = bd.dataset.workshopKey;
    if (bd.dataset.workshopTotal) window.WORKSHOP_TOTAL = parseInt(bd.dataset.workshopTotal, 10) || window.WORKSHOP_TOTAL;
    if (bd.dataset.profileId) window.WORKSHOP_PROFILE_ID = bd.dataset.profileId;
    var orphanKey = bd.dataset.orphanKey;
    var mappedKey = bd.dataset.workshopKey;
    if (orphanKey && mappedKey) {
      var oldData = null, newData = null;
      try { oldData = localStorage.getItem(orphanKey); newData = localStorage.getItem(mappedKey); } catch (e) {}
      if (oldData && !newData) {
        try { localStorage.setItem(mappedKey, oldData); localStorage.removeItem(orphanKey); } catch (e) {}
      }
    }
  }
} catch (e) {}
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
  addFinishShare();
  addNextRecommendation();
  celebrationBurst();
}

function celebrationBurst() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var colors = ['#ff7700', '#06d6a0', '#ffd166', '#a78bfa', '#ff70b8', '#4dd9e0'];
  var shapes = ['⭐', '✨', '🎉', '🎊', '❤️', '💫'];
  var count = 40;
  for (var i = 0; i < count; i++) {
    var p = document.createElement('span');
    p.setAttribute('aria-hidden', 'true');
    var useEmoji = Math.random() > 0.5;
    if (useEmoji) {
      p.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      p.style.fontSize = (10 + Math.random() * 14) + 'px';
    } else {
      p.style.width = (6 + Math.random() * 6) + 'px';
      p.style.height = p.style.width;
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    }
    var x = 30 + Math.random() * 40;
    var angle = -60 - Math.random() * 60;
    var dist = 200 + Math.random() * 400;
    var drift = -150 + Math.random() * 300;
    p.style.cssText += ';position:fixed;left:' + x + 'vw;top:100vh;pointer-events:none;z-index:9999;' +
      '--cdx:' + drift.toFixed(0) + 'px;--cdy:' + (-dist).toFixed(0) + 'px;--cr:' + (Math.random() * 720 - 360).toFixed(0) + 'deg;' +
      'animation:confettiBurst ' + (1.2 + Math.random() * 0.8).toFixed(2) + 's cubic-bezier(.15,.8,.35,1) ' + (i * 25) + 'ms forwards;';
    document.body.appendChild(p);
    (function(el) { setTimeout(function() { el.remove(); }, 2500); })(p);
  }
}

/* ── SHARE A FINISHED WORKSHOP ──
   One share action for the 99 engine workshops: a finished learner invites the
   next maker. Uses the native share sheet when available, otherwise copies the
   link. Dispatches jvds:shared so the first-creation funnel counts it. */
function finishToast(text) {
  var t = document.createElement('div');
  t.setAttribute('role', 'status');
  t.textContent = text;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9002;max-width:90vw;' +
    'background:#28241e;color:#f5efe0;border:1px solid rgba(240,234,214,.18);border-radius:10px;' +
    'padding:10px 16px;font:600 .82rem/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);';
  document.body.appendChild(t);
  setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2800);
}

function workshopShare() {
  var url = location.origin + location.pathname;
  var title = (document.title || '').split('|')[0].split(/ [- -  - ] /)[0].trim() || 'a JVDesignStudio workshop';
  var text = 'I just finished the ' + title + ' workshop on JVDesignStudio. Try it free: ' + url;
  try { window.dispatchEvent(new CustomEvent('jvds:shared', { detail: { workshop: PROFILE_ID } })); } catch (e) {}
  gaTrack('workshop_share', { workshop_id: PROFILE_ID });
  if (navigator.share) {
    try { return navigator.share({ title: title, text: text, url: url }).catch(function () {}); } catch (e) {}
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function () {
      finishToast('Link copied. Send it to show what you finished.');
    }, function () { finishToast('Share this link: ' + url); });
  }
  finishToast('Share this link: ' + url);
}

function addNextRecommendation() {
  var banner = document.getElementById('finishBanner');
  if (!banner || banner.querySelector('.finish-recommend')) return;
  var links = document.querySelectorAll('a.next-ep-btn');
  if (links.length > 0) return;
  var path = location.pathname;
  var recs = {
    'scratch-catch': {title: 'Scratch Platformer', url: 'scratch-platformer-workshop.html', emoji: '🎮'},
    'scratch-platformer': {title: 'Scratch Maze', url: 'scratch-maze-workshop.html', emoji: '🧩'},
    'scratch-maze': {title: 'Scratch Race', url: 'scratch-race-workshop.html', emoji: '🏎️'},
    'godot-first': {title: 'Godot Platformer', url: 'godot-platformer-workshop.html', emoji: '🤖'},
    'js-bouncing-ball': {title: 'JS Platformer', url: 'js-platformer-workshop.html', emoji: '⚡'},
    'python-adventure': {title: 'Python RPG', url: 'python-rpg-workshop.html', emoji: '🐍'},
    'roblox-obby': {title: 'Roblox Tycoon', url: 'roblox-tycoon-workshop.html', emoji: '🟦'},
    'unity-2d-platformer': {title: 'Unity 3D Runner', url: 'unity-3d-runner-workshop.html', emoji: '🎲'}
  };
  var key = '';
  for (var k in recs) {
    if (path.indexOf(k) !== -1) { key = k; break; }
  }
  if (!key) return;
  var rec = recs[key];
  var wrap = document.createElement('div');
  wrap.className = 'finish-recommend';
  wrap.style.cssText = 'margin-top:18px;padding:16px 20px;background:rgba(112,163,167,.1);border:1px solid rgba(112,163,167,.25);border-radius:14px;text-align:center';
  wrap.innerHTML = '<div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">Ready for the next challenge?</div>' +
    '<a href="' + rec.url + '" style="display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,var(--teal,#70A3A7),var(--teal-dk,#4e7d80));color:#fff;font-family:Fredoka,cursive;font-size:1rem;font-weight:700;padding:12px 28px;border-radius:12px;text-decoration:none;box-shadow:0 3px 0 #3d6366;transition:filter .15s,transform .12s">' +
    '<span style="font-size:1.3rem">' + rec.emoji + '</span> Try: ' + rec.title + ' →</a>';
  var stats = banner.querySelector('.final-stats');
  if (stats) stats.parentNode.insertBefore(wrap, stats.nextSibling);
  else banner.appendChild(wrap);
}

function addFinishShare() {
  var banner = document.getElementById('finishBanner');
  if (!banner || banner.querySelector('.finish-share')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'finish-share';
  btn.textContent = 'Share what you made';
  btn.style.cssText = 'display:inline-flex;align-items:center;gap:8px;background:var(--teal-dk,#4e7d80);color:#fff;' +
    'font-family:Fredoka,Inter,sans-serif;font-weight:700;font-size:.95rem;padding:12px 26px;border:none;' +
    'border-radius:12px;cursor:pointer;margin-top:12px;box-shadow:0 3px 0 #3d6366;';
  btn.addEventListener('click', workshopShare);
  var stats = banner.querySelector('.final-stats');
  if (stats && stats.nextSibling) { banner.insertBefore(btn, stats.nextSibling); }
  else { banner.appendChild(btn); }
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

/* ── PROGRESSIVE HINT SYSTEM ── */
var hintAttempts = {};
function getHintTier(id) { return hintAttempts[id] || 0; }
function bumpHintTier(id) { hintAttempts[id] = (hintAttempts[id] || 0) + 1; return hintAttempts[id]; }

function showProgressiveHint(challenge) {
  var id = challenge.id || 'anon';
  var tier = bumpHintTier(id);
  var hint = challenge.querySelector('.cc-hint, .cf-hint');
  if (!hint) return;
  hint.classList.add('show');
  if (tier >= 3) {
    var reveal = challenge.querySelector('.ws-reveal-btn');
    if (!reveal && !challenge.classList.contains('passed')) {
      reveal = document.createElement('button');
      reveal.type = 'button';
      reveal.className = 'ws-reveal-btn';
      reveal.textContent = 'Reveal answer';
      reveal.addEventListener('click', function() {
        var blanks = challenge.querySelectorAll('.cc-blank, .cf-blank');
        blanks.forEach(function(b) { b.value = canonicalAnswer(b); b.classList.add('correct'); b.disabled = true; });
        challenge.classList.add('passed');
        var fb = challenge.querySelector('.cc-feedback, .cf-feedback');
        if (fb) { fb.className = fb.className.replace(/wrong/g, '') + ' correct show'; fb.innerHTML = '<span class="fb-icon">💡</span><span>Answer revealed.</span>'; }
        var btn = challenge.querySelector('.cc-check-btn, .cf-check-btn');
        if (btn) btn.disabled = true;
        reveal.remove();
        saveProgress();
      });
      hint.parentNode.insertBefore(reveal, hint.nextSibling);
    }
  }
  var tierText = ['Try reading the hint above.', 'Look at the code example carefully.', 'One more try, or reveal the answer.'];
  var msg = challenge.querySelector('.ws-hint-tier');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'ws-hint-tier';
    hint.parentNode.insertBefore(msg, hint.nextSibling);
  }
  msg.textContent = tierText[Math.min(tier - 1, tierText.length - 1)];
}

/* ── SOUND EFFECTS (Web Audio API) ── */
var sfxEnabled = false;
var sfxCtx = null;
function initSfx() {
  try {
    sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    sfxEnabled = true;
  } catch(e) { sfxEnabled = false; }
}
function playSfx(type) {
  if (!sfxEnabled || !sfxCtx) return;
  try {
    var osc = sfxCtx.createOscillator();
    var gain = sfxCtx.createGain();
    osc.connect(gain);
    gain.connect(sfxCtx.destination);
    gain.gain.value = 0.12;
    var now = sfxCtx.currentTime;
    if (type === 'correct') {
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.1);
      osc.frequency.setValueAtTime(784, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'wrong') {
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(277, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'levelup') {
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.12);
      osc.frequency.setValueAtTime(784, now + 0.24);
      osc.frequency.setValueAtTime(1047, now + 0.36);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'streak') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1108, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
    }
  } catch(e) {}
}

function buildSfxToggle() {
  var wrap = document.querySelector('.xp-wrap');
  if (!wrap || wrap.querySelector('.ws-sfx-toggle')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ws-sfx-toggle';
  btn.setAttribute('aria-label', 'Toggle sound effects');
  btn.textContent = '🔇';
  btn.title = 'Sound effects off';
  btn.addEventListener('click', function() {
    if (!sfxCtx) initSfx();
    sfxEnabled = !sfxEnabled;
    btn.textContent = sfxEnabled ? '🔊' : '🔇';
    btn.title = sfxEnabled ? 'Sound effects on' : 'Sound effects off';
    if (sfxEnabled) playSfx('correct');
    try { localStorage.setItem('jvds_sfx', sfxEnabled ? '1' : '0'); } catch(e) {}
  });
  try {
    if (localStorage.getItem('jvds_sfx') === '1') {
      initSfx();
      btn.textContent = '🔊';
      btn.title = 'Sound effects on';
    }
  } catch(e) {}
  wrap.appendChild(btn);
}

/* ── TIMED CHALLENGE MODE ── */
var timerInterval = null;
var timerSeconds = 0;
var timerActive = false;

function buildTimerToggle() {
  var wrap = document.querySelector('.xp-wrap');
  if (!wrap || wrap.querySelector('.ws-timer-toggle')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ws-timer-toggle';
  btn.textContent = '⏱️ Timer';
  btn.title = 'Start speed-run timer';
  btn.addEventListener('click', function() {
    if (timerActive) { stopTimer(); btn.textContent = '⏱️ Timer'; btn.title = 'Start speed-run timer'; }
    else { startTimer(); btn.textContent = '⏱️ Stop'; btn.title = 'Stop timer'; }
  });
  wrap.appendChild(btn);
}

function startTimer() {
  timerActive = true;
  timerSeconds = 0;
  var display = document.querySelector('.ws-timer-display');
  if (!display) {
    display = document.createElement('div');
    display.className = 'ws-timer-display';
    var bar = document.querySelector('.progress-wrap');
    if (bar) bar.appendChild(display);
  }
  display.textContent = '0:00';
  display.style.display = '';
  timerInterval = setInterval(function() {
    timerSeconds++;
    var m = Math.floor(timerSeconds / 60);
    var s = timerSeconds % 60;
    display.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }, 1000);
}

function stopTimer() {
  timerActive = false;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

/* ── BOOKMARK / NOTES PER STEP ── */
function initStepNotes() {
  var cards = document.querySelectorAll('.step-card');
  var notesKey = STORAGE_KEY + '_notes';
  var savedNotes = {};
  try { savedNotes = JSON.parse(localStorage.getItem(notesKey) || '{}'); } catch(e) {}

  cards.forEach(function(card) {
    var stepNum = (card.id || '').replace('step-', '');
    if (!stepNum) return;
    var header = card.querySelector('.step-header');
    if (!header || header.querySelector('.ws-note-btn')) return;
    var noteBtn = document.createElement('button');
    noteBtn.type = 'button';
    noteBtn.className = 'ws-note-btn';
    noteBtn.textContent = savedNotes[stepNum] ? '📝' : '🔖';
    noteBtn.title = 'Add a note to this step';
    noteBtn.setAttribute('aria-label', 'Add note to step ' + stepNum);
    noteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var existing = card.querySelector('.ws-note-area');
      if (existing) { existing.remove(); noteBtn.classList.remove('active'); return; }
      var area = document.createElement('div');
      area.className = 'ws-note-area';
      var ta = document.createElement('textarea');
      ta.className = 'ws-note-input';
      ta.placeholder = 'Write your notes here...';
      ta.rows = 3;
      ta.value = savedNotes[stepNum] || '';
      ta.addEventListener('input', function() {
        savedNotes[stepNum] = ta.value;
        try { localStorage.setItem(notesKey, JSON.stringify(savedNotes)); } catch(e) {}
        noteBtn.textContent = ta.value ? '📝' : '🔖';
      });
      area.appendChild(ta);
      var body = card.querySelector('.step-body');
      if (body) body.insertBefore(area, body.firstChild);
      else card.appendChild(area);
      noteBtn.classList.add('active');
      ta.focus();
    });
    header.appendChild(noteBtn);
  });
}

/* ── DAILY STREAK ── */
function trackDailyStreak() {
  try {
    var key = 'jvds_daily_streak';
    var data = JSON.parse(localStorage.getItem(key) || 'null') || { count: 0, lastDate: '' };
    var today = new Date().toISOString().slice(0, 10);
    if (data.lastDate === today) return data;
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (data.lastDate === yesterday) {
      data.count++;
    } else if (data.lastDate !== today) {
      data.count = 1;
    }
    data.lastDate = today;
    if (data.count > (data.best || 0)) data.best = data.count;
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  } catch(e) { return { count: 1, lastDate: '', best: 1 }; }
}

function showDailyStreakBanner() {
  var data = trackDailyStreak();
  if (!data || data.count < 2) return;
  var bar = document.querySelector('.progress-wrap');
  if (!bar || bar.querySelector('.ws-daily-streak')) return;
  var badge = document.createElement('div');
  badge.className = 'ws-daily-streak';
  badge.innerHTML = '🔥 ' + data.count + '-day streak!';
  badge.title = 'Best: ' + (data.best || data.count) + ' days';
  bar.appendChild(badge);
}

/* ── COLLECTIBLE REWARDS ── */
function checkCollectibles() {
  try {
    var key = 'jvds_collectibles';
    var unlocked = JSON.parse(localStorage.getItem(key) || '[]');
    var milestones = [
      { xp: 50, id: 'first-spark', emoji: '⚡', name: 'First Spark' },
      { xp: 100, id: 'rising-star', emoji: '⭐', name: 'Rising Star' },
      { xp: 250, id: 'code-crafter', emoji: '🔨', name: 'Code Crafter' },
      { xp: 500, id: 'quiz-whiz', emoji: '🧠', name: 'Quiz Whiz' },
      { xp: 1000, id: 'master-maker', emoji: '🏆', name: 'Master Maker' },
      { xp: 2000, id: 'legend', emoji: '👑', name: 'Legend' }
    ];
    var newUnlock = null;
    milestones.forEach(function(m) {
      if (xp >= m.xp && unlocked.indexOf(m.id) === -1) {
        unlocked.push(m.id);
        newUnlock = m;
      }
    });
    localStorage.setItem(key, JSON.stringify(unlocked));
    if (newUnlock) showCollectibleUnlock(newUnlock);
  } catch(e) {}
}

function showCollectibleUnlock(reward) {
  var overlay = document.createElement('div');
  overlay.className = 'ws-collectible-overlay';
  overlay.innerHTML = '<div class="ws-collectible-card">' +
    '<div class="ws-collectible-emoji">' + reward.emoji + '</div>' +
    '<div class="ws-collectible-title">New Reward!</div>' +
    '<div class="ws-collectible-name">' + reward.name + '</div>' +
    '<div class="ws-collectible-desc">Earned at ' + reward.xp + ' XP</div>' +
    '<button type="button">Awesome!</button></div>';
  document.body.appendChild(overlay);
  if (sfxEnabled) playSfx('levelup');
  overlay.querySelector('button').addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

/* ── TTS / READ-ALOUD TOGGLE ── */
function buildTtsToggle() {
  if (!('speechSynthesis' in window)) return;
  var wrap = document.querySelector('.xp-wrap');
  if (!wrap || wrap.querySelector('.ws-tts-toggle')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ws-tts-toggle';
  btn.textContent = '🔈 Read';
  btn.title = 'Read step text aloud';
  var reading = false;
  btn.addEventListener('click', function() {
    if (reading) {
      speechSynthesis.cancel();
      reading = false;
      btn.textContent = '🔈 Read';
      return;
    }
    var active = document.querySelector('.step-card.active-step.open .step-body');
    if (!active) { finishToast('Open a step first.'); return; }
    var text = active.innerText.slice(0, 2000);
    var utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.onend = function() { reading = false; btn.textContent = '🔈 Read'; };
    speechSynthesis.speak(utter);
    reading = true;
    btn.textContent = '⏹️ Stop';
  });
  wrap.appendChild(btn);
}

/* Hook sound effects into existing award/level functions */
var _origAwardXp = awardXp;
awardXp = function(amount, label) {
  _origAwardXp(amount, label);
  if (sfxEnabled) {
    if (streak >= 3) playSfx('streak');
    else playSfx('correct');
  }
  checkCollectibles();
};
var _origShowLevelUp = showLevelUp;
showLevelUp = function(lvl) {
  _origShowLevelUp(lvl);
  if (sfxEnabled) playSfx('levelup');
};

/* Hook progressive hints into code challenge wrong answers */
var _origCheckCC = checkCodeChallenge;
checkCodeChallenge = function(btn) {
  var challenge = btn.closest('.code-challenge');
  var wasPassed = challenge && challenge.classList.contains('passed');
  _origCheckCC(btn);
  if (challenge && !wasPassed && !challenge.classList.contains('passed')) {
    showProgressiveHint(challenge);
    if (sfxEnabled) playSfx('wrong');
  }
};

var _origCheckCF = checkConceptFill;
checkConceptFill = function(btn) {
  var wrap = btn.closest('.concept-fill');
  var wasPassed = wrap && wrap.classList.contains('passed');
  _origCheckCF(btn);
  if (wrap && !wasPassed && !wrap.classList.contains('passed')) {
    showProgressiveHint(wrap);
    if (sfxEnabled) playSfx('wrong');
  }
};

var _origCheckQuiz = checkQuiz;
checkQuiz = function(btn) {
  var gate = btn.closest('.quiz-gate');
  var wasPassed = gate && gate.classList.contains('passed');
  _origCheckQuiz(btn);
  if (gate && !wasPassed && !gate.classList.contains('passed')) {
    if (sfxEnabled) playSfx('wrong');
  }
};

/* Timer bonus at completion */
var _origShowFinish = showFinish;
showFinish = function() {
  _origShowFinish();
  if (timerActive) {
    stopTimer();
    var m = Math.floor(timerSeconds / 60);
    var s = timerSeconds % 60;
    var timeStr = m + ':' + (s < 10 ? '0' : '') + s;
    var banner = document.getElementById('finishBanner');
    if (banner) {
      var el = document.createElement('div');
      el.className = 'ws-timer-result';
      el.innerHTML = '⏱️ Speed run: <strong>' + timeStr + '</strong>';
      if (timerSeconds < 300) el.innerHTML += ' · +10 XP speed bonus!';
      var stats = banner.querySelector('.final-stats');
      if (stats) stats.parentNode.insertBefore(el, stats.nextSibling);
      if (timerSeconds < 300) {
        xp += 10;
        updateXpDisplay();
        saveProgress();
      }
    }
  }
};

/* pages call these from inline onclick handlers */
window.selectQuizOpt = selectQuizOpt;
window.checkQuiz = checkQuiz;
window.checkCodeChallenge = checkCodeChallenge;
window.checkConceptFill = checkConceptFill;
window.completeStep = completeStep;
window.toggleStep = toggleStep;

/* expose internals for workshop-interactive.js */
window._wsEngine = {
  get streak() { return streak; }, set streak(v) { streak = v; },
  get bestStreak() { return bestStreak; }, set bestStreak(v) { bestStreak = v; },
  get totalQuizzes() { return totalQuizzes; }, set totalQuizzes(v) { totalQuizzes = v; },
  get correctFirst() { return correctFirst; }, set correctFirst(v) { correctFirst = v; },
  XP_QUIZ: XP_QUIZ, XP_CODE: XP_CODE, XP_STREAK_BONUS: XP_STREAK_BONUS,
  awardXp: awardXp, saveProgress: saveProgress, updateXpDisplay: updateXpDisplay
};

shuffleQuizOptions();
initKeyboardAccess();
loadProgress();
updateProgress();
updateXpDisplay();
buildSfxToggle();
buildTimerToggle();
buildTtsToggle();
initStepNotes();
showDailyStreakBanner();
try { localStorage.setItem('jvds_last_workshop', location.pathname); } catch(e) {}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-progress.js', { scope: '/workshops/' }).catch(function() {});
}
})();
