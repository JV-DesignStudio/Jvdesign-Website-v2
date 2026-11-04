/* Local "this step is broken" reports (A2342).
   The canvas engine stores reports in localStorage under jvds_stuck_reports.
   This script renders them on My Progress. Nothing is uploaded. */
(function () {
  'use strict';

  function read() {
    try {
      var all = JSON.parse(localStorage.getItem('jvds_stuck_reports') || '[]');
      return Array.isArray(all) ? all : [];
    } catch (e) { return []; }
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render() {
    var list = document.getElementById('stuckReportsList');
    var section = document.getElementById('stuckReports');
    if (!list || !section) return;
    var items = read();
    if (!items.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    list.innerHTML = items.slice().reverse().map(function (it) {
      var when = '';
      try { when = new Date(it.at).toLocaleDateString(); } catch (e) {}
      return '<div class="mp-card" style="padding:14px 16px">' +
        '<div class="mp-title">' + esc(it.workshop) + ' · step ' + esc(it.step) + '</div>' +
        '<div class="mp-meta">' + esc(it.title) + '</div>' +
        '<div class="mp-meta" style="margin-top:5px">' + esc(it.note) + (when ? ' · ' + esc(when) : '') + '</div>' +
      '</div>';
    }).join('');
  }

  function copy() {
    var status = document.getElementById('stuckReportsStatus');
    var text = JSON.stringify(read(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (status) status.textContent = 'Copied.';
        setTimeout(function () { if (status) status.textContent = ''; }, 1800);
      }, function () {
        if (status) status.textContent = 'Copy failed.';
      });
    } else if (status) {
      status.textContent = 'Copy is not available here.';
    }
  }

  render();
  var btn = document.getElementById('stuckReportsCopy');
  if (btn) btn.addEventListener('click', copy);
})();
