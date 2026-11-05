/* Quest dual-pane layout (A2574 groundwork)
   Turns a [data-quest-layout] container into two panes. Desktop shows both;
   narrow screens get Code / Preview tabs with keyboard support. */
(function (global) {
  'use strict';

  function paneList(root) {
    return Array.prototype.slice.call(root.querySelectorAll('[data-quest-pane]'));
  }

  function show(root, name) {
    if (!root) return;
    var target = name || 'code';
    root.setAttribute('data-active-pane', target);
    root.querySelectorAll('[data-quest-tab]').forEach(function (tab) {
      var on = tab.getAttribute('data-quest-tab') === target;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
  }

  function enhance(root) {
    if (!root || root.dataset.questLayoutReady === '1') return;
    root.dataset.questLayoutReady = '1';
    var panes = paneList(root);
    if (panes.length < 2) return;

    var bar = document.createElement('div');
    bar.className = 'quest-pane-tabs';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Quest panes');

    panes.forEach(function (pane) {
      var name = pane.getAttribute('data-quest-pane');
      var paneId = pane.id || ('quest-' + name + '-pane');
      var tabId = paneId + '-tab';
      pane.id = paneId;
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', tabId);

      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'quest-pane-tab';
      tab.id = tabId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('data-quest-tab', name);
      tab.setAttribute('aria-controls', paneId);
      tab.textContent = name === 'preview' ? 'Preview' : 'Code';
      tab.addEventListener('click', function () { show(root, name); });
      bar.appendChild(tab);
    });

    root.insertBefore(bar, root.firstChild);

    root.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var names = panes.map(function (p) { return p.getAttribute('data-quest-pane'); });
      var current = root.getAttribute('data-active-pane') || 'code';
      var i = names.indexOf(current);
      if (i < 0) i = 0;
      var next = e.key === 'ArrowRight' ? (i + 1) % names.length : (i - 1 + names.length) % names.length;
      show(root, names[next]);
      var tab = root.querySelector('[data-quest-tab="' + names[next] + '"]');
      if (tab) tab.focus();
    });

    show(root, 'code');
  }

  function init() {
    document.querySelectorAll('[data-quest-layout]').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.QuestLayout = { enhance: enhance, show: show, init: init };
})(window);
