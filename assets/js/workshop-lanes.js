/* assets/js/workshop-lanes.js (cleanup of A3090-A3099 + A3115/A3116)
   One two-lane strip for every engine family and the General pages.
     At school  - the hands-on browser studio or practice editor
     At home    - the same step in the real project
   Data: /content/minecraft-lanes.json, /content/mugen-lanes.json,
   /content/terraria-lanes.json, /content/stardew-lanes.json,
   /content/openrct2-lanes.json, /content/blender-lanes.json,
   /content/tinkercad-lanes.json, /content/unreal-lanes.json,
   /content/unity-lanes.json, /content/general-lanes.json.
   The old per-family styles and scripts are aliases kept for the tests: every
   element carries both wl- classes and the family prefix (mc-, mg-, tr-, ...). */
(function () {
  'use strict';
  if (window.self !== window.top) return;
  var m = location.pathname.match(/\/workshops\/([a-z0-9_-]+)\.html$/i);
  if (!m) return;
  var slug = m[1];

  var FAMILIES = [
    { id: 'minecraft', re: /^minecraft-/, cls: 'mc', color: '#4f8a2c', ink: '#3f7023', home: 'real Minecraft', title: 'Do it in the browser or in Minecraft', progress: 'Every step works in the browser studio, so no Minecraft install is needed at school.' },
    { id: 'mugen', re: /^mugen-/, cls: 'mg', color: '#bc4749', ink: '#9b3a3c', home: 'real MUGEN', title: 'Do it in the browser or in MUGEN', progress: 'Every step works in the browser studio, so no MUGEN install is needed at school.' },
    { id: 'terraria', re: /^terraria-/, cls: 'tr', color: '#4f8a2c', ink: '#3f7023', home: 'real Terraria', title: 'Do it in the browser or in Terraria', progress: 'Every step works in the browser studio, so no TEdit or tModLoader install is needed at school.' },
    { id: 'stardew', re: /^stardew-/, cls: 'sd', color: '#3f7d3a', ink: '#2f5f2b', home: 'real Stardew Valley', title: 'Do it in the browser or in Stardew Valley', progress: 'Every step works in the browser studio, so no SMAPI or Content Patcher install is needed at school.' },
    { id: 'openrct2', re: /^openrct2-/, cls: 'or', color: '#c98a2e', ink: '#8a5b12', home: 'real OpenRCT2', title: 'Do it in the browser or in OpenRCT2', progress: 'Every step works in the browser studio, so no OpenRCT2 install is needed at school.' },
    { id: 'blender', re: /^blender-/, cls: 'bl', color: '#e8833a', ink: '#8a4a12', home: 'real Blender', title: 'Do it in the browser or in Blender', progress: 'Every step works in the browser studio, so no Blender install is needed at school.' },
    { id: 'tinkercad', re: /^tinkercad-/, cls: 'tk', color: '#f2637a', ink: '#c23a58', home: 'real TinkerCAD', title: 'Do it in the browser or in TinkerCAD', progress: 'Every step works in the browser studio, so no TinkerCAD account is needed at school.' },
    { id: 'unreal', re: /^unreal-/, cls: 'ue', color: '#e8841a', ink: '#9a5410', home: 'real Unreal Engine', title: 'Do it in the browser or in Unreal Engine', progress: 'Every step works in the browser studio, so no Unreal install is needed at school.' },
    { id: 'unity', re: /^unity-/, cls: 'un', color: '#2d7fb8', ink: '#2d7fb8', home: 'real Unity', title: 'Do it in the browser or in Unity', progress: 'Every step works in the browser studio, so no Unity install is needed at school.' },
    { id: 'general', re: null, cls: 'gl', color: '#70a3a7', ink: '#4e7d80', home: 'the real project', title: 'Do it here, then in the real project', progress: 'The browser lane is on this page. The home lane names the real project file.', school: 'Open the practice editor', self: true }
  ];

  var cfg = FAMILIES.find(function (f) { return f.re && f.re.test(slug); });
  if (!cfg) cfg = FAMILIES.find(function (f) { return f.id === 'general'; });
  var isFamily = !!(cfg && cfg.id !== 'general');
  if (!isFamily && /^(?:workshop|my-first-series|my-progress|learning-lab|tiny-learners|learn)$/.test(slug)) return;

  var STORE = 'jvds-' + (cfg.id === 'minecraft' ? 'mc' : cfg.id) + '-lane:' + slug;
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/style-workshop-lanes.css';
  css.id = 'wl-lane-css';
  document.head.appendChild(css);

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      var data = raw ? JSON.parse(raw) : null;
      return data && typeof data === 'object' ? data : {};
    } catch (e) { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* school devices can block storage */ }
  }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }
  function alias(base) { return 'wl-' + base + ' ' + cfg.cls + '-' + base; }

  var MODE = {
    browser: ['Browser build-along', 'Every step runs on this page. No install.'],
    builder: ['Live browser builder', 'This page is the school lane. At home, use the real software or keep building here.'],
    guide: ['Reference guide', 'Read and keep. There is no build step on this page.'],
    overview: ['Series overview', 'Pick a build-along from the links here.']
  };

  function renderMode(page) {
    var main = document.querySelector('main') || document.body;
    var badge = el('div', alias('mode'));
    badge.setAttribute('role', 'note');
    var label = (MODE[page.mode] || ['General page', ''])[0];
    badge.appendChild(el('strong', '', label));
    badge.appendChild(document.createTextNode(' ' + (page.note || (MODE[page.mode] || [])[1] || '')));
    var h1 = main.querySelector('h1');
    if (h1 && h1.parentNode) h1.parentNode.insertBefore(badge, h1.nextSibling);
    else main.insertBefore(badge, main.firstChild);
  }

  function buildLane(step, studio) {
    var section = el('section', alias('lane'));
    section.setAttribute('data-wl-step', String(step.n));
    section.setAttribute('data-' + cfg.cls + '-step', String(step.n));
    section.setAttribute('aria-label', 'Step ' + step.n + ' in two lanes');
    section.style.setProperty('--wl-color', cfg.color);
    section.style.setProperty('--wl-ink', cfg.ink);

    var head = el('div', alias('lane-head'));
    head.appendChild(el('span', alias('lane-kicker'), 'Two lanes, same step'));
    head.appendChild(el('h3', alias('lane-title'), cfg.title));
    section.appendChild(head);

    var grid = el('div', alias('lane-grid'));
    var school = el('div', 'wl-lane-card wl-lane-card--school ' + cfg.cls + '-lane-card ' + cfg.cls + '-lane-card--school');
    school.appendChild(el('span', alias('lane-label'), cfg.self ? 'At school, on this page' : 'At school, in the browser'));
    school.appendChild(el('p', '', step.school));
    var open = el('a', alias('lane-open'), cfg.school || 'Open the Mod Studio');
    open.href = cfg.self ? '#main-content' : studio;
    school.appendChild(open);
    if (step.tab) {
      var tab = el('span', '', ' Use the ' + step.tab + ' tab.');
      tab.style.fontSize = '.78rem';
      school.appendChild(tab);
    }
    grid.appendChild(school);

    var home = el('div', 'wl-lane-card wl-lane-card--home ' + cfg.cls + '-lane-card ' + cfg.cls + '-lane-card--home');
    home.appendChild(el('span', alias('lane-label'), 'At home, in ' + cfg.home));
    home.appendChild(el('p', '', step.home));
    home.appendChild(el('code', '', step.file));
    home.appendChild(el('span', alias('lane-loc'), step.section + ' | ' + step.line));
    grid.appendChild(home);

    section.appendChild(grid);
    return section;
  }

  fetch('/content/' + cfg.id + '-lanes.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('lanes ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var raw = data && data.pages && data.pages[slug];
      if (!raw) return;
      var steps = Array.isArray(raw) ? raw : raw.steps;
      if (!Array.isArray(steps) || !steps.length) {
        if (cfg.id === 'general' && raw.mode) renderMode(raw);
        return;
      }
      var cards = [].slice.call(document.querySelectorAll('.step-card[data-step]'));
      if (!cards.length) {
        if (cfg.id === 'general' && raw.mode) renderMode(raw);
        return;
      }

      var byStep = {};
      steps.forEach(function (s) { byStep[String(s.n)] = s; });
      var state = load();
      var studio = data.studio || (cfg.id === 'general' ? '#main-content' : '/workshops/' + cfg.id + '-mod-studio.html');

      var bar = el('div', alias('lane-progress'));
      bar.setAttribute('role', 'status');
      bar.setAttribute('aria-live', 'polite');
      var first = cards[0];
      first.parentNode.insertBefore(bar, first);

      cards.forEach(function (card) {
        var n = String(card.getAttribute('data-step'));
        var step = byStep[n];
        if (!step) return;
        var body = card.querySelector('.step-body') || card.querySelector('.s-body') || card;
        var goal = body.querySelector('.big-goal');
        var lane = buildLane(step, studio);

        var check = el('label', alias('lane-check'));
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('data-wl-done', n);
        box.setAttribute('data-' + cfg.cls + '-done', n);
        box.checked = !!state[n];
        check.appendChild(box);
        check.appendChild(document.createTextNode('I did this step in both lanes. Check: ' + step.check));
        lane.appendChild(check);

        box.addEventListener('change', function () {
          state[n] = box.checked;
          save(state);
          render();
        });

        if (goal && goal.parentNode === body) body.insertBefore(lane, goal.nextSibling);
        else body.insertBefore(lane, body.firstChild);
      });

      function render() {
        var done = steps.filter(function (s) { return !!state[String(s.n)]; }).length;
        bar.innerHTML = '';
        bar.appendChild(el('b', '', 'Two lanes: ' + done + ' of ' + steps.length + ' steps checked.'));
        bar.appendChild(document.createTextNode(' ' + cfg.progress));
      }
      render();
    })
    .catch(function (e) {
      if (window.console && console.warn) console.warn('workshop-lanes:', e && e.message ? e.message : e);
    });
})();
