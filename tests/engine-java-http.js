#!/usr/bin/env node
// tests/engine-java-http.js (A2606)
// Guards the Java hub against the -canvas -> -workshop catalogue move.
const { run } = require('./lib/engine-hub');
run('java', {
  expectedStart: 'java-pong-workshop',
  absent: ['java-pong-canvas', 'java-breakout-canvas', 'java-platformer-canvas', 'java-space-canvas', 'java-rpg-part1-canvas', 'java-rpg-part2-canvas', 'java-rpg-part3-canvas']
}).catch((e) => { console.error('FAIL engine-java-http: ' + e.message); process.exit(1); });
