// workshop-hub-qa.js - A799: hub links every workshop in content/workshops.json
// and the difficulty/engine/age filters return the data's counts.
// Run: node tests/workshop-hub-qa.js
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(SITE, 'content', 'workshops.json'), 'utf8'));
const hub = fs.readFileSync(path.join(SITE, 'pages', 'workshop.html'), 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

// 1. every JSON url is linked from the hub
const missing = entries.filter((e) => !hub.includes('href="../' + e.url.replace(/^\//, '') + '"'));
ok('every workshops.json id has a hub link (' + entries.length + ' entries)', missing.length === 0,
  missing.slice(0, 5).map((e) => e.id).join(', '));

// 2. catalogue cards carry data matching their JSON entry
const catHtml = hub.slice(hub.indexOf('<!-- CATALOGUE:START -->'), hub.indexOf('<!-- CATALOGUE:END -->'));
const cards = [...catHtml.matchAll(/<a href="([^"]+)" class="course-card" data-engine="([^"]*)" data-difficulty="([^"]*)" data-age="([^"]*)"[^>]*>\s*<div class="course-body">\s*<div class="course-tag">([^<]*)<\/div>\s*<div class="course-title">([^<]*)<\/div>/g)]
  .map((m) => ({ href: m[1], engine: m[2], difficulty: m[3], age: m[4], badge: m[5], title: m[6] }));
ok('catalogue holds all ' + entries.length + ' workshops', cards.length === entries.length,
  'found ' + cards.length);
const byUrl = new Map(entries.map((e) => ['../' + e.url.replace(/^\//, ''), e]));
let attrBad = [];
for (const c of cards) {
  const e = byUrl.get(c.href);
  if (!e) { attrBad.push(c.href + ' (no JSON entry)'); continue; }
  if (c.engine !== e.engine || c.difficulty !== e.difficulty || c.age !== e.ageRange) {
    attrBad.push(c.href + ' data mismatch');
  }
}
ok('catalogue card data matches workshops.json', attrBad.length === 0, attrBad.slice(0, 3).join(', '));

// 3. filter controls cover the data
const toolSel = hub.slice(hub.indexOf('id="workshopTool"'), hub.indexOf('id="workshopTool"') + 1200);
const toolOptions = [...toolSel.matchAll(/<option(?: value="([^"]*)")?>([^<]*)<\/option>/g)]
  .map((m) => (m[1] === undefined ? m[2] : m[1]).toLowerCase());
const engines = [...new Set(entries.map((e) => e.engine))];
const engineCovered = engines.filter((eng) => toolOptions.some((o) => o && (eng.toLowerCase().includes(o) || o === 'pico' && /pico/i.test(eng))));
ok('tool filter covers all ' + engines.length + ' engines', engineCovered.length === engines.length,
  engines.filter((eng) => !toolOptions.some((o) => o && eng.toLowerCase().includes(o))).join(', '));
const diffSel = hub.slice(hub.indexOf('id="workshopDifficulty"'), hub.indexOf('id="workshopDifficulty"') + 500);
ok('difficulty filter has beginner/intermediate/advanced',
  ['beginner', 'intermediate', 'advanced'].every((d) => diffSel.includes('value="' + d + '"')));

// 4. filter simulation mirrors the page predicates over catalogue cards
const sectionLabel = 'complete catalogue';
const limits = { '4-5': 5, '6-8': 8, '9-12': 12, '13+': 99, all: Infinity };
const minAge = (a) => { const m = String(a).match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
function visible(tool, difficulty, ageBand) {
  return cards.filter((c) => {
    const hay = (sectionLabel + ' ' + c.badge + ' ' + c.title + ' ' + c.href).toLowerCase();
    if (tool && !hay.includes(tool.toLowerCase())) return false;
    if (difficulty && c.difficulty !== difficulty) return false;
    if (minAge(c.age) > limits[ageBand]) return false;
    return true;
  }).length;
}
const haystack = (e) => (sectionLabel + ' ' + e.engine + ' ' + e.difficulty + ' ' + e.ageRange + ' ' + e.title + ' ' + e.url).toLowerCase();
const cases = [
  ['engine Java', 'Java', '', 'all', entries.filter((e) => haystack(e).includes('java')).length],
  ['engine C++', 'C++', '', 'all', entries.filter((e) => haystack(e).includes('c++')).length],
  ['level advanced', '', 'advanced', 'all', entries.filter((e) => e.difficulty === 'advanced').length],
  ['level intermediate', '', 'intermediate', 'all', entries.filter((e) => e.difficulty === 'intermediate').length],
  ['age 4-5', '', '', '4-5', entries.filter((e) => minAge(e.ageRange) <= 5).length],
  ['age 13+', '', '', '13+', entries.filter((e) => minAge(e.ageRange) <= 99).length],
  ['Python beginners age 9-12', 'Python', 'beginner', '9-12',
    entries.filter((e) => haystack(e).includes('python') && e.difficulty === 'beginner' && minAge(e.ageRange) <= 12).length],
];
for (const [name, tool, diff, age, expected] of cases) {
  const got = visible(tool, diff, age);
  ok('filter ' + name + ' returns ' + expected, got === expected, 'got ' + got);
}

if (failures) {
  console.log('\nFAIL workshop-hub-qa: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS workshop-hub-qa: hub links all workshops, filters match data');
