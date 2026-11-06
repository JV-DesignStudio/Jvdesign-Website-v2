#!/usr/bin/env node
// tests/engine-javascript-http.js (A2611)
// Guards the JavaScript hub against the -canvas -> -workshop catalogue move.
const { run } = require('./lib/engine-hub');
run('javascript', {
  expectedStart: 'js-flappy-workshop',
  absent: ['js-flappy-canvas', 'js-breakout-canvas', 'js-memory-canvas', 'js-snake-canvas', 'js-platformer-part2-canvas']
}).catch((e) => { console.error('FAIL engine-javascript-http: ' + e.message); process.exit(1); });
