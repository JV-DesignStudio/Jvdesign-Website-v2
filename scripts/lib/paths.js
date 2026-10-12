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
  'chars', 'chars-orig', 'models', 'covers',
  // Internal-only: never published, so never sitemap/search/validate as pages.
  'tmp', 'archive'
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
  'pages/leaderboards.html',
  'pages/games.html',
  'games/sky_high_squirt.html',
  'tools/tileset-builder.html'
]);

// Games that live in games/ but are NOT part of the live arcade line-up.
// They stay on disk (so nothing is lost and any can be promoted back) but are
// excluded from the sitemap, search index and arcade grid. The live line-up is
// games-registry.js; curated filesystem count = raw - GAME_ORPHANS.
const GAME_ORPHANS = [
  'games/arcane_citadel.html','games/backpack-quest.html','games/beat-builder-battle.html',
  'games/bread-blocks.html','games/bubble-pop-galaxy.html','games/call-of-the-cards-playtest.html',
  'games/call_of_the_cards.html','games/candy_kingdom.html','games/cozy_creatures.html',
  'games/creature-rescue-clinic.html','games/critter-whack-page.html','games/critter-whack.html',
  'games/crossy-crew.html','games/crypt-crawlers.html','games/dough-dash.html',
  'games/dungeon-delve.html','games/echo-casebook.html','games/echo_fruit_catch.html',
  'games/garden-defense.html','games/little_steps.html','games/lumo-dash-page.html',
  'games/lumo-dash.html','games/lumo-run.html','games/lumo_firefly_night.html',
  'games/marble-run-lab.html','games/millionaire-quiz.html','games/mini-theme-park-builder.html',
  'games/mobile-games.html','games/neon-tiles.html','games/nibble-quest-page.html',
  'games/nibble-quest.html','games/paper-toss-deluxe.html','games/pastry-match.html',
  'games/pips-bakery-empire.html','games/pip_star_connect.html','games/pixel-pet-arena.html',
  'games/play.html','games/sky_high_squirt.html','games/stack-attack-page.html',
  'games/stack-attack.html','games/star-chef.html','games/stardust-ruins.html',
  'games/stardust_collection.html','games/tiger_smash.html','games/voidrush.html'
  // lumo-run.html is a noindex redirect to lumo-dash.html (A967 consolidation).
  // tiger_smash.html is a noindex redirect to ember-smash.html (A980).
  // play.html is the shared Arcade cover/launcher (noindex), not a curated game.
  // The rest are awaiting rework before they return to the arcade line-up.
];

const BASE_URL = 'https://jvdesignstudio.co.uk';

module.exports = { ROOT, IGNORE_DIRS, EXCLUDE_FILES, GAME_ORPHANS, BASE_URL };
