#!/usr/bin/env node
/*
 * scripts/build-quest-rollout.js (A2582)
 * Builds the quest step runtime rollout tracker.
 *
 * A page counts as converted when it loads the shared runtime and calls
 * QuestRuntime. Everything else in the public workshop folder is listed as
 * remaining, so the tracker cannot drift as pages are added or migrated.
 *
 *   node scripts/build-quest-rollout.js --write   write content/quest-rollout.json
 *   node scripts/build-quest-rollout.js --check   fail when the file is stale
 *   node scripts/build-quest-rollout.js           print a summary
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKSHOPS = path.join(ROOT, 'workshops');
const OUT = path.join(ROOT, 'content', 'quest-rollout.json');
const PAGE_TEST_SUFFIXES = ['-http.js', '-smoke.js', '-mobile.js'];

function pageSource(file) {
  const html = fs.readFileSync(path.join(WORKSHOPS, file), 'utf8');
  let all = html;
  let m;
  const re = /\/assets\/js\/inline\/([A-Za-z0-9._-]+\.js)/g;
  while ((m = re.exec(html))) {
    try {
      all += '\n' + fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', m[1]), 'utf8');
    } catch (e) { /* a missing inline script is validate-workshops' job */ }
  }
  return all;
}

function isPublic(source) {
  return !/<meta\s+name=["']robots["'][^>]*noindex/i.test(source);
}

function hasSharedRuntime(source) {
  return /\/assets\/js\/quest-core\/step-runtime\.js/.test(source) && /QuestRuntime/.test(source);
}

function pageTests(file) {
  const base = path.basename(file, '.html');
  return PAGE_TEST_SUFFIXES
    .map(suffix => 'tests/' + base + suffix)
    .filter(rel => fs.existsSync(path.join(ROOT, rel)));
}

function build() {
  const files = fs.readdirSync(WORKSHOPS).filter(file => file.endsWith('.html')).sort();
  const converted = [];
  const remaining = [];
  files.forEach(file => {
    const source = pageSource(file);
    if (!isPublic(source)) return;
    const rel = 'workshops/' + file;
    if (hasSharedRuntime(source)) converted.push({ file: rel, tests: pageTests(file) });
    else remaining.push(rel);
  });
  return {
    definition: 'A workshop is converted when it loads /assets/js/quest-core/step-runtime.js and calls QuestRuntime. Remaining pages have not been migrated yet.',
    runtime: 'assets/js/quest-core/step-runtime.js',
    generatedAt: new Date().toISOString().slice(0, 10),
    converted,
    remaining
  };
}

function serialise(tracker) {
  return JSON.stringify(tracker, null, 2) + '\n';
}

function readTracker() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; }
}

function samePlan(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a.converted) === JSON.stringify(b.converted)
    && JSON.stringify(a.remaining) === JSON.stringify(b.remaining);
}

function main(argv) {
  const next = build();
  if (argv.includes('--write')) {
    fs.writeFileSync(OUT, serialise(next));
    console.log(`quest-rollout: wrote ${next.converted.length} converted and ${next.remaining.length} remaining pages`);
    return 0;
  }
  if (argv.includes('--check')) {
    const current = readTracker();
    if (!current) { console.error('quest-rollout: content/quest-rollout.json is missing. Run --write.'); return 1; }
    if (!samePlan(current, next)) {
      console.error(`quest-rollout: tracker is stale. Run node scripts/build-quest-rollout.js --write (now ${next.converted.length} converted, ${next.remaining.length} remaining).`);
      return 1;
    }
    console.log(`quest-rollout: in sync (${current.converted.length} converted, ${current.remaining.length} remaining)`);
    return 0;
  }
  console.log(`quest-rollout: ${next.converted.length} converted, ${next.remaining.length} remaining`);
  next.converted.forEach(entry => console.log(`  converted ${entry.file} (${entry.tests.length} test${entry.tests.length === 1 ? '' : 's'})`));
  return 0;
}

module.exports = { build, serialise, readTracker, samePlan, pageSource, hasSharedRuntime, isPublic, OUT, ROOT };
if (require.main === module) process.exit(main(process.argv.slice(2)));
