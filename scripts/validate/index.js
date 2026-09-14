#!/usr/bin/env node
/**
 * scripts/validate/index.js - Run all validators in sequence, single exit code.
 * Old: validate = validate-links && validate-css && validate-js && validate-contrast && validate-workshops
 * Now: one place to add/skip validators, with timing.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/paths');

const isNightly = process.argv.includes('--nightly') || process.env.NIGHTLY==='1';
const STEPS = [
  { id: 'links',     cmd: path.join(ROOT, 'validate-links.js'),     label: 'Internal links' },
  { id: 'css',       cmd: path.join(ROOT, 'validate-css.js'),       label: 'Inline CSS parse' },
  { id: 'js',        cmd: path.join(ROOT, 'validate-js.js'),        label: 'Live JS (puppeteer)' },
  { id: 'contrast',  cmd: path.join(ROOT, 'validate-contrast.js'),  label: 'Colour contrast', nightly: true },
  { id: 'workshops', cmd: path.join(ROOT, 'validate-workshops.js'), label: 'Workshop front-matter' },
  { id: 'public',    cmd: path.join(ROOT, 'scripts/validate-public-boundary.js'), label: 'Public boundary' },
  { id: 'drift',     cmd: path.join(ROOT, 'scripts/check-generated-drift.js'), label: 'Generated drift' },
].filter(s=> !s.nightly || isNightly);

const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
const plan = only ? STEPS.filter(s => s.id === only) : STEPS;
if (only && plan.length === 0) {
  console.error(`Unknown --only=${only}. Valid: ${STEPS.map(s => s.id).join(', ')}`);
  process.exit(1);
}

console.log(`\n┌─ Validate - ${plan.length}/${STEPS.length} check(s) ─────────────────`);
let ok = true;
for (const s of plan) {
  const t0 = Date.now();
  process.stdout.write(`│ ▶ ${s.id.padEnd(10)} ${s.label} ... `);
  try {
    execFileSync(process.execPath, [s.cmd], { stdio: 'inherit', timeout: 120000, killSignal: 'SIGTERM' });
    console.log(`✓ ${Date.now() - t0}ms`);
  } catch (e) {
    if(e.killed) console.log(`✗ timeout ${Date.now() - t0}ms`);
    else console.log(`✗ ${Date.now() - t0}ms`);
    ok = false;
  }
}
console.log(`└─ ${ok ? 'All checks passed' : 'Some checks failed'} ─────────────────────`);
process.exit(ok ? 0 : 1);
