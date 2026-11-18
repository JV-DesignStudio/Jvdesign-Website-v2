(function () {
  var f = document.getElementById('ccWaitlistForm');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = f.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    fetch(f.action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.ok) {
          f.hidden = true;
          var msg = document.getElementById('ccSuccess');
          if (msg) msg.hidden = false;
          var bottom = document.getElementById('ccBottom');
          if (bottom) bottom.innerHTML = '<p style="color:#A8D8A8;font-weight:700">🎉 You\'re on the list!</p>';
        } else {
          btn.disabled = false;
          btn.textContent = 'Try again →';
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Try again →';
      });
  });
})();
