const STORAGE_KEY = 'jvds-godot-gdscript-v2';
const TOTAL_STEPS = 6;
let currentState = {steps: {}, xp: 0, level: 1, streak: 0};

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) currentState = JSON.parse(saved);
  updateUI();
}

function saveProgress() {
  /* completed/total lets my-progress.html show this workshop's status */
  const done = Object.keys(currentState.steps).filter(k => currentState.steps[k]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, currentState, {completed: done, total: TOTAL_STEPS})));
}

function completeStep(n) {
  if (!currentState.steps[n]) {
    currentState.steps[n] = true;
    currentState.xp += 100;
    if (currentState.xp >= 100 * currentState.level) {
      currentState.level++;
      showLevelUp();
    }
  }
  updateUI();
  saveProgress();
  if (n < TOTAL_STEPS) {
    setTimeout(() => toggleStep(document.querySelector(`#step-${n+1} .step-header`)), 300);
  } else {
    document.getElementById('finishBanner').classList.add('show');
  }
}

function updateUI() {
  const completed = Object.keys(currentState.steps).length;
  document.getElementById('progressCount').textContent = `${completed} / ${TOTAL_STEPS} steps`;
  document.getElementById('xpLabel').textContent = `${currentState.xp % (100 * currentState.level)} / ${100 * currentState.level} XP`;
  document.getElementById('xpLevel').textContent = `Level ${currentState.level}`;
  document.getElementById('xpFill').style.width = (completed / TOTAL_STEPS * 100) + '%';
  document.getElementById('streakCount').textContent = currentState.streak;
  document.getElementById('finalXP').textContent = currentState.xp;
  document.getElementById('finalLevel').textContent = currentState.level;

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.querySelector(`.step-dot:nth-child(${i})`);
    if (!dot) {
      const d = document.createElement('div');
      d.className = `step-dot ${currentState.steps[i] ? 'done' : 'active'}`;
      d.textContent = i;
      d.onclick = () => toggleStep(document.querySelector(`#step-${i} .step-header`));
      document.getElementById('stepDots').appendChild(d);
    } else {
      dot.className = `step-dot ${currentState.steps[i] ? 'done' : i === completed + 1 ? 'active' : ''}`;
    }
  }

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const card = document.getElementById(`step-${i}`);
    if (i <= completed + 1) {
      card.classList.remove('locked');
      if (i === completed + 1) card.classList.add('active-step', 'open');
    } else {
      card.classList.add('locked');
    }
  }
}

function toggleStep(el) {
  const card = el.closest('.step-card');
  card.classList.toggle('open');
}

function selectQuizOpt(el) {
  el.parentElement.querySelectorAll('.quiz-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function checkQuiz(btn) {
  const gate = btn.closest('.quiz-gate');
  const correct = parseInt(gate.dataset.correct);
  const selected = gate.querySelector('.quiz-opt.selected');
  if (!selected) return alert('Pick an answer!');
  const idx = parseInt(selected.dataset.idx);
  const feedback = gate.querySelector('.quiz-feedback');
  if (idx === correct) {
    feedback.classList.add('show', 'correct');
    feedback.innerHTML = '<div class="fb-icon">✅</div><div>Correct! Well done.</div>';
    gate.querySelectorAll('.quiz-opt').forEach(o => o.classList.add('disabled'));
    btn.style.display = 'none';
    gate.querySelector('.quiz-next-btn').classList.add('show');
  } else {
    feedback.classList.add('show', 'wrong');
    feedback.innerHTML = '<div class="fb-icon">❌</div><div>Not quite. Try again!</div>';
  }
}

function checkCodeChallenge(btn) {
  const challenge = btn.closest('.code-challenge');
  const blanks = challenge.querySelectorAll('.cc-blank');
  let allCorrect = true;
  blanks.forEach(b => {
    const ans = b.dataset.answer.toLowerCase().trim();
    const val = b.value.toLowerCase().trim();
    if (val === ans) {
      b.classList.add('correct');
      b.classList.remove('wrong');
    } else {
      b.classList.add('wrong');
      b.classList.remove('correct');
      allCorrect = false;
    }
  });
  const fb = challenge.querySelector('.cc-feedback');
  if (allCorrect) {
    fb.classList.add('show', 'correct');
    fb.innerHTML = '<div class="fb-icon">✅</div><div>Perfect code!</div>';
    challenge.querySelector('.cc-hint').classList.add('show');
  } else {
    fb.classList.add('show', 'wrong');
    fb.innerHTML = '<div class="fb-icon">❌</div><div>Check your answers.</div>';
  }
}

function checkConceptFill(btn) {
  const challenge = btn.closest('.concept-fill');
  const blanks = challenge.querySelectorAll('.cf-blank');
  let allCorrect = true;
  blanks.forEach(b => {
    const ans = b.dataset.answer;
    const val = b.value;
    if (val === ans) {
      b.classList.add('correct');
      b.classList.remove('wrong');
    } else {
      b.classList.add('wrong');
      b.classList.remove('correct');
      allCorrect = false;
    }
  });
  const fb = challenge.querySelector('.cf-feedback');
  if (allCorrect) {
    fb.classList.add('show', 'correct');
    fb.innerHTML = '<div class="fb-icon">✅</div><div>Great!</div>';
  } else {
    fb.classList.add('show', 'wrong');
    fb.innerHTML = '<div class="fb-icon">❌</div><div>Try again!</div>';
  }
}

function pickTF(btn, ans) {
  const item = btn.closest('.tf-item');
  item.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function checkTF(btn) {
  const round = btn.closest('.tf-round');
  const items = round.querySelectorAll('.tf-item');
  let allCorrect = true;
  items.forEach(item => {
    const correct = item.dataset.answer;
    const selected = item.querySelector('.tf-btn.selected');
    if (!selected) allCorrect = false;
    else if (selected.textContent.toLowerCase() === correct) {
      item.classList.add('answered');
      item.querySelector('.tf-btn.selected').classList.add('correct-answer');
    } else {
      item.classList.add('answered');
      item.querySelector('.tf-btn.selected').classList.add('wrong-answer');
      allCorrect = false;
    }
  });
  const fb = round.querySelector('.tf-feedback');
  if (allCorrect) {
    fb.classList.add('show', 'correct');
    fb.innerHTML = '<div class="fb-icon">✅</div><div>All correct!</div>';
  } else {
    fb.classList.add('show', 'wrong');
    fb.innerHTML = '<div class="fb-icon">❌</div><div>Check your answers.</div>';
  }
}

function showLevelUp() {
  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = `<div class="levelup-card"><div class="lvl-icon">⭐</div><div class="lvl-title">Level ${currentState.level}</div><div class="lvl-sub">You're leveling up!</div><button data-remove-closest=".levelup-overlay">Awesome!</button></div>`;
  document.body.appendChild(overlay);
}

loadProgress();
(function(){try{var n=Object.keys(currentState.steps).length,pc=document.getElementById("progressCount"),pf=document.getElementById("progressFill");if(pc)pc.textContent=n+" / "+TOTAL_STEPS+" steps";if(pf)pf.style.width=(n/TOTAL_STEPS*100)+"%";}catch(e){}})();
