/* workshop-quiz-lite.js
   Lightweight quiz checks for workshop pages that use their own progress script
   instead of workshop-engine.js (currently the Minecraft Fabric mod series).
   Uses data-correct (zero-based index) on .quiz-gate; styling comes from style-workshop.css. */
(function () {
  'use strict';

  window.selectQuizOpt = function (el) {
    var gate = el.closest('.quiz-gate');
    if (!gate || gate.classList.contains('passed')) return;
    gate.querySelectorAll('.quiz-opt').forEach(function (o) { o.classList.remove('selected'); });
    el.classList.add('selected');
    var submit = gate.querySelector('.quiz-submit');
    if (submit) submit.classList.add('show');
  };

  window.checkQuiz = function (btn) {
    var gate = btn.closest('.quiz-gate');
    if (!gate) return;
    var selected = gate.querySelector('.quiz-opt.selected');
    if (!selected) return;
    var correct = parseInt(gate.getAttribute('data-correct'), 10);
    var chosen = parseInt(selected.getAttribute('data-idx'), 10);
    var fb = gate.querySelector('.quiz-feedback');

    if (chosen === correct) {
      selected.classList.add('correct');
      if (fb) { fb.className = 'quiz-feedback correct show'; fb.innerHTML = '<span class="fb-icon">✅</span><span>Correct! Great job.</span>'; }
      gate.classList.add('passed');
      btn.style.display = 'none';
      var next = gate.querySelector('.quiz-next-btn');
      if (next) next.classList.add('show');
      gate.querySelectorAll('.quiz-opt').forEach(function (o) { if (!o.classList.contains('correct')) o.classList.add('disabled'); });
    } else {
      selected.classList.add('wrong');
      if (fb) { fb.className = 'quiz-feedback wrong show'; fb.innerHTML = '<span class="fb-icon">❌</span><span>Not quite, try again!</span>'; }
      setTimeout(function () {
        selected.classList.remove('wrong', 'selected');
        if (fb) fb.classList.remove('show');
      }, 1500);
    }
  };
})();
