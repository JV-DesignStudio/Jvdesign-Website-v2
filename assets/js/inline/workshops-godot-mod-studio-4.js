(function () {
'use strict';

var W = 6, H = 4, CELL = 80;

var PARTS = [
  { id: 'player',   n: 'Player',   e: '🧍', c: [0.25, 0.60, 1.00], kind: 'player',   node: 'CharacterBody2D', script: 'player', size: 40 },
  { id: 'platform', n: 'Platform', e: '🟫', c: [0.45, 0.45, 0.52], kind: 'platform', node: 'StaticBody2D',    script: '',       size: 80 },
  { id: 'coin',     n: 'Coin',     e: '🟡', c: [1.00, 0.84, 0.20], kind: 'coin',     node: 'Area2D',          script: 'coin',   size: 28 },
  { id: 'enemy',    n: 'Enemy',    e: '👾', c: [0.90, 0.25, 0.25], kind: 'enemy',    node: 'Area2D',          script: 'enemy',  size: 36 },
  { id: 'spike',    n: 'Spike',    e: '🔺', c: [0.80, 0.30, 0.60], kind: 'spike',    node: 'Area2D',          script: 'spike',  size: 32 },
  { id: 'goal',     n: 'Goal',     e: '🏁', c: [0.20, 0.85, 0.40], kind: 'goal',     node: 'Area2D',          script: 'goal',   size: 44 }
];
var BY_ID = {};
PARTS.forEach(function (p) { BY_ID[p.id] = p; });
function part(id) { return BY_ID[id] || null; }

var SCRIPTS = [
  {
    k: 'player', n: 'Player move', desc: 'Move left and right, and jump, using the arrow keys.',
    code: [
      'extends CharacterBody2D',
      '',
      'const SPEED = 220.0',
      'const JUMP = -420.0',
      'var gravity = 980.0',
      '',
      'func _physics_process(delta):',
      '    if not is_on_floor():',
      '        velocity.y += gravity * delta',
      '    if Input.is_action_just_pressed("ui_accept") and is_on_floor():',
      '        velocity.y = JUMP',
      '    var dir = Input.get_axis("ui_left", "ui_right")',
      '    velocity.x = dir * SPEED',
      '    move_and_slide()'
    ].join('\n')
  },
  {
    k: 'coin', n: 'Coin collect', desc: 'Touching a coin adds to your score and the coin disappears.',
    code: [
      'extends Area2D',
      '',
      'var score = 0',
      '',
      'func _ready():',
      '    body_entered.connect(_on_body_entered)',
      '',
      'func _on_body_entered(body):',
      '    if body.name == "Player":',
      '        score += 1',
      '        print("Score: ", score)',
      '        queue_free()'
    ].join('\n')
  },
  {
    k: 'enemy', n: 'Enemy patrol', desc: 'An enemy that walks back and forth between two points.',
    code: [
      'extends Area2D',
      '',
      'var speed = 60.0',
      'var direction = 1',
      'var start_x = 0.0',
      '',
      'func _ready():',
      '    start_x = position.x',
      '    body_entered.connect(_on_body_entered)',
      '',
      'func _process(delta):',
      '    position.x += speed * direction * delta',
      '    if abs(position.x - start_x) > 120:',
      '        direction = -direction',
      '',
      'func _on_body_entered(body):',
      '    if body.name == "Player":',
      '        print("The enemy got you!")'
    ].join('\n')
  },
  {
    k: 'spike', n: 'Spike reset', desc: 'Touching a spike sends the player back to the start.',
    code: [
      'extends Area2D',
      '',
      'func _ready():',
      '    body_entered.connect(_on_body_entered)',
      '',
      'func _on_body_entered(body):',
      '    if body.name == "Player":',
      '        print("Ouch! Back to the start.")',
      '        body.position = Vector2(80, 300)'
    ].join('\n')
  },
  {
    k: 'goal', n: 'Goal check', desc: 'Reaching the goal prints a win message in the Output panel.',
    code: [
      'extends Area2D',
      '',
      'func _ready():',
      '    body_entered.connect(_on_body_entered)',
      '',
      'func _on_body_entered(body):',
      '    if body.name == "Player":',
      '        print("You reached the goal. Well done!")'
    ].join('\n')
  }
];
var SCRIPT_BY_K = {};
SCRIPTS.forEach(function (s) { SCRIPT_BY_K[s.k] = s; });

var S = {
  grid: new Array(W * H).fill(null),
  active: 'platform',
  eraser: false,
  project: 'My First Platformer',
  author: '',
  scripts: { player: true, coin: true, goal: true }
};

var KEY = 'jvds-godot-mod-studio-v1';
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
    var k = 'jvds-godotxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-godot-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-godot-studio-xp', String(tot));
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
var SCRIPT_IDS = { player: '1', coin: '2', enemy: '3', spike: '4', goal: '5' };
function buildProjectGodot() {
  return [
    '; Engine configuration file.',
    '; Made in the JVDesignStudio Godot Mod Studio.',
    'config_version=5',
    '',
    '[application]',
    '',
    'config/name="' + (S.project || 'My Game').replace(/"/g, '') + '"',
    'run/main_scene="res://Main.tscn"',
    'config/features=PackedStringArray("4.2")',
    '',
    '[rendering]',
    '',
    'renderer/rendering_method="gl_compatibility"'
  ].join('\n');
}
function buildScene() {
  var items = placedItems();
  var usedScripts = {};
  items.forEach(function (it) { if (it.p.script) usedScripts[it.p.script] = true; });
  var lines = ['[gd_scene format=3]', ''];
  Object.keys(usedScripts).forEach(function (k) {
    lines.push('[ext_resource type="Script" path="res://Scripts/' + k + '.gd" id="' + SCRIPT_IDS[k] + '"]');
  });
  if (Object.keys(usedScripts).length) lines.push('');
  lines.push('[sub_resource type="RectangleShape2D" id="Box_1"]');
  lines.push('size = Vector2(40, 40)');
  lines.push('');
  lines.push('[node name="Main" type="Node2D"]');
  lines.push('');
  var nameCount = {};
  items.forEach(function (it) {
    nameCount[it.p.n] = (nameCount[it.p.n] || 0) + 1;
    var nodeName = it.p.n + (nameCount[it.p.n] > 1 ? ' ' + nameCount[it.p.n] : '');
    var sz = it.p.size;
    lines.push('[node name="' + nodeName + '" type="' + it.p.node + '" parent="."]');
    lines.push('position = Vector2(' + it.x + ', ' + it.y + ')');
    if (it.p.script) lines.push('script = ExtResource("' + SCRIPT_IDS[it.p.script] + '")');
    lines.push('');
    lines.push('[node name="Shape" type="CollisionShape2D" parent="' + nodeName + '"]');
    lines.push('shape = SubResource("Box_1")');
    lines.push('');
    lines.push('[node name="Body" type="ColorRect" parent="' + nodeName + '"]');
    lines.push('offset_left = ' + (-sz / 2) + '.0');
    lines.push('offset_top = ' + (-sz / 2) + '.0');
    lines.push('offset_right = ' + (sz / 2) + '.0');
    lines.push('offset_bottom = ' + (sz / 2) + '.0');
    lines.push('color = ' + colorStr(it.p.c));
    lines.push('');
  });
  return lines.join('\n').replace(/\n+$/, '\n');
}
function scriptFiles() {
  var out = [];
  SCRIPTS.forEach(function (s) { if (S.scripts[s.k]) out.push({ name: s.n, file: s.k + '.gd', code: s.code }); });
  return out;
}

/* ---------- render scene ---------- */
function renderBoard() {
  var g = document.getElementById('gmBoard'); if (!g) return;
  g.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  g.innerHTML = '';
  S.grid.forEach(function (cell, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gms-cell' + (cell ? ' is-filled' : '');
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
    b.className = 'gms-swatch' + (!S.eraser && S.active === it.id ? ' is-active' : '');
    b.title = it.n; b.setAttribute('aria-label', it.n);
    b.innerHTML = '<span class="gms-swatch-emoji">' + it.e + '</span><span class="gms-swatch-name">' + it.n + '</span>';
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
    d.className = 'gms-mini-cell';
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
  if (!files.length) { pre.textContent = '# Tick a script to write it.'; return; }
  pre.textContent = files.map(function (f) { return '# Scripts/' + f.file + '\n' + f.code; }).join('\n\n');
}

/* ---------- render files ---------- */
function renderFiles() {
  var pre = document.getElementById('gmFilesPreview'); if (!pre) return;
  var scene = buildScene().split('\n');
  var head = scene.slice(0, 30).join('\n');
  var more = scene.length > 30 ? '\n... (' + (scene.length - 30) + ' more lines, ' + placedItems().length + ' objects)' : '';
  pre.textContent = head + more;
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
  [].forEach.call(document.querySelectorAll('.gms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.gms-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.gms-tab'));
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
      '[Output] Running Scripts/player.gd',
      'Invalid call. Nonexistent function "move_and_slide" in base "Node2D".'
    ],
    q: 'The player script errors on move_and_slide. What is the fix?',
    opts: [
      { t: 'The script must extend CharacterBody2D, not Node2D, for move_and_slide() to exist. Change the first line to extends CharacterBody2D.', ok: true },
      { t: 'Rename the function to move_and_slide().' },
      { t: 'Delete the gravity line.' }
    ]
  },
  {
    log: [
      '[Output] Running Scripts/coin.gd',
      'Parse Error: Identifier "score" not declared in the current scope.'
    ],
    q: 'GDScript says score is not declared. What is the fix?',
    opts: [
      { t: 'Add the variable at the top of the script: var score = 0, before you use it.', ok: true },
      { t: 'Put the score in quotes: "score".' },
      { t: 'Move the script into the scene root.' }
    ]
  },
  {
    log: [
      '[Output] Running Scripts/enemy.gd',
      'Invalid access to property or key "idle" on a base object of type "CharacterBody2D".'
    ],
    q: 'The enemy script cannot find something. What is the fix?',
    opts: [
      { t: 'Check your variable and property names match exactly. GDScript is case and spelling sensitive, so "idle" and "Idle" are different.', ok: true },
      { t: 'Godot needs a restart after every edit.' },
      { t: 'Add the keyword static to the property.' }
    ]
  },
  {
    log: [
      '[Output] Running Scripts/coin.gd',
      'Invalid get index "position" (on base: "null instance").'
    ],
    q: 'A node reference is null when the script runs. What is the fix?',
    opts: [
      { t: 'Get the node the right way, for example @onready var player = $Player, and check the node name matches the scene exactly.', ok: true },
      { t: 'Null means the coin was collected already.' },
      { t: 'Replace position with transform.' }
    ]
  },
  {
    log: [
      '[Output] Running Main.tscn',
      'E 0:00:03: Signal "body_entered" cannot be connected: the signal does not exist on this object.'
    ],
    q: 'The script tries to connect a signal that is missing. What is the fix?',
    opts: [
      { t: 'body_entered only exists on Area2D. Make sure the node is an Area2D (or use the matching signal for the node you have).', ok: true },
      { t: 'Signals only work in 3D games.' },
      { t: 'Write connect(body_entered) with no brackets.' }
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
  var msg = document.getElementById('gmDebugMsg'); msg.className = 'gms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('gmNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('gmOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'gms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('gmDebugMsg'); msg.className = 'gms-msg ok'; msg.textContent = 'Correct. That is exactly what the Output is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('gmNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('gmDebugMsg'); m2.className = 'gms-msg bad'; m2.textContent = 'Not quite. Read the Output line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); }

/* ---------- export ---------- */
function projectFiles() {
  var folder = slug(S.project, 'my_godot_game');
  var files = [
    { name: folder + '/project.godot', text: buildProjectGodot() + '\n' },
    { name: folder + '/Main.tscn', text: buildScene() }
  ];
  scriptFiles().forEach(function (f) { files.push({ name: folder + '/Scripts/' + f.file, text: f.code + '\n' }); });
  files.push({ name: folder + '/README.txt', text: readmeText(folder) });
  return files;
}
function readmeText(folder) {
  var by = (S.author || '').trim();
  return S.project + ' - a Godot project made in the JVDesignStudio Godot Mod Studio.\n' +
    (by ? 'Made by: ' + by + '\n' : '') + '\n' +
    'HOW TO OPEN IT (Godot is free at godotengine.org):\n' +
    '1. Install the free Godot 4 engine (ask a grown-up first).\n' +
    '2. Open Godot and choose Import, then pick the project.godot file in this folder.\n' +
    '3. Press F5 to run the scene. Try moving with the arrow keys.\n\n' +
    'Full guide: https://jvdesignstudio.co.uk/workshops/godot-world-workshop.html\n';
}
function renderExport() {
  var folder = slug(S.project, 'my_godot_game');
  var tree = document.getElementById('gmExportTree');
  if (tree) {
    var files = scriptFiles();
    var lines = [folder + '.zip', '└── ' + folder + '/', '    ├── project.godot', '    ├── Main.tscn', '    ├── README.txt'];
    if (files.length) { lines.push('    └── Scripts/'); files.forEach(function (f, i) { lines.push('        ' + (i === files.length - 1 ? '└── ' : '├── ') + f.file); }); }
    else { lines.push('    └── (tick a script to add GDScript)'); }
    tree.textContent = lines.join('\n');
  }
  var ul = document.getElementById('gmExportCheck');
  if (ul) {
    var c = counts();
    var checks = [
      ['project.godot will be included', true],
      ['Main.tscn scene will be included', placedItems().length > 0],
      ['A player node is placed', !!c.player],
      [scriptFiles().length ? scriptFiles().length + ' script(s) will be included' : 'No scripts yet (optional)', scriptFiles().length > 0]
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
    var folder = slug(S.project, 'my_godot_game');
    if (placedItems().length === 0) { msg.className = 'gms-msg bad'; msg.textContent = 'Place at least one object on the grid first.'; showTab('scene'); return; }
    var files = projectFiles().map(function (f) { return { name: f.name, data: enc.encode(f.text) }; });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_godot-mod-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_godot-mod-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'gms-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Open Godot and import project.godot.';
  } catch (e) { msg.className = 'gms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'gms-msg ok'; msgEl.textContent = 'Copied.'; } }
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
  var er = document.getElementById('gmEraser'); if (er) { er.setAttribute('aria-pressed', S.eraser ? 'true' : 'false'); er.classList.toggle('gms-btn--primary', S.eraser); }
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
  var msg = document.getElementById('gmMsg'); if (msg) { msg.className = 'gms-msg ok'; msg.textContent = 'Example scene loaded. Click 5. Download your project when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little Godot project maker. In a few steps you will lay out a scene, add GDScript, write your files and download a real Godot project.' },
  { t: '1. Lay out a scene', b: 'Pick an object and click grid squares. Add a Player to control and a Goal to reach. The grid is a bird\'s eye view.' },
  { t: '2. Add scripts', b: 'Tick the GDScript you want, like player movement or a coin. The Studio writes each script for you.' },
  { t: '3. Name your files', b: 'Give your project a name and check the ready list. The Studio fills in project.godot and Main.tscn for you.' },
  { t: '4. Fix the log', b: 'Real scripts break in small ways. Practise reading the Output panel and choosing the fix, the same skill you use in Godot.' },
  { t: '5. Download', b: 'Download the zip, then open Godot and import project.godot. Press F5 to run your game.' }
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
    var text = '# project.godot\n' + buildProjectGodot() + '\n\n# Main.tscn\n' + buildScene() + '\n\n' +
      files.map(function (f) { return '# Scripts/' + f.file + '\n' + f.code; }).join('\n\n');
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
window.GMS_buildScene = buildScene;
window.GMS_buildProject = buildProjectGodot;
window.GMS_scriptNames = function () { return scriptFiles().map(function (f) { return f.file; }); };

/* LiveEdit API: editable constants in generated scripts */
var EDITABLE = [
  { key: 'SPEED',   min: 50,  max: 800, def: 220 },
  { key: 'JUMP',    min: -800, max: -100, def: -420 },
  { key: 'gravity', min: 200, max: 2000, def: 980 },
  { key: 'speed',   min: 10,  max: 400,  def: 60 }
];
var editVals = {};
EDITABLE.forEach(function (e) { editVals[e.key] = e.def; });

function applyValsToScripts() {
  SCRIPTS.forEach(function (s) {
    var lines = s.code.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^(\s*(?:const |var )?)(SPEED|JUMP|gravity|speed)(\s*=\s*)(-?\d+(?:\.\d+)?)(.*)/);
      if (m && editVals.hasOwnProperty(m[2])) {
        lines[i] = m[1] + m[2] + m[3] + editVals[m[2]] + '.0' + (m[5] || '');
      }
    }
    s.code = lines.join('\n');
  });
}

window.JVDS_MOD_STUDIO = {
  getScriptCode: function () {
    var files = scriptFiles();
    if (!files.length) return '# Tick a script to write it.';
    return files.map(function (f) { return '# Scripts/' + f.file + '\n' + f.code; }).join('\n\n');
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
