#!/usr/bin/env node
/**
 * tests/workshop-paths.js
 * Guards the learning-path data on the workshop hub.
 *
 * content/paths.json is consumed by the next-workshop signpost
 * (workshop-enhancements.js) and by the hub. Every workshop id it
 * references must exist as a file under workshops/, or learners hit a 404.
 *
 * Run: node tests/workshop-paths.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PATHS_FILE = path.join(ROOT, 'content', 'paths.json');
const WORKSHOPS_DIR = path.join(ROOT, 'workshops');

function fail(lines) {
  console.error('FAIL tests/workshop-paths.js');
  lines.forEach((l) => console.error('  ' + l));
  process.exit(1);
}

if (!fs.existsSync(PATHS_FILE)) fail(['content/paths.json not found']);

let paths;
try {
  paths = JSON.parse(fs.readFileSync(PATHS_FILE, 'utf8'));
} catch (e) {
  fail(['content/paths.json is not valid JSON: ' + e.message]);
}

if (!Array.isArray(paths) || !paths.length) fail(['content/paths.json has no paths']);

const files = new Set(
  fs.readdirSync(WORKSHOPS_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace('.html', ''))
);

const problems = [];
const seen = new Set();

paths.forEach((p) => {
  if (!p.id) { problems.push('a path is missing an id'); return; }
  if (seen.has(p.id)) problems.push(`duplicate path id "${p.id}"`);
  seen.add(p.id);
  if (!Array.isArray(p.levels) || !p.levels.length) {
    problems.push(`path "${p.id}" has no levels`);
    return;
  }
  p.levels.forEach((level, i) => {
    if (!Array.isArray(level.workshops) || !level.workshops.length) {
      problems.push(`path "${p.id}" level ${i + 1} has no workshops`);
      return;
    }
    level.workshops.forEach((w) => {
      if (!files.has(w)) problems.push(`path "${p.id}" -> workshop "${w}" missing (workshops/${w}.html)`);
    });
  });
});

if (problems.length) fail(problems);

const totalLevels = paths.reduce((n, p) => n + p.levels.length, 0);
const ids = paths.reduce((n, p) => n + p.levels.reduce((m, l) => m + l.workshops.length, 0), 0);
console.log(`PASS tests/workshop-paths.js: ${paths.length} paths, ${totalLevels} levels, ${ids} workshop refs all resolve`);
