(function () {
  var canvas = document.getElementById('crew-stars');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H, stars = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function seed() {
    stars = [];
    for (var i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.3,
        o: Math.random() * 0.45 + 0.15,
        f: Math.random() * 0.25 + 0.05,
        p: Math.random() * Math.PI * 2
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    var dark = document.documentElement.dataset.theme === 'dark'
      || (!document.documentElement.dataset.theme
          && window.matchMedia('(prefers-color-scheme:dark)').matches);
    var rgb = dark ? '200,180,255' : '90,50,160';

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var pulse = Math.sin(t * 0.001 * s.f + s.p) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * pulse, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + rgb + ',' + (s.o * pulse) + ')';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', function() { resize(); seed(); });
  resize();
  seed();

  if (!window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
    requestAnimationFrame(draw);
  }
}());
