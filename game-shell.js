/* JVDS game shell: landing -> play -> fullscreen immersive (app-in-app).
 *
 * Include on any game page with:
 *   <script defer src="../game-shell.js"></script>
 *
 * It adds nothing visible until the player starts: the first click on a start
 * control (or any button/link whose text starts with Play/Start/Begin) enters
 * immersive mode - site chrome hidden, the chosen game root fixed to the
 * viewport, the Fullscreen API requested, and a floating Exit control shown.
 *
 * Optional hooks, all opt-in:
 *   data-jvds-root   on the element that should fill the screen
 *   data-jvds-play   on the exact start control (beats the text heuristic)
 *   data-jvds-no-root on a page to keep the normal layout (hide chrome only)
 */
(function () {
  if (window.JVDSGameShell) return;

  var START_SELECTOR = '[data-jvds-play],#startBtn,#btnStart,#startGame,#start,#playBtn,#modalPrimary,#citadelStart,.rune-btn,.btn-play,.pz-play';
  var START_TEXT = /^(play|start|begin|choose your spell|start run|start game|start song|play again|play the mission|new game|continue|go)\b/i;
  var ROOT_CANDIDATES = ['[data-jvds-root]', '.game-frame-wrap', '.game-shell', '.shell', '.wrap', '.play-layout', 'main', '#main-content', '#game', '.app', '.board-wrap'];
  var lastRoot = null;

  function injectCss() {
    if (document.getElementById('jvds-shell-css')) return;
    var css = document.createElement('style');
    css.id = 'jvds-shell-css';
    css.textContent =
      '.jvds-exit{display:none;position:fixed;top:10px;right:10px;z-index:2147483000;background:rgba(0,0,0,.62);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:9px 15px;font:800 14px/1.1 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
      '.jvds-launch{position:fixed;bottom:12px;right:12px;z-index:2147482900;width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:50%;font:800 18px/1 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:.9}' +
      '.jvds-launch:hover{opacity:1}' +
      'html.jvds-immersive .jvds-launch{display:none!important}' +
      '.jvds-launch.jvds-launch--hidden{display:none!important}' +
      'html.jvds-immersive .jvds-exit{display:block}' +
      'html.jvds-immersive{overflow:hidden!important}' +
      'html.jvds-immersive body{margin:0!important}' +
      'html.jvds-immersive .site-header,html.jvds-immersive #siteHeader,html.jvds-immersive .site-footer,html.jvds-immersive #jvds-announce,html.jvds-immersive .skip-link,html.jvds-immersive .jvds-hide-on-play{display:none!important}' +
      'html.jvds-immersive .jvds-root{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;height:100dvh!important;max-width:none!important;margin:0!important;border-radius:0!important;z-index:99990!important;overflow:auto!important}' +
      'html.jvds-immersive .jvds-root iframe{width:100vw!important;height:100vh!important;height:100dvh!important}';
    (document.head || document.documentElement).appendChild(css);
  }

  function ensureButton() {
    var b = document.getElementById('jvds-exit');
    if (b) return b;
    b = document.createElement('button');
    b.id = 'jvds-exit';
    b.className = 'jvds-exit';
    b.type = 'button';
    b.textContent = '✕ Exit game';
    b.addEventListener('click', function (e) { e.preventDefault(); exit(); });
    (document.body || document.documentElement).appendChild(b);
    return b;
  }

  function ensureLauncher() {
    var b = document.getElementById('jvds-launch');
    if (b) return b;
    b = document.createElement('button');
    b.id = 'jvds-launch';
    b.className = 'jvds-launch';
    b.type = 'button';
    b.setAttribute('aria-label', 'Play this game fullscreen');
    b.setAttribute('title', 'Play fullscreen');
    b.textContent = '⛶';
    b.addEventListener('click', function (e) { e.preventDefault(); enter(); });
    (document.body || document.documentElement).appendChild(b);
    return b;
  }

  function showLauncher() {
    var b = document.getElementById('jvds-launch');
    if (b) b.classList.remove('jvds-launch--hidden');
  }

  function hideLauncher() {
    var b = document.getElementById('jvds-launch');
    if (b) b.classList.add('jvds-launch--hidden');
  }

  function pickRoot() {
    if (document.querySelector('[data-jvds-no-root]')) return null;
    for (var i = 0; i < ROOT_CANDIDATES.length; i++) {
      var el = document.querySelector(ROOT_CANDIDATES[i]);
      if (el && el !== document.body && el !== document.documentElement) return el;
    }
    return null;
  }

  function enter() {
    injectCss();
    ensureButton();
    var root = pickRoot();
    if (root) { root.classList.add('jvds-root'); lastRoot = root; }
    document.documentElement.classList.add('jvds-immersive');
    try {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    } catch (e) {}
    window.dispatchEvent(new Event('resize'));
  }

  function exit() {
    document.documentElement.classList.remove('jvds-immersive');
    if (lastRoot) { lastRoot.classList.remove('jvds-root'); lastRoot = null; }
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    } catch (e) {}
    showLauncher();
    window.dispatchEvent(new Event('resize'));
  }

  function wire() {
    injectCss();
    ensureButton();
    ensureLauncher();
    document.addEventListener('click', function (e) {
      if (navigator.webdriver) return; // let automation click start controls without changing layout
      if (document.documentElement.classList.contains('jvds-immersive')) return;
      var t = e.target;
      if (!t || !t.closest) return;
      var direct = t.closest(START_SELECTOR);
      var btn = t.closest('button,a,[role="button"]');
      var text = btn ? (btn.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (direct || (text && START_TEXT.test(text))) setTimeout(enter, 0);
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.documentElement.classList.contains('jvds-immersive')) exit();
    });
    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('#jvds-launch')) return;
      hideLauncher();
    }, true);
  }

  window.JVDSGameShell = { enter: enter, exit: exit };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
