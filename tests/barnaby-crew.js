#!/usr/bin/env node
// A806: Barnaby the Arctic Fox must have crew art slots, a crew page card and a
// nav entry, matching the rest of the crew. The art files may still be
// placeholders until the hand-crafted art lands (see barnaby-ART-SPEC.md).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const ASSETS = [
  'assets/mascots/barnaby.png',
  'assets/mascots/barnaby-badge.avif',
  'assets/mascots/barnaby-badge.webp',
  'assets/mascots/barnaby-hero.avif',
  'assets/mascots/barnaby-hero.webp',
  'assets/mascots/barnaby-sheet.png',
  'games/chars/barnaby.png',
];
for (const a of ASSETS) ok('asset slot exists: ' + a, exists(a));

ok('art spec present', exists('assets/mascots/barnaby-ART-SPEC.md'));

const crew = fs.readFileSync(path.join(ROOT, 'meet-the-crew.html'), 'utf8');
ok('meet-the-crew has a Barnaby card', /id=["']barnaby["']/.test(crew) && /barnaby-hero\.webp/.test(crew));

const nav = fs.readFileSync(path.join(ROOT, 'partials/nav-content.html'), 'utf8');
ok('nav links to Barnaby', /meet-the-crew\.html#barnaby/.test(nav));

console.log(failures === 0 ? 'ALL BARNABY CREW CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
