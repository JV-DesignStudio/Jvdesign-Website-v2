(function () {
'use strict';

var ITEMS = [
  { id: 'minecraft:stick', n: 'Stick', e: '🪵' },
  { id: 'minecraft:diamond', n: 'Diamond', e: '💎' },
  { id: 'minecraft:iron_ingot', n: 'Iron Ingot', e: '🔩' },
  { id: 'minecraft:gold_ingot', n: 'Gold Ingot', e: '🥇' },
  { id: 'minecraft:redstone', n: 'Redstone', e: '🔴' },
  { id: 'minecraft:coal', n: 'Coal', e: '⚫' },
  { id: 'minecraft:emerald', n: 'Emerald', e: '🟢' },
  { id: 'minecraft:lapis_lazuli', n: 'Lapis Lazuli', e: '🔵' },
  { id: 'minecraft:netherite_ingot', n: 'Netherite Ingot', e: '🟪' },
  { id: 'minecraft:copper_ingot', n: 'Copper Ingot', e: '🟠' },
  { id: 'minecraft:quartz', n: 'Nether Quartz', e: '⬜' },
  { id: 'minecraft:string', n: 'String', e: '🧵' },
  { id: 'minecraft:leather', n: 'Leather', e: '🟫' },
  { id: 'minecraft:paper', n: 'Paper', e: '📄' },
  { id: 'minecraft:book', n: 'Book', e: '📕' },
  { id: 'minecraft:gunpowder', n: 'Gunpowder', e: '💥' },
  { id: 'minecraft:blaze_powder', n: 'Blaze Powder', e: '🔥' },
  { id: 'minecraft:apple', n: 'Apple', e: '🍎' },
  { id: 'minecraft:wheat', n: 'Wheat', e: '🌾' },
  { id: 'minecraft:sugar', n: 'Sugar', e: '🍬' },
  { id: 'minecraft:egg', n: 'Egg', e: '🥚' },
  { id: 'minecraft:oak_planks', n: 'Oak Planks', e: '🟧' },
  { id: 'minecraft:cobblestone', n: 'Cobblestone', e: '🪨' },
  { id: 'minecraft:glass', n: 'Glass', e: '🪟' }
];
var RESULTS = [
  { id: 'minecraft:diamond_sword', n: 'Diamond Sword', e: '⚔️' },
  { id: 'minecraft:diamond_pickaxe', n: 'Diamond Pickaxe', e: '⛏️' },
  { id: 'minecraft:golden_apple', n: 'Golden Apple', e: '🍏' },
  { id: 'minecraft:bread', n: 'Bread', e: '🍞' },
  { id: 'minecraft:cake', n: 'Cake', e: '🎂' },
  { id: 'minecraft:torch', n: 'Torch', e: '🔦' },
  { id: 'minecraft:shield', n: 'Shield', e: '🛡️' },
  { id: 'minecraft:crafting_table', n: 'Crafting Table', e: '🧰' },
  { id: 'minecraft:bucket', n: 'Bucket', e: '🪣' },
  { id: 'minecraft:golden_sword', n: 'Golden Sword', e: '🗡️' }
];
var ALL = RESULTS.concat(ITEMS);
function item(id) { for (var i = 0; i < ALL.length; i++) { if (ALL[i].id === id) return ALL[i]; } return { id: id, n: id.replace('minecraft:', ''), e: '🧱' }; }
function emoji(id) { return item(id).e; }

var CMDS = [
  { k: 'give', label: 'Give me the item I made', line: function () { return 'give @s ' + S.result + ' ' + S.count; } },
  { k: 'time', label: 'Set it to day', line: function () { return 'time set day'; } },
  { k: 'weather', label: 'Clear the weather', line: function () { return 'weather clear'; } },
  { k: 'say', label: 'Say a friendly message', line: function () { return 'say Welcome to my datapack!'; } },
  { k: 'effect', label: 'Give me 30 seconds of speed', line: function () { return 'effect give @s minecraft:speed 30 2'; } },
  { k: 'tp', label: 'Teleport me 10 blocks up', line: function () { return 'tp @s ~ ~10 ~'; } }
];

var S = {
  grid: [null, null, null, null, null, null, null, null, null],
  active: 'minecraft:diamond',
  eraser: false,
  result: 'minecraft:diamond_sword',
  count: 1,
  ns: 'hello',
  pack: 'My First Datapack',
  recipe: 'diamond_sword',
  format: 48,
  funcName: 'hello',
  cmds: { give: true }
};

var KEY = 'jvds-minecraft-mod-studio-v1';
var soundOn = false, actx = null;
function blip(freq, dur, type) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq; g.gain.value = 0.03;
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (dur || 0.07));
  } catch (e) {}
}
function award(amount, onceKey) {
  try {
    var k = 'jvds-mcxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-minecraft-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-minecraft-studio-xp', String(tot));
    localStorage.setItem(k, '1');
  } catch (e) {}
}

function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- persist ---------- */
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({
    grid: S.grid, active: S.active, result: S.result, count: S.count,
    ns: S.ns, pack: S.pack, recipe: S.recipe, format: S.format, funcName: S.funcName, cmds: S.cmds
  })); } catch (e) {}
}
function restore() {
  try {
    var raw = localStorage.getItem(KEY); if (!raw) return;
    var s = JSON.parse(raw);
    if (Array.isArray(s.grid) && s.grid.length === 9) S.grid = s.grid;
    if (s.active) S.active = s.active;
    if (s.result) S.result = s.result;
    if (s.count) S.count = s.count;
    if (s.ns) S.ns = s.ns;
    if (s.pack) S.pack = s.pack;
    if (s.recipe) S.recipe = s.recipe;
    if (s.format) S.format = s.format;
    if (s.funcName) S.funcName = s.funcName;
    if (s.cmds && typeof s.cmds === 'object') S.cmds = s.cmds;
  } catch (e) {}
}

/* ---------- recipe build ---------- */
var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function buildRecipe() {
  var filled = S.grid.filter(function (c) { return c; }).length;
  if (!filled) return null;
  var distinct = [];
  S.grid.forEach(function (c) { if (c && distinct.indexOf(c) < 0) distinct.push(c); });
  if (distinct.length === 1) {
    return {
      type: 'minecraft:crafting_shapeless',
      ingredients: distinct.map(function (id) { return { item: id }; }),
      result: { item: S.result, count: S.count }
    };
  }
  var key = {};
  distinct.forEach(function (id, i) { key[LETTERS[i]] = { item: id }; });
  var pattern = [];
  for (var r = 0; r < 3; r++) {
    var row = '';
    for (var c = 0; c < 3; c++) {
      var cell = S.grid[r * 3 + c];
      row += cell ? LETTERS[distinct.indexOf(cell)] : ' ';
    }
    pattern.push(row);
  }
  return {
    type: 'minecraft:crafting_shaped',
    pattern: pattern,
    key: key,
    result: { item: S.result, count: S.count }
  };
}
function pretty(o) { return JSON.stringify(o, null, 2); }

function mcmeta() {
  return {
    pack: {
      pack_format: Number(S.format),
      description: S.pack + ' - made in the JVDesignStudio Minecraft Mod Studio'
    }
  };
}
function funcLines() {
  var out = [];
  CMDS.forEach(function (c) { if (S.cmds[c.k]) out.push(c.line()); });
  return out;
}

/* ---------- render bench ---------- */
function renderGrid() {
  var g = document.getElementById('mcGrid'); if (!g) return;
  g.innerHTML = '';
  S.grid.forEach(function (cell, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mcms-cell' + (cell ? ' is-filled' : '');
    b.setAttribute('role', 'gridcell');
    b.setAttribute('aria-label', 'Bench square ' + (i + 1) + (cell ? ': ' + item(cell).n : ': empty'));
    b.textContent = cell ? emoji(cell) : '';
    b.addEventListener('click', function () {
      if (S.eraser) { S.grid[i] = null; }
      else { S.grid[i] = S.active; }
      blip(cell ? 300 : 440, 0.05, 'triangle');
      renderAll();
    });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); S.grid[i] = null; renderAll(); });
    g.appendChild(b);
  });
}
function renderPalette() {
  var p = document.getElementById('mcPalette'); if (!p) return;
  p.innerHTML = '';
  ITEMS.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mcms-swatch' + (!S.eraser && S.active === it.id ? ' is-active' : '');
    b.title = it.n;
    b.setAttribute('aria-label', it.n);
    b.textContent = it.e;
    b.addEventListener('click', function () { S.active = it.id; S.eraser = false; renderAll(); });
    p.appendChild(b);
  });
}
function renderResultSelect() {
  var sel = document.getElementById('mcResultSelect'); if (!sel) return;
  sel.innerHTML = '';
  ALL.forEach(function (it) {
    var o = document.createElement('option');
    o.value = it.id; o.textContent = it.e + '  ' + it.n;
    if (it.id === S.result) o.selected = true;
    sel.appendChild(o);
  });
  var cnt = document.getElementById('mcCount'); if (cnt) cnt.value = S.count;
  var slot = document.getElementById('mcResult'); if (slot) slot.textContent = emoji(S.result);
}
function renderRecipe() {
  var pre = document.getElementById('mcRecipePreview'); if (!pre) return;
  var r = buildRecipe();
  pre.textContent = r ? pretty(r) : '// Place something on the bench to build your recipe.';
}

/* ---------- render function ---------- */
function renderCmdList() {
  var box = document.getElementById('mcCmdList'); if (!box) return;
  box.innerHTML = '';
  CMDS.forEach(function (c) {
    var l = document.createElement('label');
    l.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:8px 0;cursor:pointer;font-size:.88rem';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!S.cmds[c.k]; cb.style.marginTop = '3px';
    cb.addEventListener('change', function () { S.cmds[c.k] = cb.checked; renderAll(); });
    var span = document.createElement('span');
    span.innerHTML = '<strong>' + esc(c.label) + '</strong><br><code style="font-size:.78rem;color:var(--charcoal-lt)">/' + esc(c.line()) + '</code>';
    l.appendChild(cb); l.appendChild(span);
    box.appendChild(l);
  });
}
function renderFunc() {
  var pre = document.getElementById('mcFuncPreview'); if (!pre) return;
  var lines = funcLines();
  pre.textContent = lines.length ? lines.join('\n') : '// Tick a command to add it to your function.';
}

/* ---------- render files ---------- */
function slug(s, fb) { var out = String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''); return out || fb; }
function renderFiles() {
  var pre = document.getElementById('mcFilesPreview'); if (!pre) return;
  var ns = slug(S.ns, 'hello');
  var r = buildRecipe();
  var out = '# pack.mcmeta\n' + pretty(mcmeta()) + '\n\n';
  out += '# data/' + ns + '/recipe/' + slug(S.recipe, 'my_recipe') + '.json\n';
  out += r ? pretty(r) : '// add ingredients on the Crafting bench tab';
  var lines = funcLines();
  if (lines.length) {
    out += '\n\n# data/' + ns + '/function/' + slug(S.funcName, 'hello') + '.mcfunction\n' + lines.join('\n');
  }
  pre.textContent = out;
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('mcChecklist'); if (!ul) return;
  var ns = S.ns;
  var r = buildRecipe();
  var checks = [
    ['A datapack name is set', !!S.pack.trim()],
    ['Namespace is lowercase letters, numbers and underscores', /^[a-z0-9_]+$/.test(ns)],
    ['The bench has at least one ingredient', !!r],
    ['pack.mcmeta sets your Minecraft version', !!S.format],
    ['The recipe file name has no spaces', /^[a-z0-9_]+$/.test(slug(S.recipe, ''))]
  ];
  ul.innerHTML = '';
  checks.forEach(function (c) {
    var li = document.createElement('li');
    li.className = c[1] ? 'done' : '';
    li.textContent = c[0];
    ul.appendChild(li);
  });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.mcms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.mcms-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.mcms-tab'));
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(t);
      if (e.key === 'ArrowRight') { tabs[(i + 1) % tabs.length].focus(); tabs[(i + 1) % tabs.length].click(); }
      if (e.key === 'ArrowLeft') { tabs[(i - 1 + tabs.length) % tabs.length].focus(); tabs[(i - 1 + tabs.length) % tabs.length].click(); }
    });
  });
}

/* ---------- debug ---------- */
var SCENARIOS = [
  {
    log: [
      '[Client thread/INFO] [Minecraft] Reloading data...',
      '[Client thread/ERROR] [DataPack] Found no datapacks in .minecraft/saves/My World/datapacks'
    ],
    q: 'Your pack never shows up in /datapack list. What is the fix?',
    opts: [
      { t: 'Unzip it so the folder itself (with pack.mcmeta in it) sits inside saves/<world>/datapacks/. Minecraft does not read a zipped folder as a datapack.', ok: true },
      { t: 'Move it into the .minecraft/mods folder instead.' },
      { t: 'Rename pack.mcmeta to manifest.json.' }
    ]
  },
  {
    log: [
      '[Client thread/INFO] [Minecraft] Reloading data...',
      '[Client thread/ERROR] [DataPack] Couldn\'t load recipe hello:diamond_sword: Failed to parse resource location minecraft:crafting_shapped'
    ],
    q: 'The recipe will not load. What is wrong?',
    opts: [
      { t: 'Spelling: the recipe type should be minecraft:crafting_shaped (with an e), not crafting_shapped.' },
      { t: 'Put the recipe inside a function file instead.' },
      { t: 'The namespace has to be minecraft.' }
    ],
    correct: 0
  },
  {
    log: [
      '[Client thread/INFO] [Minecraft] Reloaded 0 recipes',
      '[Client thread/INFO] [Minecraft] Datapack hello loaded'
    ],
    q: 'The datapack loads, but your recipe never appears in the crafting table. Why?',
    opts: [
      { t: 'In 1.21 and newer, recipes live in data/<namespace>/recipe/ (singular). The old scripts used recipes/ with an s and will be ignored.', ok: true },
      { t: 'Recipes only work in Creative mode.' },
      { t: 'You have to restart your computer.' }
    ]
  },
  {
    log: [
      '[Client thread/ERROR] [DataPack] Failed to parse data/hello/recipe/diamond_sword.json: Expected \':\' at line 7 column 3'
    ],
    q: 'The log points at one line of your JSON. What is the fix?',
    opts: [
      { t: 'It is a JSON syntax error: look for a missing colon or a trailing comma on the line the log names.' },
      { t: 'The item id must be wrong.' },
      { t: 'The pack_format is too high.' }
    ],
    correct: 0
  },
  {
    log: [
      '[Client thread/ERROR] [DataPack] Unknown item \'minecraft:dimond\' in data/hello/recipe/diamond_sword.json'
    ],
    q: 'Minecraft does not know one of your items. What is the fix?',
    opts: [
      { t: 'Spelling mistake: it is minecraft:diamond. Item ids must match the game exactly, including the minecraft: part.', ok: true },
      { t: 'Diamonds are not allowed inside datapacks.' },
      { t: 'Add minecraft: to the front of the id.' }
    ]
  }
];
var dbgIndex = 0, dbgState = 0;
function renderDebug() {
  var logEl = document.getElementById('mcLog'); if (!logEl) return;
  var sc = SCENARIOS[dbgIndex];
  logEl.innerHTML = '';
  sc.log.forEach(function (line, i) {
    var el = document.createElement('span');
    var isErr = /ERROR/.test(line);
    el.className = 'line' + (isErr ? ' err' : '');
    el.textContent = line;
    if (isErr) el.addEventListener('click', function () { openOptions(); });
    logEl.appendChild(el);
  });
  var opts = document.getElementById('mcOptions'); opts.innerHTML = '';
  var msg = document.getElementById('mcDebugMsg'); msg.className = 'mcms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('mcNext').style.display = 'none';
  dbgState = 0;
}
function openOptions() {
  var opts = document.getElementById('mcOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = (sc.correct === 0) ? 0 : sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mcms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('mcDebugMsg'); msg.className = 'mcms-msg ok'; msg.textContent = 'Correct. That is exactly what the log is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('mcNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('mcDebugMsg'); m2.className = 'mcms-msg bad'; m2.textContent = 'Not quite. Read the log line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}

/* ---------- export ---------- */
function renderExport() {
  var tree = document.getElementById('mcExportTree');
  var folder = slug(S.pack, 'my_datapack');
  var ns = slug(S.ns, 'hello');
  var rec = slug(S.recipe, 'my_recipe');
  var fn = slug(S.funcName, 'hello');
  var hasFn = funcLines().length > 0;
  if (tree) {
    tree.textContent = folder + '.zip\n' +
      '└── ' + folder + '/\n' +
      '    ├── pack.mcmeta\n' +
      '    ├── README.txt\n' +
      '    └── data/\n' +
      '        └── ' + ns + '/\n' +
      '            ├── recipe/\n' +
      '            │   └── ' + rec + '.json\n' +
      (hasFn ? '            └── function/\n' +
        '                └── ' + fn + '.mcfunction\n' : '            └── (tick a command to add a function)\n');
  }
  var ul = document.getElementById('mcExportCheck'); if (ul) {
    var r = buildRecipe();
    var checks = [
      ['Recipe built on the bench', !!r],
      ['pack.mcmeta will be included', !!S.format],
      ['Recipe file will be included', !!rec],
      [hasFn ? 'Function will be included' : 'No function yet (optional)', hasFn]
    ];
    ul.innerHTML = '';
    checks.forEach(function (c) {
      var li = document.createElement('li'); li.className = c[1] ? 'done' : ''; li.textContent = c[0]; ul.appendChild(li);
    });
  }
}
var CRC_TABLE = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); } t[n] = c >>> 0; } return t; })();
function crc32(bytes) { var c = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) { c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); } return (c ^ 0xFFFFFFFF) >>> 0; }
function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]; }
function makeZip(files) {
  var enc = new TextEncoder(); var chunks = [], central = [], offset = 0;
  files.forEach(function (f) {
    var nameBytes = enc.encode(f.name), data = f.data, crc = crc32(data);
    var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0));
    var header = new Uint8Array(local.length + nameBytes.length); header.set(local, 0); header.set(nameBytes, local.length);
    chunks.push(header); chunks.push(data);
    var cd = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
    var cdh = new Uint8Array(cd.length + nameBytes.length); cdh.set(cd, 0); cdh.set(nameBytes, cd.length);
    central.push(cdh); offset += header.length + data.length;
  });
  var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
  var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
  var total = chunks.reduce(function (s, c) { return s + c.length; }, 0) + cdSize + eocd.length;
  var out = new Uint8Array(total), p = 0;
  chunks.forEach(function (c) { out.set(c, p); p += c.length; });
  central.forEach(function (c) { out.set(c, p); p += c.length; });
  out.set(eocd, p); return out;
}
function download() {
  var msg = document.getElementById('mcExportMsg');
  try {
    var enc = new TextEncoder();
    var folder = slug(S.pack, 'my_datapack');
    var ns = slug(S.ns, 'hello');
    var rec = slug(S.recipe, 'my_recipe');
    var fn = slug(S.funcName, 'hello');
    var r = buildRecipe();
    if (!r) { msg.className = 'mcms-msg bad'; msg.textContent = 'Add at least one ingredient on the Crafting bench first.'; showTab('bench'); return; }
    var readme = S.pack + ' - a Minecraft datapack made in the JVDesignStudio Minecraft Mod Studio.\n\n' +
      'HOW TO USE IT:\n' +
      '1. Unzip this folder so the folder "' + folder + '" (the one holding pack.mcmeta) sits inside\n' +
      '   .minecraft/saves/<your world>/datapacks/\n' +
      '2. Open your world and type:  /reload\n' +
      '3. Craft your recipe at any crafting table, or run  /function ' + ns + ':' + fn + '\n\n' +
      'Made for Minecraft 1.20.5 - 1.21.4 (pack_format ' + S.format + ').\n' +
      'Full guide: https://jvdesignstudio.co.uk/workshops/minecraft-world-workshop.html\n';
    var files = [
      { name: folder + '/pack.mcmeta', data: enc.encode(pretty(mcmeta()) + '\n') },
      { name: folder + '/data/' + ns + '/recipe/' + rec + '.json', data: enc.encode(pretty(r) + '\n') },
      { name: folder + '/README.txt', data: enc.encode(readme) }
    ];
    var lines = funcLines();
    if (lines.length) files.push({ name: folder + '/data/' + ns + '/function/' + fn + '.mcfunction', data: enc.encode(lines.join('\n') + '\n') });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_minecraft-mod-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_minecraft-mod-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'mcms-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Unzip it into saves/<world>/datapacks.';
  } catch (e) { msg.className = 'mcms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy helpers ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'mcms-msg ok'; msgEl.textContent = 'Copied.'; } }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
  } else { fallback(text, done); }
}
function fallback(text, done) {
  try {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done();
  } catch (e) {}
}

/* ---------- render all ---------- */
function renderAll() {
  var pn = document.getElementById('mcPackName'); if (pn && pn.value !== S.pack) pn.value = S.pack;
  var ns = document.getElementById('mcNamespace'); if (ns && ns.value !== S.ns) ns.value = S.ns;
  var rn = document.getElementById('mcRecipeName'); if (rn && rn.value !== S.recipe) rn.value = S.recipe;
  var fm = document.getElementById('mcFormat'); if (fm && String(fm.value) !== String(S.format)) fm.value = String(S.format);
  var fnEl = document.getElementById('mcFuncName'); if (fnEl && fnEl.value !== S.funcName) fnEl.value = S.funcName;
  var er = document.getElementById('mcEraser'); if (er) { er.setAttribute('aria-pressed', S.eraser ? 'true' : 'false'); er.classList.toggle('mcms-btn--primary', S.eraser); }
  renderGrid(); renderPalette(); renderResultSelect(); renderRecipe();
  renderCmdList(); renderFunc(); renderFiles(); renderExport();
  persist();
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little datapack maker. In a few steps you will design a recipe, add commands, write the files and download a datapack.' },
  { t: '1. Lay out a recipe', b: 'Pick an ingredient and click squares on the 3x3 bench. The shape you draw is the shape players must copy in the crafting table.' },
  { t: '2. Add a function', b: 'A function is a list of commands. Tick a few, then run them in-game with /function. Start with "give" so you can hold what you made.' },
  { t: '3. Fill in your files', b: 'Name your datapack and pick your Minecraft version. The Studio writes pack.mcmeta and your recipe file for you.' },
  { t: '4. Fix the log', b: 'Real datapacks break in small ways. Practise reading the log and choosing the fix, the same skill you will use in the real game.' },
  { t: '5. Download it', b: 'Grab the zip, unzip it into your world datapacks folder, and run /reload. That is a real datapack you made.' }
];
var tourIdx = 0;
function showTour(i) {
  tourIdx = i;
  var ov = document.getElementById('tourOverlay'); if (!ov) return; ov.hidden = false;
  document.getElementById('tourTitle').textContent = TOUR[i].t;
  document.getElementById('tourBody').textContent = TOUR[i].b;
  var dots = document.getElementById('tourDots'); dots.innerHTML = '';
  TOUR.forEach(function (_, k) { var s = document.createElement('span'); if (k === i) s.className = 'on'; dots.appendChild(s); });
  document.getElementById('tourNext').textContent = (i === TOUR.length - 1) ? 'Done' : 'Next →';
}
function hideTour() { var ov = document.getElementById('tourOverlay'); if (ov) ov.hidden = true; }

/* ---------- init ---------- */
restore();
initTabs();
renderAll();
renderDebug();

document.getElementById('mcEraser').addEventListener('click', function () { S.eraser = !S.eraser; renderAll(); });
document.getElementById('mcClear').addEventListener('click', function () { S.grid = [null, null, null, null, null, null, null, null, null]; renderAll(); });
document.getElementById('mcExample').addEventListener('click', function () {
  S.grid = ['minecraft:diamond', null, null, 'minecraft:diamond', null, null, 'minecraft:stick', null, null];
  S.result = 'minecraft:diamond_sword'; S.count = 1; S.active = 'minecraft:diamond';
  renderAll();
  var m = document.getElementById('mcMsg'); m.className = 'mcms-msg ok'; m.textContent = 'That is the classic sword shape: two diamonds above one stick.';
});
document.getElementById('mcResultSelect').addEventListener('change', function () { S.result = this.value; renderAll(); });
document.getElementById('mcCount').addEventListener('input', function () { var n = parseInt(this.value, 10); S.count = (n >= 1 && n <= 64) ? n : 1; renderRecipe(); renderExport(); persist(); });
document.getElementById('mcFuncName').addEventListener('input', function () { S.funcName = this.value; renderFunc(); renderExport(); persist(); });
document.getElementById('mcCopyRecipe').addEventListener('click', function () { var r = buildRecipe(); if (!r) return; copyText(pretty(r), document.getElementById('mcRecipeMsg')); });
document.getElementById('mcFuncCopy').addEventListener('click', function () { copyText(funcLines().join('\n'), document.getElementById('mcFuncMsg')); });
document.getElementById('mcFilesCopy').addEventListener('click', function () {
  var ns = slug(S.ns, 'hello'); var r = buildRecipe(); var lines = funcLines();
  var out = '--- pack.mcmeta ---\n' + pretty(mcmeta()) + '\n\n--- data/' + ns + '/recipe/' + slug(S.recipe, 'my_recipe') + '.json ---\n' + (r ? pretty(r) : '') + (lines.length ? '\n\n--- data/' + ns + '/function/' + slug(S.funcName, 'hello') + '.mcfunction ---\n' + lines.join('\n') : '');
  copyText(out, document.getElementById('mcFilesMsg'));
});
[['mcPackName', 'pack'], ['mcNamespace', 'ns'], ['mcRecipeName', 'recipe']].forEach(function (pair) {
  var el = document.getElementById(pair[0]);
  if (el) el.addEventListener('input', function () { S[pair[1]] = this.value; renderFiles(); renderExport(); persist(); });
});
document.getElementById('mcFormat').addEventListener('change', function () { S.format = this.value; renderFiles(); renderExport(); persist(); });
document.getElementById('mcNext').addEventListener('click', function () { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); });
document.getElementById('mcDownload').addEventListener('click', download);
document.getElementById('mcTourBtn').addEventListener('click', function () { showTab('bench'); showTour(0); });
document.getElementById('tourNext').addEventListener('click', function () { if (tourIdx < TOUR.length - 1) showTour(tourIdx + 1); else hideTour(); });
document.getElementById('tourSkip').addEventListener('click', hideTour);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var ov = document.getElementById('tourOverlay'); if (ov && !ov.hidden) hideTour(); } });
try { if (!localStorage.getItem('jvds-mc-studio-toured')) { localStorage.setItem('jvds-mc-studio-toured', '1'); } } catch (e) {}
})();
