/* jvds-asset-bus.js , A2589
   A tiny in-browser memory bus so the last thing a learner made in one studio
   can be used in the next one without a download, an upload or an account.

   It stores a short list in localStorage (survives refresh and works offline)
   and pings other open tabs with BroadcastChannel. If BroadcastChannel is not
   available the storage event still updates open tabs.

   Kinds: 'sprite', 'sound', 'level'.

   API:
     JVDSAssetBus.publish({ kind, name, tool, payload, meta })
     JVDSAssetBus.publishSprite({ name, tool, dataUrl, frameW, frameH, frameCount })
     JVDSAssetBus.publishSound({ name, tool, dataUrl, slot })
     JVDSAssetBus.publishLevel({ name, tool, data })
     JVDSAssetBus.list(kind?)        newest first
     JVDSAssetBus.latest(kind)
     JVDSAssetBus.get(id)
     JVDSAssetBus.remove(id)
     JVDSAssetBus.clear()
     JVDSAssetBus.subscribe(fn)      returns an unsubscribe function

   Everything fails safely: a blocked or corrupt store reads as an empty list.
*/
(function () {
  'use strict';

  var KEY = 'jvds_asset_bus_v1';
  var CHANNEL = 'jvds-asset-bus';
  var MAX_ITEMS = 12;
  var MAX_BYTES = 900000;
  var KINDS = ['sprite', 'sound', 'level'];

  var listeners = [];
  var channel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = function () { notify('channel'); };
    }
  } catch (e) { channel = null; }

  function isKind(k) { return KINDS.indexOf(k) !== -1; }

  function validItem(o) {
    return !!(o && typeof o === 'object' && typeof o.id === 'string' && o.id &&
      isKind(o.kind) && o.payload && typeof o.payload === 'object');
  }

  function read() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return []; }
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(validItem) : [];
    } catch (e) { return []; }
  }

  function write(list) {
    var trimmed = list.slice(0, MAX_ITEMS);
    try {
      localStorage.setItem(KEY, JSON.stringify(trimmed));
      return true;
    } catch (e) {
      // Storage can be full on a school profile. Keep the newest few and retry once.
      try {
        localStorage.setItem(KEY, JSON.stringify(trimmed.slice(0, Math.max(1, Math.floor(MAX_ITEMS / 2)))));
        return true;
      } catch (e2) { return false; }
    }
  }

  function notify(reason) {
    var items = read();
    listeners.slice().forEach(function (fn) {
      try { fn(items, reason); } catch (e) {}
    });
    if (channel) {
      try { channel.postMessage({ type: 'changed', reason: reason, at: Date.now() }); } catch (e) {}
    }
  }

  function newId() {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function publish(opts) {
    opts = opts || {};
    if (!isKind(opts.kind) || !opts.payload || typeof opts.payload !== 'object') return null;
    var size = 0;
    try { size = JSON.stringify(opts.payload).length; } catch (e) { return null; }
    if (size > MAX_BYTES) return null;
    var item = {
      id: newId(),
      kind: opts.kind,
      name: String(opts.name || 'Untitled').slice(0, 60),
      tool: String(opts.tool || '').slice(0, 40),
      at: new Date().toISOString(),
      meta: (opts.meta && typeof opts.meta === 'object') ? opts.meta : {},
      payload: opts.payload
    };
    // The same art/sound/level made again replaces the old copy instead of
    // filling the list with duplicates.
    var compare = JSON.stringify(item.payload);
    var list = read().filter(function (x) {
      if (x.kind !== item.kind || x.name !== item.name) return true;
      try { return JSON.stringify(x.payload) !== compare; } catch (e) { return true; }
    });
    list.unshift(item);
    write(list);
    notify('publish');
    return item;
  }

  function publishSprite(o) {
    o = o || {};
    if (!o.dataUrl) return null;
    return publish({
      kind: 'sprite',
      name: o.name || 'Pixel Studio sprite',
      tool: o.tool || 'pixel-studio',
      payload: { dataUrl: o.dataUrl, frameW: o.frameW || 0, frameH: o.frameH || 0, frameCount: o.frameCount || 1 }
    });
  }

  function publishSound(o) {
    o = o || {};
    if (!o.dataUrl) return null;
    return publish({
      kind: 'sound',
      name: o.name || 'Sound Studio sound',
      tool: o.tool || 'sound-studio',
      meta: { slot: o.slot === 'sfx' ? 'sfx' : 'music' },
      payload: { dataUrl: o.dataUrl, slot: o.slot === 'sfx' ? 'sfx' : 'music' }
    });
  }

  function publishLevel(o) {
    o = o || {};
    if (!o.data || typeof o.data !== 'object') return null;
    return publish({
      kind: 'level',
      name: o.name || 'Level Designer level',
      tool: o.tool || 'level-designer',
      payload: o.data
    });
  }

  function list(kind) {
    var items = read();
    if (kind) items = items.filter(function (x) { return x.kind === kind; });
    return items;
  }

  function latest(kind) { return list(kind)[0] || null; }

  function get(id) {
    return read().filter(function (x) { return x.id === id; })[0] || null;
  }

  function remove(id) {
    var before = read();
    var next = before.filter(function (x) { return x.id !== id; });
    if (next.length === before.length) return false;
    write(next);
    notify('remove');
    return true;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    notify('clear');
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  try {
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) notify('storage');
    });
  } catch (e) {}

  window.JVDSAssetBus = {
    KEY: KEY,
    KINDS: KINDS.slice(),
    MAX_ITEMS: MAX_ITEMS,
    publish: publish,
    publishSprite: publishSprite,
    publishSound: publishSound,
    publishLevel: publishLevel,
    list: list,
    latest: latest,
    get: get,
    remove: remove,
    clear: clear,
    subscribe: subscribe,
    read: read
  };
})();
