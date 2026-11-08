(function () {
  if (!window.AudioEffects) return;
  var a = new AudioEffects(0.5);
  var armed = false;
  var muted = false;
  try { muted = localStorage.getItem('soundEnabled') === 'false'; } catch (e) {}
  try { a.setMasterVolume(muted ? 0 : 0.5); } catch (e) {}

  function arm() { armed = true; }
  function play(fn) {
    if (!armed || muted) return;
    try { fn(); } catch (e) {}
  }

  window.addEventListener('pointerdown', arm, { passive: true });
  window.addEventListener('keydown', arm);

  window.JVDSAudio = {
    armed: function () { return armed; },
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { a.setMasterVolume(muted ? 0 : 0.5); } catch (e) {}
    },
    tap: function () { play(function () { a.playTap(); }); },
    success: function () { play(function () { a.playSuccess(); }); },
    error: function () { play(function () { a.playError(); }); },
    pop: function () { play(function () { a.playPop(); }); }
  };

  if (window.GameSystem && GameSystem.prototype && !GameSystem.prototype.__jvdsAudioPatched) {
    GameSystem.prototype.__jvdsAudioPatched = true;
    var orig = GameSystem.prototype.addScore;
    GameSystem.prototype.addScore = function () {
      if (window.JVDSAudio) window.JVDSAudio.success();
      return orig.apply(this, arguments);
    };
  }

  document.addEventListener('click', function (e) {
    if (armed && !muted && e.target.closest && e.target.closest('button,.btn,a')) {
      play(function () { a.playTap(); });
    }
  }, true);
})();
