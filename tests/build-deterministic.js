#!/usr/bin/env node
/*
 * tests/build-deterministic.js - A2044 reproducible-build proof.
 *
 * Two jobs:
 *   1. Run the generator chain twice with SOURCE_DATE_EPOCH pinned and assert
 *      the output is byte-identical.
 *   2. Tamper with a generated file and assert the drift gate fails (exit 1)
 *      and names the file, so stale output cannot reach a push.
 *
 * Run: node tests/build-deterministic.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { GENERATED } = require('../scripts/lib/generated-files');

const ROOT = path.resolve(__dirname, '..');
const EPOCH = '1700000000';
const env = { ...process.env, SOURCE_DATE_EPOCH: EPOCH };
const CHAIN = [
  'scripts/generate-content-data.js',
  'scripts/build-workshop-outcomes.js',
  'scripts/build-content-data.js',
  'generate-search-index.js',
  'generate-sitemap.js',
  'scripts/generate-board-data.js',
  'generate-latest-post.js',
];

let failures = 0;
function ok(name, pass) {
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) failures++;
}

function snapshot() {
  const out = {};
  for (const rel of GENERATED) {
    try { out[rel] = fs.readFileSync(path.join(ROOT, rel)); } catch { out[rel] = null; }
  }
  return out;
}

function restore(snap) {
  for (const rel of GENERATED) {
    const fp = path.join(ROOT, rel);
    try {
      if (snap[rel] === null) { if (fs.existsSync(fp)) fs.unlinkSync(fp); }
      else fs.writeFileSync(fp, snap[rel]);
    } catch (e) { console.error('restore failed ' + rel + ': ' + e.message); }
  }
  for (const cache of ['tmp/lastmod-cache.json', '.git/lastmod-cache.json']) {
    try { fs.unlinkSync(path.join(ROOT, cache)); } catch {}
  }
}

function run(file, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, file), ...(args || [])], {
    cwd: ROOT, env, encoding: 'utf8', timeout: 300000,
  });
  if (r.status !== 0) {
    process.stderr.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    throw new Error(file + ' exited ' + r.status);
  }
}

function runChain() {
  for (const file of CHAIN) run(file);
}

const before = snapshot();
try {
  runChain();
  const first = snapshot();
  runChain();
  const second = snapshot();

  const drifted = GENERATED.filter((rel) => {
    const a = first[rel];
    const b = second[rel];
    if (a === null || b === null) return a !== b;
    return !a.equals(b);
  });
  ok('two builds with the same source are byte-identical', drifted.length === 0);
  if (drifted.length) console.log('  changed on second build: ' + drifted.join(', '));

  const target = path.join(ROOT, 'search-index.json');
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('"count"', '"count" '));
  const gate = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-generated-drift.js')], {
    cwd: ROOT, env, encoding: 'utf8', timeout: 300000,
  });
  const gateOut = (gate.stdout || '') + (gate.stderr || '');
  ok('drift gate fails on a tampered generated file', gate.status === 1);
  ok('drift gate names the tampered file', /DRIFT:\s*search-index\.json/.test(gateOut));
  if (gate.status !== 1) console.log('  gate exit: ' + gate.status + '\n' + gateOut.slice(0, 800));
} catch (e) {
  ok('generator chain completed', false);
  console.error(e.message);
} finally {
  restore(before);
}

console.log('\n' + (failures === 0 ? 'BUILD DETERMINISM PASSED' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
