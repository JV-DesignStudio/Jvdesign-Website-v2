/* ============================================================
   assets/js/studio/studio-bundle.js - project bundles

   Export and import one portable file for the current device's
   JVDS saves. The bundle is a normal ZIP (extension .jvzip) built
   with the self-hosted JSZip copy, so it works offline and needs no
   new dependency. A plain .json export is always available too.

   File layout inside the bundle:
     studio-project.json   every save, plus author/licence metadata
     README.txt            plain-English restore instructions
     saves/<key>.txt       one readable file per saved item
   ============================================================ */
(function () {
  'use strict';
  var S = window.JVDSStudio = window.JVDSStudio || {};
  var api = S.bundle = S.bundle || {};

  var ZIP_SRC = '/assets/vendor/jszip/jszip.min.js';

  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (resolve, reject) {
      var example = document.querySelector('script[src*="jszip"], script[data-jvds-jszip]');
      if (example && example.dataset.jvdsLoading === '1') {
        example.addEventListener('load', function () { window.JSZip ? resolve(window.JSZip) : reject(new Error('ZIP support did not load.')); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = ZIP_SRC;
      script.async = true;
      script.dataset.jvdsJszip = '1';
      script.dataset.jvdsLoading = '1';
      script.onload = function () {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error('ZIP support did not load. Use Export JSON instead.'));
      };
      script.onerror = function () { reject(new Error('ZIP support did not load. Use Export JSON instead.')); };
      document.head.appendChild(script);
    });
  }

  function stamp() {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
  }

  function safeName(key) {
    return String(key).replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'save';
  }

  function projectData() {
    var settings = S.settings ? S.settings.all() : {};
    var saves = S._collectSaves ? S._collectSaves() : {};
    return {
      kind: 'jvds-studio-project',
      v: 1,
      tool: S.tool || '',
      createdAt: new Date().toISOString(),
      author: settings.author || '',
      license: settings.license || '',
      watermark: !!settings.watermark,
      attribution: S.metadata ? S.metadata.stamp() : '',
      settings: settings,
      saves: saves
    };
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { a.remove(); URL.revokeObjectURL(url); } catch (e) {}
    }, 1500);
  }

  function readme(data) {
    return [
      'JVDesignStudio project bundle',
      '=============================',
      '',
      'Tool: ' + (data.tool || 'studio'),
      'Exported: ' + data.createdAt,
      'Items: ' + Object.keys(data.saves || {}).length,
      data.author ? 'Author: ' + data.author : '',
      data.license ? 'Licence: ' + data.license : '',
      '',
      'How to get your work back',
      '-------------------------',
      '1. Open the same tool in JVDesignStudio.',
      '2. Open Studio tools (the Studio button, bottom right).',
      '3. Choose "Import a file" and pick this .jvzip.',
      '4. Confirm the restore. Your previous saves are replaced.',
      '',
      'You can also open studio-project.json in any text editor.',
      'Nothing here is uploaded anywhere.',
      ''
    ].filter(Boolean).join('\n');
  }

  api.export = function () {
    var data = projectData();
    var keys = Object.keys(data.saves);
    if (!keys.length) {
      if (S.toast) S.toast('Nothing to export yet. Make something first.', { tone: 'warn' });
      return Promise.resolve('');
    }
    return loadZip().then(function (JSZip) {
      var zip = new JSZip();
      zip.file('studio-project.json', JSON.stringify(data, null, 2));
      zip.file('README.txt', readme(data));
      keys.forEach(function (key) {
        zip.file('saves/' + safeName(key) + '.txt', String(data.saves[key]));
      });
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }).then(function (blob) {
      var name = 'jvds-' + (data.tool || 'studio') + '-' + stamp() + '.jvzip';
      download(blob, name);
      if (S.toast) S.toast('Bundle saved: ' + name, { tone: 'ok', timeout: 6000 });
      return name;
    }).catch(function (err) {
      if (S.toast) S.toast(err.message || 'Could not build the bundle. Use Export JSON.', { tone: 'warn' });
      return api.exportJSON();
    });
  };

  api.exportJSON = function () {
    var data = projectData();
    if (!Object.keys(data.saves).length) {
      if (S.toast) S.toast('Nothing to export yet. Make something first.', { tone: 'warn' });
      return Promise.resolve('');
    }
    var name = 'jvds-' + (data.tool || 'studio') + '-' + stamp() + '.json';
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name);
    if (S.toast) S.toast('JSON saved: ' + name, { tone: 'ok', timeout: 6000 });
    return Promise.resolve(name);
  };

  function parseFile(file) {
    var name = String(file.name || '').toLowerCase();
    if (/\.(zip|jvzip)$/.test(name)) {
      return loadZip().then(function (JSZip) {
        return JSZip.loadAsync(file);
      }).then(function (zip) {
        var entry = zip.file('studio-project.json');
        if (!entry) throw new Error('That ZIP does not contain studio-project.json.');
        return entry.async('string');
      }).then(function (text) { return JSON.parse(text); });
    }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try { resolve(JSON.parse(String(reader.result))); }
        catch (e) { reject(new Error('That file is not a JVDS project bundle.')); }
      };
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.readAsText(file);
    });
  }

  api.import = function (file) {
    if (!file) return Promise.resolve(false);
    return parseFile(file).then(function (data) {
      if (!data || data.kind !== 'jvds-studio-project' || !data.saves) {
        throw new Error('That file is not a JVDS project bundle.');
      }
      var count = Object.keys(data.saves).length;
      if (!count) throw new Error('That bundle has no saves in it.');
      var when = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'an unknown date';
      return S.confirm({
        title: 'Restore this bundle?',
        message: 'This bundle has ' + count + ' saved item(s) from ' + (data.tool || 'a studio tool') + ', exported ' + when + '. Restoring replaces the matching saves in this browser.',
        confirm: 'Restore'
      }).then(function (ok) {
        if (!ok) return false;
        var written = S._applySaves(data.saves);
        if (S.toast) S.toast('Restored ' + written + ' saved item(s). Reloading...', { tone: 'ok' });
        setTimeout(function () { location.reload(); }, 900);
        return true;
      });
    }).catch(function (err) {
      if (S.toast) S.toast(err.message || 'Could not restore that file.', { tone: 'warn' });
      return false;
    });
  };
})();
