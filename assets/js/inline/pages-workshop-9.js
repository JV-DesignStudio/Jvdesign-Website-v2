(function () {
  var OPEN_BY_DEFAULT = 0;
  var CARD_SEL = '.article-card, .course-card, .ws-dl-card';
  var PREVIEW_COUNT = 6;

  function panels() {
    return [].slice.call(document.querySelectorAll('.ws-section, #catalogue')).map(function (sec) {
      var head = sec.querySelector('.ws-section-head');
      var body = head ? head.nextElementSibling : null;
      if (!head || !body) return null;
      return { sec: sec, head: head, body: body, count: sec.querySelectorAll(CARD_SEL).length, catalogueOpen: false, showAllBtn: null };
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

  function noun(p, count) {
    var one = p.sec.getAttribute('data-count-noun') || 'workshop';
    var many = p.sec.getAttribute('data-count-noun-plural') || (one + 's');
    return count === 1 ? one : many;
  }

  function setOpen(p, open) {
    if (p.sec.id === 'catalogue') {
      p.catalogueOpen = open;
      p.body.hidden = false;
      p.body.classList.toggle('is-preview', !open);
      if (p.showAllBtn) {
        p.showAllBtn.hidden = finderActive();
        p.showAllBtn.textContent = open ? 'Show fewer workshops' : 'Show all ' + p.count + ' workshops';
        p.showAllBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      return;
    }
    p.body.hidden = !open;
    p.head.classList.toggle('ws-open', open);
    p.head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* Curate a beginner-friendly mix first, then widen to one card per engine. */
  function markPreview(grid) {
    var cards = [].slice.call(grid.querySelectorAll('.course-card'));
    var preferred = ['Scratch', 'Roblox', 'Godot', 'Minecraft', 'Python', 'JavaScript'];
    var picked = [];
    var used = {};

    function pick(card) {
      if (!card || used[card]) return;
      used[card] = 1;
      picked.push(card);
    }

    preferred.forEach(function (engine) {
      if (picked.length >= PREVIEW_COUNT) return;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].getAttribute('data-engine') === engine) { pick(cards[i]); break; }
      }
    });

    var seen = {};
    picked.forEach(function (card) { seen[card.getAttribute('data-engine') || ''] = 1; });
    for (var i = 0; i < cards.length && picked.length < PREVIEW_COUNT; i++) {
      var engine = cards[i].getAttribute('data-engine') || '';
      if (!seen[engine]) {
        seen[engine] = 1;
        pick(cards[i]);
      }
    }

    for (var j = 0; j < cards.length && picked.length < PREVIEW_COUNT; j++) pick(cards[j]);
    picked.forEach(function (card) { card.setAttribute('data-workshop-preview', 'true'); });
  }

  var list = panels();
  if (!list.length) return;

  list.forEach(function (p, i) {
    // Keep any existing grid id (the finder and its tests target #catalogueGrid).
    var id = p.body.id || ('ws-panel-' + i);
    p.body.id = id;

    // The injected count is derived from the rendered cards, so it is the source of
    // truth. Remove any hand-written .ws-section-count first so counts never appear twice.
    p.head.querySelectorAll('.ws-section-count').forEach(function (el) { el.remove(); });

    var count = document.createElement('span');
    count.className = 'ws-sec-count';
    count.textContent = p.count + ' ' + noun(p, p.count);
    var target = p.head.querySelector('h2, h3, .ws-section-title') || p.head;
    target.appendChild(count);

    if (p.sec.id === 'catalogue') {
      markPreview(p.body);
      var showAll = document.createElement('button');
      showAll.type = 'button';
      showAll.className = 'ws-show-all';
      showAll.setAttribute('aria-controls', id);
      showAll.addEventListener('click', function () {
        setOpen(p, !p.catalogueOpen);
      });
      p.body.parentNode.insertBefore(showAll, p.body.nextSibling);
      p.showAllBtn = showAll;
      setOpen(p, false);
      return;
    }

    p.head.classList.add('ws-toggle');
    p.head.setAttribute('role', 'button');
    p.head.setAttribute('tabindex', '0');
    p.head.setAttribute('aria-controls', id);

    var chev = document.createElement('span');
    chev.className = 'ws-chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▾';
    p.head.appendChild(chev);

    setOpen(p, i < OPEN_BY_DEFAULT);

    function toggle() {
      var nowOpen = p.body.hidden;
      setOpen(p, nowOpen);
      if (nowOpen && window.JVDS && window.JVDS.announce) {
        window.JVDS.announce('Opened ' + p.count + ' ' + noun(p, p.count));
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
      if (e.target.closest('.ws-finder, .ws-filter-bar, #workshopSearch, [data-format], [data-age-filter], .ws-install-btn, #workshopReset')) {
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
