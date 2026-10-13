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

function convert(v) {
  v = v.trim();
  let m;
  if ((m = /^([A-Za-z_]\w*)\(\s*this\s*\)$/.exec(v)) && ALLOW_THIS.has(m[1])) return ' data-on="' + m[1] + '"';
  if ((m = /^([A-Za-z_]\w*)\(\s*this\s*,\s*(["'])(.*?)\2\s*\)$/.exec(v)) && ALLOW_THIS.has(m[1])) return ' data-on="' + m[1] + '" data-on-arg="' + eq(m[3]) + '"';
  if ((m = /^([A-Za-z_]\w*)\(\s*this\s*,\s*(-?\d+)\s*\)$/.exec(v)) && ALLOW_THIS.has(m[1])) return ' data-on="' + m[1] + '" data-on-arg="' + m[2] + '" data-on-num';
  if ((m = /^([A-Za-z_]\w*)\(\s*(-?\d+)\s*\)$/.exec(v)) && ALLOW_THIS.has(m[1])) return ' data-on="' + m[1] + '" data-on-arg="' + m[2] + '" data-on-num data-on-plain';
  if ((m = /^([A-Za-z_]\w*)\(\s*\)$/.exec(v)) && ALLOW_ZERO.has(m[1])) return ' data-on="' + m[1] + '" data-on-plain';
  if (/^window\.print\(\s*\)$/.test(v)) return ' data-action="print"';
  if ((m = /^location\.href\s*=\s*(["'])(.*?)\1$/.exec(v))) return ' data-go="' + eq(m[2]) + '"';
  if ((m = /^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\(\s*\)$/.exec(v))) return ' data-on="' + m[1] + '" data-on-plain';
  if ((m = /^this\.closest\((["'])(.*?)\1\)\.remove\(\s*\)$/.exec(v))) return ' data-remove-closest="' + eq(m[2]) + '"';
  if ((m = /^this\.closest\((["'])(.*?)\1\)\.style\.display\s*=\s*(["'])none\3$/.exec(v))) return ' data-hide-closest="' + eq(m[2]) + '"';
  if ((m = /^this\.classList\.toggle\((["'])(.*?)\1\)$/.exec(v))) return ' data-toggle-class="' + eq(m[2]) + '"';
  return null;
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
  s = s.replace(/ onclick="([^"]*)"/g, conv).replace(/ onclick='([^']*)'/g, conv);
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
