#!/usr/bin/env node
/*
 * check-staged-scope.js - pre-commit guard against broad `git add -A` commits.
 *
 * Several agents share this working tree. A broad staging sweep bundles
 * another agent's half-finished work into your commit and makes history
 * impossible to reason about. This guard fails when a commit stages a
 * suspiciously large slice of the repo, and prints which top-level areas are
 * involved so you can split it.
 *
 * Override once with:  ALLOW_BROAD_COMMIT=1 git commit ...   (or --no-verify)
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ALLOW = process.env.ALLOW_BROAD_COMMIT === '1';
const MAX_FILES = 80;

let files = [];
try {
  files = execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
} catch {
  process.exit(0);
}

if (!files.length) process.exit(0);

const laneOf = f => (f.includes('/') ? f.split('/')[0] : '(root)');
const lanes = [...new Set(files.map(laneOf))].sort();

if (files.length > MAX_FILES && !ALLOW) {
  console.log('');
  console.log(`  \u26a0 Broad staging detected: ${files.length} files across ${lanes.length} areas.`);
  console.log(`    Areas: ${lanes.slice(0, 12).join(', ')}${lanes.length > 12 ? ', ...' : ''}`);
  console.log('    This usually means a `git add -A` swept up another task/agent\'s work.');
  console.log('    Stage only your task\'s files, or set ALLOW_BROAD_COMMIT=1 to override.');
  console.log('');
  process.exit(1);
}

process.exit(0);
