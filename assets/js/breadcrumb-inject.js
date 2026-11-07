/* breadcrumb-inject.js (A1641)
   Reads the first BreadcrumbList JSON-LD block on the page and renders
   a visible <nav class="breadcrumb" aria-label="Breadcrumb"> immediately
   before <main id="main-content">. No-ops if the nav already exists or
   no BreadcrumbList is found.
*/
(function () {
  function init() {
    if (document.querySelector('nav.breadcrumb[aria-label="Breadcrumb"]')) return;

    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var items = null;
    for (var i = 0; i < scripts.length; i++) {
      try {
        var d = JSON.parse(scripts[i].textContent);
        if (d['@type'] === 'BreadcrumbList' && Array.isArray(d.itemListElement)) {
          items = d.itemListElement;
          break;
        }
      } catch (e) {}
    }
    if (!items || items.length < 2) return;

    var ol = document.createElement('ol');
    items.forEach(function (item, idx) {
      var li = document.createElement('li');
      if (idx === items.length - 1) {
        var span = document.createElement('span');
        span.setAttribute('aria-current', 'page');
        span.textContent = item.name;
        li.appendChild(span);
      } else {
        var a = document.createElement('a');
        a.href = item.item || '/';
        a.textContent = item.name;
        li.appendChild(a);
      }
      ol.appendChild(li);
    });

    var nav = document.createElement('nav');
    nav.className = 'breadcrumb';
    nav.setAttribute('aria-label', 'Breadcrumb');
    nav.appendChild(ol);

    var main = document.getElementById('main-content');
    if (main && main.parentNode) {
      main.parentNode.insertBefore(nav, main);
    } else {
      var body = document.querySelector('body');
      if (body) body.prepend(nav);
    }
  }

  /* A2793: a no-dead-ends banner on workshop pages. The workshop finder labels
     every card, but a learner can arrive here from search or a shared link
     without seeing it. Read the generated needs manifest and, when this page
     needs an install, point at the browser studio for the same engine. */
  function needsBanner() {
    if (location.pathname.indexOf('/workshops/') !== 0) return;
    if (document.getElementById('jvds-needs-banner')) return;
    if (typeof fetch !== 'function') return;

    fetch('/content/workshop-needs.json', { cache: 'force-cache' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (list) {
        if (!Array.isArray(list)) return;
        var path = location.pathname;
        var hit = null;
        for (var i = 0; i < list.length; i++) {
          var url = String(list[i].url || '');
          if (url && path.slice(-url.length) === url) { hit = list[i]; break; }
        }
        if (!hit || hit.needs === 'browser') return;
        renderNeedsBanner(hit);
      })
      .catch(function () {});
  }

  function renderNeedsBanner(entry) {
    var main = document.getElementById('main-content');
    if (!main || !main.parentNode) return;

    var wrap = document.createElement('section');
    wrap.id = 'jvds-needs-banner';
    wrap.setAttribute('role', 'note');
    wrap.setAttribute('aria-label', 'What this workshop needs');
    wrap.style.cssText = 'margin:0 auto 14px;max-width:860px;padding:12px 14px;border-radius:12px;border:1px solid var(--gold,#c98a2e);background:var(--gold-lt,#faf1e0);color:var(--charcoal,#1a1208);display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-family:Inter,system-ui,sans-serif;line-height:1.45;';

    var label = document.createElement('span');
    label.textContent = 'Heads up';
    label.style.cssText = 'flex-shrink:0;font-size:.62rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:var(--gold,#c98a2e);color:#fff;';

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;min-width:200px;';
    var title = document.createElement('strong');
    title.style.cssText = 'display:block;font-size:.9rem;';
    var engine = entry.engine || 'a desktop tool';
    title.textContent = 'This workshop needs ' + engine + ' installed.';
    var text = document.createElement('span');
    text.style.cssText = 'display:block;font-size:.82rem;color:var(--charcoal-lt,#3d3224);margin-top:2px;';
    var alt = entry.alternative;
    text.textContent = alt
      ? 'You can start right now in ' + alt.title + ', which runs in your browser with nothing to install.'
      : 'See the workshops that run right now in your browser with nothing to install.';
    body.appendChild(title);
    body.appendChild(text);

    var cta = document.createElement('a');
    cta.href = alt ? alt.url : '/pages/workshop.html?works-here=1';
    cta.textContent = alt ? 'Start in the browser' : 'Show browser-only workshops';
    cta.style.cssText = 'flex-shrink:0;display:inline-block;padding:9px 16px;border-radius:999px;background:var(--teal-dk,#4e7d80);color:#fff;text-decoration:none;font-weight:800;font-size:.8rem;white-space:nowrap;';

    wrap.appendChild(label);
    wrap.appendChild(body);
    wrap.appendChild(cta);

    var breadcrumb = document.querySelector('nav.breadcrumb[aria-label="Breadcrumb"]');
    var anchor = breadcrumb || main;
    anchor.parentNode.insertBefore(wrap, anchor);
  }

  function start() {
    needsBanner();
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
