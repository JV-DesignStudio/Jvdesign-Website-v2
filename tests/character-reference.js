#!/usr/bin/env node
// tests/character-reference.js (A1984)
// The character reference page and content/characters.json must agree on every
// role, palette and approved art file. Also checks the page is linked from the
// crew and books pages and that every approved asset exists.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'pages', 'character-reference.html');
const DATA = path.join(ROOT, 'content', 'characters.json');

const expected = {
  stardust: { role: 'Imagine', nameColor: '#FFC733', colors: ['#FFC733', '#FFE566', '#FF9800', '#FFF4B8'], art: ['stardust-badge.webp', 'stardust-hero.webp', 'stardust-sheet.png'] },
  lumo: { role: 'Learn', nameColor: '#8B5CF6', colors: ['#8B5CF6', '#D0B0FF', '#4A1A90', '#1C1C1C'], art: ['lumo-badge.webp', 'lumo-hero.webp', 'lumo-sheet.png'] },
  ember: { role: 'Create', nameColor: '#E8608A', colors: ['#E8608A', '#F8A8BE', '#C04070', '#3DB850', '#2A2A2A'], art: ['ember-badge.webp', 'ember-hero.webp', 'ember-sheet.png'] },
  pip: { role: 'Play', nameColor: '#5EC47E', colors: ['#5EC47E', '#3D6830', '#2A5538', '#B8E8CA'], art: ['pip-badge.webp', 'pip-hero.webp', 'pip-sheet.jpg'] },
  echo: { role: 'Improve', nameColor: '#4E9E5F', colors: ['#F2A8BC', '#FF90A8', '#2D6B3A', '#5B2D8A', '#B8860B'], art: ['echo-badge.webp', 'echo-hero.webp', 'echo-sheet.jpg'] },
  barnaby: { role: 'Guest', nameColor: '#3B5B7A', colors: ['#FFFFFF', '#F8F0E6', '#E6D5C3', '#3B5B7A', '#FF6B6B'], art: ['barnaby-badge.webp', 'barnaby-hero.webp', 'barnaby-sheet.png'] },
  elara: { role: 'Guest', nameColor: '#C8B0E8', colors: ['#C8B0E8', '#F0EAD6', '#4E7D80'], art: [] }
};

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

ok('reference page exists', fs.existsSync(PAGE));
ok('character data exists', fs.existsSync(DATA));
const html = fs.readFileSync(PAGE, 'utf8');
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));

ok('page has a title', /<title>[^<]+<\/title>/.test(html));
ok('page has a canonical', /<link\s+rel=["']canonical["']/.test(html));
ok('page has a meta description', /<meta\s+name=["']description["']/.test(html));
ok('page links to Meet the Crew', /href="\/meet-the-crew\.html"/.test(html));
ok('page links to the books', /href="\/books"/.test(html));
ok('page links to the studio story', /href="\/about"/.test(html));

for (const [id, want] of Object.entries(expected)) {
  const entry = data.find((c) => c.id === id);
  ok(id + ': in content/characters.json', !!entry);
  if (!entry) continue;
  ok(id + ': role matches', entry.role === want.role, `${entry.role} != ${want.role}`);
  ok(id + ': name colour matches', entry.color.toUpperCase() === want.nameColor, entry.color);
  ok(id + ': page shows the name colour', html.toUpperCase().includes(want.nameColor));
  ok(id + ': palette listed', Array.isArray(entry.palette) && entry.palette.length > 0);
  for (const hex of want.colors) {
    ok(id + ': palette has ' + hex, (entry.palette || []).some((p) => p.hex.toUpperCase() === hex), hex);
  }
  ok(id + ': page has the card', new RegExp('data-character="' + id + '"').test(html));
  ok(id + ': page names the role', html.includes(want.role));
  for (const hex of want.colors) ok(id + ': page shows ' + hex, html.toUpperCase().includes(hex));
  for (const file of want.art) {
    ok(id + ': page uses ' + file, html.includes(file));
    ok(id + ': ' + file + ' exists', fs.existsSync(path.join(ROOT, 'assets', 'mascots', file)));
  }
}

ok('all five loop stages are on the page', ['Imagine', 'Learn', 'Create', 'Play', 'Improve'].every((r) => html.includes(r)));
ok('page includes the studio origin story', /Where the studio came from/.test(html));
ok('page includes a before-you-publish checklist', /Before you publish/.test(html));

console.log('');
console.log(failures ? 'FAIL character-reference: ' + failures + ' issue(s)' : 'PASS character-reference: page and data agree for ' + Object.keys(expected).length + ' characters');
if (failures) process.exitCode = 1;
