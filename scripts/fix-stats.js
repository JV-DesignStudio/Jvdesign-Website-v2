/**
 * fix-stats.js
 * Enforces consistent stats across all HTML files.
 * True counts: 160 workshops, 32 games, 6 books, 37 tools
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const replacements = [
  // Workshops: 173 -> 160
  { pattern: /173\s*(free\s+)?(?:interactive\s+)?(?:courses|workshops)/gi, desc: '173 workshops' },
  { pattern: /173\s+free\s+workshops/gi, desc: '173 free workshops' },
  { pattern: /(?:See\s+All\s+)173(\s+workshops)/gi, desc: 'See All 173 workshops' },
  { pattern: /173\s+workshops/gi, desc: '173 workshops' },

  // Games: 28 -> 32
  { pattern: /28\s+games/gi, desc: '28 games' },
  { pattern: /all\s+28\s+games/gi, desc: 'all 28 games' },

  // Games: 40 -> 32 (some pages say 40)
  { pattern: /40\s+games/gi, desc: '40 games' },
  { pattern: /40\s+playable\s+browser\s+games/gi, desc: '40 playable browser games' },

  // Games: 20+ -> 32
  { pattern: /20\+\s+games/gi, desc: '20+ games' },

  // Books: 5 -> 6
  { pattern: /5\s+books/gi, desc: '5 books' },

  // Books: 8 -> 6
  { pattern: /8\s+books/gi, desc: '8 books' },

  // Tools: 30 -> 37
  { pattern: /30\s+(?:free\s+)?(?:browser[- ]based\s+)?(?:creative\s+)?tools/gi, desc: '30 tools' },
  { pattern: /30\+\s+(?:free\s+)?(?:browser[- ]based\s+)?tools/gi, desc: '30+ tools' },

  // Devlog specific
  { pattern: /173\s+coding\s+and\s+creative\s+workshops/gi, desc: '173 coding and creative workshops' },
];

let totalChanges = 0;
const changedFiles = new Set();

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.claude', 'quest-board-deploy', 'scripts'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.name.endsWith('.html')) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanged = false;

  // 173 -> 160 for workshops
  const newContent1 = content.replace(/173\s+(?:free\s+)?(?:interactive\s+)?(?:courses|workshops)/gi, (match) => {
    return match.replace(/173/g, '160');
  });
  if (newContent1 !== content) { content = newContent1; fileChanged = true; }

  // "See All 173 workshops" -> "See All 160 workshops"
  const newContent2 = content.replace(/(See\s+All\s+)173(\s+workshops)/gi, '$1160$2');
  if (newContent2 !== content) { content = newContent2; fileChanged = true; }

  // "173 workshops" anywhere
  const newContent3 = content.replace(/173\s+workshops/gi, '160 workshops');
  if (newContent3 !== content) { content = newContent3; fileChanged = true; }

  // "28 games" -> "32 games"
  const newContent4 = content.replace(/28\s+games/gi, '32 games');
  if (newContent4 !== content) { content = newContent4; fileChanged = true; }

  // "40 games" -> "32 games" (careful - only in game context)
  const newContent5 = content.replace(/40\s+(?:playable\s+)?(?:browser\s+)?games/gi, '32 games');
  if (newContent5 !== content) { content = newContent5; fileChanged = true; }

  // "20+ games" -> "32 games"
  const newContent6 = content.replace(/20\+\s+games/gi, '32 games');
  if (newContent6 !== content) { content = newContent6; fileChanged = true; }

  // "5 books" -> "6 books" (only in book context)
  const newContent7 = content.replace(/5\s+books/gi, '6 books');
  if (newContent7 !== content) { content = newContent7; fileChanged = true; }

  // "8 books" -> "6 books"
  const newContent8 = content.replace(/8\s+books/gi, '6 books');
  if (newContent8 !== content) { content = newContent8; fileChanged = true; }

  // "30 tools" -> "37 tools"
  const newContent9 = content.replace(/30\+?\s+(?:free\s+)?(?:browser[- ]based\s+)?(?:creative\s+)?tools/gi, '37 tools');
  if (newContent9 !== content) { content = newContent9; fileChanged = true; }

  // "30+ free browser-based tools" etc
  const newContent10 = content.replace(/30\+\s+free\s+browser[- ]based\s+tools/gi, '37 free tools');
  if (newContent10 !== content) { content = newContent10; fileChanged = true; }

  if (fileChanged) {
    fs.writeFileSync(filePath, content, 'utf8');
    changedFiles.add(path.relative(ROOT, filePath));
    totalChanges++;
  }
}

console.log('Fixing stats across all HTML files...\n');
walk(ROOT);
console.log(`\nDone. ${totalChanges} files updated.`);
if (changedFiles.size > 0) {
  console.log('\nChanged files:');
  [...changedFiles].sort().forEach(f => console.log(`  ${f}`));
}
