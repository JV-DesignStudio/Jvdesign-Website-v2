/* Book read-aloud player (A2531) - shared across all book pages.
   The <section class="book-read-aloud"> carries data-prefix="<id>" so this
   single script drives every book without per-page inline code. */
(function () {
  document.querySelectorAll('.book-read-aloud[data-prefix]').forEach(function (section) {
    var p    = section.dataset.prefix;
    var audio = document.getElementById(p + 'Audio');
    if (!audio || !audio.src) return; /* no src yet - controls stay disabled */
    var play = document.getElementById(p + 'AudioPlay');
    var back = document.getElementById(p + 'AudioBack');
    var fwd  = document.getElementById(p + 'AudioFwd');
    var seek = document.getElementById(p + 'AudioSeek');
    var time = document.getElementById(p + 'AudioTime');
    var fmt  = function (s) { var m = Math.floor(s / 60); return m + ':' + (Math.floor(s % 60) + '').padStart(2, '0'); };

    [play, back, fwd, seek].forEach(function (el) { el.disabled = false; });

    play.addEventListener('click', function () {
      if (audio.paused) {
        audio.play();
        play.setAttribute('aria-label', 'Pause');
        play.setAttribute('aria-pressed', 'true');
        play.textContent = '⏸'; /* ⏸ */
      } else {
        audio.pause();
        play.setAttribute('aria-label', 'Play');
        play.setAttribute('aria-pressed', 'false');
        play.textContent = '▶'; /* ▶ */
      }
    });

    back.addEventListener('click', function () {
      audio.currentTime = Math.max(0, audio.currentTime - 10);
    });
    fwd.addEventListener('click', function () {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
    });
    seek.addEventListener('input', function () {
      audio.currentTime = (seek.value / 100) * (audio.duration || 0);
    });

    audio.addEventListener('timeupdate', function () {
      var d = audio.duration || 0;
      seek.value = d ? (audio.currentTime / d * 100) : 0;
      seek.setAttribute('aria-valuetext', fmt(audio.currentTime) + ' of ' + fmt(d));
      time.textContent = fmt(audio.currentTime) + ' / ' + fmt(d);
    });

    audio.addEventListener('ended', function () {
      play.setAttribute('aria-label', 'Play');
      play.setAttribute('aria-pressed', 'false');
      play.textContent = '▶'; /* ▶ */
    });
  });
})();
