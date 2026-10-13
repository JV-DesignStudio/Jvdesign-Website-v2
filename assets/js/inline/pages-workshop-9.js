(function () {
  var OPEN_BY_DEFAULT = 0;
  var CARD_SEL = '.article-card, .course-card, .ws-dl-card';

  function panels() {
    return [].slice.call(document.querySelectorAll('.ws-section, #catalogue')).map(function (sec) {
      var head = sec.querySelector('.ws-section-head');
      var body = head ? head.nextElementSibling : null;
      if (!head || !body) return null;
      return { sec: sec, head: head, body: body, count: sec.querySelectorAll(CARD_SEL).length };
    }).filter(function (p) { return p && p.count > 0; });
  }

  /* While someone searches or filters they want the whole catalogue open. */
  function finderActive() {
    var q = document.getElementById('workshopSearch');
    if (q && q.value.trim()) return true;
    if (document.getElementById('workshopTool').value || document.getElementById('workshopExperience').value !== 'all') return true;
    var actives = document.querySelectorAll('[data-format].active, [data-age-filter].active');
    for (var i = 0; i < actives.length; i++) {
      var d = actives[i].dataset || {};
      if ((d.format && d.format !== 'all' && d.format !== 'start') || (d.ageFilter && d.ageFilter !== 'all')) return true;
    }
    return false;
  }

  function setOpen(p, open) {
    p.body.hidden = !open;
    p.head.classList.toggle('ws-open', open);
    p.head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  var list = panels();
  if (!list.length) return;

  list.forEach(function (p, i) {
    // Keep any existing grid id (the finder and its tests target #catalogueGrid).
    var id = p.body.id || ('ws-panel-' + i);
    p.body.id = id;

    p.head.classList.add('ws-toggle');
    p.head.setAttribute('role', 'button');
    p.head.setAttribute('tabindex', '0');
    p.head.setAttribute('aria-controls', id);

    // The injected count is derived from the rendered cards, so it is the source of
    // truth. Remove any hand-written .ws-section-count first so counts never appear twice.
    p.head.querySelectorAll('.ws-section-count').forEach(function (el) { el.remove(); });

    var count = document.createElement('span');
    count.className = 'ws-sec-count';
    count.textContent = p.count + (p.count === 1 ? ' workshop' : ' workshops');
    var target = p.head.querySelector('h2, h3, .ws-section-title') || p.head;
    target.appendChild(count);

    var chev = document.createElement('span');
    chev.className = 'ws-chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '⌄';
    p.head.appendChild(chev);

    setOpen(p, i < OPEN_BY_DEFAULT);

    function toggle() {
      var nowOpen = p.body.hidden;
      setOpen(p, nowOpen);
      if (nowOpen && window.JVDS && window.JVDS.announce) {
        window.JVDS.announce('Opened ' + p.count + ' workshops');
      }
    }
    p.head.addEventListener('click', toggle);
    p.head.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  /* Keep the finder authoritative: any search or filter opens everything. */
  var wasActive = false;
  function syncToFinder() {
    var active = finderActive();
    if (active === wasActive) return;
    wasActive = active;
    list.forEach(function (p, i) { setOpen(p, active ? true : i < OPEN_BY_DEFAULT); });
  }
  ['input', 'change', 'click'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('.ws-finder, .ws-filter-bar, #workshopSearch, [data-format], [data-age-filter]')) {
        setTimeout(syncToFinder, 0);
      }
    }, true);
  });

  /* A deep link to a collapsed topic must open it. */
  function openFromHash() {
    if (!location.hash) return;
    var t = document.querySelector(location.hash);
    if (!t) return;
    var p = list.filter(function (x) { return x.sec.contains(t) || x.sec === t; })[0];
    if (p) setOpen(p, true);
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
