// A2329: register the service worker and show a non-blocking refresh prompt
// when a newer version takes over while the page is open. The worker versions
// its caches (see sw.js CACHE) and deletes the old ones on activate.
(function () {
  if (!('serviceWorker' in navigator)) return;

  var hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register('/sw.js').catch(function () {});

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    // The first controllerchange is the initial install, not an update.
    if (!hadController) { hadController = true; return; }
    showUpdateBanner();
  });

  function showUpdateBanner() {
    if (document.getElementById('jvds-update-banner')) return;
    var host = document.body || document.documentElement;
    if (!host) return;

    var bar = document.createElement('div');
    bar.id = 'jvds-update-banner';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.style.cssText = [
      'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:9999',
      'display:flex', 'gap:12px', 'align-items:center', 'justify-content:space-between',
      'flex-wrap:wrap',
      'background:var(--card,#28241e)', 'color:var(--charcoal,#f5efe0)',
      'border:1.5px solid var(--border,rgba(240,234,214,.28))', 'border-radius:12px',
      'padding:10px 14px', 'font:600 .9rem/1.35 Inter,system-ui,sans-serif',
      'box-shadow:0 6px 24px rgba(0,0,0,.28)'
    ].join(';');

    var msg = document.createElement('span');
    msg.textContent = 'A newer version of this studio is ready.';

    var actions = document.createElement('span');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0';

    var refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = 'Refresh';
    refresh.style.cssText = 'background:var(--teal-dk,#4e7d80);color:#fff;border:none;border-radius:8px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer';
    refresh.addEventListener('click', function () { location.reload(); });

    var later = document.createElement('button');
    later.type = 'button';
    later.textContent = 'Later';
    later.style.cssText = 'background:transparent;color:var(--charcoal,#f5efe0);border:1.5px solid var(--border,rgba(240,234,214,.35));border-radius:8px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer';
    later.addEventListener('click', function () { bar.remove(); });

    actions.appendChild(refresh);
    actions.appendChild(later);
    bar.appendChild(msg);
    bar.appendChild(actions);
    host.appendChild(bar);
  }
})();
