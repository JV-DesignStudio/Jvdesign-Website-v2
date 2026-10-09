#!/usr/bin/env node
// A956: code workshops must label activities Configure / Modify code / Write code
// so learners and parents know the difference between configuring a game and
// writing its logic.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const engine = read('workshop-canvas-engine.js');
ok('canvas engine renders an activity label on each step', /step\.activity/.test(engine) && /cw-activity/.test(engine));
ok('canvas CSS styles the activity label', /\.cw-activity\s*\{/.test(read('workshop-canvas.css')));

const js = read('workshops/js-platformer-builder.html');
ok('JS builder labels steps Modify code', (js.match(/activity:\s*'Modify code'/g) || []).length >= 3);
ok('JS builder labels later steps Write code', /activity:\s*'Write code'/.test(js));
ok('JS builder explains the three activity types', /How this workshop works/i.test(js) && /Configure/.test(js) && /Modify code/.test(js) && /Write code/.test(js));

const py = read('workshops/python-game-builder.html');
ok('Python builder explains it is a Configure workshop', /How this workshop works/i.test(py) && /Configure/.test(py));

console.log(failures === 0 ? 'ALL WORKSHOP ACTIVITY-LABEL CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
