(function () {
'use strict';

var W = 6, H = 4, CELL = 80;

var PARTS = [
  { id: 'cube',     n: 'Cube',     e: '🧊', c: [0.85, 0.45, 0.30], size: 1 },
  { id: 'sphere',   n: 'Sphere',   e: '⚪', c: [0.30, 0.60, 0.85], size: 1 },
  { id: 'cylinder', n: 'Cylinder', e: '🥫', c: [0.40, 0.75, 0.45], size: 1 },
  { id: 'cone',     n: 'Cone',     e: '🔺', c: [0.85, 0.75, 0.25], size: 1 },
  { id: 'torus',    n: 'Torus',    e: '🍩', c: [0.75, 0.40, 0.75], size: 1 },
  { id: 'plane',    n: 'Plane',    e: '⬜', c: [0.60, 0.60, 0.60], size: 1 },
  { id: 'light',    n: 'Light',    e: '💡', c: [1.00, 0.90, 0.40], size: 1 },
  { id: 'camera',   n: 'Camera',   e: '🎥', c: [0.30, 0.30, 0.35], size: 1 }
];
var BY_ID = {};
PARTS.forEach(function (p) { BY_ID[p.id] = p; });
function part(id) { return BY_ID[id] || null; }

var SCRIPTS = [
  {
    k: 'material', n: 'Colour material', desc: 'Give every object a colourful material.',
    code: [
      '# Give the objects a colourful material',
      'for i, obj in enumerate(made):',
      '    if obj.type != "MESH":',
      '        continue',
      '    mat = bpy.data.materials.new(name="Colour_" + str(i))',
      '    mat.use_nodes = True',
      '    bsdf = mat.node_tree.nodes.get("Principled BSDF")',
      '    if bsdf:',
      '        c = colours[i % len(colours)]',
      '        bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1)',
      '    obj.data.materials.append(mat)'
    ].join('\n')
  },
  {
    k: 'light', n: 'Sun light', desc: 'Add a sun light so the scene is lit.',
    code: [
      '# Add a sun light',
      'bpy.ops.object.light_add(type="SUN", location=(4, -4, 6))',
      'bpy.context.active_object.data.energy = 3'
    ].join('\n')
  },
  {
    k: 'camera', n: 'Camera shot', desc: 'Add a camera looking at the scene.',
    code: [
      '# Add a camera looking at the scene',
      'bpy.ops.object.camera_add(location=(6, -6, 5), rotation=(math.radians(60), 0, math.radians(45)))',
      'bpy.context.scene.camera = bpy.context.active_object'
    ].join('\n')
  },
  {
    k: 'spin', n: 'Spin animation', desc: 'Make the first object spin with keyframes.',
    code: [
      '# Spin the first object with keyframes',
      'if made:',
      '    first = made[0]',
      '    first.rotation_euler = (0, 0, 0)',
      '    first.keyframe_insert("rotation_euler", frame=1)',
      '    first.rotation_euler = (0, 0, math.radians(360))',
      '    first.keyframe_insert("rotation_euler", frame=60)'
    ].join('\n')
  },
  {
    k: 'render', n: 'Render settings', desc: 'Set the render size and where the picture saves.',
    code: [
      '# Quick render settings',
      'bpy.context.scene.render.resolution_x = 1280',
      'bpy.context.scene.render.resolution_y = 720',
      'bpy.context.scene.render.filepath = "//render.png"'
    ].join('\n')
  }
];
var SCRIPT_BY_K = {};
SCRIPTS.forEach(function (s) { SCRIPT_BY_K[s.k] = s; });

var S = {
  grid: new Array(W * H).fill(null),
  active: 'cube',
  eraser: false,
  project: 'My First 3D Scene',
  author: '',
  scripts: { material: true, light: true, camera: true }
};

var KEY = 'jvds-blender-mod-studio-v1';
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
    var k = 'jvds-blenderxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-blender-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-blender-studio-xp', String(tot));
    localStorage.setItem(k, '1');
  } catch (e) {}
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- persist ---------- */
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({
    grid: S.grid, active: S.active, project: S.project, author: S.author, scripts: S.scripts
  })); } catch (e) {}
}
function restore() {
  try {
    var raw = localStorage.getItem(KEY); if (!raw) return;
    var s = JSON.parse(raw);
    if (Array.isArray(s.grid) && s.grid.length === W * H) S.grid = s.grid;
    if (s.active && part(s.active)) S.active = s.active;
    if (typeof s.project === 'string') S.project = s.project;
    if (typeof s.author === 'string') S.author = s.author;
    if (s.scripts && typeof s.scripts === 'object') S.scripts = s.scripts;
  } catch (e) {}
}

/* ---------- project build ---------- */
function slug(s, fb) { var out = String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''); return out || fb; }
function colorStr(c) { return 'Color(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', 1)'; }
function placedItems() {
  var out = [];
  for (var i = 0; i < S.grid.length; i++) {
    var id = S.grid[i];
    if (!id || !part(id)) continue;
    var col = i % W, row = Math.floor(i / W);
    var x = col * CELL + CELL / 2;
    var y = row * CELL + CELL / 2;
    out.push({ id: id, p: BY_ID[id], name: BY_ID[id].n, x: x, y: y });
  }
  return out;
}
var SCRIPT_IDS = { material: true, light: true, camera: true, spin: true, render: true };
function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
function xPos(it) { var col = (it.x - CELL / 2) / CELL; return (col - (W - 1) / 2) * 1.5; }
function yPos(it) { var row = (it.y - CELL / 2) / CELL; return ((H - 1) / 2 - row) * 1.5; }
function tickedMethods() { return SCRIPTS.filter(function (s) { return S.scripts[s.k]; }); }
function objectRows() {
  var items = placedItems();
  if (!items.length) return '    # (place some shapes on the grid)';
  return items.map(function (it) { return '    ("' + it.id + '", ' + f2(xPos(it)) + ', ' + f2(yPos(it)) + ')'; }).join(',\n');
}
function colourRows() {
  var items = placedItems();
  if (!items.length) return '    (0.80, 0.80, 0.80)';
  return items.map(function (it) { var c = it.p.c; return '    (' + f2(c[0]) + ', ' + f2(c[1]) + ', ' + f2(c[2]) + ')'; }).join(',\n');
}
function buildScenePy() {
  var body = tickedMethods().map(function (s) { return s.code; }).join('\n\n');
  return [
    'import bpy',
    'import math',
    '',
    '# Clear the default scene',
    'bpy.ops.object.select_all(action="SELECT")',
    'bpy.ops.object.delete(use_global=False)',
    '',
    '# Shapes placed in the JVDS Blender Mod Studio: (kind, x, y)',
    'objects = [',
    objectRows(),
    ']',
    '',
    '# One colour per shape, in the same order',
    'colours = [',
    colourRows(),
    ']',
    '',
    'def add_object(kind, x, y):',
    '    if kind == "cube":',
    '        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.5))',
    '    elif kind == "sphere":',
    '        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.6, location=(x, y, 0.6))',
    '    elif kind == "cylinder":',
    '        bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=1, location=(x, y, 0.5))',
    '    elif kind == "cone":',
    '        bpy.ops.mesh.primitive_cone_add(radius1=0.6, depth=1, location=(x, y, 0.5))',
    '    elif kind == "torus":',
    '        bpy.ops.mesh.primitive_torus_add(location=(x, y, 0.4))',
    '    elif kind == "plane":',
    '        bpy.ops.mesh.primitive_plane_add(size=1.5, location=(x, y, 0))',
    '    elif kind == "light":',
    '        bpy.ops.object.light_add(type="POINT", location=(x, y, 3))',
    '    elif kind == "camera":',
    '        bpy.ops.object.camera_add(location=(x, y, 4))',
    '    return bpy.context.active_object',
    '',
    'made = []',
    'for kind, x, y in objects:',
    '    made.append(add_object(kind, x, y))',
    '',
    '# --- your ticked steps ---',
    body,
    '',
    'print("Scene built with " + str(len(objects)) + " shapes. Save or render it in Blender.")'
  ].join('\n') + '\n';
}
function scriptFiles() {
  return tickedMethods().map(function (s) { return { name: s.n, file: s.k + '.py', code: s.code }; });
}

/* ---------- render scene ---------- */
function renderBoard() {
  var g = document.getElementById('gmBoard'); if (!g) return;
  g.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  g.innerHTML = '';
  S.grid.forEach(function (cell, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'blms-cell' + (cell ? ' is-filled' : '');
    b.setAttribute('role', 'gridcell');
    b.setAttribute('aria-label', 'Square ' + (i + 1) + (cell && part(cell) ? ': ' + part(cell).n : ': empty'));
    if (cell && part(cell)) {
      var pc = part(cell).c;
      b.textContent = part(cell).e;
      b.style.boxShadow = 'inset 0 0 0 2px rgba(' + Math.round(pc[0] * 255) + ',' + Math.round(pc[1] * 255) + ',' + Math.round(pc[2] * 255) + ',.8)';
    }
    b.addEventListener('click', function () {
      if (S.eraser) { S.grid[i] = null; }
      else { S.grid[i] = (S.grid[i] === S.active) ? null : S.active; }
      blip(cell ? 300 : 440, 0.05, 'triangle');
      renderAll();
    });
    g.appendChild(b);
  });
}
function renderPalette() {
  var p = document.getElementById('gmPalette'); if (!p) return;
  p.innerHTML = '';
  PARTS.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'blms-swatch' + (!S.eraser && S.active === it.id ? ' is-active' : '');
    b.title = it.n; b.setAttribute('aria-label', it.n);
    b.innerHTML = '<span class="blms-swatch-emoji">' + it.e + '</span><span class="blms-swatch-name">' + esc(it.n) + '</span>';
    b.addEventListener('click', function () { S.active = it.id; S.eraser = false; renderAll(); });
    p.appendChild(b);
  });
}
function renderMini() {
  var m = document.getElementById('gmMini'); if (!m) return;
  m.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  m.innerHTML = '';
  S.grid.forEach(function (cell) {
    var d = document.createElement('span');
    d.className = 'blms-mini-cell';
    if (cell && part(cell)) {
      var mpc = part(cell).c;
      d.textContent = part(cell).e;
      d.style.background = 'rgba(' + Math.round(mpc[0] * 255) + ',' + Math.round(mpc[1] * 255) + ',' + Math.round(mpc[2] * 255) + ',.22)';
    }
    m.appendChild(d);
  });
}
function counts() { var n = {}; S.grid.forEach(function (c) { if (c) n[c] = (n[c] || 0) + 1; }); return n; }
function sceneCheck() {
  var ul = document.getElementById('gmSceneCheck'); if (!ul) return;
  var c = counts();
  var checks = [
    ['A player to control', !!c.player],
    ['Some platforms to stand on', !!c.platform],
    ['A goal to reach', !!c.goal],
    ['At least 4 objects placed', Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0) >= 4]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- render scripts ---------- */
function renderScriptList() {
  var box = document.getElementById('gmScriptList'); if (!box) return;
  box.innerHTML = '';
  SCRIPTS.forEach(function (s) {
    var l = document.createElement('label');
    l.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 0;cursor:pointer;font-size:.88rem;border-bottom:1px solid var(--border)';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!S.scripts[s.k]; cb.style.marginTop = '3px';
    cb.addEventListener('change', function () { S.scripts[s.k] = cb.checked; renderAll(); });
    var span = document.createElement('span');
    span.innerHTML = '<strong>' + esc(s.n) + '</strong><br><span style="color:var(--muted);font-size:.82rem">' + esc(s.desc) + '</span>';
    l.appendChild(cb); l.appendChild(span);
    box.appendChild(l);
  });
}
function renderScriptPreview() {
  var pre = document.getElementById('gmScriptPreview'); if (!pre) return;
  var files = scriptFiles();
  if (!files.length) { pre.textContent = '// Tick a method to write it.'; return; }
  pre.textContent = files.map(function (f) { return '# ' + f.file + '\n' + f.code; }).join('\n\n');
}

/* ---------- render files ---------- */
function renderFiles() {
  var pre = document.getElementById('gmFilesPreview'); if (!pre) return;
  var src = buildScenePy().split('\n');
  var head = src.slice(0, 34).join('\n');
  var more = src.length > 34 ? '\n... (' + (src.length - 34) + ' more lines, ' + placedItems().length + ' shapes)' : '';
  pre.textContent = 'build_scene.py\n' + head + more;
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('gmChecklist'); if (!ul) return;
  var c = counts();
  var checks = [
    ['The project name has no odd symbols', /^[\w \-.]+$/.test(S.project)],
    ['At least one object is placed', placedItems().length > 0],
    ['There is a player', !!c.player],
    ['There is a goal', !!c.goal],
    ['At least one script is ticked', scriptFiles().length > 0]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.blms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.blms-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.blms-tab'));
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
      'Traceback (most recent call last):',
      'AttributeError: \'NoneType\' object has no attribute \'data\''
    ],
    q: 'The script used an object that is None. What is the fix?',
    opts: [
      { t: 'Check the object exists before using it, for example if obj is not None: then use obj.data.', ok: true },
      { t: 'Delete the whole script.' },
      { t: 'Rename obj to object.' }
    ]
  },
  {
    log: [
      'NameError: name \'bpy\' is not defined'
    ],
    q: 'bpy is not defined. What is the fix?',
    opts: [
      { t: 'Add import bpy at the top of the script.', ok: true },
      { t: 'Rename bpy to blender.' },
      { t: 'bpy only works in the 3D viewport.' }
    ]
  },
  {
    log: [
      'RuntimeError: Operator bpy.ops.mesh.primitive_cube_add.poll() failed, context is incorrect'
    ],
    q: 'The operator failed because the context is wrong. What is the fix?',
    opts: [
      { t: 'Make sure Blender is in Object Mode with a valid view layer, and run the script from the Scripting tab.', ok: true },
      { t: 'Use primitive_sphere_add instead.' },
      { t: 'Add more vertices.' }
    ]
  },
  {
    log: [
      'KeyError: \'Principled BSDF\''
    ],
    q: 'That node name was not found. What is the fix?',
    opts: [
      { t: 'Use nodes.get("Principled BSDF") and check it is not None before using it, in case the name differs.', ok: true },
      { t: 'Delete the material.' },
      { t: 'Rename the node to Principled.' }
    ]
  },
  {
    log: [
      'IndentationError: expected an indented block after \'if\' statement on line 12'
    ],
    q: 'Python expected an indented block. What is the fix?',
    opts: [
      { t: 'Indent the line under the if by four spaces (or one Tab).', ok: true },
      { t: 'Remove the if line.' },
      { t: 'Add a semicolon at the end.' }
    ]
  }
];
var dbgIndex = 0;
function renderDebug() {
  var logEl = document.getElementById('gmLog'); if (!logEl) return;
  var sc = SCENARIOS[dbgIndex];
  logEl.innerHTML = '';
  sc.log.forEach(function (line) {
    var el = document.createElement('span');
    var isErr = /Nonexistent|Parse Error|Invalid|cannot be connected|error/i.test(line) && !/^\[Output\]/.test(line);
    el.className = 'line' + (isErr ? ' err' : '');
    el.textContent = line;
    if (isErr) el.addEventListener('click', function () { openOptions(); });
    logEl.appendChild(el);
  });
  var opts = document.getElementById('gmOptions'); opts.innerHTML = '';
  var msg = document.getElementById('gmDebugMsg'); msg.className = 'blms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('gmNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('gmOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'blms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('gmDebugMsg'); msg.className = 'blms-msg ok'; msg.textContent = 'Correct. That is exactly what the Output is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('gmNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('gmDebugMsg'); m2.className = 'blms-msg bad'; m2.textContent = 'Not quite. Read the Output line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); }

/* ---------- export ---------- */
function projectFiles() {
  var folder = slug(S.project, 'my_blender_scene');
  return [
    { name: folder + '/build_scene.py', text: buildScenePy() },
    { name: folder + '/README.txt', text: readmeText(folder) }
  ];
}
function readmeText(folder) {
  var by = (S.author || '').trim();
  return S.project + ' - a Blender scene script made in the JVDesignStudio Blender Mod Studio.\n' +
    (by ? 'Made by: ' + by + '\n' : '') + '\n' +
    'HOW TO USE IT (Blender is free at blender.org):\n' +
    '1. Install the free Blender (ask a grown-up first).\n' +
    '2. Open Blender and click the Scripting tab at the top.\n' +
    '3. Click Open and choose build_scene.py, then press the Run Script button.\n' +
    '4. Press 0 on the numpad for the camera view, then F12 to render.\n\n' +
    'Full guides: https://jvdesignstudio.co.uk/workshop\n';
}
function renderExport() {
  var folder = slug(S.project, 'my_blender_scene');
  var tree = document.getElementById('gmExportTree');
  if (tree) {
    var lines = [folder + '.zip', '└── ' + folder + '/', '    ├── build_scene.py', '    └── README.txt'];
    tree.textContent = lines.join('\n');
  }
  var ul = document.getElementById('gmExportCheck');
  if (ul) {
    var checks = [
      ['build_scene.py will be included', true],
      ['Shapes are placed', placedItems().length > 0],
      ['At least one step is ticked', tickedMethods().length > 0],
      [tickedMethods().length ? tickedMethods().length + ' step(s) will be included' : 'No steps yet (optional)', tickedMethods().length > 0]
    ];
    ul.innerHTML = '';
    checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
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
  var msg = document.getElementById('gmExportMsg');
  try {
    var enc = new TextEncoder();
    var folder = slug(S.project, 'my_blender_scene');
    if (placedItems().length === 0) { msg.className = 'blms-msg bad'; msg.textContent = 'Place at least one shape on the grid first.'; showTab('scene'); return; }
    var files = projectFiles().map(function (f) { return { name: f.name, data: f.bytes ? f.bytes : enc.encode(f.text) }; });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_blender-mod-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_blender-mod-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'blms-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Open build_scene.py in Blender and press Run Script.';
  } catch (e) { msg.className = 'blms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'blms-msg ok'; msgEl.textContent = 'Copied.'; } }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); }); }
  else { fallback(text, done); }
}
function fallback(text, done) {
  try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {}
}

/* ---------- render all ---------- */
function renderAll() {
  var pn = document.getElementById('gmProjectName'); if (pn && pn.value !== S.project) pn.value = S.project;
  var au = document.getElementById('gmAuthor'); if (au && au.value !== S.author) au.value = S.author;
  var er = document.getElementById('gmEraser'); if (er) { er.setAttribute('aria-pressed', S.eraser ? 'true' : 'false'); er.classList.toggle('blms-btn--primary', S.eraser); }
  renderBoard(); renderPalette(); renderMini(); sceneCheck();
  renderScriptList(); renderScriptPreview(); renderFiles(); renderExport();
  persist();
}
function setExample() {
  S.grid = new Array(W * H).fill(null);
  var place = function (col, row, id) { S.grid[row * W + col] = id; };
  place(0, 3, 'player');
  place(0, 3, 'player');
  S.grid[3 * W + 0] = 'player';
  S.grid[3 * W + 1] = 'platform'; S.grid[3 * W + 2] = 'platform';
  S.grid[2 * W + 3] = 'coin'; S.grid[1 * W + 4] = 'spike';
  S.grid[2 * W + 2] = 'enemy';
  S.grid[0 * W + 5] = 'goal';
  S.grid[3 * W + 4] = 'platform';
  renderAll();
  var msg = document.getElementById('gmMsg'); if (msg) { msg.className = 'blms-msg ok'; msg.textContent = 'Example scene loaded. Click 5. Download your project when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little Blender scene maker. In a few steps you will lay out 3D shapes, add Blender steps, write your script and download a real bpy script.' },
  { t: '1. Lay out a scene', b: 'Pick a shape and click grid squares. Add a Cube, a Sphere or a Plane. The grid is a bird\'s eye view.' },
  { t: '2. Add steps', b: 'Tick the Blender steps you want, like a colour material or a sun light. The Studio writes each one for you.' },
  { t: '3. Name your scene', b: 'Give your scene a name and check the ready list. The Studio fills in build_scene.py for you.' },
  { t: '4. Fix the log', b: 'Real scripts break in small ways. Practise reading the Blender log and choosing the fix, the same skill you use in Blender.' },
  { t: '5. Download', b: 'Download the zip, then open build_scene.py in Blender\'s Scripting tab and press Run Script.' }
];
var tourIndex = 0;
function renderTour() {
  var t = TOUR[tourIndex];
  document.getElementById('tourTitle').textContent = t.t;
  document.getElementById('tourBody').textContent = t.b;
  var dots = document.getElementById('tourDots'); dots.innerHTML = '';
  TOUR.forEach(function (_, i) { var s = document.createElement('span'); if (i === tourIndex) s.className = 'on'; dots.appendChild(s); });
  document.getElementById('tourNext').textContent = tourIndex === TOUR.length - 1 ? 'Done' : 'Next →';
}
function openTour() { tourIndex = 0; renderTour(); document.getElementById('tourOverlay').hidden = false; }
function closeTour() { document.getElementById('tourOverlay').hidden = true; }

/* ---------- init ---------- */
function init() {
  restore();
  initTabs();
  ['gmProjectName', 'gmAuthor'].forEach(function (id) {
    var el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', function () {
      if (id === 'gmProjectName') S.project = el.value;
      if (id === 'gmAuthor') S.author = el.value;
      renderFiles(); renderExport(); persist();
    });
  });
  var er = document.getElementById('gmEraser'); if (er) er.addEventListener('click', function () { S.eraser = !S.eraser; renderAll(); });
  var cl = document.getElementById('gmClear'); if (cl) cl.addEventListener('click', function () { S.grid = new Array(W * H).fill(null); renderAll(); });
  var ex = document.getElementById('gmExample'); if (ex) ex.addEventListener('click', setExample);
  var copyBtn = document.getElementById('gmFilesCopy'); if (copyBtn) copyBtn.addEventListener('click', function () {
    var files = scriptFiles();
    var text = buildScenePy();
    copyText(text, document.getElementById('gmFilesMsg'));
  });
  var dl = document.getElementById('gmDownload'); if (dl) dl.addEventListener('click', download);
  var nx = document.getElementById('gmNext'); if (nx) nx.addEventListener('click', nextProblem);
  var tb = document.getElementById('gmTourBtn'); if (tb) tb.addEventListener('click', openTour);
  var ts = document.getElementById('tourSkip'); if (ts) ts.addEventListener('click', closeTour);
  var tn = document.getElementById('tourNext'); if (tn) tn.addEventListener('click', function () { if (tourIndex === TOUR.length - 1) { closeTour(); } else { tourIndex++; renderTour(); } });
  var ov = document.getElementById('tourOverlay'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeTour(); });
  renderAll();
  renderDebug();
}

/* expose for tests */
window.BLD_buildScene = buildScenePy;
window.BLD_methodNames = function () { return scriptFiles().map(function (f) { return f.file; }); };

/* LiveEdit API: editable constants in generated scripts */
var EDITABLE = [
  { key: 'energy',       min: 1,   max: 20,   def: 3 },
  { key: 'resolution_x', min: 320, max: 3840, def: 1280 },
  { key: 'resolution_y', min: 240, max: 2160, def: 720 },
  { key: 'frame',        min: 10,  max: 300,  def: 60 }
];
var editVals = {};
EDITABLE.forEach(function (e) { editVals[e.key] = e.def; });

function applyValsToScripts() {
  SCRIPTS.forEach(function (s) {
    var lines = s.code.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^(.*\b)(energy|resolution_x|resolution_y|frame)(\s*=\s*)(-?\d+(?:\.\d+)?)(.*)/);
      if (m && editVals.hasOwnProperty(m[2])) {
        lines[i] = m[1] + m[2] + m[3] + editVals[m[2]] + (m[5] || '');
      }
    }
    s.code = lines.join('\n');
  });
}

window.JVDS_MOD_STUDIO = {
  getScriptCode: function () {
    var files = scriptFiles();
    if (!files.length) return '# Tick a method to write it.';
    return files.map(function (f) { return '# ' + f.file + '\n' + f.code; }).join('\n\n');
  },
  getFieldMeta: function () { return EDITABLE; },
  getValues: function () { var o = {}; EDITABLE.forEach(function (e) { o[e.key] = editVals[e.key]; }); return o; },
  setValue: function (k, v) { if (editVals.hasOwnProperty(k)) { editVals[k] = v; applyValsToScripts(); } },
  resetValues: function () { EDITABLE.forEach(function (e) { editVals[e.key] = e.def; }); applyValsToScripts(); },
  refresh: function () { renderScriptPreview(); renderFiles(); renderExport(); persist(); },
  paletteEl: null
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { init(); window.JVDS_MOD_STUDIO.paletteEl = document.getElementById('gmPalette'); }); } else { init(); window.JVDS_MOD_STUDIO.paletteEl = document.getElementById('gmPalette'); }
})();
