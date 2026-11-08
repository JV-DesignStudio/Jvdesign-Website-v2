(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (reduce.matches || !fine.matches) return;

  var SEL = '.course-card,.ws-path-card,.ws-tool-card,.ws-dl-card,.ws-live-card,.ws-help-pill';

  function mark(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.matches && root.matches(SEL)) root.classList.add('ws-fun-card');
    if (!root.querySelectorAll) return;
    var nodes = root.querySelectorAll(SEL);
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('ws-fun-card');
  }

  mark(document);

  if (window.MutationObserver) {
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) mark(added[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  var active = null;
  var frame = 0;
  var pending = null;

  function clear(el) {
    if (!el) return;
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  }

  function tick() {
    frame = 0;
    var e = pending;
    if (!e) return;

    var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (!el) {
      clear(active);
      active = null;
      return;
    }

    if (el !== active) {
      clear(active);
      active = el;
    }

    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;

    var x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    var y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));

    el.style.setProperty('--mx', x.toFixed(2) + '%');
    el.style.setProperty('--my', y.toFixed(2) + '%');
    el.style.setProperty('--rx', (((50 - y) / 50) * 4).toFixed(2) + 'deg');
    el.style.setProperty('--ry', (((x - 50) / 50) * 4).toFixed(2) + 'deg');
  }

  document.addEventListener('pointermove', function (e) {
    pending = e;
    if (!frame) frame = requestAnimationFrame(tick);
  }, { passive: true });

  document.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget) {
      clear(active);
      active = null;
    }
  }, { passive: true });

  window.addEventListener('scroll', function () {
    clear(active);
    active = null;
  }, { passive: true });
})();
