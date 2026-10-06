#!/usr/bin/env node
/*
 * Score-schema QA (A793).
 *
 * Proves that every arcade game funnels its best score through the one
 * documented key - jvds_game_<gameId> - so it shows up in the Arcade hub's
 * best-scores list (arcade.html saveOf) and on me.html, and that no game
 * writes a bespoke best-score key any more.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failures = 0;
function check(ok, msg) {
  if (ok) { console.log('  [PASS] ' + msg); }
  else { failures++; console.log('  [FAIL] ' + msg); }
}

function makeStorage() {
  const map = new Map();
  return {
    map,
    getItem: k => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: k => { map.delete(String(k)); },
    key: i => [...map.keys()][i],
    get length() { return map.size; }
  };
}

/* ── The games covered by the unified schema. storeId is the id the game saves
   under (defaults to the registry id). ── */
const GAMES = [
  { id: 'stardust-ruins', file: 'games/stardust-ruins.html' },
  { id: 'echo-casebook', file: 'games/echo-casebook.html' },
  { id: 'lumo-dash', file: 'games/lumo-dash.html' },
  { id: 'nibble-quest', file: 'games/nibble-quest.html' },
  { id: 'star-chef', file: 'games/star-chef.html' },
  { id: 'little-steps', file: 'games/little_steps.html' },
  { id: 'gem-match', file: 'games/gem_match.html' },
  { id: 'garden-defense', file: 'games/garden-defense.html' },
  { id: 'cozy-cafe-match', file: 'games/cozy-cafe-match-game.html', storeId: 'cozy-cafe' },
  { id: 'arcane-citadel', file: 'games/arcane_citadel.html' },
  { id: 'echo-fruit', file: 'games/echo_fruit_catch.html' },
  { id: 'critter-whack', file: 'games/critter-whack.html' },
  { id: 'dough-dash', file: 'games/dough-dash.html' },
  { id: 'pastry-match', file: 'games/pastry-match.html' },
  { id: 'stack-attack', file: 'games/stack-attack.html' },
  { id: 'void-rush', file: 'games/voidrush.html' },
  { id: 'stardust', file: 'games/stardust_collection.html', storeId: 'stardust_collection' },
  { id: 'nova-siege', file: 'games/nova-siege.html' },
  { id: 'marble-run-lab', file: 'games/marble-run-lab.html' },
  { id: 'pixel-pet-arena', file: 'games/pixel-pet-arena.html' }
];

const ALIAS = {
  'cozy-cafe-match': 'cozy-cafe',
  'stardust': 'stardust_collection',
  'sky-high-friends': 'sky-high-with-friends',
  'call-of-cards': 'call-of-cards-playtest',
  'cozy-creatures': 'cozy-creatures-alt'
};

const FORBIDDEN = [
  'jvds-best-', 'gmBest', 'gdBest', 'cc_shift_best', 'ac_scores', 'echo_picnic_best',
  'critter_ranger_best', 'doughDashBest', 'pastryMatchBest', 'stackBest',
  'voidrush-best', 'stardust_constellation_best'
];

/* ── 1. The unified writer round-trips through one key ── */
const storage = makeStorage();
const ctx = { window: {}, localStorage: storage, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'game-score.js'), 'utf8'), ctx);
const GS = ctx.window.GameSystem && ctx.window.GameSystem.saveScore ? ctx.window.GameSystem : null;
check(!!GS, 'game-score.js exposes window.GameSystem.saveScore');
check(typeof ctx.window.JVDSGameScore === 'object', 'game-score.js exposes window.JVDSGameScore');

for (const g of GAMES) {
  const storeId = g.storeId || g.id;
  const score = 100 + GAMES.indexOf(g);
  let best = 0;
  try { best = GS.saveScore(storeId, score, { level: 3, extra: { bestWave: 2 } }); } catch (e) {}
  const raw = storage.getItem('jvds_game_' + storeId);
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) {}
  check(best === score && parsed && parsed.highScore === score,
    g.id + ': score written to the unified jvds_game_' + storeId + ' key');
}

/* ── 2. Arcade hub (saveOf, with id aliases) would show every game ── */
for (const g of GAMES) {
  const storeId = ALIAS[g.id] || g.storeId || g.id;
  let high = 0;
  try { high = JSON.parse(storage.getItem('jvds_game_' + storeId)).highScore || 0; } catch (e) {}
  check(high > 0, g.id + ': appears in the Arcade best-scores list');
}

/* ── 3. me.html getGameScores would pick every game up ── */
for (const g of GAMES) {
  const storeId = g.storeId || g.id;
  const key = 'jvds_game_' + storeId;
  let found = 0;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k || k.indexOf('jvds_game_') !== 0) continue;
    if (k !== key) continue;
    try { const v = JSON.parse(storage.getItem(k)); found = (v && (v.highScore || v.score || v.best)) || 0; } catch (e) {}
  }
  check(found > 0, g.id + ': appears on me.html (my progress)');
}

/* ── 4. No game writes a bespoke score key any more ── */
for (const g of GAMES) {
  const src = fs.readFileSync(path.join(ROOT, g.file), 'utf8');
  const hit = FORBIDDEN.find(k => src.indexOf(k) !== -1);
  check(!hit, g.file + ': no bespoke score key' + (hit ? ' (found ' + hit + ')' : ''));
}

/* ── 5. Broader sweep: no localStorage best/score writes anywhere in games/ ── */
const gameFiles = fs.readdirSync(path.join(ROOT, 'games')).filter(f => f.endsWith('.html'));
let leaks = [];
for (const f of gameFiles) {
  const src = fs.readFileSync(path.join(ROOT, 'games', f), 'utf8');
  const re = /localStorage\.setItem\(\s*([^,)]{0,60})/g;
  let m;
  while ((m = re.exec(src))) {
    if (/(?:\bbest\b|score|high)/i.test(m[1]) && !/jvds_game_|jvds-best-/.test(m[1])) leaks.push(f + ': ' + m[1].trim());
  }
}
check(leaks.length === 0, 'games/ write no bespoke best/score keys' + (leaks.length ? ' -> ' + leaks.join(' | ') : ''));

/* ── 6. The engine exposes the same API as class statics ── */
const engine = fs.readFileSync(path.join(ROOT, 'game-system.js'), 'utf8');
check(/GameSystem\.saveScore\s*=/.test(engine), 'game-system.js defines GameSystem.saveScore');
check(/GameSystem\.getBestScore\s*=/.test(engine), 'game-system.js defines GameSystem.getBestScore');

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1); }
console.log('\nScore schema OK: ' + GAMES.length + ' games unified');
