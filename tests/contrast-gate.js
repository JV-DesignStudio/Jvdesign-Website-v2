#!/usr/bin/env node
/*
 * tests/contrast-gate.js - proves validate-contrast.js catches low-contrast
 * headings. Creates a seeded bad page, runs the validator in --strict mode,
 * asserts it exits non-zero, then removes the page. If the validator passes
 * the bad page, this test exits 1.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, '_contrast-seed-test.html');

const BAD_PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Seeded contrast failure</title>
<style>body{background:#f0ead6;margin:40px;font-family:sans-serif}</style>
</head><body>
<h1 style="color:#f0ead6">This heading is invisible (beige on beige)</h1>
</body></html>`;

fs.writeFileSync(SEED, BAD_PAGE);

let caught = false;
try {
  execFileSync(process.execPath, [path.join(ROOT, 'validate-contrast.js'), '--strict'], {
    cwd: ROOT, timeout: 180_000, stdio: 'pipe'
  });
} catch (e) {
  if (e.status && e.status !== 0) caught = true;
  else throw e;
} finally {
  try { fs.unlinkSync(SEED); } catch {}
}

if (!caught) {
  console.log('✗ contrast-gate: validate-contrast.js did NOT fail on a seeded low-contrast page');
  process.exit(1);
}
console.log('✓ contrast-gate: validator correctly rejects a seeded low-contrast heading');
