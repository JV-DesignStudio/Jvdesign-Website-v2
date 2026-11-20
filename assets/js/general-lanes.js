/* assets/js/general-lanes.js (A3099)
   Classifies every General page and adds the two-lane strip where a page
   points at real software:
     At school  - the live practice editor or builder on this page
     At home    - the same step in the real project
   Pages with no step spine get a small mode badge (browser build-along, live
   builder, reference guide or series overview). Data: content/general-lanes.json. */
(function () {
  'use strict';

  if (window.self !== window.top) return;
  var m = location.pathname.match(/\/workshops\/([a-z0-9-]+)\.html$/i);
  if (!m) return;
  var slug = m[1];
  var STORE = 'jvds-general-lane:' + slug;

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/style-general-lanes.css';
  css.id = 'gl-lane-css';
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

  var MODE = {
    browser: ['Browser build-along', 'Every step runs on this page. No install.'],
    builder: ['Live browser builder', 'This page is the school lane. At home, use the real software or keep building here.'],
    guide: ['Reference guide', 'Read and keep. There is no build step on this page.'],
    overview: ['Series overview', 'Pick a build-along from the links here.']
  };

  function renderMode(page) {
    var main = document.querySelector('main') || document.body;
    var badge = el('div', 'gl-mode');
    badge.setAttribute('role', 'note');
    var label = (MODE[page.mode] || ['General page', ''])[0];
    badge.appendChild(el('strong', '', label));
    badge.appendChild(document.createTextNode(' ' + (page.note || (MODE[page.mode] || [])[1] || '')));
    var h1 = main.querySelector('h1');
    if (h1 && h1.parentNode) h1.parentNode.insertBefore(badge, h1.nextSibling);
    else main.insertBefore(badge, main.firstChild);
  }

  function buildLane(step) {
    var section = el('section', 'gl-lane');
    section.setAttribute('data-gl-step', String(step.n));
    section.setAttribute('aria-label', 'Step ' + step.n + ' in two lanes');

    var head = el('div', 'gl-lane-head');
    head.appendChild(el('span', 'gl-lane-kicker', 'Two lanes, same step'));
    head.appendChild(el('h3', 'gl-lane-title', 'Do it here, then in the real project'));
    section.appendChild(head);

    var grid = el('div', 'gl-lane-grid');

    var school = el('div', 'gl-lane-card gl-lane-card--school');
    school.appendChild(el('span', 'gl-lane-label', 'At school, on this page'));
    school.appendChild(el('p', '', step.school));
    var open = el('a', 'gl-lane-open', 'Open the practice editor');
    open.href = '#main-content';
    school.appendChild(open);
    grid.appendChild(school);

    var home = el('div', 'gl-lane-card gl-lane-card--home');
    home.appendChild(el('span', 'gl-lane-label', 'At home, in the real project'));
    home.appendChild(el('p', '', step.home));
    home.appendChild(el('code', '', step.file));
    home.appendChild(el('span', 'gl-lane-loc', step.section + ' | ' + step.line));
    grid.appendChild(home);

    section.appendChild(grid);
    return section;
  }

  fetch('/content/general-lanes.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('lanes ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var page = data && data.pages && data.pages[slug];
      if (!page) return;
      var steps = page.steps;
      if (!Array.isArray(steps) || !steps.length) { renderMode(page); return; }
      var cards = [].slice.call(document.querySelectorAll('.step-card[data-step]'));
      if (!cards.length) { renderMode(page); return; }

      var byStep = {};
      steps.forEach(function (s) { byStep[String(s.n)] = s; });
      var state = load();

      var bar = el('div', 'gl-lane-progress');
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
        var lane = buildLane(step);

        var check = el('label', 'gl-lane-check');
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('data-gl-done', n);
        box.checked = !!state[n];
        check.appendChild(box);
        check.appendChild(document.createTextNode('I did this step here and in the real project. Check: ' + step.check));
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
        bar.appendChild(document.createTextNode(' The browser lane is on this page. The home lane names the real project file.'));
      }

      render();
    })
    .catch(function (e) {
      if (window.console && console.warn) console.warn('general-lanes:', e && e.message ? e.message : e);
    });
})();
