/* A1921: Explore, Improve, Invent pathway for the 3D Builders hub.
   Progress and the design note save in localStorage on this device. */
(function () {
  'use strict';
  var root = document.querySelector('[data-design-path]');
  if (!root) return;

  var KEY = 'jvds-3d-design-path-v1';
  var LEVELS = ['explore', 'improve', 'invent'];
  var REQUIRED = ['brief', 'constraints', 'choices'];

  var checks = [].slice.call(root.querySelectorAll('[data-path-check]'));
  var fields = [].slice.call(root.querySelectorAll('[data-note]'));
  var fill = root.querySelector('[data-path-fill]');
  var bar = root.querySelector('[data-path-bar]');
  var status = root.querySelector('[data-path-status]');
  var noteStatus = root.querySelector('[data-note-status]');
  var download = root.querySelector('[data-note-download]');
  var copy = root.querySelector('[data-note-copy]');
  var clear = root.querySelector('[data-note-clear]');

  function blank() { return { levels: {}, note: {} }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          return { levels: d.levels || {}, note: d.note || {} };
        }
      }
    } catch (e) { /* storage can be blocked on school devices */ }
    return blank();
  }

  var state = load();
  var saveTimer = null;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        noteStatus.textContent = 'Saved on this device.';
      }, 350);
    } catch (e) { /* keep working in memory */ }
  }

  function doneCount() {
    return LEVELS.filter(function (l) { return !!state.levels[l]; }).length;
  }

  function noteReady() {
    return REQUIRED.every(function (k) {
      return String(state.note[k] || '').trim().length > 0;
    });
  }

  function isComplete() {
    return doneCount() === LEVELS.length && noteReady();
  }

  function update() {
    var done = doneCount();
    var pct = Math.round((done / LEVELS.length) * 100);
    if (fill) fill.style.width = pct + '%';
    if (bar) bar.setAttribute('aria-valuenow', String(done));
    if (status) {
      if (done === LEVELS.length) status.textContent = '3 of 3 levels finished.';
      else if (done === 2) status.textContent = '2 of 3 levels finished. One to go.';
      else status.textContent = done + ' of 3 levels finished.';
    }
    var ready = noteReady();
    if (download) download.disabled = !(done === LEVELS.length && ready);
    if (copy) copy.disabled = !(done === LEVELS.length && ready);
    if (noteStatus) {
      if (isComplete()) noteStatus.textContent = 'Path complete. Your design note is ready to download.';
      else if (done === LEVELS.length) noteStatus.textContent = '3 of 3 levels finished. Add the brief, constraints and choices to finish the note.';
      else noteStatus.textContent = 'Finish all three levels and fill the brief, constraints and choices to unlock the note.';
    }
  }

  function apply() {
    checks.forEach(function (c) {
      c.checked = !!state.levels[c.getAttribute('data-path-check')];
    });
    fields.forEach(function (f) {
      f.value = state.note[f.getAttribute('data-note')] || '';
    });
    update();
  }

  function noteText() {
    var n = state.note;
    return [
      'JVDesignStudio 3D design note',
      '',
      'Name: ' + (n.name || '(not given)'),
      'Design: ' + (n.title || '(not given)'),
      '',
      'Brief',
      n.brief || '',
      '',
      'Constraints',
      n.constraints || '',
      '',
      'Why I made these choices',
      n.choices || '',
      '',
      'One thing I would improve next',
      n.improve || '',
      '',
      'Levels finished: ' + doneCount() + ' of 3',
      'Path complete: ' + (isComplete() ? 'yes' : 'no')
    ].join('\n');
  }

  function fileName() {
    var base = (state.note.title || state.note.name || '3d-design').trim().toLowerCase();
    var slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return (slug || '3d-design') + '-design-note.txt';
  }

  checks.forEach(function (c) {
    c.addEventListener('change', function () {
      state.levels[c.getAttribute('data-path-check')] = c.checked;
      save();
      update();
    });
  });

  fields.forEach(function (f) {
    f.addEventListener('input', function () {
      state.note[f.getAttribute('data-note')] = f.value;
      save();
      update();
    });
  });

  if (download) {
    download.addEventListener('click', function () {
      if (download.disabled) return;
      var blob = new Blob([noteText()], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      noteStatus.textContent = 'Design note downloaded. Keep it with your exported model.';
    });
  }

  if (copy) {
    copy.addEventListener('click', function () {
      if (copy.disabled) return;
      var text = noteText();
      var ok = function () { noteStatus.textContent = 'Design note copied.'; };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) { /* ignore */ }
        ta.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fallback);
      } else {
        fallback();
      }
    });
  }

  if (clear) {
    clear.addEventListener('click', function () {
      state = blank();
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      apply();
      noteStatus.textContent = 'Cleared on this device.';
    });
  }

  window.__jvdsDesignPath = {
    noteText: noteText,
    state: function () { return JSON.parse(JSON.stringify(state)); }
  };

  apply();
})();
