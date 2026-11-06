#!/usr/bin/env node
// tests/engine-cpp-http.js (A2605)
// Guards the C++ hub against the -canvas -> -workshop catalogue move.
const { run } = require('./lib/engine-hub');
run('cpp', {
  expectedStart: 'cpp-pong-workshop',
  absent: ['cpp-pong-canvas', 'cpp-breakout-canvas', 'cpp-platformer-canvas', 'cpp-snake-canvas', 'cpp-tower-part1-canvas', 'cpp-platformer-part2-canvas', 'cpp-tower-part2-canvas']
}).catch((e) => { console.error('FAIL engine-cpp-http: ' + e.message); process.exit(1); });
