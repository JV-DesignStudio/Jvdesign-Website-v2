#!/usr/bin/env node
/*
 * tests/game-showcase.js - A952 unit tests for game-showcase.js.
 *
 * The three showcase runners share milestone progression, screen shake and
 * running dust. This checks the shared implementation in isolation (no browser),
 * so a regression in the module is caught fast before the per-game tests.
 *
 * Run: node tests/game-showcase.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const code = fs.readFileSync(path.join(__dirname, '..', 'game-showcase.js'), 'utf8');
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const S = sandbox.window.JVDSShowcase;

check('module exports JVDSShowcase', !!S && !!S.Milestones && !!S.Shake && typeof S.dust === 'function');

// Milestones
const reached = [];
const ms = new S.Milestones([10, 25, 50], v => reached.push(v));
check('milestones: first target is the lowest', ms.next() === 10, String(ms.next()));
ms.check(9);
check('milestones: nothing fires below the first target', reached.length === 0, JSON.stringify(reached));
ms.check(10);
check('milestones: the first target fires', reached.join(',') === '10', JSON.stringify(reached));
check('milestones: the next target advances', ms.next() === 25, String(ms.next()));
ms.check(60);
check('milestones: crossing several fires each in order', reached.join(',') === '10,25,50', JSON.stringify(reached));
check('milestones: no target left', ms.next() === null, String(ms.next()));
check('milestones: a target never fires twice', ms.check(100).length === 0);
ms.reset();
check('milestones: reset re-arms the list', ms.next() === 10, String(ms.next()));

// Shake
const sh = new S.Shake(12);
check('shake: starts calm', sh.amount === 0 && sh.hits === 0);
sh.hit();
check('shake: a hit sets the amount and counts', sh.amount === 12 && sh.hits === 1, sh.amount + '/' + sh.hits);
sh.hit(20);
check('shake: a stronger hit wins', sh.amount === 20 && sh.hits === 2, sh.amount + '/' + sh.hits);
for (let i = 0; i < 40; i++) sh.decay();
check('shake: decays back to rest', sh.amount === 0, String(sh.amount));
const fakeCtx = { tx: 0, translate(x, y) { this.tx += Math.abs(x) + Math.abs(y); } };
sh.reset();
sh.hit(30);
const drew = sh.apply(fakeCtx, 2);
check('shake: apply translates the context when shaking', drew === true && fakeCtx.tx > 0, 'tx=' + fakeCtx.tx);
sh.reset();
check('shake: reset clears hits and amount', sh.hits === 0 && sh.amount === 0);
check('shake: apply is a no-op at rest', sh.apply(fakeCtx, 2) === false);

// Dust
const parts = [];
S.dust(parts, 100, 200, '#fff', 4, { drift: 50 });
check('dust: pushes the requested puffs', parts.length === 4, String(parts.length));
check('dust: puffs are particle-shaped',
  parts.every(p => typeof p.x === 'number' && typeof p.vy === 'number' && typeof p.life === 'number' && p.color === '#fff'));

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL GAME SHOWCASE CHECKS PASSED');
process.exit(failures ? 1 : 0);
