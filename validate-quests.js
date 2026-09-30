#!/usr/bin/env node
/*
 * validate-quests.js - every quest requirement must resolve to a real workshop/game.
 *
 * Quests referenced workshop ids that never existed (python-basics-workshop,
 * roblox-basics, godot-2d, ...), so learners could be shown impossible goals.
 * This gate fails if any referenced id is missing from content/workshops.json or
 * content/games.json. Run: node validate-quests.js   (and via npm run validate)
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const src = fs.readFileSync(path.join(ROOT, 'quest-system.js'), 'utf8');
const workshops = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/workshops.json'), 'utf8')).map((w) => w.id));
const games = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/games.json'), 'utf8')).map((g) => g.id));
// Cosmetics may be keyed by a tool id (e.g. the Pixel Studio badge), so game refs
// also allow real tool ids.
const tools = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/tools.json'), 'utf8')).map((t) => t.id));
const gameRefs = new Set([...games, ...tools]);

const refs = { workshop: new Set(), game: new Set() };
for (const m of src.matchAll(/type:\s*'workshop'\s*,\s*id:\s*'([^']+)'/g)) refs.workshop.add(m[1]);
for (const m of src.matchAll(/workshopIds:\s*\[([^\]]*)\]/g)) for (const id of m[1].matchAll(/'([^']+)'/g)) refs.workshop.add(id[1]);
for (const m of src.matchAll(/workshopId:\s*'([^']+)'/g)) refs.workshop.add(m[1]);
for (const m of src.matchAll(/gameId:\s*'([^']+)'/g)) refs.game.add(m[1]);

const missingW = [...refs.workshop].filter((id) => !workshops.has(id)).sort();
const missingG = [...refs.game].filter((id) => !gameRefs.has(id)).sort();

console.log(`quest-system.js: ${refs.workshop.size} workshop refs, ${refs.game.size} game refs`);
if (missingW.length) console.error('✗ unknown workshop ids: ' + missingW.join(', '));
if (missingG.length) console.error('✗ unknown game ids: ' + missingG.join(', '));
if (missingW.length || missingG.length) process.exit(1);
console.log('✓ all quest references resolve to real workshops and games');
