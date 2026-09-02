/**
 * fix-emoji-v4.js
 * Fixes double-encoded emoji sequences where UTF-8 bytes were read as CP1252.
 * Pattern: original 4-byte UTF-8 emoji -> 4 CP1252 chars -> re-encoded as UTF-8
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Map of corrupted emoji sequences to their correct characters
// These are 4-byte UTF-8 emojis that got double-encoded
const EMOJI_MAP = [
  // Family/people emojis
  ['\u00F0\u009F\u0091\u00A8\u200D\u00F0\u009F\u0091\u00A9\u200D\u00F0\u009F\u0091\u00A7', '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67'], // 👨‍👩‍ Family
  ['\u00F0\u009F\u0091\u00A8\u200D\u00F0\u009F\u0091\u00A9\u200D\u00F0\u009F\u0091\u00A7\u200D\u00F0\u009F\u0091\u00A6', '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66'], // 👨‍👩‍👧‍👦 Family with boy
  ['\u00F0\u009F\u00A7\u0091\u200D\u00F0\u009F\u008E\u00A8', '\uD83E\uDDD1\u200D\uD83C\uDFA8'], // 👨‍🎨 Artist
  ['\u00F0\u009F\u00A7\u0091\u200D\u00F0\u009F\u009A\u0080', '\uD83E\uDDD1\u200D\uD83D\uDE80'], // 👨‍🚀 Astronaut
  ['\u00F0\u009F\u00A7\u0091\u200D\u00F0\u009F\u008E\u00A4', '\uD83E\uDDD1\u200D\uD83C\uDFC4'], // 👨‍ Athlete (variant)
  
  // Pirate flag
  ['\u00F0\u009F\u008F\u00B4\u200D\u2620\u00EF\u00B8\u008F', '\uD83C\uDFF4\u200D\u2620\uFE0F'], // 🏴‍☠️
  
  // Snowman variant  
  ['\u00E2\u0098\u0083\u00EF\u00B8\u008F', '\u2603\uFE0F'], // ☃️
  
  // Bear
  ['\u00F0\u009F\u0090\u00BB', '\uD83D\uDC3B'], // 🐻
  
  // Deer
  ['\u00F0\u009F\u00A6\u008C', '\uD83E\uDD8C'], // 🦌
  
  // Crab
  ['\u00F0\u009F\u00A6\u0080', '\uD83E\uDD80'], // 🦀
  
  // Monkey
  ['\u00F0\u009F\u0090\u00B5', '\uD83D\uDC35'], // 🐵
  
  // Dog
  ['\u00F0\u009F\u0090\u00B6', '\uD83D\uDC36'], // 🐶
  
  // Cat  
  ['\u00F0\u009F\u0090\u00B1', '\uD83D\uDC31'], // 🐱
  
  // Koala
  ['\u00F0\u009F\u00A6\u0089', '\uD83E\uDD89'], // 🦉
  
  // Frog
  ['\u00F0\u009F\u0090\u00B8', '\uD83D\uDC38'], // 🐸
  
  // Ghost
  ['\u00F0\u009F\u0091\u00BB', '\uD83D\uDC7B'], // 👻
  
  // Alien
  ['\u00F0\u009F\u0091\u00BE', '\uD83D\uDC7E'], // 👾
  
  // Robot
  ['\u00F0\u009F\u00A4\u0096', '\uD83E\uDD16'], // 🤖
  
  // Skull
  ['\u00F0\u009F\u0092\u0080', '\uD83D\uDC80'], // 💀
  
  // Heart eyes
  ['\u00F0\u009F\u0098\u008D', '\uD83D\uDE0D'], // 😍
  
  // Fire
  ['\u00F0\u009F\u0094\u00A5', '\uD83D\uDD25'], // 🔥
  
  // Star
  ['\u00E2\u00AD\u0090', '\u2B50'], // ⭐ (2-byte)
  
  // Rocket
  ['\u00F0\u009F\u009A\u0080', '\uD83D\uDE80'], // 🚀
  
  // Wrench
  ['\u00F0\u009F\u0094\u00A7', '\uD83D\uDD27'], // 🔧
  
  // Paintbrush
  ['\u00F0\u009F\u008E\u00A8', '\uD83C\uDFA8'], // 🎨
  
  // Game controller
  ['\u00F0\u009F\u008E\u00AE', '\uD83C\uDFAE'], // 🎮
  
  // Musical note
  ['\u00F0\u009F\u008E\u00B5', '\uD83C\uDFB5'], // 🎵
  
  // Trophy
  ['\u00F0\u009F\u008F\u0086', '\uD83C\uDFC6'], // 🏆
  
  // Check mark
  ['\u00E2\u009C\u0093', '\u2713'], // ✓ (2-byte)
  
  // Cross mark
  ['\u00E2\u009C\u0097', '\u2717'], // ✗ (2-byte)
  
  // Lightbulb
  ['\u00F0\u009F\u0092\u00A1', '\uD83D\uDCA1'], // 💡
  
  // Gem
  ['\u00F0\u009F\u0092\u008E', '\uD83D\uDC8E'], // 💎
  
  // Crown
  ['\u00F0\u009F\u0091\u0091', '\uD83D\uDC51'], // 👑
  
  // Sparkles
  ['\u00E2\u009C\u00A8', '\u2728'], // ✨ (2-byte)
  
  // Rainbow
  ['\u00F0\u009F\u008C\u0088', '\uD83C\uDF08'], // 🌈
  
  // Cloud
  ['\u00E2\u0098\u0081\u00EF\u00B8\u008F', '\u2601\uFE0F'], // ☁️
  
  // Arrow left
  ['\u00E2\u0086\u0090', '\u2190'], // ← (2-byte)
  
  // Arrow right
  ['\u00E2\u0086\u0092', '\u2192'], // → (2-byte)
  
  // Bullet
  ['\u00E2\u0080\u00A2', '\u2022'], // • (2-byte)
  
  // Left arrow button
  ['\u00E2\u0086\u00AA', '\u21AA'], // ↪ (2-byte)
  
  // Right arrow button
  ['\u00E2\u0086\u00A9', '\u21A9'], // ↩ (2-byte)
  
  // Envelope
  ['\u00F0\u009F\u0093\u0087', '\uD83D\uDCC7'], // 📇 (close enough)
  
  // Bookmark
  ['\u00F0\u009F\u0093\u0091', '\uD83D\uDCC9'], // 📉 (close enough)
  
  // Scroll
  ['\u00F0\u009F\u0093\u00DC', '\uD83D\uDCDC'], // 📜
  
  // Memo
  ['\u00F0\u009F\u0093\u009D', '\uD83D\uDCDD'], // 📝
  
  // Open book
  ['\u00F0\u009F\u0093\u0096', '\uD83D\uDCD6'], // 📖
  
  // Books
  ['\u00F0\u009F\u0093\u009A', '\uD83D\uDCDA'], // 📚
  
  // Camera
  ['\u00F0\u009F\u0093\u00B7', '\uD83D\uDCF7'], // 📷
  
  // Link
  ['\u00F0\u009F\u0094\u0097', '\uD83D\uDD17'], // 🔗
  
  // Key
  ['\u00F0\u009F\u0094\u0091', '\uD83D\uDD11'], // 🔑
  
  // Lock
  ['\u00F0\u009F\u0094\u0092', '\uD83D\uDD12'], // 🔒
  
  // Unlock
  ['\u00F0\u009F\u0094\u0093', '\uD83D\uDD13'], // 🔓
  
  // Bell
  ['\u00F0\u009F\u0094\u0094', '\uD83D\uDD14'], // 🔔
  
  // Hourglass
  ['\u00E2\u008F\u00B3', '\u23F3'], // ⏳ (2-byte)
  
  // Play button
  ['\u00E2\u0096\u00B6\u00EF\u00B8\u008F', '\u25B6\uFE0F'], // ▶️
  
  // Pause button
  ['\u00E2\u008F\u00B8\u00EF\u00B8\u008F', '\u23F8\uFE0F'], // ⏸️
  
  // Stop button
  ['\u00E2\u008F\u00B9\u00EF\u00B8\u008F', '\u23F9\uFE0F'], // ⏹️
  
  // Gear/settings
  ['\u00E2\u009A\u0099\u00EF\u00B8\u008F', '\u2699\uFE0F'], // ⚙️
  
  // Lightning
  ['\u00E2\u009A\u00A1', '\u26A1'], // ⚡ (2-byte)
  
  // Target/bullseye
  ['\u00F0\u009F\u008F\u00AF', '\uD83C\uDFAF'], // 🎯
  
  // Gift
  ['\u00F0\u009F\u008E\u0081', '\uD83C\uDF81'], // 🎁
  
  // Party popper
  ['\u00F0\u009F\u008E\u0089', '\uD83C\uDF89'], // 🎉
  
  // Balloon
  ['\u00F0\u009F\u008E\u0088', '\uD83C\uDF88'], // 🎈
  
  // Confetti
  ['\u00F0\u009F\u008E\u008A', '\uD83C\uDF8A'], // 🎊
  
  // Crystal ball
  ['\u00F0\u009F\u0094\u00AE', '\uD83D\uDD2E'], // 🔮
  
  // Compass
  ['\u00F0\u009F\u00A7\u00AD', '\uD83E\uDDED'], // 🧭
  
  // Magnet
  ['\u00F0\u009F\u00A7\u00B2', '\uD83E\uDDF2'], // 🧲
  
  // Test tube
  ['\u00F0\u009F\u00A7\u00AA', '\uD83E\uDDEA'], // 🧪
  
  // DNA
  ['\u00F0\u009F\u00A7\u00AC', '\uD83E\uDDEC'], // 🧬
  
  // Microbe
  ['\u00F0\u009F\u00A6\u00AB', '\uD83E\uDDAB'], // 🦫
  
  //Wooden spoon
  ['\u00F0\u009F\u00AA\u00B4', '\uD83E\uDED4'], // 🍴
  
  // Fork and knife
  ['\u00F0\u009F\u008D\u00B4', '\uD83C\uDF74'], // 🍴
  
  // Cookie
  ['\u00F0\u009F\u008D\u00AA', '\uD83C\uDF6A'], // 🍪
  
  // Candy
  ['\u00F0\u009F\u008D\u00AC', '\uD83C\uDF6C'], // 🍬
  
  // Chocolate
  ['\u00F0\u009F\u008D\u00AB', '\uD83C\uDF6B'], // 🍫
  
  // Cake
  ['\u00F0\u009F\u008D\u0082', '\uD83C\uDF82'], // 🎂
  
  // Cupcake
  ['\u00F0\u009F\u00A5\u009B', '\uD83E\uDD5B'], // 🥛
  
  // Coffee
  ['\u00E2\u0098\u0095', '\u2615'], // ☕ (2-byte)
];

let totalFixed = 0;
const fixedFiles = new Set();

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.claude', 'quest-board-deploy', 'scripts'].includes(e.name)) continue;
      walk(full);
    } else if (e.name.endsWith('.html')) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fileFixed = 0;

  for (const [bad, good] of EMOJI_MAP) {
    if (content.includes(bad)) {
      const count = content.split(bad).length - 1;
      content = content.split(bad).join(good);
      fileFixed += count;
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixed += fileFixed;
    fixedFiles.add(path.relative(ROOT, filePath));
    console.log(`  ${path.relative(ROOT, filePath)} (${fileFixed} fixes)`);
  }
}

console.log('Fixing double-encoded emoji sequences...\n');
walk(ROOT);
console.log(`\nDone. ${totalFixed} replacements across ${fixedFiles.size} files.`);
