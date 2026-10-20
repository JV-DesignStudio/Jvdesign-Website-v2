#!/usr/bin/env node
// A1723 engine adoption gate: every live arcade cabinet must load game-system.js
// and game-onboarding.js. Adoption of game-shell.js, story-run.js,
// engine-runtime.js and game-kit.js is tracked as a report (not a hard gate).
//
// Run: node tests/engine-adoption.js
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');

// Read the curated line-up from games-registry.js.
const regCtx = { window: {} };
vm.createContext(regCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8'), regCtx);
const registry = regCtx.window.JVDS_GAMES || [];
const gameFiles = registry.map(g => g.file);

// Hard gate: every cabinet must include these two.
const REQUIRED = ['game-system.js', 'game-onboarding.js'];

// Tracked (report only, not a failure).
const OPTIONAL = ['game-shell.js', 'story-run.js', 'engine-runtime.js', 'game-kit.js'];

let failures = 0;
const adoption = {};
for (const opt of OPTIONAL) adoption[opt] = [];

console.log(`Engine adoption gate - ${gameFiles.length} cabinet(s) in registry\n`);

for (const file of gameFiles) {
  const htmlPath = path.join(GAMES_DIR, file);
  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (e) {
    console.log(`✗ ${file} - could not read: ${e.message}`);
    failures++;
    continue;
  }

  let ok = true;
  for (const req of REQUIRED) {
    if (!html.includes(req)) {
      console.log(`✗ ${file} - missing required script: ${req}`);
      failures++;
      ok = false;
    }
  }
  if (ok) console.log(`✓ ${file}`);

  for (const opt of OPTIONAL) {
    if (html.includes(opt)) adoption[opt].push(file);
  }
}

console.log('\nAdoption report (optional scripts):');
for (const opt of OPTIONAL) {
  const count = adoption[opt].length;
  const pct   = gameFiles.length ? Math.round(count / gameFiles.length * 100) : 0;
  const names = count ? adoption[opt].join(', ') : 'none';
  console.log(`  ${opt.padEnd(22)} ${String(count).padStart(2)}/${gameFiles.length} (${pct}%)  ${names}`);
}

console.log(
  failures
    ? `\n✗ engine-adoption: ${failures} cabinet(s) failed the gate`
    : `\n✓ engine-adoption: all ${gameFiles.length} cabinet(s) pass the gate`
);
process.exit(failures ? 1 : 0);
