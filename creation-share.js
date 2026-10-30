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
 *      window.JVDSShareWarning = { confirm() } - promise<boolean>, for tools that
 *      build their own share link and want the same pre-share warning.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSShare) return;
  if (!/^\/tools\//.test(location.pathname)) return;

  // A1547: same copy/paste project code on every tool, so work survives a wiped
  // school computer. Loaded here so no tool page needs its own copy.
  (function loadProjectCode() {
    var s = document.createElement('script');
    s.src = '/tool-project-code.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  var TOOL = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var CREATORS = {
    'pixel-studio': 1, 'level-designer': 1,
    'sprite-animator': 1, 'bitmap-font-maker': 1,
    'particle-designer': 1, 'colour-palette': 1,
    'icon-generator': 1, 'game-logo-maker': 1, 'game-idea-generator': 1,
    'gdd-builder': 1, 'design-worksheet': 1, 'story-editor': 1,
    'sound-studio': 1,
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

  // A1998: nobody should discover that a share link is public after sending it.
  // Show who can see the link, then let the learner choose.
  var warnEl = null;
  var warnResolve = null;
  var warnReturnFocus = null;

  function closeWarn(go) {
    if (!warnEl) return;
    warnEl.remove();
    warnEl = null;
    var resolve = warnResolve;
    warnResolve = null;
    if (warnReturnFocus && warnReturnFocus.focus) {
      try { warnReturnFocus.focus(); } catch (e) {}
    }
    warnReturnFocus = null;
    if (resolve) resolve(!!go);
  }

  function warningDialog() {
    if (warnEl) return new Promise(function (resolve) { warnResolve = resolve; });
    return new Promise(function (resolve) {
      warnResolve = resolve;
      warnReturnFocus = document.activeElement;
      var wrap = document.createElement('div');
      wrap.id = 'jvds-share-warn';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-labelledby', 'jvds-share-warn-title');
      wrap.setAttribute('aria-describedby', 'jvds-share-warn-body');

      var panel = document.createElement('div');
      panel.className = 'jvds-share-warn-panel';

      var title = document.createElement('h2');
      title.id = 'jvds-share-warn-title';
      title.textContent = 'Before you share';

      var body = document.createElement('div');
      body.id = 'jvds-share-warn-body';
      body.innerHTML =
        '<p><strong>Anyone with this link may be able to see what you made.</strong> ' +
        'Only share it with people you are happy to show.</p>' +
        '<p>Do not put your full name, school, address or photos in a shared project.</p>' +
        '<ul>' +
        '<li><strong>Save on this device</strong> keeps your work on this computer.</li>' +
        '<li><strong>Download</strong> makes a file you keep.</li>' +
        '<li><strong>Share by link</strong> puts your work in a web address that anyone with the link can open.</li>' +
        '</ul>';

      var actions = document.createElement('div');
      actions.className = 'jvds-share-warn-actions';

      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'jvds-share-warn-cancel';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', function () { closeWarn(false); });

      var go = document.createElement('button');
      go.type = 'button';
      go.className = 'jvds-share-warn-go';
      go.textContent = navigator.share ? 'Continue to share' : 'Copy share link';
      go.addEventListener('click', function () { closeWarn(true); });

      actions.appendChild(cancel);
      actions.appendChild(go);
      panel.appendChild(title);
      panel.appendChild(body);
      panel.appendChild(actions);
      wrap.appendChild(panel);
      wrap.addEventListener('click', function (e) { if (e.target === wrap) closeWarn(false); });
      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); closeWarn(false); }
        if (e.key !== 'Tab') return;
        var focusables = [cancel, go];
        var i = focusables.indexOf(document.activeElement);
        if (e.shiftKey) { e.preventDefault(); focusables[(i <= 0 ? focusables.length : i) - 1].focus(); }
        else { e.preventDefault(); focusables[(i + 1) % focusables.length].focus(); }
      });
      document.body.appendChild(wrap);
      warnEl = wrap;
      go.focus();
    });
  }

  // A1998: several tools copy their share link from their own toolbar. Wrap the
  // clipboard so any link that carries encoded creation data asks first, instead
  // of relying on every tool page to remember the warning.
  function isShareLink(text) {
    if (typeof text !== 'string') return false;
    if (text.indexOf(location.origin + '/tools/') !== 0) return false;
    var hash = text.indexOf('#');
    var query = text.indexOf('?');
    return (hash !== -1 && text.length - hash > 24) || (query !== -1 && text.length - query > 60);
  }

  function guardClipboard() {
    var clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') return;
    var original = clipboard.writeText.bind(clipboard);
    function guardedWrite(text) {
      if (!isShareLink(text)) return original(text);
      return warningDialog().then(function (goAhead) {
        // On cancel the tool's own "link copied" callback must not fire, so the
        // guard stays pending rather than resolving a false success.
        if (!goAhead) return new Promise(function () {});
        return original(text);
      });
    }
    try { Object.defineProperty(clipboard, 'writeText', { configurable: true, value: guardedWrite }); }
    catch (e) { try { clipboard.writeText = guardedWrite; } catch (e2) {} }
  }

  function share() {
    return warningDialog().then(function (goAhead) {
      if (!goAhead) return false;
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
    });
  }

  function place() {
    var banner = document.getElementById('cookie-banner');
    var base = 16 + (banner ? banner.offsetHeight + 12 : 0);
    btn.style.bottom = base + 'px';
  }

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#jvds-share-btn{position:fixed;right:16px;z-index:9000;background:#4e7d80;color:#fff;border:none;border-radius:999px;padding:10px 16px;font:700 .82rem/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #3d6366,0 8px 24px rgba(0,0,0,.28);display:inline-flex;align-items:center;justify-content:center;min-height:44px}',
    '#jvds-share-warn{position:fixed;inset:0;z-index:9004;background:rgba(12,14,20,.58);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.jvds-share-warn-panel{max-width:460px;width:100%;max-height:calc(100vh - 32px);overflow:auto;background:#fffdf8;color:#1a1208;border:1.5px solid rgba(64,59,51,.18);border-radius:14px;padding:22px 22px 18px;box-shadow:0 18px 50px rgba(0,0,0,.35);font:400 .9rem/1.55 Inter,system-ui,sans-serif}',
    '.jvds-share-warn-panel h2{margin:0 0 10px;font:700 1.15rem/1.2 Inter,system-ui,sans-serif;color:#1a1208}',
    '.jvds-share-warn-panel p{margin:0 0 10px}',
    '.jvds-share-warn-panel ul{margin:0 0 14px;padding-left:18px}',
    '.jvds-share-warn-panel li{margin:0 0 4px}',
    '.jvds-share-warn-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}',
    '.jvds-share-warn-actions button{font:700 .86rem/1 Inter,system-ui,sans-serif;padding:11px 16px;border-radius:10px;cursor:pointer;min-height:44px}',
    '.jvds-share-warn-cancel{background:#f3efe6;color:#3d3224;border:1px solid rgba(64,59,51,.2)}',
    '.jvds-share-warn-go{background:#4e7d80;color:#fff;border:1px solid #3d6366}',
    '.jvds-share-warn-actions button:focus-visible{outline:3px solid #BC4749;outline-offset:2px}',
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

  window.JVDSShare = {
    share: share,
    copy: function () {
      return warningDialog().then(function (goAhead) { return goAhead ? copy(TOOL_URL) : false; });
    },
    url: TOOL_URL,
    tool: TOOL
  };
  // A1998: tools with their own share flow (for example the Arcade Game Maker)
  // can ask the same question before they build a link.
  window.JVDSShareWarning = { confirm: warningDialog };
  guardClipboard();
})();
