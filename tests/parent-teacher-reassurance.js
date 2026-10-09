#!/usr/bin/env node
// A962: parent and teacher reassurance must stay easy to find and complete.
// The links are discoverable from the homepage (nav/footer) and the parents page
// must keep explaining accounts, storage, third parties and offline use.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const home = read('index.html');
ok('homepage links to the parents page', /href=["']\/parents["']/.test(home));
ok('homepage links to the teachers page', /href=["']\/teachers(\.html)?["']/.test(home));

const footer = read('partials/footer-content.html');
ok('footer links to the parents page', /href=["']\/parents["']/.test(footer));
ok('footer links to the teachers page', /href=["']\/teachers(\.html)?["']/.test(footer));

const parents = read('pages/parents.html');
const topics = [
  ['accounts explained', /No Accounts/i],
  ['browser-local storage explained', /localStorage|stored in your browser|All Progress Stays Here/i],
  ['third-party analytics explained', /Analytics|Google Analytics/i],
  ['no advertising stated', /No Advertising|ad-free|never shows ads/i],
  ['privacy/GDPR stated', /GDPR|Age Appropriate Design Code|privacy/i],
];
for (const [label, re] of topics) ok('parents page: ' + label, re.test(parents));

console.log(failures === 0 ? 'ALL PARENT/TEACHER REASSURANCE CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
