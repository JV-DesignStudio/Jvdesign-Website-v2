const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// games-registry.js assigns window.JVDS_GAMES, and is the id -> file map.
global.window = {};
require(path.join(ROOT, 'games-registry.js'));
const games = (global.window && global.window.JVDS_GAMES) || [];
const byId = {};
for (const game of games) byId[game.id] = game;

// docs/GAME_CURATION.json is the single source of truth for the Flagship tier.
const curation = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'GAME_CURATION.json'), 'utf8'));
const flagshipIds = curation.flagship || [];
if (!flagshipIds.length) {
  console.error('[FAIL] docs/GAME_CURATION.json has no flagship list');
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
console.log(`Game quality gate passed for ${studioPicks.length} Flagship game(s) from docs/GAME_CURATION.json.`);
