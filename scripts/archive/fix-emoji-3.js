const fs = require('fs');

function countOccurrences(str, substr) {
  let count = 0, pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) { count++; pos += substr.length; }
  return count;
}

let content = fs.readFileSync('workshops/tiny-learners.html', 'utf8');
const before = countOccurrences(content, '??');

// Parent card icons - use & not &amp; (the actual file content)
const parentReplacements = [
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Number & Counting</div>', '<div class="parent-card-icon">🔢</div>\n        <div class="parent-card-title">Number & Counting</div>'],
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Phonics & Letters</div>', '<div class="parent-card-icon">🔤</div>\n        <div class="parent-card-title">Phonics & Letters</div>'],
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Shapes & Colours</div>', '<div class="parent-card-icon">🔷</div>\n        <div class="parent-card-title">Shapes & Colours</div>'],
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Size & Comparison</div>', '<div class="parent-card-icon">📏</div>\n        <div class="parent-card-title">Size & Comparison</div>'],
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Patterns & Sequences</div>', '<div class="parent-card-icon">🔁</div>\n        <div class="parent-card-title">Patterns & Sequences</div>'],
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Creative Expression</div>', '<div class="parent-card-icon">🎨</div>\n        <div class="parent-card-title">Creative Expression</div>'],
  ['<div class="parent-card-icon">???</div>\n        <div class="parent-card-title">Sorting & Categories</div>', '<div class="parent-card-icon">🧩</div>\n        <div class="parent-card-title">Sorting & Categories</div>'],
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Rhyme & Language</div>', '<div class="parent-card-icon">🎵</div>\n        <div class="parent-card-title">Rhyme & Language</div>'],
];

// Seasonal emojis
const seasonalReplacements = [
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Halloween</div>', '<div class="seasonal-emoji">🎃</div>\n        <div class="seasonal-name">Halloween</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Winter Wonderland</div>', '<div class="seasonal-emoji">❄️</div>\n        <div class="seasonal-name">Winter Wonderland</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Spring</div>', '<div class="seasonal-emoji">🌸</div>\n        <div class="seasonal-name">Spring</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Summer</div>', '<div class="seasonal-emoji">☀️</div>\n        <div class="seasonal-name">Summer</div>'],
];

// Coming soon cards - use & not &amp;
const comingReplacements = [
  ['<div class="coming-emoji">???</div><div class="coming-name">Left & Right</div>', '<div class="coming-emoji">↔️</div><div class="coming-name">Left & Right</div>'],
  ['<div class="coming-emoji">??</div><div class="coming-name">Animals & Habitats</div>', '<div class="coming-emoji">🌍</div><div class="coming-name">Animals & Habitats</div>'],
];

// showFb streak - replace ?? in the function
content = content.replace(
  "msg+' ?? '+streak+' in a row!'",
  "msg+' 🔥 '+streak+' in a row!'"
);

// Count done message
content = content.replace(
  "in no time! ??');",
  "in no time! 🌟');"
);

// Phonics wrong lines
content = content.replace(
  "{letter:'A',sound:'Ah',words:[{w:'Apple',e:'🍎'},{w:'Ant',e:'🐜'},{w:'Arrow',e:'🏹'}],wrong:[{w:'Ball',e:'?'},{w:'Cat',e:'??'},{w:'Dog',e:'⭐'}]}",
  "{letter:'A',sound:'Ah',words:[{w:'Apple',e:'🍎'},{w:'Ant',e:'🐜'},{w:'Arrow',e:'🏹'}],wrong:[{w:'Ball',e:'⚽'},{w:'Cat',e:'🐱'},{w:'Dog',e:'🐕'}]}"
);
content = content.replace(
  "{letter:'H',sound:'Huh',words:[{w:'Hat',e:'🎩'},{w:'Horse',e:'🐴'},{w:'House',e:'🏠'},{w:'Heart',e:'❤️'}],wrong:[{w:'Apple',e:'🍎'},{w:'Dog',e:'??'},{w:'Egg',e:'⭐'}]}",
  "{letter:'H',sound:'Huh',words:[{w:'Hat',e:'🎩'},{w:'Horse',e:'🐴'},{w:'House',e:'🏠'},{w:'Heart',e:'❤️'}],wrong:[{w:'Apple',e:'🍎'},{w:'Dog',e:'🐕'},{w:'Egg',e:'🥚'}]}"
);

// Weather done message
content = content.replace(
  "look outside today! ???');",
  "look outside today! 🌦️');"
);

// Apply all arrays
const allReplacements = [...parentReplacements, ...seasonalReplacements, ...comingReplacements];

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
console.log(`Phase 3: fixed ${totalFixes} more instances, remaining ?? : ${after}`);

// Show remaining
const lines = content.split('\n');
lines.forEach((l, n) => {
  if (l.includes('??')) {
    console.log(`L${n+1}: ${l.substring(0, 140)}`);
  }
});
