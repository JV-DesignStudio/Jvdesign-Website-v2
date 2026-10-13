#!/usr/bin/env node
// scripts/handlers-to-data.js (A1506): rewrite the repeated inline widget handlers
// (onclick="fn(this)" etc.) into delegated data-* attributes handled by
// assets/js/ui-delegate.js. Restricted to an allowlist of known global functions.
//
// Usage:
//   node scripts/handlers-to-data.js                       # dry run (all pages)
//   node scripts/handlers-to-data.js --page workshops/x.html [--page ...]
//   node scripts/handlers-to-data.js --apply               # write
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const IGN = new Set(['node_modules', '.git', '.claude', 'tmp', 'quest-board-deploy', '.aider.tags.cache.v4', 'assets']);

const ALLOW = new Set(['selectQuizOpt', 'checkQuiz', 'toggleStep', 'checkConceptFill', 'pickTF', 'pickOrder',
  'checkCodeChallenge', 'checkParsons', 'completeStep', 'toggleCheck', 'checkTF', 'checkOrder',
  'resetParsons', 'resetOrder', 'checkPredict', 'checkFill']);

const pages = [];
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--page') pages.push(path.join(ROOT, process.argv[i + 1]));

function convertCall(v) {
  v = v.trim();
  let m;
  if ((m = /^([A-Za-z_]\w*)\(\s*this\s*\)$/.exec(v)) && ALLOW.has(m[1])) return { fn: m[1] };
  if ((m = /^([A-Za-z_]\w*)\(\s*this\s*,\s*(["'])(.*?)\2\s*\)$/.exec(v)) && ALLOW.has(m[1])) return { fn: m[1], arg: m[3] };
  if ((m = /^([A-Za-z_]\w*)\(\s*this\s*,\s*(-?\d+)\s*\)$/.exec(v)) && ALLOW.has(m[1])) return { fn: m[1], arg: m[2], num: true };
  if ((m = /^([A-Za-z_]\w*)\(\s*(["'])(.*?)\2\s*\)$/.exec(v)) && ALLOW.has(m[1])) return { fn: m[1], arg: m[3], plain: true };
  if ((m = /^([A-Za-z_]\w*)\(\s*(-?\d+)\s*\)$/.exec(v)) && ALLOW.has(m[1])) return { fn: m[1], arg: m[2], num: true, plain: true };
  if ((m = /^([A-Za-z_]\w*)\(\s*\)$/.exec(v)) && ALLOW.has(m[1])) return { fn: m[1], plain: true };
  return null;
}
function toAttrs(r) {
  let s = ' data-on="' + r.fn + '"';
  if (r.arg !== undefined) s += ' data-on-arg="' + String(r.arg).replace(/"/g, '&quot;') + '"';
  if (r.num) s += ' data-on-num';
  if (r.plain) s += ' data-on-plain';
  return s;
}

const ignored = new Set();
try { execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).forEach((l) => { if (l) ignored.add(l); }); } catch (e) {}

let files = 0, hits = 0;
const samples = [];
function processFile(p) {
  const rel = path.relative(ROOT, p).split(path.sep).join('/');
  if (ignored.has(rel)) return;
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  const conv = (m, v) => { const r = convertCall(v); if (!r) return m; hits++; if (samples.length < 10) samples.push(rel + ': ' + v + ' ->' + toAttrs(r)); return toAttrs(r); };
  s = s.replace(/ onclick="([^"]*)"/g, conv).replace(/ onclick='([^']*)'/g, conv);
  if (s !== before) { files++; if (APPLY) fs.writeFileSync(p, s, 'utf8'); }
}
if (pages.length) {
  pages.forEach(processFile);
} else {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (IGN.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) processFile(p);
    }
  };
  walk(ROOT);
}
console.log((APPLY ? 'Converted ' : 'Would convert ') + hits + ' handler(s) across ' + files + ' file(s).');
samples.forEach((s) => console.log('  ' + s));
if (!APPLY) console.log('Re-run with --apply to write.');
