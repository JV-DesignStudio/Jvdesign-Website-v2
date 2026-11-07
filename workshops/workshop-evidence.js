(function () {
  var KEY = 'jvds_workshop_evidence';

  function read() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function setup(box) {
    var id = box.getAttribute('data-workshop-evidence');
    if (!id) return;
    var check = box.querySelector('[data-ws-evidence-check]');
    var status = box.querySelector('[data-ws-evidence-status]');
    if (!check) return;
    var data = read();

    function render() {
      var saved = data[id] && data[id].confirmedAt;
      check.checked = !!saved;
      box.classList.toggle('is-saved', !!saved);
      if (status) {
        status.textContent = saved
          ? 'Evidence saved on ' + formatDate(saved) + '. It stays on this device.'
          : 'Your tick is saved on this device only.';
      }
    }

    check.addEventListener('change', function () {
      data = read();
      if (check.checked) {
        data[id] = { confirmedAt: new Date().toISOString() };
      } else {
        delete data[id];
      }
      write(data);
      render();
      try {
        window.dispatchEvent(new CustomEvent('jvds:evidence', {
          detail: { workshop: id, confirmed: check.checked }
        }));
      } catch (e) {}
    });

    render();
  }

  function init() {
    var boxes = document.querySelectorAll('[data-workshop-evidence]');
    for (var i = 0; i < boxes.length; i++) setup(boxes[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
