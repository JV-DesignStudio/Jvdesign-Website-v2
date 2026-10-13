(function () {
'use strict';

var GRID = 12, MAXH = 12;
var CX = 280, CY = 300;

var PIECES = [
  { id: 'floor',    n: 'Floor',    c: [0.56, 0.59, 0.63], w: 1,   h: 0.2, d: 1,   shape: 'box' },
  { id: 'wall',     n: 'Wall',     c: [0.74, 0.72, 0.66], w: 1,   h: 1,   d: 0.3, shape: 'box' },
  { id: 'platform', n: 'Platform', c: [0.50, 0.56, 0.62], w: 2,   h: 0.3, d: 2,   shape: 'box' },
  { id: 'pillar',   n: 'Pillar',   c: [0.64, 0.60, 0.52], w: 0.5, h: 2,   d: 0.5, shape: 'box' },
  { id: 'crate',    n: 'Crate',    c: [0.76, 0.55, 0.30], w: 0.9, h: 0.9, d: 0.9, shape: 'box' },
  { id: 'ramp',     n: 'Ramp',     c: [0.45, 0.68, 0.52], w: 1,   h: 1,   d: 1,   shape: 'wedge' },
  { id: 'spawn',    n: 'Spawn',    c: [0.30, 0.78, 0.45], w: 0.7, h: 0.7, d: 0.7, shape: 'box' },
  { id: 'goal',     n: 'Goal',     c: [0.92, 0.80, 0.28], w: 0.7, h: 0.7, d: 0.7, shape: 'box' }
];

var S = {
  voxels: {},
  active: 0,
  yaw: -0.65,
  zoom: 1,
  erase: false,
  project: 'My First Level',
  author: ''
};

var KEY = 'jvds-world-builder-3d-v1';
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
    var k = 'jvds-wb3dxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-world-builder-3d-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-world-builder-3d-xp', String(tot));
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
function pieceAt(k) { return PIECES[S.voxels[k]] || PIECES[0]; }
function pieceColour(k) { return pieceAt(k).c; }
/* ---------- 3D renderer (canvas, isometric) ---------- */
function pieceVerts(p) {
  var w = p.w, h = p.h, d = p.d;
  if (p.shape === 'wedge') {
    return [
      [-w/2, 0, -d/2], [w/2, 0, -d/2], [w/2, 0, d/2], [-w/2, 0, d/2],
      [-w/2, h, d/2], [w/2, h, d/2]
    ];
  }
  return [
    [-w/2, 0, -d/2], [w/2, 0, -d/2], [w/2, 0, d/2], [-w/2, 0, d/2],
    [-w/2, h, -d/2], [w/2, h, -d/2], [w/2, h, d/2], [-w/2, h, d/2]
  ];
}
function pieceFaces(p) {
  if (p.shape === 'wedge') {
    return [
      { idx: [0,3,2,1], shade: 0.55 },
      { idx: [0,1,5,4], shade: 0.95 },
      { idx: [3,4,5,2], shade: 0.75 },
      { idx: [0,4,3],   shade: 0.70 },
      { idx: [1,2,5],   shade: 0.66 }
    ];
  }
  return [
    { idx: [4,5,6,7], shade: 1.00 },
    { idx: [0,3,2,1], shade: 0.55 },
    { idx: [0,1,5,4], shade: 0.78 },
    { idx: [3,7,6,2], shade: 0.72 },
    { idx: [0,4,7,3], shade: 0.66 },
    { idx: [1,2,6,5], shade: 0.72 }
  ];
}
var pickList = [];
function project(x, y, z, cw, ch) {
  var cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  var rx = x * cy - z * sy;
  var rz = x * sy + z * cy;
  var s = 22 * S.zoom;
  return { x: cw / 2 + rx * s, y: ch / 2 + 50 + (rz * 0.5 - y) * s, d: rz };
}
function renderVoxelCanvas() {
  var cv = document.getElementById('vxCanvas'); if (!cv) return;
  var g = cv.getContext('2d'); var cw = cv.width, ch = cv.height;
  g.clearRect(0, 0, cw, ch);
  var off = GRID / 2, faces = [], keys = Object.keys(S.voxels);
  g.strokeStyle = 'rgba(47,158,107,.25)'; g.lineWidth = 1;
  for (var gx = 0; gx <= GRID; gx++) {
    var a = project(gx - off, 0, -off, cw, ch), b2 = project(gx - off, 0, GRID - off, cw, ch);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b2.x, b2.y); g.stroke();
    var c2 = project(-off, 0, gx - off, cw, ch), d2 = project(GRID - off, 0, gx - off, cw, ch);
    g.beginPath(); g.moveTo(c2.x, c2.y); g.lineTo(d2.x, d2.y); g.stroke();
  }
  keys.forEach(function (k) {
    var cell = k.split(',').map(Number);
    var pc = pieceAt(k);
    var verts = pieceVerts(pc), pfaces = pieceFaces(pc);
    var proj = verts.map(function (v) { return project(cell[0] - off + 0.5 + v[0], cell[1] + v[1], cell[2] - off + 0.5 + v[2], cw, ch); });
    pfaces.forEach(function (f) {
      var poly = f.idx.map(function (i) { return proj[i]; });
      var area = 0;
      for (var i = 0; i < poly.length; i++) { var j = (i + 1) % poly.length; area += poly[i].x * poly[j].y - poly[j].x * poly[i].y; }
      if (area <= 0) return;
      var dep = 0; poly.forEach(function (q) { dep += q.d; }); dep /= poly.length;
      faces.push({ poly: poly, shade: f.shade, col: pc.c, depth: dep, y: cell[1], key: k });
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
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.stroke();
  });
  pickList = faces;
  if (!keys.length) {
    g.fillStyle = 'rgba(26,18,8,.5)';
    g.font = '700 16px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Click a cell to place your first piece', cw / 2, ch / 2);
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
  var lines = ['# World Builder level', '# ' + voxCount() + ' pieces', 'o level'];
  var off = GRID / 2, n = 0;
  Object.keys(S.voxels).forEach(function (k) {
    var cell = k.split(',').map(Number);
    var pc = pieceAt(k);
    var verts = pieceVerts(pc), pfaces = pieceFaces(pc);
    verts.forEach(function (v) { lines.push('v ' + (cell[0] - off + 0.5 + v[0]) + ' ' + (cell[1] + v[1]) + ' ' + (cell[2] - off + 0.5 + v[2])); });
    var b = n * verts.length;
    pfaces.forEach(function (f) { lines.push('f ' + f.idx.map(function (i) { return b + i + 1; }).join(' ')); });
    n++;
  });
  return lines.join('\n') + '\n';
}
function buildLevelJson() {
  var off = GRID / 2;
  var list = Object.keys(S.voxels).map(function (k) {
    var cell = k.split(',').map(Number);
    return { piece: pieceAt(k).id, x: cell[0] - off, y: cell[1], z: cell[2] - off };
  });
  return JSON.stringify({ name: S.project, engine: 'any', pieces: list }, null, 2) + '\n';
}
function usedPiece(i) { return Object.keys(S.voxels).some(function (k) { return S.voxels[k] === i; }); }
function scriptFiles() {
  return PIECES.filter(function (p, i) { return usedPiece(i); }).map(function (p) { return { name: p.n, file: p.id, code: p.id }; });
}

/* ---------- render ---------- */
function renderVoxelPalette(el) {
  if (!el) return;
  el.innerHTML = '';
  PIECES.forEach(function (b, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wbs-swatch' + (S.active === i ? ' is-active' : '');
    btn.title = b.n; btn.setAttribute('aria-label', b.n);
    btn.innerHTML = '<span class="wbs-chip" style="background:rgb(' + Math.round(b.c[0] * 255) + ',' + Math.round(b.c[1] * 255) + ',' + Math.round(b.c[2] * 255) + ')"></span><span class="wbs-swatch-name">' + esc(b.n) + '</span>';
    btn.addEventListener('click', function () { S.active = i; S.erase = false; renderAll(); });
    el.appendChild(btn);
  });
}
function renderPalette() { renderVoxelPalette(document.getElementById('gmPalette')); renderVoxelPalette(document.getElementById('gmScriptList')); }
function sceneCheck() {
  var ul = document.getElementById('gmSceneCheck'); if (!ul) return;
  var n = voxCount();
  var kinds = {};
  Object.keys(S.voxels).forEach(function (k) { kinds[S.voxels[k]] = 1; });
  var checks = [
    ['At least one piece is placed', n > 0],
    ['The level has 5 or more pieces', n >= 5],
    ['You used 2 or more piece types', Object.keys(kinds).length >= 2],
    ['There is a floor to stand on', Object.keys(S.voxels).some(function (k) { return S.voxels[k] === 0; })]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}
function renderScriptPreview() {
  var pre = document.getElementById('gmScriptPreview'); if (!pre) return;
  if (!voxCount()) { pre.textContent = '// Place some pieces to write your level list.'; return; }
  var keys = Object.keys(S.voxels);
  var lines = keys.slice(0, 40).map(function (k) { var p = k.split(',').map(Number); return pieceAt(k).id + '  x=' + p[0] + '  y=' + p[1] + '  z=' + p[2]; });
  pre.textContent = lines.join('\n') + (keys.length > 40 ? '\n... ' + keys.length + ' pieces in total' : '');
}
function renderFiles() {
  var pre = document.getElementById('gmFilesPreview'); if (!pre) return;
  if (voxCount() === 0) { pre.textContent = '# Place some pieces to write your OBJ mesh.'; renderChecklist(); return; }
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
    ['At least one piece is placed', voxCount() > 0],
    ['The OBJ mesh has faces', /^f /m.test(buildOBJ())],
    ['The level list is valid JSON', (function () { try { JSON.parse(buildLevelJson()); return true; } catch (e) { return false; } })()]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.wbs-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.wbs-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.wbs-tab'));
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
      'Error: level.obj has 0 faces',
      'The mesh is empty, so nothing shows in the engine.'
    ],
    q: 'The exported mesh is empty. What is the fix?',
    opts: [
      { t: 'Place at least one piece on the grid before you export.', ok: true },
      { t: 'Rename the file.' },
      { t: 'Change the engine.' }
    ]
  },
  {
    log: [
      'Error: a ramp faces the wrong way',
      'The slope drops away from the path.'
    ],
    q: 'A ramp slopes the wrong way. What is the fix?',
    opts: [
      { t: 'Ramps rise toward the back (+z). Rebuild it so it climbs the way you want.', ok: true },
      { t: 'Delete all the ramps.' },
      { t: 'Use a wall instead.' }
    ]
  },
  {
    log: [
      'Error: no spawn piece in the level',
      'The player has nowhere to start.'
    ],
    q: 'There is no start point. What is the fix?',
    opts: [
      { t: 'Place a Spawn piece on the floor so the player has somewhere to start.', ok: true },
      { t: 'Delete the level.' },
      { t: 'Add a wall.' }
    ]
  },
  {
    log: [
      'Error: a piece is floating in the air',
      'It has nothing under it.'
    ],
    q: 'A piece is floating. What is the fix?',
    opts: [
      { t: 'Put a floor or pillar under it, or lower it to the ground level.', ok: true },
      { t: 'Make it bigger.' },
      { t: 'Ignore it.' }
    ]
  },
  {
    log: [
      'Error: the level is 40 units wide',
      'The playable area is too big for the grid.'
    ],
    q: 'The level is too large. What is the fix?',
    opts: [
      { t: 'Keep the blockout inside the 12 by 12 grid, then expand it in your engine.', ok: true },
      { t: 'Delete half the level.' },
      { t: 'Change the file name.' }
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
  var msg = document.getElementById('gmDebugMsg'); msg.className = 'wbs-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('gmNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('gmOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'wbs-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('gmDebugMsg'); msg.className = 'wbs-msg ok'; msg.textContent = 'Correct. That is exactly what the Output is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('gmNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('gmDebugMsg'); m2.className = 'wbs-msg bad'; m2.textContent = 'Not quite. Read the Output line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); }

/* ---------- export ---------- */
function projectFiles() {
  var folder = slug(S.project, 'my_level');
  return [
    { name: folder + '/level.obj', text: buildOBJ() },
    { name: folder + '/level.json', text: buildLevelJson() },
    { name: folder + '/README.txt', text: readmeText(folder) }
  ];
}
function readmeText(folder) {
  var by = (S.author || '').trim();
  return S.project + ' - a 3D level blockout made in the JVDesignStudio 3D World Builder.\n' +
    (by ? 'Made by: ' + by + '\n' : '') + '\n' +
    'WHAT IS INSIDE:\n' +
    '  level.obj   a standard 3D mesh (vertices and faces). Import it into Godot, Unity or Blender.\n' +
    '  level.json  every piece with its grid position, so you can rebuild the level with your own objects.\n\n' +
    'HOW TO USE IT:\n' +
    '1. In Godot, Unity or Blender, import level.obj as a mesh.\n' +
    '2. Use level.json to place your real objects (floors, walls, ramps) at the same spots.\n' +
    '3. Replace the blockout shapes with art, then add gameplay.\n\n' +
    'Full guides: https://jvdesignstudio.co.uk/workshop\n';
}
function renderExport() {
  var folder = slug(S.project, 'my_level');
  var tree = document.getElementById('gmExportTree');
  if (tree) {
    var lines = [folder + '.zip', '└── ' + folder + '/', '    ├── level.obj', '    ├── level.json', '    └── README.txt'];
    tree.textContent = lines.join('\n');
  }
  var ul = document.getElementById('gmExportCheck');
  if (ul) {
    var checks = [
      ['level.obj will be included', true],
      ['level.json will be included', true],
      ['The level has pieces', voxCount() > 0],
      [voxCount() + ' piece(s) will be exported', voxCount() > 0]
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
    var folder = slug(S.project, 'my_level');
    if (voxCount() === 0) { msg.className = 'wbs-msg bad'; msg.textContent = 'Place at least one piece first.'; showTab('scene'); return; }
    var files = projectFiles().map(function (f) { return { name: f.name, data: enc.encode(f.text) }; });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_world-builder-3d') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_world-builder-3d', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'wbs-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Import level.obj into Godot, Unity or Blender.';
  } catch (e) { msg.className = 'wbs-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'wbs-msg ok'; msgEl.textContent = 'Copied.'; } }
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
  for (var wx = -2; wx <= 2; wx++) { S.voxels[voxKey(off + wx, 1, off - 2)] = 1; }
  S.voxels[voxKey(off - 2, 1, off + 2)] = 3;
  S.voxels[voxKey(off + 2, 1, off + 2)] = 3;
  S.voxels[voxKey(off, 1, off)] = 5;
  S.voxels[voxKey(off - 2, 1, off - 2)] = 6;
  S.voxels[voxKey(off + 2, 1, off + 2)] = 7;
  renderAll();
  var msg = document.getElementById('gmMsg'); if (msg) { msg.className = 'wbs-msg ok'; msg.textContent = 'Example level loaded. Spin it, then download when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the 3D World Builder', b: 'Every level starts as a blockout. In a few steps you will place plain shapes on a grid, spin the view to check the space, then download a real OBJ mesh and a level.json.' },
  { t: '1. Block out', b: 'Pick a piece, then click the canvas to place it. Drag to spin the view, scroll to zoom, and use Erase to remove a piece.' },
  { t: '2. Pieces', b: 'Floors and platforms are walkable, ramps join heights, and spawn and goal mark the start and end of your level.' },
  { t: '3. Your files', b: 'Give your level a name and check the ready list. The Studio writes level.obj and level.json for you.' },
  { t: '4. Fix the log', b: 'Real levels have small problems. Practise reading the log and choosing the fix, the same skill you use in your engine.' },
  { t: '5. Download', b: 'Download the zip, then import level.obj into Godot, Unity or Blender and use level.json to place your real objects.' }
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
    var text = '// level.obj\n' + buildOBJ() + '\n// level.json\n' + buildLevelJson();
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
window.WLD_buildOBJ = buildOBJ;
window.WLD_buildLevelJson = buildLevelJson;
window.WLD_count = function () { return voxCount(); };
window.WLD_methodNames = function () { return scriptFiles().map(function (f) { return f.file; }); };

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
