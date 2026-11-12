/* ============================================================
   assets/js/studio/studio-storage.js - Studio Core storage

   IndexedDB snapshot store for the cross-tool revision history.
   Loaded on demand by assets/js/studio-core.js.

   Design notes:
   - Saves stay in localStorage (every tool already reads them
     directly). IndexedDB only holds rolling snapshots, so nothing
     can break an existing tool that expects localStorage.
   - Snapshots are small JSON records, pruned to the learner's
     "keepRevisions" setting (default 5).
   - Every promise rejects with a plain-English error so the drawer
     can tell the learner to export instead of showing a stack trace.
   ============================================================ */
(function () {
  'use strict';
  var S = window.JVDSStudio = window.JVDSStudio || {};
  var api = S.storage = S.storage || {};

  var DB_NAME = 'jvds-studio';
  var STORE = 'snapshots';
  var ASSETS = 'assets';
  var DB_VERSION = 2;
  var dbPromise = null;

  function fail(message) {
    var err = new Error(message);
    return Promise.reject(err);
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('This browser will not open the snapshot store. Use Export JSON instead.'));
      var request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { return reject(new Error('This browser blocked the snapshot store. Use Export JSON instead.')); }
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('at', 'at', { unique: false });
        }
        // Heavy assets (audio buffers, big pixel art, GDD documents) live here
        // rather than in localStorage, so a 5 MB text quota cannot block them.
        if (!db.objectStoreNames.contains(ASSETS)) {
          db.createObjectStore(ASSETS, { keyPath: 'key' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(new Error('Could not open the snapshot store. Use Export JSON instead.')); };
      request.onblocked = function () { reject(new Error('Another tab is using the snapshot store. Close it and try again.')); };
    });
    return dbPromise;
  }

  function tx(mode, work) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(STORE, mode);
        var store = transaction.objectStore(STORE);
        var result;
        try { result = work(store, transaction); } catch (e) { reject(e); return; }
        transaction.oncomplete = function () { resolve(result && result.__value !== undefined ? result.__value : result); };
        transaction.onerror = function () { reject(new Error('The snapshot store could not save. Export your work instead.')); };
        transaction.onabort = function () { reject(new Error('The snapshot store stopped. Export your work instead.')); };
      });
    });
  }

  function bytesOf(text) {
    try { return new Blob([text]).size; } catch (e) { return text.length * 2; }
  }

  function summarize(record) {
    return {
      id: record.id,
      at: record.at,
      label: record.label || 'Snapshot',
      tool: record.tool || '',
      hash: record.hash || '',
      bytes: record.bytes || 0,
      count: record.saves ? Object.keys(record.saves).length : 0
    };
  }

  api.saveSnapshot = function (opts) {
    opts = opts || {};
    var saves = opts.saves || {};
    var keys = Object.keys(saves);
    if (!keys.length) return Promise.resolve(null);
    var json = JSON.stringify(saves);
    // Keep one record under 4 MB so a huge sprite sheet cannot wedge IndexedDB.
    if (json.length > 4 * 1024 * 1024) {
      return fail('This project is too large for a snapshot. Export a bundle instead.');
    }
    var record = {
      at: Date.now(),
      label: String(opts.label || 'Auto save').slice(0, 60),
      tool: String(opts.tool || '').slice(0, 60),
      hash: S._savesHash ? S._savesHash(saves) : '',
      bytes: bytesOf(json),
      saves: saves
    };
    return api.list().then(function (rows) {
      var latest = rows[0];
      if (!opts.force && latest && latest.hash && latest.hash === record.hash) return null;
      return tx('readwrite', function (store) {
        var req = store.add(record);
        var holder = { __value: null };
        req.onsuccess = function () { holder.__value = summarize(Object.assign({ id: req.result }, record)); };
        return holder;
      }).then(function (saved) {
        return api.prune(opts.keep || 5).then(function () { return saved; });
      });
    });
  };

  api.list = function () {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(STORE, 'readonly');
        var store = transaction.objectStore(STORE);
        var rows = [];
        var req = store.openCursor();
        req.onsuccess = function () {
          var cursor = req.result;
          if (!cursor) return;
          rows.push(summarize(cursor.value));
          cursor.continue();
        };
        transaction.oncomplete = function () {
          rows.sort(function (a, b) { return b.at - a.at; });
          resolve(rows);
        };
        transaction.onerror = function () { reject(new Error('Could not read the snapshot list.')); };
      });
    }).catch(function () { return []; });
  };

  api.get = function (id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(STORE, 'readonly');
        var req = transaction.objectStore(STORE).get(Number(id));
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(new Error('Could not open that snapshot.')); };
      });
    });
  };

  api.restore = function (id) {
    return api.get(id).then(function (record) {
      if (!record || !record.saves) throw new Error('That snapshot is empty.');
      var written = S._applySaves ? S._applySaves(record.saves) : 0;
      return { written: written, at: record.at };
    });
  };

  api.prune = function (keep) {
    keep = Math.max(1, Number(keep) || 5);
    return api.list().then(function (rows) {
      var drop = rows.slice(keep);
      if (!drop.length) return 0;
      return tx('readwrite', function (store) {
        drop.forEach(function (row) { store.delete(row.id); });
      }).then(function () { return drop.length; });
    });
  };

  api.clear = function () {
    return tx('readwrite', function (store) { store.clear(); }).then(function () { return true; });
  };

  api.estimate = function () {
    return S.quota && S.quota.estimate ? S.quota.estimate() : Promise.resolve({ usage: 0, quota: 0, ratio: 0 });
  };

  function assetTx(mode, work) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(ASSETS, mode);
        var store = transaction.objectStore(ASSETS);
        var holder = { value: null };
        try { work(store, holder); } catch (e) { reject(e); return; }
        transaction.oncomplete = function () { resolve(holder.value); };
        transaction.onerror = function () { reject(new Error('The asset store could not save. Export instead.')); };
        transaction.onabort = function () { reject(new Error('The asset store stopped. Export instead.')); };
      });
    });
  }

  // Heavy assets live in IndexedDB, not localStorage. Tools opt in with
  // JVDSStudio.storage.putAsset(key, blob) and read back with getAsset.
  api.putAsset = function (key, blob, meta) {
    if (!key) return fail('An asset needs a key.');
    return assetTx('readwrite', function (store, holder) {
      var req = store.put({ key: key, blob: blob, meta: meta || {}, at: Date.now(), bytes: blob && blob.size || 0 });
      req.onsuccess = function () { holder.value = { key: key, bytes: blob && blob.size || 0 }; };
    });
  };

  api.getAsset = function (key) {
    return assetTx('readonly', function (store, holder) {
      var req = store.get(key);
      req.onsuccess = function () { holder.value = req.result || null; };
    });
  };

  api.deleteAsset = function (key) {
    return assetTx('readwrite', function (store, holder) {
      store.delete(key);
      holder.value = true;
    });
  };

  api.listAssets = function () {
    return assetTx('readonly', function (store, holder) {
      var rows = [];
      var req = store.openCursor();
      req.onsuccess = function () {
        var cursor = req.result;
        if (!cursor) return;
        var item = cursor.value;
        rows.push({ key: item.key, bytes: item.bytes || 0, at: item.at || 0, meta: item.meta || {} });
        cursor.continue();
      };
      holder.value = rows;
    }).then(function (rows) {
      return (rows || []).sort(function (a, b) { return b.at - a.at; });
    });
  };

  api.usable = function () {
    return !!window.indexedDB;
  };
})();
