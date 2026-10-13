(function () {
'use strict';

var KEY = 'jvds-mugen-mod-studio-v1';
var S = {
  cName: 'MyFighter', cDisplay: 'My Fighter', cAuthor: 'Your Name', cVersion: '1.1',
  sName: 'My Stage', sAuthor: 'Your Name', sMusic: 'sound/MyStage.mp3',
  sZoffset: 200, sLeft: -200, sRight: 200
};

function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function slug(s, fb) { var out = String(s || '').replace(/[^A-Za-z0-9_]/g, ''); return out || fb; }
function pretty2(o) { return JSON.stringify(o, null, 2); }

function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function restore() {
  try { var raw = localStorage.getItem(KEY); if (!raw) return; var s = JSON.parse(raw); for (var k in S) { if (s[k] !== undefined && s[k] !== null) S[k] = s[k]; } } catch (e) {}
}

/* ---------- fighter def ---------- */
function charFolder() { return slug(S.cName, 'MyFighter'); }
function charDef() {
  var f = charFolder();
  return '[Info]\n' +
    'name = "' + S.cDisplay + '"\n' +
    'displayname = "' + S.cDisplay + '"\n' +
    'versiondate = 01,01,2026\n' +
    'mugenversion = ' + S.cVersion + '\n' +
    'author = "' + S.cAuthor + '"\n' +
    'pal.defaults = 1,2,3,4,5,6\n\n' +
    '[Files]\n' +
    'cmd = ' + f + '.cmd\n' +
    'cns = ' + f + '.cns\n' +
    'st = ' + f + '.cns\n' +
    'stcommon = common1.cns\n' +
    'sprite = ' + f + '.sff\n' +
    'anim = ' + f + '.air\n' +
    'sound = ' + f + '.snd\n' +
    'pal1 = ' + f + '.act\n\n' +
    '[Arcade]\n' +
    'intro.storyboard =\n' +
    'ending.storyboard =\n';
}
function cmdStub() {
  return '[Remap]\n' +
    'x = x\ny = y\nz = z\na = a\nb = b\nc = c\ns = s\n\n' +
    '[Defaults]\n' +
    'command.time = 15\n' +
    'command.buffer.time = 1\n\n' +
    '[Command]\nname = "holdfwd"\ncommand = /$F\ntime = 1\n\n' +
    '[Command]\nname = "holdback"\ncommand = /$B\ntime = 1\n\n' +
    '[Command]\nname = "holdup"\ncommand = /$U\ntime = 1\n\n' +
    '[Command]\nname = "holddown"\ncommand = /$D\ntime = 1\n\n' +
    '[Command]\nname = "x"\ncommand = x\ntime = 1\n';
}
function airStub() {
  return '; Animations (.air)\n' +
    '; Each animation starts with [Begin Action N]\n' +
    '[Begin Action 0]\n' +
    'Clsn2Default: 1\n' +
    ' Clsn2[0] = -20,-90, 20,-1\n' +
    '0,0, 0,0, 5\n' +
    '0,1, 0,0, 5\n';
}
function cnsStub() {
  return '; Constants (.cns)\n' +
    '[Data]\n' +
    'life = 1000\nattack = 100\ndefence = 100\n\n' +
    '[Size]\n' +
    'xscale = 1\nyscale = 1\n' +
    'ground.back = 15\nground.front = 16\n' +
    'air.back = 12\nair.front = 12\n' +
    'height = 60\n' +
    'head.pos = -5,-90\nmid.pos = -5,-60\nshadowoffset = 0\n\n' +
    '[Velocity]\n' +
    'walk.fwd = 2.4\nwalk.back = -2.2\nrun.fwd = 4.6,0\n\n' +
    '[Statedef -1]\n' +
    '; Your state code goes here.\n';
}

/* ---------- stage def ---------- */
function stageFolder() { return slug(S.sName, 'MyStage'); }
function stageDef() {
  var f = stageFolder();
  var z = parseInt(S.sZoffset, 10); if (isNaN(z)) z = 200;
  var l = parseInt(S.sLeft, 10); if (isNaN(l)) l = -200;
  var r = parseInt(S.sRight, 10); if (isNaN(r)) r = 200;
  return '[Info]\n' +
    'name = "' + S.sName + '"\n' +
    'displayname = "' + S.sName + '"\n' +
    'versiondate = 01,01,2026\n' +
    'mugenversion = ' + S.cVersion + '\n' +
    'author = "' + S.sAuthor + '"\n\n' +
    '[Camera]\n' +
    'startx = 0\nstarty = 0\n' +
    'boundleft = ' + l + '\n' +
    'boundright = ' + r + '\n' +
    'boundhigh = -180\nboundlow = 0\n' +
    'verticalfollow = .2\ntension = 60\n\n' +
    '[PlayerInfo]\n' +
    'p1startx = -70\np1starty = 0\np1facing = 1\n' +
    'p2startx = 70\np2starty = 0\np2facing = -1\n' +
    'leftbound = -1000\nrightbound = 1000\n\n' +
    '[Bound]\n' +
    'screenleft = 15\nscreenright = 15\n\n' +
    '[StageInfo]\n' +
    'zoffset = ' + z + '\n' +
    'autoturn = 1\nresetBG = 0\nlocalcoord = 320,240\n\n' +
    '[Scaling]\n' +
    'topz = 0\nbotz = 50\ntopscale = 1\nbotscale = 1.2\n\n' +
    '[Shadow]\n' +
    'color = 0,0,0\nintensity = 128\nyscale = -0.2\n\n' +
    '[Music]\n' +
    'bgmusic = ' + S.sMusic + '\n' +
    'bgvolume = 255\n\n' +
    '[BGdef]\n' +
    'spr = stages/' + f + '.sff\n' +
    'debugbg = 0\n';
}

/* ---------- render ---------- */
function syncInputs() {
  var map = { cName: 'cName', cDisplay: 'cDisplay', cAuthor: 'cAuthor', cVersion: 'cVersion', sName: 'sName', sAuthor: 'sAuthor', sMusic: 'sMusic', sZoffset: 'sZoffset', sLeft: 'sLeft', sRight: 'sRight' };
  Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el && String(el.value) !== String(S[id])) el.value = S[id]; });
}
function renderChar() {
  var pre = document.getElementById('cDefPreview'); if (pre) pre.textContent = charDef();
  var n = document.getElementById('cDefName'); if (n) n.textContent = charFolder() + '.def';
}
function renderStage() {
  var pre = document.getElementById('sDefPreview'); if (pre) pre.textContent = stageDef();
  var n = document.getElementById('sDefName'); if (n) n.textContent = stageFolder() + '.def';
  drawStage();
}
function renderFiles() {
  var pre = document.getElementById('filesPreview'); if (!pre) return;
  var cf = charFolder(), sf = stageFolder();
  pre.textContent =
    '# chars/' + cf + '/' + cf + '.def\n' + charDef() +
    '\n# chars/' + cf + '/' + cf + '.cmd\n' + cmdStub() +
    '\n# chars/' + cf + '/' + cf + '.cns\n' + cnsStub() +
    '\n# chars/' + cf + '/' + cf + '.air\n' + airStub() +
    '\n# stages/' + sf + '/' + sf + '.def\n' + stageDef();
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('mgnChecklist'); if (!ul) return;
  var checks = [
    ['Fighter file name has no spaces', /^[A-Za-z0-9_]+$/.test(charFolder())],
    ['Fighter def lists a cmd, cns, sprite, anim and sound', true],
    ['Stage name has no spaces', /^[A-Za-z0-9_]+$/.test(slug(S.sName, ''))],
    ['Stage def sets a floor height and camera bounds', !isNaN(parseInt(S.sZoffset, 10))]
  ];
  ul.innerHTML = '';
  checks.forEach(function (c) { var li = document.createElement('li'); li.className = c[1] ? 'done' : ''; li.textContent = c[0]; ul.appendChild(li); });
}

/* ---------- stage canvas ---------- */
function drawStage() {
  var cv = document.getElementById('sCanvas'); if (!cv) return;
  var ctx = cv.getContext('2d'); var W = cv.width, H = cv.height;
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1030'); g.addColorStop(0.6, '#3a1a4a'); g.addColorStop(0.6, '#5a2020'); g.addColorStop(1, '#2a1010');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  /* floor */
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(0, H * 0.62, W, H * 0.38);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  for (var x = 0; x < W; x += 24) ctx.fillRect(x, H * 0.62, 12, 4);
  /* camera bound markers */
  var l = parseInt(S.sLeft, 10) || -200, r = parseInt(S.sRight, 10) || 200;
  var span = Math.max(200, r - l);
  var lx = (l - l) / span * W; var rx = (r - l) / span * W;
  ctx.strokeStyle = 'rgba(242,165,65,.6)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx, H - 10); ctx.moveTo(rx, 10); ctx.lineTo(rx, H - 10); ctx.stroke();
  ctx.setLineDash([]);
  /* two fighters */
  function fighter(x, dir, col) {
    var y = H * 0.62;
    ctx.fillStyle = col;
    ctx.fillRect(x - 10, y - 54, 20, 40);
    ctx.fillStyle = '#f0c9a0'; ctx.fillRect(x - 8, y - 74, 16, 18);
    ctx.fillStyle = col; ctx.fillRect(x - 12 + (dir > 0 ? 16 : -8), y - 46, 8, 26);
  }
  fighter(W * 0.36, 1, '#d32f2f');
  fighter(W * 0.64, -1, '#3f6fd8');
  /* floor label */
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '12px monospace';
  ctx.fillText('floor zoffset ' + (parseInt(S.sZoffset, 10) || 200), 10, H - 10);
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.mgnms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.mgnms-panel'), function (p) { p.classList.toggle('is-active', p.id === 'panel-' + name); });
  if (name === 'stage') drawStage();
  if (name === 'export') renderExport();
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.mgnms-tab'));
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
    log: ['[MUGEN] Loading character...', '[MUGEN] Error detecting def file in chars/MyFighter/'],
    q: 'Your fighter never shows on the select screen. What is the fix?',
    opts: [
      { t: 'The character folder needs a .def file whose name matches the folder (chars/MyFighter/MyFighter.def).', ok: true },
      { t: 'Rename the folder to mods.' },
      { t: 'Put the character in the stages folder.' }
    ]
  },
  {
    log: ['[MUGEN] Loading MyFighter.def', '[MUGEN] Warning: cannot open file MyFighter.air', '[MUGEN] Error: could not load animations'],
    q: 'The character loads but the log says a file cannot be opened. What is the fix?',
    opts: [
      { t: 'The .air file listed in [Files] is missing or the name does not match the file in the folder.', ok: true },
      { t: 'Delete the [Files] section.' },
      { t: 'MUGEN does not use .air files.' }
    ]
  },
  {
    log: ['[MUGEN] Loading character...', '[MUGEN] Character loaded, 0 commands'],
    q: 'Your fighter loads but stands still and cannot attack. Why?',
    opts: [
      { t: 'The .cmd file is missing or its [Command] entries do not match the triggers in your state code.', ok: true },
      { t: 'Fighters cannot move in MUGEN.' },
      { t: 'You need to pay for a licence.' }
    ]
  },
  {
    log: ['[MUGEN] Loading stage...', '[MUGEN] Error: could not open sprite file stages/MyStage.sff'],
    q: 'The stage screen is black. What is the fix?',
    opts: [
      { t: 'The sprite path in [BGdef] (spr =) is wrong, or the .sff file is not next to the stage def.', ok: true },
      { t: 'Turn your monitor on.' },
      { t: 'Stages need an internet connection.' }
    ]
  },
  {
    log: ['[MUGEN] Loading character...', '[MUGEN] Error: mugenversion is missing in [Info]'],
    q: 'The engine refuses to load the def. Why?',
    opts: [
      { t: 'The [Info] section must include mugenversion (for example 1.1) so the engine knows which format to use.', ok: true },
      { t: 'mugenversion belongs in the .sff file only.' },
      { t: 'Remove the whole [Info] section.' }
    ]
  }
];
var dbgIndex = 0;
function renderDebug() {
  var logEl = document.getElementById('dbgLog'); if (!logEl) return;
  var sc = SCENARIOS[dbgIndex];
  logEl.innerHTML = '';
  sc.log.forEach(function (line) {
    var el = document.createElement('span');
    var isErr = /Error|Warning|refuses|black|stands still/i.test(line);
    el.className = 'line' + (isErr ? ' err' : '');
    el.textContent = line;
    if (isErr) el.addEventListener('click', openOptions);
    logEl.appendChild(el);
  });
  var opts = document.getElementById('dbgOptions'); opts.innerHTML = '';
  var msg = document.getElementById('dbgMsg'); msg.className = 'mgnms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('dbgNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('dbgOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = (sc.correct === 0) ? 0 : sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mgnms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('dbgMsg'); msg.className = 'mgnms-msg ok'; msg.textContent = 'Correct. That is exactly what the log is telling you.';
        document.getElementById('dbgNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
        award(15, 'debug-' + dbgIndex);
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('dbgMsg'); m2.className = 'mgnms-msg bad'; m2.textContent = 'Not quite. Read the log line again and try another fix.';
      }
    });
    opts.appendChild(b);
  });
}

/* ---------- export ---------- */
function renderExport() {
  var tree = document.getElementById('xTree');
  var cf = charFolder(), sf = stageFolder();
  if (tree) {
    tree.textContent = 'my-mugen-mod.zip\n' +
      '├── chars/\n' +
      '│   └── ' + cf + '/\n' +
      '│       ├── ' + cf + '.def\n' +
      '│       ├── ' + cf + '.cmd\n' +
      '│       ├── ' + cf + '.cns\n' +
      '│       └── ' + cf + '.air\n' +
      '├── stages/\n' +
      '│   └── ' + sf + '/\n' +
      '│       └── ' + sf + '.def\n' +
      '└── README.txt\n';
  }
  var ul = document.getElementById('xCheck'); if (ul) {
    var checks = [
      ['Fighter def ready', /^[A-Za-z0-9_]+$/.test(cf)],
      ['Stage def ready', /^[A-Za-z0-9_]+$/.test(sf)],
      ['Starter .cmd, .cns and .air included', true]
    ];
    ul.innerHTML = '';
    checks.forEach(function (c) { var li = document.createElement('li'); li.className = c[1] ? 'done' : ''; li.textContent = c[0]; ul.appendChild(li); });
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
  var msg = document.getElementById('xMsg');
  try {
    var enc = new TextEncoder();
    var cf = charFolder(), sf = stageFolder();
    var readme = 'A MUGEN character and stage made in the JVDesignStudio MUGEN Mod Studio.\n\n' +
      'HOW TO USE IT:\n' +
      '1. Unzip so the ' + cf + ' folder goes inside MUGEN/chars/ and the ' + sf + ' folder goes inside MUGEN/stages/.\n' +
      '2. Open MUGEN, then go to the select screen and pick ' + cf + '.\n' +
      '3. The .cmd, .cns and .air files are starter stubs. Swap in your own art (.sff) and moves when you are ready.\n\n' +
      'Full guide: https://jvdesignstudio.co.uk/workshops/mugen-world-workshop.html\n';
    var files = [
      { name: 'chars/' + cf + '/' + cf + '.def', data: enc.encode(charDef()) },
      { name: 'chars/' + cf + '/' + cf + '.cmd', data: enc.encode(cmdStub()) },
      { name: 'chars/' + cf + '/' + cf + '.cns', data: enc.encode(cnsStub()) },
      { name: 'chars/' + cf + '/' + cf + '.air', data: enc.encode(airStub()) },
      { name: 'stages/' + sf + '/' + sf + '.def', data: enc.encode(stageDef()) },
      { name: 'README.txt', data: enc.encode(readme) }
    ];
    var blob = new Blob([makeZip(files)], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-mugen-mod.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { localStorage.setItem('jvds_tool_export_mugen-mod-studio', String(parseInt(localStorage.getItem('jvds_tool_export_mugen-mod-studio') || '0', 10) + 1)); } catch (e) {}
    award(25, 'export');
    msg.className = 'mgnms-msg ok'; msg.textContent = 'Downloaded my-mugen-mod.zip. Unzip the chars and stages folders into MUGEN.';
  } catch (e) { msg.className = 'mgnms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}
function award(amount, onceKey) {
  try { var k = 'jvds-mgnxp-' + onceKey; if (localStorage.getItem(k)) return; localStorage.setItem('jvds-mugen-studio-xp', String(parseInt(localStorage.getItem('jvds-mugen-studio-xp') || '0', 10) + amount)); localStorage.setItem(k, '1'); } catch (e) {}
}
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'mgnms-msg ok'; msgEl.textContent = 'Copied.'; } }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); }); }
  else fallback(text, done);
}
function fallback(text, done) { try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {} }

/* ---------- render all ---------- */
function renderAll() { syncInputs(); renderChar(); renderStage(); renderFiles(); renderExport(); persist(); }

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little MUGEN maker. In a few steps you will fill in a fighter and a stage, read a broken log and download a real mod.' },
  { t: '1. Fighter def', b: 'The def file is the one the engine reads first. It points at the cmd, cns, sprite, anim and sound files by name.' },
  { t: '2. Stage def', b: 'A stage needs a floor height and camera bounds. Move the bounds and watch the preview markers move with them.' },
  { t: '3. Your files', b: 'The Studio writes starter versions of every file so the engine can find them. That is the shape of a real character folder.' },
  { t: '4. Fix the log', b: 'MUGEN errors are usually a wrong file name or a missing section. Practise reading the log, the same skill you need in the real engine.' },
  { t: '5. Download it', b: 'Grab the zip, unzip the chars and stages folders into MUGEN, and pick your fighter on the select screen.' }
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
document.getElementById('tab-fighter');
['cName', 'cDisplay', 'cAuthor', 'cVersion'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('input', function () { S[id] = this.value; renderAll(); }); if (el) el.addEventListener('change', function () { S[id] = this.value; renderAll(); }); });
['sName', 'sAuthor', 'sMusic', 'sZoffset', 'sLeft', 'sRight'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('input', function () { S[id] = this.value; renderAll(); }); });
document.getElementById('cDefCopy').addEventListener('click', function () { copyText(charDef(), document.getElementById('cDefMsg')); });
document.getElementById('sDefCopy').addEventListener('click', function () { copyText(stageDef(), document.getElementById('sDefMsg')); });
document.getElementById('filesCopy').addEventListener('click', function () {
  var cf = charFolder(), sf = stageFolder();
  var out = '--- chars/' + cf + '/' + cf + '.def ---\n' + charDef() +
    '\n--- chars/' + cf + '/' + cf + '.cmd ---\n' + cmdStub() +
    '\n--- chars/' + cf + '/' + cf + '.cns ---\n' + cnsStub() +
    '\n--- chars/' + cf + '/' + cf + '.air ---\n' + airStub() +
    '\n--- stages/' + sf + '/' + sf + '.def ---\n' + stageDef();
  copyText(out, document.getElementById('filesMsg'));
});
document.getElementById('dbgNext').addEventListener('click', function () { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); });
document.getElementById('xDownload').addEventListener('click', download);
document.getElementById('tourBtn').addEventListener('click', function () { showTab('fighter'); showTour(0); });
document.getElementById('tourNext').addEventListener('click', function () { if (tourIdx < TOUR.length - 1) showTour(tourIdx + 1); else hideTour(); });
document.getElementById('tourSkip').addEventListener('click', hideTour);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var ov = document.getElementById('tourOverlay'); if (ov && !ov.hidden) hideTour(); } });
})();
