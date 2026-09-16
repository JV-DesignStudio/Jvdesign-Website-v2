#!/usr/bin/env node
// check-staged-dashes.js - used by .githooks/pre-commit.
// Reports em/en dashes in the lines being added by this commit (public text only).
// Report-only: it never rewrites or stages files. Exit 1 blocks the commit.
const { execSync } = require('child_process');

const diff = execSync('git diff --cached -U0 --diff-filter=ACM', { encoding: 'utf8', maxBuffer: 1 << 28 });
const PUBLIC = /\.(html|md|json|js|css|txt|xml)$/i;
const SKIP = /^(node_modules|tests|scripts|tmp|social-posts)\//;
let file = '';
const hits = [];
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) { file = line.replace(/^\+\+\+ b\//, ''); continue; }
  if (!PUBLIC.test(file) || SKIP.test(file)) continue;
  if (line.startsWith('+') && /[--]/.test(line)) hits.push(`${file}: ${line.slice(1).trim().slice(0, 120)}`);
}
if (hits.length) {
  console.log(`\n  Blocked: ${hits.length} new line(s) with em/en dashes (use a comma, colon or " - " instead):\n`);
  hits.slice(0, 20).forEach(h => console.log('    ' + h));
  console.log('\n  Nothing was changed for you. Edit the lines, re-stage, commit again.');
  console.log('  Bypass once: git commit --no-verify\n');
  process.exit(1);
}
