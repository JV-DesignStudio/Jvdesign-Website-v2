#!/usr/bin/env node
// A961: characters are product identity, not decoration. Each of the five roles
// keeps a landing page, appears by name on the homepage with a nav badge, and the
// books hub links stories to a creative activity.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const characters = [
  ['Stardust', 'pages/stardust.html'],
  ['Lumo', 'pages/lumo.html'],
  ['Ember', 'pages/ember.html'],
  ['Pip', 'pages/pip.html'],
  ['Echo', 'pages/echo.html'],
];
const home = read('index.html');
for (const [name, page] of characters) {
  ok('character page exists: ' + page, fs.existsSync(path.join(ROOT, page)));
  ok('homepage names ' + name, new RegExp('\\b' + name + '\\b').test(home));
}
ok('homepage carries character nav badges', (home.match(/mascots\/[a-z]+-badge/g) || []).length >= 5);

const books = read('pages/books.html');
ok('books hub links to a creative activity', /\/(workshops|games|dev-tools)\b/.test(books));

console.log(failures === 0 ? 'ALL BRAND CHARACTER CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
