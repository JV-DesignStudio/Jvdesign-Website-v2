/* A1424: game quality labels.

   Every game in games-registry.js carries one public quality label
   (READY / BETA / EXPERIMENT / HIDDEN), the arcade renders it, and the
   definitions are documented in GAME_QUALITY.md.

   Run: node tests/game-quality.js
*/
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

// 1. load the registry (it assigns window.JVDS_GAMES and JVDS_GAME_QUALITY)
global.window = {};
require(path.join(root, 'games-registry.js'));
const games = global.window.JVDS_GAMES || [];
const labels = global.window.JVDS_GAME_QUALITY || {};

const ALLOWED = ['READY', 'BETA', 'EXPERIMENT', 'HIDDEN'];
const counts = { READY: 0, BETA: 0, EXPERIMENT: 0, HIDDEN: 0 };

check('registry has games', games.length > 0, games.length + ' games');

for (const g of games) {
  const q = g.quality;
  const ok = ALLOWED.includes(q);
  if (ok) counts[q]++;
  check('label valid: ' + g.id, ok, q);
  if (labels[g.id] && labels[g.id] !== q) check('label matches the map: ' + g.id, false, labels[g.id] + ' != ' + q);
}

check('every listed game has a valid label', games.every(g => ALLOWED.includes(g.quality)));
check('at least one READY game', counts.READY > 0, 'READY ' + counts.READY);
check('at least one BETA game', counts.BETA > 0, 'BETA ' + counts.BETA);
check('no HIDDEN game is listed', counts.HIDDEN === 0, 'HIDDEN ' + counts.HIDDEN);

// 2. the arcade renders the label
const arcade = fs.readFileSync(path.join(root, 'arcade.html'), 'utf8');
check('arcade renders the quality pill', /cab-q--/.test(arcade) && /g\.quality/.test(arcade));
check('arcade explains the labels', /qualityLegend/.test(arcade) && /Experiment/i.test(arcade));

// 3. the definitions are documented
const doc = fs.readFileSync(path.join(root, 'GAME_QUALITY.md'), 'utf8');
for (const w of ALLOWED) check('doc defines ' + w, new RegExp('\\b' + w + '\\b').test(doc));

console.log('\nlabels: ' + JSON.stringify(counts));
if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
console.log('\nALL GAME QUALITY CHECKS PASSED');
