#!/usr/bin/env node
// A1764 game handoff test: verify that the 3 target games have the required
// endScreen ARIA attributes and game-handoff.js script tag with data-* config.
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const GAMES  = path.join(ROOT, 'games');
const SCRIPT = '../game-handoff.js';

const targets = [
  { file: 'stardust-snake.html', gameId: 'stardust-snake' },
  { file: 'highway-dodge.html',  gameId: 'highway-dodge' },
  { file: 'crossy-crew.html',    gameId: 'crossy-crew' },
];

let failures = 0;

for (const t of targets) {
  const html = fs.readFileSync(path.join(GAMES, t.file), 'utf8');
  const checks = [
    ['endScreen aria-live',            html.includes('aria-live')],
    ['endScreen role=dialog',          html.includes('role="dialog"')],
    ['endTitle tabindex=-1',           html.includes('tabindex="-1"')],
    ['game-handoff.js script',         html.includes(SCRIPT)],
    ['data-game-id',                   html.includes('data-game-id="' + t.gameId + '"')],
    ['data-challenge-label',           html.includes('data-challenge-label=')],
    ['data-challenge-min/max',         html.includes('data-challenge-min=') && html.includes('data-challenge-max=')],
    ['data-score-fn',                  html.includes('data-score-fn=')],
    ['no stale inline JVDS_HANDOFF',   !html.includes('<script>window.JVDS_HANDOFF')],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    if (!pass) {
      console.log('x ' + t.file + ' - missing: ' + name);
      failures++;
      ok = false;
    }
  }
  if (ok) console.log('/ ' + t.file + ' - all checks pass');
}

console.log(
  failures
    ? '\nx game-handoff: ' + failures + ' check(s) failed'
    : '\n/ game-handoff: all 3 games pass'
);
process.exit(failures ? 1 : 0);
