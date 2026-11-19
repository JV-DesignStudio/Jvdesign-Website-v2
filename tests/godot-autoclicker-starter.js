/* The Godot side of Biscuit Tycoon must be a real project, not a promise.
   Checks the committed source and zip exist, the scene wires every button,
   and the script has every function the workshop steps name. */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'workshop-starters', 'godot-biscuit-tycoon');
const ZIP = path.join(ROOT, 'biscuit-tycoon-godot.zip');

assert.ok(fs.existsSync(ZIP), 'biscuit-tycoon-godot.zip is missing');
assert.ok(fs.statSync(ZIP).size > 1000, 'biscuit-tycoon-godot.zip looks empty');

const project = fs.readFileSync(path.join(SRC, 'project.godot'), 'utf8');
assert.ok(/run\/main_scene="res:\/\/bakery\.tscn"/.test(project), 'project.godot has no main scene');

const scene = fs.readFileSync(path.join(SRC, 'bakery.tscn'), 'utf8');
for (const node of ['TinButton', 'AutoButton', 'FasterButton', 'GoldenButton', 'GoldenTimer', 'BiscuitsLabel', 'CpsLabel']) {
  assert.ok(scene.includes('name="' + node + '"'), 'bakery.tscn is missing ' + node);
}
for (const fn of ['on_tap', 'buy_auto_tapper', 'buy_faster_tapper', 'on_golden_pressed', 'on_golden_timer_timeout']) {
  assert.ok(scene.includes('method="' + fn + '"'), 'bakery.tscn is not wired to ' + fn);
}

const script = fs.readFileSync(path.join(SRC, 'bakery.gd'), 'utf8');
for (const fn of ['on_tap', 'biscuits_per_second', 'auto_tick', 'buy_auto_tapper', 'buy_faster_tapper', 'golden_bonus', 'update_hud']) {
  assert.ok(new RegExp('func ' + fn + '\\(').test(script), 'bakery.gd is missing ' + fn + '()');
}

const steps = fs.readFileSync(path.join(SRC, 'STEPS.md'), 'utf8');
for (const fn of ['on_tap', 'biscuits_per_second', 'auto_tick', 'buy_auto_tapper', 'buy_faster_tapper', 'golden_bonus']) {
  assert.ok(steps.includes('func ' + fn + '('), 'STEPS.md is missing ' + fn);
}

console.log('PASS: Biscuit Tycoon Godot starter project and zip are complete');
