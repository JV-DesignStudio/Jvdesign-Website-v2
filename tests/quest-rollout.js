#!/usr/bin/env node
/*
 * tests/quest-rollout.js (A2582)
 * Keeps the quest step runtime rollout tracker honest.
 *
 * Checks:
 *  - content/quest-rollout.json matches the pages on disk
 *  - every converted page loads the shared runtime and calls QuestRuntime
 *  - every converted page has at least one real page test
 *  - converted and remaining do not overlap and cover every public workshop
 *  - the flagship pages are tracked as converted
 *
 * Run: node tests/quest-rollout.js
 */
const fs = require('fs');
const path = require('path');
const { build, readTracker, samePlan, pageSource, hasSharedRuntime, ROOT } = require(path.join(__dirname, '..', 'scripts', 'build-quest-rollout.js'));

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const tracker = readTracker();
check('content/quest-rollout.json exists', !!tracker);
if (!tracker) {
  console.log('\n1 CHECK(S) FAILED');
  process.exit(1);
}

const expected = build();
check('tracker matches the pages on disk', samePlan(tracker, expected),
  `file ${tracker.converted.length}/${tracker.remaining.length}, disk ${expected.converted.length}/${expected.remaining.length}`);

const converted = new Set(tracker.converted.map(entry => entry.file));
const remaining = new Set(tracker.remaining);
check('converted lists the Learning Lab flagship quest', converted.has('workshops/learning-lab.html'));
check('converted lists the Mario jump-lab flagship quest', converted.has('workshops/jump-jump-mario-workshop.html'));
check('converted and remaining do not overlap', [...converted].every(file => !remaining.has(file)));
check('remaining is not empty', tracker.remaining.length > 0, String(tracker.remaining.length));

const missing = [...converted, ...remaining].filter(file => !fs.existsSync(path.join(ROOT, file)));
check('every tracked page exists', missing.length === 0, missing.join(', '));

tracker.converted.forEach(entry => {
  const source = pageSource(path.basename(entry.file));
  check(entry.file + ' loads step-runtime.js', /\/assets\/js\/quest-core\/step-runtime\.js/.test(source));
  check(entry.file + ' calls the shared QuestRuntime', hasSharedRuntime(source));
  check(entry.file + ' has real step tests', Array.isArray(entry.tests) && entry.tests.length > 0,
    JSON.stringify(entry.tests || []));
  (entry.tests || []).forEach(test => {
    check('  test exists ' + test, fs.existsSync(path.join(ROOT, test)));
  });
});

// The tracker is a map of the whole public workshop folder, not a partial list.
const publicWorkshops = expected.converted.map(entry => entry.file).concat(expected.remaining);
check('tracker covers every public workshop page', publicWorkshops.length === converted.size + remaining.size,
  `${publicWorkshops.length} on disk, ${converted.size + remaining.size} tracked`);

if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log('\nALL QUEST ROLLOUT CHECKS PASSED');
