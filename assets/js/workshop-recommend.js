/* workshop-recommend.js - A2620
   Shows three contextual next workshops at the end of any workshop page.
   Picks from content/workshops.json by engine, then level, then age, and skips
   anything the learner has already finished (playerProfile). The full
   catalogue stays one click away. */
(function () {
  'use strict';

  if (!/\/workshops\//i.test(location.pathname)) return;

  var HUB_SLUGS = {
    workshop: 1, index: 1, 'start-here': 1, 'my-first-series': 1,
    'my-progress': 1, 'learning-lab': 1, 'tiny-learners': 1, learn: 1
  };
  var slug = (location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
  if (!slug || HUB_SLUGS[slug]) return;

  var style = document.createElement('style');
  style.id = 'ws-rec-styles';
  style.textContent = [
    '.ws-rec{margin:40px auto 8px;max-width:980px;padding:0 16px}',
    '.ws-rec-inner{border:1px solid rgba(112,163,167,.28);border-radius:18px;padding:22px 24px;background:var(--card,#fff);box-shadow:0 6px 24px rgba(64,59,51,.07)}',
    '[data-theme="dark"] .ws-rec-inner{background:rgba(40,36,30,.9);border-color:rgba(112,163,167,.22)}',
    '.ws-rec-kicker{font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-dk,#4e7d80);margin:0 0 6px}',
    '.ws-rec-title{font-family:Fredoka,Inter,sans-serif;font-size:1.25rem;font-weight:700;color:var(--charcoal,#1a1208);margin:0 0 16px;line-height:1.25}',
    '[data-theme="dark"] .ws-rec-title{color:#f5efe0}',
    '.ws-rec-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}',
    '.ws-rec-card{display:flex;flex-direction:column;gap:6px;padding:14px 16px;border-radius:14px;border:1.5px solid rgba(64,59,51,.12);background:rgba(112,163,167,.06);text-decoration:none;transition:transform .15s,border-color .15s}',
    '.ws-rec-card:hover,.ws-rec-card:focus-visible{transform:translateY(-2px);border-color:rgba(112,163,167,.5)}',
    '[data-theme="dark"] .ws-rec-card{background:rgba(112,163,167,.08);border-color:rgba(240,234,214,.14)}',
    '.ws-rec-tag{font-size:.64rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--teal-dk,#4e7d80)}',
    '[data-theme="dark"] .ws-rec-tag{color:#91c9cc}',
    '.ws-rec-name{font-weight:700;font-size:.95rem;line-height:1.35;color:var(--charcoal,#1a1208)}',
    '[data-theme="dark"] .ws-rec-name{color:#f5efe0}',
    '.ws-rec-meta{font-size:.74rem;color:var(--charcoal-lt,#5a5449)}',
    '[data-theme="dark"] .ws-rec-meta{color:rgba(240,234,214,.6)}',
    '.ws-rec-all{display:inline-block;margin-top:14px;font-size:.8rem;font-weight:700;color:var(--teal-dk,#4e7d80);text-decoration:none}',
    '.ws-rec-all:hover{text-decoration:underline}',
    '@media(max-width:420px){.ws-rec-inner{padding:18px}.ws-rec-grid{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(style);

  function minutes(w) {
    var explicit = parseInt(w.minutes, 10);
    if (isFinite(explicit) && explicit > 0) return explicit;
    var steps = parseInt(w.steps, 10);
    var base = isFinite(steps) && steps > 0 ? steps * 5 : 20;
    return Math.max(10, Math.min(90, base));
  }

  function readDone() {
    var done = {};
    try {
      var p = window.playerProfile && window.playerProfile.state;
      if (p && Array.isArray(p.completedWorkshops)) {
        p.completedWorkshops.forEach(function (id) { done[id] = true; });
      }
    } catch (e) {}
    return done;
  }

  function pick(list, current, done) {
    var pool = list.filter(function (w) {
      return w && w.id !== current.id && w.url && !done[w.id];
    });
    var picks = [];
    function add(w) {
      if (!w || picks.length >= 3) return;
      if (picks.some(function (p) { return p.id === w.id; })) return;
      picks.push(w);
    }
    var seriesPrefix = String(current.title || '').split(/episode|part\s*\d|ep\s*\d/i)[0].trim().slice(0, 30);
    pool.filter(function (w) { return seriesPrefix && w.title && w.title.indexOf(seriesPrefix) === 0; }).forEach(add);
    pool.filter(function (w) { return w.engine === current.engine && w.difficulty === current.difficulty; }).forEach(add);
    pool.filter(function (w) { return w.engine === current.engine; }).forEach(add);
    pool.filter(function (w) { return w.difficulty === current.difficulty; }).forEach(add);
    pool.filter(function (w) { return w.difficulty === 'beginner'; }).forEach(add);
    pool.forEach(add);
    return picks;
  }

  function card(w) {
    var a = document.createElement('a');
    a.className = 'ws-rec-card';
    a.href = w.url;
    var tag = document.createElement('span');
    tag.className = 'ws-rec-tag';
    tag.textContent = [w.engine, w.difficulty].filter(Boolean).join(' · ');
    var name = document.createElement('span');
    name.className = 'ws-rec-name';
    name.textContent = w.title;
    var meta = document.createElement('span');
    meta.className = 'ws-rec-meta';
    meta.textContent = '~' + minutes(w) + ' min · Ages ' + (w.ageRange || '8+');
    a.appendChild(tag);
    a.appendChild(name);
    a.appendChild(meta);
    return a;
  }

  function render(current, list) {
    var done = readDone();
    var picks = pick(list, current, done);
    if (!picks.length) return;

    var aside = document.createElement('aside');
    aside.className = 'ws-rec';
    aside.setAttribute('aria-labelledby', 'ws-rec-title');

    var inner = document.createElement('div');
    inner.className = 'ws-rec-inner';

    var kicker = document.createElement('p');
    kicker.className = 'ws-rec-kicker';
    kicker.textContent = 'Three things to try next';

    var title = document.createElement('h2');
    title.className = 'ws-rec-title';
    title.id = 'ws-rec-title';
    title.textContent = 'Pick one and keep going';

    var grid = document.createElement('div');
    grid.className = 'ws-rec-grid';
    picks.forEach(function (w) { grid.appendChild(card(w)); });

    var all = document.createElement('a');
    all.className = 'ws-rec-all';
    all.href = '/workshop';
    all.textContent = 'Or browse every workshop';

    inner.appendChild(kicker);
    inner.appendChild(title);
    inner.appendChild(grid);
    inner.appendChild(all);
    aside.appendChild(inner);

    var footer = document.querySelector('footer.site-footer');
    var parent = footer && footer.parentNode ? footer.parentNode : document.body;
    if (footer) parent.insertBefore(aside, footer);
    else parent.appendChild(aside);
  }

  fetch('/content/workshops.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('workshops ' + r.status); return r.json(); })
    .then(function (list) {
      if (!Array.isArray(list)) return;
      var current = list.filter(function (w) { return w.id === slug; })[0];
      if (!current) return;
      render(current, list);
    })
    .catch(function () {});
})();
