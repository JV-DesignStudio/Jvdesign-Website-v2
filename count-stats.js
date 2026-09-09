#!/usr/bin/env node
/**
 * count-stats.js , Count actual games, books, and workshops on the site
 *
 * Run from the root of the site folder:
 *   node count-stats.js
 *
 * Outputs the real numbers to paste into your homepage hero copy,
 * "Who Makes This?" section, and feature cards , so they all match.
 *
 * Uses filename patterns that match the current site structure.
 * Review the PATTERNS section below and adjust if you rename files.
 */

const fs   = require('fs');
const path = require('path');

const SITE_ROOT = process.cwd();
const SKIP_DIRS = ['node_modules', '.git', '_site', 'dist', 'build', 'fixes'];

/* ─── File patterns ────────────────────────────────────────────────── */
// Files that are actual playable browser games (not tutorial pages)
const GAME_PATTERNS = [
  /^lumo_firefly_night/,
  /^pips_night_sky/,
  /^pip_star_connect/,
  /^arcane_citadel(?!_page)/,   // game file, not the promo page
  /^arcane_citadel_page/,
  /^gem_match/,
  /^cozy.cafe.match.game/,
  /^cozy.biscuit.clicker/,
  /^voidrush/,
  /^echo.fruit.catch/,
  /^echo.and.the/,
  /^sky.high.squirt/,
  /^cozy.creatures/,
  /^call.of.the.cards/,
  /^crypt.crawlers/,
  /^candy.kingdom/,
  /^millionaire.quiz/,
  /^follow.along/,
  /^pip.and.the.night.sky/,
  /^lumo.and.the.grumble/,       // also a book, but has a playable element
];

// Files that are children's books / story pages
const BOOK_PATTERNS = [
  /^lumo.and.the.grumble/,
  /^pip.and.the.night.sky/,
  /^echo.and.the.mout/,
  /^elara/,
  /^stardust/,
];

// Files that are workshop / tutorial guides (not the builder tools)
const WORKSHOP_PATTERNS = [
  /^godot.tutorial/,
  /^godot.templates/,
  /^space.invaders.tutorial/,
  /^unity.top.down.shooter/,
  /^unity.3d/,
  /^js.platformer.builder/,
  /^race.builder/,
  /^python.game.builder/,
  /^unreal.zombie/,
  /^racing.blueprint/,
  /^unreal.fighter/,
  /^unreal.clicker/,
  /^roblox.creator/,
  /^mugen.workshop/,
  /^add.your.own.stage/,
  /^openrct2/,
  /^cpp.tower/,
  /^diablo.blueprint/,
  /^gml.shooter/,
  /^pirate.ship/,
  /^pirate.cannon/,
  /^steampunk.airship/,
  /^sci.fi.runner/,
  /^cozy.creatures.*builder/,
];

/* ─── Walker ────────────────────────────────────────────────────────── */
function walkHTML(dir, files = []) {
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(name)) walkHTML(full, files);
    } else if (path.extname(name).toLowerCase() === '.html') {
      files.push({ full, name: name.toLowerCase() });
    }
  });
  return files;
}

/* ─── Count ─────────────────────────────────────────────────────────── */
const allFiles = walkHTML(SITE_ROOT);

const games     = allFiles.filter(f => GAME_PATTERNS.some(p => p.test(f.name)));
const books     = allFiles.filter(f => BOOK_PATTERNS.some(p => p.test(f.name)));
const workshops = allFiles.filter(f => WORKSHOP_PATTERNS.some(p => p.test(f.name)));

/* ─── Tools / interactive builders ─────────────────────────────────── */
const TOOL_PATTERNS = [
  /gdd.builder/, /story.editor/, /sfx.generator/, /project.tracker/,
  /colour.palette/, /openrct2.modding/, /openrct2.swim/,
];
const tools = allFiles.filter(f => TOOL_PATTERNS.some(p => p.test(f.name)));

/* ─── Output ─────────────────────────────────────────────────────────── */
console.log('\n📊  JV Design Studio , Site Statistics\n');
console.log(`   Total HTML files: ${allFiles.length}`);
console.log(`\n   🎮  Games (playable):      ${games.length}`);
games.forEach(f => console.log(`      - ${f.name}`));

console.log(`\n   📚  Books / stories:       ${books.length}`);
books.forEach(f => console.log(`      - ${f.name}`));

console.log(`\n   🛠️   Workshop guides:       ${workshops.length}`);
workshops.forEach(f => console.log(`      - ${f.name}`));

console.log(`\n   🔧  Interactive tools:     ${tools.length}`);
tools.forEach(f => console.log(`      - ${f.name}`));

console.log('\n─────────────────────────────────────────');
console.log('\n📋  Suggested homepage copy:\n');
console.log(`   Hero stat bar: "${games.length}+ browser games · ${books.length} picture books · ${workshops.length}+ workshops"`);
console.log(`   Feature card (games): "${games.length} free games"`);
console.log(`   "Who Makes This?" section: "${games.length} browser games"`);
console.log(`   Workshop section subtitle: "${workshops.length}+ interactive workshops"`);
console.log('\n   ⚠️  Check these counts against what is actually LIVE and WORKING.');
console.log('   Some files may be works-in-progress or placeholder pages.\n');

console.log('📝  Paste the numbers you want into these locations in index.html:');
console.log('   1. Hero description: "X interactive workshops...plus Y browser games"');
console.log('   2. Feature card "Free Games": the number in .feat-card-desc');
console.log('   3. About strip stats: .stat-num for Games and Books');
console.log('   4. "Who Makes This?" section: the games count stat\n');
