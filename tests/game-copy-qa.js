// game-copy-qa.js - registry/arcade copy must match real game behaviour.
// Static content test (no browser): bans false keywords for the live line-up
// and requires the truthful replacements. Run: node tests/game-copy-qa.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

const registry = read('games-registry.js');
const arcade = read('arcade.html');
const live = [...registry.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map(m => m[1]);

// 1. The agreed live line-up is present.
for (const id of ['echo-flight', 'nova-siege', 'arcane-citadel', 'tower-defence', 'ember-smash',
  'gem-match', 'highway-dodge', 'cozy-cafe-match', 'biscuit-clicker', 'sky-high-friends']) {
  ok('line-up includes ' + id, live.includes(id));
}

// 2. Sky High has no networking: copy must never promise multiplayer.
const skyStart = registry.indexOf('"sky-high-friends"');
const skyBlock = registry.slice(skyStart - 40, skyStart + 1800);
for (const banned of ['multiplayer', 'race friends', 'race your friends', 'touch the top first', 'rematch']) {
  ok('sky-high bans "' + banned + '"', !skyBlock.toLowerCase().includes(banned), 'found in copy');
}
ok('sky-high is described as solo', /solo/i.test(skyBlock));
ok('sky-high promises a best height', /best height/i.test(skyBlock));

// 3. No live entry promises multiplayer anywhere.
ok('no live entry promises multiplayer', !/multiplayer/i.test(registry));

// 4. Every live entry has a player-facing line and an objective.
for (const id of live) {
  const start = registry.indexOf('"id": "' + id + '"');
  const block = registry.slice(start, start + 1600);
  ok(id + ': has a desc line', /"desc"\s*:\s*"[^"]{30,}"/.test(block));
  ok(id + ': has an objective', /"objective"\s*:\s*"[^"]{15,}"/.test(block));
}

// 5. The arcade links straight to the registry files (no stale wrapper hub).
ok('arcade links to the registry game files', /games\/' \+ encodeURI\(g\.file\)/.test(arcade));

// 6. A1677: every catalogued game pairs with a real learning next step, and
// Lumo is the voice that says what the player is practising.
for (const id of live) {
  const start = registry.indexOf('"id": "' + id + '"');
  const nextId = registry.indexOf('"id": "', start + 5);
  const block = registry.slice(start, nextId < 0 ? registry.length : nextId);
  const href = (block.match(/"learnHref"\s*:\s*"([^"]+)"/) || [])[1] || '';
  const label = (block.match(/"learnLabel"\s*:\s*"([^"]+)"/) || [])[1] || '';
  ok(id + ': has a learning link', !!href, href || 'missing');
  ok(id + ': learning link has a label', label.length >= 8, label || 'missing');
  if (href) {
    const rel = href.replace(/^\//, '');
    ok(id + ': learning link resolves', fs.existsSync(path.join(ROOT, rel)), href);
  }
}
ok('arcade gives Lumo a learning voice', /Lumo:<\/strong>/.test(arcade) && /cab-learn-link/.test(arcade));

if (failures) {
  console.log('\nFAIL game-copy-qa: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS game-copy-qa: all behaviour-map checks green');
