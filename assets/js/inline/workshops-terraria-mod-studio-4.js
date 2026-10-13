/* Terraria World Studio - a browser-only world builder.
   No game, no install: paint tiles, place objects, walk to test, plan files,
   read a log and download a world plan. School-computer friendly on purpose. */
(function () {
  var COLS = 24, ROWS = 16, CELL = 24;
  var COLORS = { air: '#0b0f14', grass: '#5cae4a', dirt: '#7a4a2b', stone: '#7d7d84', water: '#3b7dd8', sand: '#dcc38a', snow: '#eaf3ff', ice: '#bfe6ff', tree: '#2f6b33', plank: '#b5895a', chest: '#8a5a2b', ore: '#c9a227', torch: '#e8a13a', door: '#6d4535' };
  var SOLID = { stone: 1, ice: 1, tree: 1, chest: 1, ore: 1, door: 1 };
  var map = document.getElementById('twmsMap'); if (!map) return;
  var ctx = map.getContext('2d');
  var mini = document.getElementById('twMinimap'), mctx = mini ? mini.getContext('2d') : null;

  var tiles = new Array(COLS * ROWS).fill('air');
  var walls = new Array(COLS * ROWS).fill(false);
  var undoStack = [];
  var current = 'grass';
  var tool = 'paint';
  var objMode = null;
  var wallMode = false;
  var painting = false;
  var player = { c: 2, r: 6 };

  /* Start with a small scene so the canvas is not empty on first load. */
  (function seed() {
    for (var c = 0; c < COLS; c++) { set(c, 9, 'grass'); set(c, 10, 'dirt'); set(c, 11, 'stone'); set(c, 12, 'stone'); }
    for (var wc = 4; wc <= 7; wc++) set(wc, 9, 'water');
    set(2, 8, 'tree'); set(15, 8, 'tree'); set(19, 8, 'tree');
  })();

  function idx(c, r) { return r * COLS + c; }
  function inb(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
  function set(c, r, v) { if (inb(c, r)) tiles[idx(c, r)] = v; }
  function get(c, r) { return inb(c, r) ? tiles[idx(c, r)] : 'stone'; }

  function pushUndo() { undoStack.push({ t: tiles.slice(), w: walls.slice() }); if (undoStack.length > 40) undoStack.shift(); }

  function drawTileAt(g, x, y, s, t, wall) {
    if (wall) { g.fillStyle = '#3a3630'; g.fillRect(x, y, s, s); }
    if (t === 'air') { if (!wall) { g.clearRect(x, y, s, s); } return; }
    g.fillStyle = COLORS[t] || '#5cae4a';
    g.fillRect(x, y, s, s);
    if (t === 'tree') { g.fillStyle = '#5a3a22'; g.fillRect(x + s / 2 - 2, y + s - 9, 4, 8); g.fillStyle = '#1f4d24'; g.beginPath(); g.arc(x + s / 2, y + s / 2 - 3, s * 0.34, 0, Math.PI * 2); g.fill(); }
    else if (t === 'chest') { g.fillStyle = '#8a5a2b'; g.fillRect(x + 3, y + 6, s - 6, s - 9); g.fillStyle = '#e2b95f'; g.fillRect(x + 3, y + 6, s - 6, 4); }
    else if (t === 'ore') { g.fillStyle = '#8a7a2b'; g.fillRect(x, y, s, s); g.fillStyle = '#f2d24b'; g.beginPath(); g.arc(x + s * .4, y + s * .45, 2.6, 0, Math.PI * 2); g.arc(x + s * .65, y + s * .65, 2.2, 0, Math.PI * 2); g.fill(); }
    else if (t === 'torch') { g.fillStyle = '#5a3a22'; g.fillRect(x + s / 2 - 1, y + s * .4, 3, s * .5); g.fillStyle = '#ffcf5c'; g.beginPath(); g.arc(x + s / 2, y + s * .36, s * .16, 0, Math.PI * 2); g.fill(); }
    else if (t === 'door') { g.fillStyle = '#6d4535'; g.fillRect(x + 3, y + 4, s - 6, s - 4); g.fillStyle = '#c9a26b'; g.beginPath(); g.arc(x + s - 8, y + s / 2, 2, 0, Math.PI * 2); g.fill(); }
    else if (t === 'water') { g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 3, y + s * .58); g.lineTo(x + s - 3, y + s * .58); g.stroke(); }
    else if (t === 'grass') { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, y, s, 3); }
    else if (t === 'snow') { g.fillStyle = '#ffffff'; g.fillRect(x + 2, y + 2, s - 4, 3); }
    else if (t === 'ice') { g.strokeStyle = 'rgba(255,255,255,.5)'; g.strokeRect(x + 2.5, y + 2.5, s - 5, s - 5); }
    else if (t === 'stone') { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x + s * .5, y + s * .45, s * .3, s * .3); }
    else if (t === 'dirt') { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + s * .2, y + s * .65, s * .2, s * .2); }
    if (wall) { g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(x, y, s, s); }
  }

  function render() {
    ctx.clearRect(0, 0, map.width, map.height);
    ctx.fillStyle = COLORS.air; ctx.fillRect(0, 0, map.width, map.height);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) drawTileAt(ctx, c * CELL, r * CELL, CELL, tiles[idx(c, r)], walls[idx(c, r)]);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    for (var cc = 0; cc <= COLS; cc++) { ctx.beginPath(); ctx.moveTo(cc * CELL + .5, 0); ctx.lineTo(cc * CELL + .5, ROWS * CELL); ctx.stroke(); }
    for (var rr = 0; rr <= ROWS; rr++) { ctx.beginPath(); ctx.moveTo(0, rr * CELL + .5); ctx.lineTo(COLS * CELL, rr * CELL + .5); ctx.stroke(); }
    /* test player */
    var px = player.c * CELL + CELL / 2, py = player.r * CELL + CELL / 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(px, py + 7, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    renderMini();
    renderChallenges();
  }

  function renderMini() {
    if (!mctx) return;
    mctx.clearRect(0, 0, mini.width, mini.height);
    var cw = mini.width / COLS, ch = mini.height / ROWS;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = tiles[idx(c, r)];
      mctx.fillStyle = (t === 'air' && !walls[idx(c, r)]) ? '#0b0f14' : (COLORS[t] || '#5cae4a');
      if (walls[idx(c, r)]) { mctx.fillStyle = '#2a2620'; }
      mctx.fillRect(c * cw, r * ch, Math.ceil(cw), Math.ceil(ch));
    }
  }

  function countT(t) { var n = 0; for (var i = 0; i < tiles.length; i++) if (tiles[i] === t) n++; return n; }
  function tickCh(el, ok) { if (!el) return; el.classList.toggle('done', ok); var k = el.querySelector('.tick'); if (k) k.textContent = ok ? '✅' : '◻'; }
  function renderChallenges() {
    tickCh(document.getElementById('chWater'), countT('water') >= 8);
    tickCh(document.getElementById('chTrees'), countT('tree') >= 3);
    tickCh(document.getElementById('chChest'), countT('chest') >= 1);
    tickCh(document.getElementById('chDig'), countT('air') >= 40);
  }

  function apply(c, r) {
    if (!inb(c, r)) return;
    if (tool === 'dig') { tiles[idx(c, r)] = 'air'; walls[idx(c, r)] = false; return; }
    if (objMode) { tiles[idx(c, r)] = objMode; return; }
    tiles[idx(c, r)] = current;
    if (wallMode) walls[idx(c, r)] = true;
  }
  function floodFill(c0, r0, val) {
    var target = get(c0, r0); if (target === val) return;
    var stack = [[c0, r0]];
    while (stack.length) {
      var p = stack.pop(), c = p[0], r = p[1];
      if (!inb(c, r) || get(c, r) !== target) continue;
      tiles[idx(c, r)] = val;
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
  }

  function posFromEvent(e) {
    var rect = map.getBoundingClientRect();
    var sx = (e.clientX - rect.left) * (map.width / rect.width);
    var sy = (e.clientY - rect.top) * (map.height / rect.height);
    return { c: Math.floor(sx / CELL), r: Math.floor(sy / CELL) };
  }
  function paintAt(e) {
    var p = posFromEvent(e);
    if (tool === 'fill') { pushUndo(); floodFill(p.c, p.r, objMode || current); }
    else apply(p.c, p.r);
    render();
  }
  map.addEventListener('pointerdown', function (e) { painting = true; pushUndo(); if (map.setPointerCapture) { try { map.setPointerCapture(e.pointerId); } catch (x) {} } paintAt(e); e.preventDefault(); });
  map.addEventListener('pointermove', function (e) { if (painting && tool !== 'fill') paintAt(e); });
  map.addEventListener('pointerup', function () { painting = false; });
  map.addEventListener('pointercancel', function () { painting = false; });

  var biodiversity = [].slice.call(document.querySelectorAll('.twms-tool[data-tile]'));
  biodiversity.forEach(function (b) {
    b.addEventListener('click', function () {
      biodiversity.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true');
      current = b.getAttribute('data-tile'); tool = 'paint'; objMode = null; syncTools();
    });
  });
  var objButtons = [].slice.call(document.querySelectorAll('.twms-tool[data-obj]'));
  objButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.classList.contains('is-active');
      objButtons.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
      if (on) { objMode = null; }
      else { b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true'); objMode = b.getAttribute('data-obj'); tool = 'paint'; switchTab('map'); }
      syncTools();
    });
  });

  function syncTools() {
    setTool('toolPaint', tool === 'paint' && !objMode);
    setTool('toolDig', tool === 'dig');
    setTool('toolFill', tool === 'fill');
  }
  function setTool(id, on) { var el = document.getElementById(id); if (el) { el.classList.toggle('is-active', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); } }
  document.getElementById('toolPaint').addEventListener('click', function () { tool = 'paint'; objMode = null; objButtons.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); }); syncTools(); });
  document.getElementById('toolDig').addEventListener('click', function () { tool = 'dig'; objMode = null; syncTools(); });
  document.getElementById('toolFill').addEventListener('click', function () { tool = 'fill'; objMode = null; syncTools(); });
  document.getElementById('mapUndo').addEventListener('click', function () { var s = undoStack.pop(); if (s) { tiles = s.t; walls = s.w; render(); } });
  document.getElementById('wallToggle').addEventListener('click', function () {
    wallMode = !wallMode; var el = document.getElementById('wallToggle');
    el.classList.toggle('is-active', wallMode); el.setAttribute('aria-pressed', wallMode ? 'true' : 'false');
  });

  /* Walk test */
  var walkOn = false;
  document.getElementById('mapWalk').addEventListener('click', function () {
    walkOn = !walkOn;
    document.getElementById('mapDpad').style.display = walkOn ? 'grid' : 'none';
    this.classList.toggle('is-active', walkOn);
    this.textContent = walkOn ? '⏹️ Stop walk test' : '🚶 Start walk test';
    var m = document.getElementById('mapMsg'); if (m) m.textContent = walkOn ? 'Use the pad to walk. Stone, ice, trees, chests and doors block you.' : '';
  });
  document.querySelectorAll('#mapDpad button').forEach(function (b) {
    b.addEventListener('click', function () {
      var mv = b.getAttribute('data-move'), dc = 0, dr = 0;
      var m = document.getElementById('mapMsg');
      if (mv === 'stop') { if (m) m.textContent = 'Stopped.'; return; }
      if (mv.indexOf('left') > -1) dc = -1; if (mv.indexOf('right') > -1) dc = 1;
      if (mv.indexOf('up') > -1) dr = -1; if (mv.indexOf('down') > -1) dr = 1;
      var nc = player.c + dc, nr = player.r + dr;
      if (!inb(nc, nr)) { if (m) m.textContent = 'That is the edge of the world.'; return; }
      var t = get(nc, nr);
      if (SOLID[t]) { if (m) m.textContent = 'Blocked by ' + t + '. Try digging it first.'; }
      else if (t === 'water') { if (m) m.textContent = 'Splashing through water (slower).'; player.c = nc; player.r = nr; }
      else { if (m) m.textContent = 'Walking on ' + t + '.'; player.c = nc; player.r = nr; }
      render();
    });
  });

  /* Biome check */
  var biomeBtn = document.getElementById('biomeTest');
  if (biomeBtn) biomeBtn.addEventListener('click', function () {
    var water = countT('water'), sand = countT('sand'), snow = countT('snow'), tree = countT('tree'), grass = countT('grass');
    var biome = 'Forest';
    if (snow >= 6) biome = 'Snow';
    else if (sand >= 6) biome = 'Desert (Ocean shore)';
    else if (water >= 8) biome = 'Forest with a lake';
    var msg = 'Your world reads as ' + biome + ' · grass ' + grass + ', trees ' + tree + ', water ' + water + ', sand ' + sand + ', snow ' + snow + '. A biome is counted from the blocks around it.';
    var el = document.getElementById('biomeMsg'); if (el) el.textContent = msg;
  });

  /* Files tab */
  document.getElementById('filesBuild').addEventListener('click', function () {
    var name = (document.getElementById('wName').value || 'MyWorld').replace(/[^\w\- ]/g, '').trim() || 'MyWorld';
    var size = document.getElementById('wSize').value;
    var seed = (document.getElementById('wSeed').value || 'jvds2026').trim();
    var files = {
      world: name,
      size: size,
      seed: seed,
      tiles: COLS * ROWS,
      files: ['world.json', 'world-plan.png', 'README.txt'],
      note: 'Open the .wld in TEdit, paint using plan data, then save.'
    };
    document.getElementById('filesPreview').textContent = JSON.stringify(files, null, 2);
    var m = document.getElementById('filesMsg'); if (m) { m.className = 'twms-msg ok'; m.textContent = 'World files built for ' + name + ' (' + size + ').'; }
  });

  /* Debug tab */
  var LOG = [
    { t: '[tModLoader] Loading world ' + 'MyFirstWorld' + '.wld', err: false },
    { t: '[tModLoader] Loaded 1 mod: ExampleMod 1.0 by you', err: false },
    { t: 'System.BadImageFormatException: could not load file or assembly', err: true, fix: 'Your mod was built for a different Terraria version. Update tModLoader and rebuild the mod for the version you own.' },
    { t: 'World file was created with a newer Terraria version', err: true, fix: 'The world was saved by a newer game than the one you are loading. Update Terraria, or edit a world that matches your version.' },
    { t: 'Duplicate mod: Cheatsheet found in Mods/Cheatsheet and Mods/Cheatsheet/Cheatsheet', err: true, fix: 'The folder is nested twice. Move the inner folder up so manifest.json sits directly inside the mod folder.' }
  ];
  (function buildLog() {
    var box = document.getElementById('logConsole'); if (!box) return;
    LOG.forEach(function (l) {
      var s = document.createElement('span');
      s.className = 'twms-log' + (l.err ? ' err' : '');
      s.textContent = l.t;
      if (l.err) s.addEventListener('click', function () {
        box.querySelectorAll('.twms-log').forEach(function (x) { x.classList.remove('sel'); });
        s.classList.add('sel');
        var m = document.getElementById('logMsg'); if (m) { m.className = 'twms-msg bad'; m.textContent = l.fix; }
      });
      box.appendChild(s);
    });
  })();

  /* Export tab */
  var xPreview = document.getElementById('xPreview');
  function updateExport() {
    var mode = document.getElementById('xMode').value;
    var name = (document.getElementById('wName').value || 'MyWorld').replace(/[^\w\- ]/g, '').trim() || 'MyWorld';
    if (mode === 'share') {
      xPreview.textContent = 'world-preview.html   (a page you can open anywhere)\n' + name + '-plan.png   (a picture of your world)\nworld.json   (your world data)';
      document.getElementById('xDownload').style.display = 'none';
      document.getElementById('xSaveWorld').style.display = 'inline-block';
    } else {
      xPreview.textContent = 'world.json      (your world data, opened by the Studio)\n' + 'world-plan.png  (a picture of your layout)\nREADME.txt      (how to build it in TEdit)';
      document.getElementById('xDownload').style.display = 'inline-block';
      document.getElementById('xSaveWorld').style.display = 'none';
    }
  }
  document.getElementById('xMode').addEventListener('change', updateExport);
  function download(name, content, type) {
    try {
      var blob = new Blob([content], { type: type });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) {}
  }
  function worldJson() { return JSON.stringify({ app: 'jvds-terraria-world-studio', version: 1, cols: COLS, rows: ROWS, tiles: tiles, walls: walls }, null, 2); }
  document.getElementById('xDownload').addEventListener('click', function () {
    download('my-terraria-world.json', worldJson(), 'application/json');
    try { var a = document.createElement('a'); a.href = map.toDataURL('image/png'); a.download = 'world-plan.png'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
    var m = document.getElementById('xMsg'); if (m) { m.className = 'twms-msg ok'; m.textContent = 'Downloaded world.json and world-plan.png.'; }
  });
  document.getElementById('xSaveWorld').addEventListener('click', function () {
    var name = (document.getElementById('wName').value || 'MyWorld').replace(/[^\w\- ]/g, '').trim() || 'MyWorld';
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + name + ' | Terraria World</title><style>body{margin:0;background:#fbf8f2;font-family:Inter,system-ui,sans-serif;color:#1a1208;text-align:center;padding:24px}h1{font-size:1.4rem}p{color:#3d3224}a{color:#2e7d32}</style></head><body><h1>' + name + '</h1><img src="world-plan.png" alt="' + name + ' plan" style="max-width:100%;border-radius:12px;border:2px solid #b5895a;image-rendering:pixelated"><p>Made in the JVDesignStudio Terraria World Studio. <a href="https://jvdesignstudio.co.uk/workshops/terraria-mod-studio.html">Build your own world</a></p></body></html>';
    download('world-preview.html', html, 'text/html');
    var m = document.getElementById('xMsg'); if (m) { m.className = 'twms-msg ok'; m.textContent = 'Downloaded world-preview.html'; }
  });
  updateExport();

  /* Saved worlds (localStorage) */
  var STORE = 'jvds-terraria-worlds-v1';
  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; } }
  function saveStore(a) { try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) {} }
  function renderGallery() {
    var g = document.getElementById('worldsGallery'); if (!g) return;
    var arr = loadStore(); g.innerHTML = '';
    if (!arr.length) { g.innerHTML = '<p style="font-size:.85rem;color:var(--charcoal-lt)">No saved worlds yet.</p>'; return; }
    arr.forEach(function (w, i) {
      var card = document.createElement('div'); card.className = 'twms-worldcard';
      card.innerHTML = '<canvas class="twms-worldthumb" width="144" height="96"></canvas><div class="twms-worldname">' + w.name + '</div><div class="twms-worldrow"><button class="twms-btn load">Load</button><button class="twms-btn del">Delete</button></div>';
      var cv = card.querySelector('canvas'), c2 = cv.getContext('2d');
      var cw = cv.width / COLS, ch = cv.height / ROWS;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = w.tiles[r * COLS + c]; c2.fillStyle = (t === 'air') ? '#0b0f14' : (COLORS[t] || '#5cae4a'); c2.fillRect(c * cw, r * ch, Math.ceil(cw), Math.ceil(ch)); }
      card.querySelector('.load').addEventListener('click', function () { pushUndo(); tiles = w.tiles.slice(); walls = (w.walls || []).slice(); if (walls.length !== tiles.length) walls = new Array(tiles.length).fill(false); render(); switchTab('map'); });
      card.querySelector('.del').addEventListener('click', function () { var a = loadStore(); a.splice(i, 1); saveStore(a); renderGallery(); });
      g.appendChild(card);
    });
  }
  document.getElementById('worldSave').addEventListener('click', function () {
    var name = (document.getElementById('wName').value || 'MyWorld').replace(/[^\w\- ]/g, '').trim() || 'MyWorld';
    var arr = loadStore(); arr.push({ name: name, tiles: tiles.slice(), walls: walls.slice() }); if (arr.length > 12) arr.shift();
    saveStore(arr); renderGallery();
    var m = document.getElementById('xMsg'); if (m) { m.className = 'twms-msg ok'; m.textContent = 'Saved "' + name + '" to My worlds.'; }
  });
  renderGallery();

  /* Tabs */
  var TABS = [].slice.call(document.querySelectorAll('.twms-tab'));
  function switchTab(name) {
    TABS.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.classList.toggle('is-active', on);
    });
  }
  TABS.forEach(function (t) {
    t.addEventListener('click', function () { switchTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function (e) {
      var i = TABS.indexOf(t), n = null;
      if (e.key === 'ArrowRight') n = TABS[(i + 1) % TABS.length];
      else if (e.key === 'ArrowLeft') n = TABS[(i - 1 + TABS.length) % TABS.length];
      else if (e.key === 'Home') n = TABS[0];
      else if (e.key === 'End') n = TABS[TABS.length - 1];
      if (n) { e.preventDefault(); switchTab(n.getAttribute('data-tab')); n.focus(); }
    });
  });

  /* Embed mode (?embed=1&tab=...) used by episode iframes */
  var EMBED = false;
  try {
    var q = new URLSearchParams(location.search);
    var tb = q.get('tab');
    if (tb) switchTab(tb);
    EMBED = q.get('embed') === '1';
    if (EMBED) document.body.classList.add('twms-embed');
  } catch (e) {}

  /* First-run tour */
  var TOUR = [
    'This is your no-install world builder. Pick a biome tile on the right, paint the map, then press Start walk test to walk your world.',
    'Tabs: Objects & chests, Your world files, Fix the log, and Download your world. Try them all.',
    'Your world saves to this device only. Save it in My worlds, or download a plan to build it in TEdit for real.'
  ];
  var tourIdx = 0;
  function showTourStep() {
    document.getElementById('tourText').textContent = TOUR[tourIdx];
    var dots = document.getElementById('tourDots'); dots.innerHTML = '';
    TOUR.forEach(function (_, i) { var s = document.createElement('span'); if (i === tourIdx) s.className = 'on'; dots.appendChild(s); });
    document.getElementById('tourNext').textContent = tourIdx === TOUR.length - 1 ? 'Start building' : 'Next';
  }
  var tourSeen = false; try { tourSeen = localStorage.getItem('jvds-terraria-studio-tour') === '1'; } catch (e) {}
  if (!tourSeen && !EMBED) { var o = document.getElementById('tourOverlay'); if (o) { o.hidden = false; showTourStep(); } }
  document.getElementById('tourNext').addEventListener('click', function () {
    if (tourIdx < TOUR.length - 1) { tourIdx++; showTourStep(); return; }
    closeTour();
  });
  document.getElementById('tourSkip').addEventListener('click', closeTour);
  function closeTour() { var o = document.getElementById('tourOverlay'); if (o) o.hidden = true; try { localStorage.setItem('jvds-terraria-studio-tour', '1'); } catch (e) {} }

  syncTools();
  render();
})();
