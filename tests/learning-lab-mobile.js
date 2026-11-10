#!/usr/bin/env node
// tests/learning-lab-mobile.js - verifies the Learning Lab redirect at 390px and 1440px
const fs = require('fs');
const path = require('path');
const PAGE = '/workshops/learning-lab.html';
const ROOT = path.resolve(__dirname, '..');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
check('redirect page has noindex', /noindex/.test(html));
check('redirect page has canonical', /rel="canonical".*workshop\.html/.test(html));
check('redirect page has JS redirect', /location\.replace/.test(html));
check('redirect page has meta refresh', /meta http-equiv="refresh"/.test(html));
check('redirect page has fallback text', /Workshop hub/.test(html));

if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
console.log('\nLearning Lab redirect: all checks passed');
