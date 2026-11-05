'use strict';
/**
 * build-workshop-completion.js (A2037)
 *
 * Writes content/workshop-completion.json from the catalogue, the outcome
 * records and the workshop pages themselves. Run it after adding or renaming a
 * workshop, then run scripts/apply-workshop-completion.js.
 *
 * Usage:
 *   node scripts/build-workshop-completion.js
 *   node scripts/build-workshop-completion.js --check
 */
const fs = require('fs');
const path = require('path');
const model = require('./workshop-completion-model');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'workshop-completion.json');
const CHECK = process.argv.includes('--check');

const result = model.build();
const counts = {};
result.workshops.forEach((w) => { counts[w.mode] = (counts[w.mode] || 0) + 1; });

const payload = JSON.stringify({
  generatedBy: 'scripts/build-workshop-completion.js',
  contract: {
    modes: model.CONDITION,
    tracked: ['engine', 'canvas', 'steps'],
    note: 'builder pages finish with a real playable or downloadable build, so they get a closing finish line instead of step tracking.'
  },
  counts,
  workshops: result.workshops
}, null, 2) + '\n';

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== payload) {
    console.error('Workshop completion registry is out of date. Run: npm run build:completion');
    process.exitCode = 1;
  } else {
    console.log('Workshop completion registry is current (' + result.workshops.length + ' entries)');
  }
} else {
  fs.writeFileSync(OUT, payload);
  console.log('Workshop completion registry: ' + result.workshops.length + ' entries -> content/workshop-completion.json');
  console.log('  ' + Object.keys(counts).sort().map((k) => k + '=' + counts[k]).join(', '));
}
if (result.skipped.length) {
  console.log('  skipped: ' + result.skipped.map((s) => s.id + ' (' + s.reason + ')').join(', '));
  process.exitCode = 1;
}
