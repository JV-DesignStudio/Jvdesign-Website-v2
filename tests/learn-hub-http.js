// tests/learn-hub-http.js - verifies the Learn Hub redirect page
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGE = '/pages/learn-hub.html';

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
check('has noindex meta', /noindex/.test(html));
check('has canonical to workshop', /rel="canonical".*workshop/.test(html));
check('has meta refresh to workshop', /meta http-equiv="refresh".*workshop\.html/.test(html));
check('has fallback link', /Go to the Workshop<\/a>/.test(html));

if (failures) { console.log('\n' + failures + ' FAILED for ' + PAGE); process.exit(1); }
console.log('\nPASS: ' + PAGE + ' redirect page');
