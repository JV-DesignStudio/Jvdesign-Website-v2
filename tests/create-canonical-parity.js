#!/usr/bin/env node
/* A3166/A3168: /create is served by create/index.html on GitHub Pages, while
 * the polished Ember hub lives at pages/dev-tools.html. create/index.html is
 * generated from that source by scripts/build-create-hub.js, so this test fails
 * if the copy is stale or if the live page loses its indexable head.
 *
 * Run: node tests/create-canonical-parity.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { render } = require('../scripts/build-create-hub.js');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

function body(html) {
  const i = html.indexOf('<body');
  if (i === -1) return null;
  return html.slice(i).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

const canonical = read('create/index.html');
const source = read('pages/dev-tools.html');
const expected = render(source);

check('create/index.html has a body', body(canonical) !== null);
check('pages/dev-tools.html has a body', body(source) !== null);
check('Create hub bodies match', body(canonical) === body(source),
  'create/index.html and pages/dev-tools.html render different pages');
check('create/index.html matches the generator', canonical === expected,
  'stale copy - run: node scripts/build-create-hub.js');

check('create/index.html is indexable', /<meta name="robots" content="index, follow">/.test(canonical));
check('create/index.html canonical is /create', /<link rel="canonical" href="https:\/\/jvdesignstudio\.co\.uk\/create">/.test(canonical));
check('pages/dev-tools.html stays noindex', /<meta name="robots" content="noindex, follow">/.test(source));

if (failures) {
  console.log('\n' + failures + ' check(s) failed.');
  process.exit(1);
}
console.log('\nCreate hub parity: OK');
