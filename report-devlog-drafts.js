#!/usr/bin/env node
/*
 * report-devlog-drafts.js - list devlog-data.js entries that must not be public:
 * internal board drafts (hard markers) and internal release/audit notes (soft text).
 * Read-only. Exit 1 if any are found so it can be used as a gate.
 *
 * Run: node report-devlog-drafts.js   (npm run report:devlog-drafts)
 */
const { loadPosts, findUnpublishable } = require('./scripts/lib/devlog-guard');

const posts = loadPosts();
const bad = findUnpublishable(posts).sort((a, b) => Number(b.id) - Number(a.id));

console.log(`devlog-data.js: ${posts.length} posts, ${bad.length} not publication-clean`);
for (const p of bad) {
  console.log(`  id ${p.id ?? '?'}  [${p.markers.length ? p.markers.join(', ') : 'internal-text'}]  ${p.title.slice(0, 72)}`);
}

if (bad.length) {
  console.error(`\n✗ ${bad.length} post(s) leak board drafts or internal release/audit notes. Rewrite for learners or move to studio-workspace/devlog-archive-internal.json.`);
  process.exit(1);
}
console.log('✓ all posts are publication-clean');
