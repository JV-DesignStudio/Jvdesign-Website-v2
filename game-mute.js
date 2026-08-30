/* game-mute.js — a mute control for games that never had one.
 *
 * Seven games used audio with no way to silence it. That matters on a children's
 * site: a parent handing over a phone, a child playing in a classroom, or anyone
 * who opened the page by accident had no option but to close the tab.
 *
 * Most of those games build their own AudioContext rather than going through
 * SoundManager, so a flag check inside SoundManager cannot reach them. This wraps
 * the AudioContext constructor, keeps a list of every context the page creates,
 * and suspends or resumes all of them together. HTMLAudioElement is handled too.
 *
 * The state lives in `jvds_sound` ('0' = muted), the key game-system.js already
 * honours, so a mute here also silences anything routed through SoundManager.
 *
 * Include AFTER the game's own scripts:  <script src="../game-mute.js"></script>
 */
(function () {
  if (window.__jvdsMute) return;               // already installed
  var KEY = 'jvds_sound';

  function isMuted() {
    try { return localStorage.getItem(KEY) === '0'; } catch (e) { return false; }
  }
  function setMuted(v) {
    try { localStorage.setItem(KEY, v ? '0' : '1'); } catch (e) {}
  }

  /* ── Track every AudioContext the page creates ── */
  var contexts = [];
  var Native = window.AudioContext || window.webkitAudioContext;
  if (Native) {
    var Wrapped = function () {
      var ctx = new (Function.prototype.bind.apply(Native, [null].concat([].slice.call(arguments))))();
      contexts.push(ctx);
      if (isMuted()) { try { ctx.suspend(); } catch (e) {} }
      return ctx;
    };
    Wrapped.prototype = Native.prototype;
    window.AudioContext = Wrapped;
    if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
  }

  function applyToContexts(muted) {
    contexts.forEach(function (c) {
      try { muted ? c.suspend() : c.resume(); } catch (e) {}
    });
    /* Anything using <audio>/new Audio() as well. */
    try {
      [].forEach.call(document.querySelectorAll('audio'), function (a) { a.muted = muted; });
    } catch (e) {}
  }

  /* ── The button ── */
  var btn;
  function paint() {
    if (!btn) return;
    var muted = isMuted();
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', muted ? 'Unmute game sound' : 'Mute game sound');
    btn.title = btn.getAttribute('aria-label');
  }

  function build() {
    if (document.querySelector('.jvds-mute-btn')) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'jvds-mute-btn';
    btn.style.cssText = [
      'position:fixed', 'right:12px', 'bottom:12px', 'z-index:99999',
      'width:48px', 'height:48px', 'border-radius:50%',
      'border:1.5px solid rgba(255,255,255,.28)',
      'background:rgba(20,20,28,.72)', 'color:#fff',
      'font-size:20px', 'line-height:1', 'cursor:pointer',
      'display:flex', 'align-items:center', 'justify-content:center',
      '-webkit-backdrop-filter:blur(6px)', 'backdrop-filter:blur(6px)',
      'box-shadow:0 2px 10px rgba(0,0,0,.35)'
    ].join(';');
    btn.addEventListener('click', function () {
      var next = !isMuted();
      setMuted(next);
      applyToContexts(next);
      paint();
      if (window.JVDS && window.JVDS.announce) {
        window.JVDS.announce(next ? 'Sound off' : 'Sound on');
      }
    });
    document.body.appendChild(btn);
    paint();
    applyToContexts(isMuted());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  window.__jvdsMute = { isMuted: isMuted, set: function (v) { setMuted(v); applyToContexts(v); paint(); } };
})();
