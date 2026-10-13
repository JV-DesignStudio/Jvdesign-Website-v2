(function () {
'use strict';

var W = 6, H = 4;

var PARTS = [
  { id: 'grass', n: 'Grass Platform', e: '🟩', c: [0.36, 0.66, 0.23], mat: 'Grass', kind: 'platform' },
  { id: 'stone', n: 'Stone Platform', e: '⬜', c: [0.55, 0.55, 0.57], mat: 'Concrete', kind: 'platform' },
  { id: 'wood', n: 'Wood Platform', e: '🟫', c: [0.55, 0.36, 0.18], mat: 'WoodPlanks', kind: 'platform' },
  { id: 'neon', n: 'Neon Platform', e: '🟦', c: [0.20, 0.70, 1.00], mat: 'Neon', kind: 'platform' },
  { id: 'spawn', n: 'Spawn Pad', e: '🚩', c: [0.20, 0.90, 0.40], mat: 'SmoothPlastic', kind: 'spawn' },
  { id: 'checkpoint', n: 'Checkpoint', e: '✅', c: [1.00, 0.80, 0.20], mat: 'Neon', kind: 'checkpoint' },
  { id: 'coin', n: 'Coin', e: '🪙', c: [1.00, 0.84, 0.20], mat: 'Metal', kind: 'coin' },
  { id: 'speed', n: 'Speed Pad', e: '⚡', c: [0.10, 0.90, 0.90], mat: 'Neon', kind: 'speed' },
  { id: 'kill', n: 'Lava / Kill Brick', e: '🔥', c: [0.90, 0.20, 0.15], mat: 'Neon', kind: 'kill' },
  { id: 'finish', n: 'Finish Pad', e: '🏁', c: [0.60, 0.30, 0.90], mat: 'Neon', kind: 'finish' }
];
var BY_ID = {};
PARTS.forEach(function (p) { BY_ID[p.id] = p; });
function part(id) { return BY_ID[id] || null; }

var SCRIPTS = [
  {
    k: 'kill', n: 'Kill brick', desc: 'Touching a kill brick sends the player back to spawn.',
    code: [
      '-- Kill brick: touching it sends you back to spawn',
      'for _, part in ipairs(workspace:GetDescendants()) do',
      '  if part:IsA("BasePart") and part.Name:find("Kill") then',
      '    part.Touched:Connect(function(hit)',
      '      local humanoid = hit.Parent and hit.Parent:FindFirstChildOfClass("Humanoid")',
      '      if humanoid then humanoid.Health = 0 end',
      '    end)',
      '  end',
      'end'
    ].join('\n')
  },
  {
    k: 'checkpoint', n: 'Checkpoint', desc: 'Touching a checkpoint moves your spawn so you do not restart the whole obby.',
    code: [
      '-- Checkpoint: touching it moves your spawn here',
      'local spawnPad = workspace:FindFirstChild("Spawn")',
      'for _, part in ipairs(workspace:GetDescendants()) do',
      '  if part:IsA("BasePart") and part.Name:find("Checkpoint") then',
      '    part.Touched:Connect(function(hit)',
      '      local player = game.Players:GetPlayerFromCharacter(hit.Parent)',
      '      if player and spawnPad then',
      '        spawnPad.CFrame = part.CFrame + Vector3.new(0, 4, 0)',
      '      end',
      '    end)',
      '  end',
      'end'
    ].join('\n')
  },
  {
    k: 'coin', n: 'Coin collect', desc: 'Touching a coin adds to your score and the coin disappears.',
    code: [
      '-- Coin: collect it for a point, then it vanishes',
      'local coins = 0',
      'for _, part in ipairs(workspace:GetDescendants()) do',
      '  if part:IsA("BasePart") and part.Name:find("Coin") then',
      '    local taken = false',
      '    part.Touched:Connect(function(hit)',
      '      if taken then return end',
      '      if game.Players:GetPlayerFromCharacter(hit.Parent) then',
      '        taken = true',
      '        coins = coins + 1',
      '        print("Coins: " .. coins)',
      '        part:Destroy()',
      '      end',
      '    end)',
      '  end',
      'end'
    ].join('\n')
  },
  {
    k: 'speed', n: 'Speed pad', desc: 'Touching a speed pad gives you a short burst of speed.',
    code: [
      '-- Speed pad: touching it gives a short speed boost',
      'for _, part in ipairs(workspace:GetDescendants()) do',
      '  if part:IsA("BasePart") and part.Name:find("Speed") then',
      '    part.Touched:Connect(function(hit)',
      '      local humanoid = hit.Parent and hit.Parent:FindFirstChildOfClass("Humanoid")',
      '      if humanoid then',
      '        humanoid.WalkSpeed = 32',
      '        task.wait(3)',
      '        humanoid.WalkSpeed = 16',
      '      end',
      '    end)',
      '  end',
      'end'
    ].join('\n')
  },
  {
    k: 'win', n: 'Win pad', desc: 'Reaching the finish pad prints a congratulations in the Output window.',
    code: [
      '-- Win pad: show a message when you reach the end',
      'for _, part in ipairs(workspace:GetDescendants()) do',
      '  if part:IsA("BasePart") and part.Name:find("Finish") then',
      '    part.Touched:Connect(function(hit)',
      '      local player = game.Players:GetPlayerFromCharacter(hit.Parent)',
      '      if player then',
      '        print(player.Name .. " finished the obby!")',
      '      end',
      '    end)',
      '  end',
      'end'
    ].join('\n')
  }
];
var SCRIPT_BY_K = {};
SCRIPTS.forEach(function (s) { SCRIPT_BY_K[s.k] = s; });

var S = {
  grid: new Array(W * H).fill(null),
  active: 'grass',
  eraser: false,
  level: 'My First Obby',
  author: '',
  scripts: { kill: true, win: true }
};

var KEY = 'jvds-roblox-mod-studio-v1';
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
    var k = 'jvds-robloxxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-roblox-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-roblox-studio-xp', String(tot));
    localStorage.setItem(k, '1');
  } catch (e) {}
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- persist ---------- */
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({
    grid: S.grid, active: S.active, level: S.level, author: S.author, scripts: S.scripts
  })); } catch (e) {}
}
function restore() {
  try {
    var raw = localStorage.getItem(KEY); if (!raw) return;
    var s = JSON.parse(raw);
    if (Array.isArray(s.grid) && s.grid.length === W * H) S.grid = s.grid;
    if (s.active && part(s.active)) S.active = s.active;
    if (typeof s.level === 'string') S.level = s.level;
    if (typeof s.author === 'string') S.author = s.author;
    if (s.scripts && typeof s.scripts === 'object') S.scripts = s.scripts;
  } catch (e) {}
}

/* ---------- model build ---------- */
function slug(s, fb) { var out = String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''); return out || fb; }
function num(n) { return Number(n).toFixed(4); }
function sizeFor(id) {
  var p = part(id);
  if (!p) return [4, 1, 4];
  if (p.kind === 'coin') return [2, 2, 2];
  if (p.kind === 'spawn') return [6, 1, 6];
  return [4, 1, 4];
}
function placedParts() {
  var out = [];
  for (var i = 0; i < S.grid.length; i++) {
    var id = S.grid[i];
    if (!id || !part(id)) continue;
    var col = i % W, row = Math.floor(i / W);
    var x = (col - (W - 1) / 2) * 4;
    var z = (row - (H - 1) / 2) * 4;
    var sz = sizeFor(id);
    var y = (BY_ID[id].kind === 'coin') ? 3 : sz[1] / 2;
    out.push({ id: id, p: BY_ID[id], name: BY_ID[id].n + ' ' + (out.length + 1), x: x, y: y, z: z, size: sz });
  }
  return out;
}
function buildRbxm() {
  var parts = placedParts();
  var xml = ['<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'];
  xml.push('  <Meta name="ExplicitAutoJoints">true</Meta>');
  xml.push('  <Item class="Model" referent="RBXROOT">');
  xml.push('    <Properties>');
  xml.push('      <string name="Name">' + esc(S.level || 'My Model') + '</string>');
  xml.push('    </Properties>');
  parts.forEach(function (pt, i) {
    var cls = pt.p.kind === 'spawn' ? 'SpawnLocation' : 'Part';
    xml.push('    <Item class="' + cls + '" referent="RBX' + i + '">');
    xml.push('      <Properties>');
    xml.push('        <string name="Name">' + esc(pt.name) + '</string>');
    xml.push('        <CoordinateFrame name="CFrame">');
    xml.push('          <X>' + num(pt.x) + '</X><Y>' + num(pt.y) + '</Y><Z>' + num(pt.z) + '</Z>');
    xml.push('          <R00>1</R00><R01>0</R01><R02>0</R02>');
    xml.push('          <R10>0</R10><R11>1</R11><R12>0</R12>');
    xml.push('          <R20>0</R20><R21>0</R21><R22>1</R22>');
    xml.push('        </CoordinateFrame>');
    xml.push('        <Vector3 name="Size"><X>' + pt.size[0] + '</X><Y>' + pt.size[1] + '</Y><Z>' + pt.size[2] + '</Z></Vector3>');
    xml.push('        <Color3 name="Color"><R>' + num(pt.p.c[0]) + '</R><G>' + num(pt.p.c[1]) + '</G><B>' + num(pt.p.c[2]) + '</B></Color3>');
    xml.push('        <string name="Material">' + pt.p.mat + '</string>');
    xml.push('        <bool name="Anchored">true</bool>');
    xml.push('        <bool name="CanCollide">' + (pt.p.kind === 'coin' ? 'false' : 'true') + '</bool>');
    xml.push('      </Properties>');
    xml.push('    </Item>');
  });
  xml.push('  </Item>');
  xml.push('</roblox>');
  return xml.join('\n');
}
function scriptFiles() {
  var out = [];
  SCRIPTS.forEach(function (s) { if (S.scripts[s.k]) out.push({ name: s.n + '.lua', file: slug(s.n, s.k) + '.lua', code: s.code }); });
  return out;
}

/* ---------- render level ---------- */
function renderBoard() {
  var g = document.getElementById('rbBoard'); if (!g) return;
  g.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  g.innerHTML = '';
  S.grid.forEach(function (cell, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rbxs-cell' + (cell ? ' is-filled' : '');
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
  var p = document.getElementById('rbPalette'); if (!p) return;
  p.innerHTML = '';
  PARTS.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rbxs-swatch' + (!S.eraser && S.active === it.id ? ' is-active' : '');
    b.title = it.n; b.setAttribute('aria-label', it.n);
    b.innerHTML = '<span class="rbxs-swatch-emoji">' + it.e + '</span><span class="rbxs-swatch-name">' + it.n + '</span>';
    b.style.borderColor = 'rgba(0,0,0,.2)';
    b.addEventListener('click', function () { S.active = it.id; S.eraser = false; renderAll(); });
    p.appendChild(b);
  });
}
function renderMini() {
  var m = document.getElementById('rbMini'); if (!m) return;
  m.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  m.innerHTML = '';
  S.grid.forEach(function (cell) {
    var d = document.createElement('span');
    d.className = 'rbxs-mini-cell';
    if (cell && part(cell)) {
      var mpc = part(cell).c;
      d.textContent = part(cell).e;
      d.style.background = 'rgba(' + Math.round(mpc[0] * 255) + ',' + Math.round(mpc[1] * 255) + ',' + Math.round(mpc[2] * 255) + ',.22)';
    }
    m.appendChild(d);
  });
}
function levelCounts() {
  var n = {}; S.grid.forEach(function (c) { if (c) n[c] = (n[c] || 0) + 1; }); return n;
}
function renderLevelCheck() {
  var ul = document.getElementById('rbLevelCheck'); if (!ul) return;
  var c = levelCounts();
  var has = function (k) { return !!c[k]; };
  var checks = [
    ['A floor of platforms (grass, stone, wood or neon)', (c.grass || 0) + (c.stone || 0) + (c.wood || 0) + (c.neon || 0) > 0],
    ['A spawn pad to start on', has('spawn')],
    ['A finish pad to reach', has('finish')],
    ['At least 4 blocks placed', Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0) >= 4]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) {
    var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li);
  });
}

/* ---------- render scripts ---------- */
function renderScriptList() {
  var box = document.getElementById('rbScriptList'); if (!box) return;
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
  var pre = document.getElementById('rbScriptPreview'); if (!pre) return;
  var files = scriptFiles();
  if (!files.length) { pre.textContent = '// Tick a script to write it.'; return; }
  pre.textContent = files.map(function (f) { return '-- ' + f.name + '\n' + f.code; }).join('\n\n');
}

/* ---------- render files ---------- */
function renderFiles() {
  var pre = document.getElementById('rbFilesPreview'); if (!pre) return;
  var xml = buildRbxm().split('\n');
  var head = xml.slice(0, 26).join('\n');
  var more = xml.length > 26 ? '\n  ... (' + (xml.length - 26) + ' more lines, ' + placedParts().length + ' parts)' : '';
  pre.textContent = head + more;
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('rbChecklist'); if (!ul) return;
  var c = levelCounts();
  var parts = placedParts().length;
  var checks = [
    ['The level name has no odd symbols', /^[\w \-.]+$/.test(S.level)],
    ['At least one block is placed', parts > 0],
    ['There is a spawn pad', !!c.spawn],
    ['There is a finish pad', !!c.finish],
    ['At least one script is ticked', scriptFiles().length > 0]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) {
    var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li);
  });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.rbxs-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.rbxs-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.rbxs-tab'));
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
      '[Output] Running Kill brick.lua',
      'Workspace.Kill Brick 3.Kill brick:5: attempt to index nil with \'FindFirstChildOfClass\''
    ],
    q: 'The kill brick errors on line 5. What is the fix?',
    opts: [
      { t: 'The touched part might not have a parent with a Humanoid. Check hit.Parent first: local humanoid = hit.Parent and hit.Parent:FindFirstChildOfClass("Humanoid").', ok: true },
      { t: 'Rename the script to KillBrick.lua.' },
      { t: 'Move the script into Workspace.' }
    ]
  },
  {
    log: [
      '[Output] Running Checkpoint.lua',
      'Infinite yield possible on \'Workspace:WaitForChild("Spawn")\''
    ],
    q: 'Roblox warns the script can wait forever. What is the fix?',
    opts: [
      { t: 'The script is waiting for a part named Spawn that does not exist. Add a Spawn Pad to your level, or check the name matches exactly.', ok: true },
      { t: 'Restart Roblox Studio and run it again.' },
      { t: 'Put the script inside the Spawn part.' }
    ]
  },
  {
    log: [
      '[Output] Running my script',
      'my script:3: attempt to call a nil value (global \'wait\')'
    ],
    q: 'The script uses an old function. What is the fix?',
    opts: [
      { t: 'wait() is old and often nil now. Use task.wait() instead.', ok: true },
      { t: 'Delete the wait() line, timing does not matter.' },
      { t: 'Add wait = true at the top of the script.' }
    ]
  },
  {
    log: [
      '[Output] ServerScriptService.Coin.lua',
      'ServerScriptService.Coin.lua:6: attempt to index nil with \'GetPlayerFromCharacter\''
    ],
    q: 'game.Players is nil when the script runs. What is the fix?',
    opts: [
      { t: 'Get the service first: local Players = game:GetService("Players"), then use Players:GetPlayerFromCharacter(...).', ok: true },
      { t: 'Players only exists in LocalScripts.' },
      { t: 'Type game.Players() with brackets.' }
    ]
  },
  {
    log: [
      '[Output] LocalScript in Workspace',
      'A LocalScript will only run when it is in a place where it can run (like StarterPlayerScripts)'
    ],
    q: 'Your LocalScript never runs. What is the fix?',
    opts: [
      { t: 'Move the LocalScript somewhere it runs, like StarterPlayerScripts or StarterGui. A plain Script goes in ServerScriptService.', ok: true },
      { t: 'Change every LocalScript into a ModuleScript.' },
      { t: 'LocalScripts only work in Roblox games, not Studio.' }
    ]
  }
];
var dbgIndex = 0;
function renderDebug() {
  var logEl = document.getElementById('rbLog'); if (!logEl) return;
  var sc = SCENARIOS[dbgIndex];
  logEl.innerHTML = '';
  sc.log.forEach(function (line) {
    var el = document.createElement('span');
    var isErr = /attempt|Infinite yield|only run|error/i.test(line) && !/^\[Output\]/.test(line);
    el.className = 'line' + (isErr ? ' err' : '');
    el.textContent = line;
    if (isErr) el.addEventListener('click', function () { openOptions(); });
    logEl.appendChild(el);
  });
  var opts = document.getElementById('rbOptions'); opts.innerHTML = '';
  var msg = document.getElementById('rbDebugMsg'); msg.className = 'rbxs-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('rbNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('rbOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'rbxs-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('rbDebugMsg'); msg.className = 'rbxs-msg ok'; msg.textContent = 'Correct. That is exactly what the Output is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('rbNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('rbDebugMsg'); m2.className = 'rbxs-msg bad'; m2.textContent = 'Not quite. Read the Output line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() {
  dbgIndex = (dbgIndex + 1) % SCENARIOS.length;
  renderDebug();
}

/* ---------- export ---------- */
function renderExport() {
  var tree = document.getElementById('rbExportTree');
  var folder = slug(S.level, 'my_model');
  if (tree) {
    var files = scriptFiles();
    var lines = [folder + '.zip', '└── ' + folder + '/', '    ├── ' + folder + '.rbxmx', '    ├── README.txt'];
    if (files.length) {
      lines.push('    └── Scripts/');
      files.forEach(function (f, i) { lines.push('        ' + (i === files.length - 1 ? '└── ' : '├── ') + f.file); });
    } else { lines.push('    └── (tick a script to add Lua files)'); }
    tree.textContent = lines.join('\n');
  }
  var ul = document.getElementById('rbExportCheck');
  if (ul) {
    var c = levelCounts();
    var checks = [
      ['Model will be included (.rbxmx)', placedParts().length > 0],
      ['Spawn pad placed', !!c.spawn],
      ['Finish pad placed', !!c.finish],
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
  var msg = document.getElementById('rbExportMsg');
  try {
    var enc = new TextEncoder();
    var folder = slug(S.level, 'my_model');
    if (placedParts().length === 0) { msg.className = 'rbxs-msg bad'; msg.textContent = 'Place at least one block on the grid first.'; showTab('level'); return; }
    var by = (S.author || '').trim();
    var readme = S.level + ' - a Roblox model made in the JVDesignStudio Roblox Mod Studio.\n' +
      (by ? 'Made by: ' + by + '\n' : '') + '\n' +
      'HOW TO USE IT (Roblox Studio, free at create.roblox.com):\n' +
      '1. Right-click Workspace and choose "Insert from File", then pick ' + folder + '.rbxmx\n' +
      '2. Put the Lua scripts in ServerScriptService (right-click it, Insert Object, Script, then paste).\n' +
      '3. Press Play to test, then publish when you are happy.\n\n' +
      'Full guide: https://jvdesignstudio.co.uk/workshops/my-first-roblox-studio-game.html\n';
    var files = [
      { name: folder + '/' + folder + '.rbxmx', data: enc.encode(buildRbxm() + '\n') },
      { name: folder + '/README.txt', data: enc.encode(readme) }
    ];
    scriptFiles().forEach(function (f) { files.push({ name: folder + '/Scripts/' + f.file, data: enc.encode(f.code + '\n') }); });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_roblox-mod-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_roblox-mod-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'rbxs-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Insert the .rbxmx into Roblox Studio.';
  } catch (e) { msg.className = 'rbxs-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'rbxs-msg ok'; msgEl.textContent = 'Copied.'; } }
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
  var ln = document.getElementById('rbLevelName'); if (ln && ln.value !== S.level) ln.value = S.level;
  var au = document.getElementById('rbAuthor'); if (au && au.value !== S.author) au.value = S.author;
  var er = document.getElementById('rbEraser'); if (er) { er.setAttribute('aria-pressed', S.eraser ? 'true' : 'false'); er.classList.toggle('rbxs-btn--primary', S.eraser); }
  renderBoard(); renderPalette(); renderMini(); renderLevelCheck();
  renderScriptList(); renderScriptPreview(); renderFiles(); renderExport();
  persist();
}
function setExample() {
  S.grid = new Array(W * H).fill(null);
  var place = function (col, row, id) { S.grid[row * W + col] = id; };
  place(0, 3, 'spawn');
  place(1, 3, 'grass'); place(2, 3, 'grass');
  place(2, 2, 'neon');
  place(2, 1, 'stone'); place(3, 1, 'stone');
  place(3, 0, 'checkpoint');
  place(4, 0, 'neon'); place(4, 1, 'kill');
  place(5, 0, 'coin'); place(5, 2, 'speed');
  place(5, 3, 'finish');
  S.level = S.level || 'My First Obby';
  renderAll();
  var msg = document.getElementById('rbMsg'); if (msg) { msg.className = 'rbxs-msg ok'; msg.textContent = 'Example level loaded. Click 5. Download your model when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little Roblox model maker. In a few steps you will lay out a level, add scripts, write your files and download a real .rbxmx model.' },
  { t: '1. Lay out a level', b: 'Pick a block and click grid squares. Add a Spawn Pad to start on and a Finish Pad to reach. The grid is a bird\'s eye view.' },
  { t: '2. Add scripts', b: 'Tick the Lua you want, like a kill brick or a coin. The Studio writes each script for you, ready for ServerScriptService.' },
  { t: '3. Name your files', b: 'Give your model a name and check the ready list. The Studio fills in the .rbxmx for you.' },
  { t: '4. Fix the log', b: 'Real scripts break in small ways. Practise reading the Output window and choosing the fix, the same skill you use in Roblox Studio.' },
  { t: '5. Download', b: 'Download the zip, insert the .rbxmx into Workspace and drop the scripts into ServerScriptService. Then press Play.' }
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
  ['rbLevelName', 'rbAuthor'].forEach(function (id) {
    var el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', function () {
      if (id === 'rbLevelName') S.level = el.value;
      if (id === 'rbAuthor') S.author = el.value;
      renderFiles(); renderExport(); persist();
    });
  });
  var er = document.getElementById('rbEraser'); if (er) er.addEventListener('click', function () { S.eraser = !S.eraser; if (S.eraser) S.eraser = true; renderAll(); });
  var cl = document.getElementById('rbClear'); if (cl) cl.addEventListener('click', function () { S.grid = new Array(W * H).fill(null); renderAll(); });
  var ex = document.getElementById('rbExample'); if (ex) ex.addEventListener('click', setExample);
  var copyBtn = document.getElementById('rbFilesCopy'); if (copyBtn) copyBtn.addEventListener('click', function () {
    var files = scriptFiles();
    var text = '# ' + slug(S.level, 'my_model') + '.rbxmx\n' + buildRbxm() + '\n\n' +
      files.map(function (f) { return '# Scripts/' + f.file + '\n' + f.code; }).join('\n\n');
    copyText(text, document.getElementById('rbFilesMsg'));
  });
  var dl = document.getElementById('rbDownload'); if (dl) dl.addEventListener('click', download);
  var nx = document.getElementById('rbNext'); if (nx) nx.addEventListener('click', nextProblem);
  var tb = document.getElementById('rbTourBtn'); if (tb) tb.addEventListener('click', openTour);
  var ts = document.getElementById('tourSkip'); if (ts) ts.addEventListener('click', closeTour);
  var tn = document.getElementById('tourNext'); if (tn) tn.addEventListener('click', function () { if (tourIndex === TOUR.length - 1) { closeTour(); } else { tourIndex++; renderTour(); } });
  var ov = document.getElementById('tourOverlay'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeTour(); });
  renderAll();
  renderDebug();
  try { if (!localStorage.getItem('jvds-roblox-studio-seen')) { localStorage.setItem('jvds-roblox-studio-seen', '1'); } } catch (e) {}
}

/* expose for tests */
window.RBXS_buildRbxm = buildRbxm;
window.RBXS_scriptNames = function () { return scriptFiles().map(function (f) { return f.file; }); };

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
