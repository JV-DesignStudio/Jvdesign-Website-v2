/* assets/js/unreal-lanes.js (A3097)
   Adds the two-lane strip to every Unreal workshop step:
     At school  - the hands-on Mod Studio in the browser (no install)
     At home    - the same step in real Unreal, with file, section and line
   Data: content/unreal-lanes.json. One step spine stays the page's own step
   cards, so the existing quizzes, order challenges and finish banner keep
   working. The tick is a "did both lanes" marker saved on this device. */
(function () {
  'use strict';

  if (window.self !== window.top) return;
  var m = location.pathname.match(/\/workshops\/(unreal-[a-z0-9-]+)\.html$/i);
  if (!m) return;
  var slug = m[1];
  var STORE = 'jvds-unreal-lane:' + slug;

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/style-unreal-lanes.css';
  css.id = 'ue-lane-css';
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

  function buildLane(step, studio) {
    var section = el('section', 'ue-lane');
    section.setAttribute('data-ue-step', String(step.n));
    section.setAttribute('aria-label', 'Step ' + step.n + ' in two lanes');

    var head = el('div', 'ue-lane-head');
    head.appendChild(el('span', 'ue-lane-kicker', 'Two lanes, same step'));
    head.appendChild(el('h3', 'ue-lane-title', 'Do it in the browser or in Unreal'));
    section.appendChild(head);

    var grid = el('div', 'ue-lane-grid');

    var school = el('div', 'ue-lane-card ue-lane-card--school');
    school.appendChild(el('span', 'ue-lane-label', 'At school, in the browser'));
    school.appendChild(el('p', '', step.school));
    var open = el('a', 'ue-lane-open', 'Open the Mod Studio');
    open.href = studio;
    school.appendChild(open);
    var tab = el('span', '', ' Use the ' + step.tab + ' tab.');
    tab.style.fontSize = '.78rem';
    school.appendChild(tab);
    grid.appendChild(school);

    var home = el('div', 'ue-lane-card ue-lane-card--home');
    home.appendChild(el('span', 'ue-lane-label', 'At home, in real Unreal Engine'));
    home.appendChild(el('p', '', step.home));
    home.appendChild(el('code', '', step.file));
    home.appendChild(el('span', 'ue-lane-loc', step.section + ' | ' + step.line));
    grid.appendChild(home);

    section.appendChild(grid);
    return section;
  }

  fetch('/content/unreal-lanes.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('lanes ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var steps = data && data.pages && data.pages[slug];
      if (!Array.isArray(steps) || !steps.length) return;
      var studio = data.studio || '/workshops/unreal-mod-studio.html';
      var cards = [].slice.call(document.querySelectorAll('.step-card[data-step]'));
      if (!cards.length) return;

      var byStep = {};
      steps.forEach(function (s) { byStep[String(s.n)] = s; });
      var state = load();

      var bar = el('div', 'ue-lane-progress');
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

        var check = el('label', 'ue-lane-check');
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('data-ue-done', n);
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
        bar.appendChild(document.createTextNode(' Every step works in the browser studio, so no Unreal install is needed at school.'));
      }

      render();
    })
    .catch(function (e) {
      if (window.console && console.warn) console.warn('unreal-lanes:', e && e.message ? e.message : e);
    });
})();
