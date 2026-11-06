// Immersive studio chrome.
// Adds the Studio menu tab and toggles the hidden site header / breadcrumb /
// injected hint. Loaded only by the interactive studios.
(function () {
  if (window.__jvdsStudioTopReady) return;
  window.__jvdsStudioTopReady = true;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function makeTab() {
    if (document.getElementById('studioTopTab')) return;
    var tab = document.createElement('button');
    tab.id = 'studioTopTab';
    tab.type = 'button';
    tab.className = 'studio-top-tab';
    tab.setAttribute('aria-expanded', 'false');
    if (document.getElementById('siteHeader')) tab.setAttribute('aria-controls', 'siteHeader');
    tab.innerHTML = '<span class="studio-top-tab-icon" aria-hidden="true">\u2630</span><span class="studio-top-tab-label">Studio menu</span>';
    tab.addEventListener('click', function () { toggle(); });
    var skip = document.body.querySelector('a.skip-link');
    if (skip && skip.parentNode === document.body) document.body.insertBefore(tab, skip.nextSibling);
    else document.body.insertBefore(tab, document.body.firstChild);
  }

  function toggle(open) {
    var next = (typeof open === 'boolean') ? open : !document.body.classList.contains('studio-top-open');
    document.body.classList.toggle('studio-top-open', next);
    var tab = document.getElementById('studioTopTab');
    if (tab) {
      tab.setAttribute('aria-expanded', next ? 'true' : 'false');
      var label = tab.querySelector('.studio-top-tab-label');
      if (label) label.textContent = next ? 'Close menu' : 'Studio menu';
    }
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 300);
  }

  window.studioTopToggle = function () { toggle(); };
  window.studioTopOpen = function () { toggle(true); };
  window.studioTopClose = function () { toggle(false); };

  ready(makeTab);
  window.addEventListener('load', function () {
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 120);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('studio-top-open')) toggle(false);
  });
})();
