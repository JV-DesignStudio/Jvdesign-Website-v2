(function () {
'use strict';

var GRID = 12, MAXH = 12;
var CX = 280, CY = 300;

var BLOCKS = [
  { n: 'Grass', c: [0.42, 0.72, 0.33], mc: 'grass_block' },
  { n: 'Dirt',  c: [0.55, 0.42, 0.30], mc: 'dirt' },
  { n: 'Stone', c: [0.55, 0.55, 0.58], mc: 'stone' },
  { n: 'Wood',  c: [0.62, 0.45, 0.24], mc: 'oak_planks' },
  { n: 'Water', c: [0.30, 0.55, 0.85], mc: 'water' },
  { n: 'Red',   c: [0.80, 0.30, 0.30], mc: 'red_concrete' },
  { n: 'Gold',  c: [0.90, 0.78, 0.25], mc: 'gold_block' },
  { n: 'White', c: [0.92, 0.92, 0.92], mc: 'white_concrete' }
];

var S = {
  voxels: {},
  active: 0,
  yaw: -0.65,
  zoom: 1,
  erase: false,
  project: 'My First Voxel Model',
  author: ''
};

var KEY = 'jvds-voxel-studio-v1';
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
    var k = 'jvds-voxelxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-voxel-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-voxel-studio-xp', String(tot));
    localStorage.setItem(k, '1');
  } catch (e) {}
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- persist ---------- */
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({
    voxels: S.voxels, active: S.active, yaw: S.yaw, zoom: S.zoom, project: S.project, author: S.author
  })); } catch (e) {}
}
function restore() {
  try {
    var raw = localStorage.getItem(KEY); if (!raw) return;
    var s = JSON.parse(raw);
    if (s.voxels && typeof s.voxels === 'object') S.voxels = s.voxels;
    if (typeof s.active === 'number') S.active = s.active;
    if (typeof s.yaw === 'number') S.yaw = s.yaw;
    if (typeof s.zoom === 'number') S.zoom = s.zoom;
    if (typeof s.project === 'string') S.project = s.project;
    if (typeof s.author === 'string') S.author = s.author;
  } catch (e) {}
}

/* ---------- project build ---------- */
function slug(s, fb) { var out = String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''); return out || fb; }
function voxKey(x, y, z) { return x + ',' + y + ',' + z; }
function voxCount() { return Object.keys(S.voxels).length; }
function addVoxel(x, y, z) {
  if (x < 0 || x >= GRID || z < 0 || z >= GRID || y < 0 || y >= MAXH) return false;
  if (S.voxels[voxKey(x, y, z)]) return false;
  S.voxels[voxKey(x, y, z)] = S.active;
  return true;
}
function removeVoxel(x, y, z) { delete S.voxels[voxKey(x, y, z)]; }
function colourAt(k) { var b = BLOCKS[S.voxels[k]] || BLOCKS[0]; return b.c; }
function blockAt(k) { var b = BLOCKS[S.voxels[k]] || BLOCKS[0]; return b.mc; }
/* ---------- 3D renderer (canvas, isometric) ---------- */
var CORNERS = [[0,0,0],[1,0,0],[1,0,1],[0,0,1],[0,1,0],[1,1,0],[1,1,1],[0,1,1]];
var FACES = [
  { idx: [4,5,6,7], shade: 1.00 },
  { idx: [0,3,2,1], shade: 0.55 },
  { idx: [0,1,5,4], shade: 0.78 },
  { idx: [3,7,6,2], shade: 0.72 },
  { idx: [0,4,7,3], shade: 0.66 },
  { idx: [1,2,6,5], shade: 0.72 }
];
var pickList = [];
function project(x, y, z, cw, ch) {
  var cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  var rx = x * cy - z * sy;
  var rz = x * sy + z * cy;
  var s = 24 * S.zoom;
  return { x: cw / 2 + rx * s, y: ch / 2 + 50 + (rz * 0.5 - y) * s, d: rz };
}
function renderVoxelCanvas() {
  var cv = document.getElementById('vxCanvas'); if (!cv) return;
  var g = cv.getContext('2d'); var cw = cv.width, ch = cv.height;
  g.clearRect(0, 0, cw, ch);
  var off = GRID / 2, faces = [], keys = Object.keys(S.voxels);
  keys.forEach(function (k) {
    var p = k.split(',').map(Number);
    var col = colourAt(k);
    var proj = CORNERS.map(function (c) { return project(p[0] - off + c[0], p[1] + c[1], p[2] - off + c[2], cw, ch); });
    FACES.forEach(function (f) {
      var poly = f.idx.map(function (i) { return proj[i]; });
      var area = poly[0].x * (poly[1].y - poly[3].y) + poly[1].x * (poly[2].y - poly[0].y) + poly[2].x * (poly[3].y - poly[1].y) + poly[3].x * (poly[0].y - poly[2].y);
      if (area <= 0) return;
      var depth = (poly[0].d + poly[1].d + poly[2].d + poly[3].d) / 4;
      faces.push({ poly: poly, shade: f.shade, col: col, depth: depth, y: p[1], key: k });
    });
  });
  faces.sort(function (a, b) { return (a.depth - b.depth) || (a.y - b.y); });
  faces.forEach(function (f) {
    g.beginPath();
    g.moveTo(f.poly[0].x, f.poly[0].y);
    for (var i = 1; i < f.poly.length; i++) g.lineTo(f.poly[i].x, f.poly[i].y);
    g.closePath();
    g.fillStyle = 'rgb(' + Math.round(f.col[0] * 255 * f.shade) + ',' + Math.round(f.col[1] * 255 * f.shade) + ',' + Math.round(f.col[2] * 255 * f.shade) + ')';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1; g.stroke();
  });
  pickList = faces;
  if (!keys.length) {
    g.fillStyle = 'rgba(26,18,8,.5)';
    g.font = '700 16px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Click to stack your first cube', cw / 2, ch / 2);
    g.textAlign = 'start';
  }
}
function canvasPoint(e) {
  var cv = document.getElementById('vxCanvas'); var r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
}
function inPoly(px, py, poly) {
  var c = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}
function hitVoxel(mx, my) {
  for (var i = pickList.length - 1; i >= 0; i--) { if (inPoly(mx, my, pickList[i].poly)) return pickList[i].key; }
  return null;
}
function setupVoxelCanvas() {
  var cv = document.getElementById('vxCanvas'); if (!cv) return;
  var start = null, dragging = false;
  cv.addEventListener('pointerdown', function (e) { start = { x: e.clientX, y: e.clientY }; dragging = false; try { cv.setPointerCapture(e.pointerId); } catch (err) {} });
  cv.addEventListener('pointermove', function (e) {
    if (!start) return;
    if (Math.abs(e.clientX - start.x) > 5) {
      dragging = true;
      S.yaw += (e.clientX - start.x) * 0.01;
      start = { x: e.clientX, y: e.clientY };
      renderVoxelCanvas();
    }
  });
  cv.addEventListener('pointerup', function (e) {
    if (!dragging && start) {
      var pt = canvasPoint(e); var k = hitVoxel(pt.x, pt.y);
      if (k) {
        var p = k.split(',').map(Number);
        if (S.erase) removeVoxel(p[0], p[1], p[2]); else addVoxel(p[0], p[1] + 1, p[2]);
        blip(440, 0.05, 'triangle');
        renderAll();
      }
    }
    start = null; dragging = false;
  });
  cv.addEventListener('wheel', function (e) { e.preventDefault(); S.zoom = Math.max(0.4, Math.min(3, S.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); renderVoxelCanvas(); }, { passive: false });
}

/* ---------- exports ---------- */
function buildOBJ() {
  var lines = ['# Voxel Studio model', '# ' + voxCount() + ' cubes', 'o voxel_model'];
  var off = GRID / 2, n = 0;
  Object.keys(S.voxels).forEach(function (k) {
    var p = k.split(',').map(Number); var x = p[0] - off, y = p[1], z = p[2] - off;
    for (var i = 0; i < 8; i++) { var c = CORNERS[i]; lines.push('v ' + (x + c[0]) + ' ' + (y + c[1]) + ' ' + (z + c[2])); }
    var b = n * 8;
    FACES.forEach(function (f) { lines.push('f ' + (b + f.idx[0] + 1) + ' ' + (b + f.idx[1] + 1) + ' ' + (b + f.idx[2] + 1) + ' ' + (b + f.idx[3] + 1)); });
    n++;
  });
  return lines.join('\n') + '\n';
}
function buildMcFunction() {
  var lines = ['# Voxel Studio model - run with /function <name>', '# Placed relative to where you stand'];
  var keys = Object.keys(S.voxels);
  keys.forEach(function (k) {
    var p = k.split(',').map(Number);
    lines.push('setblock ~' + p[0] + ' ~' + p[1] + ' ~' + p[2] + ' minecraft:' + blockAt(k));
  });
  if (!keys.length) lines.push('# (no blocks yet)');
  return lines.join('\n') + '\n';
}
function usedBlock(i) { return Object.keys(S.voxels).some(function (k) { return S.voxels[k] === i; }); }
function scriptFiles() {
  return BLOCKS.filter(function (b, i) { return usedBlock(i); }).map(function (b) { return { name: b.n, file: b.mc + '.txt', code: 'minecraft:' + b.mc }; });
}

/* ---------- render ---------- */
function renderVoxelPalette(el) {
  if (!el) return;
  el.innerHTML = '';
  BLOCKS.forEach(function (b, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vxs-swatch' + (S.active === i ? ' is-active' : '');
    btn.title = b.n; btn.setAttribute('aria-label', b.n);
    btn.innerHTML = '<span class="vxs-chip" style="background:rgb(' + Math.round(b.c[0] * 255) + ',' + Math.round(b.c[1] * 255) + ',' + Math.round(b.c[2] * 255) + ')"></span><span class="vxs-swatch-name">' + esc(b.n) + '</span>';
    btn.addEventListener('click', function () { S.active = i; S.erase = false; renderAll(); });
    el.appendChild(btn);
  });
}
function renderPalette() { renderVoxelPalette(document.getElementById('gmPalette')); renderVoxelPalette(document.getElementById('gmScriptList')); }
function sceneCheck() {
  var ul = document.getElementById('gmSceneCheck'); if (!ul) return;
  var n = voxCount();
  var colours = {};
  Object.keys(S.voxels).forEach(function (k) { colours[S.voxels[k]] = 1; });
  var checks = [
    ['At least one cube is placed', n > 0],
    ['The model has 5 or more cubes', n >= 5],
    ['You used 2 or more colours', Object.keys(colours).length >= 2],
    ['The model is inside the grid', true]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}
function renderScriptPreview() {
  var pre = document.getElementById('gmScriptPreview'); if (!pre) return;
  if (!voxCount()) { pre.textContent = '// Build some cubes to write setblock commands.'; return; }
  var keys = Object.keys(S.voxels);
  var lines = keys.slice(0, 40).map(function (k) { var p = k.split(',').map(Number); return 'setblock ~' + p[0] + ' ~' + p[1] + ' ~' + p[2] + ' minecraft:' + blockAt(k); });
  pre.textContent = lines.join('\n') + (keys.length > 40 ? '\n... ' + keys.length + ' blocks in total' : '');
}
function renderFiles() {
  var pre = document.getElementById('gmFilesPreview'); if (!pre) return;
  if (voxCount() === 0) { pre.textContent = '# Build some cubes to write your OBJ mesh.'; renderChecklist(); return; }
  var obj = buildOBJ().split('\n');
  var head = obj.slice(0, 30).join('\n');
  var more = obj.length > 30 ? '\n... (' + (obj.length - 30) + ' more lines)' : '';
  pre.textContent = head + more;
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('gmChecklist'); if (!ul) return;
  var checks = [
    ['The project name has no odd symbols', /^[\w \-.]+$/.test(S.project)],
    ['At least one cube is placed', voxCount() > 0],
    ['The OBJ mesh has faces', /^f /m.test(buildOBJ())],
    ['The mcfunction has blocks', /setblock/.test(buildMcFunction())]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.vxs-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.vxs-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.vxs-tab'));
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
      'Error: unknown block "grassblock"',
      'Unknown block type in the setblock command.'
    ],
    q: 'Minecraft does not know that block. What is the fix?',
    opts: [
      { t: 'Use a real block id with the minecraft: namespace, like minecraft:grass_block (note the underscore).', ok: true },
      { t: 'Remove all the blocks.' },
      { t: 'Change the file name.' }
    ]
  },
  {
    log: [
      'Error: expected integer at position 1',
      'setblock ~one ~ ~ minecraft:stone'
    ],
    q: 'The coordinates are not numbers. What is the fix?',
    opts: [
      { t: 'Use numbers or the tilde ~ for relative positions, like ~1 ~ ~.', ok: true },
      { t: 'Add more blocks.' },
      { t: 'Use letters instead.' }
    ]
  },
  {
    log: [
      'Error: setblock is outside the world (y = 400)'
    ],
    q: 'The block is above the build limit. What is the fix?',
    opts: [
      { t: 'Keep the model lower: build within the world height and stand near the ground.', ok: true },
      { t: 'Dig a hole.' },
      { t: 'Ignore it.' }
    ]
  },
  {
    log: [
      'Error: Unknown function voxel_model',
      'The function could not be found in this datapack.'
    ],
    q: 'Minecraft cannot find your function. What is the fix?',
    opts: [
      { t: 'Put model.mcfunction in data/<namespace>/functions/, run /reload, then /function <namespace>:model.', ok: true },
      { t: 'Restart the game.' },
      { t: 'Rename the world.' }
    ]
  },
  {
    log: [
      'Error: OBJ face has 2 vertices',
      'A face needs at least 3 vertices.'
    ],
    q: 'A mesh face has too few vertices. What is the fix?',
    opts: [
      { t: 'Each OBJ face needs 3 or more vertices. A cube uses quads (4), so rebuild the cube.', ok: true },
      { t: 'Delete the model.' },
      { t: 'Add a colour.' }
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
  var msg = document.getElementById('gmDebugMsg'); msg.className = 'vxs-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('gmNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('gmOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'vxs-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('gmDebugMsg'); msg.className = 'vxs-msg ok'; msg.textContent = 'Correct. That is exactly what the Output is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('gmNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('gmDebugMsg'); m2.className = 'vxs-msg bad'; m2.textContent = 'Not quite. Read the Output line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); }

/* ---------- export ---------- */
function projectFiles() {
  var folder = slug(S.project, 'my_voxel_model');
  return [
    { name: folder + '/model.obj', text: buildOBJ() },
    { name: folder + '/model.mcfunction', text: buildMcFunction() },
    { name: folder + '/README.txt', text: readmeText(folder) }
  ];
}
function readmeText(folder) {
  var by = (S.author || '').trim();
  return S.project + ' - a voxel model made in the JVDesignStudio Voxel Studio.\n' +
    (by ? 'Made by: ' + by + '\n' : '') + '\n' +
    'WHAT IS INSIDE:\n' +
    '  model.obj         a standard 3D mesh (vertices and faces). Open it in Blender, TinkerCAD or a slicer.\n' +
    '  model.mcfunction  a Minecraft function made of setblock commands.\n\n' +
    'HOW TO USE THE MINECRAFT FILE:\n' +
    '1. In Minecraft Java, open your world folder > datapacks > (your pack) > data > (namespace) > functions.\n' +
    '2. Copy model.mcfunction there.\n' +
    '3. In game run: /reload  then  /function <namespace>:model\n' +
    '4. Stand where you want it and the blocks appear around you.\n\n' +
    'Full guides: https://jvdesignstudio.co.uk/workshop\n';
}
function renderExport() {
  var folder = slug(S.project, 'my_voxel_model');
  var tree = document.getElementById('gmExportTree');
  if (tree) {
    var lines = [folder + '.zip', '└── ' + folder + '/', '    ├── model.obj', '    ├── model.mcfunction', '    └── README.txt'];
    tree.textContent = lines.join('\n');
  }
  var ul = document.getElementById('gmExportCheck');
  if (ul) {
    var checks = [
      ['model.obj will be included', true],
      ['model.mcfunction will be included', true],
      ['The model has cubes', voxCount() > 0],
      [voxCount() + ' cube(s) will be exported', voxCount() > 0]
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
    var folder = slug(S.project, 'my_voxel_model');
    if (voxCount() === 0) { msg.className = 'vxs-msg bad'; msg.textContent = 'Stack at least one cube first.'; showTab('scene'); return; }
    var files = projectFiles().map(function (f) { return { name: f.name, data: enc.encode(f.text) }; });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_voxel-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_voxel-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'vxs-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Open model.obj in Blender, or drop model.mcfunction into Minecraft.';
  } catch (e) { msg.className = 'vxs-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'vxs-msg ok'; msgEl.textContent = 'Copied.'; } }
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
  var b = document.getElementById('vxBuild'); if (b) b.classList.toggle('is-active', !S.erase);
  var e = document.getElementById('vxErase'); if (e) e.classList.toggle('is-active', S.erase);
  renderVoxelCanvas(); renderPalette(); sceneCheck();
  renderScriptPreview(); renderFiles(); renderExport();
  persist();
}
function setExample() {
  S.voxels = {};
  var off = Math.floor(GRID / 2);
  for (var x = -2; x <= 2; x++) { for (var z = -2; z <= 2; z++) { S.voxels[voxKey(off + x, 0, off + z)] = 0; } }
  for (var y = 1; y <= 3; y++) {
    S.voxels[voxKey(off - 2, y, off - 2)] = 3; S.voxels[voxKey(off + 2, y, off - 2)] = 3;
    S.voxels[voxKey(off - 2, y, off + 2)] = 3; S.voxels[voxKey(off + 2, y, off + 2)] = 3;
  }
  for (var x2 = -2; x2 <= 2; x2++) { for (var z2 = -2; z2 <= 2; z2++) { S.voxels[voxKey(off + x2, 4, off + z2)] = 5; } }
  S.voxels[voxKey(off, 5, off)] = 6;
  renderAll();
  var msg = document.getElementById('gmMsg'); if (msg) { msg.className = 'vxs-msg ok'; msg.textContent = 'Example model loaded. Spin it, then download when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to Voxel Studio', b: 'A voxel is a 3D pixel. In a few steps you will stack cubes into a model, spin it to see every side, then download a real OBJ mesh and a Minecraft file.' },
  { t: '1. Build', b: 'Click the canvas to stack a cube on top. Drag to spin the model, scroll to zoom, and use Erase to remove a cube.' },
  { t: '2. Colours', b: 'Pick a colour before you build. Each colour is a real Minecraft block, like grass_block or gold_block.' },
  { t: '3. Your files', b: 'Give your model a name and check the ready list. The Studio writes model.obj and model.mcfunction for you.' },
  { t: '4. Fix the log', b: 'Real builds have small problems. Practise reading the log and choosing the fix, the same skill you use in Minecraft.' },
  { t: '5. Download', b: 'Download the zip, then open model.obj in Blender, or drop model.mcfunction into a Minecraft world and run /function.' }
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
  setupVoxelCanvas();
  var b = document.getElementById('vxBuild'); if (b) b.addEventListener('click', function () { S.erase = false; renderAll(); });
  var e = document.getElementById('vxErase'); if (e) e.addEventListener('click', function () { S.erase = true; renderAll(); });
  var l = document.getElementById('vxLeft'); if (l) l.addEventListener('click', function () { S.yaw -= 0.3; renderVoxelCanvas(); persist(); });
  var r = document.getElementById('vxRight'); if (r) r.addEventListener('click', function () { S.yaw += 0.3; renderVoxelCanvas(); persist(); });
  var cl = document.getElementById('vxClear'); if (cl) cl.addEventListener('click', function () { S.voxels = {}; renderAll(); });
  var ex = document.getElementById('vxExample'); if (ex) ex.addEventListener('click', setExample);
  var copyBtn = document.getElementById('gmFilesCopy'); if (copyBtn) copyBtn.addEventListener('click', function () {
    var text = '// model.obj\n' + buildOBJ() + '\n// model.mcfunction\n' + buildMcFunction();
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
window.VOX_buildOBJ = buildOBJ;
window.VOX_buildMcFunction = buildMcFunction;
window.VOX_count = function () { return voxCount(); };
window.VOX_methodNames = function () { return scriptFiles().map(function (f) { return f.file; }); };

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
