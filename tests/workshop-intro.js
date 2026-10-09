#!/usr/bin/env node
// A954: the 3D builder workshops must show a "what you'll make / before you
// start / what you'll learn" brief. The brief is injected by
// workshop-enhancements.js from a page-id map, so each builder page must load
// that script and the map must cover every builder.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const enh = fs.readFileSync(path.join(ROOT, 'workshop-enhancements.js'), 'utf8');
ok('workshop-enhancements.js injects a .workshop-brief', /class\s*=\s*'workshop-brief'|className\s*=\s*'workshop-brief'/.test(enh) || enh.includes("'workshop-brief'"));
ok('the brief explains what you will make, before you start and what you will learn',
  /What you'?ll make/i.test(enh) && /Before you start/i.test(enh) && /What you'?ll learn/i.test(enh));

const BUILDERS = [
  'robot-builder', 'rocket-builder', 'space-station-builder', 'submarine-builder',
  'castle-builder', 'pirate-ship-builder', 'pirate-cannon-builder', 'race-car-builder',
  'steampunk-airship-builder', 'phone-stand-builder', 'fairy-tale-builder', 'mugen-ai-workshop'
];
for (const id of BUILDERS) {
  ok('brief map covers ' + id, new RegExp("'" + id + "'\\s*:").test(enh));
  const page = fs.readFileSync(path.join(ROOT, 'workshops', id + '.html'), 'utf8');
  ok('workshops/' + id + '.html loads workshop-enhancements.js', /workshop-enhancements\.js/.test(page));
}

console.log(failures === 0 ? 'ALL WORKSHOP BRIEF CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
