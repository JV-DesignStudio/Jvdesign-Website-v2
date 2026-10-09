/**
 * Workshop Canvas Engine
 *
 * Each workshop page sets window.CW_CONFIG before loading this script:
 *   {
 *     storageKey: 'jvds-snake-canvas',
 *     downloadName: 'my-snake-game.html',
 *     steps: [ { num, title, goal, points[], challenge, starter, solution, checks[], height, fills?, quiz? } ],
 *     templates: { 1: fn(userCode) => fullHTML, 2: fn(userCode) => fullHTML, ... },
 *     hints: [ 'Step 1 hint', 'Step 2 hint', ... ]
 *   }
 */
'use strict';
(function() {

var CFG = window.CW_CONFIG;
if (!CFG) return;

var STEPS = CFG.steps;
var TEMPLATES = CFG.templates;

var currentStep = 0;
var completed = {};
var editors = {};
var debounceTimer = null;
var codeValid = {};
var quizPassed = {};
var quizSelected = {};

/* ── SHARED WORKSHOP ENGINE BRIDGE ──
   When the page loads workshop-engine.js, award the site-wide XP/streak
   system as each build step is completed, and mirror our own progress into
   its saveProgress() so my-progress.html and the XP bar stay in sync. */
function wsAwardXp(amount, label) {
  try {
    if (window._wsEngine && window._wsEngine.awardXp) window._wsEngine.awardXp(amount, label);
    else if (window.awardXp) window.awardXp(amount, label);
  } catch (e) {}
}
function wsSaveShared() {
  try {
    if (window._wsEngine && window._wsEngine.saveProgress) window._wsEngine.saveProgress();
    else if (window.saveProgress) window.saveProgress();
  } catch (e) {}
}
function wsXpPerStep() {
  try {
    if (window._wsEngine && window._wsEngine.XP_CODE) return window._wsEngine.XP_CODE;
  } catch (e) {}
  return 20;
}
/* Mirror our step count into the shared progress bar (#progressCount,
   #progressFill, #stepDots) so the familiar header widgets stay in sync,
   and let the shared saveProgress() see our completed steps. */
function wsSyncProgress() {
  var done = Object.keys(completed).length;
  var countEl = document.getElementById('progressCount');
  var fillEl = document.getElementById('progressFill');
  var dotsEl = document.getElementById('stepDots');
  if (countEl) countEl.textContent = done + ' / ' + STEPS.length + ' steps';
  if (fillEl) fillEl.style.width = (done / STEPS.length * 100) + '%';
  if (dotsEl) {
    dotsEl.innerHTML = '';
    STEPS.forEach(function (s, i) {
      var d = document.createElement('div');
      d.className = 'step-dot' + (completed[s.num] ? ' done' : (i === currentStep ? ' active' : ''));
      d.textContent = s.num;
      d.onclick = function () {
        var card = document.getElementById('card-' + s.num);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      dotsEl.appendChild(d);
    });
  }
}

function loadState() {
  try {
    var state = JSON.parse(localStorage.getItem(CFG.storageKey));
    if (state) {
      currentStep = state.currentStep || 0;
      completed = state.completed || {};
    }
  } catch(e) {}
}

function saveState() {
  try {
    var codes = {};
    STEPS.forEach(function(s) {
      if (editors[s.num]) codes[s.num] = editors[s.num].value;
    });
    localStorage.setItem(CFG.storageKey, JSON.stringify({
      currentStep: currentStep,
      completed: completed,
      codes: codes
    }));
  } catch(e) {}
}

function getSavedCode(num) {
  try {
    var state = JSON.parse(localStorage.getItem(CFG.storageKey));
    return state && state.codes && state.codes[num];
  } catch(e) { return null; }
}

function renderSteps() {
  var panel = document.getElementById('stepsPanel');
  panel.innerHTML = '';
  STEPS.forEach(function(step, i) {
    var card = document.createElement('div');
    card.className = 'cw-step';
    card.id = 'card-' + step.num;
    if (i === currentStep) card.classList.add('active');
    else if (completed[step.num]) card.classList.add('completed');
    else if (i > currentStep && !completed[step.num]) card.classList.add('locked');

    var isDone = !!completed[step.num];
    var isActive = (i === currentStep);

    card.innerHTML =
      '<div class="cw-step-head">' +
        '<span class="cw-step-num">' + step.num + '</span>' +
        '<h3>' + step.title + '</h3>' +
        (step.activity ? '<span class="cw-activity">' + step.activity + '</span>' : '') +
      '</div>' +
      '<p class="cw-goal">' + step.goal + '</p>' +
      (step.checkpoint ? '<p class="cw-checkpoint"><strong>Checkpoint:</strong> ' + step.checkpoint + '</p>' : '') +
      '<ul class="cw-explain">' + step.points.map(function(p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
      '<div class="cw-challenge">' + step.challenge + '</div>' +
      '<textarea class="cw-editor" id="editor-' + step.num + '"' +
        ' aria-label="Code editor for step ' + step.num + '"' +
        ' spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"' +
        ' style="min-height:' + (step.height || 100) + 'px"' +
        (isDone ? ' readonly' : '') +
        (!isActive && !isDone ? ' disabled' : '') +
      '></textarea>' +
      '<div class="cw-actions">' +
        '<button class="cw-btn cw-btn-check' + (isDone ? ' done' : '') + '"' +
          ' onclick="CW.checkStep(' + step.num + ')"' +
          (isDone ? ' disabled' : '') + '>' +
          (isDone ? '✓ Done' : 'Apply to Canvas ▶') +
        '</button>' +
        (isDone ? '' :
          '<button class="cw-btn cw-btn-show" onclick="CW.showSolution(' + step.num + ')">Show Solution</button>' +
          '<button class="cw-btn cw-btn-reset" onclick="CW.resetStep(' + step.num + ')">Reset</button>'
        ) +
      '</div>' +
      '<div class="cw-feedback" id="feedback-' + step.num + '"></div>';

    if (step.fills && (isActive || isDone)) {
      var parts = step.fills.text.split('___');
      var fillHtml = '<div class="cw-fills"><div class="cw-fills-head">✏️ Fill in the Blanks</div><div class="cw-fills-sentence">';
      for (var fi = 0; fi < parts.length; fi++) {
        fillHtml += parts[fi];
        if (fi < step.fills.answers.length) {
          fillHtml += '<input class="cw-fill-blank" id="fill-' + step.num + '-' + fi + '"' +
            ' aria-label="Fill blank ' + (fi + 1) + ' for step ' + step.num + '"' +
            ' data-answer="' + step.fills.answers[fi] + '"' +
            ' placeholder="···"' +
            (isDone ? ' disabled' : '') + '>';
        }
      }
      fillHtml += '</div>';
      if (!isDone) {
        fillHtml += '<div class="cw-fills-actions">' +
          '<button class="cw-btn cw-btn-show" onclick="CW.checkFills(' + step.num + ')">Check Blanks</button>' +
          '<span class="cw-fills-fb" id="fills-fb-' + step.num + '"></span>' +
          '</div>';
      }
      fillHtml += '</div>';
      card.innerHTML += fillHtml;
    }

    if (step.quiz && (isActive || isDone)) {
      var letters = ['A', 'B', 'C', 'D'];
      var qHtml = '<div class="cw-quiz"><div class="cw-quiz-head">❓ Knowledge Check</div>' +
        '<div class="cw-quiz-question">' + step.quiz.question + '</div>' +
        '<div class="cw-quiz-opts" id="quiz-opts-' + step.num + '">';
      step.quiz.options.forEach(function(opt, oi) {
        var cls = 'cw-quiz-opt';
        if (isDone || quizPassed[step.num]) {
          if (oi === step.quiz.correct) cls += ' correct';
          else if (quizSelected[step.num] === oi) cls += ' wrong';
        } else if (quizSelected[step.num] === oi) {
          cls += ' selected';
        }
        qHtml += '<div class="' + cls + '"' +
          (isDone || quizPassed[step.num] ? '' : ' onclick="CW.selectQuiz(' + step.num + ',' + oi + ')"') +
          '><span class="cw-quiz-letter">' + letters[oi] + '</span>' + opt + '</div>';
      });
      qHtml += '</div>';
      if (!isDone && !quizPassed[step.num]) {
        qHtml += '<div class="cw-quiz-actions">' +
          '<button class="cw-btn cw-btn-check" onclick="CW.checkQuiz(' + step.num + ')">Check Answer</button>' +
          '</div>';
      }
      qHtml += '<div class="cw-quiz-fb" id="quiz-fb-' + step.num + '"></div>';
      if (codeValid[step.num] && !quizPassed[step.num] && !isDone) {
        qHtml += '<div class="cw-gate-msg">Code looks good! Answer the quiz to complete this step.</div>';
      }
      qHtml += '</div>';
      card.innerHTML += qHtml;
    }

    panel.appendChild(card);

    var ta = document.getElementById('editor-' + step.num);
    var saved = getSavedCode(step.num);
    if (isDone) {
      ta.value = completed[step.num];
    } else {
      ta.value = saved || step.starter;
    }
    editors[step.num] = ta;

    if (isActive) {
      ta.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateCanvas, 350);
      });
      ta.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          var s = this.selectionStart, end = this.selectionEnd;
          this.value = this.value.substring(0, s) + '  ' + this.value.substring(end);
          this.selectionStart = this.selectionEnd = s + 2;
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(updateCanvas, 350);
        }
      });
    }
  });
}

var BLANK_PLACEHOLDER = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
  'body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#0a0e14;color:#8b96a5;font-family:system-ui,sans-serif;text-align:center;padding:24px}' +
  'strong{color:#ffc078;display:block;font-size:1.05rem;margin-bottom:6px}</style></head><body>' +
  '<div><strong>Fill in the blanks to see your game</strong>' +
  'Replace the ??? with real code, then watch this panel come alive.</div></body></html>';

function hasUnfilled(code) {
  return /\?{2,}/.test(code);
}

function updateCanvas() {
  var step = STEPS[currentStep];
  var code = editors[step.num] ? editors[step.num].value : step.starter;
  var frame = document.getElementById('gameFrame');
  if (hasUnfilled(code)) {
    frame.srcdoc = BLANK_PLACEHOLDER;
  } else {
    var html = TEMPLATES[step.num](code);
    frame.srcdoc = html;
  }
  saveState();

  if (CFG.hints && CFG.hints[currentStep] !== undefined) {
    document.getElementById('canvasHint').textContent = CFG.hints[currentStep];
  }
}

function updateProgress() {
  var count = Object.keys(completed).length;
  var fillEl = document.getElementById('cwProgressFill');
  var textEl = document.getElementById('cwProgressText');
  if (fillEl) fillEl.style.width = (count / STEPS.length * 100) + '%';
  if (textEl) textEl.textContent =
    count === STEPS.length ? 'Complete!' : 'Step ' + (currentStep + 1) + ' / ' + STEPS.length;
  wsSyncProgress();
}

function checkStep(num) {
  if (completed[num]) return;
  var step = STEPS.find(function(s) { return s.num === num; });
  var code = editors[num].value.toLowerCase();
  var missing = step.checks.filter(function(c) { return code.indexOf(c) === -1; });
  var fb = document.getElementById('feedback-' + num);

  if (missing.length === 0) {
    codeValid[num] = true;
    fb.className = 'cw-feedback success';
    if (!step.quiz || quizPassed[num]) {
      fb.textContent = '✓ Step ' + num + ' complete! Your game just leveled up.';
      advanceStep(num);
    } else {
      fb.textContent = '✓ Code is correct! Now answer the Knowledge Check below.';
      renderSteps();
      var quizEl = document.getElementById('quiz-opts-' + num);
      if (quizEl) quizEl.closest('.cw-quiz').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else {
    fb.className = 'cw-feedback error';
    fb.textContent = 'Almost! Make sure your code includes: ' +
      missing.map(function(m) { return '"' + m + '"'; }).join(', ');
  }
}

function advanceStep(num) {
  var firstTime = !completed[num];
  completed[num] = editors[num].value;
  if (currentStep < STEPS.length - 1) currentStep++;
  updateProgress();
  renderSteps();
  updateCanvas();
  if (firstTime) {
    wsAwardXp(wsXpPerStep(), 'Build step ' + num);
    wsSaveShared();
    cwCelebrate(num);
  }
  var next = document.getElementById('card-' + STEPS[currentStep].num);
  if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Celebrations ── */
function cwCelebrate(num) {
  var card = document.getElementById('card-' + num);
  if (card) card.classList.add('cw-just-done');

  var frame = document.querySelector('.cw-canvas-frame');
  if (frame) {
    frame.classList.add('cw-frame-glow');
    setTimeout(function() { frame.classList.remove('cw-frame-glow'); }, 1500);
  }

  cwShowXpPopup(card);
  cwConfetti(card);

  var doneCount = Object.keys(completed).length;
  if (doneCount === STEPS.length) {
    cwMilestone('All Steps Complete!', 'You built the whole game!');
  } else if (doneCount === Math.floor(STEPS.length / 2)) {
    cwMilestone('Halfway There!', doneCount + ' of ' + STEPS.length + ' steps done');
  }
}

function cwShowXpPopup(anchor) {
  var xp = wsXpPerStep();
  var el = document.createElement('div');
  el.className = 'cw-xp-popup';
  el.textContent = '+' + xp + ' XP';
  if (anchor) {
    var r = anchor.getBoundingClientRect();
    el.style.left = (r.left + r.width / 2 - 30) + 'px';
    el.style.top = (r.top - 10) + 'px';
  } else {
    el.style.left = '50%'; el.style.top = '40%';
  }
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 1300);
}

function cwConfetti(anchor) {
  var container = document.createElement('div');
  container.className = 'cw-confetti';
  var colors = ['#ff7700','#ffd166','#4ade80','#60a5fa','#a78bfa','#ff5470','#22d3ee'];
  var r = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
  var cx = r.left + r.width / 2;
  var cy = r.top;
  for (var i = 0; i < 30; i++) {
    var p = document.createElement('div');
    p.className = 'cw-confetti-piece';
    p.style.background = colors[i % colors.length];
    p.style.left = (cx + (Math.random() - .5) * 200) + 'px';
    p.style.top = (cy + (Math.random() - .5) * 40) + 'px';
    p.style.width = (5 + Math.random() * 6) + 'px';
    p.style.height = (5 + Math.random() * 6) + 'px';
    p.style.animationDuration = (1 + Math.random() * .8) + 's';
    p.style.animationDelay = (Math.random() * .15) + 's';
    container.appendChild(p);
  }
  document.body.appendChild(container);
  setTimeout(function() { container.remove(); }, 2200);
}

function cwMilestone(title, sub) {
  var el = document.createElement('div');
  el.className = 'cw-milestone';
  el.innerHTML = '<div class="cw-milestone-icon">' +
    (title.indexOf('All') === 0 ? '🎉' : '🚀') +
    '</div><div class="cw-milestone-text">' + title +
    '</div><div class="cw-milestone-sub">' + sub + '</div>';
  document.body.appendChild(el);
  setTimeout(function() {
    el.style.animation = 'cwMilestoneOut .4s ease forwards';
    setTimeout(function() { el.remove(); }, 500);
  }, 2200);
}

function selectQuiz(num, idx) {
  quizSelected[num] = idx;
  var opts = document.querySelectorAll('#quiz-opts-' + num + ' .cw-quiz-opt');
  opts.forEach(function(el, i) {
    el.className = 'cw-quiz-opt' + (i === idx ? ' selected' : '');
  });
}

function checkQuiz(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  if (quizSelected[num] === undefined) return;
  var fb = document.getElementById('quiz-fb-' + num);
  if (quizSelected[num] === step.quiz.correct) {
    quizPassed[num] = true;
    fb.className = 'cw-quiz-fb pass';
    fb.textContent = '✓ Correct!';
    var opts = document.querySelectorAll('#quiz-opts-' + num + ' .cw-quiz-opt');
    opts.forEach(function(el, i) {
      el.onclick = null;
      el.style.cursor = 'default';
      if (i === step.quiz.correct) el.className = 'cw-quiz-opt correct';
      else if (i === quizSelected[num]) el.className = 'cw-quiz-opt wrong';
      else el.className = 'cw-quiz-opt';
    });
    if (codeValid[num]) {
      var mainFb = document.getElementById('feedback-' + num);
      mainFb.className = 'cw-feedback success';
      mainFb.textContent = '✓ Step ' + num + ' complete! Your game just leveled up.';
      advanceStep(num);
    }
  } else {
    fb.className = 'cw-quiz-fb fail';
    fb.textContent = 'Not quite - try again!';
    var opts = document.querySelectorAll('#quiz-opts-' + num + ' .cw-quiz-opt');
    opts.forEach(function(el, i) {
      if (i === quizSelected[num]) el.className = 'cw-quiz-opt wrong';
    });
  }
}

function checkFills(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  var allCorrect = true;
  step.fills.answers.forEach(function(ans, i) {
    var input = document.getElementById('fill-' + num + '-' + i);
    if (input.value.trim().toLowerCase() === ans.toLowerCase()) {
      input.className = 'cw-fill-blank correct';
    } else {
      input.className = 'cw-fill-blank wrong';
      allCorrect = false;
    }
  });
  var fb = document.getElementById('fills-fb-' + num);
  fb.textContent = allCorrect ? '✓ All correct!' : 'Some blanks need fixing.';
  fb.style.color = allCorrect ? '#4ade80' : '#ff7b93';
}

function showSolution(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  editors[num].value = step.solution;
  updateCanvas();
  var fb = document.getElementById('feedback-' + num);
  fb.className = 'cw-feedback success';
  fb.textContent = 'Solution filled in - study it, then click "Apply to Canvas" when ready.';
}

function resetStep(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  editors[num].value = step.starter;
  updateCanvas();
  var fb = document.getElementById('feedback-' + num);
  fb.className = 'cw-feedback';
  fb.style.display = 'none';
}

function downloadGame() {
  var lastDone = 0;
  STEPS.forEach(function(s) { if (completed[s.num]) lastDone = s.num; });
  var target = lastDone || STEPS[currentStep].num;
  var code = completed[target] || editors[target].value;
  var html = TEMPLATES[target](code);
  var blob = new Blob([html], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = CFG.downloadName || 'my-game.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* Focus iframe on click so keyboard input works */
document.getElementById('canvasPanel').addEventListener('click', function(e) {
  if (e.target.tagName !== 'BUTTON') {
    var f = document.getElementById('gameFrame');
    if (f) f.focus();
  }
});

/* Expose public API for onclick handlers */
window.CW = {
  checkStep: checkStep,
  showSolution: showSolution,
  resetStep: resetStep,
  selectQuiz: selectQuiz,
  checkQuiz: checkQuiz,
  checkFills: checkFills,
  downloadGame: downloadGame
};

/* Init */
loadState();
renderSteps();
updateCanvas();
updateProgress();

})();
