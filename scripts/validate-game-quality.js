const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// games-registry.js assigns window.JVDS_GAMES, and is the id -> file map.
global.window = {};
require(path.join(ROOT, 'games-registry.js'));
const games = (global.window && global.window.JVDS_GAMES) || [];
const byId = {};
for (const game of games) byId[game.id] = game;

// The Flagship tier comes from the private curation file docs/GAME_CURATION.json
// when it is present (studio mirror). After A779 that file left the public repo,
// so fall back to the public tier flag on games-registry.js. The gate must never
// crash on a clean checkout.
const curationPath = path.join(ROOT, 'docs', 'GAME_CURATION.json');
const curationPresent = fs.existsSync(curationPath);
let flagshipIds = [];
if (curationPresent) {
  flagshipIds = JSON.parse(fs.readFileSync(curationPath, 'utf8')).flagship || [];
} else {
  flagshipIds = games.filter(g => g.tier === 'flagship').map(g => g.id);
}
if (!flagshipIds.length) {
  console.error('[FAIL] no flagship tier found in docs/GAME_CURATION.json or the tier flag in games-registry.js');
  process.exit(1);
}

const studioPicks = [];
for (const id of flagshipIds) {
  const game = byId[id];
  if (!game) {
    console.error(`[FAIL] flagship id "${id}" is not in games-registry.js`);
    process.exit(1);
  }
  studioPicks.push('games/' + game.file);
}

const polishSignals = {
  'games/arcane_citadel_page.html': [/quality-panel/, /hero-badges/, /boss-card/]
};

let failed = false;
for (const file of studioPicks) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const checks = [
    ['quality panel', /quality-panel|gd-quality-panel/],
    ['goal label', /<b>Goal<\/b>/],
    ['skill label', /<b>Skill<\/b>/],
    ['session label', /<b>Session<\/b>/],
    ['build next label', /<b>Build next<\/b>/],
    ['build link', /href="\.\.\/tools\//],
    ['save/progress hook', /addScore|recordGamePlay|saveState|localStorage/]
  ];
  for (const [name, pattern] of checks) {
    if (!pattern.test(html)) {
      console.error(`[FAIL] ${file}: missing ${name}`);
      failed = true;
    }
  }
  const missingSignals = (polishSignals[file] || []).filter(pattern => !pattern.test(html));
  if (missingSignals.length) {
    console.error(`[FAIL] ${file}: missing Studio Pick polish signals (${missingSignals.length})`);
    failed = true;
  }
}

if (failed) process.exit(1);
const source = curationPresent ? 'docs/GAME_CURATION.json' : 'the games-registry.js tier flag';
console.log(`Game quality gate passed for ${studioPicks.length} Flagship game(s) from ${source}.`);
