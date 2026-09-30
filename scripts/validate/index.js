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
// Per-step timeout. Every step gets the same generous cap so a slow machine or a
// busy CPU never trips a false "timeout"; a timeout here should mean a genuine
// hang, not a flake. css/js were already at 300s because they drive puppeteer;
// the static scans (links is the largest) were silently dying at the old 120s
// default under load. Override with VALIDATE_STEP_TIMEOUT_MS if ever needed.
const STEP_TIMEOUT = Number(process.env.VALIDATE_STEP_TIMEOUT_MS || 300000);
const STEPS = [
  { id: 'links',     cmd: path.join(ROOT, 'validate-links.js'),     label: 'Internal links' },
  { id: 'css',       cmd: path.join(ROOT, 'validate-css.js'),       label: 'Inline CSS parse' },
  { id: 'js',        cmd: path.join(ROOT, 'validate-js.js'),        label: 'Live JS (puppeteer)' },
  { id: 'contrast',  cmd: path.join(ROOT, 'validate-contrast.js'),  label: 'Colour contrast', nightly: true },
  { id: 'a11y',      cmd: path.join(ROOT, 'validate-a11y.js'),      label: 'Accessibility report', nightly: true },
  { id: 'workshops', cmd: path.join(ROOT, 'validate-workshops.js'), label: 'Workshop front-matter' },
  { id: 'stats',     cmd: path.join(ROOT, 'validate-stats.js'),     label: 'Marketing counts' },
  { id: 'quests',    cmd: path.join(ROOT, 'validate-quests.js'),    label: 'Quest references' },
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
    execFileSync(process.execPath, [s.cmd], { stdio: 'inherit', timeout: s.timeout || STEP_TIMEOUT, killSignal: 'SIGTERM' });
    console.log(`✓ ${Date.now() - t0}ms`);
  } catch (e) {
    if(e.killed) console.log(`✗ timeout ${Date.now() - t0}ms`);
    else console.log(`✗ ${Date.now() - t0}ms`);
    ok = false;
  }
}
console.log(`└─ ${ok ? 'All checks passed' : 'Some checks failed'} ─────────────────────`);
process.exit(ok ? 0 : 1);
