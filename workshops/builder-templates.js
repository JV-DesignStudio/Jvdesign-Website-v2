/* BuilderTemplates, the pick-from gallery shared by every JVDS 3D builder.

   A builder lists the finished models a learner can start from and points at
   the function that loads each one:

     BuilderTemplates.install({
       mount: '.hdr-right',
       templates: [
         { id: 'saturn', emoji: '\u{1F680}', name: 'Saturn V', note: 'Tall, white, three stages.',
           apply: function () { applyRocketPreset('Saturn V'); } }
       ],
       random: randomRocket   // optional "surprise me" tile
     });

   Nothing here knows how a builder works. It draws the gallery, hands the
   click back to the builder, and gets out of the way. Picking a template must
   leave the page in a state the learner can immediately export, so apply() is
   expected to rebuild the model and sync the controls itself. */
(function (global) {
  'use strict';

  var STYLE_ID = 'builder-templates-style';
  var cfg = null;

  var BASE_CSS = [
    '.bt-btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}',
    '.bt-backdrop{position:fixed;inset:0;background:rgba(4,6,12,.78);backdrop-filter:blur(5px);z-index:400;display:flex;align-items:center;justify-content:center;padding:18px}',
    '.bt-sheet{width:min(720px,100%);max-height:90vh;overflow:auto;background:linear-gradient(150deg,#171432,#0b0a17);border:1px solid rgba(150,120,255,.3);border-radius:16px;padding:20px 22px 22px;box-shadow:0 26px 70px rgba(0,0,0,.6);color:#eeeaff;font:400 14px/1.5 Inter,system-ui,sans-serif}',
    '.bt-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}',
    '.bt-head h2{margin:0;font:700 1.15rem/1.2 Bebas Neue,Inter,sans-serif;letter-spacing:.06em;color:var(--bt-acc,#b39dff)}',
    '.bt-head p{margin:2px 0 0;font-size:.78rem;color:#a9a3d6}',
    '.bt-x{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#d8d2ff;border-radius:8px;width:30px;height:30px;font-size:.9rem;cursor:pointer;line-height:1}',
    '.bt-x:hover{background:rgba(255,255,255,.15)}',
    '.bt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:11px;margin-top:14px}',
    '.bt-card{display:flex;flex-direction:column;gap:5px;text-align:left;padding:13px 14px 14px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#f2efff;cursor:pointer;font:inherit;transition:transform .12s ease,border-color .12s ease,background .12s ease}',
    '.bt-card:hover,.bt-card:focus-visible{transform:translateY(-2px);border-color:var(--bt-acc,#b39dff);background:rgba(255,255,255,.11);outline:none}',
    '.bt-card .bt-emoji{font-size:1.6rem;line-height:1}',
    '.bt-card .bt-name{font:700 1.02rem/1.15 Bebas Neue,Inter,sans-serif;letter-spacing:.05em}',
    '.bt-card .bt-note{font-size:.76rem;color:#b5aede;line-height:1.4}',
    '.bt-card .bt-cta{margin-top:4px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--bt-acc,#b39dff)}',
    '.bt-card.bt-random{border-style:dashed}',
    '.bt-status{min-height:18px;margin-top:12px;font-size:.78rem;color:var(--bt-acc,#c3b5ff)}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = BASE_CSS;
    document.head.appendChild(s);
  }

  function mountButton() {
    if (!cfg || cfg.buttonMounted) return;
    var host = null;
    var nodes = document.querySelectorAll(cfg.mount || '.hdr-right, .hdr-btns, .hb');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].offsetParent !== null || nodes[i].getClientRects().length) { host = nodes[i]; break; }
    }
    if (!host && nodes.length) host = nodes[0];
    if (!host) return;

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bt-btn' + (host.classList.contains('hdr-right') ? ' quick-btn' : '');
    b.title = 'Start from a finished model, then make it yours';
    b.innerHTML = '&#127912; Templates';
    if (host.classList.contains('hdr-right')) {
      b.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);box-shadow:0 3px 0 #4c1d95;color:#fff';
    }
    b.addEventListener('click', function (e) { e.preventDefault(); open(); });
    // Templates sit next to Random, so put the button first in the row.
    if (host.firstChild) host.insertBefore(b, host.firstChild.nextSibling);
    else host.appendChild(b);
    cfg.buttonMounted = true;
  }

  function card(t) {
    return '<button class="bt-card" type="button" data-id="' + t.id + '">' +
      '<span class="bt-emoji" aria-hidden="true">' + (t.emoji || '&#127912;') + '</span>' +
      '<span class="bt-name">' + t.name + '</span>' +
      '<span class="bt-note">' + (t.note || '') + '</span>' +
      '<span class="bt-cta">Use this &#8594;</span>' +
      '</button>';
  }

  function buildSheet() {
    var back = document.createElement('div');
    back.className = 'bt-backdrop';
    back.id = 'btBackdrop';
    var html =
      '<div class="bt-sheet" role="dialog" aria-modal="true" aria-labelledby="btTitle">' +
        '<div class="bt-head"><div>' +
          '<h2 id="btTitle">&#127912; Pick a template</h2>' +
          '<p>Start from one of these, change whatever you like, then export exactly what you built.</p>' +
        '</div>' +
        '<button class="bt-x" type="button" aria-label="Close templates">&#10005;</button></div>' +
        '<div class="bt-grid">' +
        (cfg.templates || []).map(card).join('') +
        (cfg.random ? '<button class="bt-card bt-random" type="button" data-id="__random__">' +
          '<span class="bt-emoji" aria-hidden="true">&#127921;</span>' +
          '<span class="bt-name">Surprise me</span>' +
          '<span class="bt-note">Shuffle every option into something new.</span>' +
          '<span class="bt-cta">Roll it &#8594;</span></button>' : '') +
        '</div>' +
        '<div class="bt-status" id="btStatus" aria-live="polite"></div>' +
      '</div>';
    back.innerHTML = html;
    back.querySelector('.bt-x').addEventListener('click', close);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    back.querySelector('.bt-grid').addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('.bt-card') : null;
      if (!el) return;
      var id = el.getAttribute('data-id');
      var status = back.querySelector('#btStatus');
      try {
        if (id === '__random__') { cfg.random(); status.textContent = 'Rolled a brand new one \u2014 make it yours!'; }
        else {
          var t = null;
          var list = cfg.templates || [];
          for (var i = 0; i < list.length; i++) if (list[i].id === id) t = list[i];
          if (!t) return;
          t.apply();
          status.textContent = t.name + ' loaded. Change anything you like.';
        }
        if (cfg.onApply) cfg.onApply(id);
      } catch (err) {
        status.textContent = 'That template could not load: ' + (err && err.message ? err.message : err);
      }
    });
    document.body.appendChild(back);
    return back;
  }

  function open() {
    ensureStyle();
    if (!document.getElementById('btBackdrop')) buildSheet();
    var back = document.getElementById('btBackdrop');
    back.style.display = 'flex';
    var x = back.querySelector('.bt-x');
    if (x) x.focus();
  }

  function close() {
    var back = document.getElementById('btBackdrop');
    if (back) back.style.display = 'none';
  }

  function install(options) {
    cfg = options || {};
    if (!cfg.templates || !cfg.templates.length) {
      if (!cfg.random) return false;
    }
    ensureStyle();
    mountButton();
    if (!cfg.buttonMounted) setTimeout(mountButton, 300);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    return true;
  }

  global.BuilderTemplates = { install: install, open: open, close: close, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
