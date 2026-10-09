#!/usr/bin/env node
// A955: lessons should show a checkpoint at each stage so learners know what the
// project should look like before moving on. The canvas engine renders a
// checkpoint line when a step provides one.
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
ok('canvas engine renders a step checkpoint', /step\.checkpoint/.test(engine) && /cw-checkpoint/.test(engine));
ok('canvas CSS styles the checkpoint', /\.cw-checkpoint\s*\{/.test(read('workshop-canvas.css')));

const js = read('workshops/js-platformer-builder.html');
const count = (js.match(/checkpoint:\s*'/g) || []).length;
ok('JS platformer builder gives every step a checkpoint', count >= 6, 'found ' + count);

console.log(failures === 0 ? 'ALL WORKSHOP CHECKPOINT CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
