/* Godot Lab - A2959 / A3069.
   The editor is self-hosted under editor/ and the page is made cross-origin
   isolated by coi-serviceworker.js. This script waits for isolation, loads the
   editor frame, preloads the starter ZIP in one click and then coaches the
   learner through Load -> Start -> Play. */
(function () {
  'use strict';

  var frame = document.getElementById('godot-frame');
  var statusEl = document.querySelector('[data-gl-status]');
  var loadBtn = document.querySelector('[data-gl-load]');
  var fallback = document.querySelector('[data-gl-fallback]');
  var checkIso = document.querySelector('[data-gl-check="iso"]');
  var checkFrame = document.querySelector('[data-gl-check="frame"]');
  var checkNet = document.querySelector('[data-gl-check="net"]');
  var coach = {
    load: document.querySelector('[data-gl-coach="load"]'),
    start: document.querySelector('[data-gl-coach="start"]'),
    play: document.querySelector('[data-gl-coach="play"]')
  };
  var pollTimer = null;
  var pollStarted = 0;

  /* A3070: every Godot template and workshop is a real project in the Lab.
     projects.json holds the library; ?project=<id> opens one directly. The two
     fallbacks keep the Lab working if the manifest has not loaded yet. */
  var FALLBACK = {
    starter: { id: 'starter', title: 'First Video Game starter', zip: 'starter.zip', download: 'my-first-godot-project.zip', level: '2D', workshop: '/workshops/godot-mod-studio.html' },
    'godot-tutorial': { id: 'godot-tutorial', title: 'Star Collector', zip: 'godot-tutorial.zip', download: 'star-collector-godot.zip', level: '2D', workshop: '/workshops/godot-tutorial-canvas.html' }
  };
  var projectsById = Object.assign({}, FALLBACK);
  var projectKey = 'starter';
  try { projectKey = new URLSearchParams(location.search).get('project') || 'starter'; } catch (e) {}
  var project = projectsById[projectKey] || projectsById.starter;
  var loadLabel = 'Load ' + (project.id === 'starter' ? 'starter project' : (project.title || 'project'));
  var downloadEl = document.querySelector('[data-gl-download]');
  var picker = document.querySelector('[data-gl-project]');
  var projectNameEl = document.querySelector('[data-gl-project-name]');
  var workshopEl = document.querySelector('[data-gl-workshop]');
  var levelEl = document.querySelector('[data-gl-level]');
  var noteEl = document.querySelector('[data-gl-project-note]');
  var mobileEl = document.querySelector('[data-gl-mobile]');
  var mobileLinkEl = document.querySelector('[data-gl-mobile-link]');
  var mobileWorkshopEl = document.querySelector('[data-gl-mobile-workshop]');
  var copyBtn = document.querySelector('[data-gl-copy]');
  var anywayBtn = document.querySelector('[data-gl-anyway]');
  var preflightEl = document.querySelector('[data-gl-preflight]');
  var isSmall = false;
  var isTouch = false;
  var mobileDismissed = false;
  try { isSmall = window.matchMedia('(max-width: 820px)').matches; } catch (e) {}
  try {
    isTouch = (navigator.maxTouchPoints || 0) > 0 ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches;
  } catch (e) {}
  /* Only a touch device gets the hand-off. A narrow desktop window (split
     screen, browser zoom, a small laptop) must still load every template. */
  var compact = isSmall && isTouch;

  function mobileUrl() {
    var base = location.origin && location.origin !== 'null'
      ? location.origin + location.pathname
      : location.href.split('?')[0];
    return base + '?project=' + encodeURIComponent(project.id || 'starter');
  }

  function showMobile() {
    if (mobileDismissed) return;
    if (mobileEl) mobileEl.hidden = false;
    if (preflightEl) preflightEl.hidden = true;
    if (loadBtn) loadBtn.hidden = true;
    setStatus('You are on a small screen. Copy the project link above and open it on a computer.');
    setCheck(checkIso, 'Phone or tablet: read first', 'warn');
    setCheck(checkFrame, 'Editor not loaded', 'warn');
    setCheck(checkNet, 'Use a computer for the editor', 'warn');
  }

  function copyLink() {
    var url = mobileUrl();
    var done = function () {
      if (!copyBtn) return;
      copyBtn.textContent = 'Copied';
      setTimeout(function () { copyBtn.textContent = 'Copy project link'; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
      return;
    }
    try {
      var field = document.createElement('textarea');
      field.value = url;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    } catch (e) {}
    done();
  }

  function shortProject(p) {
    return p.id === 'starter' ? 'starter project' : (p.title || 'project');
  }

  function applyProject(p) {
    project = p || projectsById.starter;
    loadLabel = 'Load ' + shortProject(project);
    if (loadBtn) loadBtn.textContent = loadLabel;
    if (downloadEl) {
      downloadEl.setAttribute('href', project.zip || 'starter.zip');
      downloadEl.setAttribute('download', project.download || 'godot-project.zip');
      downloadEl.textContent = project.id === 'starter' ? 'Download starter project' : 'Download this project';
    }
    if (projectNameEl) projectNameEl.textContent = project.title || 'Godot project';
    if (levelEl) levelEl.textContent = project.level || '';
    if (workshopEl) {
      if (project.workshop) { workshopEl.setAttribute('href', project.workshop); workshopEl.hidden = false; }
      else { workshopEl.hidden = true; }
    }
    if (noteEl) noteEl.textContent = project.note || 'Pick any template or workshop. The Lab loads its real Godot project.';
    if (mobileLinkEl) mobileLinkEl.textContent = mobileUrl();
    if (mobileWorkshopEl) mobileWorkshopEl.setAttribute('href', project.workshop || '/workshops/engine-godot.html#godot-path');
    if (picker && project.id) picker.value = project.id;
  }

  function fillPicker(projects) {
    if (!picker) return;
    var groups = { starters: 'Start here', templates: 'Templates', workshops: 'Workshops' };
    var labels = ['starters', 'templates', 'workshops'];
    picker.innerHTML = '';
    labels.forEach(function (key) {
      var list = projects.filter(function (p) { return p.group === key; });
      if (!list.length) return;
      var group = document.createElement('optgroup');
      group.label = groups[key];
      list.forEach(function (p) {
        var option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.title + (p.level ? ' · ' + p.level : '');
        group.appendChild(option);
      });
      picker.appendChild(group);
    });
  }

  if (picker) picker.addEventListener('change', function () {
    var url = new URL(location.href);
    url.searchParams.set('project', picker.value);
    location.href = url.pathname + url.search;
  });

  if (loadBtn) loadBtn.disabled = true;
  applyProject(project);
  fetch('projects.json').then(function (r) { return r.json(); }).then(function (data) {
    if (!data || !Array.isArray(data.projects) || !data.projects.length) throw new Error('empty manifest');
    projectsById = {};
    data.projects.forEach(function (p) { projectsById[p.id] = p; });
    fillPicker(data.projects);
    applyProject(projectsById[projectKey] || data.projects[0]);
  }).catch(function () {
    applyProject(project);
  }).then(function () {
    if (loadBtn) loadBtn.disabled = false;
  });

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || '';
  }

  function setCheck(el, msg, state) {
    if (!el) return;
    el.textContent = msg;
    if (state) el.setAttribute('data-state', state);
    else el.removeAttribute('data-state');
  }

  function markCoach(name, state) {
    var el = coach[name];
    if (!el) return;
    el.classList.toggle('is-active', state === 'active');
    el.classList.toggle('is-done', state === 'done');
  }

  function showFallback() {
    if (fallback) fallback.hidden = false;
  }

  function editorDoc() {
    try { return frame && frame.contentDocument; } catch (e) { return null; }
  }

  function updateNetwork() {
    if (!checkNet) return;
    if (compact && !mobileDismissed) {
      setCheck(checkNet, 'Use a computer for the editor', 'warn');
      return;
    }
    if (navigator.onLine === false) {
      setCheck(checkNet, 'Offline: use the practice editor', 'warn');
    } else {
      setCheck(checkNet, 'First load downloads about 96 MB', 'ok');
    }
  }

  function reveal(force) {
    if (compact && !force) { showMobile(); return; }
    if (mobileEl) mobileEl.hidden = true;
    if (preflightEl) preflightEl.hidden = false;
    if (loadBtn) loadBtn.hidden = false;
    if (!window.crossOriginIsolated) {
      setCheck(checkIso, 'Browser blocked isolation', 'bad');
      setStatus('Preparing the lab. If this stays, your browser or network is blocking service workers.');
      showFallback();
      return;
    }
    setCheck(checkIso, 'Browser ready', 'ok');
    if (frame && !frame.getAttribute('src')) {
      frame.setAttribute('src', frame.getAttribute('data-src') || 'editor/index.html');
      setStatus('Editor loading. Press ' + loadLabel + ' when the editor is ready.');
      markCoach('load', 'active');
    }
  }

  function loadStarter() {
    var doc = editorDoc();
    if (!doc || !doc.getElementById('zip-file') || !doc.getElementById('startButton')) {
      setStatus('The editor is still loading. Wait a moment, then try again.');
      return;
    }
    // The official editor opens a first-run notice over the whole window. Clear
    // it so the learner sees the starter project, not a modal.
    try {
      var welcome = doc.getElementById('welcome-modal');
      if (welcome && getComputedStyle(welcome).display !== 'none') {
        var dismiss = doc.getElementById('welcome-modal-dismiss');
        if (dismiss) dismiss.click();
      }
    } catch (e) {}
    setStatus('Loading the starter project...');
    markCoach('load', 'active');
    fetch(project.zip).then(function (r) { return r.blob(); }).then(function (blob) {
      var file = new File([blob], 'starter.zip', { type: 'application/zip' });
      var dt = new DataTransfer();
      dt.items.add(file);
      doc.getElementById('zip-file').files = dt.files;
      doc.getElementById('startButton').click();
      markCoach('load', 'done');
      markCoach('start', 'active');
      setStatus('Starting the real editor. The first load can take about a minute.');
      watchStart();
    }).catch(function () {
      setStatus('Could not load the starter zip. Download it and use Preload project ZIP in the editor.');
      showFallback();
    });
  }

  /* Watch the embedded editor until the canvas is live, then point the learner
     at Play. This is a hint layer only; it never blocks the editor. */
  function watchStart() {
    if (pollTimer) return;
    pollStarted = Date.now();
    pollTimer = setInterval(function () {
      var doc = editorDoc();
      if (!doc) return;
      var notice = doc.getElementById('status-notice');
      try {
        if (notice && getComputedStyle(notice).display !== 'none') {
          clearInterval(pollTimer);
          pollTimer = null;
          markCoach('start', 'active');
          setStatus('The editor could not start here. Download the starter and open it in the Godot app.');
          showFallback();
          return;
        }
      } catch (e) {}
      var progress = doc.getElementById('status-progress') || doc.getElementById('status-indeterminate');
      var busy = false;
      try {
        busy = !!(progress && getComputedStyle(progress).display !== 'none');
      } catch (e) {}
      var canvas = doc.getElementById('editor-canvas') || doc.querySelector('canvas');
      var live = canvas && canvas.clientWidth > 10 && canvas.clientHeight > 10;
      if (live && !busy) {
        clearInterval(pollTimer);
        pollTimer = null;
        setCheck(checkFrame, 'Editor running', 'ok');
        markCoach('start', 'done');
        markCoach('play', 'active');
        setStatus('Editor started. Press Play at the top right, then use the arrow keys.');
      } else if (Date.now() - pollStarted > 180000) {
        clearInterval(pollTimer);
        pollTimer = null;
        setStatus('Still loading. The first load can take a few minutes. You can keep the starter download for later.');
      }
    }, 750);
  }

  if (loadBtn) loadBtn.addEventListener('click', loadStarter);
  if (copyBtn) copyBtn.addEventListener('click', copyLink);
  if (anywayBtn) anywayBtn.addEventListener('click', function () {
    mobileDismissed = true;
    if (mobileEl) mobileEl.hidden = true;
    if (preflightEl) preflightEl.hidden = false;
    reveal(true);
  });

  if (frame) {
    frame.addEventListener('load', function () {
      if (window.crossOriginIsolated) {
        setCheck(checkFrame, 'Editor frame loaded', 'ok');
        setStatus('Editor ready. Press ' + loadLabel + ', then Start.');
        if (!coach.load || !coach.load.classList.contains('is-done')) markCoach('load', 'active');
      }
    });
  }

  updateNetwork();
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);

  if (window.crossOriginIsolated) {
    reveal();
  } else {
    setStatus('Preparing the lab...');
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function () {
        if (window.crossOriginIsolated) reveal();
      }).catch(function () {});
    }
    setTimeout(function () {
      if (!window.crossOriginIsolated) reveal();
      else if (frame && !frame.getAttribute('src')) reveal();
    }, 4000);
  }
  if (compact) showMobile();
})();
