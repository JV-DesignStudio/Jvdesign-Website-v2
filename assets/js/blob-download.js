// Shared canvas-to-file download using Blob URLs.
// Avoids toDataURL which can fail on locked-down school profiles with large canvases.
//
//   window.JVDS_DOWNLOAD(canvas, filename)              -> PNG
//   window.JVDS_DOWNLOAD(canvas, filename, 'image/png') -> PNG
//   window.JVDS_DOWNLOAD(canvas, filename, 'image/jpeg', 0.92) -> JPEG
//
// Falls back to toDataURL if toBlob is unavailable (old browsers).
(function () {
  'use strict';

  window.JVDS_DOWNLOAD = function (canvas, filename, mimeType, quality) {
    if (!canvas || !filename) return;
    var mime = mimeType || 'image/png';

    function download(url) {
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 4000);
    }

    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(function (blob) {
        if (blob) download(URL.createObjectURL(blob));
      }, mime, quality);
    } else {
      download(canvas.toDataURL(mime, quality));
    }
  };
})();
