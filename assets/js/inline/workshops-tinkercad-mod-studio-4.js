(function () {
'use strict';

var W = 6, H = 4, CELL = 80;

var PARTS = [
  { id: 'box',      n: 'Box',      e: '🟧', c: [0.90, 0.45, 0.30], size: 12 },
  { id: 'cylinder', n: 'Cylinder', e: '🥫', c: [0.30, 0.60, 0.85], size: 12 },
  { id: 'cone',     n: 'Cone',     e: '🔺', c: [0.40, 0.75, 0.45], size: 12 },
  { id: 'sphere',   n: 'Sphere',   e: '⚪', c: [0.85, 0.75, 0.25], size: 12 },
  { id: 'wedge',    n: 'Wedge',    e: '📐', c: [0.75, 0.40, 0.75], size: 12 },
  { id: 'pyramid',  n: 'Pyramid',  e: '🔻', c: [0.55, 0.55, 0.60], size: 12 }
];
var BY_ID = {};
PARTS.forEach(function (p) { BY_ID[p.id] = p; });
function part(id) { return BY_ID[id] || null; }

var SCRIPTS = [
  {
    k: 'flat', n: 'Sit flat', desc: 'Drop the model so its lowest point sits on the print bed.',
    code: '// move every vertex so the lowest point is at z = 0'
  },
  {
    k: 'bed', n: 'Fit the bed', desc: 'Scale the model down if it is bigger than the 100 mm bed.',
    code: '// scale the model so it fits inside a 100 x 100 x 100 mm bed'
  },
  {
    k: 'base', n: 'Add a base', desc: 'Add a 2 mm base plate under the whole model.',
    code: '// add a 2 mm base plate under the model'
  },
  {
    k: 'mirror', n: 'Mirror', desc: 'Add a mirrored copy across the middle.',
    code: '// add a mirrored copy of the model across the middle'
  },
  {
    k: 'detail', n: 'High detail', desc: 'Use more triangles on round shapes for a smoother finish.',
    code: '// use 24 slices on round shapes instead of 16'
  }
];
var SCRIPT_BY_K = {};
SCRIPTS.forEach(function (s) { SCRIPT_BY_K[s.k] = s; });

var S = {
  grid: new Array(W * H).fill(null),
  active: 'box',
  eraser: false,
  project: 'My First 3D Print',
  author: '',
  scripts: { flat: true, bed: true, base: true, mirror: false, detail: false }
};

var KEY = 'jvds-tinkercad-mod-studio-v1';
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
    var k = 'jvds-tinkercadxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-tinkercad-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-tinkercad-studio-xp', String(tot));
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
var SCRIPT_IDS = { flat: true, bed: true, base: true, mirror: true, detail: true };
function tickedMethods() { return SCRIPTS.filter(function (s) { return S.scripts[s.k]; }); }
function f2(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }
function gridX(it) { var col = (it.x - CELL / 2) / CELL; return (col - (W - 1) / 2) * 12; }
function gridY(it) { var row = (it.y - CELL / 2) / CELL; return ((H - 1) / 2 - row) * 12; }
var DETAIL = false;
var TRIS = null;
function v(x, y, z) { return [x, y, z]; }
function tri(a, b, c) { TRIS.push([a, b, c]); }
function addBox(cx, cy, s, h) {
  s = s || 12; h = h || 12;
  var x0 = cx - s / 2, x1 = cx + s / 2, y0 = cy - s / 2, y1 = cy + s / 2;
  var p = [v(x0,y0,0), v(x1,y0,0), v(x1,y1,0), v(x0,y1,0), v(x0,y0,h), v(x1,y0,h), v(x1,y1,h), v(x0,y1,h)];
  tri(p[0],p[1],p[2]); tri(p[0],p[2],p[3]);
  tri(p[4],p[6],p[5]); tri(p[4],p[7],p[6]);
  tri(p[0],p[4],p[5]); tri(p[0],p[5],p[1]);
  tri(p[1],p[5],p[6]); tri(p[1],p[6],p[2]);
  tri(p[2],p[6],p[7]); tri(p[2],p[7],p[3]);
  tri(p[3],p[7],p[4]); tri(p[3],p[4],p[0]);
}
function addCylinder(cx, cy, r, h, n) {
  r = r || 6; h = h || 12; n = n || (DETAIL ? 24 : 16);
  for (var i = 0; i < n; i++) {
    var a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    var x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    var x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    tri(v(x0,y0,0), v(x1,y1,0), v(x1,y1,h));
    tri(v(x0,y0,0), v(x1,y1,h), v(x0,y0,h));
    tri(v(cx,cy,h), v(x0,y0,h), v(x1,y1,h));
    tri(v(cx,cy,0), v(x1,y1,0), v(x0,y0,0));
  }
}
function addCone(cx, cy, r, h, n) {
  r = r || 6; h = h || 14; n = n || (DETAIL ? 24 : 16);
  for (var i = 0; i < n; i++) {
    var a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    var x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    var x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    tri(v(x0,y0,0), v(x1,y1,0), v(cx,cy,h));
    tri(v(cx,cy,0), v(x1,y1,0), v(x0,y0,0));
  }
}
function addSphere(cx, cy, r, stacks, slices) {
  r = r || 7; stacks = stacks || (DETAIL ? 16 : 12); slices = slices || (DETAIL ? 24 : 16);
  function P(st, sl) {
    var phi = (st / stacks) * Math.PI, theta = (sl / slices) * Math.PI * 2;
    return v(cx + r * Math.sin(phi) * Math.cos(theta), cy + r * Math.sin(phi) * Math.sin(theta), r + r * Math.cos(phi));
  }
  for (var i = 0; i < stacks; i++) {
    for (var j = 0; j < slices; j++) {
      tri(P(i, j), P(i + 1, j), P(i + 1, j + 1));
      tri(P(i, j), P(i + 1, j + 1), P(i, j + 1));
    }
  }
}
function addPyramid(cx, cy, s, h) {
  s = s || 12; h = h || 14;
  var x0 = cx - s / 2, x1 = cx + s / 2, y0 = cy - s / 2, y1 = cy + s / 2;
  var apex = v(cx, cy, h);
  tri(v(x0,y0,0), v(x1,y0,0), apex);
  tri(v(x1,y0,0), v(x1,y1,0), apex);
  tri(v(x1,y1,0), v(x0,y1,0), apex);
  tri(v(x0,y1,0), v(x0,y0,0), apex);
  tri(v(x0,y0,0), v(x1,y1,0), v(x1,y0,0));
  tri(v(x0,y0,0), v(x0,y1,0), v(x1,y1,0));
}
function addWedge(cx, cy, s, h) {
  s = s || 12; h = h || 12;
  var x0 = cx - s / 2, x1 = cx + s / 2, y0 = cy - s / 2, y1 = cy + s / 2;
  var A = v(x0,y0,0), B = v(x1,y0,0), C = v(x1,y1,0), D = v(x0,y1,0);
  var E = v(x0,y0,h), F = v(x1,y0,h);
  tri(A,B,C); tri(A,C,D);
  tri(A,E,F); tri(A,F,B);
  tri(A,D,E);
  tri(B,F,C);
  tri(D,C,F); tri(D,F,E);
}
function bounds() {
  var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  TRIS.forEach(function (t) { t.forEach(function (p) { for (var k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; } }); });
  return { mn: mn, mx: mx };
}
function sitFlat() { var b = bounds(); var dz = -b.mn[2]; TRIS.forEach(function (t) { t.forEach(function (p) { p[2] += dz; }); }); }
function fitBed() {
  var b = bounds(); var size = [b.mx[0] - b.mn[0], b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]];
  var m = Math.max(size[0], size[1], size[2]);
  if (m > 100) { var s = 100 / m; TRIS.forEach(function (t) { t.forEach(function (p) { p[0] *= s; p[1] *= s; p[2] *= s; }); }); }
}
function addBase() {
  var b = bounds();
  var w = (b.mx[0] - b.mn[0]) + 8, d = (b.mx[1] - b.mn[1]) + 8;
  var cx = (b.mx[0] + b.mn[0]) / 2, cy = (b.mx[1] + b.mn[1]) / 2;
  var x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  var p = [v(x0,y0,0), v(x1,y0,0), v(x1,y1,0), v(x0,y1,0), v(x0,y0,2), v(x1,y0,2), v(x1,y1,2), v(x0,y1,2)];
  tri(p[0],p[1],p[2]); tri(p[0],p[2],p[3]);
  tri(p[4],p[6],p[5]); tri(p[4],p[7],p[6]);
  tri(p[0],p[4],p[5]); tri(p[0],p[5],p[1]);
  tri(p[1],p[5],p[6]); tri(p[1],p[6],p[2]);
  tri(p[2],p[6],p[7]); tri(p[2],p[7],p[3]);
  tri(p[3],p[7],p[4]); tri(p[3],p[4],p[0]);
}
function mirrorX() {
  var b = bounds(); var cx = (b.mx[0] + b.mn[0]) / 2;
  var copy = [];
  TRIS.forEach(function (t) { copy.push(t.map(function (p) { return v(2 * cx - p[0], p[1], p[2]); })); });
  copy.forEach(function (t) { TRIS.push(t); });
}
function normal(t) {
  var a = t[0], b = t[1], c = t[2];
  var u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], w = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  var n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
  var len = Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]) || 1;
  return [n[0]/len, n[1]/len, n[2]/len];
}
function buildTris() {
  DETAIL = !!S.scripts.detail;
  TRIS = [];
  placedItems().forEach(function (it) {
    var x = gridX(it), y = gridY(it);
    if (it.id === 'box') addBox(x, y);
    else if (it.id === 'cylinder') addCylinder(x, y);
    else if (it.id === 'cone') addCone(x, y);
    else if (it.id === 'sphere') addSphere(x, y);
    else if (it.id === 'pyramid') addPyramid(x, y);
    else if (it.id === 'wedge') addWedge(x, y);
  });
  if (S.scripts.flat) sitFlat();
  if (S.scripts.bed) fitBed();
  if (S.scripts.base) addBase();
  if (S.scripts.mirror) mirrorX();
  return TRIS;
}
function triangleCount() { return buildTris().length; }
function buildSTL() {
  var tris = buildTris();
  var lines = ['solid jvds_model'];
  tris.forEach(function (t) {
    var n = normal(t);
    lines.push('  facet normal ' + f2(n[0]) + ' ' + f2(n[1]) + ' ' + f2(n[2]));
    lines.push('    outer loop');
    t.forEach(function (p) { lines.push('      vertex ' + f2(p[0]) + ' ' + f2(p[1]) + ' ' + f2(p[2])); });
    lines.push('    endloop');
    lines.push('  endfacet');
  });
  lines.push('endsolid jvds_model');
  return lines.join('\n') + '\n';
}
function scriptFiles() {
  return tickedMethods().map(function (s) { return { name: s.n, file: s.k + '.step', code: s.code }; });
}

/* ---------- render scene ---------- */
function renderBoard() {
  var g = document.getElementById('gmBoard'); if (!g) return;
  g.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  g.innerHTML = '';
  S.grid.forEach(function (cell, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tcms-cell' + (cell ? ' is-filled' : '');
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
    b.className = 'tcms-swatch' + (!S.eraser && S.active === it.id ? ' is-active' : '');
    b.title = it.n; b.setAttribute('aria-label', it.n);
    b.innerHTML = '<span class="tcms-swatch-emoji">' + it.e + '</span><span class="tcms-swatch-name">' + esc(it.n) + '</span>';
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
    d.className = 'tcms-mini-cell';
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
    ['A shape is placed', placedItems().length > 0],
    ['It sits on the plate', !!S.scripts.flat],
    ['It fits the bed', !!S.scripts.bed],
    ['At least 3 shapes placed', placedItems().length >= 3]
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
    span.innerHTML = '<strong>' + esc(s.n) + '</strong><br><span style="color:var(--charcoal-lt);font-size:.82rem">' + esc(s.desc) + '</span>';
    l.appendChild(cb); l.appendChild(span);
    box.appendChild(l);
  });
}
function renderScriptPreview() {
  var pre = document.getElementById('gmScriptPreview'); if (!pre) return;
  var files = scriptFiles();
  if (!files.length) { pre.textContent = '// Tick a step to apply it.'; return; }
  pre.textContent = files.map(function (f) { return '// ' + f.file + '\n' + f.code; }).join('\n\n');
}

/* ---------- render files ---------- */
function renderFiles() {
  var pre = document.getElementById('gmFilesPreview'); if (!pre) return;
  var src = buildSTL().split('\n');
  var head = src.slice(0, 34).join('\n');
  var more = src.length > 34 ? '\n... (' + (src.length - 34) + ' more lines, ' + placedItems().length + ' shapes)' : '';
  pre.textContent = 'model.stl\n' + head + more;
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('gmChecklist'); if (!ul) return;
  var c = counts();
  var checks = [
    ['The project name has no odd symbols', /^[\w \-.]+$/.test(S.project)],
    ['At least one shape is placed', placedItems().length > 0],
    ['Sit flat is ticked', !!S.scripts.flat],
    ['The model has triangles', triangleCount() > 0],
    ['At least one step is ticked', scriptFiles().length > 0]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.tcms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.tcms-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.tcms-tab'));
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
      'Error: the model is not watertight',
      'The mesh has open edges, so a slicer may refuse to print it.'
    ],
    q: 'The model has open edges. What is the fix?',
    opts: [
      { t: 'Make sure every shape is a closed solid (a box, cylinder, cone or sphere), and overlap shapes so they join.', ok: true },
      { t: 'Delete the model.' },
      { t: 'Print it anyway.' }
    ]
  },
  {
    log: [
      'Error: the model is 140 mm wide but the bed is 100 mm.'
    ],
    q: 'The model is bigger than the bed. What is the fix?',
    opts: [
      { t: 'Tick Fit the bed to scale the model down, or move shapes closer together.', ok: true },
      { t: 'Buy a bigger printer.' },
      { t: 'Rename the model.' }
    ]
  },
  {
    log: [
      'Error: the model sits below the plate (lowest z = -5).'
    ],
    q: 'Part of the model is under the plate. What is the fix?',
    opts: [
      { t: 'Tick Sit flat so the lowest point is moved to z = 0.', ok: true },
      { t: 'Rotate the printer.' },
      { t: 'Ignore it.' }
    ]
  },
  {
    log: [
      'Error: a shape has zero height and makes no triangles.'
    ],
    q: 'A shape has no height. What is the fix?',
    opts: [
      { t: 'Give the shape a height, or remove it, so it has volume to print.', ok: true },
      { t: 'Add more colours.' },
      { t: 'Move it to the middle.' }
    ]
  },
  {
    log: [
      'Error: model.stl contains no triangles.'
    ],
    q: 'The model is empty. What is the fix?',
    opts: [
      { t: 'Place at least one shape on the grid first.', ok: true },
      { t: 'Rename the file.' },
      { t: 'Add a base.' }
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
  var msg = document.getElementById('gmDebugMsg'); msg.className = 'tcms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('gmNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('gmOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tcms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('gmDebugMsg'); msg.className = 'tcms-msg ok'; msg.textContent = 'Correct. That is exactly what the Output is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('gmNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('gmDebugMsg'); m2.className = 'tcms-msg bad'; m2.textContent = 'Not quite. Read the Output line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); }

/* ---------- export ---------- */
function projectFiles() {
  var folder = slug(S.project, 'my_3d_model');
  return [
    { name: folder + '/model.stl', text: buildSTL() },
    { name: folder + '/README.txt', text: readmeText(folder) }
  ];
}
function readmeText(folder) {
  var by = (S.author || '').trim();
  return S.project + ' - a 3D model made in the JVDesignStudio TinkerCAD Mod Studio.\n' +
    (by ? 'Made by: ' + by + '\n' : '') + '\n' +
    'WHAT IT IS: model.stl is a standard 3D mesh file (ASCII STL) made of triangles.\n\n' +
    'HOW TO USE IT:\n' +
    '1. Open TinkerCAD (free at tinkercad.com) and sign in, or open a slicer like Cura.\n' +
    '2. In TinkerCAD choose Import, then pick model.stl.\n' +
    '3. Move it, resize it, then Export or send it to a 3D printer. Ask a grown-up before printing.\n\n' +
    'Full guides: https://jvdesignstudio.co.uk/workshop\n';
}
function renderExport() {
  var folder = slug(S.project, 'my_3d_model');
  var tree = document.getElementById('gmExportTree');
  if (tree) {
    var lines = [folder + '.zip', '└── ' + folder + '/', '    ├── model.stl', '    └── README.txt'];
    tree.textContent = lines.join('\n');
  }
  var ul = document.getElementById('gmExportCheck');
  if (ul) {
    var checks = [
      ['model.stl will be included', true],
      ['Shapes are placed', placedItems().length > 0],
      ['The model has triangles', triangleCount() > 0],
      [tickedMethods().length ? tickedMethods().length + ' step(s) will be applied' : 'No steps yet (optional)', tickedMethods().length > 0]
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
    var folder = slug(S.project, 'my_3d_model');
    if (placedItems().length === 0) { msg.className = 'tcms-msg bad'; msg.textContent = 'Place at least one shape on the grid first.'; showTab('scene'); return; }
    var files = projectFiles().map(function (f) { return { name: f.name, data: f.bytes ? f.bytes : enc.encode(f.text) }; });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_tinkercad-mod-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_tinkercad-mod-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'tcms-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Import model.stl into TinkerCAD or a slicer.';
  } catch (e) { msg.className = 'tcms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'tcms-msg ok'; msgEl.textContent = 'Copied.'; } }
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
  var er = document.getElementById('gmEraser'); if (er) { er.setAttribute('aria-pressed', S.eraser ? 'true' : 'false'); er.classList.toggle('tcms-btn--primary', S.eraser); }
  renderBoard(); renderPalette(); renderMini(); sceneCheck();
  renderScriptList(); renderScriptPreview(); renderFiles(); renderExport();
  persist();
}
function setExample() {
  S.grid = new Array(W * H).fill(null);
  S.grid[3 * W + 0] = 'box';
  S.grid[3 * W + 1] = 'box';
  S.grid[2 * W + 2] = 'cylinder';
  S.grid[1 * W + 3] = 'sphere';
  S.grid[2 * W + 4] = 'cone';
  S.grid[0 * W + 5] = 'pyramid';
  renderAll();
  var msg = document.getElementById('gmMsg'); if (msg) { msg.className = 'tcms-msg ok'; msg.textContent = 'Example model loaded. Click 5. Download your model when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little 3D model maker. In a few steps you will lay out shapes, add model steps, write your STL and download a real 3D model you can import into TinkerCAD or print.' },
  { t: '1. Lay out a model', b: 'Pick a shape and click grid squares. Add a Box, a Cylinder or a Sphere. The grid is a bird\'s eye view.' },
  { t: '2. Add steps', b: 'Tick the model steps you want, like Sit flat or Add a base. The Studio applies each one for you.' },
  { t: '3. Name your model', b: 'Give your model a name and check the ready list. The Studio fills in model.stl for you.' },
  { t: '4. Fix the log', b: 'Real models have small problems. Practise reading the log and choosing the fix, the same skill you use when a print fails.' },
  { t: '5. Download', b: 'Download the zip, then import model.stl into TinkerCAD or a slicer. Ask a grown-up before printing.' }
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
    var text = buildSTL();
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
window.TCD_buildSTL = buildSTL;
window.TCD_triangles = function () { return triangleCount(); };
window.TCD_methodNames = function () { return scriptFiles().map(function (f) { return f.file; }); };

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
