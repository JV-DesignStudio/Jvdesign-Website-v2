#!/usr/bin/env node
/**
 * scripts/validate/index.js - Run all validators in sequence, single exit code.
 * Old: validate = validate-links && validate-css && validate-js && validate-contrast && validate-workshops
 * Now: one place to add/skip validators, with timing.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/paths');

const STEPS = [
  { id: 'links',     cmd: path.join(ROOT, 'validate-links.js'),     label: 'Internal links' },
  { id: 'css',       cmd: path.join(ROOT, 'validate-css.js'),       label: 'Inline CSS parse' },
  { id: 'js',        cmd: path.join(ROOT, 'validate-js.js'),        label: 'Live JS (puppeteer)' },
  { id: 'contrast',  cmd: path.join(ROOT, 'validate-contrast.js'),  label: 'Colour contrast' },
  { id: 'workshops', cmd: path.join(ROOT, 'validate-workshops.js'), label: 'Workshop front-matter' },
];

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
    execFileSync(process.execPath, [s.cmd], { stdio: 'inherit' });
    console.log(`✓ ${Date.now() - t0}ms`);
  } catch {
    console.log(`✗ ${Date.now() - t0}ms`);
    ok = false;
  }
}
console.log(`└─ ${ok ? 'All checks passed' : 'Some checks failed'} ─────────────────────`);
process.exit(ok ? 0 : 1);
