/**
 * fix-encoding-v2.js
 * Fixes UTF-8 double-encoding at the byte level.
 * The pattern: original UTF-8 bytes were misinterpreted as Latin-1/CP1252,
 * then re-encoded as UTF-8, creating 3-char sequences from 1 char.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Map of corrupted 3-char sequences to their correct single character
// These are U+00E2 + U+20AC/U+201x + U+00xx sequences
const CHAR_FIXES = new Map();

// Build the map: for each target character, compute its UTF-8 bytes,
// then create the corrupted 3-char version
const targets = [
  ['\u2014', [0xE2, 0x80, 0x94]],  // em dash —
  ['\u2013', [0xE2, 0x80, 0x93]],  // en dash –
  ['\u2018', [0xE2, 0x80, 0x98]],  // left single quote '
  ['\u2019', [0xE2, 0x80, 0x99]],  // right single quote '
  ['\u201C', [0xE2, 0x80, 0x9C]],  // left double quote "
  ['\u201D', [0xE2, 0x80, 0x9D]],  // right double quote "
  ['\u2026', [0xE2, 0x80, 0xA6]],  // ellipsis …
  ['\u2022', [0xE2, 0x80, 0xA2]],  // bullet •
  ['\u2020', [0xE2, 0x80, 0xA0]],  // dagger †
  ['\u2021', [0xE2, 0x80, 0xA1]],  // double dagger ‡
  ['\u00A9', [0xC2, 0xA9]],        // ©
  ['\u00AE', [0xC2, 0xAE]],        // ®
  ['\u00B7', [0xC2, 0xB7]],        // ·
  ['\u00AB', [0xC2, 0xAB]],        // «
  ['\u00BB', [0xC2, 0xBB]],        // »
  ['\u00A7', [0xC2, 0xA7]],        // §
  ['\u00B0', [0xC2, 0xB0]],        // °
  ['\u00B1', [0xC2, 0xB1]],        // ±
  ['\u00B5', [0xC2, 0xB5]],        // µ
  ['\u00B6', [0xC2, 0xB6]],        // ¶
  ['\u00AC', [0xC2, 0xAC]],        // ¬
  ['\u00BC', [0xC2, 0xBC]],        // ¼
  ['\u00BD', [0xC2, 0xBD]],        // ½
  ['\u00BE', [0xC2, 0xBE]],        // ¾
  ['\u2190', [0xE2, 0x86, 0x90]],  // ←
  ['\u2192', [0xE2, 0x86, 0x92]],  // →
  ['\u2191', [0xE2, 0x86, 0x91]],  // ↑
  ['\u2193', [0xE2, 0x86, 0x93]],  // ↓
  ['\u266A', [0xE2, 0x99, 0xAA]],  // ♪
  ['\u266B', [0xE2, 0x99, 0xAB]],  // ♫
  ['\u2713', [0xE2, 0x9C, 0x93]],  // ✓
  ['\u2717', [0xE2, 0x9C, 0x97]],  // ✗
  ['\u2605', [0xE2, 0x98, 0x85]],  // ★
  ['\u2606', [0xE2, 0x98, 0x86]],  // ☆
  ['\u25CF', [0xE2, 0x96, 0x9A]],  // ●
  ['\u25CB', [0xE2, 0x97, 0x8B]],  // ○
  ['\u25A0', [0xE2, 0x96, 0xA0]],  // ■
  ['\u25A1', [0xE2, 0x96, 0xA1]],  // □
  ['\u25B6', [0xE2, 0x96, 0xB6]],  // ▶
  ['\u25C0', [0xE2, 0x97, 0x80]],  // ◀
];

// For each target, compute the corrupted version
for (const [char, bytes] of targets) {
  // The corrupted version is: the first byte becomes U+00XX,
  // then subsequent bytes each become their own character
  // Actually it's simpler: the UTF-8 bytes are interpreted as CP1252/Latin-1
  const cp1252 = bytes.map(b => String.fromCharCode(b)).join('');
  // But the first byte of multi-byte UTF-8 sequences gets double-encoded
  // So we need: first byte -> its UTF-8 encoding, rest stay as-is
  // Actually, the corruption pattern is:
  // Original UTF-8 bytes: B1 B2 B3
  // Read as CP1252: char(B1) + char(B2) + char(B3)
  // Written as UTF-8: utf8(char(B1)) + utf8(char(B2)) + utf8(char(B3))
  // So the corrupted version has: utf8(B1) + utf8(B2) + utf8(B3) as characters
  
  // For bytes >= 0x80, each becomes a 2-byte UTF-8 sequence
  // For bytes < 0x80, each stays as 1 byte
  let corrupted = '';
  for (const b of bytes) {
    corrupted += String.fromCharCode(b);  // This is the CP1252 interpretation
  }
  // But when written as UTF-8, bytes >= 0x80 get double-encoded
  // The actual corruption: bytes E2 80 94 -> read as Latin-1 chars â (U+00E2) € (U+20AC) " (U+2014)
  // Wait, 0x80 in CP1252 is € (U+20AC), not a generic character
  
  // Let me just use the known patterns from the actual file data
  // From the analysis: U+00E2 U+20AC U+201D is the corrupted em dash
  // U+00E2 = â, U+20AC = €, U+201D = "
  // The actual byte sequence is: C3 A2 E2 82 AC E2 80 9D
  
  // For em dash specifically:
  // Original UTF-8: E2 80 94
  // After CP1252 corruption: â (0xE2 -> C3 A2) + € (0x80 -> E2 82 AC) + " (0x94 -> E2 80 94... no)
  // Actually 0x94 in CP1252 is " (U+201D)
  // So: 0xE2 -> â (U+00E2), 0x80 -> € (U+20AC), 0x94 -> " (U+201D)
  // When these are encoded as UTF-8: C3 A2 E2 82 AC E2 80 9D
  
  // The corrupted string (as JS chars) is: '\u00E2\u20AC\u201D'
  // But wait, that's not quite right either. Let me just use the empirical data.
}

// Empirical approach: read a file, find the corrupted sequences, replace them
const CORRUPTION_MAP = {};

// Known corruption patterns from actual file analysis:
// em dash bytes: E2 80 94 -> â (U+00E2) € (U+20AC) " (U+201D)
CORRUPTION_MAP['\u00E2\u20AC\u201D'] = '\u2014';  // em dash
CORRUPTION_MAP['\u00E2\u20AC\u201C'] = '\u2014';  // em dash (variant)

// en dash bytes: E2 80 93 -> â (U+00E2) € (U+20AC) # (U+0093 in CP1252)
// Actually 0x93 in CP1252 is " (U+201C)
CORRUPTION_MAP['\u00E2\u20AC\u201C'] = '\u2013';  // en dash

// Let me just do a broader approach: find any U+00E2 followed by U+20xx and replace
// Actually, the simplest approach: read the raw bytes and look for the pattern

let totalFiles = 0;
let totalChanges = 0;

function fixFile(filePath) {
  const buf = fs.readFileSync(filePath);
  let str = buf.toString('utf8');
  let changes = 0;

  // Fix the most common corruption: the 3-byte em dash mojibake
  // Pattern in UTF-8: C3 A2 E2 82 AC E2 80 9D (â€") = em dash
  // As a JS string this is: \u00E2\u20AC\u201D
  const emDashCorrupted = /\u00E2\u20AC\u201D/g;
  const emDashCorrupted2 = /\u00E2\u20AC\u201C/g;
  
  let match;
  while ((match = emDashCorrupted.exec(str)) !== null) {
    changes++;
  }
  while ((match = emDashCorrupted2.exec(str)) !== null) {
    changes++;
  }
  
  str = str.replace(emDashCorrupted, '\u2014');
  str = str.replace(emDashCorrupted2, '\u2013');

  // Fix any remaining U+00E2 followed by U+20xx (likely more corruption)
  // This catches: â€œ, â€", ™, â€˜, â€¦, etc.
  str = str.replace(/\u00E2\u20AC\u2018/g, '\u2018');  // left single quote
  str = str.replace(/\u00E2\u20AC\u2019/g, '\u2019');  // right single quote
  str = str.replace(/\u00E2\u20AC\u201A/g, '\u201A');  // single low-9 quote
  str = str.replace(/\u00E2\u20AC\u201E/g, '\u201E');  // double low-9 quote
  str = str.replace(/\u00E2\u20AC\u2026/g, '\u2026');  // ellipsis
  str = str.replace(/\u00E2\u20AC\u2020/g, '\u2020');  // dagger
  str = str.replace(/\u00E2\u20AC\u2021/g, '\u2021');  // double dagger
  str = str.replace(/\u00E2\u20AC\u2022/g, '\u2022');  // bullet
  str = str.replace(/\u00E2\u20AC\u2030/g, '\u2030');  // per mille
  str = str.replace(/\u00E2\u20AC\u2039/g, '\u2039');  // single left angle quote
  str = str.replace(/\u00E2\u20AC\u203A/g, '\u203A');  // single right angle quote
  str = str.replace(/\u00E2\u20AC\u2122/g, '\u2122');  // trademark
  str = str.replace(/\u00E2\u20AC\u2190/g, '\u2190');  // left arrow
  str = str.replace(/\u00E2\u20AC\u2192/g, '\u2192');  // right arrow
  str = str.replace(/\u00E2\u20AC\u2191/g, '\u2191');  // up arrow
  str = str.replace(/\u00E2\u20AC\u2193/g, '\u2193');  // down arrow

  // Also fix U+00C3 U+00A9 type corruption (â followed by various)
  // These are less common but still present
  
  if (str !== buf.toString('utf8')) {
    fs.writeFileSync(filePath, str, 'utf8');
    totalFiles++;
    totalChanges += changes;
    console.log(`  ${path.relative(ROOT, filePath)} (${changes} em-dash fixes)`);
  }
}

console.log('Fixing double-encoded UTF-8 at byte level...\n');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.claude', 'quest-board-deploy'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.js')) {
      fixFile(full);
    }
  }
}

walk(ROOT);
console.log(`\nDone. ${totalChanges} em-dash replacements across ${totalFiles} files.`);
