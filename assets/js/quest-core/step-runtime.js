/* Quest step runtime (A2552/A2555)
   A small, safe step runner shared by workshop quests.
   It reads a value from the learner's code, draws a live preview, checks the
   pass rule, and awards XP once through player-profile. No eval, no CDN. */
(function (global) {
  'use strict';

  function normaliseHex(value) {
    var text = String(value == null ? '' : value).trim().toUpperCase();
    if (/^#[0-9A-F]{3}$/.test(text)) {
      return '#' + text[1] + text[1] + text[2] + text[2] + text[3] + text[3];
    }
    return /^#[0-9A-F]{6}$/.test(text) ? text : null;
  }

  function readFillStyle(code) {
    var m = String(code == null ? '' : code)
      .match(/fillStyle\s*=\s*['"](#[0-9a-f]{3}|#[0-9a-f]{6})['"]/i);
    return m ? normaliseHex(m[1]) : null;
  }

  function pixelHex(canvas, x, y) {
    try {
      var px = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
      return '#' + [px[0], px[1], px[2]].map(function (n) {
        return n.toString(16).padStart(2, '0');
      }).join('').toUpperCase();
    } catch (e) {
      return null;
    }
  }

  function getProfile() {
    return global.playerProfile || null;
  }

  function questCompleted(id) {
    var p = getProfile();
    if (!p || typeof p.getQuestProgress !== 'function') return false;
    var state = p.getQuestProgress(id);
    return !!(state && state.completed);
  }

  function awardOnce(id, xp, source) {
    var p = getProfile();
    if (!p) return { awarded: false, reason: 'no-profile' };
    if (questCompleted(id)) return { awarded: false, reason: 'already' };
    if (typeof p.completeQuest === 'function') p.completeQuest(id);
    if (xp > 0 && typeof p.addXP === 'function') p.addXP(xp, source || 'quest');
    return { awarded: true };
  }

  function field(root, name) {
    return root.querySelector('[data-quest-' + name + ']');
  }

  function mount(root, step) {
    if (!root || !step || !step.id) return null;
    if (root.dataset.questReady === '1') return null;
    root.dataset.questReady = '1';

    var layout = root.querySelector('[data-quest-layout]') || root;

    if (global.QuestLayout && typeof global.QuestLayout.enhance === 'function') {
      global.QuestLayout.enhance(layout);
    }

    var code = field(root, 'code');
    var canvas = field(root, 'canvas');
    var status = field(root, 'status');
    var pixel = field(root, 'pixel');
    var saved = field(root, 'saved');
    var runBtn = field(root, 'run');
    var saveBtn = field(root, 'save');
    var resetBtn = field(root, 'reset');
    var hintBtn = field(root, 'hint');
    var downloadBtn = field(root, 'download');
    if (!code || !canvas) return null;

    var lastValue = null;
    var storageKey = step.storageKey || ('jvds_quest_' + step.id);
    var xp = step.xp || 0;

    function setStatus(text, tone) {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle('is-good', tone === 'good');
      status.classList.toggle('is-bad', tone === 'bad');
    }

    function setSaved(text) {
      if (!saved) return;
      saved.textContent = text;
      saved.hidden = false;
    }

    function showPreview() {
      if (global.QuestLayout && typeof global.QuestLayout.show === 'function') {
        global.QuestLayout.show(layout, 'preview');
      }
    }

    function showCode() {
      if (global.QuestLayout && typeof global.QuestLayout.show === 'function') {
        global.QuestLayout.show(layout, 'code');
      }
    }

    function readRecord() {
      try {
        return JSON.parse(global.localStorage.getItem(storageKey) || '{}') || {};
      } catch (e) {
        return {};
      }
    }

    function writeRecord(record) {
      try { global.localStorage.setItem(storageKey, JSON.stringify(record)); } catch (e) {}
    }

    function draw(value) {
      step.draw(canvas, value);
      var out = pixelHex(canvas, Math.floor(canvas.width / 2), Math.floor(canvas.height / 2));
      if (pixel) pixel.textContent = out || value;
      return out;
    }

    function text(fn, value, out) {
      return typeof fn === 'function' ? fn(value, out) : (fn || '');
    }

    function passFor(value, out) {
      return typeof step.passes === 'function' ? !!step.passes(value, out) : true;
    }

    function run() {
      var value = step.parse(code.value);
      if (value == null) {
        setStatus(step.invalidText || 'That value does not look right yet. Check the example.', 'bad');
        return null;
      }
      lastValue = value;
      var out = draw(value);
      var pass = passFor(value, out);
      setStatus(text(pass ? step.passText : step.progressText, value, out), pass ? 'good' : '');
      if (typeof step.onRun === 'function') step.onRun(value, out, pass);
      showPreview();
      return { value: value, pixel: out, pass: pass };
    }

    function save() {
      var value = step.parse(code.value);
      if (value == null) {
        setStatus(step.invalidText || 'Run a valid step before you save.', 'bad');
        return null;
      }
      lastValue = value;
      var out = draw(value);
      var pass = passFor(value, out);
      var record = readRecord();
      record.colour = value;
      record.savedAt = new Date().toISOString();
      writeRecord(record);

      if (!pass) {
        setStatus('Saved ' + value + '. Change the colour to ' + (step.target || 'the target colour') + ' to earn ' + xp + ' XP.', '');
        setSaved('Saved ' + value + '. No XP yet: the centre pixel is still ' + (out || value) + '.');
        showPreview();
        return { value: value, pixel: out, pass: false, awarded: false };
      }

      var award = awardOnce(step.id, xp, step.source || 'quest');
      if (award.awarded) {
        setStatus('Saved. The centre pixel stays ' + value + ' when you come back.', 'good');
        setSaved('Saved ' + value + '. You earned ' + xp + ' XP once for this quest.');
      } else if (award.reason === 'already') {
        setStatus('Saved again. The centre pixel stays ' + value + '.', 'good');
        setSaved('Saved ' + value + '. You already earned ' + xp + ' XP for this quest.');
      } else {
        setStatus('Saved ' + value + '. Your Studio profile is still loading, so save again to add the XP.', '');
        setSaved('Saved ' + value + '. The XP will be added when your profile is ready.');
      }
      showPreview();
      return { value: value, pixel: out, pass: true, awarded: award.awarded, reason: award.reason };
    }

    function reset() {
      if (step.starter != null) code.value = step.starter;
      lastValue = null;
      run();
      showCode();
    }

    function hint() {
      if (typeof step.hint === 'function') code.value = step.hint(code.value);
      run();
    }

    function download() {
      try {
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = step.fileName || 'quest-step.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSaved('Downloaded ' + (step.fileName || 'quest-step.png') + '.');
      } catch (e) {
        setStatus('This browser blocked the download. Try right-clicking the canvas and choosing Save image.', 'bad');
      }
    }

    if (runBtn) runBtn.addEventListener('click', run);
    if (saveBtn) saveBtn.addEventListener('click', save);
    if (resetBtn) resetBtn.addEventListener('click', reset);
    if (hintBtn) hintBtn.addEventListener('click', hint);
    if (downloadBtn) downloadBtn.addEventListener('click', download);

    var record = readRecord();
    if (record.colour && typeof step.restore === 'function') {
      code.value = step.restore(code.value, record.colour);
    }
    run();
    if (record.colour) {
      if (questCompleted(step.id)) {
        setSaved('Saved ' + record.colour + '. You already earned ' + xp + ' XP for this quest.');
      } else {
        setSaved('Saved ' + record.colour + '. Change it to ' + (step.target || 'the target colour') + ' to earn ' + xp + ' XP.');
      }
    }
    showCode();

    return {
      run: run,
      save: save,
      reset: reset,
      hint: hint,
      download: download
    };
  }

  global.QuestRuntime = {
    mount: mount,
    normaliseHex: normaliseHex,
    readFillStyle: readFillStyle,
    pixelHex: pixelHex,
    questCompleted: questCompleted
  };
})(window);
