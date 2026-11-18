(function () {
  var f = document.getElementById('homeNlForm');
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
          var msg = document.getElementById('homeNlSuccess');
          if (msg) msg.hidden = false;
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
