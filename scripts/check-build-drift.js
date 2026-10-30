#!/usr/bin/env node
/**
 * A1994 — clean build output drift check.
 *
 * After `npm run build` runs in CI, this script calls `git ls-files --others
 * --exclude-standard` to find any untracked files that the build created but
 * that are NOT in .gitignore and are NOT in the known-generated list below.
 *
 * An untracked file after a clean build means either:
 *   a) a new generated artefact that wasn't added to .gitignore or committed, or
 *   b) a build step writing to a path nobody expected.
 *
 * Both are worth flagging. The KNOWN_GENERATED list covers files that the build
 * legitimately rewrites on every run; they stay untracked in CI (fresh checkout,
 * nothing staged) but are expected drift.
 */

const { execSync } = require('node:child_process');
const path         = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Files the build pipeline is known to rewrite. These are allowed to appear
// untracked after a fresh build; everything else is unexpected drift.
const KNOWN_GENERATED = new Set([
  'content/workshops.json',
  'content/games.json',
  'content/tools.json',
  'content/books.json',
  'content/characters.json',
  'content/paths.json',
  'content/stats.json',
  'content-data.js',
  'search-index.json',
  'sitemap.xml',
  'board-data.json',
  'latest-post.json',
  'devlog-data.js',
  // redirect stubs written by the redirects stage
]);

// Redirect stub pattern — build writes these under pages/ from redirects.json.
function isRedirectStub(relPath) {
  return relPath.startsWith('pages/') && relPath.endsWith('.html');
}

function getUntracked() {
  try {
    const out = execSync('git ls-files --others --exclude-standard', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const untracked = getUntracked();
const unexpected = untracked.filter(f => !KNOWN_GENERATED.has(f) && !isRedirectStub(f));

if (unexpected.length === 0) {
  console.log(`build drift OK — ${untracked.length} known generated file(s), 0 unexpected`);
  process.exit(0);
}

console.error(`\nbuild drift FAIL — ${unexpected.length} unexpected untracked file(s) after npm run build:`);
unexpected.forEach(f => console.error(`  ✗  ${f}`));
console.error('\nIf these are intentional new outputs: add them to KNOWN_GENERATED in');
console.error('scripts/check-build-drift.js and commit or .gitignore them.');
process.exit(1);
