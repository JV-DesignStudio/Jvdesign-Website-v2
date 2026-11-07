/* Local "this step is broken" reports (A2342) and failed-try counts (A2301).
   The canvas engine stores reports in localStorage under jvds_stuck_reports and
   per-step failed tries under jvds_step_fails. This script renders both on My
   Progress and can export them for scripts/stuck-summary.js. Nothing is uploaded. */
(function () {
  'use strict';

  var REPORT_KEY = 'jvds_stuck_reports';
  var FAIL_KEY = 'jvds_step_fails';

  function readJson(key) {
    try {
      var all = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(all) ? all : [];
    } catch (e) { return []; }
  }

  function read() { return readJson(REPORT_KEY); }
  function readFails() { return readJson(FAIL_KEY); }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function pretty(slug) {
    return String(slug || '').replace(/\.html?$/i, '').replace(/[-_]/g, ' ');
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

  function renderFails() {
    var list = document.getElementById('failSummaryList');
    var section = document.getElementById('failSummary');
    if (!list || !section) return;
    var items = readFails().slice().sort(function (a, b) {
      return (b.count || 0) - (a.count || 0);
    });
    if (!items.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    list.innerHTML = items.slice(0, 8).map(function (it) {
      var tries = it.count || 0;
      var label = pretty(it.workshop) + ' · step ' + esc(it.step);
      var extra = it.title ? esc(it.title) : (it.source ? esc(it.source) : '');
      return '<div class="mp-card" style="padding:14px 16px">' +
        '<div class="mp-title">' + label + ' · ' + tries + (tries === 1 ? ' try' : ' tries') + '</div>' +
        (extra ? '<div class="mp-meta">' + extra + '</div>' : '') +
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

  function exportAll() {
    var status = document.getElementById('stuckExportStatus');
    var data = {
      exportedAt: new Date().toISOString(),
      reports: read(),
      fails: readFails()
    };
    try {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'jvds-stuck-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      if (status) { status.textContent = 'Downloaded.'; setTimeout(function () { status.textContent = ''; }, 1800); }
    } catch (e) {
      if (status) status.textContent = 'Export failed.';
    }
  }

  render();
  renderFails();
  var btn = document.getElementById('stuckReportsCopy');
  if (btn) btn.addEventListener('click', copy);
  var exportBtn = document.getElementById('stuckExport');
  if (exportBtn) exportBtn.addEventListener('click', exportAll);
})();
