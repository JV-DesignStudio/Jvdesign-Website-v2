/* Godot Lab - A2959.
   The replica's own Download button is still the source of the project ZIP.
   This adds one explicit lab button and a status line, so the three-step path
   is obvious without reading the whole page. */
(function () {
  'use strict';

  var btn = document.querySelector('[data-godot-lab-download]');
  var status = document.querySelector('[data-godot-lab-status]');
  if (!btn) return;

  function setStatus(msg) {
    if (status) status.textContent = msg || '';
  }

  btn.addEventListener('click', function () {
    if (window.EngineFeel && typeof window.EngineFeel.download === 'function') {
      window.EngineFeel.download();
      setStatus('Starter project saved. Open the real editor, choose Preload project ZIP, then press Start.');
    } else {
      setStatus('The replica did not load. Use the project files in the workshop instead.');
    }
  });
})();
