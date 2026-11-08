#!/usr/bin/env node
/* Page-test alias for games/gem_match.html (A2840).

   The gameplay suite lives in tests/gem-match-smoke.js. The board's page-test
   naming expects tests/<page>-http.js for games/gem_match.html, so this thin
   wrapper keeps the gate and the suite in sync without duplicating checks.

   Run: node tests/gem_match-http.js
*/
require('./gem-match-smoke.js');
