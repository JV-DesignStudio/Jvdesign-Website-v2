/* pages-workshop-14.js - Quest 00: Studio Ignition (A2554)
   First-run onboarding on the workshop hub. A new profile picks a companion,
   edits one line, runs it, and earns 50 XP plus the Studio Pioneer badge once.
   Reuses player-profile addXP/completeQuest/unlockAchievement; no new XP system. */
(function () {
  'use strict';

  var root = document.getElementById('quest00');
  if (!root) return;

  var STEP_ID = 'quest-00-studio-ignition';
  var ACHIEVEMENT = 'studio-pioneer';
  var XP = 50;
  var LS_COMPANION = 'jvds_quest00_companion';
  var LS_SKIP = 'jvds_quest00_skipped';
  var LS_LINE = 'jvds_quest00_line';
  var WANTED = ['pip', 'lumo', 'ember', 'echo', 'stardust'];
  var FALLBACK = [
    { id: 'pip', name: 'Pip', role: 'Play', color: '#B35400', art: { badge: '/assets/mascots/pip-badge.webp' } },
    { id: 'lumo', name: 'Lumo', role: 'Learn', color: '#6B4FA0', art: { badge: '/assets/mascots/lumo-badge.webp' } },
    { id: 'ember', name: 'Ember', role: 'Create', color: '#C2410C', art: { badge: '/assets/mascots/ember-badge.webp' } },
    { id: 'echo', name: 'Echo', role: 'Improve', color: '#0F766E', art: { badge: '/assets/mascots/echo-badge.webp' } },
    { id: 'stardust', name: 'Stardust', role: 'Imagine', color: '#B45309', art: { badge: '/assets/mascots/stardust-badge.webp' } }
  ];

  var companions = FALLBACK;
  var images = {};
  var selected = read(LS_COMPANION) || 'lumo';
  var state = { pass: false, headline: '', companion: selected };

  function el(id) { return document.getElementById(id); }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function profile() { return window.playerProfile; }

  function questDone() {
    var p = profile();
    if (!p || typeof p.getQuestProgress !== 'function') return false;
    var q = p.getQuestProgress(STEP_ID);
    return !!(q && q.completed);
  }

  function isNewProfile() {
    var p = profile();
    if (!p || !p.state) return false;
    var quests = p.state.questProgress || {};
    return (p.state.globalXP || 0) === 0 && Object.keys(quests).length === 0;
  }

  function renderCompanions() {
    var host = el('quest00Companions');
    if (!host) return;
    host.innerHTML = '';
    companions.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'quest00-comp';
      b.setAttribute('data-id', c.id);
      b.setAttribute('aria-pressed', c.id === selected ? 'true' : 'false');
      var img = document.createElement('img');
      img.alt = '';
      img.width = 30;
      img.height = 30;
      img.src = (c.art && c.art.badge) || ('/assets/mascots/' + c.id + '-badge.webp');
      b.appendChild(img);
      var text = document.createElement('span');
      var strong = document.createElement('strong');
      strong.textContent = c.name;
      var small = document.createElement('small');
      small.textContent = c.role || '';
      text.appendChild(strong);
      text.appendChild(small);
      b.appendChild(text);
      b.addEventListener('click', function () { pickCompanion(c.id); });
      host.appendChild(b);
    });
  }

  function pickCompanion(id) {
    selected = id;
    state.companion = id;
    write(LS_COMPANION, id);
    root.querySelectorAll('.quest00-comp').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false');
    });
    draw();
  }

  function currentCompanion() {
    for (var i = 0; i < companions.length; i++) if (companions[i].id === selected) return companions[i];
    return companions[0];
  }

  function parseLine(code) {
    var m = String(code || '').match(/headline\s*=\s*["']([^"']*)["']/i);
    return m ? m[1].trim() : null;
  }

  function draw() {
    var canvas = el('quest00Canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var c = currentCompanion();
    var colour = (c && c.color) || '#4e7d80';
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, colour);
    g.addColorStop(1, '#1e1c18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText('STUDIO PIONEER CARD', 24, 34);
    var img = images[selected];
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(84, 118, 44, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 40, 74, 88, 88);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(84, 118, 44, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(84, 118, 42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Fredoka, Inter, sans-serif';
    ctx.fillText(c ? c.name : 'Your companion', 152, 108);
    ctx.font = '600 15px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(c ? (c.role || '') : '', 152, 134);
    var headline = state.headline || 'Your first quest';
    ctx.font = 'bold 21px Inter, sans-serif';
    ctx.fillStyle = '#FFE566';
    ctx.fillText(headline.slice(0, 28), 24, 214);
    window.__quest00 = { pass: state.pass, headline: headline, companion: selected, drawn: true };
  }

  function setStatus(text, tone) {
    var s = el('quest00Status');
    if (!s) return;
    s.textContent = text;
    s.classList.toggle('is-good', tone === 'good');
    s.classList.toggle('is-bad', tone === 'bad');
  }

  function readLine() {
    var text = parseLine(el('quest00Code').value);
    var pass = !!text && text.length >= 2 && text.toLowerCase() !== 'my first quest';
    state.headline = text || '';
    state.pass = pass;
    return { text: text, pass: pass };
  }

  function showPreview() {
    var grid = root.querySelector('[data-quest-layout]');
    if (window.QuestLayout && grid) window.QuestLayout.show(grid, 'preview');
  }

  function run() {
    var r = readLine();
    draw();
    if (r.text == null) setStatus('Keep the quotes around your words, like headline = "Pixel Pioneer".', 'bad');
    else if (!r.pass) setStatus('Change the words from "My first quest" to something that is yours, then press Run.', 'bad');
    else setStatus('Nice. "' + r.text + '" is on your card. Press Finish to keep the 50 XP.', 'good');
    showPreview();
    return r;
  }

  function finish() {
    var r = run();
    if (!r.pass) return;
    var p = profile();
    if (!p) { setStatus('Your Studio profile is still loading. Try Finish again in a second.', 'bad'); return; }
    if (!questDone()) {
      if (typeof p.completeQuest === 'function') p.completeQuest(STEP_ID);
      if (typeof p.addXP === 'function') p.addXP(XP, 'quest');
      if (typeof p.unlockAchievement === 'function') p.unlockAchievement(ACHIEVEMENT);
      setStatus('Quest complete! 50 XP added and the Studio Pioneer badge is yours.', 'good');
    } else {
      setStatus('This quest is already complete. The 50 XP is saved on this device.', 'good');
    }
    var badge = el('quest00Badge');
    if (badge) badge.hidden = false;
    var save = el('quest00Save');
    if (save) { save.disabled = true; save.textContent = 'Quest complete'; }
    draw();
  }

  function skip() {
    write(LS_SKIP, '1');
    root.hidden = true;
  }

  function preloadImages() {
    WANTED.forEach(function (id) {
      if (images[id]) return;
      var img = new Image();
      img.onload = function () { if (id === selected) draw(); };
      img.src = '/assets/mascots/' + id + '-badge.webp';
      images[id] = img;
    });
  }

  function init() {
    if (read(LS_SKIP) === '1' || questDone() || !isNewProfile()) return;
    root.hidden = false;
    renderCompanions();
    preloadImages();
    var code = el('quest00Code');
    var savedLine = read(LS_LINE);
    if (savedLine) code.value = savedLine;
    code.addEventListener('input', function () { write(LS_LINE, code.value); run(); });
    el('quest00Run').addEventListener('click', run);
    el('quest00Save').addEventListener('click', finish);
    el('quest00Skip').addEventListener('click', skip);
    var grid = root.querySelector('[data-quest-layout]');
    if (window.QuestLayout && grid) window.QuestLayout.enhance(grid);
    draw();
  }

  function loadCompanions() {
    if (typeof fetch !== 'function') return;
    fetch('/content/characters.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (list) {
        if (!Array.isArray(list)) return;
        var picked = list.filter(function (c) { return WANTED.indexOf(c.id) !== -1; });
        if (picked.length === WANTED.length) {
          companions = picked;
          if (!root.hidden) renderCompanions();
          draw();
        }
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  loadCompanions();
})();
