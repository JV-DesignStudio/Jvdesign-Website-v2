(function () {
  'use strict';
  var KEY = 'jvds_maker_profiles';
  var MAX = 4;
  var PROFILE = /^(jvds|jv_|qb-|wkp_|pixel|sound|level|arcade|csg|gdd|sprite|story|map|tileset|card|tabletop|voxel|world|drum|music|sfx|palette|colour|icon|logo|screenshot|store-page|buildlab)/i;
  var DEVICE = /^(jvds_studio_settings|jvds_studio_tab|jvds-cookie-consent|jvds-keys-migrated|jvds_theme|jvds-theme|theme|jvds_maker_profiles)/i;

  function profileKey(k) { return PROFILE.test(k) && !DEVICE.test(k); }
  function read() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && Array.isArray(d.profiles)) return d;
    } catch (e) {}
    return { v: 1, active: null, profiles: [] };
  }
  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }
  function bag() {
    try { if (window.JVDS && JVDS.backpack) return JVDS.backpack; } catch (e) {}
    return null;
  }
  function currentName() {
    try { return (localStorage.getItem('jvds-player-name') || '').trim(); } catch (e) { return ''; }
  }
  function activeProfile(d) {
    for (var i = 0; i < d.profiles.length; i++) if (d.profiles[i].id === d.active) return d.profiles[i];
    return null;
  }
  function seed(d) {
    if (d.profiles.length) return d;
    d.profiles.push({ id: 'a', name: currentName() || 'Maker 1', pack: null });
    d.active = 'a';
    return d;
  }
  function pack() {
    var b = bag();
    if (!b) return null;
    var all = b.collect(), keys = {};
    Object.keys(all.keys).forEach(function (k) { if (profileKey(k)) keys[k] = all.keys[k]; });
    return { format: 'jvds-backpack', v: all.v, savedAt: new Date().toISOString(), count: Object.keys(keys).length, keys: keys };
  }
  function clearProfileKeys() {
    var remove = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (profileKey(k)) remove.push(k);
      }
    } catch (e) {}
    remove.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  }
  function restore(p) {
    var b = bag();
    if (!b || !p) return;
    try { b.restore(p); } catch (e) {}
  }
  function setName(name) {
    try { localStorage.setItem('jvds-player-name', name); } catch (e) {}
  }
  function saveActive(d) {
    var p = activeProfile(d);
    if (!p) return;
    p.name = currentName() || p.name;
    var pk = pack();
    if (pk) p.pack = pk;
    write(d);
  }
  function switchTo(id) {
    var d = seed(read());
    if (id === d.active) return;
    var target = d.profiles.filter(function (p) { return p.id === id; })[0];
    if (!target) return;
    if (!window.confirm('Switch to ' + target.name + '? Save any work in this maker first.')) return;
    saveActive(d);
    var ok = true;
    if (target.pack) { clearProfileKeys(); restore(target.pack); }
    d.active = id;
    setName(target.name);
    if (!write(d)) ok = false;
    if (ok) location.reload();
  }
  function add() {
    var d = seed(read());
    if (d.profiles.length >= MAX) return;
    saveActive(d);
    var id = 'p' + Date.now();
    var name = 'Maker ' + (d.profiles.length + 1);
    var newPack = { format: 'jvds-backpack', v: 1, savedAt: new Date().toISOString(), count: 1, keys: { 'jvds-player-name': name } };
    d.profiles.push({ id: id, name: name, pack: newPack });
    d.active = id;
    clearProfileKeys();
    restore(newPack);
    setName(name);
    if (write(d)) location.reload();
  }
  function rename() {
    var d = seed(read());
    var p = activeProfile(d);
    if (!p) return;
    var name = (window.prompt('What is this maker called?', currentName() || p.name) || '').trim().slice(0, 28);
    if (!name) return;
    p.name = name;
    setName(name);
    write(d);
    render();
    try {
      var display = document.getElementById('displayName');
      if (display) display.textContent = name;
      var input = document.getElementById('playerName');
      if (input) input.value = name;
    } catch (e) {}
  }
  function render() {
    var d = seed(read());
    var list = document.getElementById('makersList');
    if (!list) return;
    list.innerHTML = '';
    d.profiles.forEach(function (p) {
      var b = document.createElement('button');
      var active = p.id === d.active;
      b.type = 'button';
      b.className = 'tab';
      b.setAttribute('data-maker', p.id);
      b.textContent = (active ? (currentName() || p.name) : p.name) + (active ? ' (this maker)' : '');
      if (active) {
        b.style.background = '#E8608A';
        b.style.color = '#fff';
        b.style.borderColor = '#E8608A';
      } else {
        b.addEventListener('click', function () { switchTo(p.id); });
      }
      list.appendChild(b);
    });
    var addBtn = document.getElementById('addMakerBtn');
    if (addBtn) addBtn.disabled = d.profiles.length >= MAX;
    var msg = document.getElementById('makersMsg');
    if (msg) msg.textContent = d.profiles.length < 2
      ? 'Add a second maker and each child keeps their own XP, streak and saves.'
      : 'Switch makers before your child starts. Each one keeps their own progress.';
  }
  function start() {
    if (!bag()) return;
    if (!document.getElementById('makersCard')) return;
    render();
    var addBtn = document.getElementById('addMakerBtn');
    if (addBtn) addBtn.addEventListener('click', add);
    var renameBtn = document.getElementById('renameMakerBtn');
    if (renameBtn) renameBtn.addEventListener('click', rename);
    var input = document.getElementById('playerName');
    if (input) input.addEventListener('change', function () {
      var d = seed(read());
      var p = activeProfile(d);
      if (!p) return;
      p.name = input.value.trim() || p.name;
      write(d);
      render();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
