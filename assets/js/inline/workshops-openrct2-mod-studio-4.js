(function () {
'use strict';

var KEY = 'jvds-openrct2-mod-studio-v1';
var S = {
  name: 'My Park Helper', folder: 'MyParkHelper', author: 'Your Name', version: '1.0',
  event: 'interval.day', msg: 'A new day in the park!',
  acts: { greet: true, cash: false, rating: false, guests: false, rides: false, rescue: false }
};
var ACTS = [
  { k: 'greet', label: 'Greet the park with a message', code: function () { return 'park.postMessage(' + JSON.stringify(S.msg) + ');'; } },
  { k: 'cash', label: 'Read the park cash', code: function () { return 'console.log("Cash: " + park.cash);'; } },
  { k: 'rating', label: 'Read the park rating', code: function () { return 'console.log("Rating: " + park.rating);'; } },
  { k: 'guests', label: 'Count the guests', code: function () { return 'console.log("Guests: " + map.getAllEntities("guest").length);'; } },
  { k: 'rides', label: 'Look at every ride', code: function () { return 'map.getAllEntities("ride").forEach(function (ride) {\n    console.log("Ride: " + ride.name);\n  });'; } },
  { k: 'rescue', label: 'Nudge guests out of the water', code: function () { return 'map.getAllEntities("guest").forEach(function (g) {\n    if (g.isInWater) { g.setCoordinates(g.x, g.y, 0); }\n  });'; } }
];

function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function slug(s, fb) { var out = String(s || '').replace(/[^A-Za-z0-9_]/g, ''); return out || fb; }

function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function restore() {
  try { var raw = localStorage.getItem(KEY); if (!raw) return; var s = JSON.parse(raw); for (var k in S) { if (s[k] !== undefined && s[k] !== null) S[k] = s[k]; } } catch (e) {}
}

function mainBody() {
  var lines = [];
  ACTS.forEach(function (a) { if (S.acts[a.k]) lines.push(a.code()); });
  if (!lines.length) lines.push('// add something on the "What it does" tab');
  return lines.map(function (l) { return l.split('\n').map(function (x) { return '    ' + x; }).join('\n'); }).join('\n');
}
function pluginJs() {
  return '/* ' + S.name + ' - made in the JVDesignStudio OpenRCT2 Mod Studio */\n' +
    'function main() {\n' +
    '  context.subscribe("' + S.event + '", function () {\n' +
    mainBody() + '\n' +
    '  });\n' +
    '}\n\n' +
    'registerPlugin({\n' +
    '  name: ' + JSON.stringify(S.name) + ',\n' +
    '  version: ' + JSON.stringify(S.version) + ',\n' +
    '  authors: [' + JSON.stringify(S.author) + '],\n' +
    '  type: "local",\n' +
    '  licence: "MIT",\n' +
    '  main: main\n' +
    '});\n';
}
function readme() {
  return S.name + ' - an OpenRCT2 plugin made in the JVDesignStudio OpenRCT2 Mod Studio.\n\n' +
    'HOW TO USE IT:\n' +
    '1. Put ' + slug(S.folder, 'MyParkHelper') + '.js in your OpenRCT2 plugin folder\n' +
    '   (Documents / OpenRCT2 / plugin).\n' +
    '2. Open OpenRCT2 and reload plugins from the Plugin Manager.\n' +
    '3. Watch the console and the in-game messages.\n\n' +
    'Full guide: https://jvdesignstudio.co.uk/workshops/openrct2-world-workshop.html\n';
}

/* ---------- render ---------- */
function syncInputs() {
  var map = { pName: 'name', pFolder: 'folder', pAuthor: 'author', pVersion: 'version', pEvent: 'event', pMsg: 'msg' };
  Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el && String(el.value) !== String(S[id])) el.value = S[id]; });
}
function renderActs() {
  var box = document.getElementById('pActs'); if (!box) return;
  box.innerHTML = '';
  ACTS.forEach(function (a) {
    var l = document.createElement('label');
    l.className = 'rctms-check';
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!S.acts[a.k]; cb.style.marginTop = '3px';
    cb.addEventListener('change', function () { S.acts[a.k] = cb.checked; renderAll(); });
    var span = document.createElement('span'); span.textContent = a.label;
    l.appendChild(cb); l.appendChild(span); box.appendChild(l);
  });
}
function render() {
  var js = pluginJs();
  var p1 = document.getElementById('pPreview'); if (p1) p1.textContent = js;
  var p2 = document.getElementById('pPreview2'); if (p2) p2.textContent = js;
  var pf = document.getElementById('pFile'); if (pf) pf.textContent = slug(S.folder, 'MyParkHelper') + '.js';
  var files = document.getElementById('pFiles');
  if (files) files.textContent = '# ' + slug(S.folder, 'MyParkHelper') + '.js\n' + js + '\n# README.txt\n' + readme();
  renderActs2(); renderChecklist(); renderExport();
}
function renderActs2() { /* acts list is rebuilt by renderActs once; kept for clarity */ }
function renderChecklist() {
  var ul = document.getElementById('pChecklist'); if (!ul) return;
  var checks = [
    ['Plugin has a name', !!S.name.trim()],
    ['Folder name has no spaces', /^[A-Za-z0-9_]+$/.test(slug(S.folder, ''))],
    ['An event is chosen', !!S.event],
    ['At least one thing happens', Object.keys(S.acts).some(function (k) { return S.acts[k]; })]
  ];
  ul.innerHTML = '';
  checks.forEach(function (c) { var li = document.createElement('li'); li.className = c[1] ? 'done' : ''; li.textContent = c[0]; ul.appendChild(li); });
}
function renderExport() {
  var tree = document.getElementById('xTree');
  var f = slug(S.folder, 'MyParkHelper');
  if (tree) tree.textContent = f + '.zip\n├── ' + f + '.js\n└── README.txt\n';
  var ul = document.getElementById('xCheck'); if (ul) {
    var checks = [['Plugin file ready', true], ['README ready', true], ['Name and folder look valid', !!S.name.trim() && /^[A-Za-z0-9_]+$/.test(f)]];
    ul.innerHTML = '';
    checks.forEach(function (c) { var li = document.createElement('li'); li.className = c[1] ? 'done' : ''; li.textContent = c[0]; ul.appendChild(li); });
  }
  renderScene();
}
function renderScene() {
  var box = document.getElementById('pPreviewScene'); if (!box) return;
  box.innerHTML = '';
  var n = 5;
  for (var i = 0; i < n; i++) {
    var g = document.createElement('div'); g.className = 'rctms-guest';
    g.style.background = ['#3757c9', '#c93a6a', '#f0a030', '#2fa07a', '#7b6cf0'][i % 5];
    box.appendChild(g);
  }
  var cap = document.getElementById('pPreviewCap');
  if (cap) cap.textContent = S.acts.guests ? 'Counting the guests in your park' : 'Guests in your park';
}
function renderAll() { syncInputs(); render(); persist(); }

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.rctms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.rctms-panel'), function (p) { p.classList.toggle('is-active', p.id === 'panel-' + name); });
  if (name === 'export') renderExport();
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.rctms-tab'));
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
    log: ['[Plugin] Loading MyParkHelper.js ...', '[Plugin] MyParkHelper failed to load: SyntaxError: Unexpected token }'],
    q: 'Your plugin will not load and names a SyntaxError. What is the fix?',
    opts: [
      { t: 'A bracket or quote is missing or extra in the .js file. Count the { } and ( ) pairs.', ok: true },
      { t: 'Move the file into the mods folder.' },
      { t: 'Rename the file to .txt.' }
    ]
  },
  {
    log: ['[Plugin] Scanning plugin folder ...', '[Plugin] Found 0 plugins'],
    q: 'Your plugin is not in the Plugin Manager list at all. What is the fix?',
    opts: [
      { t: 'The file must be in the plugin folder and end in .js (not .js.txt).', ok: true },
      { t: 'Compile it with a compiler first.' },
      { t: 'Plugins need an internet connection.' }
    ]
  },
  {
    log: ['[Plugin] MyParkHelper loaded', "[ERROR] Uncaught TypeError: park.postMsg is not a function"],
    q: 'The log names a function that "is not a function". What is wrong?',
    opts: [
      { t: 'A typo: it should be park.postMessage, not park.postMsg.', ok: true },
      { t: 'The park has too many guests.' },
      { t: 'You need a licence key.' }
    ]
  },
  {
    log: ['[Plugin] Loading Hello Park ...', '[Plugin] A plugin with the name "Hello Park" is already loaded'],
    q: 'The game refuses your plugin because of a name clash. What is the fix?',
    opts: [
      { t: 'Give your plugin its own unique name in registerPlugin.', ok: true },
      { t: 'Delete the other plugin file from disk.' },
      { t: 'Restart your computer.' }
    ]
  },
  {
    log: ['[Plugin] Day Counter loaded', '[Warning] plugin tick handler is running very often and slowing the park'],
    q: 'The park slows down after your plugin loads. What is the fix?',
    opts: [
      { t: 'You are on interval.tick. Move to a slower event like interval.day unless you truly need every tick.', ok: true },
      { t: 'Add more guests.' },
      { t: 'Disable the console.' }
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
    var isErr = /error|failed|refuses|clash|not a function|slowing/i.test(line);
    el.className = 'line' + (isErr ? ' err' : '');
    el.textContent = line;
    if (isErr) el.addEventListener('click', openOptions);
    logEl.appendChild(el);
  });
  var opts = document.getElementById('dbgOptions'); opts.innerHTML = '';
  var msg = document.getElementById('dbgMsg'); msg.className = 'rctms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('dbgNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('dbgOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'rctms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('dbgMsg'); msg.className = 'rctms-msg ok'; msg.textContent = 'Correct. That is exactly what the console is telling you.';
        document.getElementById('dbgNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
        award(15, 'debug-' + dbgIndex);
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('dbgMsg'); m2.className = 'rctms-msg bad'; m2.textContent = 'Not quite. Read the log line again and try another fix.';
      }
    });
    opts.appendChild(b);
  });
}

/* ---------- zip + download ---------- */
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
    var f = slug(S.folder, 'MyParkHelper');
    var files = [
      { name: f + '/' + f + '.js', data: enc.encode(pluginJs()) },
      { name: f + '/README.txt', data: enc.encode(readme()) }
    ];
    var blob = new Blob([makeZip(files)], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { localStorage.setItem('jvds_tool_export_openrct2-mod-studio', String(parseInt(localStorage.getItem('jvds_tool_export_openrct2-mod-studio') || '0', 10) + 1)); } catch (e) {}
    award(25, 'export');
    msg.className = 'rctms-msg ok'; msg.textContent = 'Downloaded ' + f + '.zip. Drop the .js into your OpenRCT2 plugin folder.';
  } catch (e) { msg.className = 'rctms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}
function award(amount, onceKey) {
  try { var k = 'jvds-rctxp-' + onceKey; if (localStorage.getItem(k)) return; localStorage.setItem('jvds-openrct2-studio-xp', String(parseInt(localStorage.getItem('jvds-openrct2-studio-xp') || '0', 10) + amount)); localStorage.setItem(k, '1'); } catch (e) {}
}
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'rctms-msg ok'; msgEl.textContent = 'Copied.'; } }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); }); }
  else fallback(text, done);
}
function fallback(text, done) { try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {} }

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little plugin maker. In a few steps you will name a plugin, choose what it does, read a broken log and download a real plugin folder.' },
  { t: '1. Your plugin', b: 'Give your plugin a name players will see, and a folder name. The code writes itself as you type.' },
  { t: '2. What it does', b: 'Pick when the plugin runs and tick the things it should do, like greet the park or count the guests.' },
  { t: '3. Your files', b: 'An OpenRCT2 plugin is one .js file plus a README. That is the whole install: drop it in the plugin folder.' },
  { t: '4. Fix the console', b: 'Plugins break in small ways. Practise reading the console and choosing the fix, the same skill you need in the real game.' },
  { t: '5. Download it', b: 'Grab the zip, put the .js in your OpenRCT2 plugin folder, and watch your park react.' }
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
renderActs();
render();
renderDebug();
['pName', 'pFolder', 'pAuthor', 'pVersion', 'pMsg'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('input', function () { S[id.replace(/^p/, '').charAt(0).toLowerCase() + id.replace(/^p/, '').slice(1)] = this.value; renderAll(); }); });
document.getElementById('pEvent').addEventListener('change', function () { S.event = this.value; renderAll(); });
document.getElementById('pCopy').addEventListener('click', function () { copyText(pluginJs(), document.getElementById('pMsgOut')); });
document.getElementById('dbgNext').addEventListener('click', function () { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); });
document.getElementById('xDownload').addEventListener('click', download);
document.getElementById('tourBtn').addEventListener('click', function () { showTab('plugin'); showTour(0); });
document.getElementById('tourNext').addEventListener('click', function () { if (tourIdx < TOUR.length - 1) showTour(tourIdx + 1); else hideTour(); });
document.getElementById('tourSkip').addEventListener('click', hideTour);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var ov = document.getElementById('tourOverlay'); if (ov && !ov.hidden) hideTour(); } });

/* LiveEdit API: no editable numeric constants in this studio's generated code */
var EDITABLE = [];
var editVals = {};

function applyValsToScripts() {}

window.JVDS_MOD_STUDIO = {
  getScriptCode: function () { return pluginJs(); },
  getFieldMeta: function () { return EDITABLE; },
  getValues: function () { return {}; },
  setValue: function () {},
  resetValues: function () {},
  refresh: function () { renderAll(); },
  paletteEl: null
};
})();
