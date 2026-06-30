#!/usr/bin/env node

/**
 * Game System Integration Script
 * Automates adding game system integration to existing games
 *
 * Usage: node update-games.js <gameFile.html>
 * Or: node update-games.js --all (to process all games)
 */

const fs = require('fs');
const path = require('path');

const GAME_SYSTEM_SCRIPT = `<script src="../game-system.js"><\/script>`;
const GAME_SYSTEM_CSS = `<link rel="stylesheet" href="../game-system.css">`;

const GAME_CONFIGS = {
  'cozy-cafe-match-game.html': {
    id: 'cozy-cafe',
    name: 'Cozy Cafe Match',
    character: 'pip',
    achievements: [
      { id: 'firstMatch', name: '🎮 First Match', desc: 'Play your first game' },
      { id: 'score500', name: '⭐ Score 500', desc: 'Reach 500 points' },
      { id: 'score1000', name: '🏆 Score 1000', desc: 'Reach 1000 points' }
    ]
  },
  'sky_high_squirt.html': {
    id: 'sky-high-squirt',
    name: 'Sky High Squirt',
    character: 'squirt',
    achievements: [
      { id: 'firstJump', name: '🎮 First Bounce', desc: 'Play your first game' },
      { id: 'height100', name: '⭐ Height 100', desc: 'Reach height 100' },
      { id: 'height500', name: '🏆 Height 500', desc: 'Reach height 500' }
    ]
  },
  'tiger_smash.html': {
    id: 'tiger-smash',
    name: 'Tiger Smash',
    character: 'tiger',
    achievements: [
      { id: 'firstBreak', name: '🎮 First Smash', desc: 'Break your first brick' },
      { id: 'score100', name: '⭐ Score 100', desc: 'Reach 100 points' },
      { id: 'score500', name: '🏆 Score 500', desc: 'Reach 500 points' }
    ]
  },
  'cozy-biscuit-clicker.html': {
    id: 'biscuit-clicker',
    name: 'Biscuit Clicker',
    character: 'pip',
    achievements: [
      { id: 'firstClick', name: '🎮 First Bite', desc: 'Click your first biscuit' },
      { id: 'clicks100', name: '⭐ 100 Clicks', desc: 'Click 100 biscuits' },
      { id: 'clicks1000', name: '🏆 1000 Clicks', desc: 'Click 1000 biscuits' }
    ]
  }
};

/**
 * Check if game system is already integrated
 */
function isIntegrated(content) {
  return content.includes('game-system.js') || content.includes('GameSystem');
}

/**
 * Add game system script to head
 */
function addGameSystemToHead(content) {
  if (content.includes('game-system.js')) {
    console.log('  ✓ Game system already linked');
    return content;
  }

  const headMatch = content.match(/<\/head>/i);
  if (!headMatch) {
    throw new Error('No </head> tag found');
  }

  const scriptTag = `${GAME_SYSTEM_SCRIPT}\n${GAME_SYSTEM_CSS}\n`;
  const before = content.substring(0, headMatch.index);
  const after = content.substring(headMatch.index);

  return before + scriptTag + after;
}

/**
 * Add initialization script
 */
function addInitializationScript(content, config) {
  if (content.includes('new GameSystem')) {
    console.log('  ✓ Game system already initialized');
    return content;
  }

  const bodyMatch = content.match(/<\/body>/i);
  if (!bodyMatch) {
    throw new Error('No </body> tag found');
  }

  const initScript = `<script>
// Auto-integrated with JVDS Game System
const gameSystem = new GameSystem('${config.id}', '${config.name}', '${config.character}');
const soundManager = new SoundManager(gameSystem);

// Save state periodically
setInterval(() => gameSystem.saveState(), 5000);
</script>`;

  const before = content.substring(0, bodyMatch.index);
  const after = content.substring(bodyMatch.index);

  return before + initScript + after;
}

/**
 * Process single game file
 */
function processGame(filePath) {
  const fileName = path.basename(filePath);
  const config = GAME_CONFIGS[fileName];

  if (!config) {
    console.log(`⚠️  No config for ${fileName}`);
    return false;
  }

  console.log(`\n📝 Processing: ${fileName}`);
  console.log(`   ID: ${config.id}, Character: ${config.character}`);

  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    if (isIntegrated(content)) {
      console.log('  ✓ Already integrated, skipping');
      return false;
    }

    console.log('  Adding game system...');
    content = addGameSystemToHead(content);
    content = addInitializationScript(content, config);

    // Write back
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✅ Updated successfully`);
    return true;

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Process all games
 */
function processAllGames() {
  const gamesDir = path.join(__dirname, 'games');
  const files = fs.readdirSync(gamesDir)
    .filter(f => f.endsWith('.html') && GAME_CONFIGS[f])
    .map(f => path.join(gamesDir, f));

  console.log(`\n🎮 Game System Integration Tool`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Found ${files.length} games to process\n`);

  let updated = 0;
  files.forEach(file => {
    if (processGame(file)) {
      updated++;
    }
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Done! Updated ${updated} games\n`);
  console.log(`Next steps:`);
  console.log(`1. Test each game in browser`);
  console.log(`2. Customize achievements per game`);
  console.log(`3. Add HUD elements to game canvas`);
  console.log(`4. Wire up score tracking\n`);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--all')) {
  processAllGames();
} else if (args.length > 0) {
  const file = path.join(__dirname, 'games', args[0]);
  if (!fs.existsSync(file)) {
    console.error(`❌ File not found: ${file}`);
    process.exit(1);
  }
  processGame(file);
} else {
  console.log('Usage:');
  console.log('  node update-games.js <gameFile.html>  - Update single game');
  console.log('  node update-games.js --all            - Update all configured games');
  process.exit(0);
}
