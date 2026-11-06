#!/usr/bin/env node
// tests/engine-general-http.js (A2614)
// Guards the General hub against the -canvas -> -workshop catalogue move.
const { run } = require('./lib/engine-hub');
run('general', {
  absent: ['night-watch-canvas']
}).catch((e) => { console.error('FAIL engine-general-http: ' + e.message); process.exit(1); });
