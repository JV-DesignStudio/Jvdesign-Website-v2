/* creation-share.js - a consistent "Share your creation" action for JVDS tools.
 *
 * Every share carries the same call to action and a link home, so a shared
 * creation recruits the next maker:
 *   "I made something with <Tool> on JVDesignStudio. Make your own at <tool url>"
 *
 * Uses the native share sheet when available, otherwise copies the link.
 * Dispatches a 'jvds:shared' event, which the first-creation funnel counts as
 * first_create_share. No account, no PII.
 *
 * API: window.JVDSShare = { share(), copy(), url, tool }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSShare) return;
  if (!/^\/tools\//.test(location.pathname)) return;

  var TOOL = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var CREATORS = {
    'pixel-studio': 1, 'character-designer': 1, 'level-designer': 1,
    'sprite-animator': 1, 'sprite-sheet-animator': 1, 'bitmap-font-maker': 1,
    'tileset-builder': 1, 'particle-designer': 1, 'colour-palette': 1,
    'icon-generator': 1, 'game-logo-maker': 1, 'game-idea-generator': 1,
    'gdd-builder': 1, 'design-worksheet': 1, 'story-editor': 1,
    'sound-studio': 1, 'music-maker': 1, 'sfx-generator': 1,
    'trading-card-designer': 1, 'arcade-game-maker': 1,
    'code-snippet-generator': 1, 'buildlab': 1
  };
  if (!CREATORS[TOOL]) return;

  // A676: same shared save/export keepsake strip on every curated create tool.
  (function loadKeepsake() {
    var s = document.createElement('script');
    s.src = '/creation-keepsake.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  var HOME = 'https://jvdesignstudio.co.uk';
  var TOOL_URL = HOME + '/tools/' + TOOL + '.html';
  var metaName = document.querySelector('meta[property="og:title"]');
  var NAME = (metaName && metaName.getAttribute('content')) || document.title || 'a JVDS tool';
  NAME = NAME.split(/\s+\|\s+/)[0].split(/\s+[-\u2013\u2014]\s+/)[0].trim() || 'a JVDS tool';

  function message() {
    return 'I made something with ' + NAME + '. Make your own at ' + TOOL_URL;
  }
  function announce() {
    try { window.dispatchEvent(new CustomEvent('jvds:shared', { detail: { tool: TOOL } })); } catch (e) {}
  }
  function toast(text) {
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.textContent = text;
    t.style.cssText = 'position:fixed;bottom:88px;right:16px;z-index:9002;max-width:260px;' +
      'background:#28241e;color:#f5efe0;border:1px solid rgba(240,234,214,.18);border-radius:10px;' +
      'padding:10px 14px;font:600 .8rem/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);';
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  function share() {
    announce();
    var payload = { title: 'Made by me in ' + NAME, text: message(), url: TOOL_URL };
    if (navigator.share) {
      try {
        return navigator.share(payload).catch(function () { /* user cancelled */ });
      } catch (e) {}
    }
    return copy(message()).then(function (ok) {
      toast(ok ? 'Share link copied. Send it to show what you made.' : 'Share this link: ' + TOOL_URL);
      return ok;
    });
  }

  function place() {
    var banner = document.getElementById('cookie-banner');
    var base = 16 + (banner ? banner.offsetHeight + 12 : 0);
    btn.style.bottom = base + 'px';
  }

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#jvds-share-btn{position:fixed;right:16px;z-index:9000;background:#4e7d80;color:#fff;border:none;border-radius:999px;padding:10px 16px;font:700 .82rem/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #3d6366,0 8px 24px rgba(0,0,0,.28)}',
    '#jvds-share-btn:hover{filter:brightness(1.07)}',
    '#jvds-share-btn:focus-visible{outline:3px solid #BC4749;outline-offset:2px}'
  ].join('');
  document.head.appendChild(styleEl);

  var btn = document.createElement('button');
  btn.id = 'jvds-share-btn';
  btn.type = 'button';
  btn.textContent = 'Share your creation';
  btn.setAttribute('aria-label', 'Share what you made');
  btn.addEventListener('click', share);
  document.body.appendChild(btn);
  place();
  window.addEventListener('resize', place);

  window.JVDSShare = { share: share, copy: function () { return copy(TOOL_URL); }, url: TOOL_URL, tool: TOOL };
})();
