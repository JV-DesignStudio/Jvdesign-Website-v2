#!/usr/bin/env node
// A614: every crew member needs a reference sheet, and games/chars needs a sprite
// for each character used in arcade games. Files may be placeholders until the
// hand-crafted art lands (see ember-sheet-ART-SPEC.md).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; };
const exists = (p) => fs.existsSync(path.join(ROOT, p));

// Reference sheets: all five core crew members.
for (const sheet of ['lumo-sheet.png', 'pip-sheet.jpg', 'echo-sheet.jpg', 'stardust-sheet.png', 'ember-sheet.png']) {
  ok('reference sheet present: assets/mascots/' + sheet, exists('assets/mascots/' + sheet));
}

// In-game sprites: every character that appears in arcade games.
for (const sprite of ['lumo.png', 'ember.png', 'pip.png', 'echo.png', 'stardust.png']) {
  ok('game sprite present: games/chars/' + sprite, exists('games/chars/' + sprite));
}

ok('art spec present', exists('assets/mascots/ember-sheet-ART-SPEC.md'));

console.log(failures === 0 ? 'ALL CHARACTER-ART GAP CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
