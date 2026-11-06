/* A2307/A2316/A2277/A2289/A2298: shared learner kit.
   Accessibility settings travel across pages, tool pages get a next-step
   block, hub cards show load/offline readiness, flagship workshops show an
   offline badge, and first exports award sprite/sound/game badges. */
(function () {
  'use strict';
  var A11Y_KEY = 'jvds_accessibility';
  var BADGE_KEY = 'jvds_first_creation';
  var FLAGSHIP = [
    '/workshops/my-first-browser-game.html',
    '/workshops/my-first-python-game.html',
    '/workshops/my-first-cpp-game.html'
  ];
  var MILESTONE = {
    'pixel-studio': 'sprite', 'sprite-animator': 'sprite', 'character-designer': 'sprite',
    'sound-studio': 'sound', 'sfx-generator': 'sound', 'drum-pad': 'sound', 'music-maker': 'sound',
    'arcade-game-maker': 'game'
  };
  var BUILDER_IDS = {
    'rocket-builder': 1, 'robot-builder': 1, 'castle-builder': 1, 'space-station-builder': 1,
    'fairy-tale-builder': 1, 'pirate-ship-builder': 1, 'steampunk-airship-builder': 1,
    'race-car-builder': 1, 'submarine-builder': 1, 'pirate-cannon-builder': 1, 'phone-stand-builder': 1
  };
  var MOUSE_RECOMMENDED = {
    'pixel-studio': 'Use the Eraser button and the -/+ zoom buttons. Right-click erase and wheel zoom need a mouse.',
    'level-designer': 'Tap to place tiles and use the -/+ zoom buttons. Drag-painting is smoother with a mouse.',
    'arcade-game-maker': 'Use the Erase button and tap to paint. Fine tile painting is easier with a mouse or stylus.',
    'buildlab': 'Use the Build/Orbit touch toggle and the zoom buttons. Precise placement is easier with a mouse.',
    'minecraft-skin-editor': 'Tap to paint and use the zoom bar. Precise 64x64 skin edits are easier with a mouse or stylus.'
  };

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function toolId() {
    var m = location.pathname.match(/\/(?:tools|workshops)\/([^/]+)\.html$/);
    return m ? m[1] : null;
  }

  function applyAccessibility() {
    var s = read(A11Y_KEY);
    if (!s) s = {};
    var root = document.documentElement;
    if (s.textSize) root.style.fontSize = String(s.textSize) + '%';
    root.classList.toggle('reduced-motion', !!s.motion);
    document.body.classList.toggle('high-contrast', !!s.contrast);
    document.body.classList.toggle('reading-font', !!s.font);
  }

  function toast(text) {
    var el = document.createElement('div');
    el.className = 'first-creation-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('show'); }, 20);
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 300); }, 3200);
  }

  function award(kind) {
    if (!kind) return;
    var state = read(BADGE_KEY) || {};
    if (state[kind]) return;
    state[kind] = true;
    write(BADGE_KEY, state);
    toast(kind === 'sprite' ? 'Badge earned: First Sprite' : kind === 'sound' ? 'Badge earned: First Sound' : 'Badge earned: First Game');
    document.dispatchEvent(new CustomEvent('jvds:first-creation', { detail: { kind: kind, state: state } }));
    renderBadges();
  }

  function hookAnalytics() {
    if (hookAnalytics.tries > 20) return;
    if (!window.ToolAnalytics || typeof window.ToolAnalytics.event !== 'function') {
      hookAnalytics.tries++;
      setTimeout(hookAnalytics, 300);
      return;
    }
    if (window.ToolAnalytics.__jvdsBadgeHook) return;
    var orig = window.ToolAnalytics.event;
    window.ToolAnalytics.event = function (name) {
      var result = orig.apply(this, arguments);
      try { if (name === 'tool_export' || name === 'tool_export_click') award(MILESTONE[toolId()]); } catch (e) {}
      return result;
    };
    window.ToolAnalytics.__jvdsBadgeHook = true;
  }

  function renderBadges() {
    if (!/(dev-tools|^\/create)/.test(location.pathname)) return;
    var host = document.getElementById('my-stuff') || document.querySelector('main');
    if (!host || document.getElementById('first-creation-progress')) return;
    var state = read(BADGE_KEY) || {};
    var done = ['sprite', 'sound', 'game'].filter(function (k) { return state[k]; }).length;
    var sec = document.createElement('section');
    sec.id = 'first-creation-progress';
    sec.className = 'first-creation-progress';
    sec.setAttribute('aria-labelledby', 'first-creation-title');
    sec.innerHTML =
      '<div class="first-creation-inner">' +
      '<div class="first-creation-head"><span class="first-creation-kicker">Your first loop</span>' +
      '<h2 id="first-creation-title">Make a sprite, a sound and a game</h2>' +
      '<p>' + done + ' of 3 first creations done.</p></div>' +
      '<ul class="first-creation-badges">' +
      ['sprite:First Sprite', 'sound:First Sound', 'game:First Game'].map(function (pair) {
        var parts = pair.split(':');
        return '<li class="' + (state[parts[0]] ? 'done' : '') + '"><span aria-hidden="true">' +
          (parts[0] === 'sprite' ? '🎨' : parts[0] === 'sound' ? '🔊' : '🎮') + '</span>' +
          '<strong>' + parts[1] + '</strong><small>' + (state[parts[0]] ? 'Earned' : 'Not yet') + '</small></li>';
      }).join('') +
      '</ul></div>';
    host.insertAdjacentElement('afterend', sec);
  }

  function injectNextStep() {
    var id = toolId();
    if (!id || document.getElementById('tool-next-step')) return;
    if (location.pathname.indexOf('/tools/') < 0 && !BUILDER_IDS[id]) return;
    fetch('/content/tools-hub.json', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (hub) {
        if (!hub || !hub.pipelines) return;
        var pipeline = hub.pipelines.find(function (p) { return p.order && p.order.indexOf(id) >= 0; });
        if (!pipeline) return;
        var at = pipeline.order.indexOf(id);
        var nextId = pipeline.order[at + 1] || pipeline.order[0];
        var improveId = pipeline.order[at + 2] || 'arcade-game-maker';
        if (nextId === id) nextId = 'arcade-game-maker';
        var fallback = ['sprite-animator', 'colour-palette', 'pixel-studio', 'arcade-game-maker'];
        var fi = 0;
        while (improveId === id || improveId === nextId) { improveId = fallback[fi++ % fallback.length]; }
        var cards = hub.cards || {};
        var title = function (x) { return (cards[x] && cards[x].cardTitle) || x.replace(/-/g, ' '); };
        var host = document.querySelector('main') || document.body;
        var sec = document.createElement('aside');
        sec.id = 'tool-next-step';
        sec.className = 'tool-next-step';
        sec.setAttribute('aria-labelledby', 'tool-next-step-title');
        sec.innerHTML =
          '<h2 id="tool-next-step-title">What to try next</h2>' +
          '<div class="tool-next-step-grid">' +
          '<a href="/tools/' + esc(nextId) + '.html"><span class="tool-next-step-kicker">Next step</span><strong>' + esc(title(nextId)) + '</strong><span>Keep the same idea moving.</span></a>' +
          '<a href="/tools/' + esc(improveId) + '.html"><span class="tool-next-step-kicker">Improve it</span><strong>' + esc(title(improveId)) + '</strong><span>Add another layer to your project.</span></a>' +
          '</div>';
        host.appendChild(sec);
      })
      .catch(function () {});
  }

  function decorateHubCards() {
    if (!/(dev-tools|^\/create)/.test(location.pathname)) return;
    fetch('/content/tool-weights.json', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (weights) {
        if (!weights) return;
        document.querySelectorAll('.tool-card[data-tool-card]').forEach(function (card) {
          if (card.querySelector('.tool-card-readiness')) return;
          var m = (card.getAttribute('href') || '').match(/\/(?:tools|workshops)\/([^/]+)\.html$/);
          if (!m) return;
          var info = weights[m[1]];
          if (!info) return;
          var meta = document.createElement('span');
          meta.className = 'tool-card-readiness';
          meta.innerHTML = '<span class="tool-card-weight">~' + info.kb + ' KB</span>' +
            '<span class="' + (info.offline ? 'tool-card-offline' : 'tool-card-online') + '">' +
            (info.offline ? 'Offline ready' : 'Online first') + '</span>';
          card.appendChild(meta);
        });
      })
      .catch(function () {});
  }

  function injectOfflineBadge() {
    if (FLAGSHIP.indexOf(location.pathname) < 0) return;
    if (document.getElementById('workshop-offline-badge')) return;
    var host = document.querySelector('main') || document.body;
    var badge = document.createElement('p');
    badge.id = 'workshop-offline-badge';
    badge.className = 'workshop-offline-badge';
    badge.innerHTML = '<strong>Available offline after one visit.</strong> Open this page once on the school network, then it keeps working when the connection drops.';
    host.insertBefore(badge, host.firstChild);
  }

  function injectMouseRecommended() {
    var id = toolId();
    if (!id) return;
    id = id.replace(/-landing$/, '');
    var note = MOUSE_RECOMMENDED[id];
    if (!note || document.getElementById('mouse-recommended')) return;
    var wrap = document.createElement('div');
    wrap.id = 'mouse-recommended';
    wrap.className = 'mouse-rec';
    wrap.setAttribute('role', 'note');
    wrap.style.cssText = 'max-width:1100px;margin:10px auto;padding:8px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:var(--gold-lt,#faf1e0);border:1px solid var(--gold,#c98a2e);border-radius:10px;font-size:.82rem;line-height:1.4;color:var(--charcoal,#1a1208)';
    wrap.innerHTML = '<span style="font-weight:800;white-space:nowrap">\uD83D\uDDB1\uFE0F Mouse recommended</span><span>' + esc(note) + '</span>';
    var main = document.querySelector('main');
    if (main) {
      main.insertBefore(wrap, main.firstChild);
    } else {
      var header = document.querySelector('.site-header');
      if (header && header.parentNode) header.parentNode.insertBefore(wrap, header.nextSibling);
      else document.body.insertBefore(wrap, document.body.firstChild);
    }
  }

  function init() {
    applyAccessibility();
    renderBadges();
    injectNextStep();
    decorateHubCards();
    injectOfflineBadge();
    injectMouseRecommended();
    hookAnalytics();
    document.addEventListener('jvds:first-creation', renderBadges);
  }

  window.JVDSToolKit = { applyAccessibility: applyAccessibility, award: award };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
