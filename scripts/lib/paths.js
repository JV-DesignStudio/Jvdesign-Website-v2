#!/usr/bin/env node
/**
 * scripts/lib/paths.js - Single source of truth for repo paths & ignore rules.
 *
 * Before: every script re-declared ROOT, IGNORE_DIRS, SKIP_DIRS with subtle
 * drift (some excluded .continue, some didn't, some missed questlog-pwa).
 * After: import from here. Change once, fix everywhere.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Directories never walked for HTML pages. Keep in sync with .gitignore intent.
// - node_modules/.git/.claude are tooling
// - partials is fragments, not pages
// - quest-board-deploy is generated, never validated
// - docs/questlog-pwa/og/icons are assets, not pages
// - arcade-app is an external app workspace (if present)
// - scripts itself is build tooling
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.claude', 'partials', 'quest-board-deploy',
  '.github', '.continue', 'og', 'icons', 'downloads', 'pitch-assets',
  'social-posts', 'docs', 'scripts', 'questlog-pwa', 'arcade-app',
  'assets', 'Character Refrence sheets', 'StardustbookPreview',
  'Session and Notes Part 2', 'Session Notes and Documents',
  'chars', 'chars-orig', 'models', 'covers'
]);

// Files never indexed as public pages (noindex or dev templates)
const EXCLUDE_FILES = new Set([
  '404.html', 'offline.html', 'search.html',
  'games/game-template.html', 'games/cozy-biscuit-clicker.pre-app.bak.html',
  'tools/project-tracker.html', 'tools/dev-board.html',
  'privacy-policy/index.html', 'pages/newsletter.html',
  'meet-the-crew.html', 'newsletter.html',
  'tools/dialogue-tree-builder.html',
  'pages/freebies.html',
  'pages/my-progress.html',
  'pages/leaderboards.html'
]);

const GAME_ORPHANS = [
  'games/arcane_citadel.html','games/critter-whack.html','games/lumo-dash.html','games/nibble-quest.html','games/stack-attack.html','games/mobile-games.html','games/sky_high_squirt.html','games/call-of-the-cards-playtest.html'
  // echo-casebook.html and stardust-ruins.html removed — they are curated games in content/games.json
];

const BASE_URL = 'https://jvdesignstudio.co.uk';

module.exports = { ROOT, IGNORE_DIRS, EXCLUDE_FILES, GAME_ORPHANS, BASE_URL };
