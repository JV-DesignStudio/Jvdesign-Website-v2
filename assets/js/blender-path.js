/* A1925: "Ready for the next course?" checkpoint for the Blender hub.
   The learner ticks the skills they have, and the page names the next
   workshop and the prerequisite it expects. Saves in localStorage. */
(function () {
  'use strict';
  var root = document.querySelector('[data-engine-check][data-engine="blender"]');
  if (!root) return;

  var KEY = 'jvds-blender-path-v1';
  var checks = [].slice.call(root.querySelectorAll('[data-skill]'));
  var nextText = root.querySelector('[data-next-text]');
  var nextLink = root.querySelector('[data-next-link]');

  var steps = [];
  try {
    steps = JSON.parse(root.getAttribute('data-steps') || '[]');
  } catch (e) { steps = []; }
  if (!Array.isArray(steps) || !steps.length) return;

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

  window.__jvdsBlenderPath = {
    state: function () { return state.slice(); },
    next: function () { return currentStep(); }
  };

  render();
})();
