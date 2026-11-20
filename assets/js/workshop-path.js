(function () {
  'use strict';

  var ORDER = [
    { key: 'before', label: 'Before' },
    { key: 'during', label: 'During' },
    { key: 'after', label: 'After' },
    { key: 'next', label: 'Next' }
  ];

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function pageKey() {
    var parts = window.location.pathname.split('/');
    var file = parts[parts.length - 1] || 'index.html';
    return file.replace(/\.html?$/i, '');
  }

  // A2194: every project page gets the same four-slot block. Pages that still
  // carry the build marker keep the server-rendered markup; every other page
  // gets the identical block here, so there is no one-off pattern to maintain.
  function ensureMount() {
    var existing = document.querySelector('[data-workshop-path]');
    if (existing) return existing;

    var section = document.createElement('section');
    section.className = 'ws-path';
    section.setAttribute('data-workshop-path', '');
    section.setAttribute('aria-labelledby', 'ws-path-title');
    section.innerHTML = '<div class="ws-path-inner">' +
      '<p class="ws-path-kicker"><img src="/assets/mascots/stardust-badge.webp" alt="" width="22" height="22" loading="lazy"> Stardust\'s route</p>' +
      '<h2 class="ws-path-title" id="ws-path-title">Before, during, after and next</h2>' +
      '<p class="ws-path-intro">Four small steps so you always know what to do next.</p>' +
      '<dl class="ws-path-grid" data-ws-path-grid></dl>' +
      '</div>';

    var outcome = document.querySelector('.ws-outcome');
    if (outcome && outcome.parentNode) {
      outcome.insertAdjacentElement('afterend', section);
      return section;
    }

    var first = document.querySelector('.step-card, #stepsPanel, .steps-col, #stepBody, .s-body');
    if (first && first.parentNode) {
      first.parentNode.insertBefore(section, first);
      return section;
    }

    var hero = document.querySelector('.hero') || document.querySelector('main > section');
    if (hero && hero.parentNode) {
      hero.insertAdjacentElement('afterend', section);
      return section;
    }

    var main = document.querySelector('main') || document.body;
    main.insertBefore(section, main.firstChild);
    return section;
  }

  function render(mount, path) {
    var grid = mount.querySelector('[data-ws-path-grid]');
    if (!grid) return;
    grid.textContent = '';

    ORDER.forEach(function (step, index) {
      var data = path[step.key];
      if (!data) return;

      var item = make('div', 'ws-path-step');
      var term = document.createElement('dt');
      term.appendChild(make('span', 'ws-path-num', String(index + 1)));
      term.appendChild(make('span', 'ws-path-label', data.label || step.label));
      item.appendChild(term);

      var desc = document.createElement('dd');
      if (data.title) desc.appendChild(make('strong', '', data.title));
      if (data.text) desc.appendChild(make('p', '', data.text));
      if (data.href && data.linkLabel) {
        var link = make('a', 'ws-path-link', data.linkLabel);
        link.href = data.href;
        desc.appendChild(link);
      }
      item.appendChild(desc);
      grid.appendChild(item);
    });
  }

  function start() {
    var mount = ensureMount();
    if (!mount) return;
    var key = mount.getAttribute('data-workshop-path') || pageKey();
    var all = window.JVDS_WORKSHOP_PATHS || {};
    var path = all[key];
    if (!path) {
      mount.hidden = true;
      return;
    }
    render(mount, path);
  }

  var tries = 0;
  function boot() {
    // Dynamically loaded scripts are not guaranteed to run in order, so wait
    // briefly for the data file before rendering (A2194).
    if (!window.JVDS_WORKSHOP_PATHS && tries++ < 60) {
      setTimeout(boot, 50);
      return;
    }
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
