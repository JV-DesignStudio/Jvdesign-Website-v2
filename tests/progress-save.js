#!/usr/bin/env node
// A957: progress must be visible and honest. Workshop pages show completed steps
// and XP; game pages keep score/best. Both must say where progress is saved
// (browser-local), so learners know it is not on a server and what clearing data does.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const PROGRESS = /progress-track|step-dots|xp-track|cw-progress|progress-bar|progress-fill|progress-wrap/;
const SAVED = /localStorage|saved in your browser|stored in your browser|this browser|saved on this device|saved automatically/i;

const WORKSHOPS = [
  'workshops/barrel-blast-workshop.html',
  'workshops/js-platformer-builder.html',
  'workshops/blender-workshop.html',
  'workshops/my-first-scratch-game.html',
];
for (const p of WORKSHOPS) {
  const h = read(p);
  ok(p + ': shows a progress indicator', PROGRESS.test(h));
  ok(p + ': explains where progress is saved', SAVED.test(h));
}

const GAMES = ['games/garden-defense.html', 'games/call_of_the_cards.html', 'games/candy_kingdom.html'];
for (const p of GAMES) {
  const h = read(p);
  ok(p + ': keeps score/progress', /score|best|xp/i.test(h));
  ok(p + ': explains where progress is saved', SAVED.test(h));
}

console.log(failures === 0 ? 'ALL PROGRESS/SAVE CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
