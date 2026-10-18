// A1669: the generated content/tools.json must not mis-file reference material
// as a maker category. The old keyword heuristic put cheatsheets in "Make Audio"
// (their blurbs mention audio) and some in "Make Art" (they mention sprites).
// Pure Node, no browser.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const byId = {};
tools.forEach((t) => { byId[t.id] = t; });

// Cheatsheets, glossaries and starter guides are reference material, not a maker
// tool, so they must not land in a maker category.
const refIds = [
  'cpp-cheatsheet', 'java-cheatsheet', 'javascript-cheatsheet', 'python-cheatsheet',
  'scratch-cheatsheet', 'gamemaker-cheatsheet', 'godot-cheatsheet', 'unity-cheatsheet',
  'unreal-cheatsheet', 'gdevelop-cheatsheet', 'defold-cheatsheet', 'pico8-cheatsheet',
  'minecraft-cheatsheet', 'roblox-cheatsheet', 'keyboard-shortcuts', 'glossary',
  'scratch-starter-guide', 'unity-starter-setup', 'parent-guide', 'gallery'
];
const MISFILED = new Set(['Make Audio', 'Make Art']);
for (const id of refIds) {
  const t = byId[id];
  if (!t) { ok('reference tool present: ' + id, false, 'missing from content/tools.json'); continue; }
  ok(id + ' is not a maker category', !MISFILED.has(t.category), 'category=' + t.category);
}

// Real maker tools keep their maker category.
const expect = { 'pixel-studio': 'Make Art', 'sound-studio': 'Make Audio', 'level-designer': 'Build Worlds' };
for (const [id, cat] of Object.entries(expect)) {
  const t = byId[id];
  ok(id + ' is ' + cat, t && t.category === cat, t && t.category);
}

console.log(failures === 0 ? 'ALL TOOLS TAXONOMY CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
