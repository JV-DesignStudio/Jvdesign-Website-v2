/* tool-project-code.js - copy/paste project code for locked-down devices (A1547).
 *
 * School and shared computers often block downloads, so a learner's work can be
 * lost when the machine is wiped. This adds one consistent finish step to every
 * tool: a short code that carries the work to another device and back.
 *
 *   Copy code  ->  encodes this device's saved work into JVPROJ1:<base64>
 *   Load code  ->  writes it back, then reloads so the tool restores itself
 *
 * Nothing is sent anywhere. Secrets, analytics ids and per-device choices
 * (cookie consent, theme, tokens) are never packed. Reuses the same packable
 * rules as jvds-store.js's backpack so the two stay compatible.
 *
 * Loaded by creation-share.js on tool pages, so no tool needs its own copy.
 * API: window.JVDSToolProject = { toCode, load, parse, hasSaved, tool }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSToolProject) return;
  if (!/^\/tools\//.test(location.pathname)) return;

  var TOOL = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  /* Landing/hub wrappers are not tools you make things in. */
  if (!TOOL || /-landing$/.test(TOOL)) return;

  var PREFIX = 'JVPROJ1:';
  var NEVER_PACK = [
    /^gh_pat$/, /^gh_gist_id$/,
    /token|secret|password|apikey/i,
    /^ga4_/, /^_ga/,
    /^jvds-cookie-consent$/,
    /^jvds-keys-migrated/,
    /^teacher_mode$/,
    /^jvds-theme$/
  ];

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function packable(k) {
    if (typeof k !== 'string' || !k) return false;
    for (var i = 0; i < NEVER_PACK.length; i++) if (NEVER_PACK[i].test(k)) return false;
    return true;
  }
  function hasSaved() {
    var s = ls(); if (!s) return 0;
    var n = 0;
    for (var i = 0; i < s.length; i++) if (packable(s.key(i))) n++;
    return n;
  }
  function collect() {
    var s = ls(), keys = {};
    if (s) for (var i = 0; i < s.length; i++) {
      var k = s.key(i);
      if (packable(k)) keys[k] = s.getItem(k);
    }
    return { format: 'jvds-tool-project', v: 1, keys: keys };
  }
  function toCode() {
    return PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(collect()))));
  }
  function parse(code) {
    var c = String(code || '').trim();
    if (c.indexOf(PREFIX) !== 0) throw new Error('That is not a JVDS project code.');
    var data;
    try { data = JSON.parse(decodeURIComponent(escape(atob(c.slice(PREFIX.length))))); }
    catch (e) { throw new Error('That is not a JVDS project code.'); }
    if (!data || typeof data !== 'object' || !data.keys || typeof data.keys !== 'object' || Array.isArray(data.keys)) {
      throw new Error('That is not a JVDS project code.');
    }
    return data.keys;
  }
  function load(code) {
    var keys = parse(code);
    var s = ls();
    if (!s) throw new Error('Storage is blocked in this browser.');
    var names = Object.keys(keys).filter(packable);
    names.forEach(function (k) { if (typeof keys[k] !== 'string') throw new Error('That is not a JVDS project code.'); });
    names.forEach(function (k) { s.setItem(k, keys[k]); });
    return names.length;
  }

  function toast(text) {
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.textContent = text;
    t.style.cssText = 'position:fixed;bottom:96px;right:16px;z-index:9003;max-width:280px;' +
      'background:#28241e;color:#f5efe0;border:1px solid rgba(240,234,214,.18);border-radius:10px;' +
      'padding:10px 14px;font:600 .8rem/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);';
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2800);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  var CSS = [
    '#jvds-project-btn{position:fixed;right:16px;z-index:9000;background:#5a4a8a;color:#fff;border:none;',
    'border-radius:999px;padding:10px 16px;font:700 .82rem/1 Inter,system-ui,sans-serif;cursor:pointer;',
    'box-shadow:0 3px 0 #443770,0 8px 24px rgba(0,0,0,.28);display:inline-flex;align-items:center;justify-content:center;min-height:44px}',
    '#jvds-project-btn:hover{filter:brightness(1.08)}',
    '#jvds-project-btn:focus-visible{outline:3px solid #BC4749;outline-offset:2px}',
    '#jvds-project-modal{position:fixed;inset:0;z-index:9100;background:rgba(20,16,10,.6);display:flex;align-items:center;justify-content:center;padding:16px}',
    '#jvds-project-modal .jp-card{background:#fff;color:#1a1208;border-radius:14px;max-width:460px;width:100%;max-height:90vh;overflow:auto;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.4)}',
    '#jvds-project-modal h3{margin:0 0 8px;font-size:1.15rem}',
    '#jvds-project-modal p{margin:0 0 12px;font-size:.9rem;line-height:1.55}',
    '#jvds-project-modal .jp-status{font-weight:700}',
    '#jvds-project-modal label{display:block;font-weight:700;font-size:.85rem;margin:12px 0 4px}',
    '#jvds-project-modal textarea{width:100%;box-sizing:border-box;font:inherit;font-size:.82rem;border:1.5px solid rgba(64,59,51,.2);border-radius:8px;padding:8px 10px;resize:vertical}',
    '#jvds-project-modal .jp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}',
    '#jvds-project-modal button.jp{background:#4e7d80;color:#fff;border:none;border-radius:8px;padding:10px 16px;min-height:44px;font:700 .84rem/1 Inter,system-ui,sans-serif;cursor:pointer}',
    '#jvds-project-modal button.jp:hover{filter:brightness(1.08)}',
    '#jvds-project-modal button.jp-ghost{background:#ece7db;color:#1a1208}',
    '#jvds-project-modal .jp-msg{font-size:.82rem;font-weight:700}',
    '#jvds-project-modal .jp-msg[data-ok="1"]{color:#2e7d4f}#jvds-project-modal .jp-msg[data-ok="0"]{color:#BC4749}'
  ].join('');

  var modal = null;

  function baseBottom() {
    var banner = document.getElementById('cookie-banner');
    return 16 + (banner ? banner.offsetHeight + 12 : 0);
  }
  function bottomBar() {
    var bar = document.getElementById('bottom-bar');
    if (bar) return bar;
    var tabs = document.querySelector('.bb-tabs');
    return tabs ? tabs.parentElement : null;
  }
  function place() {
    var btn = document.getElementById('jvds-project-btn');
    if (!btn) return;
    btn.style.display = '';
    var base = baseBottom();
    var bar = bottomBar();
    if (bar) {
      var st = getComputedStyle(bar);
      if (st.display !== 'none' && bar.getBoundingClientRect().height > 0) {
        // A2012: the phone toolbar owns the bottom of the screen.
        if (window.innerWidth <= 699) { btn.style.display = 'none'; return; }
        base += Math.min(bar.getBoundingClientRect().height, window.innerHeight * 0.5) + 10;
      }
    }
    btn.style.bottom = (base + 56) + 'px';
  }

  function open() {
    if (modal) { modal.style.display = 'flex'; return; }
    modal = document.createElement('div');
    modal.id = 'jvds-project-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'jvds-project-title');
    modal.innerHTML =
      '<div class="jp-card">' +
      '<h3 id="jvds-project-title">Move your work to another device</h3>' +
      '<p>This browser holds the only copy. Copy a code, then paste it on the other device to bring your work with you. Nothing is sent anywhere.</p>' +
      '<p class="jp-status" id="jvds-project-status"></p>' +
      '<div class="jp-row"><button type="button" class="jp" id="jvds-project-copy">Copy code</button>' +
      '<span class="jp-msg" id="jvds-project-copied" role="status"></span></div>' +
      '<label for="jvds-project-input">Paste a code to load work</label>' +
      '<textarea id="jvds-project-input" rows="3" spellcheck="false" placeholder="JVPROJ1: ..."></textarea>' +
      '<div class="jp-row"><button type="button" class="jp" id="jvds-project-load">Load code</button>' +
      '<span class="jp-msg" id="jvds-project-msg" role="status"></span></div>' +
      '<div class="jp-row"><button type="button" class="jp jp-ghost" id="jvds-project-close">Close</button></div>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('jvds-project-status').textContent =
      'Saved on this device: ' + hasSaved() + ' item' + (hasSaved() === 1 ? '' : 's') + '.';

    var copied = document.getElementById('jvds-project-copied');
    document.getElementById('jvds-project-copy').addEventListener('click', function () {
      var code = toCode();
      copyText(code).then(function (ok) {
        if (ok) { copied.textContent = 'Copied!'; copied.setAttribute('data-ok', '1'); }
        else {
          var box = document.getElementById('jvds-project-input');
          box.value = code; box.focus(); box.select();
          copied.textContent = 'Select and copy the code below.';
          copied.setAttribute('data-ok', '0');
        }
        setTimeout(function () { copied.textContent = ''; }, 2600);
      });
    });

    var msg = document.getElementById('jvds-project-msg');
    document.getElementById('jvds-project-load').addEventListener('click', function () {
      var code = document.getElementById('jvds-project-input').value;
      try {
        var n = load(code);
        msg.textContent = 'Loaded ' + n + ' item' + (n === 1 ? '' : 's') + '. Reloading...';
        msg.setAttribute('data-ok', '1');
        setTimeout(function () { location.reload(); }, 900);
      } catch (e) {
        msg.textContent = e.message || 'That code could not be loaded.';
        msg.setAttribute('data-ok', '0');
      }
    });

    document.getElementById('jvds-project-close').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && modal.style.display !== 'none') close(); });
    document.getElementById('jvds-project-copy').focus();
  }
  function close() { if (modal) modal.style.display = 'none'; }

  function build() {
    var style = document.createElement('style');
    style.id = 'jvds-project-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.id = 'jvds-project-btn';
    btn.type = 'button';
    btn.textContent = 'Move your work';
    btn.setAttribute('aria-label', 'Move your work to another device with a project code');
    btn.addEventListener('click', open);
    document.body.appendChild(btn);
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('orientationchange', place);
    document.addEventListener('click', function () { setTimeout(place, 0); }, true);
    try {
      var bar = bottomBar();
      if (bar && window.ResizeObserver) new ResizeObserver(place).observe(bar);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  window.JVDSToolProject = { toCode: toCode, load: load, parse: parse, hasSaved: hasSaved, tool: TOOL };
})();
