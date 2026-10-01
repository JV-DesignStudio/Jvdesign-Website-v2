/* JVDesignStudio Workshop Interactive Components
   Adds: live-playground, parsons-problem, demo-embed
   Also: extracted TF/order/predict shared implementations
   Requires workshop-engine.js (uses window._wsEngine) OR
   works standalone for inline-engine workshops that define their own XP functions.
*/
(function () {
'use strict';

/* ── ENGINE BRIDGE ── */
var E = window._wsEngine || {};
function eng(prop, fallback) { return E[prop] !== undefined ? E[prop] : fallback; }
function setEng(prop, val) { if (E[prop] !== undefined) E[prop] = val; }

function awardXp(amount, label) {
  if (E.awardXp) E.awardXp(amount, label);
  else if (window.awardXp) window.awardXp(amount, label);
}
function saveProgress() {
  if (E.saveProgress) E.saveProgress();
  else if (window.saveProgress) window.saveProgress();
}
function updateXpDisplay() {
  if (E.updateXpDisplay) E.updateXpDisplay();
  else if (window.updateXpDisplay) window.updateXpDisplay();
}
function getStreak() { return E.streak !== undefined ? E.streak : (window.streak || 0); }
function setStreak(v) { if (E.streak !== undefined) E.streak = v; else window.streak = v; }
function getBestStreak() { return E.bestStreak !== undefined ? E.bestStreak : (window.bestStreak || 0); }
function setBestStreak(v) { if (E.bestStreak !== undefined) E.bestStreak = v; else window.bestStreak = v; }
function getTotalQuizzes() { return E.totalQuizzes !== undefined ? E.totalQuizzes : (window.totalQuizzes || 0); }
function setTotalQuizzes(v) { if (E.totalQuizzes !== undefined) E.totalQuizzes = v; else window.totalQuizzes = v; }
function getCorrectFirst() { return E.correctFirst !== undefined ? E.correctFirst : (window.correctFirst || 0); }
function setCorrectFirst(v) { if (E.correctFirst !== undefined) E.correctFirst = v; else window.correctFirst = v; }
var XP_QUIZ = eng('XP_QUIZ', 15);
var XP_CODE = eng('XP_CODE', 20);
var XP_STREAK_BONUS = eng('XP_STREAK_BONUS', 5);

/* ── ANSWER DECODING (matches workshop-engine.js) ── */
function _dec(el, k) {
  var e = el.dataset[k];
  if (e !== undefined) { try { return decodeURIComponent(atob(e)); } catch (_) { return ''; } }
  return k === 'a' ? (el.dataset.answer || '') : (el.dataset.correct || '');
}
function _key(el) { return parseInt(_dec(el, 'k'), 10); }

/* ── STREAK HELPERS ── */
function streakHit() {
  var s = getStreak() + 1;
  setStreak(s);
  if (s > getBestStreak()) setBestStreak(s);
  setCorrectFirst(getCorrectFirst() + 1);
  setTotalQuizzes(getTotalQuizzes() + 1);
  var bonus = XP_QUIZ, label = '';
  if (s >= 3) bonus += XP_STREAK_BONUS;
  return bonus;
}
function streakMiss() {
  setStreak(0);
  setTotalQuizzes(getTotalQuizzes() + 1);
  updateXpDisplay();
}

/* ══════════════════════════════════════════
   1. LIVE CODE PLAYGROUND
   ══════════════════════════════════════════ */
function initPlaygrounds() {
  document.querySelectorAll('.live-playground').forEach(function (pg) {
    var textarea = pg.querySelector('.lp-code');
    var frame = pg.querySelector('.lp-frame');
    var tpl = pg.querySelector('.lp-starter');
    var starter = tpl ? tpl.innerHTML.trim() : '';
    var storageKey = (window.WORKSHOP_KEY || 'lp') + ':lp:' + pg.id;

    var saved = '';
    try { saved = localStorage.getItem(storageKey) || ''; } catch (_) {}
    textarea.value = saved || starter;

    var debounce = null;
    function render() {
      var code = textarea.value;
      var lang = pg.dataset.lang || 'html';
      var doc = lang === 'html' ? code
        : '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#0d1117;color:#e8eaf2;font-family:monospace;padding:12px}</style></head><body><script>' + code + '<\/script></body></html>';
      frame.srcdoc = doc;
      try { localStorage.setItem(storageKey, code); } catch (_) {}
    }

    textarea.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(render, 500);
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = this.selectionStart, end = this.selectionEnd;
        this.value = this.value.substring(0, s) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = s + 2;
        clearTimeout(debounce);
        debounce = setTimeout(render, 500);
      }
    });

    var resetBtn = pg.querySelector('.lp-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      textarea.value = starter;
      try { localStorage.removeItem(storageKey); } catch (_) {}
      render();
    });

    var copyBtn = pg.querySelector('.lp-copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(textarea.value).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });

    var dlBtn = pg.querySelector('.lp-download-btn');
    if (dlBtn) dlBtn.addEventListener('click', function () {
      var blob = new Blob([textarea.value], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (pg.dataset.filename || 'my-game') + '.html';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    render();
  });
}

window.checkPlayground = function (btn) {
  var pg = btn.closest('.live-playground');
  var checksEl = pg.querySelector('.lp-checks');
  var fb = pg.querySelector('.lp-feedback');
  if (!checksEl) { markPlaygroundDone(pg, fb, btn); return; }
  var checks;
  try { checks = JSON.parse(checksEl.dataset.checks); } catch (_) { markPlaygroundDone(pg, fb, btn); return; }
  var code = pg.querySelector('.lp-code').value.toLowerCase();
  var allPass = checks.every(function (c) {
    if (c.type === 'contains') return code.indexOf(c.value.toLowerCase()) !== -1;
    if (c.type === 'regex') return new RegExp(c.value, 'i').test(code);
    return true;
  });
  if (allPass) {
    markPlaygroundDone(pg, fb, btn);
  } else {
    fb.className = 'lp-feedback wrong show';
    fb.innerHTML = '<span class="fb-icon">❌</span><span>Not quite yet. Check the prompt and try again!</span>';
    streakMiss();
    saveProgress();
    setTimeout(function () { fb.classList.remove('show'); }, 2000);
  }
};

window.skipPlayground = function (btn) {
  var pg = btn.closest('.live-playground');
  pg.classList.add('passed');
  btn.style.display = 'none';
  var checkBtn = pg.querySelector('.lp-check-btn');
  if (checkBtn) checkBtn.style.display = 'none';
  var fb = pg.querySelector('.lp-feedback');
  fb.className = 'lp-feedback correct show';
  fb.innerHTML = '<span class="fb-icon">⏭️</span><span>Skipped. No XP awarded.</span>';
  saveProgress();
};

function markPlaygroundDone(pg, fb, btn) {
  var xpAmount = parseInt(pg.dataset.xp || XP_CODE, 10);
  fb.className = 'lp-feedback correct show';
  fb.innerHTML = '<span class="fb-icon">✅</span><span>Nice work! +' + xpAmount + ' XP</span>';
  pg.classList.add('passed');
  btn.style.display = 'none';
  var skipBtn = pg.querySelector('.lp-skip-btn');
  if (skipBtn) skipBtn.style.display = 'none';
  var bonus = streakHit();
  awardXp(xpAmount, 'Code Playground');
  saveProgress();
}

/* ══════════════════════════════════════════
   2. PARSONS PROBLEMS (drag-and-sort code)
   ══════════════════════════════════════════ */
function initParsons() {
  document.querySelectorAll('.parsons-problem').forEach(function (pp) {
    var source = pp.querySelector('.pp-source');
    var target = pp.querySelector('.pp-target');
    if (!source || !target) return;

    var lines = [].slice.call(source.querySelectorAll('.pp-line'));
    shuffle(lines);
    lines.forEach(function (l) { source.appendChild(l); });

    lines.forEach(function (line) {
      line.setAttribute('draggable', 'true');
      line.setAttribute('role', 'listitem');
      line.setAttribute('tabindex', '0');

      line.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', '');
        line.classList.add('pp-dragging');
      });
      line.addEventListener('dragend', function () {
        line.classList.remove('pp-dragging');
        document.querySelectorAll('.pp-drag-over').forEach(function (el) { el.classList.remove('pp-drag-over'); });
      });

      line.addEventListener('click', function () {
        if (pp.classList.contains('passed')) return;
        if (line.parentElement === source) {
          target.appendChild(line);
        } else {
          source.appendChild(line);
        }
      });

      initTouch(line, source, target);
    });

    [source, target].forEach(function (zone) {
      zone.setAttribute('role', 'list');
      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        zone.classList.add('pp-drag-over');
        var dragging = pp.querySelector('.pp-dragging');
        if (!dragging) return;
        var after = getDragAfter(zone, e.clientY);
        if (after) zone.insertBefore(dragging, after);
        else zone.appendChild(dragging);
      });
      zone.addEventListener('dragleave', function () { zone.classList.remove('pp-drag-over'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('pp-drag-over');
      });
    });
  });
}

function getDragAfter(zone, y) {
  var els = [].slice.call(zone.querySelectorAll('.pp-line:not(.pp-dragging)'));
  var result = null, closest = Number.POSITIVE_INFINITY;
  els.forEach(function (el) {
    var box = el.getBoundingClientRect();
    var offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > -closest) { closest = -offset; result = el; }
  });
  return result;
}

function initTouch(line, source, target) {
  var startY = 0, startX = 0, clone = null, originParent = null;
  line.addEventListener('touchstart', function (e) {
    if (line.closest('.parsons-problem').classList.contains('passed')) return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    originParent = line.parentElement;
    clone = line.cloneNode(true);
    clone.classList.add('pp-touch-ghost');
    clone.style.position = 'fixed';
    clone.style.width = line.offsetWidth + 'px';
    clone.style.zIndex = '9999';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);
  }, { passive: true });

  line.addEventListener('touchmove', function (e) {
    if (!clone) return;
    e.preventDefault();
    var t = e.touches[0];
    clone.style.left = (t.clientX - clone.offsetWidth / 2) + 'px';
    clone.style.top = (t.clientY - 20) + 'px';
  }, { passive: false });

  line.addEventListener('touchend', function (e) {
    if (!clone) return;
    clone.remove();
    clone = null;
    var t = e.changedTouches[0];
    var pp = line.closest('.parsons-problem');
    var src = pp.querySelector('.pp-source');
    var tgt = pp.querySelector('.pp-target');
    var tgtRect = tgt.getBoundingClientRect();
    var srcRect = src.getBoundingClientRect();
    if (t.clientX >= tgtRect.left && t.clientX <= tgtRect.right && t.clientY >= tgtRect.top && t.clientY <= tgtRect.bottom) {
      var after = getDragAfter(tgt, t.clientY);
      if (after) tgt.insertBefore(line, after); else tgt.appendChild(line);
    } else if (t.clientX >= srcRect.left && t.clientX <= srcRect.right && t.clientY >= srcRect.top && t.clientY <= srcRect.bottom) {
      src.appendChild(line);
    } else if (originParent === src) {
      tgt.appendChild(line);
    } else {
      src.appendChild(line);
    }
  });
}

window.checkParsons = function (btn) {
  var pp = btn.closest('.parsons-problem');
  var target = pp.querySelector('.pp-target');
  var fb = pp.querySelector('.pp-feedback');
  var lines = [].slice.call(target.querySelectorAll('.pp-line'));
  var source = pp.querySelector('.pp-source');
  var sourceLines = [].slice.call(source.querySelectorAll('.pp-line'));

  if (lines.length === 0) {
    fb.className = 'pp-feedback wrong show';
    fb.innerHTML = '<span class="fb-icon">⚠️</span><span>Drag code blocks into the answer area first!</span>';
    return;
  }

  var distractorsInTarget = lines.filter(function (l) { return _dec(l, 'pos') === '0'; });
  if (distractorsInTarget.length > 0) {
    fb.className = 'pp-feedback wrong show';
    fb.innerHTML = '<span class="fb-icon">❌</span><span>One or more lines do not belong. Remove them and try again!</span>';
    streakMiss(); saveProgress();
    distractorsInTarget.forEach(function (l) { l.classList.add('pp-wrong'); });
    setTimeout(function () { distractorsInTarget.forEach(function (l) { l.classList.remove('pp-wrong'); }); fb.classList.remove('show'); }, 2500);
    return;
  }

  var expected = lines.map(function (l) { return parseInt(_dec(l, 'pos'), 10); });
  var allCorrect = expected.length > 0 && sourceLines.filter(function (l) { return _dec(l, 'pos') !== '0'; }).length === 0;
  for (var i = 0; i < expected.length; i++) {
    if (expected[i] !== i + 1) { allCorrect = false; break; }
  }

  if (allCorrect) {
    var xpAmount = parseInt(pp.dataset.xp || XP_CODE, 10);
    fb.className = 'pp-feedback correct show';
    fb.innerHTML = '<span class="fb-icon">✅</span><span>Perfect order! +' + xpAmount + ' XP</span>';
    pp.classList.add('passed');
    btn.disabled = true;
    var resetBtn = pp.querySelector('.pp-reset-btn');
    if (resetBtn) resetBtn.style.display = 'none';
    lines.forEach(function (l) { l.classList.add('pp-correct'); l.removeAttribute('draggable'); });
    streakHit();
    awardXp(xpAmount, 'Code Order');
  } else {
    fb.className = 'pp-feedback wrong show';
    fb.innerHTML = '<span class="fb-icon">❌</span><span>Not quite right. Try rearranging the blocks!</span>';
    lines.forEach(function (l, i) {
      if (parseInt(_dec(l, 'pos'), 10) === i + 1) l.classList.add('pp-correct');
      else l.classList.add('pp-wrong');
    });
    streakMiss();
    setTimeout(function () {
      lines.forEach(function (l) { l.classList.remove('pp-correct', 'pp-wrong'); });
      fb.classList.remove('show');
    }, 2500);
  }
  saveProgress();
};

window.resetParsons = function (btn) {
  var pp = btn.closest('.parsons-problem');
  if (pp.classList.contains('passed')) return;
  var source = pp.querySelector('.pp-source');
  var target = pp.querySelector('.pp-target');
  var lines = [].slice.call(target.querySelectorAll('.pp-line'));
  lines.forEach(function (l) {
    l.classList.remove('pp-correct', 'pp-wrong');
    source.appendChild(l);
  });
  shuffle([].slice.call(source.querySelectorAll('.pp-line'))).forEach(function (l) { source.appendChild(l); });
  var fb = pp.querySelector('.pp-feedback');
  fb.className = 'pp-feedback';
  fb.innerHTML = '';
};

/* ══════════════════════════════════════════
   3. DEMO EMBED (play the finished game)
   ══════════════════════════════════════════ */
function initDemoEmbeds() {
  document.querySelectorAll('.demo-embed').forEach(function (de) {
    var stage = de.querySelector('.de-stage');
    if (!stage) return;
    var btn = stage.querySelector('.de-play-btn');
    if (btn) btn.addEventListener('click', function () { lazyLoadIframe(stage, 'de'); });
  });
}

/* ══════════════════════════════════════════
   SHARED: lazy iframe loader
   ══════════════════════════════════════════ */
function lazyLoadIframe(stage, prefix) {
  var src = stage.dataset.src;
  if (!src) return;
  var aspect = stage.dataset.aspect || '16/10';
  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = stage.dataset.title || 'Embedded content';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:12px;';
  var ph = stage.querySelector('.' + prefix + '-placeholder');
  if (ph) ph.replaceWith(iframe);
  stage.style.aspectRatio = aspect;
  stage.style.minHeight = '360px';

  var replayBtn = document.createElement('button');
  replayBtn.className = prefix + '-replay-btn';
  replayBtn.textContent = '🔄 Replay';
  replayBtn.style.cssText = 'margin-top:8px;';
  replayBtn.addEventListener('click', function () { iframe.src = src; });
  stage.insertAdjacentElement('afterend', replayBtn);
}

/* ══════════════════════════════════════════
   UTILITY
   ══════════════════════════════════════════ */
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

/* ══════════════════════════════════════════
   PERSISTENCE: patch saveProgress for new types
   ══════════════════════════════════════════ */
var origSave = E.saveProgress;
if (origSave) {
  E.saveProgress = function () {
    origSave();
    try {
      var key = window.WORKSHOP_KEY;
      if (!key) return;
      var data = JSON.parse(localStorage.getItem(key) || '{}');
      data.playgroundsPassed = [].slice.call(document.querySelectorAll('.live-playground.passed')).map(function (el) { return el.id; });
      data.parsonsPassed = [].slice.call(document.querySelectorAll('.parsons-problem.passed')).map(function (el) { return el.id; });
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  };
}

/* ══════════════════════════════════════════
   LOAD PERSISTED STATE for new types
   ══════════════════════════════════════════ */
function loadInteractiveState() {
  try {
    var key = window.WORKSHOP_KEY;
    if (!key) return;
    var data = JSON.parse(localStorage.getItem(key) || 'null');
    if (!data) return;
    (data.playgroundsPassed || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.add('passed');
        var cb = el.querySelector('.lp-check-btn'); if (cb) cb.style.display = 'none';
        var sb = el.querySelector('.lp-skip-btn'); if (sb) sb.style.display = 'none';
      }
    });
    (data.parsonsPassed || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.add('passed');
        var cb = el.querySelector('.pp-check-btn'); if (cb) cb.disabled = true;
        var rb = el.querySelector('.pp-reset-btn'); if (rb) rb.style.display = 'none';
        el.querySelectorAll('.pp-line').forEach(function (l) { l.removeAttribute('draggable'); l.classList.add('pp-correct'); });
      }
    });
  } catch (_) {}
}

/* ── INIT ── */
initPlaygrounds();
initParsons();
initDemoEmbeds();
loadInteractiveState();
})();
