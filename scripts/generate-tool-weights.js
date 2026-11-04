#!/usr/bin/env node
// Refresh content/tool-weights.json: approximate HTML weight and offline state
// for every catalogued tool. Offline is true when the page is in sw.js CORE or
// is the on-demand Arcade Game Maker.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const out = {};

for (const tool of tools) {
  if (!tool.url || !tool.url.startsWith('/tools/')) continue;
  const rel = tool.url.replace(/^\//, '');
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const kb = Math.max(1, Math.round(fs.statSync(file).size / 1024));
  const id = path.basename(rel, '.html');
  const offline = sw.includes("'" + tool.url + "'") || id === 'arcade-game-maker';
  out[id] = { kb, offline };
}

// The 3D builders live in workshops/ but are catalogued as tools in the hub.
try {
  const builders = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', '3d-builders.json'), 'utf8')).builders || [];
  for (const builder of builders) {
    const id = builder.id;
    if (!id) continue;
    const rel = 'workshops/' + id + '.html';
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    out[id] = { kb: Math.max(1, Math.round(fs.statSync(file).size / 1024)), offline: sw.includes("'/" + rel + "'") };
  }
} catch (e) {}

fs.writeFileSync(path.join(ROOT, 'content', 'tool-weights.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Wrote content/tool-weights.json for ' + Object.keys(out).length + ' tools.');
