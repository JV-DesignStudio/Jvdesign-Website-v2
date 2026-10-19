#!/usr/bin/env node
/* tests/engine-adoption.js (A1719)
 *
 * The curated arcade line-up (games-registry.js) must all run on the shared
 * engine layer. This gate reads the registry, checks every live cabinet wires
 * the required modules, and reports how many have adopted the optional ones.
 *
 * Required on every listed game:
 *   - game-system.js     (GameSystem: score, save, achievements, leaderboard)
 *   - game-onboarding.js (Goal / Controls / Practising + Echo tip)
 *
 * Tracked (reported, not yet required) so adoption can climb without the gate
 * blocking work:
 *   - engine-runtime.js  (loop / input / collide / juice / touch kit)
 *   - game-kit.js        (quality panel, Lumo coach line, daily target)
 *   - story-run.js       (run framing)
 *
 * Run: node tests/engine-adoption.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8'), ctx);
const games = ctx.window.JVDS_GAMES || [];

const REQUIRED = [
  { file: 'game-system.js', label: 'shared engine (GameSystem)' },
  { file: 'game-onboarding.js', label: 'onboarding (goal / controls / Echo)' },
];
const TRACKED = [
  { file: 'engine-runtime.js', id: 'runtime' },
  { file: 'game-kit.js', id: 'kit' },
  { file: 'story-run.js', id: 'story' },
];

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
};

check('games-registry.js lists a curated line-up', games.length > 0, games.length + ' games');

const adopted = { runtime: 0, kit: 0, story: 0 };

for (const g of games) {
  const file = path.join(GAMES_DIR, g.file);
  if (!fs.existsSync(file)) {
    check(g.id + ': page exists', false, g.file);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  for (const req of REQUIRED) {
    check(g.id + ': loads ' + req.label, html.includes(req.file), req.file);
  }
  for (const opt of TRACKED) {
    if (html.includes(opt.file)) adopted[opt.id]++;
  }
}

const total = games.length || 1;
check(
  'engine-runtime.js adoption is reported',
  true,
  adopted.runtime + '/' + total + ' cabinets (loop / input / collide / juice / touch kit)'
);
check(
  'game-kit.js adoption is reported',
  true,
  adopted.kit + '/' + total + ' cabinets (quality panel / Lumo coach / daily)'
);
check(
  'story-run.js adoption is reported',
  true,
  adopted.story + '/' + total + ' cabinets'
);

console.log('\nengine adoption: runtime ' + adopted.runtime + '/' + total +
  ', kit ' + adopted.kit + '/' + total +
  ', story ' + adopted.story + '/' + total);

if (failures) {
  console.log('\n' + failures + ' CHECK(S) FAILED');
  process.exit(1);
}
console.log('\nALL ' + total + ' LINE-UP GAMES LOAD THE SHARED ENGINE');
