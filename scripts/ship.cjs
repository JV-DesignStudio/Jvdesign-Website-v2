#!/usr/bin/env node
/*
 * scripts/ship.cjs - one-command ship.
 *
 * Rebuild generated files, stage everything (social-posts is gitignored), commit
 * and push. Replaces the manual dance of broad-commit overrides + drift regen.
 *
 * Usage:
 *   node scripts/ship.cjs "commit message"
 *   npm run ship -- "commit message"
 *
 * Notes:
 * - The pre-push drift hook regenerates generated files; because we build first,
 *   the committed files match, so a normal ship passes without a manual
 *   check-generated-drift --fix step.
 * - ALLOW_BROAD_COMMIT=1 is set for the commit because a deliberate ship
 *   intentionally includes the per-page build outputs.
 */
const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const msg = process.argv.slice(2).join(' ').trim() || `ship: ${new Date().toISOString().slice(0, 10)}`;

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}
function out(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}

console.log('ship: build');
run('node build.js');

console.log('ship: stage');
run('git add -A');

const staged = out('git diff --cached --name-only');
if (!staged) {
  console.log('ship: nothing to commit. Working tree clean.');
} else {
  const count = staged.split('\n').filter(Boolean).length;
  console.log(`ship: commit ${count} file(s)`);
  run(`git commit -m ${JSON.stringify(msg)}`, { env: { ...process.env, ALLOW_BROAD_COMMIT: '1' } });
}

// Anything the build regenerated after staging? Fold it in so the push gate is clean.
const dirty = out('git status --porcelain');
if (dirty) {
  const regen = dirty.split('\n').filter(l => / (board-data\.json|content-data\.js|content\/stats\.json|search-index\.json|sitemap\.xml|latest-post\.json|content\/)/.test(l));
  if (regen.length) {
    console.log('ship: fold in regenerated data');
    run('git add ' + regen.map(l => `"${l.slice(3).trim()}"`).join(' '));
    run('git commit -m "chore: regenerate site data"', { env: { ...process.env, ALLOW_BROAD_COMMIT: '1' } });
  }
}

console.log('ship: push');
run('git push');
console.log('ship: done');
