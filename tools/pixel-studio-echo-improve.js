/* A2788: Echo Improve loop for Pixel Studio.
 *
 * The studio's core loop ends in Improve (Echo). Pixel Studio already saves a
 * local keepsake after every save or export, so this adds the missing half:
 *
 *   v1 saved  -> Echo asks one question with three small prompts
 *   v2 saved  -> a before/after card, an Echo badge and ToolXP
 *
 * Everything stays on the device. The whole state is one localStorage key, so
 * the existing backpack picks it up and it survives a wiped school PC.
 */
(function () {
  'use strict';

  var KEY = 'jvds_echo_improve';
  var KEEPSAKE_KEY = 'jvds_pixel_keepsake';
  var PROMPTS = {
    bigger: { hint: 'Echo: make the main shape bigger, then press Save.' },
    clearer: { hint: 'Echo: add an outline or clean up stray pixels, then press Save.' },
    brighter: { hint: 'Echo: pick a lighter colour and add one highlight pixel, then press Save.' }
  };

  function ls() {
    try { return window.localStorage; } catch (e) { return null; }
  }
  function readJSON(k, fallback) {
    var s = ls();
    if (!s) return fallback;
    try {
      var v = JSON.parse(s.getItem(k) || 'null');
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJSON(k, v) {
    var s = ls();
    if (!s) return false;
    try { s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function load() {
    var s = readJSON(KEY, null);
    return (s && typeof s === 'object' && !Array.isArray(s)) ? s : null;
  }
  function saveState(s) { return writeJSON(KEY, s); }

  function keepsake() {
    var a = readJSON(KEEPSAKE_KEY, []);
    return Array.isArray(a) ? a : [];
  }
  function latestKeep() {
    var a = keepsake();
    return a.length ? a[0] : null;
  }
  function tagLatest(stage, prompt) {
    var a = keepsake();
    if (!a.length) return;
    a[0].echo = stage;
    if (prompt) a[0].echoPrompt = prompt;
    writeJSON(KEEPSAKE_KEY, a);
  }

  function el(id) { return document.getElementById(id); }
  function show(node) { if (node) node.style.display = 'flex'; }
  function v1Project(st) {
    if (window._echoV1 && window._echoV1.project) return window._echoV1.project;
    return (st && st.v1 && st.v1.project) || '';
  }

  function renderPrompt(st) {
    var box = el('echo-improve');
    if (!box) return;
    show(box);
    var improving = !!(st && st.stage === 'improving');
    if (el('echo-title')) el('echo-title').textContent = improving
      ? 'Echo: make your one change'
      : "Echo: What's one thing you'd change?";
    if (el('echo-sub')) el('echo-sub').textContent = improving
      ? 'Change it on the canvas, then press Save to finish v2.'
      : 'Your v1 is saved. Pick one small change, then save v2.';
    if (el('echo-prompts')) el('echo-prompts').style.display = improving ? 'none' : 'flex';
    if (el('echo-compare')) { el('echo-compare').style.display = 'none'; el('echo-compare').innerHTML = ''; }
    if (el('echo-again')) el('echo-again').style.display = 'none';
  }

  function renderDone(st) {
    var box = el('echo-improve');
    if (!box) return;
    show(box);
    if (el('echo-title')) el('echo-title').textContent = 'Echo: You made a v2!';
    if (el('echo-sub')) el('echo-sub').textContent = 'Before and after are both in My Creations, so you can keep going.';
    if (el('echo-prompts')) el('echo-prompts').style.display = 'none';
    if (el('echo-again')) el('echo-again').style.display = 'inline-flex';

    var cmp = el('echo-compare');
    if (!cmp) return;
    cmp.style.display = 'flex';
    cmp.innerHTML = '';
    var pairs = [
      { label: 'v1', src: st && st.v1 ? st.v1.thumb : '' },
      { label: 'v2', src: st && st.v2 ? st.v2.thumb : '' }
    ];
    pairs.forEach(function (pair) {
      var cell = document.createElement('span');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';
      var img = document.createElement('img');
      img.alt = pair.label === 'v1' ? 'Your first version' : 'Your improved version';
      img.width = 40;
      img.height = 40;
      if (pair.src) img.src = pair.src;
      img.style.cssText = 'width:40px;height:40px;image-rendering:pixelated;border-radius:6px;border:1px solid var(--border2);background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/8px 8px;';
      var lab = document.createElement('span');
      lab.textContent = pair.label;
      lab.style.cssText = 'font-size:.58rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;';
      cell.appendChild(img);
      cell.appendChild(lab);
      cmp.appendChild(cell);
    });
    var badge = document.createElement('span');
    badge.textContent = 'Echo badge earned';
    badge.style.cssText = 'align-self:center;font-size:.6rem;font-weight:800;padding:4px 9px;border-radius:999px;background:rgba(91,192,248,.18);border:1px solid rgba(91,192,248,.5);color:var(--accent2);white-space:nowrap;';
    cmp.appendChild(badge);
  }

  function awardEcho() {
    try {
      if (window.ToolXP && typeof window.ToolXP.award === 'function') {
        window.ToolXP.award('improve', 20, 3, 'Echo: you improved your sprite!');
      }
    } catch (e) {}
    try {
      document.dispatchEvent(new CustomEvent('jvds:echo-improved', { detail: { tool: 'pixel-studio' } }));
    } catch (e) {}
  }

  function afterKeep() {
    var keep = latestKeep();
    if (!keep || !keep.project) return;
    var st = load();

    if (!st || (st.stage !== 'v1_saved' && st.stage !== 'improving' && st.stage !== 'done')) {
      st = {
        stage: 'v1_saved',
        startedAt: Date.now(),
        prompt: '',
        badge: false,
        v1: { project: keep.project, thumb: keep.thumb || '', title: keep.title || '', date: keep.date || '' }
      };
      if (!saveState(st)) {
        window._echoV1 = st.v1;
        st.noStore = true;
        st.v1 = { project: '', thumb: st.v1.thumb, title: st.v1.title, date: st.v1.date };
        saveState(st);
      }
      tagLatest('v1', '');
      renderPrompt(st);
      return;
    }

    if (st.stage === 'v1_saved' || st.stage === 'improving') {
      var base = v1Project(st);
      if (keep.project && keep.project !== base) {
        st.v2 = { thumb: keep.thumb || '', title: keep.title || '', date: keep.date || '' };
        st.stage = 'done';
        st.doneAt = Date.now();
        st.badge = true;
        saveState(st);
        tagLatest('v2', st.prompt || '');
        renderDone(st);
        awardEcho();
      }
    }
  }

  window.echoStartImprove = function (prompt) {
    var st = load();
    if (!st || !st.v1) return;
    st.prompt = PROMPTS[prompt] ? prompt : 'clearer';
    st.stage = 'improving';
    saveState(st);
    try {
      var project = v1Project(st);
      if (typeof applyProject === 'function' && project) {
        applyProject(JSON.parse(project));
        if (typeof markDirty === 'function') markDirty();
      }
    } catch (e) {}
    renderPrompt(st);
    var p = PROMPTS[st.prompt];
    if (typeof showToast === 'function') {
      showToast(p ? p.hint : 'Echo: make one small change, then press Save.');
    }
  };

  window.echoReset = function () {
    var st = load();
    if (!st || !st.v1) return;
    st.stage = 'v1_saved';
    st.prompt = '';
    st.v2 = null;
    saveState(st);
    try {
      var project = v1Project(st);
      if (typeof applyProject === 'function' && project) {
        applyProject(JSON.parse(project));
        if (typeof markDirty === 'function') markDirty();
      }
    } catch (e) {}
    renderPrompt(st);
  };

  window.echoDismiss = function () {
    var box = el('echo-improve');
    if (box) box.style.display = 'none';
  };

  function restore() {
    var st = load();
    if (!st) return;
    if (st.stage === 'done' && st.v1) { renderDone(st); return; }
    if (st.stage === 'v1_saved' || st.stage === 'improving') renderPrompt(st);
  }

  function hookKeepsake() {
    if (typeof window.keepsakeAdd !== 'function') return false;
    if (window.keepsakeAdd._echoWrapped) return true;
    var orig = window.keepsakeAdd;
    var wrapped = function () {
      var result = orig.apply(this, arguments);
      try { afterKeep(); } catch (e) {}
      return result;
    };
    wrapped._echoWrapped = true;
    window.keepsakeAdd = wrapped;
    return true;
  }

  function hookImprove() {
    if (typeof window.nextActionImprove !== 'function') return;
    if (window.nextActionImprove._echoWrapped) return;
    var orig = window.nextActionImprove;
    var wrapped = function () {
      var st = load();
      if (st && st.v1 && st.stage !== 'done') {
        show(el('echo-improve'));
        window.echoStartImprove(st.prompt || 'clearer');
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped._echoWrapped = true;
    window.nextActionImprove = wrapped;
  }

  function init() {
    hookKeepsake();
    hookImprove();
    restore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', function () {
    hookKeepsake();
    hookImprove();
  });
})();
