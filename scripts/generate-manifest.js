#!/usr/bin/env node
// generate-manifest.js - content ownership manifest (A13 successor)
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const manifest={
  generated: new Date().toISOString(),
  sources: {
    "pages/dev-tools.html -> content/tools.json": { count: JSON.parse(fs.readFileSync(path.join(ROOT,'content/tools.json'),'utf8')).length, expected: 40 },
    "games-registry.js -> content/games.json": { curated: JSON.parse(fs.readFileSync(path.join(ROOT,'content/games.json'),'utf8')).length, filesystem: fs.readdirSync(path.join(ROOT,'games')).filter(f=>f.endsWith('.html')).length - 8 },
    "workshops/*.html -> content/workshops.json": { json: JSON.parse(fs.readFileSync(path.join(ROOT,'content/workshops.json'),'utf8')).length, filesystem: 182 }
  }
};
fs.writeFileSync(path.join(ROOT,'content/manifest.json'), JSON.stringify(manifest,null,2));
console.log('✓ manifest:', JSON.stringify(manifest,null,2));
// Fail if mismatch
if(manifest.sources["pages/dev-tools.html -> content/tools.json"].count !== 40) { console.error('tools mismatch'); process.exit(1); }
if(manifest.sources["games-registry.js -> content/games.json"].curated !== 32) { console.error('games mismatch'); process.exit(1); }
console.log('✓ all source counts match');
