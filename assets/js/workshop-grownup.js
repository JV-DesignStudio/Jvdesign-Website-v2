/* A3070: one shared For grown-ups note on every workshop article page.
   The canvas engine has the same note for build-alongs; this is the light
   article version, so a parent and child can work through the steps together. */
(function () {
  'use strict';

  function run() {
    if (document.querySelector('.ws-grownup')) return;
    var anchor = document.querySelector('.ws-outcome') || document.querySelector('.hero') || document.querySelector('main');
    if (!anchor || !anchor.parentNode) return;
    if (!document.getElementById('ws-grownup-style')) {
      var style = document.createElement('style');
      style.id = 'ws-grownup-style';
      style.textContent =
        '.ws-grownup{max-width:820px;margin:14px auto;padding:10px 14px;border:1.5px solid var(--border-lt,#e5e7eb);border-radius:12px;background:var(--bg-secondary,#f5f1e8);color:var(--text-primary,#1a1208);font-size:.88rem;line-height:1.55}' +
        '.ws-grownup summary{cursor:pointer;font-weight:800;color:var(--teal-dk,#4e7d80)}' +
        '.ws-grownup p{margin:8px 0 0}';
      document.head.appendChild(style);
    }
    var box = document.createElement('details');
    box.className = 'ws-grownup';
    box.innerHTML = '<summary>For grown-ups</summary>' +
      '<p>Work through one step at a time. Ask your child to predict what will happen before they press Check or run the code. If it fails, read the message together and fix one thing. Finish by changing one thing of their own.</p>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
