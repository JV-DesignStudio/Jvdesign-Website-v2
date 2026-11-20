#!/usr/bin/env node
// tests/workshop-stages.js (A3114 / A2031)
// Guards the three-stage rubric and the per-engine gap report. The report must
// be in sync with content/workshops.json, name every engine and tag, and agree
// with the measured counts.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rubric = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-stages.json'), 'utf8'));
const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const report = fs.readFileSync(path.join(ROOT, 'reports', 'workshop-gap-report.md'), 'utf8');

const stages = ['Beginner', 'Builder', 'Creator'];
for (const stage of stages) {
  const s = rubric.stages && rubric.stages[stage];
  assert.ok(s, 'rubric has ' + stage);
  for (const field of ['does', 'support', 'evidence']) {
    assert.ok(s[field] && s[field].length > 20, stage + ' has ' + field);
  }
}
for (const diff of ['beginner', 'intermediate', 'advanced']) {
  assert.ok(rubric.mapping && rubric.mapping[diff], 'mapping covers ' + diff);
}
assert.deepEqual([...new Set(Object.values(rubric.mapping))].sort(), [...stages].sort(), 'mapping uses the three stages');

execFileSync(process.execPath, ['scripts/workshop-gap-report.js', '--check'], { cwd: ROOT, stdio: 'pipe' });

const engines = [...new Set(workshops.map((w) => w.engine || 'General'))].sort();
for (const engine of engines) assert.ok(report.includes('| ' + engine + ' |'), 'report names engine ' + engine);
const tags = [...new Set(workshops.map((w) => (w.tags && w.tags[0]) || 'Untagged'))].sort();
for (const tag of tags) assert.ok(report.includes('| ' + tag + ' |'), 'report names tag ' + tag);
for (const stage of stages) assert.ok(report.includes(stage), 'report names ' + stage);

const counts = (engine) => {
  const list = workshops.filter((w) => (w.engine || 'General') === engine);
  const out = { Beginner: 0, Builder: 0, Creator: 0 };
  for (const w of list) out[rubric.mapping[w.difficulty] || 'Beginner']++;
  return out;
};
const minecraft = counts('Minecraft');
assert.equal(minecraft.Beginner, 18, 'Minecraft beginner count');
assert.equal(minecraft.Builder, 0, 'Minecraft builder count');
assert.equal(minecraft.Creator, 0, 'Minecraft creator count');
assert.ok(report.includes('| Minecraft | 18 | 18 | 0 | 0 | missing Builder, Creator |'), 'report matches the Minecraft row');

const noBuilder = [...new Set(workshops.map((w) => w.engine || 'General'))]
  .filter((e) => workshops.filter((w) => (w.engine || 'General') === e).length >= 5)
  .filter((e) => counts(e).Builder === 0);
assert.ok(noBuilder.length >= 10, 'the report can name a real Builder gap (' + noBuilder.length + ' engines)');

console.log('PASS workshop-stages: three-stage rubric, mapping and gap report agree (' + engines.length + ' engines, ' + tags.length + ' tags)');
