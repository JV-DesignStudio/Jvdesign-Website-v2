#!/usr/bin/env node
// tests/canvas-next-integrity.js (A1753)
// CANVAS_NEXT_MAP in workshop-canvas-engine.js holds the "what next" hand-off
// between build-alongs. It lives in JS, so validate-links never sees those
// targets; a renamed or deleted canvas page would silently break the learner's
// next step. This parses the map between the A1365 markers and checks every key
// and href is a real canvas page, every label is present and no entry self-links.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = path.join(ROOT, 'workshop-canvas-engine.js');
const W = path.join(ROOT, 'workshops');

const fails = [];
const fail = (m) => fails.push(m);

const src = fs.readFileSync(ENGINE, 'utf8');
const block = src.match(/\/\* A1365:CANVAS_NEXT:start \*\/([\s\S]*?)\/\* A1365:CANVAS_NEXT:end \*\//);
if (!block) {
  console.error('FAIL canvas-next-integrity: A1365 markers not found in workshop-canvas-engine.js');
  process.exit(1);
}

const objSrc = block[1].replace(/^\s*var CANVAS_NEXT_MAP\s*=\s*/, '').replace(/;\s*$/, '');
let map;
try {
  map = JSON.parse(objSrc);
} catch (e) {
  console.error('FAIL canvas-next-integrity: CANVAS_NEXT_MAP is not valid JSON: ' + e.message);
  process.exit(1);
}

const keys = Object.keys(map);
if (!keys.length) fail('CANVAS_NEXT_MAP is empty');

const rawKeys = [...block[1].matchAll(/"([^"]+)"\s*:\s*\{/g)].map((m) => m[1]);
const seen = new Set();
for (const k of rawKeys) {
  if (seen.has(k)) fail('duplicate key: ' + k);
  seen.add(k);
}

for (const k of keys) {
  const entry = map[k] || {};
  if (!/-canvas\.html$/.test(k)) fail('key is not a canvas page: ' + k);
  if (!fs.existsSync(path.join(W, k))) fail('key page missing: ' + k);
  if (typeof entry.href !== 'string' || !entry.href) {
    fail('href missing: ' + k);
    continue;
  }
  if (!/-canvas\.html$/.test(entry.href)) fail('href is not a canvas page: ' + k + ' -> ' + entry.href);
  if (!fs.existsSync(path.join(W, entry.href))) fail('href target missing: ' + k + ' -> ' + entry.href);
  if (entry.href === k) fail('self link: ' + k);
  if (typeof entry.label !== 'string' || !entry.label.trim()) fail('label missing: ' + k);
}

if (fails.length) {
  console.error('FAIL canvas-next-integrity: ' + fails.length + ' issue(s) across ' + keys.length + ' entries');
  for (const f of fails) console.error('  [FAIL] ' + f);
  process.exit(1);
}
console.log('PASS canvas-next-integrity: ' + keys.length + ' next-step entries, every key and href resolves, labels present, no self-links');
