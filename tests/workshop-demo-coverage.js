#!/usr/bin/env node
// tests/workshop-demo-coverage.js (A3113)
// Locks in the six my-first series demo targets. Each overview page must point
// at a real finished-build demo for the same project, and the kit builder must
// keep the my-first fallback so a future rename cannot silently drop them.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const kits = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-kits.json'), 'utf8')).kits;
const builder = fs.readFileSync(path.join(ROOT, 'scripts', 'build-workshop-kits.js'), 'utf8');

const ids = [
  'my-first-cpp-game',
  'my-first-defold-game',
  'my-first-gdevelop-game',
  'my-first-pico8-game',
  'my-first-python-game',
  'my-first-scratch-game'
];

assert.ok(/my-first-/.test(builder) && /base \+ '-canvas'/.test(builder),
  'kit builder keeps the my-first sibling fallback');

const problems = [];
for (const id of ids) {
  const kit = kits.find((k) => k.id === id);
  if (!kit) { problems.push(id + ': not in kits'); continue; }
  if (!kit.demo || !kit.demo.url) { problems.push(id + ': no demo target'); continue; }
  if (!kit.demo.url.startsWith('/workshops/demos/')) problems.push(id + ': demo is not a finished build (' + kit.demo.url + ')');
  const file = path.join(ROOT, kit.demo.url.replace(/^\//, ''));
  if (!fs.existsSync(file)) problems.push(id + ': demo file missing (' + kit.demo.url + ')');
}
assert.deepEqual(problems, [], 'my-first demo targets resolve: ' + problems.slice(0, 4).join(' | '));

console.log('PASS workshop-demo-coverage: ' + ids.length + ' my-first series hubs point at real finished-build demos');
