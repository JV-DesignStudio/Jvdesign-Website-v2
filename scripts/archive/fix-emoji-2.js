const fs = require('fs');

function countOccurrences(str, substr) {
  let count = 0, pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) { count++; pos += substr.length; }
  return count;
}

let content = fs.readFileSync('workshops/tiny-learners.html', 'utf8');
const before = countOccurrences(content, '??');

// Fix parent card icons - use line context
const parentIconReplacements = [
  // Number & Counting - line 522
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Number', '<div class="parent-card-icon">🔢</div>\n        <div class="parent-card-title">Number'],
  // Phonics
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Phonics', '<div class="parent-card-icon">🔤</div>\n        <div class="parent-card-title">Phonics'],
  // Shapes
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Shapes', '<div class="parent-card-icon">🔷</div>\n        <div class="parent-card-title">Shapes'],
  // Size
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Size', '<div class="parent-card-icon">📏</div>\n        <div class="parent-card-title">Size'],
  // Patterns
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Patterns', '<div class="parent-card-icon">🔁</div>\n        <div class="parent-card-title">Patterns'],
  // Creative
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Creative', '<div class="parent-card-icon">🎨</div>\n        <div class="parent-card-title">Creative'],
  // Sorting
  ['<div class="parent-card-icon">???</div>\n        <div class="parent-card-title">Sorting', '<div class="parent-card-icon">🧩</div>\n        <div class="parent-card-title">Sorting'],
  // Rhyme
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Rhyme', '<div class="parent-card-icon">🎵</div>\n        <div class="parent-card-title">Rhyme'],
];

// Fix seasonal emojis
const seasonalReplacements = [
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Halloween</div>', '<div class="seasonal-emoji">🎃</div>\n        <div class="seasonal-name">Halloween</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Winter Wonderland</div>', '<div class="seasonal-emoji">❄️</div>\n        <div class="seasonal-name">Winter Wonderland</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Spring</div>', '<div class="seasonal-emoji">🌸</div>\n        <div class="seasonal-name">Spring</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Summer</div>', '<div class="seasonal-emoji">☀️</div>\n        <div class="seasonal-name">Summer</div>'],
];

// Coming soon cards
const comingReplacements = [
  ['<div class="coming-emoji">???</div><div class="coming-name">Hot or Cold?</div>', '<div class="coming-emoji">🌡️</div><div class="coming-name">Hot or Cold?</div>'],
  ['<div class="coming-emoji">???</div><div class="coming-name">Left &amp; Right</div>', '<div class="coming-emoji">↔️</div><div class="coming-name">Left &amp; Right</div>'],
  ['<div class="coming-emoji">??</div><div class="coming-name">Animals &amp; Habitats</div>', '<div class="coming-emoji">🌍</div><div class="coming-name">Animals &amp; Habitats</div>'],
];

// Activity body emoji
const actReplacements = [
  ["{ id:'body',     emoji:'??', char:'Stardust'", "{ id:'body',     emoji:'🦴', char:'Stardust'"],
];

// Show feedback streak
content = content.replace(
  /msg\+' \?\? '+streak\+' in a row!'/g,
  "msg+' 🔥 '+streak+' in a row!'"
);

// Count done message
content = content.replace(
  "Keep practising and you'll be counting to 100 in no time! ??",
  "Keep practising and you'll be counting to 100 in no time! 🌟"
);

// Shape answer
content = content.replace(
  "`? Yes, that's a ${S.cur.name}! ??`",
  "`✅ Yes, that's a ${S.cur.name}! 🎨`"
);

// Phonics wrong arrays - replace remaining ?? in wrong arrays
const phonicsWrongReplacements = [
  ["{w:'Cat',e:'??'},{w:'Dog',e:'??'},{w:'Egg',e:'⭐'}]", "{w:'Cat',e:'🐱'},{w:'Dog',e:'🐕'},{w:'Egg',e:'🥚'}]"],
  ["{w:'Dog',e:'??'},{w:'Fish',e:'??'},{w:'Egg',e:'⭐'}]", "{w:'Dog',e:'🐕'},{w:'Fish',e:'🐟'},{w:'Egg',e:'🥚'}]"],
  ["{w:'Apple',e:'🍎'},{w:'Cat',e:'??'},{w:'Fish',e:'⭐'}]", "{w:'Apple',e:'🍎'},{w:'Cat',e:'🐱'},{w:'Fish',e:'🐟'}]"],
  ["{w:'Cat',e:'??'},{w:'Dog',e:'??'},{w:'Egg',e:'⭐'}]", "{w:'Cat',e:'🐱'},{w:'Dog',e:'🐕'},{w:'Egg',e:'🥚'}]"],
  ["{w:'Apple',e:'🍎'},{w:'Ball',e:'?'},{w:'Car',e:'⭐'}]", "{w:'Apple',e:'🍎'},{w:'Ball',e:'⚽'},{w:'Car',e:'🚗'}]"],
  ["{w:'Apple',e:'🍎'},{w:'Cat',e:'??'},{w:'Fish',e:'⭐'}]", "{w:'Apple',e:'🍎'},{w:'Cat',e:'🐱'},{w:'Fish',e:'🐟'}]"],
];

// Size question
content = content.replace(
  "`Tap the ${askBig?'BIGGER':'SMALLER'} one! ??`",
  "`Tap the ${askBig?'BIGGER':'SMALLER'} one! 📏`"
);

// Rhymes main word emojis
const rhymeMainReplacements = [
  ["{word:'CAT',emoji:'??',rhymes:", "{word:'CAT',emoji:'🐱',rhymes:"],
  ["{word:'BEE',emoji:'??',rhymes:", "{word:'BEE',emoji:'🐝',rhymes:"],
  ["{word:'CAKE',emoji:'??',rhymes:", "{word:'CAKE',emoji:'🎂',rhymes:"],
  ["{word:'DOG',emoji:'??',rhymes:", "{word:'DOG',emoji:'🐕',rhymes:"],
  ["{word:'MOON',emoji:'??',rhymes:", "{word:'MOON',emoji:'🌙',rhymes:"],
  ["{word:'BEAR',emoji:'??',rhymes:", "{word:'BEAR',emoji:'🐻',rhymes:"],
  ["{word:'HOP',emoji:'??',rhymes:", "{word:'HOP',emoji:'🦘',rhymes:"],
  ["{word:'BUG',emoji:'??',rhymes:", "{word:'BUG',emoji:'🐛',rhymes:"],
  ["{word:'PIG',emoji:'??',rhymes:", "{word:'PIG',emoji:'🐷',rhymes:"],
  ["{word:'FOX',emoji:'??',rhymes:", "{word:'FOX',emoji:'🦊',rhymes:"],
  ["{word:'SHEEP',emoji:'??',rhymes:", "{word:'SHEEP',emoji:'🐑',rhymes:"],
  ["{word:'KING',emoji:'??',rhymes:", "{word:'KING',emoji:'👑',rhymes:"],
  ["{word:'SNAIL',emoji:'??',rhymes:", "{word:'SNAIL',emoji:'🐌',rhymes:"],
];

// Rhyme sub text
content = content.replace(
  'Find something that rhymes with this word ??',
  'Find something that rhymes with this word 🎵'
);

// Rhyme answer feedback
content = content.replace(
  /`\? \$\{S\.cur\.word\} and \$\{S\.correct\.w\}, they rhyme! \?\?`/g,
  "`✅ ${S.cur.word} and ${S.correct.w}, they rhyme! 🎵`"
);

// Sequence feedback
content = content.replace(
  /`\? \$\{S\.story\.title\} in the right order! \?\?`/g,
  "`✅ ${S.story.title} in the right order! 🌟`"
);

// Weather done message  
content = content.replace(
  "Looking outside and noticing if it\\'s sunny, rainy or snowy is called <b>observation</b>, the very first step scientists use! Knowing the weather also helps you choose what to wear, like a coat or sunglasses. Pip &amp; Echo say: look outside today! ???",
  "Looking outside and noticing if it\\'s sunny, rainy or snowy is called <b>observation</b>, the very first step scientists use! Knowing the weather also helps you choose what to wear, like a coat or sunglasses. Pip &amp; Echo say: look outside today! 🌦️"
);

// Apply all replacement arrays
const allReplacements = [
  ...parentIconReplacements,
  ...seasonalReplacements,
  ...comingReplacements,
  ...actReplacements,
  ...phonicsWrongReplacements,
  ...rhymeMainReplacements,
];

let totalFixes = 0;
for (const [old, rep] of allReplacements) {
  const cnt = countOccurrences(content, old);
  if (cnt > 0) {
    content = content.split(old).join(rep);
    totalFixes += cnt;
  }
}

const after = countOccurrences(content, '??');
fs.writeFileSync('workshops/tiny-learners.html', content, 'utf8');
console.log(`Phase 2: fixed ${totalFixes} more instances, remaining ?? : ${after}`);
