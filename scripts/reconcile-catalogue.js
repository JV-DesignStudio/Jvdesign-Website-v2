#!/usr/bin/env node
/**
 * A2634: Reconcile catalogue entries against files on disk.
 * Classifies every HTML file in workshops/, tools/, games/ as:
 *   - catalogued      : has a content/*.json entry
 *   - hub             : known landing/hub/index page
 *   - canvas-variant  : interactive canvas embed (-canvas.html)
 *   - cheatsheet      : reference sheet (should be in tools catalogue)
 *   - orphan          : genuinely missing from catalogue
 *
 * Outputs a human-readable report + a JSON summary.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');

const ws    = require(path.join(BASE, 'content/workshops.json'));
const tools = require(path.join(BASE, 'content/tools.json'));
const games = require(path.join(BASE, 'content/games.json'));

const cataloguedUrls = new Set([
  ...ws.map(x => x.url),
  ...tools.map(x => x.url),
  ...games.map(x => x.url),
]);

// Known hub/landing filenames (not catalogue entries by design)
const HUB_FILES = new Set([
  'learn.html', 'learning-lab.html', 'my-progress.html', 'tiny-learners.html',
  'index.html', 'play.html', 'mobile-games.html',
  'arcade-game-maker-landing.html', 'level-designer-landing.html',
  'map-generator-landing.html', 'pixel-studio-landing.html',
  'sfx-generator-landing.html', 'quest-board-page.html', 'quest-card.html',
  'parent-guide.html', 'subscription.html', 'release-gate.html',
  'storage-migrate.html', 'backup-restore.html', 'certificate.html',
  // Redirect/moved pages - legacy URLs kept for inbound links
  'arcane_citadel_page.html', 'critter-whack-page.html', 'lumo-dash-page.html',
  'lumo-run.html', 'nibble-quest-page.html', 'sky_high_squirt.html',
  'stack-attack-page.html', 'tiger_smash.html', 'call-of-the-cards-playtest.html',
  // Tools that redirect to consolidated replacements
  'dialogue-tree-builder.html',
  'character-designer.html', 'drum-pad.html', 'easy-pixel-art.html',
  'map-generator.html', 'music-maker.html', 'palette-studio.html',
  'sprite-sheet-animator.html', 'tileset-builder.html', 'voxel-studio.html',
  'world-builder-3d.html', 'roblox-builder.html', 'sfx-generator.html',
  // Workshop redirect pages (all moved to 3D Builder or Godot Lab)
  // 3d-builder.html is catalogued via preset URLs in tools.json
  '3d-builder.html',
  'castle-builder.html', 'fairy-tale-builder.html', 'godot-mod-studio.html',
  'phone-stand-builder.html', 'pirate-cannon-builder.html', 'pirate-ship-builder.html',
  'race-car-builder.html', 'robot-builder.html', 'rocket-builder.html',
  'space-station-builder.html', 'steampunk-airship-builder.html', 'submarine-builder.html',
]);

function classify(dir) {
  const full = path.join(BASE, dir);
  const files = fs.readdirSync(full).filter(f => f.endsWith('.html'));
  const rows = [];
  for (const f of files) {
    const url = '/' + dir + '/' + f;
    let cls;
    if (cataloguedUrls.has(url)) {
      cls = 'catalogued';
    } else if (HUB_FILES.has(f)) {
      cls = 'hub';
    } else if (f.includes('-canvas.')) {
      cls = 'canvas-variant';
    } else if (f.endsWith('-cheatsheet.html') || f.endsWith('cheatsheet.html')) {
      cls = 'cheatsheet';
    } else if (f.startsWith('engine-')) {
      cls = 'hub';
    } else {
      cls = 'orphan';
    }
    rows.push({ url, file: f, cls });
  }
  return rows;
}

const all = [
  ...classify('workshops'),
  ...classify('tools'),
  ...classify('games'),
];

const groups = {};
for (const row of all) {
  (groups[row.cls] = groups[row.cls] || []).push(row.url);
}

// Print report
console.log('=== CATALOGUE RECONCILIATION REPORT ===');
console.log('Generated:', new Date().toISOString());
console.log('');
for (const [cls, urls] of Object.entries(groups)) {
  console.log(`--- ${cls.toUpperCase()} (${urls.length}) ---`);
  for (const u of urls.sort()) console.log('  ' + u);
  console.log('');
}

// Summary counts
console.log('=== SUMMARY ===');
for (const [cls, urls] of Object.entries(groups)) {
  console.log(`  ${cls}: ${urls.length}`);
}
console.log('  total:', all.length);

// Write JSON
const out = path.join(BASE, 'scripts/catalogue-reconciliation.json');
fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), groups }, null, 2));
console.log('\nJSON report written to scripts/catalogue-reconciliation.json');
