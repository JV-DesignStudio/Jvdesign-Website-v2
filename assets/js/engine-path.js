/* assets/js/engine-path.js (A2431)
   "Ready for the next course?" checkpoint for any engine hub. The learner
   ticks the skills they have, and the page names the next workshop and the
   prerequisite it expects. One generic script replaces the Blender-only
   blender-path.js (A1925), keyed per engine so paths do not share state. */
(function () {
  'use strict';
  var roots = [].slice.call(document.querySelectorAll('[data-engine-check]'));
  if (!roots.length) return;

  function camel(value) {
    return String(value || '').replace(/(^|-)([a-z0-9])/g, function (_, _sep, ch) {
      return ch.toUpperCase();
    });
  }

  roots.forEach(function (root) {
    var engine = String(root.getAttribute('data-engine') || 'engine').replace(/[^a-z0-9-]/gi, '');
    if (!engine) return;

    var KEY = 'jvds-' + engine + '-path-v1';
    var checks = [].slice.call(root.querySelectorAll('[data-skill]'));
    var nextText = root.querySelector('[data-next-text]');
    var nextLink = root.querySelector('[data-next-link]');

    var steps = [];
    try {
      steps = JSON.parse(root.getAttribute('data-steps') || '[]');
    } catch (e) { steps = []; }
    if (!Array.isArray(steps) || !steps.length || !checks.length) return;

    function load() {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var d = JSON.parse(raw);
          if (d && Array.isArray(d.skills)) {
            return checks.map(function (c, i) { return !!d.skills[i]; });
          }
        }
      } catch (e) { /* storage can be blocked on school devices */ }
      return checks.map(function () { return false; });
    }

    var state = load();

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify({ skills: state })); } catch (e) { /* keep going */ }
    }

    function firstMissing() {
      for (var i = 0; i < state.length; i++) {
        if (!state[i]) return i;
      }
      return state.length;
    }

    function currentStep() {
      return steps[Math.min(firstMissing(), steps.length - 1)];
    }

    function render() {
      var step = currentStep();
      if (nextText) nextText.textContent = step.text;
      if (nextLink) {
        nextLink.href = step.href;
        nextLink.textContent = step.label + ' \u2192';
      }
    }

    checks.forEach(function (c, i) {
      c.checked = !!state[i];
      c.addEventListener('change', function () {
        state[i] = c.checked;
        save();
        render();
      });
    });

    var api = {
      state: function () { return state.slice(); },
      next: function () { return currentStep(); }
    };
    window['__jvds' + camel(engine) + 'Path'] = api;
    if (engine === 'blender') window.__jvdsBlenderPath = api;

    render();
  });
})();
