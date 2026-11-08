#!/usr/bin/env node
/* Stack Attack wrapper redirect (A2841). Run: node tests/stack-attack-page-http.js */
require('./_redirect-page-test.cjs')('stack-attack-page.html', 'stack-attack.html', 'Stack Attack');
