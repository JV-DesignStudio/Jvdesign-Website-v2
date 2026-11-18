document.querySelectorAll('.copy-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var id = btn.getAttribute('data-copy');
    var el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent.trim()).then(function () {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function () { btn.textContent = 'Copy code'; btn.classList.remove('copied'); }, 2000);
    }).catch(function () {
      btn.textContent = 'Select + copy manually';
    });
  });
});
