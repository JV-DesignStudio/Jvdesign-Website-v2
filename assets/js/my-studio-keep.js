/* A2796: Keep and play for My Studio.
 *
 * Three jobs, all local and account-free:
 *   1. Take it home: the existing backpack download and code sit at the top of
 *      a dedicated panel, with a printable report next to them.
 *   2. Show your grown-up: a one-page report built from the newest creation in
 *      jvds_pixel_keepsake, with three lines the learner can write and print.
 *   3. My Arcade: animate saved sprites and open game project bundles safely.
 *      back in a sandboxed iframe. No account, no server, works offline.
 */
(function () {
  'use strict';

  var ARCADE_KEY = 'jvds_my_arcade';
  var NOTES_KEY = 'jvds_report_notes';
  var MAX_GAMES = 5;
  var MAX_BYTES = 1.5 * 1024 * 1024;
  var playTimer = null;
  var lastReportId = null;

  function el(id) { return document.getElementById(id); }
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function nameOf() {
    try {
      return (localStorage.getItem('jvds-player-name') || localStorage.getItem('qb-player-name') || '').trim();
    } catch (e) { return ''; }
  }

  /* ---------- report ---------- */

  function thumbFromProject(raw) {
    try {
      var d = JSON.parse(raw);
      if (!d || !d.cW || !d.cH || !Array.isArray(d.frames) || !d.frames.length) return '';
      var c = document.createElement('canvas');
      c.width = d.cW; c.height = d.cH;
      var ctx = c.getContext('2d');
      var layers = d.layers || [];
      d.frames[0].forEach(function (arr, li) {
        if (!arr) return;
        var layer = layers[li] || {};
        if (layer.visible === false) return;
        var id = new ImageData(d.cW, d.cH);
        id.data.set(arr.slice(0, d.cW * d.cH * 4));
        var t = document.createElement('canvas');
        t.width = d.cW; t.height = d.cH;
        t.getContext('2d').putImageData(id, 0, 0);
        ctx.globalAlpha = Math.max(0, Math.min(100, layer.opacity == null ? 100 : layer.opacity)) / 100;
        ctx.drawImage(t, 0, 0);
      });
      ctx.globalAlpha = 1;
      var out = document.createElement('canvas');
      out.width = 128; out.height = 128;
      var octx = out.getContext('2d');
      octx.imageSmoothingEnabled = false;
      octx.drawImage(c, 0, 0, 128, 128);
      return out.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  function latestCreation() {
    var keep = readJSON('jvds_pixel_keepsake', []);
    if (Array.isArray(keep) && keep.length && (keep[0].thumb || keep[0].project)) {
      var k = keep[0];
      return {
        id: k.id || ('keep-' + (k.date || '')),
        title: k.title || 'My creation',
        date: k.date || '',
        thumb: k.thumb || ''
      };
    }
    var project = '';
    try {
      project = localStorage.getItem('jvds_pixel') || localStorage.getItem('jvds_pixel_auto') || '';
    } catch (e) {}
    if (project) {
      return {
        id: 'current',
        title: 'My latest creation',
        date: new Date().toISOString().slice(0, 10),
        thumb: thumbFromProject(project)
      };
    }
    return null;
  }

  function echoPrompt() {
    var st = readJSON('jvds_echo_improve', null);
    if (!st || !st.prompt) return '';
    var labels = { bigger: 'bigger', clearer: 'clearer', brighter: 'brighter with a highlight' };
    return labels[st.prompt] || st.prompt;
  }

  function notesFor(id) {
    var all = readJSON(NOTES_KEY, {});
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    return all[id] || {};
  }

  function populateReport(force) {
    var creation = latestCreation();
    var id = creation ? creation.id : 'empty';
    var art = el('reportArt');
    var meta = el('reportMeta');
    var name = nameOf();
    if (art) {
      if (creation && creation.thumb) {
        art.innerHTML = '';
        var img = document.createElement('img');
        img.src = creation.thumb;
        img.alt = creation.title || 'Your creation';
        img.width = 180;
        img.height = 180;
        art.appendChild(img);
      } else {
        art.textContent = 'Make something in Pixel Studio, then come back and this page will show it.';
        art.style.fontSize = '.78rem';
      }
    }
    if (meta) {
      var bits = [];
      if (name) bits.push('By ' + name);
      if (creation && creation.title) bits.push(creation.title);
      if (creation && creation.date) bits.push(creation.date);
      meta.textContent = bits.join(' - ') || 'Nothing made yet';
    }
    if (el('reportDate')) el('reportDate').textContent = creation && creation.date ? creation.date : '';

    var notes = notesFor(id);
    var made = el('reportMade'), learned = el('reportLearned'), next = el('reportNext');
    if (made && (force || !made.value || lastReportId !== id)) {
      made.value = notes.made || (creation ? 'I made ' + (creation.title || 'something new') + '.' : '');
    }
    if (learned && (force || !learned.value || lastReportId !== id)) {
      var prompt = echoPrompt();
      learned.value = notes.learned || (prompt ? 'I made a second version and made it ' + prompt + '.' : '');
    }
    if (next && (force || !next.value || lastReportId !== id)) {
      next.value = notes.next || (echoPrompt() ? 'I will try one more small change.' : '');
    }
    lastReportId = id;
  }

  function saveNotes() {
    var id = latestCreation() ? latestCreation().id : 'empty';
    var all = readJSON(NOTES_KEY, {});
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    all[id] = {
      made: (el('reportMade') || {}).value || '',
      learned: (el('reportLearned') || {}).value || '',
      next: (el('reportNext') || {}).value || '',
      savedAt: new Date().toISOString()
    };
    writeJSON(NOTES_KEY, all);
  }

  function activateKeep() {
    var panel = el('panel-keep');
    if (!panel) return;
    Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) {
      p.classList.toggle('active', p === panel);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab[data-tab]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === 'keep');
    });
  }

  window.printReport = function () {
    activateKeep();
    populateReport(false);
    lastReportId = null;
    populateReport(true);
    document.body.classList.add('report-printing');
    try { window.print(); } catch (e) {}
    setTimeout(function () { document.body.classList.remove('report-printing'); }, 60000);
  };
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('report-printing');
  });

  /* ---------- My Arcade ---------- */

  // Two safe kinds of play:
  //  - sprites: a saved Pixel Studio project, animated here on a canvas
  //  - games: an Arcade Game Maker project bundle, opened in the maker to play
  // Arbitrary HTML is never executed on this page.

  function loadArcade() {
    var list = readJSON(ARCADE_KEY, []);
    if (!Array.isArray(list)) return [];
    return list.filter(function (g) {
      return g && g.id && (g.type === 'sprite' || g.type === 'game') && g.payload;
    });
  }
  function saveArcade(list) {
    if (writeJSON(ARCADE_KEY, list)) return true;
    if (el('arcadeMsg')) el('arcadeMsg').textContent = 'This browser is low on space. Remove a project or use a smaller file.';
    return false;
  }
  function fmtDate(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleDateString(); } catch (e) { return value; }
  }
  function keepsakeItems() {
    var keep = readJSON('jvds_pixel_keepsake', []);
    if (!Array.isArray(keep)) return [];
    return keep.filter(function (k) { return k && k.project; }).slice(0, 6).map(function (k) {
      return {
        type: 'sprite',
        id: 'keep-' + (k.id || k.date || Math.random()),
        name: k.title || 'My sprite',
        added: k.date || '',
        thumb: k.thumb || '',
        payload: k.project,
        saved: true
      };
    });
  }
  function allItems() {
    return keepsakeItems().concat(loadArcade());
  }
  function renderArcade() {
    var grid = el('arcadeGrid');
    if (!grid) return;
    var list = allItems();
    if (el('arcadeCount')) el('arcadeCount').textContent = list.length + (list.length === 1 ? ' creation' : ' creations');
    grid.textContent = '';
    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.style.gridColumn = '1/-1';
      empty.innerHTML = 'No creations yet. Make a sprite in <a href="/tools/pixel-studio.html">Pixel Studio</a>, or add a project file from <a href="/tools/arcade-game-maker.html">Arcade Game Maker</a>.';
      grid.appendChild(empty);
      return;
    }
    list.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'arcade-card';
      var title = document.createElement('strong');
      title.textContent = item.name || (item.type === 'sprite' ? 'My sprite' : 'My game');
      var when = document.createElement('small');
      when.textContent = (item.type === 'sprite' ? 'Sprite' : 'Game project') + (item.added ? ' - ' + fmtDate(item.added) : '');
      var actions = document.createElement('div');
      actions.className = 'arcade-actions';
      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'tab keep-primary';
      play.textContent = item.type === 'sprite' ? 'Play animation' : 'Play in Game Maker';
      play.addEventListener('click', function () { playItem(item); });
      actions.appendChild(play);
      if (!item.saved) {
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'tab';
        remove.textContent = 'Remove';
        remove.addEventListener('click', function () { removeGame(item.id); });
        actions.appendChild(remove);
      }
      card.appendChild(title);
      card.appendChild(when);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  function addProject(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      if (el('arcadeMsg')) el('arcadeMsg').textContent = 'Choose a .json project file from Arcade Game Maker or Pixel Studio.';
      return;
    }
    if (file.size > MAX_BYTES) {
      if (el('arcadeMsg')) el('arcadeMsg').textContent = 'That file is too big. Keep it under 1.5 MB.';
      return;
    }
    file.text().then(function (text) {
      var data = null;
      try { data = JSON.parse(text); } catch (e) { data = null; }
      if (!data) {
        if (el('arcadeMsg')) el('arcadeMsg').textContent = 'That file is not a JVDS project.';
        return;
      }
      var item = null;
      if (data.app === 'jvds-tool-bundle' && data.tool === 'arcade-game-maker') {
        item = { type: 'game', payload: data };
      } else if (data.cW && data.cH && Array.isArray(data.frames) && Array.isArray(data.layers)) {
        item = { type: 'sprite', payload: data };
      } else {
        if (el('arcadeMsg')) el('arcadeMsg').textContent = 'That file is not a Pixel Studio or Arcade Game Maker project.';
        return;
      }
      var list = loadArcade();
      item.id = 'g' + Date.now();
      item.name = String(data.name || data.title || file.name.replace(/\.json$/i, '')).slice(0, 60);
      item.added = new Date().toISOString();
      list.unshift(item);
      if (list.length > MAX_GAMES) list = list.slice(0, MAX_GAMES);
      if (saveArcade(list)) {
        renderArcade();
        if (el('arcadeMsg')) el('arcadeMsg').textContent = 'Added ' + item.name + '. Press Play to try it.';
      }
    }).catch(function () {
      if (el('arcadeMsg')) el('arcadeMsg').textContent = 'Could not read that file. Try downloading it again.';
    });
  }

  function showCanvas(show) {
    var canvas = el('arcadeCanvas'), frame = el('arcadeFrame');
    if (canvas) canvas.hidden = !show;
    if (frame) frame.hidden = show;
  }

  function playItem(item) {
    if (!item) return;
    if (item.type === 'game') {
      if (window.JVDSProjectBundle && typeof window.JVDSProjectBundle.openIn === 'function') {
        window.JVDSProjectBundle.openIn('arcade-game-maker', item.payload, '/tools/arcade-game-maker.html');
      } else if (el('arcadeMsg')) {
        el('arcadeMsg').textContent = 'Open Arcade Game Maker to play this project.';
      }
      return;
    }
    playSprite(item);
  }

  function playSprite(item) {
    var data = item.payload;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } }
    if (!data || !data.cW || !data.cH || !Array.isArray(data.frames) || !data.frames.length) return;
    var canvas = el('arcadeCanvas');
    if (!canvas) return;
    window.closeArcade();
    canvas.width = 320;
    canvas.height = 320;
    var ctx = canvas.getContext('2d');
    var frames = data.frames, layers = data.layers || [], fps = Math.max(1, Math.min(30, data.fps || 8));
    var index = 0;
    function draw() {
      var comp = document.createElement('canvas');
      comp.width = data.cW;
      comp.height = data.cH;
      var cctx = comp.getContext('2d');
      (frames[index] || []).forEach(function (arr, li) {
        if (!arr) return;
        var layer = layers[li] || {};
        if (layer.visible === false) return;
        var id = new ImageData(data.cW, data.cH);
        id.data.set(arr.slice(0, data.cW * data.cH * 4));
        var t = document.createElement('canvas');
        t.width = data.cW;
        t.height = data.cH;
        t.getContext('2d').putImageData(id, 0, 0);
        cctx.globalAlpha = Math.max(0, Math.min(100, layer.opacity == null ? 100 : layer.opacity)) / 100;
        cctx.drawImage(t, 0, 0);
      });
      cctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      var scale = Math.max(1, Math.floor(Math.min(canvas.width / data.cW, canvas.height / data.cH)));
      var w = data.cW * scale, h = data.cH * scale;
      ctx.drawImage(comp, Math.floor((canvas.width - w) / 2), Math.floor((canvas.height - h) / 2), w, h);
      index = (index + 1) % frames.length;
    }
    draw();
    if (frames.length > 1) playTimer = setInterval(draw, Math.round(1000 / fps));
    showCanvas(true);
    if (el('arcadeModalTitle')) el('arcadeModalTitle').textContent = item.name || 'Your sprite';
    var modal = el('arcadeModal');
    if (modal) modal.hidden = false;
  }

  window.closeArcade = function () {
    var modal = el('arcadeModal');
    if (modal) modal.hidden = true;
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    showCanvas(false);
    var frame = el('arcadeFrame');
    if (frame) frame.src = 'about:blank';
  };

  function removeGame(id) {
    var list = loadArcade().filter(function (g) { return g.id !== id; });
    saveArcade(list);
    renderArcade();
    if (el('arcadeMsg')) el('arcadeMsg').textContent = 'Project removed.';
  }

  /* ---------- init ---------- */

  function init() {
    populateReport(false);
    renderArcade();
    var file = el('arcadeFile');
    if (file) file.addEventListener('change', function () { addProject(this.files && this.files[0]); this.value = ''; });
    ['reportMade', 'reportLearned', 'reportNext'].forEach(function (id) {
      var node = el(id);
      if (node) node.addEventListener('input', saveNotes);
    });
    var modal = el('arcadeModal');
    if (modal) {
      modal.addEventListener('click', function (e) { if (e.target === modal) window.closeArcade(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hidden) window.closeArcade();
    });
    if (location.hash === '#keep' || location.hash === '#myArcade') {
      activateKeep();
      var section = location.hash === '#myArcade' ? el('myArcade') : el('keep');
      if (section && section.scrollIntoView) setTimeout(function () { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
