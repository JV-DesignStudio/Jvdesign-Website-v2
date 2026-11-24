#!/usr/bin/env node
/* tests/challenges-http.js (A2275): challenges page static checks.
 * Run: node tests/challenges-http.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

const html = fs.readFileSync(path.join(ROOT, 'tools', 'challenges.html'), 'utf8');

check('challenges page exists',         html.length > 0);
check('page has a canonical URL',       /rel="canonical"/.test(html));
check('page has a title',               /<title>[^<]+<\/title>/.test(html));
check('page links back to /create',     /href="[^"]*\/create[^"]*"/.test(html) || /href="[^"]*dev-tools[^"]*"/.test(html));
check('no em-dashes in page',           !new RegExp('[' + String.fromCharCode(8211) + String.fromCharCode(8212) + ']').test(html));

process.exit(failures ? 1 : 0);
