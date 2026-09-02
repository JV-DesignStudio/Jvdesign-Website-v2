/**
 * fix-encoding.js
 * Fixes double-encoded UTF-8 characters across all HTML files.
 * These were caused by writing UTF-8 content as Latin-1/Windows-1252.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Double-encoded character replacements (UTF-8 bytes interpreted as Latin-1)
const FIXES = [
  // Em dash, en dash, quotes
  ['—', '\u2014'],   // em dash
  ['—', '\u2013'],   // en dash (some variants)
  ['‘', '\u2018'],   // left single quote
  ['’', '\u2019'],   // right single quote
  ['“', '\u201C'],   // left double quote
  ['â€\u009D', '\u201D'], // right double quote
  ['…', '\u2026'],   // ellipsis

  // Common symbols
  ['·', '\u00B7'],    // middle dot
  ['©', '\u00A9'],    // copyright
  ['»', '\u00BB'],    // right guillemet
  ['«', '\u00AB'],    // left guillemet
  ['§', '\u00A7'],    // section sign
  ['¬', '\u00AC'],    // not sign
  ['±', '\u00B1'],    // plus-minus
  ['µ', '\u00B5'],    // micro sign
  ['¶', '\u00B6'],    // pilcrow
  ['­', '\u00AD'],    // soft hyphen
  ['®', '\u00AE'],    // registered
  ['°', '\u00B0'],    // degree
  ['²', '\u00B2'],    // superscript 2
  ['³', '\u00B3'],    // superscript 3
  ['¼', '\u00BC'],    // fraction 1/4
  ['½', '\u00BD'],    // fraction 1/2
  ['¾', '\u00BE'],    // fraction 3/4

  // Arrows
  ['â†\'', '\u2190'],   // left arrow
  ['â†\u2018', '\u2192'],   // right arrow (variant)

  // Emoji double-encoding (ðŸ = 0xF0 0x9F in UTF-8 read as Latin-1)
  // These are the most common emoji mojibake patterns
  ['🥈', '\uD83E\uDD48'],  // orangutan (used in biscuit tin)
  ['🎀', '\uD83C\uDF80'],  // confetti ball
  ['ðŸ\x9F\x8E\x80', '\uD83C\uDF80'],  // confetti ball (byte variant)
  ['🌸', '\uD83C\uDF38'],  // cherry blossom
  ['ðŸ\x9F\x8C\xB8', '\uD83C\uDF38'],  // cherry blossom (byte variant)
  ['ðŸ\x9F\x8E\x89', '\uD83C\uDF89'],  // party popper
  ['ðŸ\x9F\x8E\x8A', '\uD83C\uDF8A'],  // wind chime
  ['ðŸ\x9F\x8F\x86', '\uD83C\uDFC6'],  // trophy
  ['ðŸ\x9F\x8C\x9F', '\uD83C\uDF1F'],  // glow star
  ['ðŸ\x9F\x91\x8C', '\uD83D\uDC4C'],  // ok hand
  ['ðŸ\x9F\x91\x8D', '\uD83D\uDC4D'],  // thumbs up
  ['ðŸ\x9F\x98\x80', '\uD83D\uDE00'],  // grinning face
  ['ðŸ\x9F\x98\x82', '\uD83D\uDE02'],  // face with tears of joy
  ['ðŸ\x9F\x98\x8D', '\uD83D\uDE0D'],  // heart eyes
  ['ðŸ\x9F\x98\xA2', '\uD83D\uDE22'],  // crying face
  ['ðŸ\x9F\x98\xAD', '\uD83D\uDE2D'],  // loudly crying face
  ['ðŸ\x9F\x98\xB1', '\uD83D\uDE31'],  // fearful face
  ['ðŸ\x9F\x98\xB3', '\uD83D\uDE33'],  // astonished face
  ['ðŸ\x9F\x98\xB6', '\uD83D\uDE36'],  // cold face
  ['ðŸ\x9F\x98\xBF', '\uD83D\uDE3F'],  // pleading face
  ['ðŸ\x9F\x99\x82', '\uD83D\uDE42'],  // upside-down face
  ['ðŸ\x9F\x9A\x80', '\uD83E\uDE00'],  // various emoji
  ['ðŸ\x9F\x92\xA0', '\uD83D\uDC9C'],  // heart
  ['ðŸ\x9F\x92\xA1', '\uD83D\uDCA1'],  // lightbulb
  ['ðŸ\x9F\x92\xA9', '\uD83D\uDCA9'],  // pile of poo
  ['ðŸ\x9F\x92\xB0', '\uD83E\uDE99'],  // coins
  ['ðŸ\x9F\x92\xB2', '\uD83D\uDCB2'],  // money with wings
  ['ðŸ\x9F\x92\xB3', '\uD83D\uDCB3'],  // credit card
  ['ðŸ\x9F\x92\xB5', '\uD83E\uDDF0'],  // drop
  ['ðŸ\x9F\x92\xB7', '\uD83D\uDCB7'],  // gem
  ['ðŸ\x9F\x92\xB8', '\uD83D\uDCB8'],  // dollar
  ['ðŸ\x9F\x92\xB9', '\uD83D\uDCB9'],  // yen
  ['ðŸ\x9F\x92\xBA', '\uD83E\uDE9A'],  // abacus
  ['ðŸ\x9F\x92\xBB', '\uD83D\uDCBB'],  // keyboard
  ['ðŸ\x9F\x92\xBC', '\uD83D\uDCBC'],  // clipboard
  ['ðŸ\x9F\x92\xBD', '\uD83D\uDCCD'],  // round pushpin
  ['ðŸ\x9F\x92\xBE', '\uD83E\uDDF1'],  // droplet
  ['ðŸ\x9F\x92\xBF', '\uD83D\uDCC0'],  // orange book
  ['ðŸ\x9F\x93\x80', '\uD83D\uDCC1'],  // book
  ['ðŸ\x9F\x93\x81', '\uD83D\uDCC2'],  // bookmark
  ['ðŸ\x9F\x93\x82', '\uD83D\uDCC3'],  // books
  ['ðŸ\x9F\x93\x83', '\uD83E\uDDF2'],  // notebook
  ['ðŸ\x9F\x93\x84', '\uD83D\uDCC4'],  // link
  ['ðŸ\x9F\x93\x85', '\uD83D\uDCC5'],  // calendar
  ['ðŸ\x9F\x93\x86', '\uD83D\uDCC6'],  // card index
  ['ðŸ\x9F\x93\x87', '\uD83D\uDCC7'],  // chart
  ['ðŸ\x9F\x93\x88', '\uD83D\uDCC8'],  // chart with upward trend
  ['ðŸ\x9F\x93\x89', '\uD83D\uDCC9'],  // chart with downward trend
  ['ðŸ\x9F\x93\x8A', '\uD83D\uDCCA'],  // bar chart
  ['ðŸ\x9F\x93\x8B', '\uD83D\uDCCB'],  // clipboard
  ['ðŸ\x9F\x93\x8C', '\uD83D\uDCCC'],  // pin
  ['ðŸ\x9F\x93\x8D', '\uD83D\uDCCD'],  // round pin
  ['ðŸ\x9F\x93\x8E', '\uD83D\uDCCE'],  // paperclip
  ['ðŸ\x9F\x93\x8F', '\uD83D\uDCCF'],  // straight ruler
  ['ðŸ\x9F\x93\x90', '\uD83D\uDCD0'],  // triangular ruler
  ['ðŸ\x9F\x93\x91', '\uD83D\uDCD1'],  // bookmark tabs
  ['ðŸ\x9F\x93\x92', '\uD83D\uDCD2'],  // notebook with decorative cover
  ['ðŸ\x9F\x93\x93', '\uD83D\uDCD3'],  // closed notebook
  ['ðŸ\x9F\x93\x94', '\uD83D\uDCD4'],  // open book
  ['ðŸ\x9F\x93\x95', '\uD83D\uDCD5'],  // open book with face
  ['ðŸ\x9F\x93\x96', '\uD83D\uDCD6'],  // book with light cover
  ['ðŸ\x9F\x93\x97', '\uD83D\uDCD7'],  // green book
  ['ðŸ\x9F\x93\x98', '\uD83D\uDCD8'],  // blue book
  ['ðŸ\x9F\x93\x99', '\uD83D\uDCD9'],  // orange book
  ['ðŸ\x9F\x93\x9A', '\uD83D\uDCDA'],  // notebook
  ['ðŸ\x9F\x93\x9B', '\uD83D\uDCDB'],  // books
  ['ðŸ\x9F\x93\x9C', '\uD83D\uDCDC'],  // ledger
  ['ðŸ\x9F\x93\x9D', '\uD83D\uDCDD'],  // open notebook
  ['ðŸ\x9F\x93\x9E', '\uD83D\uDCDE'],  // scrolled page
  ['ðŸ\x9F\x93\x9F', '\uD83D\uDCDF'],  // calendar
];

let totalFiles = 0;
let totalChanges = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.claude', 'quest-board-deploy'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;

  for (const [bad, good] of FIXES) {
    if (content.includes(bad)) {
      const count = content.split(bad).length - 1;
      content = content.split(bad).join(good);
      changes += count;
    }
  }

  if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    totalChanges += changes;
    console.log(`  ${path.relative(ROOT, filePath)} (${changes} fixes)`);
  }
}

console.log('Fixing double-encoded UTF-8 characters...\n');
walk(ROOT);
console.log(`\nDone. ${totalChanges} replacements across ${totalFiles} files.`);
