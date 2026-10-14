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
  // Multi-arg fallback via encodeToken (handles +this.value, arrays, id refs, etc.)
  const toks = splitArgs(inner).map(encodeToken);
  if (toks.every((t) => t !== null)) return ' data-on="' + name + '" data-on-args="' + toks.join('|') + '"';
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
  // document.getElementById('x').click() -> data-click-id
  if ((m = /^document\.getElementById\((["'])(.*?)\1\)\.click\(\s*\)$/.exec(v))) return ' data-click-id="' + eq(m[2]) + '"';
  // document.getElementById('x').scrollIntoView(...) -> data-scroll-to
  if ((m = /^document\.getElementById\((["'])(.*?)\1\)\.scrollIntoView\(/.exec(v))) return ' data-scroll-to="' + eq(m[2]) + '"';
  // document.getElementById('x').classList.remove('y') -> data-cls-remove-id
  if ((m = /^document\.getElementById\((["'])(.*?)\1\)\.classList\.remove\((["'])(.*?)\3\)$/.exec(v))) return ' data-cls-remove-id="' + eq(m[2]) + ':' + eq(m[4]) + '"';
  // document.getElementById('x').classList.add('y') -> data-cls-add-id
  if ((m = /^document\.getElementById\((["'])(.*?)\1\)\.classList\.add\((["'])(.*?)\3\)$/.exec(v))) return ' data-cls-add-id="' + eq(m[2]) + ':' + eq(m[4]) + '"';
  // document.getElementById('x').classList.toggle('y') -> data-cls-toggle-id
  if ((m = /^document\.getElementById\((["'])(.*?)\1\)\.classList\.toggle\((["'])(.*?)\3\)$/.exec(v))) return ' data-cls-toggle-id="' + eq(m[2]) + ':' + eq(m[4]) + '"';
  // document.getElementById('x').focus() -> data-focus-id
  if ((m = /^document\.getElementById\((["'])(.*?)\1\)\.focus\(\s*\)$/.exec(v))) return ' data-focus-id="' + eq(m[2]) + '"';
  // (function(){try{sessionStorage.setItem('k','v')}catch(e){}...})() -> data-session-set + optional extra action
  if ((m = /^\(function\(\)\{try\{sessionStorage\.setItem\((["'])(.*?)\1\s*,\s*(["'])(.*?)\3\)\}catch\(e?\)\{?\}?(.*?)\}\)\(\)$/.exec(v))) {
    const extra = (m[5] || '').trim();
    let attrs = ' data-session-set="' + eq(m[2]) + ':' + eq(m[4]) + '"';
    // Handle common extra: document.getElementById('x').remove()
    const rmId = /^document\.getElementById\((["'])(.*?)\1\)\.remove\(\)$/.exec(extra);
    if (rmId) attrs += ' data-remove-id="' + eq(rmId[2]) + '"';
    else if (extra) return null;
    return attrs;
  }
  // Trim trailing semicolons for matching
  const vt = v.replace(/;+$/, '');
  // activePill('pillName',this);liveConfig.prop=value -> data-pill + data-set + data-val
  if ((m = /^activePill\((["'])(\w+)\1\s*,\s*this\)\s*;\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*=\s*(.+)$/.exec(vt))) {
    const pillId = m[2]; const setProp = m[3]; const setVal = m[4].trim();
    const semi = setVal.indexOf(';');
    if (semi < 0) {
      const parsedVal = setVal.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
      return ' data-pill="' + eq(pillId) + '" data-set="' + eq(setProp) + '" data-val="' + eq(parsedVal) + '"';
    } else {
      const actualVal = setVal.slice(0, semi).trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
      const after = setVal.slice(semi + 1).trim();
      const afterFn = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(\s*\)$/.exec(after);
      if (afterFn) return ' data-pill="' + eq(pillId) + '" data-set="' + eq(setProp) + '" data-val="' + eq(actualVal) + '" data-then="' + afterFn[1] + '"';
    }
  }
  // activePill(..);prop=val;fn() -> data-pill + data-set + data-then
  if ((m = /^activePill\((["'])(\w+)\1\s*,\s*this\)\s*;\s*([A-Za-z_$][\w$]*(?:\.\w+)+)\s*=\s*([^;]+)\s*;\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(([^)]*)\)$/.exec(vt))) {
    const pillId = m[2]; const setProp = m[3]; const setVal = m[4].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    const thenFn = m[5]; const thenArg = m[6].trim();
    let attrs = ' data-pill="' + eq(pillId) + '" data-set="' + eq(setProp) + '" data-val="' + eq(setVal) + '" data-then="' + thenFn + '"';
    if (thenArg) {
      const ta = thenArg.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
      attrs = ' data-pill="' + eq(pillId) + '" data-set="' + eq(setProp) + '" data-val="' + eq(setVal) + '" data-on="' + thenFn + '" data-on-arg="' + eq(ta) + '" data-on-plain';
    }
    return attrs;
  }
  // prop=val;activePill(..);fn() -> reversed pill pattern
  if ((m = /^([A-Za-z_$][\w$]*(?:\.\w+)+)\s*=\s*([^;]+)\s*;\s*activePill\((["'])(\w+)\3\s*,\s*this\)\s*;\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(\s*\)$/.exec(vt))) {
    const setProp = m[1]; const setVal = m[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    const pillId = m[4]; const thenFn = m[5];
    return ' data-pill="' + eq(pillId) + '" data-set="' + eq(setProp) + '" data-val="' + eq(setVal) + '" data-then="' + thenFn + '"';
  }
  // activePill(..);fn('arg') -> data-pill + data-on with arg
  if ((m = /^activePill\((["'])(\w+)\1\s*,\s*this\)\s*;\s*([A-Za-z_$][\w$]*)\((['"])([^'"]*)\4\)$/.exec(vt))) {
    return ' data-pill="' + eq(m[2]) + '" data-on="' + m[3] + '" data-on-arg="' + eq(m[5]) + '" data-on-plain';
  }
  // Multi-set: activePill(..);prop1=val1;prop2=val2 -> data-pill with data-set2/data-val2
  if ((m = /^activePill\((["'])(\w+)\1\s*,\s*this\)\s*;\s*([A-Za-z_$][\w$]*(?:\.\w+)+)\s*=\s*([^;]+)\s*;\s*([A-Za-z_$][\w$]*(?:\.\w+)+)\s*=\s*([^;]+)$/.exec(vt))) {
    const pillId = m[2]; const p1 = m[3]; const v1 = m[4].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    const p2 = m[5]; const v2 = m[6].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    return ' data-pill="' + eq(pillId) + '" data-set="' + eq(p1) + '" data-val="' + eq(v1) + '" data-set2="' + eq(p2) + '" data-val2="' + eq(v2) + '"';
  }
  // liveConfig.prop=value with nextElementSibling display
  if ((m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*=\s*\+?this\.value\s*;\s*this\.nextElementSibling\.textContent\s*=\s*(.+)$/.exec(vt))) {
    const prop = m[1]; const dispExpr = m[2].trim();
    let btype = v.includes('=+this.value') ? 'nval' : 'value';
    let displayAttr = ' data-bind-display="next"';
    return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"' + displayAttr;
  }
  // Bare property assignment: liveConfig.prop=this.checked or liveConfig.prop=this.value
  if ((m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*=\s*(this\.checked|this\.value|\+?this\.value)$/.exec(vt))) {
    const prop = m[1]; const valExpr = m[2];
    let btype = valExpr === 'this.checked' ? 'checked' : (valExpr.startsWith('+') ? 'nval' : 'value');
    return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"';
  }
  // if(event.target===this)fn() -> self-target guard
  if ((m = /^if\(event\.target===this\)(\w+)\(\s*\)$/.exec(v))) return ' data-on="' + m[1] + '" data-on-plain data-on-self';
  // fn();return false -> convert fn() part, the delegate handles preventDefault via data-prevent
  if ((m = /^(.+);\s*return\s+false$/.exec(v))) {
    const inner = convert(m[1]);
    if (inner) return inner + ' data-prevent';
  }
  // return false alone (onsubmit)
  if (v === 'return false') return ' data-prevent';
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
  const out = []; let cur = ''; let q = null; let bracket = 0;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; }
    else if (ch === "'" || ch === '"') { q = ch; cur += ch; }
    else if (ch === '[') { bracket++; cur += ch; }
    else if (ch === ']') { bracket--; cur += ch; }
    else if (ch === ',' && bracket === 0) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function encodeToken(a) {
  a = a.trim();
  if (a === 'this') return 'this';
  if (a === 'this.value') return 'value';
  if (a === '+this.value') return 'nval';
  if (a === 'this.checked') return 'checked';
  if (a === 'event') return 'event';
  if (a === 'true' || a === 'false') return a;
  if (/^-?\d+(?:\.\d+)?$/.test(a)) return a;
  const s = /^'([^']*)'$/.exec(a) || /^"([^"]*)"$/.exec(a);
  if (s) return 's:' + encodeURIComponent(s[1]);
  const c = /^this\.closest\((['"])(.*?)\1\)$/.exec(a);
  if (c) return 'c:' + c[2];
  // document.getElementById('x') -> id:x
  const idRef = /^document\.getElementById\((['"])(.*?)\1\)$/.exec(a);
  if (idRef) return 'id:' + idRef[2];
  // document.getElementById('x').value -> handled as id ref + .value needs more complex support
  const idVal = /^document\.getElementById\((['"])(.*?)\1\)\.value$/.exec(a);
  if (idVal) return 'id:' + idVal[2] + '.value';
  // Array literal: ['a','b','c'] -> a:encoded
  if (a.startsWith('[') && a.endsWith(']')) {
    try { const arr = JSON.parse(a.replace(/'/g, '"')); return 'a:' + encodeURIComponent(JSON.stringify(arr)); } catch(e) { return null; }
  }
  return null;
}
function convertEvent(v, ev) {
  const vt = v.trim().replace(/;+$/, '');
  // Bare property bind (no then-function): liveConfig.prop=this.checked / =+this.value / =this.value
  const bareEv = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*=\s*(this\.checked|this\.value|\+this\.value)$/.exec(vt);
  if (bareEv) {
    const btype = bareEv[2] === 'this.checked' ? 'checked' : (bareEv[2] === '+this.value' ? 'nval' : 'value');
    return ' data-bind="' + eq(bareEv[1]) + '" data-bind-type="' + btype + '"';
  }
  // Bind + nextElementSibling display (no then): prop=+this.value;this.nextElementSibling.textContent=EXPR
  const bindNext = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*=\s*(\+?this\.value)\s*;\s*this\.nextElementSibling\.textContent\s*=\s*(.+)$/.exec(vt);
  if (bindNext) {
    const btype = bindNext[2].startsWith('+') ? 'nval' : 'value';
    return ' data-bind="' + eq(bindNext[1]) + '" data-bind-type="' + btype + '" data-bind-display="next"';
  }
  // Property binding: P.prop=EXPR;buildFn() or P.prop=parseFloat(this.value);...;buildFn()
  const bindMatch = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*=\s*(this\.value|this\.checked|parseFloat\(this\.value\)|parseInt\(this\.value(?:,\s*10)?\)|(?:\+this\.value)|this\.value\s*\/\s*\d+)\s*;(.+)$/.exec(vt);
  if (bindMatch) {
    const prop = bindMatch[1];
    const valExpr = bindMatch[2];
    let rest = bindMatch[3].trim().replace(/;+$/, '');
    let btype = 'value';
    let scaleAttr = '';
    if (valExpr === 'this.checked') btype = 'checked';
    else if (valExpr.startsWith('parseFloat')) btype = 'float';
    else if (valExpr.startsWith('parseInt')) btype = 'int';
    else if (valExpr === '+this.value') btype = 'nval';
    else if (/^this\.value\s*\/\s*(\d+)$/.test(valExpr)) {
      const divisor = valExpr.match(/\/\s*(\d+)/)[1];
      btype = 'nval';
      scaleAttr = ' data-bind-scale="' + (1/parseInt(divisor)) + '"';
    }
    // Check if rest is: [display update;] fn()
    let displayAttr = '';
    let remaining = rest;
    // Pattern: document.getElementById('x').textContent=EXPR;fn()
    const dispMatch = /^document\.getElementById\((["'])(.*?)\1\)\.textContent\s*=\s*(.*?)\s*;\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(\s*\)$/.exec(remaining);
    if (dispMatch) {
      const dispId = dispMatch[2];
      const dispExpr = dispMatch[3];
      const thenFn = dispMatch[4];
      // Figure out format from the expression
      let fmt = '';
      const fmtFixed = /\.toFixed\((\d+)\)\s*(?:\+\s*(["'])(.*?)\2)?$/.exec(dispExpr);
      if (fmtFixed) {
        fmt = '0.' + '0'.repeat(parseInt(fmtFixed[1])) + (fmtFixed[3] || '');
      }
      displayAttr = ' data-bind-display="' + eq(dispId) + '"';
      if (fmt) displayAttr += ' data-bind-fmt="' + eq(fmt) + '"';
      return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"' + scaleAttr + displayAttr + ' data-then="' + thenFn + '"';
    }
    // Display with scaled value: document.getElementById('x').textContent=(this.value/N).toFixed(D);fn()
    const dispScaled = /^document\.getElementById\((["'])(.*?)\1\)\.textContent\s*=\s*\(this\.value\s*\/\s*\d+\)\.toFixed\((\d+)\)(?:\s*\+\s*(["'])(.*?)\4)?\s*;\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(\s*\)$/.exec(remaining);
    if (dispScaled) {
      const dispId = dispScaled[2];
      const decimals = parseInt(dispScaled[3]);
      const suffix = dispScaled[5] || '';
      let fmt = '0.' + '0'.repeat(decimals) + suffix;
      displayAttr = ' data-bind-display="' + eq(dispId) + '" data-bind-fmt="' + eq(fmt) + '"';
      return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"' + scaleAttr + displayAttr + ' data-then="' + dispScaled[6] + '"';
    }
    // Display: document.getElementById('x').textContent=this.value;fn()
    const dispSimple = /^document\.getElementById\((["'])(.*?)\1\)\.textContent\s*=\s*this\.value\s*;\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(\s*\)$/.exec(remaining);
    if (dispSimple) {
      displayAttr = ' data-bind-display="' + eq(dispSimple[2]) + '"';
      return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"' + scaleAttr + displayAttr + ' data-then="' + dispSimple[3] + '"';
    }
    // Bind + this.nextElementSibling display + fn()
    const dispNext = /^this\.nextElementSibling\.textContent\s*=\s*(?:this\.value|[^;]+)\s*;\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(\s*\)$/.exec(remaining);
    if (dispNext) {
      return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"' + scaleAttr + ' data-bind-display="next" data-then="' + dispNext[1] + '"';
    }
    // Bind + this.nextElementSibling display only (no fn)
    const dispNextOnly = /^this\.nextElementSibling\.textContent\s*=\s*(.+)$/.exec(remaining);
    if (dispNextOnly) {
      return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"' + scaleAttr + ' data-bind-display="next"';
    }
    // Pattern: just fn()
    const justFn = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(\s*\)$/.exec(remaining);
    if (justFn) {
      return ' data-bind="' + eq(prop) + '" data-bind-type="' + btype + '"' + scaleAttr + ' data-then="' + justFn[1] + '"';
    }
  }

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
    // onerror="this.parentElement.textContent='X'" -> data-fallback-parent-text
    x = x.replace(/ onerror="this\.parentElement\.textContent\s*=\s*'([^']*)'">/g, (m, txt) => { hits++; return ' data-fallback-parent-text="' + eq(txt) + '">'; });
    x = x.replace(/ onerror="this\.parentElement\.textContent\s*=\s*'([^']*)'"(?=\s)/g, (m, txt) => { hits++; return ' data-fallback-parent-text="' + eq(txt) + '"'; });
    // onerror="this.style.display='none';this.nextElementSibling.style.display='flex'|'block'" -> data-fallback-show-sibling
    x = x.replace(/ onerror="this\.style\.display\s*=\s*(['"])none\1\s*;\s*this\.nextElementSibling\.style\.display\s*=\s*(['"])(flex|block)\2"/gi, (m, q1, q2, disp) => { hits++; return ' data-fallback-show-sibling="' + disp + '"'; });
    // onerror="var p=this.closest('sel');p.style.display='none';p.nextElementSibling.style.display='block'" -> data-fallback-hide-closest
    x = x.replace(/ onerror="var p=this\.closest\((['"])(.*?)\1\)\s*;\s*p\.style\.display\s*=\s*(['"])none\3\s*;\s*p\.nextElementSibling\.style\.display\s*=\s*(['"])block\4"/gi, (m, q, sel) => { hits++; return ' data-fallback-hide-closest="' + eq(sel) + '"'; });
    // onerror="this.outerHTML='...'" -> data-fallback-replace
    x = x.replace(/ onerror="this\.onerror\s*=\s*null\s*;\s*this\.outerHTML\s*=\s*'((?:[^'\\]|\\.)*)'">/g, (m, html) => { hits++; return ' data-fallback-replace="' + eq(html.replace(/\\'/g, "'")) + '">'; });
    x = x.replace(/ onerror="this\.outerHTML\s*=\s*'((?:[^'\\]|\\.)*)'">/g, (m, html) => { hits++; return ' data-fallback-replace="' + eq(html.replace(/\\'/g, "'")) + '">'; });
    // onerror="this.onerror=null;this.style.display='none';this.parentNode.innerHTML='...'" -> data-fallback-parent-html
    x = x.replace(/ onerror="this\.onerror\s*=\s*null\s*;\s*this\.style\.display\s*=\s*(['"])none\1\s*;\s*this\.parentNode\.innerHTML\s*=\s*'((?:[^'\\]|\\.)*)'">/g, (m, q, html) => { hits++; return ' data-fallback-parent-html="' + eq(html.replace(/\\'/g, "'")) + '">'; });
    // onerror="this.style.background='...'" -> data-fallback-bg
    x = x.replace(/ onerror="this\.style\.background\s*=\s*'([^']*)'">/g, (m, bg) => { hits++; return ' data-fallback-bg="' + eq(bg) + '">'; });
    // onerror with style.display='none' -> data-fallback-hide
    x = x.replace(/ onerror="this\.style\.display\s*=\s*(['"])none\1"/gi, (m) => { hits++; return ' data-fallback-hide'; });
    x = x.replace(/ onerror='this\.style\.display\s*=\s*(["\'])none\1'/gi, (m) => { hits++; return ' data-fallback-hide'; });
    // onerror="this.parentElement.style.display='none'" or similar parent-hide
    x = x.replace(/ onerror="this\.(?:parentElement|parentNode)\.style\.display\s*=\s*(['"])none\1"/gi, (m) => { hits++; return ' data-fallback-hide-parent'; });
    // Form-control / drag events -> data-on-event + compiled args
    // Key-filtered: if(event.key==='Enter')fn() or if(event.key==='Enter'||event.key===' ')fn()
    const keyConv = (ev) => (m, v) => {
      let km;
      // if(event.key==='Enter'||event.key===' ')fn(...) or if(event.key==='Enter')fn(...)
      km = /^if\(event\.key===(['"])(Enter|Space| )\1(?:\|\|event\.key===(['"])(Enter|Space| )\3)?\)\s*(.+)$/.exec(v.trim());
      if (km) {
        const fn = km[5];
        const keys = [km[2]];
        if (km[4]) keys.push(km[4]);
        const keyStr = keys.map(k => k === ' ' ? 'Space' : k).join(' ');
        const inner = convertEvent(fn, ev);
        if (inner) { hits++; return inner + ' data-on-key="' + keyStr + '"'; }
        // simple fn() with no args
        const sm = /^(\w+)\(\s*\)$/.exec(fn);
        if (sm) { hits++; return ' data-on="' + sm[1] + '" data-on-event="' + ev + '" data-on-args="" data-on-key="' + keyStr + '"'; }
      }
      // Fallback to normal event conversion
      const r = convertEvent(v, ev); if (!r) return m; hits++; if (samples.length < 12) samples.push(rel + ': on' + ev + ' ' + v + ' ->' + r); return r;
    };
    const evConv = (ev) => (m, v) => { const r = convertEvent(v, ev); if (!r) return m; hits++; if (samples.length < 12) samples.push(rel + ': on' + ev + ' ' + v + ' ->' + r); return r; };
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) {
      x = x.replace(new RegExp(' on' + ev + '="([^"]*)"', 'g'), keyConv(ev)).replace(new RegExp(' on' + ev + "='([^']*)'", 'g'), keyConv(ev));
    });
    ['input', 'change', 'submit', 'focus', 'blur', 'touchstart', 'touchend', 'touchmove'].forEach(function (ev) {
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
