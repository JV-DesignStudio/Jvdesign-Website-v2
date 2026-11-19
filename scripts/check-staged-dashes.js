#!/usr/bin/env node
// check-staged-dashes.js - used by .githooks/pre-commit.
// Auto-fixes em/en dashes in staged public files, re-stages, and continues.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const diff = execSync('git diff --cached -U0 --diff-filter=ACM', { encoding: 'utf8', maxBuffer: 1 << 28 });
const PUBLIC = /\.(html|md|json|js|css|txt|xml)$/i;
const SKIP = /^(node_modules|tests|scripts|tmp|social-posts|books)\//;
const SKIP_FILES = new Set(['GROWTH_PROMPTS.md']);
// em dash (U+2014) and en dash (U+2013) via char code to avoid literal chars in source
const EM = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);
const EM_EN = new RegExp('[' + EM + EN + ']', 'g');

let file = '';
const hitFiles = new Set();
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) { file = line.replace(/^\+\+\+ b\//, ''); continue; }
  if (!PUBLIC.test(file) || SKIP.test(file) || SKIP_FILES.has(file)) continue;
  if (line.startsWith('+') && EM_EN.test(line)) hitFiles.add(file);
}

if (!hitFiles.size) process.exit(0);

// Auto-fix: replace em/en dashes with " - " in affected files, re-stage
const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const fixed = [];
const failed = [];
for (const rel of hitFiles) {
  const abs = path.join(root, rel);
  try {
    const original = fs.readFileSync(abs, 'utf8');
    const patched = original.replace(EM_EN, ' - ');
    if (patched !== original) {
      fs.writeFileSync(abs, patched, 'utf8');
      execSync(`git add "${abs}"`, { encoding: 'utf8' });
      fixed.push(rel);
    }
  } catch (e) {
    failed.push(`${rel}: ${e.message}`);
  }
}

if (fixed.length) {
  console.log(`\n  [auto-fix] replaced em/en dashes in ${fixed.length} file(s) and re-staged:`);
  fixed.forEach(f => console.log('    ' + f));
}
if (failed.length) {
  console.log(`\n  [auto-fix] could not fix ${failed.length} file(s) - fix manually:`);
  failed.forEach(f => console.log('    ' + f));
  process.exit(1);
}
// exit 0: commit proceeds with fixed files
