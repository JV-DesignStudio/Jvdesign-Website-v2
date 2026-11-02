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
    var mount = document.querySelector('[data-workshop-path]');
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
