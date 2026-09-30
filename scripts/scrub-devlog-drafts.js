#!/usr/bin/env node
/*
 * scripts/scrub-devlog-drafts.js - remove internal draft entries from devlog-data.js.
 *
 * Report-only by default. Pass --write to apply. Uses the shared devlog-guard
 * string-aware parser so entry boundaries are exact (content strings can contain
 * braces, quotes and newlines). Removes each contiguous run of draft entries from
 * the run start to the next kept entry, so surrounding formatting is preserved and
 * the diff is minimal. Always review `git diff devlog-data.js` afterwards.
 *
 * Run:
 *   node scripts/scrub-devlog-drafts.js          (dry run - lists what would go)
 *   node scripts/scrub-devlog-drafts.js --write   (apply)
 */
const fs = require('fs');
const { DEVLOG, readSource, parseEntries, markersIn, isInternalText } = require('./lib/devlog-guard');

const WRITE = process.argv.includes('--write');
const text = readSource();
const { closeBracket, entries } = parseEntries(text);

const draftIdx = [];
entries.forEach((e, i) => { if (markersIn(e.raw).length || isInternalText(e.title)) draftIdx.push(i); });

if (!draftIdx.length) { console.log('✓ no draft entries to remove'); process.exit(0); }

// Group consecutive indices into runs of [first, last].
const runs = [];
let s = draftIdx[0], p = draftIdx[0];
for (let k = 1; k < draftIdx.length; k++) {
  if (draftIdx[k] === p + 1) { p = draftIdx[k]; }
  else { runs.push([s, p]); s = draftIdx[k]; p = draftIdx[k]; }
}
runs.push([s, p]);

const removals = runs.map(([a, b]) => {
  const start = entries[a].start;
  const end = b + 1 < entries.length ? entries[b + 1].start : closeBracket;
  return { start, end, count: b - a + 1, firstId: entries[a].id, lastId: entries[b].id };
});

let removed = 0;
const out = (() => {
  let res = text;
  for (const r of removals.slice().sort((x, y) => y.start - x.start)) {
    res = res.slice(0, r.start) + res.slice(r.end);
    removed += r.count;
  }
  return res;
})();

console.log(`devlog-data.js: ${entries.length} entries, ${draftIdx.length} drafts in ${runs.length} run(s)`);
for (const r of removals) console.log(`  remove ids ${r.firstId}..${r.lastId} (${r.count}) chars ${r.start}-${r.end}`);

if (!WRITE) { console.log(`\n[dry-run] would remove ${removed} entries. Re-run with --write to apply.`); process.exit(0); }

fs.writeFileSync(DEVLOG, out);
console.log(`\n✓ removed ${removed} draft entries; ${entries.length - removed} posts remain`);
