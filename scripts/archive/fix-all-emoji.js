const fs = require('fs');
const path = require('path');

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  const beforeCount = (content.match(/\?\?/g) || []).length;
  let total = 0;
  for (const [old, rep] of replacements) {
    const cnt = (content.split(old).length - 1);
    if (cnt > 0) {
      content = content.split(old).join(rep);
      total += cnt;
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  const remaining = (content.match(/\?\?/g) || []).length;
  console.log(`${path.basename(filePath)}: ${beforeCount} -> ${remaining} remaining ??`);
  return total;
}

let grandTotal = 0;

// ============ FILE 2: learning-lab.html ============
// Need to read it first to understand patterns - skip for now, will create dedicated script

// ============ FILES 3-10: Common patterns ============
// These files share similar workshop patterns

// Common workshop patterns across all files
const commonPatterns = [
  // callout icons
  ['<span class="callout-icon">??????⭐</span>', '<span class="callout-icon">👨‍👩‍👧⭐</span>'],
  ['<span class="callout-icon">??????</span>', '<span class="callout-icon">👨‍👩‍👧</span>'],
  // try-it headers
  ['??? Try it!</div>', '🔬 Try it!</div>'],
  // step emoji
  ['<div class="step-emoji">???</div>', '<div class="step-emoji">📝</div>'],
  ['<div class="step-emoji">??</div>', '<div class="step-emoji">📝</div>'],
  // confetti rows
  ['<div class="confetti-row">??????????</div>', '<div class="confetti-row">🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉</div>'],
  ['<div class="confetti-row">?????????</div>', '<div class="confetti-row">🎉🎉🎉🎉🎉🎉🎉🎉🎉</div>'],
  // print buttons
  ['??? Print Guide', '🖨️ Print Guide'],
  ['??? Print Report Card', '🖨️ Print Report Card'],
  // nav buttons
  ['>?? Run My Game!</button>', '>▶️ Run My Game!</button>'],
  ['>?? Done!</button>', '>✅ Done!</button>'],
  // quiz icons
  ["(passed?'?':'??')", "(passed?'✅':'❓')"],
  ["(passed?'?':'???')", "(passed?'✅':'❓')"],
  // hero badges with Episode
  ['??? Part 1', '🏎️ Part 1'],
  ['??? Ep 6', '🎮 Ep 6'],
  ['??? Ep 5', '🎮 Ep 5'],
  // step nums
  ['<div class="step-num sn-teal">??</div>', '<div class="step-num sn-teal">📝</div>'],
  // oc-icons
  ['<div class="oc-icon">??</div>', '<div class="oc-icon">💡</div>'],
  // pc-icons
  ['<div class="pc-icon">??</div>', '<div class="pc-icon">💡</div>'],
  // code area hints
  ['?? Click for a hint', '💡 Click for a hint'],
  // level up
  ['<div class="lvl-icon">??</div>', '<div class="lvl-icon">🎉</div>'],
];

// Process godot-racing-workshop.html
grandTotal += fixFile('workshops/godot-racing-workshop.html', [
  ...commonPatterns,
  // Part badges
  ['??? Part 1', '🏎️ Part 1'],
  ['?? Part 2', '🏎️ Part 2'],
  ['?? Ep 2', '🎮 Ep 2'],
  ['?? Ep 3', '🎮 Ep 3'],
  ['?? Ep 4', '🎮 Ep 4'],
  ['?? Ep 5', '🎮 Ep 5'],
  ['??? Ep 6', '🎮 Ep 6'],
  // Hero section
  ['?? Godot Workshop', '🎮 Godot Workshop'],
  ['Zoom Zoom! ??<br>', 'Zoom Zoom! 🏎️<br>'],
  ["No coding experience needed. Every step is explained simply. ??", "No coding experience needed. Every step is explained simply. 🎯"],
  ['?? Age 5+', '👶 Age 5+'],
  ['?? About 1 hour', '⏱️ About 1 hour'],
  ['?? Godot 4', '🎮 Godot 4'],
  ["?? Let's Go!", "🏁 Let's Go!"],
  ['?? What is Godot?', '❓ What is Godot?'],
  // Progress
  ['?? Workshop Progress', '📊 Workshop Progress'],
  // Little coder messages
  ["it gets tricky! ??", "it gets tricky! 🏎️"],
  ['Choose your car colour! ??', 'Choose your car colour! 🎨'],
  ["It's like talking to your game! ????",
   "It's like talking to your game! 💻"],
  ['Press Play! ??', 'Press Play! ▶️'],
  ["?? IT MOVES!", "🎉 IT MOVES!"],
  ["You are officially a Game Developer! High five! ?", "You are officially a Game Developer! High five! 🎉"],
  ["we can see where it's going! ??", "we can see where it's going! 📹"],
  ["you can time yourself doing laps! ??", "you can time yourself doing laps! ⏱️"],
  ["it's an invisible detector! ??", "it's an invisible detector! 🔍"],
  // Customise section
  ['?? Things to customise', '🎨 Things to customise'],
  ['??? Car changes', '🚗 Car changes'],
  ['??? Track changes', '🏁 Track changes'],
  // Finish
  ['??????????', '🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉'],
  ["You finished Episode 1! ??", "You finished Episode 1! 🎉"],
  // Oc icons
  ['<div class="oc-icon">??</div>', '<div class="oc-icon">💡</div>'],
  // node diagrams
  ['<span class="node">?? <span', '<span class="node">🚗 <span'],
  // code blanks
  ["placeholder='????????????????' size='18'>", "placeholder='func name...' size='18'>"],
  ["placeholder='????????????' size='14'>", "placeholder='code here...' size='14'>"],
  // car colour
  ['<div class="cf-sentence">In GDScript, <input', '<div class="cf-sentence">In GDScript, <input'],
  // Amazing work
  ["You've given them a superpower! ??", "You've given them a superpower! 🎉"],
]);

// Process pixel-quest-workshop.html
grandTotal += fixFile('workshops/pixel-quest-workshop.html', [
  ...commonPatterns,
  // These will need file-specific patterns
]);

// Process roblox-creator-journey.html
grandTotal += fixFile('workshops/roblox-creator-journey.html', [
  ...commonPatterns,
]);

// Process unity-3d-platformer.html
grandTotal += fixFile('workshops/unity-3d-platformer.html', [
  ...commonPatterns,
]);

// Process rocket-builder.html
grandTotal += fixFile('workshops/rocket-builder.html', [
  ...commonPatterns,
]);

// Process jump-jump-mario-workshop.html
grandTotal += fixFile('workshops/jump-jump-mario-workshop.html', [
  ...commonPatterns,
]);

// Process nuclear-blueprint.html
grandTotal += fixFile('workshops/nuclear-blueprint.html', [
  ...commonPatterns,
]);

// Process mugen-workshop.html
grandTotal += fixFile('workshops/mugen-workshop.html', [
  ...commonPatterns,
]);

console.log(`\nGrand total fixes: ${grandTotal}`);
