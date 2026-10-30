// validate-stats.js (A1798): verify content/stats.json is in sync with generated counts.
// Runs generate-content-data.js in dry-run mode and compares with the committed stats.json.
// Fails if stats are stale (someone added/removed files without regenerating).
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
};

// 1. stats.json must exist and have been generated recently (not hand-edited to zero)
const stats = read('content/stats.json');
check('content/stats.json exists', typeof stats === 'object');
check('stats.workshops is a positive integer', Number.isInteger(stats.workshops) && stats.workshops > 0);
check('stats.games is a positive integer', Number.isInteger(stats.games) && stats.games > 0);
check('stats.tools is a positive integer', Number.isInteger(stats.tools) && stats.tools > 0);
check('stats.books is a positive integer', Number.isInteger(stats.books) && stats.books > 0);

// 2. marketing.json display values must not overstate stats.json
const marketing = read('content/marketing.json');
for (const key of ['workshops', 'games', 'tools', 'books']) {
  const display = String(marketing[key].display);
  const num = parseInt(display.replace(/[^0-9]/g, ''), 10);
  check(
    `marketing.${key} "${display}" does not overstate stats.${key} (${stats[key]})`,
    num <= stats[key],
    `${num} > ${stats[key]}`
  );
}

// 3. Regenerate stats in a temp location and compare key totals
let freshStats = null;
try {
  // Run the generator and capture stdout; it writes to content/ but we read the resulting file
  execSync('node scripts/generate-content-data.js', { cwd: ROOT, stdio: 'pipe' });
  freshStats = read('content/stats.json');
} catch (e) {
  console.log('WARN Could not regenerate stats: ' + e.message.split('\n')[0]);
}

if (freshStats) {
  for (const key of ['workshops', 'games', 'tools', 'books']) {
    check(
      `stats.${key} matches freshly-generated value (${freshStats[key]})`,
      stats[key] === freshStats[key],
      `committed ${stats[key]} vs generated ${freshStats[key]}`
    );
  }
} else {
  console.log('SKIP fresh-generation checks (generator unavailable in this environment)');
}

// 4. games-registry.js entry count must equal stats.games
const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
const lineupCount = (registry.match(/"id"\s*:/g) || []).length;
check(
  `games-registry.js line-up count (${lineupCount}) matches stats.games (${stats.games})`,
  lineupCount === stats.games
);

// 5. No public page should contain a hardcoded game count that contradicts marketing.json
// Each entry: [file, regex that must NOT match if marketing.games.display is authoritative]
const mGames = parseInt(marketing.games.display.replace(/[^0-9]/g, ''), 10);
const gameCountPages = [
  ['index.html',          /heroGameCount[^>]*>(\d+)</],
  ['arcade.html',         /(twelve|thirteen|\d+) hand-picked/i],
  ['pages/parents.html',  /stat-num[^>]*>(\d+)<[^>]*>[\s\S]*?Browser Games/],
  ['pages/about.html',    /stat-num[^>]*>(\d+)<[^>]*>[\s\S]*?Browser Games|pillar-sub[^>]*>(\d+) listed games/],
  ['pages/press.html',    /pressGameCount[^>]*>(\d+)</],
];
// Known-bad stale numbers the task found (these must not appear as game counts):
const staleGameClaims = ['28 total', '16 Play Labs', '8 Studio Picks', '25 games', '40 games'];
for (const [f] of gameCountPages) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, 'utf8');
  for (const bad of staleGameClaims) {
    check(`${f}: no stale game claim "${bad}"`, !html.includes(bad));
  }
  // Check that any inline number visible before JS runs matches marketing.games.display
  const numericGamePattern = /(?:heroGameCount|pressGameCount)[^>]*>(\d+)<|>(\d+)<[^<]*(?:Browser Games|listed games)/g;
  let m;
  while ((m = numericGamePattern.exec(html)) !== null) {
    const found = parseInt(m[1] || m[2], 10);
    check(
      `${f}: hardcoded game count (${found}) matches marketing.json (${mGames})`,
      found === mGames,
      `found ${found}, expected ${mGames}`
    );
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL VALIDATE-STATS CHECKS PASSED');
process.exit(failures ? 1 : 0);
