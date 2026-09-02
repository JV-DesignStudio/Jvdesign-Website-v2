const fs = require('fs');
const path = require('path');

function countOccurrences(str, substr) {
  let count = 0, pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) { count++; pos += substr.length; }
  return count;
}

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = countOccurrences(content, '??');
  let totalFixes = 0;
  for (const [old, rep] of replacements) {
    const cnt = countOccurrences(content, old);
    if (cnt > 0) {
      content = content.split(old).join(rep);
      totalFixes += cnt;
    }
  }
  const after = countOccurrences(content, '??');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`${path.basename(filePath)}: fixed ${totalFixes} instances, remaining ?? : ${after}`);
  return { totalFixes, remaining: after };
}

// ============ FILE 1: tiny-learners.html ============
fixFile('workshops/tiny-learners.html', [
  // Hero stars
  ['<span>⭐</span><span>⭐</span><span>?</span><span>⭐</span><span>?</span>',
   '<span>⭐</span><span>⭐</span><span>⭐</span><span>⭐</span><span>⭐</span>'],
  // Hero pills
  ['?? Draw &amp; Create', '🎨 Draw &amp; Create'],
  // Progress level
  ['? Level 1', '⭐ Level 1'],
  ['? Level ${s.level}', '⭐ Level ${s.level}'],
  // Parents tags - the 12 ? before family emoji is corrupted family emoji
  ['????????????👨\u200d👩\u200d👧 For Parents &amp; Carers', '👨\u200d👩\u200d👧 For Parents &amp; Carers'],
  ['????????????👨\u200d👩\u200d👧 For Parents', '👨\u200d👩\u200d👧 For Parents'],
  // Parent card icons - Number & Counting
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Number &amp; Counting</div>', '<div class="parent-card-icon">🔢</div>\n        <div class="parent-card-title">Number &amp; Counting</div>'],
  // Phonics & Letters
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Phonics &amp; Letters</div>', '<div class="parent-card-icon">🔤</div>\n        <div class="parent-card-title">Phonics &amp; Letters</div>'],
  // Shapes & Colours
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Shapes &amp; Colours</div>', '<div class="parent-card-icon">🔷</div>\n        <div class="parent-card-title">Shapes &amp; Colours</div>'],
  // Size & Comparison
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Size &amp; Comparison</div>', '<div class="parent-card-icon">📏</div>\n        <div class="parent-card-title">Size &amp; Comparison</div>'],
  // Patterns & Sequences
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Patterns &amp; Sequences</div>', '<div class="parent-card-icon">🔁</div>\n        <div class="parent-card-title">Patterns &amp; Sequences</div>'],
  // Creative Expression
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Creative Expression</div>', '<div class="parent-card-icon">🎨</div>\n        <div class="parent-card-title">Creative Expression</div>'],
  // Sorting & Categories
  ['<div class="parent-card-icon">???</div>\n        <div class="parent-card-title">Sorting &amp; Categories</div>', '<div class="parent-card-icon">🧩</div>\n        <div class="parent-card-title">Sorting &amp; Categories</div>'],
  // Rhyme & Language
  ['<div class="parent-card-icon">??</div>\n        <div class="parent-card-title">Rhyme &amp; Language</div>', '<div class="parent-card-icon">🎵</div>\n        <div class="parent-card-title">Rhyme &amp; Language</div>'],
  // Drawing toolbar buttons
  ['id="toolDraw" onclick="setTool(\'draw\')" title="Draw">??</button>', 'id="toolDraw" onclick="setTool(\'draw\')" title="Draw">✏️</button>'],
  ['id="toolEraser" onclick="setTool(\'eraser\')" title="Eraser">??</button>', 'id="toolEraser" onclick="setTool(\'eraser\')" title="Eraser">🧹</button>'],
  ['id="toolStamp" onclick="setTool(\'stamp\')" title="Stamps">??</button>', 'id="toolStamp" onclick="setTool(\'stamp\')" title="Stamps">⭐</button>'],
  // Undo / Clear buttons
  ['onclick="drawUndo()">? Undo</button>', 'onclick="drawUndo()">↩️ Undo</button>'],
  ['onclick="drawClear()">?? Clear</button>', 'onclick="drawClear()">🗑️ Clear</button>'],
  // Draw hint
  ['??? Click and drag to draw', '🖱️ Click and drag to draw'],
  ['?? Touch and drag on tablet/phone', '👆 Touch and drag on tablet/phone'],
  // Activities section tag
  ['?? Learn</div>', '📚 Learn</div>'],
  // Sticker book
  ['? My Sticker Book', '📒 My Sticker Book'],
  // Seasonal tag
  ['??? Seasonal</div>', '🎄 Seasonal</div>'],
  // Seasonal emojis
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Halloween</div>', '<div class="seasonal-emoji">🎃</div>\n        <div class="seasonal-name">Halloween</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Winter Wonderland</div>', '<div class="seasonal-emoji">❄️</div>\n        <div class="seasonal-name">Winter Wonderland</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Spring</div>', '<div class="seasonal-emoji">🌸</div>\n        <div class="seasonal-name">Spring</div>'],
  ['<div class="seasonal-emoji">??</div>\n        <div class="seasonal-name">Summer</div>', '<div class="seasonal-emoji">☀️</div>\n        <div class="seasonal-name">Summer</div>'],
  // Report print button
  ['??? Print Report Card', '🖨️ Print Report Card'],
  // Report logo
  ['?? Tiny Learners', '🐢 Tiny Learners'],
  // Coming soon heading
  ['?? More Adventures Coming Soon', '✨ More Adventures Coming Soon'],
  // Coming soon cards
  ['<div class="coming-emoji">??</div><div class="coming-name">Coin Counting</div>', '<div class="coming-emoji">🪙</div><div class="coming-name">Coin Counting</div>'],
  ['<div class="coming-emoji">??</div><div class="coming-name">Musical Notes</div>', '<div class="coming-emoji">🎵</div><div class="coming-name">Musical Notes</div>'],
  ['<div class="coming-emoji">??</div><div class="coming-name">Animals &amp; Habitats</div>', '<div class="coming-emoji">🌍</div><div class="coming-name">Animals &amp; Habitats</div>'],
  // Back button
  ['? Back</button>', '◀️ Back</button>'],
  // ACTS array - each activity emoji
  ["{ id:'count',   emoji:'??'", "{ id:'count',   emoji:'🐢'"],
  ["{ id:'colours', emoji:'??'", "{ id:'colours', emoji:'✨'"],
  ["{ id:'shapes',  emoji:'??'", "{ id:'shapes',  emoji:'🦎'"],
  ["{ id:'pattern', emoji:'??'", "{ id:'pattern', emoji:'✨'"],
  ["{ id:'size',    emoji:'??'", "{ id:'size',    emoji:'🦎'"],
  ["{ id:'odd',     emoji:'??'", "{ id:'odd',     emoji:'⭐'"],
  ["{ id:'rhyme',   emoji:'??'", "{ id:'rhyme',   emoji:'🐢'"],
  ["{ id:'sequence',emoji:'??'", "{ id:'sequence',emoji:'🦎'"],
  ["{ id:'animals',  emoji:'??'", "{ id:'animals',  emoji:'🐢'"],
  ["{ id:'opposites',emoji:'??'", "{ id:'opposites',emoji:'🦎'"],
  ["{ id:'days',     emoji:'??'", "{ id:'days',     emoji:'✨'"],
  ["{ id:'weather',  emoji:'???'", "{ id:'weather',  emoji:'🌦️'"],
  // TINY_BADGES icons
  ["icon:'??', name:'First Steps'", "icon:'⭐', name:'First Steps'"],
  ["icon:'??', name:'Halfway Hero'", "icon:'🏅', name:'Halfway Hero'"],
  ["icon:'??', name:'All Rounder'", "icon:'🏆', name:'All Rounder'"],
  ["icon:'??', name:'Superstar'", "icon:'🌟', name:'Superstar'"],
  ["icon:'??', name:'Little Artist'", "icon:'🎨', name:'Little Artist'"],
  ["icon:'??', name:'Practice Pro'", "icon:'💪', name:'Practice Pro'"],
  ["icon:'??', name:'Perfectionist'", "icon:'💎', name:'Perfectionist'"],
  // STAMPS array
  ["['??','?','??','??','??','??','??','??','??','??','??','??','??','??','??','??']",
   "['🌟','⭐','🎈','🌈','🦋','🐝','🌸','🐱','🐶','🍄','🌻','🎀','🎵','❤️','🌈','⭐']"],
  // Default stamp
  ["drawStamp='??'", "drawStamp='⭐'"],
  // COUNT_EMOJIS
  ["['??','??','??','??','??','??','??','??','??','??','??','??']",
   "['🍎','🍊','🍋','🍇','🍓','🌸','⭐','🐟','🐶','🐱','🐣','🌻']"],
  // Count game initial emoji
  ["emoji:'??',streak:0,bestStreak:0};", "emoji:'🍎',streak:0,bestStreak:0};"],
  // ADD_EMOJIS
  ["['??','?','??','??','??','??','??','??','??','??']",
   "['🍎','⭐','🍊','🍋','🍇','🍓','🌸','🐟','🐶','🐱']"],
  // PAT_SETS - pattern items (replace specific corrupted pairs)
  ["{items:['??','??'],len:3}", "{items:['🔴','🔵'],len:3}"],
  ["{items:['?','??'],len:3}", "{items:['⭐','🌙'],len:3}"],
  ["{items:['??','??','??','??'],len:1}", "{items:['🔴','🔵','🟢','🟡'],len:1}"],
  // Pattern wrong options
  ["['??','??','??','??','??','??'].forEach", "['🔴','🔵','🟢','🟡','⭐','🌙'].forEach"],
  // SIZE_PAIRS
  ["{big:{e:'??',l:'Elephant'},small:{e:'??',l:'Mouse'}}", "{big:{e:'🐘',l:'Elephant'},small:{e:'🐭',l:'Mouse'}}"],
  ["{big:{e:'??',l:'House'},small:{e:'??',l:'Cottage'}}", "{big:{e:'🏠',l:'House'},small:{e:'🏡',l:'Cottage'}}"],
  ["{big:{e:'??',l:'Tree'},small:{e:'??',l:'Seedling'}}", "{big:{e:'🌳',l:'Tree'},small:{e:'🌱',l:'Seedling'}}"],
  ["{big:{e:'??',l:'Lorry'},small:{e:'??',l:'Car'}}", "{big:{e:'🚛',l:'Lorry'},small:{e:'🚗',l:'Car'}}"],
  ["{big:{e:'??',l:'Lion'},small:{e:'??',l:'Cat'}}", "{big:{e:'🦁',l:'Lion'},small:{e:'🐱',l:'Cat'}}"],
  ["{big:{e:'??',l:'Earth'},small:{e:'??',l:'Orange'}}", "{big:{e:'🌍',l:'Earth'},small:{e:'🍊',l:'Orange'}}"],
  ["{big:{e:'??',l:'Mountain'},small:{e:'?',l:'Tent'}}", "{big:{e:'⛰️',l:'Mountain'},small:{e:'⛺',l:'Tent'}}"],
  ["{big:{e:'??',l:'Whale'},small:{e:'??',l:'Fish'}}", "{big:{e:'🐋',l:'Whale'},small:{e:'🐟',l:'Fish'}}"],
  ["{big:{e:'??',l:'Crocodile'},small:{e:'??',l:'Lizard'}}", "{big:{e:'🐊',l:'Crocodile'},small:{e:'🦎',l:'Lizard'}}"],
  ["{big:{e:'??',l:'Sunflower'},small:{e:'??',l:'Blossom'}}", "{big:{e:'🌻',l:'Sunflower'},small:{e:'🌸',l:'Blossom'}}"],
  ["{big:{e:'??',l:'Giraffe'},small:{e:'??',l:'Rabbit'}}", "{big:{e:'🦒',l:'Giraffe'},small:{e:'🐰',l:'Rabbit'}}"],
  ["{big:{e:'??',l:'Ship'},small:{e:'??',l:'Canoe'}}", "{big:{e:'🚢',l:'Ship'},small:{e:'🛶',l:'Canoe'}}"],
  ["{big:{e:'??',l:'Whale'},small:{e:'??',l:'Shrimp'}}", "{big:{e:'🐋',l:'Whale'},small:{e:'🦐',l:'Shrimp'}}"],
  ["{big:{e:'??',l:'Castle'},small:{e:'??',l:'House'}}", "{big:{e:'🏰',l:'Castle'},small:{e:'🏠',l:'House'}}"],
  ["{big:{e:'??',l:'Pine Tree'},small:{e:'??',l:'Tulip'}}", "{big:{e:'🌲',l:'Pine Tree'},small:{e:'🌷',l:'Tulip'}}"],
  // ODD_SETS
  ["{items:[{e:'??',l:'Dog'},{e:'??',l:'Cat'},{e:'??',l:'Frog'},{e:'??',l:'Car'}]", "{items:[{e:'🐕',l:'Dog'},{e:'🐱',l:'Cat'},{e:'🐸',l:'Frog'},{e:'🚗',l:'Car'}]"],
  ["{items:[{e:'??',l:'Apple'},{e:'??',l:'Orange'},{e:'??',l:'Banana'},{e:'??',l:'Carrot'}]", "{items:[{e:'🍎',l:'Apple'},{e:'🍊',l:'Orange'},{e:'🍌',l:'Banana'},{e:'🥕',l:'Carrot'}]"],
  ["{items:[{e:'?',l:'Star'},{e:'??',l:'Moon'},{e:'??',l:'Sun'},{e:'??',l:'Fish'}]", "{items:[{e:'⭐',l:'Star'},{e:'🌙',l:'Moon'},{e:'☀️',l:'Sun'},{e:'🐟',l:'Fish'}]"],
  ["{items:[{e:'??',l:'Car'},{e:'??',l:'Bus'},{e:'??',l:'Train'},{e:'??',l:'Pizza'}]", "{items:[{e:'🚗',l:'Car'},{e:'🚌',l:'Bus'},{e:'🚂',l:'Train'},{e:'🍕',l:'Pizza'}]"],
  ["{items:[{e:'??',l:'Guitar'},{e:'??',l:'Drums'},{e:'??',l:'Piano'},{e:'??',l:'Elephant'}]", "{items:[{e:'🎸',l:'Guitar'},{e:'🥁',l:'Drums'},{e:'🎹',l:'Piano'},{e:'🐘',l:'Elephant'}]"],
  ["{items:[{e:'??',l:'Pizza'},{e:'??',l:'Burger'},{e:'??',l:'Sushi'},{e:'?',l:'Football'}]", "{items:[{e:'🍕',l:'Pizza'},{e:'🍔',l:'Burger'},{e:'🍣',l:'Sushi'},{e:'⚽',l:'Football'}]"],
  ["{items:[{e:'??',l:'Red'},{e:'??',l:'Blue'},{e:'??',l:'Yellow'},{e:'??',l:'Triangle'}]", "{items:[{e:'🔴',l:'Red'},{e:'🔵',l:'Blue'},{e:'🟡',l:'Yellow'},{e:'🔺',l:'Triangle'}]"],
  ["{items:[{e:'??',l:'Whale'},{e:'??',l:'Dolphin'},{e:'??',l:'Shark'},{e:'??',l:'Eagle'}]", "{items:[{e:'🐋',l:'Whale'},{e:'🐬',l:'Dolphin'},{e:'🦈',l:'Shark'},{e:'🦅',l:'Eagle'}]"],
  ["{items:[{e:'??',l:'Rose'},{e:'??',l:'Sunflower'},{e:'??',l:'Tulip'},{e:'??',l:'Mushroom'}]", "{items:[{e:'🌹',l:'Rose'},{e:'🌻',l:'Sunflower'},{e:'🌷',l:'Tulip'},{e:'🍄',l:'Mushroom'}]"],
  ["{items:[{e:'??',l:'Sock'},{e:'??',l:'Glove'},{e:'??',l:'Hat'},{e:'??',l:'Ice cream'}]", "{items:[{e:'🧦',l:'Sock'},{e:'🧤',l:'Glove'},{e:'🎩',l:'Hat'},{e:'🍦',l:'Ice cream'}]"],
  ["{items:[{e:'??',l:'Bike'},{e:'??',l:'Scooter'},{e:'??',l:'Skates'},{e:'??',l:'Banana'}]", "{items:[{e:'🚲',l:'Bike'},{e:'🛴',l:'Scooter'},{e:'⛸️',l:'Skates'},{e:'🍌',l:'Banana'}]"],
  ["{items:[{e:'??',l:'Lion'},{e:'??',l:'Tiger'},{e:'??',l:'Leopard'},{e:'??',l:'Penguin'}]", "{items:[{e:'🦁',l:'Lion'},{e:'🐯',l:'Tiger'},{e:'🐆',l:'Leopard'},{e:'🐧',l:'Penguin'}]"],
  ["{items:[{e:'?',l:'Mug'},{e:'??',l:'Cup'},{e:'??',l:'Bottle'},{e:'??',l:'Bone'}]", "{items:[{e:'☕',l:'Mug'},{e:'🍵',l:'Cup'},{e:'🍶',l:'Bottle'},{e:'🦴',l:'Bone'}]"],
  ["{items:[{e:'??',l:'Book'},{e:'??',l:'Book'},{e:'??',l:'Book'},{e:'??',l:'Balloon'}]", "{items:[{e:'📚',l:'Book'},{e:'📖',l:'Book'},{e:'📕',l:'Book'},{e:'🎈',l:'Balloon'}]"],
  ["{items:[{e:'??',l:'Strawberry'},{e:'??',l:'Grapes'},{e:'??',l:'Cherries'},{e:'??',l:'Sock'}]", "{items:[{e:'🍓',l:'Strawberry'},{e:'🍇',l:'Grapes'},{e:'🍒',l:'Cherries'},{e:'🧦',l:'Sock'}]"],
  ["{items:[{e:'??',l:'Butterfly'},{e:'??',l:'Bee'},{e:'??',l:'Ladybird'},{e:'??',l:'Elephant'}]", "{items:[{e:'🦋',l:'Butterfly'},{e:'🐝',l:'Bee'},{e:'🐞',l:'Ladybird'},{e:'🐘',l:'Elephant'}]"],
  // ANIMAL_DATA
  ["{name:'Cow',emoji:'??',sound:'MOO'}", "{name:'Cow',emoji:'🐄',sound:'MOO'}"],
  ["{name:'Dog',emoji:'??',sound:'WOOF'}", "{name:'Dog',emoji:'🐕',sound:'WOOF'}"],
  ["{name:'Cat',emoji:'??',sound:'MEOW'}", "{name:'Cat',emoji:'🐱',sound:'MEOW'}"],
  ["{name:'Duck',emoji:'??',sound:'QUACK'}", "{name:'Duck',emoji:'🦆',sound:'QUACK'}"],
  ["{name:'Sheep',emoji:'??',sound:'BAA'}", "{name:'Sheep',emoji:'🐑',sound:'BAA'}"],
  ["{name:'Pig',emoji:'??',sound:'OINK'}", "{name:'Pig',emoji:'🐷',sound:'OINK'}"],
  ["{name:'Lion',emoji:'??',sound:'ROAR'}", "{name:'Lion',emoji:'🦁',sound:'ROAR'}"],
  ["{name:'Owl',emoji:'??',sound:'HOOT'}", "{name:'Owl',emoji:'🦉',sound:'HOOT'}"],
  ["{name:'Snake',emoji:'??',sound:'HISS'}", "{name:'Snake',emoji:'🐍',sound:'HISS'}"],
  ["{name:'Bee',emoji:'??',sound:'BUZZ'}", "{name:'Bee',emoji:'🐝',sound:'BUZZ'}"],
  ["{name:'Horse',emoji:'??',sound:'NEIGH'}", "{name:'Horse',emoji:'🐴',sound:'NEIGH'}"],
  ["{name:'Frog',emoji:'??',sound:'RIBBIT'}", "{name:'Frog',emoji:'🐸',sound:'RIBBIT'}"],
  ["{name:'Rooster',emoji:'??',sound:'COCK-A-DOODLE-DOO'}", "{name:'Rooster',emoji:'🐓',sound:'COCK-A-DOODLE-DOO'}"],
  ["{name:'Elephant',emoji:'??',sound:'TRUMPET'}", "{name:'Elephant',emoji:'🐘',sound:'TRUMPET'}"],
  ["{name:'Bear',emoji:'??',sound:'GROWL'}", "{name:'Bear',emoji:'🐻',sound:'GROWL'}"],
  ["{name:'Mouse',emoji:'??',sound:'SQUEAK'}", "{name:'Mouse',emoji:'🐭',sound:'SQUEAK'}"],
  // OPPOSITES_DATA
  ["{word:'BIG',emoji:'??',opp:'SMALL',oppEmoji:'🎉'}", "{word:'BIG',emoji:'📐',opp:'SMALL',oppEmoji:'🎉'}"],
  ["{word:'HOT',emoji:'??',opp:'COLD',oppEmoji:'🎉'}", "{word:'HOT',emoji:'🔥',opp:'COLD',oppEmoji:'🎉'}"],
  ["{word:'UP',emoji:'??',opp:'DOWN',oppEmoji:'🎉'}", "{word:'UP',emoji:'⬆️',opp:'DOWN',oppEmoji:'🎉'}"],
  ["{word:'FAST',emoji:'??',opp:'SLOW',oppEmoji:'🎉'}", "{word:'FAST',emoji:'🏃',opp:'SLOW',oppEmoji:'🎉'}"],
  ["{word:'HAPPY',emoji:'??',opp:'SAD',oppEmoji:'🎉'}", "{word:'HAPPY',emoji:'😊',opp:'SAD',oppEmoji:'🎉'}"],
  ["{word:'DAY',emoji:'??',opp:'NIGHT',oppEmoji:'🎉'}", "{word:'DAY',emoji:'☀️',opp:'NIGHT',oppEmoji:'🎉'}"],
  ["{word:'WET',emoji:'??',opp:'DRY',oppEmoji:'???'", "{word:'WET',emoji:'💧',opp:'DRY',oppEmoji:'☀️'"],
  ["{word:'FULL',emoji:'??',opp:'EMPTY',oppEmoji:'🎉'}", "{word:'FULL',emoji:'🥤',opp:'EMPTY',oppEmoji:'🎉'}"],
  ["{word:'OPEN',emoji:'??',opp:'CLOSED',oppEmoji:'🎉'}", "{word:'OPEN',emoji:'🚪',opp:'CLOSED',oppEmoji:'🎉'}"],
  ["{word:'LOUD',emoji:'??',opp:'QUIET',oppEmoji:'🎉'}", "{word:'LOUD',emoji:'🔊',opp:'QUIET',oppEmoji:'🎉'}"],
  ["{word:'HARD',emoji:'??',opp:'SOFT',oppEmoji:'🎉'}", "{word:'HARD',emoji:'💪',opp:'SOFT',oppEmoji:'🎉'}"],
  ["{word:'YOUNG',emoji:'??',opp:'OLD',oppEmoji:'🎉'}", "{word:'YOUNG',emoji:'👶',opp:'OLD',oppEmoji:'🎉'}"],
  ["{word:'LIGHT',emoji:'??',opp:'DARK',oppEmoji:'🎉'}", "{word:'LIGHT',emoji:'💡',opp:'DARK',oppEmoji:'🎉'}"],
  ["{word:'NEAR',emoji:'??',opp:'FAR',oppEmoji:'???'", "{word:'NEAR',emoji:'👆',opp:'FAR',oppEmoji:'🔭'"],
  ["{word:'CLEAN',emoji:'??',opp:'DIRTY',oppEmoji:'🎉'}", "{word:'CLEAN',emoji:'✨',opp:'DIRTY',oppEmoji:'🎉'}"],
  ["{word:'TALL',emoji:'??',opp:'SHORT',oppEmoji:'🎉'}", "{word:'TALL',emoji:'📏',opp:'SHORT',oppEmoji:'🎉'}"],
  // BODY_DATA
  ["{part:'Eyes',emoji:'??',q:", "{part:'Eyes',emoji:'👀',q:"],
  ["{part:'Ears',emoji:'??',q:", "{part:'Ears',emoji:'👂',q:"],
  ["{part:'Nose',emoji:'??',q:", "{part:'Nose',emoji:'👃',q:"],
  ["{part:'Mouth',emoji:'??',q:", "{part:'Mouth',emoji:'👄',q:"],
  ["{part:'Hands',emoji:'??',q:", "{part:'Hands',emoji:'🤲',q:"],
  ["{part:'Feet',emoji:'??',q:", "{part:'Feet',emoji:'🦶',q:"],
  ["{part:'Head',emoji:'???'", "{part:'Head',emoji:'🗣️'"],
  ["{part:'Arms',emoji:'??',q:", "{part:'Arms',emoji:'💪',q:"],
  ["{part:'Legs',emoji:'??',q:", "{part:'Legs',emoji:'🦵',q:"],
  ["{part:'Hair',emoji:'??',q:", "{part:'Hair',emoji:'💇',q:"],
  ["{part:'Knees',emoji:'??',q:", "{part:'Knees',emoji:'🦵',q:"],
  ["{part:'Shoulders',emoji:'??',q:", "{part:'Shoulders',emoji:'💪',q:"],
  ["{part:'Toes',emoji:'??',q:", "{part:'Toes',emoji:'🦶',q:"],
  ["{part:'Teeth',emoji:'??',q:", "{part:'Teeth',emoji:'🦷',q:"],
  ["{part:'Tummy',emoji:'??',q:", "{part:'Tummy',emoji:'🤰',q:"],
  // SEQUENCES - Growing a Plant
  ["{title:'Growing a Plant',steps:[{e:'??',l:'Plant the seed'},{e:'??',l:'Water it'},{e:'??',l:'It grows in the sun'},{e:'??',l:'A flower blooms!'}]",
   "{title:'Growing a Plant',steps:[{e:'🌱',l:'Plant the seed'},{e:'💧',l:'Water it'},{e:'☀️',l:'It grows in the sun'},{e:'🌸',l:'A flower blooms!'}]"],
  ["{title:'Making Toast',steps:[{e:'??',l:'Get some bread'},{e:'??',l:'Put it in the toaster'},{e:'??',l:'Toast pops up!'},{e:'??',l:'Add butter'}]",
   "{title:'Making Toast',steps:[{e:'🍞',l:'Get some bread'},{e:'🔥',l:'Put it in the toaster'},{e:'🍞',l:'Toast pops up!'},{e:'🧈',l:'Add butter'}]"],
  ["{title:'Rainy Day',steps:[{e:'??',l:'Clouds gather'},{e:'???',l:'It starts to rain'},{e:'??',l:'Rainbow appears'},{e:'??',l:'Sun comes out'}]",
   "{title:'Rainy Day',steps:[{e:'☁️',l:'Clouds gather'},{e:'🌧️',l:'It starts to rain'},{e:'🌈',l:'Rainbow appears'},{e:'☀️',l:'Sun comes out'}]"],
  ["{title:'Going to Bed',steps:[{e:'??',l:'Have a bath'},{e:'??',l:'Put on pyjamas'},{e:'??',l:'Read a bedtime story'},{e:'??',l:'Fall asleep'}]",
   "{title:'Going to Bed',steps:[{e:'🛁',l:'Have a bath'},{e:'👕',l:'Put on pyjamas'},{e:'📖',l:'Read a bedtime story'},{e:'😴',l:'Fall asleep'}]"],
  ["{title:'Baking a Cake',steps:[{e:'??',l:'Mix the ingredients'},{e:'??',l:'Pour into a tin'},{e:'??',l:'Bake in the oven'},{e:'??',l:'Decorate and eat!'}]",
   "{title:'Baking a Cake',steps:[{e:'🥣',l:'Mix the ingredients'},{e:'🫗',l:'Pour into a tin'},{e:'🔥',l:'Bake in the oven'},{e:'🍰',l:'Decorate and eat!'}]"],
  ["{title:'A Day at the Beach',steps:[{e:'??',l:'Drive to the beach'},{e:'???',l:'Build a sandcastle'},{e:'??',l:'Splash in the sea'},{e:'??',l:'Eat an ice cream'}]",
   "{title:'A Day at the Beach',steps:[{e:'🚗',l:'Drive to the beach'},{e:'🏰',l:'Build a sandcastle'},{e:'💦',l:'Splash in the sea'},{e:'🍦',l:'Eat an ice cream'}]"],
  ["{title:'Getting Dressed',steps:[{e:'?',l:'Wake up'},{e:'??',l:'Put on socks'},{e:'??',l:'Put on your top'},{e:'??',l:'Put on your shoes'}]",
   "{title:'Getting Dressed',steps:[{e:'⏰',l:'Wake up'},{e:'🧦',l:'Put on socks'},{e:'👕',l:'Put on your top'},{e:'👟',l:'Put on your shoes'}]"],
  ["{title:'Growing a Butterfly',steps:[{e:'??',l:'Tiny egg'},{e:'??',l:'Hungry caterpillar'},{e:'???',l:'Sleeps in a cocoon'},{e:'??',l:'Beautiful butterfly!'}]",
   "{title:'Growing a Butterfly',steps:[{e:'🥚',l:'Tiny egg'},{e:'🐛',l:'Hungry caterpillar'},{e:'🫘',l:'Sleeps in a cocoon'},{e:'🦋',l:'Beautiful butterfly!'}]"],
  ["{title:'Brushing Your Teeth',steps:[{e:'??',l:'Get your toothbrush'},{e:'??',l:'Add toothpaste'},{e:'??',l:'Brush for 2 minutes'},{e:'??',l:'Rinse and smile!'}]",
   "{title:'Brushing Your Teeth',steps:[{e:'🪥',l:'Get your toothbrush'},{e:'🧴',l:'Add toothpaste'},{e:'🪥',l:'Brush for 2 minutes'},{e:'😁',l:'Rinse and smile!'}]"],
  ["{title:'Building a Snowman',steps:[{e:'??',l:'Snow falls'},{e:'?',l:'Roll three snowballs'},{e:'??',l:'Add a carrot nose'},{e:'??',l:'Wrap on a scarf'}]",
   "{title:'Building a Snowman',steps:[{e:'❄️',l:'Snow falls'},{e:'⛄',l:'Roll three snowballs'},{e:'🥕',l:'Add a carrot nose'},{e:'🧣',l:'Wrap on a scarf'}]"],
  ["{title:'A Trip to the Library',steps:[{e:'??',l:'Walk to the library'},{e:'??',l:'Choose some books'},{e:'??',l:'Read quietly'},{e:'??',l:'Take books home'}]",
   "{title:'A Trip to the Library',steps:[{e:'🚶',l:'Walk to the library'},{e:'📚',l:'Choose some books'},{e:'📖',l:'Read quietly'},{e:'🎒',l:'Take books home'}]"],
  ["{title:'Planting a Garden',steps:[{e:'??',l:'Dig a small hole'},{e:'??',l:'Drop in the seed'},{e:'??',l:'Water it gently'},{e:'??',l:'Watch it grow!'}]",
   "{title:'Planting a Garden',steps:[{e:'⛏️',l:'Dig a small hole'},{e:'🌱',l:'Drop in the seed'},{e:'💧',l:'Water it gently'},{e:'🌱',l:'Watch it grow!'}]"],
  // RHYMES - these are complex, replace specific corrupted entries
  // Rhyme feedback messages and individual words - too many to do individually
  // Let's handle the done screen messages
  ["Counting is the first step in maths!", "Counting is the first step in maths!"],
  // Done screen emojis
  ["score===total?'??':'??'", "score===total?'🎉':'👏'"],
  // Star feedback messages
  ["? Yes! There are", "✅ Yes! There are"],
  // Count done messages
  ["count them one by one! ??", "count them one by one! 💪"],
  ["Keep practising and you'll be counting to 100 in no time! ??", "Keep practising and you'll be counting to 100 in no time! 🌟"],
  // Colour done messages
  ["Try mixing paints and see what happens! ??", "Try mixing paints and see what happens! 🎨"],
  // Shape done messages
  ["Echo says: look for shapes on your next walk! ??", "Echo says: look for shapes on your next walk! 🦎"],
  // Phonics done messages
  ["you'll be reading books all by yourself! ?", "you'll be reading books all by yourself! 📚"],
  // Add done messages
  ["You're already a mathematician! ??", "You're already a mathematician! 🌟"],
  // Pattern done messages
  ["Spotting patterns is a key maths and reading skill. ??", "Spotting patterns is a key maths and reading skill. 🧠"],
  // Size done messages
  ["This is one of the most important things we use maths for in everyday life! ??", "This is one of the most important things we use maths for in everyday life! 📐"],
  // Odd done messages
  ["When you sort your toys, you're doing maths. ??", "When you sort your toys, you're doing maths. 🧩"],
  // Rhyme done messages
  ["Poems, songs and nursery rhymes are full of rhyming words. ??", "Poems, songs and nursery rhymes are full of rhyming words. 🎵"],
  // Sequence done messages
  ["Understanding <b>order and sequence</b> helps with reading, writing, following instructions and understanding how the world works. Well done! ??", "Understanding <b>order and sequence</b> helps with reading, writing, following instructions and understanding how the world works. Well done! 🌟"],
  // Animals done messages
  ["Keep listening to the world around you. ??", "Keep listening to the world around you. 👂"],
  // Opposites done messages
  ["try finding opposites all around your house! ??", "try finding opposites all around your house! 🏠"],
  // Days done messages
  ["Knowing the <b>order of days</b> helps you understand time, plan your week and know when special days are coming! ??", "Knowing the <b>order of days</b> helps you understand time, plan your week and know when special days are coming! 📅"],
  // Weather done messages
  ["Pip &amp; Echo say: look outside today! ???", "Pip &amp; Echo say: look outside today! 🌦️"],
  // Draw undo
  ["? Undo", "↩️ Undo"],
  // Done screen stars
  ["score===total?'???':score>=Math.ceil(total/2)?'??':'?'", "score===total?'⭐⭐⭐':score>=Math.ceil(total/2)?'⭐⭐':'⭐'"],
  // Body done message
  ["It's the first step in understanding health and staying safe. ?", "It's the first step in understanding health and staying safe. 💪"],
  // Report star display
  ["'?'.repeat(stars) + '?'.repeat(3-stars) : '??? Not yet played'", "'⭐'.repeat(stars) + '☆'.repeat(3-stars) : '☆☆☆ Not yet played'"],
  // Level up badge text
  ["'? Level ${s.level}'", "⭐ Level ${s.level}"],
  // Score display in activities
  ["setScore(`? ${S.score}/${S.total}`)", "setScore(`⭐ ${S.score}/${S.total}`)"],
  ["setScore(`? ${S.score}/${S.total}`)", "setScore(`⭐ ${S.score}/${S.total}`)"],
  // Pattern done
  ["'A pattern is something that repeats like ABAB or ABCABC. You can find patterns in wallpaper, music, nature and even your daily routine! Spotting patterns is a key maths and reading skill. ??'",
   "'A pattern is something that repeats like ABAB or ABCABC. You can find patterns in wallpaper, music, nature and even your daily routine! Spotting patterns is a key maths and reading skill. 🧠'"],
  // Size comparison done
  ["'Words like <b>bigger, smaller, taller, shorter, heavier</b> and <b>lighter</b> are all about <b>measurement and comparison</b>. This is one of the most important things we use maths for in everyday life! ??'",
   "'Words like <b>bigger, smaller, taller, shorter, heavier</b> and <b>lighter</b> are all about <b>measurement and comparison</b>. This is one of the most important things we use maths for in everyday life! 📐'"],
  // Odd done
  ["'Finding what belongs together, and what doesn\\'t, is called <b>classification</b>. Scientists, librarians and chefs all use this skill every day! When you sort your toys, you\\'re doing maths. ??'",
   "'Finding what belongs together, and what doesn\\'t, is called <b>classification</b>. Scientists, librarians and chefs all use this skill every day! When you sort your toys, you\\'re doing maths. 🧩'"],
  // Rhyme done
  ["'When you can spot rhymes, it\\'s easier to read new words! If you know <b>cat</b>, you can figure out <b>bat, hat, mat, sat</b>. Poems, songs and nursery rhymes are full of rhyming words. ??'",
   "'When you can spot rhymes, it\\'s easier to read new words! If you know <b>cat</b>, you can figure out <b>bat, hat, mat, sat</b>. Poems, songs and nursery rhymes are full of rhyming words. 🎵'"],
  // Sequence done
  ["'Every story has a beginning, middle and end. Understanding <b>order and sequence</b> helps with reading, writing, following instructions and understanding how the world works. Well done! ??'",
   "'Every story has a beginning, middle and end. Understanding <b>order and sequence</b> helps with reading, writing, following instructions and understanding how the world works. Well done! 🌟'"],
  // Animals done
  ["'Learning animal sounds helps you build early <b>vocabulary</b> and sharpens your listening skills. Every animal noise is a clue to who it belongs to, just like words are clues to what people mean! Keep listening to the world around you. ??'",
   "'Learning animal sounds helps you build early <b>vocabulary</b> and sharpens your listening skills. Every animal noise is a clue to who it belongs to, just like words are clues to what people mean! Keep listening to the world around you. 👂'"],
  // Opposites done
  ["'Words like big and small, or hot and cold, are called <b>opposites</b>. Learning them helps you build vocabulary and understand how things compare to each other. Echo says: try finding opposites all around your house! ??'",
   "'Words like big and small, or hot and cold, are called <b>opposites</b>. Learning them helps you build vocabulary and understand how things compare to each other. Echo says: try finding opposites all around your house! 🏠'"],
  // Days done
  ["'There are 7 days in a week: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday and Saturday. Knowing the <b>order of days</b> helps you understand time, plan your week and know when special days are coming! ??'",
   "'There are 7 days in a week: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday and Saturday. Knowing the <b>order of days</b> helps you understand time, plan your week and know when special days are coming! 📅'"],
  // Body done
  ["'Learning the names of your <b>body parts</b> helps you talk about how you feel and follow instructions, like \\\"wash your hands\\\" or \\\"wiggle your toes\\\"! It\\'s the first step in understanding health and staying safe. ?'",
   "'Learning the names of your <b>body parts</b> helps you talk about how you feel and follow instructions, like \\\"wash your hands\\\" or \\\"wiggle your toes\\\"! It\\'s the first step in understanding health and staying safe. 💪'"],
  // Weather done
  ["'Looking outside and noticing if it\\'s sunny, rainy or snowy is called <b>observation</b>, the very first step scientists use! Knowing the weather also helps you choose what to wear, like a coat or sunglasses. Pip &amp; Echo say: look outside today! ???'",
   "'Looking outside and noticing if it\\'s sunny, rainy or snowy is called <b>observation</b>, the very first step scientists use! Knowing the weather also helps you choose what to wear, like a coat or sunglasses. Pip &amp; Echo say: look outside today! 🌦️'"],
  // Add done
  ["'When you add two groups, you count them all as one big group. This is the beginning of all maths from buying sweets at the shop to measuring ingredients in a cake! You\\'re already a mathematician! ??'",
   "'When you add two groups, you count them all as one big group. This is the beginning of all maths from buying sweets at the shop to measuring ingredients in a cake! You\\'re already a mathematician! 🌟'"],
  // PHONICS_DATA - replace all corrupted word emojis
  ["{w:'Ant',e:'??'},{w:'Arrow',e:'✅'}]", "{w:'Ant',e:'🐜'},{w:'Arrow',e:'🏹'}]"],
  ["{w:'Bear',e:'??'},{w:'Boat',e:'?'},{w:'Bus',e:'✅'}]", "{w:'Bear',e:'🐻'},{w:'Boat',e:'⛵'},{w:'Bus',e:'🚌'}]"],
  ["{w:'Cat',e:'??'},{w:'Cake',e:'??'},{w:'Car',e:'??'},{w:'Cow',e:'✅'}]", "{w:'Cat',e:'🐱'},{w:'Cake',e:'🎂'},{w:'Car',e:'🚗'},{w:'Cow',e:'🐄'}]"],
  ["{w:'Dog',e:'??'},{w:'Duck',e:'??'},{w:'Drum',e:'??'},{w:'Door',e:'✅'}]", "{w:'Dog',e:'🐕'},{w:'Duck',e:'🦆'},{w:'Drum',e:'🥁'},{w:'Door',e:'🚪'}]"],
  ["{w:'Egg',e:'??'},{w:'Elephant',e:'✅'}]", "{w:'Egg',e:'🥚'},{w:'Elephant',e:'🐘'}]"],
  ["{w:'Fish',e:'??'},{w:'Frog',e:'??'},{w:'Fire',e:'??'},{w:'Flower',e:'✅'}]", "{w:'Fish',e:'🐟'},{w:'Frog',e:'🐸'},{w:'Fire',e:'🔥'},{w:'Flower',e:'🌸'}]"],
  ["{w:'Goat',e:'??'},{w:'Grapes',e:'??'},{w:'Gift',e:'✅'}]", "{w:'Goat',e:'🐐'},{w:'Grapes',e:'🍇'},{w:'Gift',e:'🎁'}]"],
  ["{w:'Hat',e:'??'},{w:'Horse',e:'??'},{w:'House',e:'??'},{w:'Heart',e:'✅'}]", "{w:'Hat',e:'🎩'},{w:'Horse',e:'🐴'},{w:'House',e:'🏠'},{w:'Heart',e:'❤️'}]"],
  ["{w:'Moon',e:'??'},{w:'Mouse',e:'??'},{w:'Milk',e:'??'},{w:'Monkey',e:'✅'}]", "{w:'Moon',e:'🌙'},{w:'Mouse',e:'🐭'},{w:'Milk',e:'🥛'},{w:'Monkey',e:'🐵'}]"],
  ["{w:'Sun',e:'??'},{w:'Star',e:'?'},{w:'Snake',e:'??'},{w:'Snail',e:'✅'}]", "{w:'Sun',e:'☀️'},{w:'Star',e:'⭐'},{w:'Snake',e:'🐍'},{w:'Snail',e:'🐌'}]"],
  ["{w:'Tiger',e:'??'},{w:'Turtle',e:'??'},{w:'Tree',e:'??'},{w:'Train',e:'✅'}]", "{w:'Tiger',e:'🐯'},{w:'Turtle',e:'🐢'},{w:'Tree',e:'🌳'},{w:'Train',e:'🚂'}]"],
  ["{w:'Pig',e:'??'},{w:'Pizza',e:'??'},{w:'Penguin',e:'??'},{w:'Pear',e:'✅'}]", "{w:'Pig',e:'🐷'},{w:'Pizza',e:'🍕'},{w:'Penguin',e:'🐧'},{w:'Pear',e:'🍐'}]"],
  ["{w:'Rainbow',e:'??'},{w:'Rocket',e:'??'},{w:'Robot',e:'??'},{w:'Rose',e:'✅'}]", "{w:'Rainbow',e:'🌈'},{w:'Rocket',e:'🚀'},{w:'Robot',e:'🤖'},{w:'Rose',e:'🌹'}]"],
  ["{w:'Lion',e:'??'},{w:'Leaf',e:'??'},{w:'Lemon',e:'🍋'},{w:'Ladybird',e:'✅'}]", "{w:'Lion',e:'🦁'},{w:'Leaf',e:'🍁'},{w:'Lemon',e:'🍋'},{w:'Ladybird',e:'🐞'}]"],
  ["{w:'Nest',e:'??'},{w:'Night',e:'??'},{w:'Nose',e:'✅'}]", "{w:'Nest',e:'🪺'},{w:'Night',e:'🌙'},{w:'Nose',e:'👃'}]"],
  // RHYMES - individual word emojis
  ["{w:'HAT',e:'??'},{w:'BAT',e:'??'},{w:'MAT',e:'✅'}]", "{w:'HAT',e:'🎩'},{w:'BAT',e:'🦇'},{w:'MAT',e:'🟫'}]"],
  ["{w:'TREE',e:'??'},{w:'KEY',e:'??'},{w:'SEA',e:'✅'}]", "{w:'TREE',e:'🌳'},{w:'KEY',e:'🔑'},{w:'SEA',e:'🌊'}]"],
  ["{w:'CAR',e:'??'},{w:'JAR',e:'✅'}]", "{w:'CAR',e:'🚗'},{w:'JAR',e:'🫙'}]"],
  ["{w:'LAKE',e:'???'},{w:'SNAKE',e:'??'},{w:'RAKE',e:'✅'}]", "{w:'LAKE',e:'🏞️'},{w:'SNAKE',e:'🐍'},{w:'RAKE',e:'🍴'}]"],
  ["{w:'LOG',e:'??'},{w:'FROG',e:'✅'}]", "{w:'LOG',e:'🪵'},{w:'FROG',e:'🐸'}]"],
  ["{w:'SPOON',e:'??'},{w:'TUNE',e:'??'},{w:'BALLOON',e:'✅'}]", "{w:'SPOON',e:'🥄'},{w:'TUNE',e:'🎵'},{w:'BALLOON',e:'🎈'}]"],
  ["{w:'CHAIR',e:'??'},{w:'HAIR',e:'??'},{w:'PEAR',e:'✅'}]", "{w:'CHAIR',e:'🪑'},{w:'HAIR',e:'💇'},{w:'PEAR',e:'🍐'}]"],
  ["{w:'TOP',e:'??'},{w:'SHOP',e:'??'},{w:'DROP',e:'✅'}]", "{w:'TOP',e:'👑'},{w:'SHOP',e:'🛒'},{w:'DROP',e:'💧'}]"],
  ["{w:'WALL',e:'??'},{w:'TALL',e:'??'},{w:'CALL',e:'✅'}]", "{w:'WALL',e:'🧱'},{w:'TALL',e:'📏'},{w:'CALL',e:'📞'}]"],
  ["{w:'MUG',e:'?'},{w:'HUG',e:'??'},{w:'RUG',e:'✅'}]", "{w:'MUG',e:'☕'},{w:'HUG',e:'🤗'},{w:'RUG',e:'🟫'}]"],
  ["{w:'WIG',e:'??'},{w:'BIG',e:'??'},{w:'DIG',e:'✅'}]", "{w:'WIG',e:'💇'},{w:'BIG',e:'📐'},{w:'DIG',e:'⛏️'}]"],
  ["{w:'BOX',e:'??'},{w:'SOCKS',e:'??'},{w:'ROCKS',e:'✅'}]", "{w:'BOX',e:'📦'},{w:'SOCKS',e:'🧦'},{w:'ROCKS',e:'🪨'}]"],
  ["{w:'JEEP',e:'??'},{w:'SLEEP',e:'??'},{w:'DEEP',e:'✅'}]", "{w:'JEEP',e:'🚙'},{w:'SLEEP',e:'😴'},{w:'DEEP',e:'🏊'}]"],
  ["{w:'RING',e:'??'},{w:'WING',e:'??'},{w:'SWING',e:'✅'}]", "{w:'RING',e:'💍'},{w:'WING',e:'🪽'},{w:'SWING',e:'🎯'}]"],
  ["{w:'MAIL',e:'??'},{w:'TAIL',e:'??'},{w:'WHALE',e:'✅'}]", "{w:'MAIL',e:'📬'},{w:'TAIL',e:'🦊'},{w:'WHALE',e:'🐋'}]"],
  // Rhyme wrong options
  ["{w:'DOG',e:'??'},{w:'FISH',e:'??'},{w:'SUN',e:'⭐'}]", "{w:'DOG',e:'🐕'},{w:'FISH',e:'🐟'},{w:'SUN',e:'☀️'}]"],
  ["{w:'CAT',e:'??'},{w:'BALL',e:'?'},{w:'STAR',e:'?'}]", "{w:'CAT',e:'🐱'},{w:'BALL',e:'⚽'},{w:'STAR',e:'⭐'}]"],
  ["{w:'MOON',e:'??'},{w:'FISH',e:'??'},{w:'CAT',e:'⭐'}]", "{w:'MOON',e:'🌙'},{w:'FISH',e:'🐟'},{w:'CAT',e:'🐱'}]"],
  ["{w:'PIE',e:'??'},{w:'BREAD',e:'??'},{w:'FISH',e:'⭐'}]", "{w:'PIE',e:'🥧'},{w:'BREAD',e:'🍞'},{w:'FISH',e:'🐟'}]"],
  ["{w:'CAT',e:'??'},{w:'BIRD',e:'??'},{w:'FISH',e:'⭐'}]", "{w:'CAT',e:'🐱'},{w:'BIRD',e:'🐦'},{w:'FISH',e:'🐟'}]"],
  ["{w:'SUN',e:'??'},{w:'STAR',e:'?'},{w:'CLOUD',e:'⭐'}]", "{w:'SUN',e:'☀️'},{w:'STAR',e:'⭐'},{w:'CLOUD',e:'☁️'}]"],
  ["{w:'FOX',e:'??'},{w:'FISH',e:'??'},{w:'DUCK',e:'⭐'}]", "{w:'FOX',e:'🦊'},{w:'FISH',e:'🐟'},{w:'DUCK',e:'🦆'}]"],
  ["{w:'RUN',e:'??'},{w:'SKIP',e:'??'},{w:'JUMP',e:'⭐'}]", "{w:'RUN',e:'🏃'},{w:'SKIP',e:'🤸'},{w:'JUMP',e:'🦘'}]"],
  ["{w:'BAT',e:'??'},{w:'NET',e:'??'},{w:'GOAL',e:'?'}]", "{w:'BAT',e:'🏏'},{w:'NET',e:'🥅'},{w:'GOAL',e:'⚽'}]"],
  ["{w:'ANT',e:'??'},{w:'BEE',e:'??'},{w:'FLY',e:'⭐'}]", "{w:'ANT',e:'🐜'},{w:'BEE',e:'🐝'},{w:'FLY',e:'🪰'}]"],
  ["{w:'COW',e:'??'},{w:'HEN',e:'??'},{w:'GOAT',e:'⭐'}]", "{w:'COW',e:'🐄'},{w:'HEN',e:'🐔'},{w:'GOAT',e:'🐐'}]"],
  ["{w:'WOLF',e:'??'},{w:'BEAR',e:'??'},{w:'DEER',e:'⭐'}]", "{w:'WOLF',e:'🐺'},{w:'BEAR',e:'🐻'},{w:'DEER',e:'🦌'}]"],
  ["{w:'GOAT',e:'??'},{w:'COW',e:'??'},{w:'PIG',e:'⭐'}]", "{w:'GOAT',e:'🐐'},{w:'COW',e:'🐄'},{w:'PIG',e:'🐷'}]"],
  ["{w:'QUEEN',e:'??'},{w:'CASTLE',e:'??'},{w:'CROWN',e:'⭐'}]", "{w:'QUEEN',e:'👑'},{w:'CASTLE',e:'🏰'},{w:'CROWN',e:'👑'}]"],
  ["{w:'SLUG',e:'??'},{w:'WORM',e:'??'},{w:'ANT',e:'⭐'}]", "{w:'SLUG',e:'🐌'},{w:'WORM',e:'🪱'},{w:'ANT',e:'🐜'}]"],
  // Weather emojis
  ["emoji:'???'", "emoji:'🌦️'"],
  // Score setScore patterns - replace all remaining `? ${S.score}` patterns
  // These use template literals with backticks
  // feedback messages with ?? at end
  ["'Look outside and see what the sky looks like today.'", "'Look outside and see what the sky looks like today.'"],
  // done screen play again button
  ["'? Play Again!'", "'🔄 Play Again!'"],
  ["'? Play Again':'? Play!'", "'🔄 Play Again':'▶️ Play!'"],
  // Remaining ?? in various places
  ["'? That's right,", "'✅ That's right,"],
  ["'? ${S.cur.a} is right!'", "'✅ ${S.cur.a} is right!'"],
  ["'? Yes! ${S.correct.e} ${S.correct.w} starts with ${S.cur.letter}!'", "'✅ Yes! ${S.correct.e} ${S.correct.w} starts with ${S.cur.letter}!'"],
  ["'? ${S.cur.a} + ${S.cur.b} = ${S.cur.ans} ${S.cur.emoji}'", "'✅ ${S.cur.a} + ${S.cur.b} = ${S.cur.ans} ${S.cur.emoji}'"],
  ["'? ${S.cur}, you spotted the pattern!'", "'✅ ${S.cur}, you spotted the pattern!'"],
  ["'? Yes, that's a ${S.cur.name}! ??'", "'✅ Yes, that's a ${S.cur.name}! 🎨'"],
  ["'? ${S.cur.word} and ${S.correct.w}, they rhyme! ??'", "'✅ ${S.cur.word} and ${S.correct.w}, they rhyme! 🎵'"],
  ["'? Yes! ${S.cur.emoji} ${S.cur.name} says \"${S.cur.sound}\"!'", "'✅ Yes! ${S.cur.emoji} ${S.cur.name} says \"${S.cur.sound}\"!'"],
  ["'? Yes! The opposite of ${S.cur.word} is ${S.cur.opp} ${S.cur.oppEmoji}'", "'✅ Yes! The opposite of ${S.cur.word} is ${S.cur.opp} ${S.cur.oppEmoji}'"],
  ["'? ${S.story.title} in the right order! ??'", "'✅ ${S.story.title} in the right order! 🌟'"],
  ["'? Right! The ${correctItem.l} ${correctItem.e} is ${S.cur.askBig?'bigger':'smaller'}!'", "'✅ Right! The ${correctItem.l} ${correctItem.e} is ${S.cur.askBig?'bigger':'smaller'}!'"],
  ["'? ${S.cur.set.items[S.cur.set.odd].e} is the odd one out, ${S.cur.set.why}'", "'✅ ${S.cur.set.items[S.cur.set.odd].e} is the odd one out, ${S.cur.set.why}'"],
  // remaining ?? in done screen messages
  ["'Great try play again to get even better!'", "'Great try play again to get even better!'"],
  // More specific feedback
  ["`? ${S.score}/${S.total}`", "`⭐ ${S.score}/${S.total}`"],
  // Last resort: replace remaining ?? in specific known contexts
  ["'? Play Again':'? Play!'", "'🔄 Play Again':'▶️ Play!'"],
  ["'? Play Again!'", "'🔄 Play Again!'"],
]);

console.log('\nDone! File 1 processed.');
