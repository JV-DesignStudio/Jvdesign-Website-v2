#!/usr/bin/env node
// A1764 game handoff test: verify that the 3 target games have the required
// endScreen ARIA attributes, JVDS_HANDOFF config, and game-handoff.js script tag.
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
    ['endScreen aria-live',    html.includes('aria-live')],
    ['endScreen role=dialog',  html.includes('role="dialog"')],
    ['endTitle tabindex=-1',   html.includes('tabindex="-1"')],
    ['JVDS_HANDOFF config',    html.includes('JVDS_HANDOFF')],
    ['game-handoff.js script', html.includes(SCRIPT)],
    ['challengeTarget fn',     html.includes('challengeTarget')],
    ['scoreFn',                html.includes('scoreFn')],
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
