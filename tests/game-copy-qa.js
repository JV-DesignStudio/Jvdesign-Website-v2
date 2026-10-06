// game-copy-qa.js - A794: registry/hub/wrapper copy must match real game behaviour.
// Static content test (no browser): bans false keywords per game, requires
// the truthful replacements. Run: node tests/game-copy-qa.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

// Slice helpers: check only the copy block for each game, not the whole file.
const registry = read('games-registry.js');
const skyBlock = registry.slice(registry.indexOf('"sky-high-friends"') - 50, registry.indexOf('"echo-casebook"'));
const dashStart = registry.indexOf('"lumo-dash"');
const dashBlock = registry.slice(dashStart - 50, dashStart + 2500);
const hub = read('pages/games.html');
const skyCard = hub.slice(hub.indexOf('Sky High With Friends') - 600, hub.indexOf('Sky High With Friends') + 400);
const dashCard = hub.slice(hub.indexOf('<h3 class="game-title">Lumo Dash</h3>') - 300, hub.indexOf('<h3 class="game-title">Lumo Dash</h3>') + 400);
const tigerCard = hub.slice(hub.indexOf('<h3 class="game-title">Tiger Smash</h3>') - 300, hub.indexOf('<h3 class="game-title">Tiger Smash</h3>') + 400);
const dungeonCard = hub.slice(hub.indexOf('<h3 class="game-title">Dungeon Delve</h3>') - 300, hub.indexOf('<h3 class="game-title">Dungeon Delve</h3>') + 400);
const wrapper = read('games/lumo-dash-page.html');
const gameHtml = read('games/sky_high_with_friends.html');

// 1. Sky High has no networking: registry + hub must never promise multiplayer.
for (const [name, text] of [['registry sky-high', skyBlock], ['hub sky-high card', skyCard]]) {
  for (const banned of ['multiplayer', 'race friends', 'race your friends', 'touch the top first', 'rematch']) {
    ok(name + ' bans "' + banned + '"', !text.toLowerCase().includes(banned), 'found in copy');
  }
}
ok('registry sky-high is solo', /solo/i.test(skyBlock));
ok('registry sky-high promises best height', /best height/i.test(skyBlock));
ok('game has no networking code', !/websocket|rtcpeer|xmlhttprequest/i.test(gameHtml));

// 2. Lumo Dash is pattern-memory, not an endless runner.
for (const banned of ['endless runner', 'endless run', 'auto-run', 'coin', 'power-up', 'powerup', 'biome', 'leaderboard', 'magnet', 'shield', 'cacti', 'glowfl']) {
  ok('wrapper bans "' + banned + '"', !wrapper.toLowerCase().includes(banned), 'found in lumo-dash-page.html');
}
ok('wrapper names the 6 courses', /6 (named )?courses|glow finale/i.test(wrapper));
for (const banned of ['endless run', 'auto-run', 'glowfl']) {
  ok('registry lumo-dash bans "' + banned + '"', !dashBlock.toLowerCase().includes(banned), 'found in registry');
}
for (const banned of ['endless', 'coin', 'cacti']) {
  ok('hub lumo-dash card bans "' + banned + '"', !dashCard.toLowerCase().includes(banned), 'found in hub card');
}

// 3. Hub cards: Tiger Smash stars Roar (not Squirt); Dungeon Delve is clue routes (not procedural).
ok('hub tiger-smash names Roar', /roar/i.test(tigerCard));
ok('hub tiger-smash bans Squirt', !/squirt/i.test(tigerCard), 'Squirt is the Sky High axolotl');
ok('hub dungeon-delve bans procedural', !/procedural/i.test(dungeonCard), 'routes are clue-chosen, not generated');
ok('hub dungeon-delve mentions clues', /clue/i.test(dungeonCard));

// 4. Hub sky-high tag matches registry category (Action, not Platformer).
ok('hub sky-high tag is Action', />action</i.test(skyCard));

if (failures) {
  console.log('\nFAIL game-copy-qa: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS game-copy-qa: all behaviour-map checks green');
