/**
 * fix-emoji-v3.js
 * Replaces corrupted ? characters with correct emojis based on context.
 * The original emoji data was lost during double-encoding corruption.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Context-based emoji replacements
// Format: [regex to match the context, replacement string]
const EMOJI_FIXES = [
  // Tool/site titles
  [/>>\s*Icon Generator/, '>🎨 Icon Generator'],
  [/>>\s*Welcome to Icon/, '>🎨 Welcome to Icon'],
  [/>>\s*Sound Studio/, '>🎵 Sound Studio'],
  [/>>\s*Welcome to Sound/, '>🎵 Welcome to Sound'],
  [/>>\s*Arcade Game/, '>🎮 Arcade Game'],
  [/>>\s*Racing/, '>🏎️ Racing'],
  [/>>\s*Platform Level/, '>🎮 Platform Level'],
  [/>>\s*Glow/, '>✨ Glow'],
  
  // Toast messages
  [/Share link copied/, '🔗 Share link copied'],
  [/Pattern copied/, '📋 Pattern copied'],
  [/Pattern pasted/, '📋 Pattern pasted'],
  [/BuildLab link cop/, '🔗 BuildLab link cop'],
  
  // Buttons
  [/Send to Game Mak/, '🎮 Send to Game Mak'],
  [/Send to Game Ma/, '🎮 Send to Game Ma'],
  
  // Achievement/collectible names
  [/'\?\?\?'/g, "'🎯'"],
  [/'\?\?'/g, "'⭐'"],
  
  // Tiger Smash icons
  [/icon: '\?\?\?'/g, "icon: '🎯'"],
  
  // Stardust collection shards
  [/Shards Banked/, '⭐ Shards Banked'],
  [/Dust Mote/, '✨ Dust Mote'],
  [/Star Sweeper/, '⭐ Star Sweeper'],
  [/Nebula Hoarder/, '🌌 Nebula Hoarder'],
  [/Stardust Collector!/, '✨ Stardust Collector!'],
  
  // Quiz/achievement emojis in game files
  [/Perfect Stage!/, '🏆 Perfect Stage!'],
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

  for (const [pattern, replacement] of EMOJI_FIXES) {
    if (typeof pattern === 'string') {
      if (content.includes(pattern)) {
        // Only replace in string/HTML context, not in JS code
        const newContent = content.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
        if (newContent !== content) {
          fileFixed += (content.split(pattern).length - 1);
          content = newContent;
        }
      }
    } else {
      const matches = content.match(pattern);
      if (matches) {
        fileFixed += matches.length;
        content = content.replace(pattern, replacement);
      }
    }
  }

  // Broader: replace standalone ??? or ?? that appear in HTML text context (not JS operators)
  // Pattern: >???< or ">???" or '"???' etc (in HTML attributes/text)
  const htmlPatterns = [
    [/">\?\?\?</g, '">🎨'],
    [/">\?\?/g, '">⭐'],
    [/>>\?\?\?</g, '>🎨'],
    [/>>\?\?[^<]/g, '>⭐'],
    [/>">\?\?\?</g, '>"🎨'],
  ];
  
  for (const [pat, rep] of htmlPatterns) {
    if (pat.test(content)) {
      const m = content.match(pat);
      if (m) fileFixed += m.length;
      content = content.replace(pat, rep);
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixed += fileFixed;
    fixedFiles.add(path.relative(ROOT, filePath));
    console.log(`  ${path.relative(ROOT, filePath)} (${fileFixed} fixes)`);
  }
}

console.log('Fixing corrupted emoji characters...\n');
walk(ROOT);
console.log(`\nDone. ${totalFixed} replacements across ${fixedFiles.size} files.`);
