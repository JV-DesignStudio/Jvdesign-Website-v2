/* cyber-security.js
   Page-specific upgrades for the Cyber Defender workshop:
   - a slide-in "Lumo's Notebook" for per-step note taking that saves as you type,
     downloads your notes, and clears them
   - a "Spot the Phish" mini activity
   - a "defender rank" shown when the workshop is finished
   Loaded after workshop-engine.js so it can replace the engine's tiny note button. */
(function () {
  'use strict';

  var KEY = (window.WORKSHOP_KEY || 'jvds-cyber-security-v2');
  var notesKey = KEY + '_notes';

  function cards() { return Array.prototype.slice.call(document.querySelectorAll('.step-card')); }
  function stepNum(card) { return (card.id || '').replace('step-', ''); }
  function stepTitle(card) { var t = card.querySelector('.step-title'); return t ? t.textContent.trim() : card.id; }

  function readNotes() { try { return JSON.parse(localStorage.getItem(notesKey) || '{}') || {}; } catch (e) { return {}; } }
  function writeNotes(o) { try { localStorage.setItem(notesKey, JSON.stringify(o)); } catch (e) {} }

  /* ---------- LUMO'S NOTEBOOK ---------- */
  function buildNotes() {
    var saved = readNotes();
    var panel = document.createElement('section');
    panel.className = 'cyber-notes-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'My workshop notes');

    var head = document.createElement('div');
    head.className = 'cyber-notes-head';
    head.innerHTML = '<span class="cyber-notes-title">\uD83D\uDCD3 Lumo\'s Notebook</span>';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cyber-notes-close';
    closeBtn.setAttribute('aria-label', 'Close notes');
    closeBtn.textContent = '\u2715';
    head.appendChild(closeBtn);

    var hint = document.createElement('p');
    hint.className = 'cyber-notes-hint';
    hint.textContent = 'Write the key points in your own words. Your notes stay on this device and save by themselves.';

    var list = document.createElement('div');
    list.className = 'cyber-notes-list';

    var foot = document.createElement('div');
    foot.className = 'cyber-notes-foot';
    var status = document.createElement('span');
    status.className = 'cyber-notes-status';
    status.setAttribute('aria-live', 'polite');
    var dlBtn = document.createElement('button');
    dlBtn.type = 'button'; dlBtn.className = 'cyber-notes-download'; dlBtn.textContent = '\u2B07 Download';
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button'; clearBtn.className = 'cyber-notes-clear'; clearBtn.textContent = 'Clear';
    foot.appendChild(status); foot.appendChild(dlBtn); foot.appendChild(clearBtn);

    panel.appendChild(head); panel.appendChild(hint); panel.appendChild(list); panel.appendChild(foot);

    var backdrop = document.createElement('div');
    backdrop.className = 'cyber-notes-backdrop';

    var rows = {};
    cards().forEach(function (card) {
      var num = stepNum(card);
      var row = document.createElement('div');
      row.className = 'cyber-note-row';
      var label = document.createElement('label');
      label.className = 'cyber-note-label';
      label.setAttribute('for', 'cyber-note-' + num);
      label.textContent = 'Step ' + num + ' \u00B7 ' + stepTitle(card);
      var ta = document.createElement('textarea');
      ta.className = 'cyber-note-input';
      ta.id = 'cyber-note-' + num;
      ta.rows = 3;
      ta.placeholder = 'What does this mean, or an example to remember...';
      ta.value = saved[num] || '';
      ta.addEventListener('input', function () {
        saved[num] = ta.value;
        writeNotes(saved);
        updateCount();
        flash('Saved');
      });
      row.appendChild(label); row.appendChild(ta);
      list.appendChild(row);
      rows[num] = row;
    });

    // trigger button, lives in the progress panel so it is always easy to find
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cyber-notes-btn';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.innerHTML = '<span aria-hidden="true">\uD83D\uDCDD</span> My notes <span class="cyber-notes-count">0</span>';
    var host = document.querySelector('.progress-wrap') || document.querySelector('.xp-wrap') || document.body;
    host.appendChild(trigger);

    function count() { return Object.keys(saved).filter(function (k) { return String(saved[k] || '').trim().length; }).length; }
    function updateCount() { trigger.querySelector('.cyber-notes-count').textContent = String(count()); }

    var flashTimer = null;
    function flash(text) {
      status.textContent = text;
      status.classList.add('show');
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { status.classList.remove('show'); }, 1400);
    }

    function openTo(num) {
      panel.classList.add('open');
      backdrop.classList.add('open');
      document.body.classList.add('cyber-notes-open');
      var target = num && rows[num] ? rows[num] : panel.querySelector('.cyber-note-input');
      if (target) {
        if (target.tagName === 'DIV' && target.scrollIntoView) target.scrollIntoView({ block: 'center' });
        var input = target.tagName === 'TEXTAREA' ? target : target.querySelector('.cyber-note-input');
        if (input) input.focus();
      }
    }
    function close() {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.classList.remove('cyber-notes-open');
      trigger.focus();
    }

    trigger.addEventListener('click', function () { openTo(); });
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });

    dlBtn.addEventListener('click', function () {
      var lines = ['Cyber Defender: my notes', '==========================', ''];
      cards().forEach(function (card) {
        var num = stepNum(card);
        lines.push('Step ' + num + ': ' + stepTitle(card));
        var txt = String(saved[num] || '').trim();
        lines.push(txt || '(no note yet)');
        lines.push('');
      });
      try {
        var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'cyber-defender-notes.txt';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        flash('Downloaded');
      } catch (e) { flash('Download failed'); }
    });

    clearBtn.addEventListener('click', function () {
      if (!window.confirm('Clear all of your notes for this workshop?')) return;
      saved = {};
      writeNotes(saved);
      panel.querySelectorAll('.cyber-note-input').forEach(function (t) { t.value = ''; });
      updateCount();
      flash('Cleared');
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    // small note button on each step header that opens the notebook at that step
    cards().forEach(function (card) {
      var header = card.querySelector('.step-header');
      if (!header || header.querySelector('.cyber-step-note-btn')) return;
      var num = stepNum(card);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cyber-step-note-btn';
      b.setAttribute('aria-label', 'Open my notes for step ' + num);
      b.title = 'My notes for this step';
      b.textContent = '\uD83D\uDCDD';
      b.addEventListener('click', function (e) { e.stopPropagation(); openTo(num); });
      header.appendChild(b);
    });

    updateCount();
  }

  /* ---------- SPOT THE PHISH ---------- */
  function initPhish() {
    var game = document.getElementById('phish-game');
    if (!game) return;
    var lines = Array.prototype.slice.call(game.querySelectorAll('.phish-line'));
    var check = game.querySelector('.phish-check');
    var fb = game.querySelector('.phish-feedback');

    lines.forEach(function (l) {
      l.setAttribute('tabindex', '0');
      l.setAttribute('role', 'button');
      function toggle() { l.classList.toggle('picked'); }
      l.addEventListener('click', toggle);
      l.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    check.addEventListener('click', function () {
      var problems = 0;
      lines.forEach(function (l) {
        var flag = l.getAttribute('data-flag') === '1';
        var picked = l.classList.contains('picked');
        l.classList.remove('right', 'missed');
        if (picked && flag) l.classList.add('right');
        else if (picked && !flag) { l.classList.add('missed'); problems++; }
        else if (!picked && flag) problems++;
      });
      if (problems === 0) {
        fb.className = 'phish-feedback show good';
        fb.textContent = 'Perfect. You spotted every red flag: a look-alike sender domain, an urgent threat, and a link to an odd address.';
      } else {
        fb.className = 'phish-feedback show bad';
        fb.textContent = 'Not quite. Check the sender address, the urgent threat, the link, and any request for personal details. Then try again.';
      }
    });
  }

  /* ---------- TAP ALL THAT APPLY ---------- */
  function initPicks() {
    document.querySelectorAll('.cyber-pick').forEach(function (g) {
      var items = Array.prototype.slice.call(g.querySelectorAll('.cyber-pick-item'));
      var check = g.querySelector('.cyber-check');
      var fb = g.querySelector('.cyber-feedback');
      var correct = (g.getAttribute('data-correct') || '').split(',').map(function (s) { return parseInt(s, 10); });
      items.forEach(function (it) {
        it.addEventListener('click', function () { it.classList.toggle('picked'); });
      });
      check.addEventListener('click', function () {
        var problems = 0;
        items.forEach(function (it, i) {
          it.classList.remove('right', 'missed');
          var want = correct.indexOf(i) !== -1;
          var got = it.classList.contains('picked');
          if (want && got) it.classList.add('right');
          else if (!want && got) { it.classList.add('missed'); problems++; }
          else if (want && !got) problems++;
        });
        if (problems === 0) {
          fb.className = 'cyber-feedback show good';
          fb.textContent = 'Spot on! You picked exactly the right ones.';
        } else {
          fb.className = 'cyber-feedback show bad';
          fb.textContent = 'Not quite. The highlighted rows show where to look again.';
        }
      });
    });
  }

  /* ---------- FLIP CARDS ---------- */
  function initFlips() {
    document.querySelectorAll('.cyber-flip').forEach(function (c) {
      c.setAttribute('aria-pressed', 'false');
      c.addEventListener('click', function () {
        var on = c.classList.toggle('flipped');
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  }

  /* ---------- TRUE OR FALSE ---------- */
  function initTF() {
    document.querySelectorAll('.cyber-tf').forEach(function (g) {
      var items = Array.prototype.slice.call(g.querySelectorAll('.cyber-tf-item'));
      var check = g.querySelector('.cyber-check');
      var fb = g.querySelector('.cyber-feedback');
      items.forEach(function (it) {
        it.querySelectorAll('.cyber-tf-btns button').forEach(function (b) {
          b.addEventListener('click', function () {
            it.querySelectorAll('.cyber-tf-btns button').forEach(function (x) { x.classList.remove('sel'); });
            b.classList.add('sel');
            it.setAttribute('data-picked', b.getAttribute('data-val'));
          });
        });
      });
      check.addEventListener('click', function () {
        var problems = 0;
        items.forEach(function (it) {
          it.classList.remove('right', 'missed');
          var ans = it.getAttribute('data-answer');
          var picked = it.getAttribute('data-picked');
          if (!picked) { problems++; it.classList.add('missed'); }
          else if (picked === ans) it.classList.add('right');
          else { problems++; it.classList.add('missed'); }
        });
        if (problems === 0) {
          fb.className = 'cyber-feedback show good';
          fb.textContent = 'All correct!';
        } else {
          fb.className = 'cyber-feedback show bad';
          fb.textContent = 'Some are not right yet. Think about why, then check again.';
        }
      });
    });
  }

  /* ---------- MATCH THE PAIRS ---------- */
  function initMatch() {
    document.querySelectorAll('.cyber-match').forEach(function (g) {
      var items = Array.prototype.slice.call(g.querySelectorAll('.cyber-match-item'));
      var fb = g.querySelector('.cyber-feedback');
      var selected = null;
      items.forEach(function (it) {
        it.addEventListener('click', function () {
          if (it.classList.contains('matched')) return;
          if (!selected) { selected = it; it.classList.add('sel'); return; }
          if (selected === it) { it.classList.remove('sel'); selected = null; return; }
          if (selected.parentNode === it.parentNode) {
            selected.classList.remove('sel'); selected = it; it.classList.add('sel'); return;
          }
          if (selected.getAttribute('data-pair') === it.getAttribute('data-pair')) {
            selected.classList.remove('sel');
            selected.classList.add('matched');
            it.classList.add('matched');
            selected = null;
            if (g.querySelectorAll('.cyber-match-item:not(.matched)').length === 0) {
              fb.className = 'cyber-feedback show good';
              fb.textContent = 'All matched! Nice work.';
            }
          } else {
            var s = selected; selected = null;
            s.classList.remove('sel');
            s.classList.add('wrong'); it.classList.add('wrong');
            setTimeout(function () { s.classList.remove('wrong'); it.classList.remove('wrong'); }, 700);
          }
        });
      });
    });
  }

  /* ---------- PUT IN ORDER ---------- */
  function initOrder() {
    document.querySelectorAll('.cyber-order').forEach(function (g) {
      var items = Array.prototype.slice.call(g.querySelectorAll('.cyber-order-item'));
      var fb = g.querySelector('.cyber-feedback');
      var reset = g.querySelector('.cyber-order-reset');
      var picked = [];
      function refresh() {
        items.forEach(function (it) {
          var idx = picked.indexOf(it);
          it.classList.toggle('picked', idx !== -1);
          var num = it.querySelector('.cyber-order-num');
          if (!num) { num = document.createElement('span'); num.className = 'cyber-order-num'; it.insertBefore(num, it.firstChild); }
          num.textContent = idx === -1 ? '' : String(idx + 1);
        });
        if (picked.length === items.length) {
          var correct = picked.every(function (it, i) { return parseInt(it.getAttribute('data-pos'), 10) === i + 1; });
          fb.className = 'cyber-feedback show ' + (correct ? 'good' : 'bad');
          fb.textContent = correct ? 'Perfect order! That is exactly how the attack unfolded.' : 'Not quite. Press Reset and try again.';
        }
      }
      items.forEach(function (it) {
        it.addEventListener('click', function () {
          if (picked.indexOf(it) !== -1 || picked.length === items.length) return;
          picked.push(it);
          fb.className = 'cyber-feedback';
          refresh();
        });
      });
      if (reset) reset.addEventListener('click', function () {
        picked = [];
        fb.className = 'cyber-feedback';
        refresh();
      });
    });
  }

  /* ---------- PASSWORD STRENGTH ---------- */
  function initPassword() {
    document.querySelectorAll('.cyber-password').forEach(function (g) {
      var input = g.querySelector('.cyber-pw-input');
      var fill = g.querySelector('.cyber-pw-fill');
      var label = g.querySelector('.cyber-pw-label');
      if (!input) return;
      function tip(id, ok) { var el = g.querySelector('.cyber-pw-tip[data-tip="' + id + '"]'); if (el) el.classList.toggle('ok', ok); }
      function update() {
        var v = input.value;
        var s = 0;
        if (v.length >= 12) s++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
        if (/[0-9]/.test(v)) s++;
        if (/[^A-Za-z0-9]/.test(v)) s++;
        if (!v) s = 0;
        fill.style.width = (v ? Math.max(12, s * 25) : 0) + '%';
        fill.setAttribute('data-level', String(s));
        label.textContent = v ? ['', 'Weak', 'Fair', 'Good', 'Strong'][s] : '';
        tip('len', v.length >= 12);
        tip('case', /[A-Z]/.test(v) && /[a-z]/.test(v));
        tip('num', /[0-9]/.test(v));
        tip('sym', /[^A-Za-z0-9]/.test(v));
      }
      input.addEventListener('input', update);
      update();
    });
  }

  /* ---------- DEFENDER RANK ON FINISH ---------- */
  function initRank() {
    var banner = document.getElementById('finishBanner');
    if (!banner) return;
    function apply() {
      if (!banner.classList.contains('show') || banner.querySelector('.cyber-rank')) return;
      var acc = 0;
      try {
        var d = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (d && d.totalQuizzes) acc = d.correctFirst / d.totalQuizzes;
      } catch (e) {}
      var rank = acc >= 0.9 ? 'Elite Cyber Guardian' : acc >= 0.7 ? 'Cyber Defender' : acc >= 0.5 ? 'Junior Cyber Analyst' : 'Rookie Recruit';
      var icon = acc >= 0.9 ? '\uD83C\uDFC6' : acc >= 0.7 ? '\uD83D\uDEE1\uFE0F' : acc >= 0.5 ? '\uD83D\uDD0D' : '\uD83C\uDF31';
      var el = document.createElement('div');
      el.className = 'cyber-rank';
      el.innerHTML = '<span class="cyber-rank-icon" aria-hidden="true">' + icon + '</span><span class="cyber-rank-label">Your rank</span><span class="cyber-rank-name">' + rank + '</span>';
      var stats = banner.querySelector('.final-stats');
      if (stats && stats.parentNode) stats.parentNode.insertBefore(el, stats.nextSibling);
      else banner.appendChild(el);
    }
    observer = new MutationObserver(apply);
    observer.observe(banner, { attributes: true, attributeFilter: ['class'] });
    setTimeout(apply, 600);
  }
  var observer = null;

  function init() {
    // replace the engine's basic per-step note button with the notebook
    document.querySelectorAll('.ws-note-btn').forEach(function (b) { b.remove(); });
    document.querySelectorAll('.ws-note-area').forEach(function (a) { a.remove(); });
    buildNotes();
    initPhish();
    initPicks();
    initFlips();
    initTF();
    initMatch();
    initOrder();
    initPassword();
    initRank();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
