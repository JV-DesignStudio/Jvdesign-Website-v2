#!/usr/bin/env node
// A1806 / AUD-009: the five characters keep one role each across the learner
// journey, and that role stays the same in the nav, the character pages, the
// crew page, the homepage and mascots.js.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const has = (p) => fs.existsSync(path.join(ROOT, p));

const ROLES = [
  { name: 'Stardust', key: 'stardust', role: 'Imagine', page: 'pages/stardust.html', hub: 'pages/books.html' },
  { name: 'Lumo', key: 'lumo', role: 'Learn', page: 'pages/lumo.html', hub: 'pages/workshop.html' },
  { name: 'Ember', key: 'ember', role: 'Create', page: 'pages/ember.html', hub: 'pages/dev-tools.html' },
  { name: 'Pip', key: 'pip', role: 'Play', page: 'pages/pip.html', hub: 'arcade.html' },
  { name: 'Echo', key: 'echo', role: 'Improve', page: 'pages/echo.html', hub: 'me.html' },
];

const mascots = read('mascots.js');
const cfg = mascots.slice(mascots.indexOf('var MASCOT_CFG'), mascots.indexOf('function getGuide'));

for (const { name, key, role, page, hub } of ROLES) {
  ok(name + ' has a character page', has(page), page);

  const quoteRe = new RegExp(key + ":\\s*\\{[^}]*pillar:'" + role + "'");
  ok(name + ' keeps role ' + role + ' in JVDS_QUOTES', quoteRe.test(mascots));

  const cfgRe = new RegExp('\\b' + key + ':\\s*\\{[^}]*pillar:\'' + role + '\'');
  ok(name + ' keeps role ' + role + ' in MASCOT_CFG', cfgRe.test(cfg));

  const pageBody = read(page);
  ok(page + ' heading names ' + name, pageBody.includes('<h1>' + name + '</h1>'), page);
  ok(page + ' shows "' + role + ' guide"', pageBody.includes('char-role">' + role + ' guide<'), role);

  const hubBody = read(hub);
  ok(hub + ' names ' + name, new RegExp('\\b' + name + '\\b').test(hubBody), name);
}

const nav = read('partials/nav-content.html');
for (const { name, role } of ROLES) {
  ok('shared nav labels ' + name + ' as ' + role, nav.includes(name + ' (' + role + ')'));
}
ok('shared nav shows a Lumo badge for Learn', /Learn[\s\S]{0,220}lumo-badge/.test(nav));
ok('shared nav shows an Ember badge for Create', /Create[\s\S]{0,220}ember-badge/.test(nav));
ok('shared nav shows Echo and Pip badges for Play', /Play[\s\S]{0,320}echo-badge[\s\S]{0,320}pip-badge/.test(nav));
ok('shared nav shows a Stardust badge for Read', /Read[\s\S]{0,220}stardust-badge/.test(nav));

const home = read('index.html');
for (const { name, key } of ROLES) {
  ok('homepage names ' + name, new RegExp('\\b' + name + '\\b').test(home));
  ok('homepage links ' + name + ' page', home.includes('/pages/' + key + '.html'));
}
ok('homepage pairs Learn with Lumo', /Learn with Lumo/.test(home));
ok('homepage pairs Create with Ember', /Create with Ember/.test(home));
ok('homepage pairs Play with Echo and Pip', /Play with Echo/.test(home));
ok('homepage pairs Read with Stardust', /Read with Stardust/.test(home));

const crew = read('meet-the-crew.html');
for (const { name, role } of ROLES) {
  const re = new RegExp('crew-char-name[^>]*>' + name + '</p>\\s*<p class="crew-char-title">[^<]+</p>\\s*<p class="crew-char-role">' + role + '</p>');
  ok('crew page shows ' + name + ' as ' + role, re.test(crew));
}

console.log(failures === 0 ? 'ALL CHARACTER ROLE CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
