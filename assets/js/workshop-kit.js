/* workshop-kit.js - A2622
   One workshop, two tracks. Adds a top switcher to every workshop page:
     Do it here     - the browser studio for this skill (no install)
     In <engine>    - the existing engine steps
     Make it yours  - three "change one thing" prompts
   The browser track is embedded lazily, so the page stays light until used.
   Data: content/workshop-kits.json (scripts/build-workshop-kits.js). */
(function () {
  'use strict';

  if (window.self !== window.top) return;
  if (/[?&]kit=embed\b/.test(location.search)) return;
  if (!/\/workshops\/[^/]+\.html$/i.test(location.pathname)) return;

  var HUB_SLUGS = {
    workshop: 1, index: 1, 'start-here': 1, 'my-first-series': 1,
    'my-progress': 1, 'learning-lab': 1, 'tiny-learners': 1, learn: 1
  };
  var slug = (location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
  if (!slug || HUB_SLUGS[slug]) return;

  var STORE = 'jvds_kit_track:' + slug;
  var current = null;
  var bar = null;
  var panels = {};
  var hidden = [];
  var lastRemix = -1;

  var style = document.createElement('style');
  style.id = 'ws-kit-styles';
  style.textContent = [
    '.ws-kit{max-width:980px;margin:18px auto 8px;padding:0 16px}',
    '.ws-kit-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;border:1.5px solid rgba(112,163,167,.28);border-radius:14px;background:var(--card,#fff);box-shadow:0 4px 18px rgba(64,59,51,.06)}',
    '[data-theme="dark"] .ws-kit-bar{background:rgba(40,36,30,.92);border-color:rgba(112,163,167,.22)}',
    '.ws-kit-label{font-size:.66rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--charcoal-lt,#5a5449);margin-right:4px;padding-left:4px}',
    '[data-theme="dark"] .ws-kit-label{color:rgba(240,234,214,.55)}',
    '.ws-kit-tab{min-height:44px;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1.5px solid rgba(64,59,51,.14);background:transparent;color:var(--charcoal,#1a1208);font:inherit;font-size:.82rem;font-weight:800;cursor:pointer;white-space:nowrap}',
    '[data-theme="dark"] .ws-kit-tab{color:#f5efe0;border-color:rgba(240,234,214,.16)}',
    '.ws-kit-tab:hover{border-color:rgba(112,163,167,.55)}',
    '.ws-kit-tab[aria-selected="true"]{background:var(--teal-dk,#4e7d80);border-color:var(--teal-dk,#4e7d80);color:#fff}',
    '.ws-kit-panel{margin-top:12px}',
    '.ws-kit-frame{position:relative;border:1.5px solid rgba(64,59,51,.14);border-radius:14px;overflow:hidden;background:#0d1117}',
    '.ws-kit-frame iframe{display:block;width:100%;height:min(78vh,760px);border:0;background:#fff}',
    '.ws-kit-frame-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(112,163,167,.1);font-size:.78rem;font-weight:700;color:var(--charcoal,#1a1208)}',
    '[data-theme="dark"] .ws-kit-frame-head{color:#f5efe0}',
    '.ws-kit-open{font-size:.78rem;font-weight:800;color:var(--teal-dk,#4e7d80);text-decoration:none}',
    '.ws-kit-open:hover{text-decoration:underline}',
    '.ws-kit-note{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:rgba(201,138,46,.12);border:1px solid rgba(201,138,46,.3);font-size:.82rem;line-height:1.5;color:var(--charcoal,#1a1208)}',
    '[data-theme="dark"] .ws-kit-note{color:#f5efe0}',
    '.ws-kit-cover{margin:0 0 16px;border-radius:12px;overflow:hidden;border:1.5px solid rgba(64,59,51,.14);background:#0d1117}',
    '.ws-kit-cover img{display:block;width:100%;height:auto}',
    '.ws-kit-demo{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:0 0 12px}',
    '.ws-kit-demo p{margin:0;font-size:.86rem;line-height:1.5;color:var(--charcoal-lt,#5a5449)}',
    '.ws-kit-demo a,.ws-kit-demo button{border:0;border-radius:9px;padding:10px 16px;font:inherit;font-size:.84rem;font-weight:800;background:var(--teal-dk,#4e7d80);color:#fff;cursor:pointer;text-decoration:none;min-height:42px;display:inline-flex;align-items:center}',
    '.ws-kit-flash{animation:ws-kit-pulse 1.2s ease 2}',
    '@keyframes ws-kit-pulse{0%,100%{box-shadow:0 0 0 0 rgba(112,163,167,0)}50%{box-shadow:0 0 0 6px rgba(112,163,167,.35)}}',
    '.ws-kit-remix{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}',
    '.ws-kit-card{border:1.5px solid rgba(64,59,51,.12);border-radius:14px;padding:14px 16px;background:rgba(112,163,167,.06)}',
    '[data-theme="dark"] .ws-kit-card{background:rgba(112,163,167,.08);border-color:rgba(240,234,214,.14)}',
    '.ws-kit-card h3{margin:0 0 6px;font-family:Fredoka,Inter,sans-serif;font-size:1rem;color:var(--charcoal,#1a1208)}',
    '[data-theme="dark"] .ws-kit-card h3{color:#f5efe0}',
    '.ws-kit-card p{margin:0 0 10px;font-size:.84rem;line-height:1.5;color:var(--charcoal-lt,#5a5449)}',
    '[data-theme="dark"] .ws-kit-card p{color:rgba(240,234,214,.65)}',
    '.ws-kit-card button{border:0;border-radius:8px;padding:9px 12px;font:inherit;font-size:.78rem;font-weight:800;background:var(--teal-dk,#4e7d80);color:#fff;cursor:pointer;min-height:40px}',
    'body.ws-kit-hide-engine .ws-kit-hide{display:none!important}',
    '@media(max-width:520px){.ws-kit-tab{flex:1 1 auto;justify-content:center}.ws-kit-frame iframe{height:65vh}}'
  ].join('');
  document.head.appendChild(style);

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function saveTrack(track) {
    try { localStorage.setItem(STORE, track); } catch (e) {}
  }

  function readTrack() {
    try { return localStorage.getItem(STORE) || 'engine'; } catch (e) { return 'engine'; }
  }

  function collectEngineContent(anchor) {
    if (!anchor || !anchor.parentNode) return;
    var node = anchor.nextElementSibling;
    while (node) {
      var name = node.tagName;
      if (name !== 'SCRIPT' && name !== 'STYLE' && name !== 'NOSCRIPT' && node !== panels.wrap) {
        node.classList.add('ws-kit-hide');
        hidden.push(node);
      }
      node = node.nextElementSibling;
    }
  }

  function buildBrowserPanel(kit) {
    var wrap = el('div', 'ws-kit-panel');
    var frame = el('div', 'ws-kit-frame');
    var head = el('div', 'ws-kit-frame-head');
    var label = el('span', '', kit.browser.title + ' (opens here, no install)');
    var open = el('a', 'ws-kit-open', 'Open full screen');
    open.href = kit.browser.url;
    open.target = '_blank';
    open.rel = 'noopener';
    head.appendChild(label);
    head.appendChild(open);
    frame.appendChild(head);
    var note = el('p', 'ws-kit-note');
    note.hidden = true;
    wrap.appendChild(note);
    wrap.appendChild(frame);
    panels.browser = { wrap: wrap, frame: frame, note: note, mounted: false, kit: kit };
    return wrap;
  }

  function mountBrowserFrame() {
    var p = panels.browser;
    if (!p || p.mounted) return;
    var iframe = document.createElement('iframe');
    iframe.src = p.kit.browser.url + (p.kit.browser.url.indexOf('?') >= 0 ? '&' : '?') + 'kit=embed';
    iframe.title = p.kit.browser.title;
    iframe.loading = 'lazy';
    iframe.setAttribute('allow', 'fullscreen; autoplay');
    p.frame.appendChild(iframe);
    p.mounted = true;
  }

  function showFinished(kit) {
    var target = null;
    try { target = document.querySelector(kit.demo.selector || ''); } catch (e) { target = null; }
    if (!target) target = document.querySelector('canvas, .cw-canvas-panel');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('ws-kit-flash');
    setTimeout(function () { target.classList.remove('ws-kit-flash'); }, 2600);
  }

  function buildSeePanel(kit) {
    var wrap = el('div', 'ws-kit-panel');
    var demo = kit.demo;
    if (demo && (demo.kind === 'demo' || demo.kind === 'game')) {
      var head = el('div', 'ws-kit-frame-head');
      head.appendChild(el('span', '', demo.kind === 'game' ? demo.label : 'Play the finished build'));
      var open = el('a', 'ws-kit-open', 'Open full screen');
      open.href = demo.url;
      open.target = '_blank';
      open.rel = 'noopener';
      head.appendChild(open);
      var frame = el('div', 'ws-kit-frame');
      frame.appendChild(head);
      var iframe = document.createElement('iframe');
      iframe.src = demo.url + (demo.url.indexOf('?') >= 0 ? '&' : '?') + 'kit=embed';
      iframe.title = demo.label;
      iframe.loading = 'lazy';
      iframe.setAttribute('allow', 'fullscreen; autoplay');
      frame.appendChild(iframe);
      wrap.appendChild(frame);
    } else if (!demo && kit.demoReason) {
      var reasonRow = el('div', 'ws-kit-demo');
      reasonRow.appendChild(el('p', '', kit.demoReason));
      if (kit.browser && !kit.browser.self) {
        var studioBtn = el('button', '', 'Open the browser studio');
        studioBtn.type = 'button';
        studioBtn.addEventListener('click', function () { setState('browser'); });
        reasonRow.appendChild(studioBtn);
      } else if (kit.engineTrack) {
        var stepsBtn = el('button', '', 'Show me the steps');
        stepsBtn.type = 'button';
        stepsBtn.addEventListener('click', function () { setState('engine'); });
        reasonRow.appendChild(stepsBtn);
      }
      wrap.appendChild(reasonRow);
    } else if (demo) {
      var row = el('div', 'ws-kit-demo');
      row.appendChild(el('p', '', demo.kind === 'external'
        ? 'Play the finished thing before you start. Notice one thing you want to change.'
        : 'Watch the finished build work before you type anything. Notice one thing you want to change.'));
      if (demo.kind === 'external') {
        var a = el('a', '', demo.label);
        a.href = demo.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        row.appendChild(a);
      } else {
        var b = el('button', '', demo.label);
        b.type = 'button';
        b.addEventListener('click', function () { showFinished(kit); });
        row.appendChild(b);
      }
      wrap.appendChild(row);
    }
    if (kit.cover) {
      var fig = el('figure', 'ws-kit-cover');
      var img = document.createElement('img');
      img.src = kit.cover;
      img.alt = 'Preview of ' + kit.title;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 960;
      img.height = 504;
      fig.appendChild(img);
      wrap.appendChild(fig);
    }
    panels.see = { wrap: wrap };
    return wrap;
  }

  function injectCover(kit) {
    if (!kit.cover) return;
    var inner = document.querySelector('.ws-outcome-inner');
    if (!inner || inner.querySelector('.ws-kit-cover')) return;
    var fig = el('figure', 'ws-kit-cover');
    var img = document.createElement('img');
    img.src = kit.cover;
    img.alt = 'Preview of ' + kit.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 960;
    img.height = 504;
    fig.appendChild(img);
    inner.insertBefore(fig, inner.firstChild);
  }

  function buildRemixPanel(kit) {
    var wrap = el('div', 'ws-kit-panel');
    var grid = el('div', 'ws-kit-remix');
    var note = el('p', 'ws-kit-note');
    note.hidden = true;

    (kit.remix || []).forEach(function (r, i) {
      var card = el('div', 'ws-kit-card');
      card.appendChild(el('h3', '', r.title));
      card.appendChild(el('p', '', r.body));
      var btn = el('button', '', kit.browser && !kit.browser.self ? 'Try this in the browser' : 'Try this');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        lastRemix = i;
        note.textContent = r.title + ': ' + r.body;
        note.hidden = false;
        if (kit.browser && !kit.browser.self) {
          if (panels.browser && panels.browser.note) {
            panels.browser.note.textContent = 'Your change: ' + r.title + '. ' + r.body;
            panels.browser.note.hidden = false;
          }
          setState('browser');
        } else {
          var target = document.querySelector('canvas, #app, #bsHost, .studio, .builder, .cw-canvas-panel');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      card.appendChild(btn);
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    wrap.appendChild(note);
    panels.remix = { wrap: wrap, note: note, kit: kit };
    return wrap;
  }

  function setState(next) {
    if (!current) return;
    var kit = current;
    var isEngine = next === 'engine';
    bar.querySelectorAll('.ws-kit-tab').forEach(function (b) {
      b.setAttribute('aria-selected', b.dataset.track === next ? 'true' : 'false');
    });

    panels.wrap.innerHTML = '';
    document.body.classList.remove('ws-kit-hide-engine');

    if (next === 'browser' && kit.browser && !kit.browser.self) {
      panels.wrap.appendChild(panels.browser.wrap);
      mountBrowserFrame();
      document.body.classList.add('ws-kit-hide-engine');
    } else if (next === 'see' && panels.see) {
      panels.wrap.appendChild(panels.see.wrap);
    } else if (next === 'remix') {
      panels.wrap.appendChild(panels.remix.wrap);
      if (kit.engineTrack) document.body.classList.add('ws-kit-hide-engine');
    }

    if (isEngine) {
      document.body.classList.remove('ws-kit-hide-engine');
    }
    saveTrack(next);
  }

  function buildBar(kit) {
    var wrap = el('div', 'ws-kit');
    var barEl = el('div', 'ws-kit-bar');
    barEl.setAttribute('role', 'tablist');
    barEl.setAttribute('aria-label', 'How to make this');
    barEl.appendChild(el('span', 'ws-kit-label', 'Make it'));

    function tab(track, text, title) {
      var b = el('button', 'ws-kit-tab', text);
      b.type = 'button';
      b.dataset.track = track;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      if (title) b.title = title;
      b.addEventListener('click', function () { setState(track); });
      barEl.appendChild(b);
      return b;
    }

    if (kit.demo || kit.cover || kit.demoReason) {
      tab('see', 'See it', 'See what you are going to make');
    }
    if (kit.browser && !kit.browser.self) {
      tab('browser', 'Do it here', 'Build a browser version in ' + kit.browser.title);
    }
    if (kit.engineTrack) {
      tab('engine', kit.engineTrack.label, 'Follow the steps in ' + kit.engine);
    }
    tab('remix', 'Make it yours', 'Three changes that make it your own');

    wrap.appendChild(barEl);
    panels.wrap = el('div');
    wrap.appendChild(panels.wrap);

    if (kit.demo || kit.cover || kit.demoReason) buildSeePanel(kit);
    if (kit.browser && !kit.browser.self) buildBrowserPanel(kit);
    buildRemixPanel(kit);

    bar = barEl;
    return wrap;
  }

  function place(anchor, node) {
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(node, anchor);
    else {
      var main = document.querySelector('main') || document.body;
      main.insertBefore(node, main.firstChild);
    }
  }

  function start(kit) {
    if (document.querySelector('.ws-kit')) return;
    current = kit;
    var anchor = document.querySelector('.ws-outcome') || document.querySelector('main') || document.querySelector('h1');
    var node = buildBar(kit);
    place(anchor, node);
    collectEngineContent(node);
    injectCover(kit);
    var track = readTrack();
    if (track === 'browser' && !(kit.browser && !kit.browser.self)) track = 'engine';
    if (track === 'see' && !panels.see) track = 'engine';
    if (track === 'remix' && !panels.remix) track = 'engine';
    setState(track);
  }

  fetch('/content/workshop-kits.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('kits ' + r.status); return r.json(); })
    .then(function (data) {
      var kit = (data.kits || []).filter(function (k) { return k.id === slug; })[0];
      if (kit) start(kit);
    })
    .catch(function () {});
})();

