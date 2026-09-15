/* ═══════════════════════════════════════════════════════════
   jvds-store.js, one profile, one save (A256)

   JVDS.store     one versioned object under the "jvds" key for new shared
                  state (the learner's character, first-mission steps).
   JVDS.backpack  "Download my backpack": every save on this site in one
                  file, so work survives a wiped school PC. Old
                  jvds-backup.json files and transfer codes still restore.
   JVDS.progress  one read of XP, level, streak, quests, cosmetics and
                  today's/this week's challenge, whichever page you are on.

   Older modules keep their own keys (jvds_profile, jvds_cosmetics,
   jvds_game_*, wkp_*...) because games, arcade.html and the apps read
   them directly. The backpack covers all of them.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var W = window;
  W.JVDS = W.JVDS || {};

  var ROOT_KEY = 'jvds';
  var VERSION = 1;

  function ls() { try { return W.localStorage; } catch (e) { return null; } }
  function readJSON(k, fallback) {
    var s = ls(); if (!s) return fallback;
    try { var v = JSON.parse(s.getItem(k) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; }
  }

  /* ─── STORE: one versioned root object ─── */
  function loadRoot() {
    var r = readJSON(ROOT_KEY, null);
    if (!r || typeof r !== 'object' || Array.isArray(r)) r = { v: VERSION };
    if (!r.v) r.v = VERSION;
    return r;
  }
  function saveRoot(r) {
    var s = ls(); if (!s) return false;
    r.v = VERSION; r.updatedAt = new Date().toISOString();
    try { s.setItem(ROOT_KEY, JSON.stringify(r)); return true; } catch (e) { return false; }
  }
  function walk(obj, path) {
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (obj == null || typeof obj !== 'object') return undefined;
      obj = obj[parts[i]];
    }
    return obj;
  }

  var store = {
    version: VERSION,
    key: ROOT_KEY,
    get: function (path, fallback) {
      var v = path ? walk(loadRoot(), path) : loadRoot();
      return v === undefined ? fallback : v;
    },
    set: function (path, value) {
      var r = loadRoot(), parts = String(path).split('.'), o = r;
      for (var i = 0; i < parts.length - 1; i++) {
        if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
        o = o[parts[i]];
      }
      o[parts[parts.length - 1]] = value;
      var ok = saveRoot(r);
      try { W.dispatchEvent(new CustomEvent('jvds-store-changed', { detail: { path: path, value: value } })); } catch (e) {}
      return ok;
    }
  };

  /* ─── BACKPACK: every save on this site, minus secrets ─── */
  // Everything in this browser's storage for jvdesignstudio.co.uk is ours, so
  // the backpack takes it all (games, tools, workshops, wkp_*, builds) and
  // only leaves out secrets and choices that belong to one device.
  var NEVER_PACK = [
    /^gh_pat$/, /^gh_gist_id$/,            // GitHub token and the gist it points to
    /token|secret|password|apikey/i,
    /^ga4_/, /^_ga/,                       // analytics ids
    /^jvds-cookie-consent$/,               // consent is asked per device
    /^jvds-keys-migrated/,                 // one-off migration flags
    /^teacher_mode$/                       // a teacher's device setting
  ];
  var MAX_BYTES = 8 * 1024 * 1024;

  function packable(k) {
    if (typeof k !== 'string' || !k) return false;
    for (var i = 0; i < NEVER_PACK.length; i++) if (NEVER_PACK[i].test(k)) return false;
    return true;
  }

  function collect() {
    var s = ls(), keys = {};
    if (s) for (var i = 0; i < s.length; i++) {
      var k = s.key(i);
      if (packable(k)) keys[k] = s.getItem(k);
    }
    return { format: 'jvds-backpack', v: VERSION, savedAt: new Date().toISOString(), count: Object.keys(keys).length, keys: keys };
  }

  // Accepts a backpack ({format:'jvds-backpack', keys:{...}}), an old
  // My Progress file ({app:'jvdesignstudio-progress', data:{...}}) or an old
  // flat jvds-backup.json ({key: "string"}). Checks everything before writing.
  function restore(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Not a backpack file');
    var keys = data.format === 'jvds-backpack' ? data.keys
      : data.app === 'jvdesignstudio-progress' ? data.data
      : data;
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('Not a backpack file');
    var names = Object.keys(keys).filter(packable);
    names.forEach(function (k) { if (typeof keys[k] !== 'string') throw new Error('Not a backpack file'); });
    var s = ls(); if (!s) throw new Error('Storage is blocked in this browser');
    names.forEach(function (k) { s.setItem(k, keys[k]); });
    return names.length;
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  var backpack = {
    collect: collect,
    restore: restore,
    isPackable: packable,
    download: function () {
      var pack = collect();
      var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-jvds-backpack-' + today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return pack.count;
    },
    restoreFile: function (file) {
      return new Promise(function (resolve, reject) {
        if (!file) return reject(new Error('No file chosen'));
        if (file.size > MAX_BYTES) return reject(new Error('That file is too big to be a backpack'));
        var r = new FileReader();
        r.onload = function () { try { resolve(restore(JSON.parse(r.result))); } catch (e) { reject(e); } };
        r.onerror = function () { reject(new Error('Could not read that file')); };
        r.readAsText(file);
      });
    },
    toCode: function () { return btoa(unescape(encodeURIComponent(JSON.stringify(collect())))); },
    fromCode: function (code) { return restore(JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))))); }
  };

  /* ─── PROGRESS: one read of the learner's progress ─── */
  // Uses the live PlayerProfile when the page loaded it, otherwise reads the
  // saved profile directly so light pages (nav, hubs) show the same numbers.
  function profileState() {
    try { if (typeof playerProfile !== 'undefined' && playerProfile && playerProfile.state) return playerProfile.state; } catch (e) {}
    return readJSON('jvds_profile', null);
  }

  var progress = {
    summary: function () {
      var p = profileState() || {};
      var xp = p.globalXP || 0, per = 100;
      var quests = p.questProgress || {};
      var questsDone = Object.keys(quests).filter(function (q) { return quests[q] && quests[q].completed; }).length;
      var cosmetics = readJSON('jvds_cosmetics', {});
      var cosmeticCount = 0;
      Object.keys(cosmetics || {}).forEach(function (g) { cosmeticCount += (cosmetics[g] || []).length || 0; });
      var d = p.dailyActivity || {}, w = p.weeklyActivity || {};
      return {
        hasProfile: !!profileState(),
        xp: xp,
        level: p.level || Math.floor(xp / per) + 1,
        xpIntoLevel: xp % per,
        xpPerLevel: per,
        streak: p.dailyStreak || 0,
        workshopsDone: (p.completedWorkshops || []).length,
        questsDone: questsDone,
        achievements: (p.achievements || []).length,
        cosmetics: Math.max(cosmeticCount, (p.unlockedGameModes || []).length),
        dailyClaimed: !!(d.claimed && d.date === today()),
        weeklyClaimed: !!w.claimed,
        character: store.get('character', null)
      };
    },
    addXP: function (amount, source) {
      try { if (typeof playerProfile !== 'undefined' && playerProfile) return playerProfile.addXP(amount, source); } catch (e) {}
      return false;
    }
  };

  W.JVDS.store = store;
  W.JVDS.backpack = backpack;
  W.JVDS.progress = progress;
})();
