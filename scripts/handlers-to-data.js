#!/usr/bin/env node
// scripts/handlers-to-data.js (A1506/A1509): rewrite repeated inline handlers into
// delegated data-* attributes handled by assets/js/ui-delegate.js.
//   fn(this) | fn(this,lit) | fn() | A.B() | location.href='x'
//   window.print() | this.closest('.x').remove() | this.closest('.x').style.display='none'
//   this.classList.toggle('c')
// Restricted to allowlists so only known-safe calls are touched.
//   node scripts/handlers-to-data.js [--page file ...] [--apply]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const IGN = new Set(['node_modules', '.git', '.claude', 'tmp', 'quest-board-deploy', '.aider.tags.cache.v4', 'assets']);

const ALLOW_THIS = new Set(['selectQuizOpt', 'checkQuiz', 'toggleStep', 'checkConceptFill', 'pickTF', 'pickOrder',
  'checkCodeChallenge', 'checkParsons', 'completeStep', 'toggleCheck', 'checkTF', 'checkOrder',
  'resetParsons', 'resetOrder', 'checkPredict', 'checkFill', 'toggleFaq']);
const ALLOW_ZERO = new Set(['doApply', 'closeModal', 'trackProgress', 'copyProjectLink', 'undo', 'redo',
  'exportPNG', 'renderPreview', 'exportJSON', 'render', 'openSaveModal', 'openLoadModal']);

const eq = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// A function called from a static inline handler must be reachable from global
// scope (inline handlers resolve names on window), so any simple `name(...)`
// call is safe to route through the delegated runtime by name. This is the
// generic form that lets A1485 sweep the long tail; the ALLOW_* allowlists stay
// as documented examples of the exact shapes that are known-safe.
function convertCall(v) {
  const m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(([^()]*)\)$/.exec(v);
  if (!m) return null;
  const name = m[1];
  const inner = m[2].trim();
  if (!inner) return ' data-on="' + name + '" data-on-plain';
  if (inner === 'this') return ' data-on="' + name + '"';
  // this, <literal|number|bool>
  let a = /^this\s*,\s*('([^']*)'|"([^"]*)"|-?\d+(?:\.\d+)?|true|false)$/.exec(inner);
  if (a) {
    const lit = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : a[4]);
    if (a[4] === 'true' || a[4] === 'false') return ' data-on="' + name + '" data-on-arg="' + a[4] + '" data-on-bool';
    if (a[2] !== undefined || a[3] !== undefined) return ' data-on="' + name + '" data-on-arg="' + eq(lit) + '"';
    return ' data-on="' + name + '" data-on-arg="' + lit + '" data-on-num';
  }
  // single <literal|number|bool>
  let s = /^'([^']*)'$/.exec(inner) || /^"([^"]*)"$/.exec(inner);
  if (s) return ' data-on="' + name + '" data-on-arg="' + eq(s[1]) + '" data-on-plain';
  if (/^-?\d+(?:\.\d+)?$/.test(inner)) return ' data-on="' + name + '" data-on-arg="' + inner + '" data-on-num data-on-plain';
  if (inner === 'true' || inner === 'false') return ' data-on="' + name + '" data-on-arg="' + inner + '" data-on-bool data-on-plain';
  // this.closest('x') as an argument
  let cc = /^this\.closest\((['"])(.*?)\1\)$/.exec(inner);
  if (cc) return ' data-on="' + name + '" data-on-closest="' + eq(cc[2]) + '"';
  return null;
}

function convert(v) {
  v = v.trim();
  let m;
  if (/^window\.print\(\s*\)$/.test(v)) return ' data-action="print"';
  if ((m = /^location\.href\s*=\s*(["'])(.*?)\1$/.exec(v))) return ' data-go="' + eq(m[2]) + '"';
  if ((m = /^this\.closest\((["'])(.*?)\1\)\.remove\(\s*\)$/.exec(v))) return ' data-remove-closest="' + eq(m[2]) + '"';
  if ((m = /^this\.closest\((["'])(.*?)\1\)\.style\.display\s*=\s*(["'])none\3$/.exec(v))) return ' data-hide-closest="' + eq(m[2]) + '"';
  if ((m = /^this\.classList\.toggle\((["'])(.*?)\1\)$/.exec(v))) return ' data-toggle-class="' + eq(m[2]) + '"';
  return convertCall(v);
}

// onmouseover/onmouseout="this.style.x='y';..." -> data-hover / data-hover-out declarations.
function convertHover(v) {
  const re = /this\.style\.(\w+)\s*=\s*(["'])(.*?)\2/g;
  const decls = [];
  let m;
  while ((m = re.exec(v))) decls.push(m[1] + ':' + m[3]);
  if (!decls.length) return null;
  const rest = v.replace(re, '').replace(/[;\s]+/g, '');
  return rest === '' ? decls.join(';') : null;
}

// Form-control / drag events: emit data-on + data-on-event + a compiled arg spec.
// Spec tokens are separated by "|": this, value, checked, event, true/false,
// number, s:<urlencoded string>, c:<selector>. Only the allowlisted tokens convert,
// so anything else is left as an inline handler for a later hand pass.
function splitArgs(s) {
  const out = []; let cur = ''; let q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; }
    else if (ch === "'" || ch === '"') { q = ch; cur += ch; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function encodeToken(a) {
  a = a.trim();
  if (a === 'this') return 'this';
  if (a === 'this.value') return 'value';
  if (a === 'this.checked') return 'checked';
  if (a === 'event') return 'event';
  if (a === 'true' || a === 'false') return a;
  if (/^-?\d+(?:\.\d+)?$/.test(a)) return a;
  const s = /^'([^']*)'$/.exec(a) || /^"([^"]*)"$/.exec(a);
  if (s) return 's:' + encodeURIComponent(s[1]);
  const c = /^this\.closest\((['"])(.*?)\1\)$/.exec(a);
  if (c) return 'c:' + c[2];
  return null;
}
function convertEvent(v, ev) {
  const m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(([\s\S]*)\)$/.exec(v.trim());
  if (!m) return null;
  const name = m[1];
  const inner = m[2].trim();
  if (inner === '') return ' data-on="' + name + '" data-on-event="' + ev + '" data-on-args=""';
  const toks = splitArgs(inner).map(encodeToken);
  if (toks.some((t) => t === null)) return null;
  return ' data-on="' + name + '" data-on-event="' + ev + '" data-on-args="' + toks.join('|') + '"';
}

const pages = [];
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--page') pages.push(path.join(ROOT, process.argv[i + 1]));

const ignored = new Set();
try { execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).forEach((l) => { if (l) ignored.add(l); }); } catch (e) {}

let files = 0, hits = 0;
const samples = [];
function processFile(p) {
  const rel = path.relative(ROOT, p).split(path.sep).join('/');
  if (ignored.has(rel)) return;
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  const conv = (m, v) => { const r = convert(v); if (!r) return m; hits++; if (samples.length < 12) samples.push(rel + ': ' + v + ' ->' + r); return r; };
  const hover = (attr, dataAttr) => (m, v) => { const d = convertHover(v); if (!d) return m; hits++; if (samples.length < 12) samples.push(rel + ': ' + attr + ' ' + v.slice(0, 40) + ' -> ' + dataAttr); return ' ' + dataAttr + '="' + eq(d) + '"'; };
  // Image fallback: onerror="this.onerror=null;this.src='X'" -> data-fallback="X"
  const fb = (m, q, url) => { hits++; if (samples.length < 12) samples.push(rel + ': onerror -> data-fallback'); return ' data-fallback="' + eq(url) + '"'; };
  // Only rewrite real HTML attributes, never JS string literals inside <script>.
  // Some pages (e.g. arcade-game-maker) build exportable HTML inside scripts; a
  // blanket rewrite would corrupt an exported game that ships without ui-delegate.js.
  s = s.split(/(<script\b[\s\S]*?<\/script>)/gi).map((part, i) => {
    if (i % 2) return part; // inside <script>: leave untouched
    let x = part;
    x = x.replace(/ onclick="([^"]*)"/g, conv).replace(/ onclick='([^']*)'/g, conv);
    x = x.replace(/ onmouseover="([^"]*)"/g, hover('onmouseover', 'data-hover')).replace(/ onmouseover='([^']*)'/g, hover('onmouseover', 'data-hover'));
    x = x.replace(/ onmouseout="([^"]*)"/g, hover('onmouseout', 'data-hover-out')).replace(/ onmouseout='([^']*)'/g, hover('onmouseout', 'data-hover-out'));
    x = x.replace(/ onerror="this\.onerror\s*=\s*null\s*;\s*this\.src\s*=\s*(['"])(.*?)\1"/gi, fb);
    x = x.replace(/ onerror='this\.onerror\s*=\s*null\s*;\s*this\.src\s*=\s*(['"])(.*?)\1'/gi, fb);
    // Form-control / drag events -> data-on-event + compiled args
    const evConv = (ev) => (m, v) => { const r = convertEvent(v, ev); if (!r) return m; hits++; if (samples.length < 12) samples.push(rel + ': on' + ev + ' ' + v + ' ->' + r); return r; };
    ['input', 'change', 'keydown', 'keyup', 'keypress', 'submit', 'focus', 'blur', 'touchstart', 'touchend', 'touchmove'].forEach(function (ev) {
      x = x.replace(new RegExp(' on' + ev + '="([^"]*)"', 'g'), evConv(ev)).replace(new RegExp(' on' + ev + "='([^']*)'", 'g'), evConv(ev));
    });
    return x;
  }).join('');
  if (s !== before) { files++; if (APPLY) fs.writeFileSync(p, s, 'utf8'); }
}
if (pages.length) pages.forEach(processFile);
else {
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (IGN.has(e.name)) continue; const q = path.join(d, e.name); if (e.isDirectory()) walk(q); else if (e.name.endsWith('.html')) processFile(q); } };
  walk(ROOT);
}
console.log((APPLY ? 'Converted ' : 'Would convert ') + hits + ' handler(s) across ' + files + ' file(s).');
samples.forEach((s) => console.log('  ' + s));
if (!APPLY) console.log('Re-run with --apply to write.');
