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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
