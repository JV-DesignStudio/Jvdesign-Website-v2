const fs = require('fs');
let c = fs.readFileSync('workshops/learning-lab.html', 'utf8');
const before = (c.match(/\?\?/g)||[]).length;

// Activity emojis
c = c.replace("{ id:'echo',     emoji:'??', name:'Echo'", "{ id:'echo',     emoji:'🦎', name:'Echo'");
c = c.replace("{ id:'pip',      emoji:'??', name:'Pip'", "{ id:'pip',      emoji:'🐢', name:'Pip'");
c = c.replace("{ id:'lumo',     emoji:'??', name:'Lumo'", "{ id:'lumo',     emoji:'✨', name:'Lumo'");
c = c.replace("{ id:'english',  emoji:'??', name:'Echo & Friends'", "{ id:'english',  emoji:'📝', name:'Echo & Friends'");
c = c.replace("{ id:'strange',  emoji:'??', name:'Something Strange'", "{ id:'strange',  emoji:'👻', name:'Something Strange'");
c = c.replace("{ id:'geo',      emoji:'??', name:'Atlas'", "{ id:'geo',      emoji:'🌍', name:'Atlas'");
c = c.replace("{ id:'times',    emoji:'??', name:'Pip\\'s Tables'", "{ id:'times',    emoji:'🔢', name:'Pip\\'s Tables'");
c = c.replace("{ id:'history',  emoji:'???'", "{ id:'history',  emoji:'📜'");
c = c.replace("{ id:'music',    emoji:'??', name:'Melody'", "{ id:'music',    emoji:'🎵', name:'Melody'");
c = c.replace("{ id:'logic',    emoji:'??', name:'Logic Lab'", "{ id:'logic',    emoji:'💡', name:'Logic Lab'");
c = c.replace("{ id:'art',      emoji:'??', name:'Palette'", "{ id:'art',      emoji:'🎨', name:'Palette'");
c = c.replace("{ id:'health',   emoji:'??', name:'Vitality'", "{ id:'health',   emoji:'💪', name:'Vitality'");
c = c.replace("{ id:'inventors',emoji:'??', name:'Inventor\\'s Workshop'", "{ id:'inventors',emoji:'🔬', name:'Inventor\\'s Workshop'");
c = c.replace("{ id:'space',    emoji:'??', name:'Orbit'", "{ id:'space',    emoji:'🚀', name:'Orbit'");
c = c.replace("{ id:'nature',   emoji:'??', name:'Habitat'", "{ id:'nature',   emoji:'🌿', name:'Habitat'");

// Subject emojis
c = c.replace("emoji:'??', name:'Computing'", "emoji:'💻', name:'Computing'");
c = c.replace("emoji:'??', name:'Maths'", "emoji:'🔢', name:'Maths'");
c = c.replace("emoji:'??', name:'English'", "emoji:'📝', name:'English'");
c = c.replace("emoji:'??', name:'Science'", "emoji:'🔬', name:'Science'");
c = c.replace("emoji:'??', name:'Geography'", "emoji:'🌍', name:'Geography'");
c = c.replace("emoji:'???'", "emoji:'📜'");
c = c.replace("emoji:'??', name:'Music'", "emoji:'🎵', name:'Music'");
c = c.replace("emoji:'??', name:'Logic & Coding'", "emoji:'💡', name:'Logic & Coding'");
c = c.replace("emoji:'??', name:'Number Bonds'", "emoji:'✨', name:'Number Bonds'");
c = c.replace("emoji:'??', name:'Memory'", "emoji:'👻', name:'Memory'");
c = c.replace("emoji:'??', name:'Times Tables'", "emoji:'🔢', name:'Times Tables'");
c = c.replace("emoji:'??', name:'Art & Design'", "emoji:'🎨', name:'Art & Design'");
c = c.replace("emoji:'??', name:'PE & Health'", "emoji:'💪', name:'PE & Health'");
c = c.replace("emoji:'??', name:'Inventions'", "emoji:'🔬', name:'Inventions'");
c = c.replace("emoji:'??', name:'Space'", "emoji:'🚀', name:'Space'");
c = c.replace("emoji:'??', name:'Nature & Animals'", "emoji:'🌿', name:'Nature & Animals'");

// Progress bar loading dots
c = c.replace("['?','??','?','??','??'][Math.floor", "['.','.','.','.','.'][Math.floor");

// Timeline marker
c = c.replace("left:${pct}%'>???</div>", "left:${pct}%'>📍</div>");

// Inventors parts
c = c.replace("['??','??','??','???','??','??','?','??','??','??','???','??']", "['💡','⚙️','🔧','🔩','⚡','🔥','⭐','💎','🎯','🏁','🔑','📦']");

// Space elements
c = c.replace("space-planet'>??</div>", "space-planet'>🌍</div>");
c = c.replace("space-rocket'", "space-rocket'");
c = c.replace("rotate(${deg}deg)'>??</div>", "rotate(${deg}deg)'>🚀</div>");

// Nature growth
c = c.replace("['??','??','??','??','??','??','??','??','??','???','??','??']", "['🌱','🌿','🍃','🌾','🌳','🌲','🌸','🌺','🌻','🌼','🍎','🎃']");

// Streak messages
c = c.replace("streak>=12?'?? Perfect streak!':'?? '+streak+' in a row!'", "streak>=12?'🔥 Perfect streak!':'🔥 '+streak+' in a row!'");
c = c.replace("streakData.streak>=7?' ????':''", "streakData.streak>=7?' 🔥🔥🔥🔥':''");

// XP levels
c = c.replace("{min:0,   max:100,  title:'?? Cadet'}", "{min:0,   max:100,  title:'⭐ Cadet'}");
c = c.replace("{min:100, max:300,  title:'?? Explorer'}", "{min:100, max:300,  title:'🌟 Explorer'}");
c = c.replace("{min:300, max:600,  title:'?? Scholar'}", "{min:300, max:600,  title:'🏆 Scholar'}");
c = c.replace("{min:600, max:1000, title:'?? Champion'}", "{min:600, max:1000, title:'🥇 Champion'}");
c = c.replace("{min:1000,max:99999,title:'?? Master'}", "{min:1000,max:99999,title:'👑 Master'}");

// Badges
c = c.replace("{ id:'first',   icon:'??', name:'First Steps'", "{ id:'first',   icon:'⭐', name:'First Steps'");
c = c.replace("{ id:'rounded', icon:'??', name:'Well Rounded'", "{ id:'rounded', icon:'🏅', name:'Well Rounded'");
c = c.replace("{ id:'full',    icon:'??', name:'Full House'", "{ id:'full',    icon:'🏆', name:'Full House'");
c = c.replace("{ id:'scholar', icon:'??', name:'Scholar'", "{ id:'scholar', icon:'🎓', name:'Scholar'");
c = c.replace("{ id:'champion',icon:'??', name:'Champion'", "{ id:'champion',icon:'🥇', name:'Champion'");
c = c.replace("{ id:'master',  icon:'??', name:'Master'", "{ id:'master',  icon:'👑', name:'Master'");
c = c.replace("{ id:'practice',icon:'??', name:'Practice Pro'", "{ id:'practice',icon:'💪', name:'Practice Pro'");
c = c.replace("{ id:'high',    icon:'??', name:'High Scorer'", "{ id:'high',    icon:'🎯', name:'High Scorer'");
c = c.replace("{ id:'streak7', icon:'??', name:'On Fire'", "{ id:'streak7', icon:'🔥', name:'On Fire'");

// Study guide button
c = c.replace("?? Study Guide first</button>", "📖 Study Guide first</button>");

// Science icons
c = c.replace("{ icon:'???', title:'States of matter'", "{ icon:'🔬', title:'States of matter'");
c = c.replace("{ icon:'???', title:'Flags tell stories'", "{ icon:'🏴', title:'Flags tell stories'");
c = c.replace("{ icon:'???', title:'Capitals aren\\'t always biggest'", "{ icon:'🏛️', title:'Capitals aren\\'t always biggest'");
c = c.replace("{ icon:'???', title:'Tables unlock fractions'", "{ icon:'🔢', title:'Tables unlock fractions'");
c = c.replace("{ icon:'???', title:'Famous artists'", "{ icon:'🎨', title:'Famous artists'");
c = c.replace("{ icon:'?????', title:'Astronauts'", "{ icon:'🧑‍🚀', title:'Astronauts'");
c = c.replace("{ icon:'???', title:'Habitats'", "{ icon:'🌿', title:'Habitats'");

// Echo code explorer
c = c.replace("icon:'??',label:'move()'", "icon:'🏃',label:'move()'");
c = c.replace("icon:'??',label:'back()'", "icon:'⬅️',label:'back()'");
c = c.replace("icon:'??',label:'jump()'", "icon:'🦘',label:'jump()'");
c = c.replace("icon:'??',label:'collect()'", "icon:'💎',label:'collect()'");
c = c.replace("icon:'??',label:'loop(n)'", "icon:'🔁',label:'loop(n)'");
c = c.replace("? <span id='echoCoins'>0</span>", "💰 <span id='echoCoins'>0</span>");
c = c.replace("?? Echo's Code Explorer", "💡 Echo's Code Explorer");
c = c.replace("?? Loop how many times?", "🔁 Loop how many times?");

// Echo lives
c = c.replace("'??'.repeat(E.lives)+'??'.repeat(3-E.lives)", "'❤️'.repeat(E.lives)+'🖤'.repeat(3-E.lives)");

// Pip shop
c = c.replace("{name:'Star Biscuit',emoji:'?'", "{name:'Star Biscuit',emoji:'⭐'");
c = c.replace("{name:'Round Biscuit',emoji:'??'", "{name:'Round Biscuit',emoji:'🔵'");
c = c.replace("{name:'Heart Biscuit',emoji:'??'", "{name:'Heart Biscuit',emoji:'❤️'");
c = c.replace("{name:'Moon Biscuit',emoji:'??'", "{name:'Moon Biscuit',emoji:'🌙'");
c = c.replace("{name:'Cloud Biscuit',emoji:'??'", "{name:'Cloud Biscuit',emoji:'☁️'");
c = c.replace("{name:'Sun Biscuit',emoji:'??'", "{name:'Sun Biscuit',emoji:'☀️'");
c = c.replace("{name:'Flower Biscuit',emoji:'??'", "{name:'Flower Biscuit',emoji:'🌸'");
c = c.replace("{name:'Diamond Biscuit',emoji:'??'", "{name:'Diamond Biscuit',emoji:'💎'");

c = c.replace("?? <b id='pipStreak'>0</b> streak", "🔥 <b id='pipStreak'>0</b> streak");
c = c.replace("?? Today's Order", "🛒 Today's Order");
c = c.replace("?? Shop Closed!", "🚫 Shop Closed!");
c = c.replace("?? Pip explains...", "🐢 Pip explains...");

c = c.replace("['??','??','??','???','??','??','??','??','??','??']", "['🟢','🔵','🟠','🔴','🟢','🔵','🟠','🔴','🟢','🔵']");

c = c.replace("?? <span id='bubbleCombo'>0</span>", "🔥 <span id='bubbleCombo'>0</span>");
c = c.replace("' ?? combo!'", "' 🔥 combo!'");

// Number bonds
c = c.replace("'<div class='learn-eyebrow' style='color:#818CF8'>?? Lumo explains...", "'<div class='learn-eyebrow' style='color:#818CF8'>✨ Lumo explains...");
c = c.replace("{word:'CAT',hint:'A fluffy pet ??'}", "{word:'CAT',hint:'A fluffy pet 🐱'}");
c = c.replace("{word:'DOG',hint:'Wags its tail ??'}", "{word:'DOG',hint:'Wags its tail 🐕'}");
c = c.replace("{word:'FROG',hint:'Jumps and croaks ??'}", "{word:'FROG',hint:'Jumps and croaks 🐸'}");
c = c.replace("{word:'SHIP',hint:'Sails the sea ??'}", "{word:'SHIP',hint:'Sails the sea ⛵'}");
c = c.replace("{word:'STAR',hint:'Shines at night ?'}", "{word:'STAR',hint:'Shines at night ⭐'}");
c = c.replace("{word:'JUMP',hint:'Over puddles! ??'}", "{word:'JUMP',hint:'Over puddles! 🦘'}");
c = c.replace("{word:'HAPPY',hint:'How you feel on your birthday ??'}", "{word:'HAPPY',hint:'How you feel on your birthday 😊'}");
c = c.replace("{word:'FISH',hint:'Swims underwater ??'}", "{word:'FISH',hint:'Swims underwater 🐟'}");
c = c.replace("{word:'CLOCK',hint:'Tells the time ?'}", "{word:'CLOCK',hint:'Tells the time ⏰'}");
c = c.replace("{word:'DRUM',hint:'Hit it for music ??'}", "{word:'DRUM',hint:'Hit it for music 🥁'}");
c = c.replace("{word:'SMILE',hint:'What laughter makes ??'}", "{word:'SMILE',hint:'What laughter makes 😄'}");
c = c.replace("{word:'CLOUD',hint:'Floats in the sky ??'}", "{word:'CLOUD',hint:'Floats in the sky ☁️'}");
c = c.replace("{word:'BRAVE',hint:'Facing something scary ??'}", "{word:'BRAVE',hint:'Facing something scary 💪'}");
c = c.replace("{word:'FLAME',hint:'Fire makes this ??'}", "{word:'FLAME',hint:'Fire makes this 🔥'}");
c = c.replace("{word:'STORM',hint:'Rain + wind + thunder ??'}", "{word:'STORM',hint:'Rain + wind + thunder ⛈️'}");
c = c.replace("{word:'BLOOM',hint:'A flower does this ??'}", "{word:'BLOOM',hint:'A flower does this 🌸'}");
c = c.replace("{word:'CRISP',hint:'Crunchy snack ??'}", "{word:'CRISP',hint:'Crunchy snack 🍟'}");
c = c.replace("{word:'PLANT',hint:'Needs water and sun ??'}", "{word:'PLANT',hint:'Needs water and sun 🌱'}");

// English game
c = c.replace("?? Spell the word!", "📝 Spell the word!");
c = c.replace("?? <span id='engCombo'>0</span> strea", "🔥 <span id='engCombo'>0</span> strea");
c = c.replace("?? All 10 words done!", "🎉 All 10 words done!");
c = c.replace("?? Best streak:", "🔥 Best streak:");
c = c.replace("?? Great spelling!", "📝 Great spelling!");
c = c.replace("you're doing it right now! ??", "you're doing it right now! 📝");

// Potions lab
c = c.replace("emoji:'??', label:'Acid'", "emoji:'🧪', label:'Acid'");
c = c.replace("emoji:'??', label:'Base'", "emoji:'🧫', label:'Base'");
c = c.replace("emoji:'??',  label:'Ice'", "emoji:'🧊',  label:'Ice'");
c = c.replace("emoji:'??', label:'Water'", "emoji:'💧', label:'Water'");
c = c.replace("emoji:'??',  label:'Sun'", "emoji:'☀️',  label:'Sun'");
c = c.replace("emoji:'??', label:'Plant'", "emoji:'🌱', label:'Plant'");
c = c.replace("emoji:'??', label:'Heat'", "emoji:'🔥', label:'Heat'");

// Potion results
c = c.replace("result:'??', name:'Steam!'", "result:'💨', name:'Steam!'");
c = c.replace("result:'??', name:'Frozen!'", "result:'🧊', name:'Frozen!'");
c = c.replace("result:'??', name:'Melted!'", "result:'💧', name:'Melted!'");
c = c.replace("result:'??', name:'Reaction!'", "result:'💥', name:'Reaction!'");
c = c.replace("result:'??', name:'Photosynthesis!'", "result:'🌿', name:'Photosynthesis!'");
c = c.replace("result:'??', name:'Growth!'", "result:'🌱', name:'Growth!'");
c = c.replace("result:'??', name:'Solar Melt!'", "result:'💧', name:'Solar Melt!'");
c = c.replace("result:'??', name:'Frozen Plant!'", "result:'🥶', name:'Frozen Plant!'");
c = c.replace("result:'??', name:'Just Water!'", "result:'💧', name:'Just Water!'");

c = c.replace("?? Potions Lab", "🧪 Potions Lab");
c = c.replace("?? <span id='potStreak'>0</span> str", "🔥 <span id='potStreak'>0</span> str");
c = c.replace("?? Streak bonus +5!", "🔥 Streak bonus +5!");

// Memory game
c = c.replace("['??','??','??','??','??','??','??','??']", "['🐱','🐶','🐰','🐻','🦊','🐸','🐵','🦁']");

c = c.replace("?? <span id='memStreak'>0</span>", "🔥 <span id='memStreak'>0</span>");
c = c.replace("?? All pairs found", "🎉 All pairs found");
c = c.replace("?? Best streak: ${MG.bestStreak}", "🔥 Best streak: ${MG.bestStreak}");
c = c.replace("?? Something Strange explains...", "👻 Something Strange explains...");

// Geography
c = c.replace("?? <span id='geoStreak'>0</span>", "🔥 <span id='geoStreak'>0</span>");
c = c.replace("?? ${set.region}", "🌍 ${set.region}");
c = c.replace("'??? Capital Cities'", "'🏛️ Capital Cities'");
c = c.replace("'?? World Facts'", "'🌍 World Facts'");
c = c.replace("???????", "🌍🌍🌍🌍🌍🌍🌍");
c = c.replace("?? Atlas explains...", "🌍 Atlas explains...");

// Number bonds lives
c = c.replace("??????", "❤️❤️❤️");

c = c.replace("?? <span id='nbStreak'>0</span>", "🔥 <span id='nbStreak'>0</span>");
c = c.replace("?? Pick a times table", "🔢 Pick a times table");

// Times table lives
c = c.replace("'??'.repeat(Math.max(0,NB.lives))+'??'.repeat(Math.max(0,3-NB.lives))", "'❤️'.repeat(Math.max(0,NB.lives))+'🖤'.repeat(Math.max(0,3-NB.lives))");

c = c.replace("?? Times Tables Master", "🔢 Times Tables Master");
c = c.replace("emoji:'???'", "emoji:'📜'");

// History
c = c.replace("eraEmoji:'??'", "eraEmoji:'📜'");
c = c.replace("??? Chronicle says...", "📜 Chronicle says...");

// Beat maker
c = c.replace("?? Beat Maker", "🎵 Beat Maker");
c = c.replace("?? <span id='bmStreak'>0</span>", "🔥 <span id='bmStreak'>0</span>");
c = c.replace("?? <BM.streak> in a row!`:''", "🔥 <BM.streak> in a row!`:''");
c = c.replace("?? Melody says...", "🎵 Melody says...");

// Logic lab
c = c.replace("?? <span id='lgcStreak'>0</span>", "🔥 <span id='lgcStreak'>0</span>");
c = c.replace("?? Hint:", "💡 Hint:");
c = c.replace("Goal: make output ${p.target?'?? ON':'?? OFF'}", "Goal: make output ${p.target?'💡 ON':'💡 OFF'}");
c = c.replace("out?'??':'??'", "out?'💡':'⚫'");
c = c.replace("?? ${LQ.streak} in", "🔥 ${LQ.streak} in");
c = c.replace("?? Logic Lab explains...", "💡 Logic Lab explains...");

// Art
c = c.replace("emoji:'??', doneLabel:'Palette done!'", "emoji:'🎨', doneLabel:'Palette done!'");
c = c.replace("eraEmoji:'??', eraColor:'#F97316', sceneEmojis:['??','???','??']", "eraEmoji:'🎨', eraColor:'#F97316', sceneEmojis:['🎨','🖌️','🖼️']");
c = c.replace("?? Palette says...", "🎨 Palette says...");

// Health
c = c.replace("emoji:'??', doneLabel:'Vitality done!'", "emoji:'💪', doneLabel:'Vitality done!'");
c = c.replace("?? Vitality says...", "💪 Vitality says...");

// Inventions
c = c.replace("emoji:'??', doneLabel:'Workshop done!'", "emoji:'🔬', doneLabel:'Workshop done!'");
c = c.replace("eraEmoji:'??', eraColor:'#FBBF24'", "eraEmoji:'🔬', eraColor:'#FBBF24'");
c = c.replace("?? Inventor's Workshop says...", "🔬 Inventor's Workshop says...");

// Space
c = c.replace("emoji:'??', doneLabel:'Orbit done!'", "emoji:'🚀', doneLabel:'Orbit done!'");
c = c.replace("eraEmoji:'??', eraColor:'#C084FC', sceneEmojis:['??','?','??']", "eraEmoji:'🚀', eraColor:'#C084FC', sceneEmojis:['🚀','⭐','🌍']");
c = c.replace("?? Orbit says...", "🚀 Orbit says...");

// Nature
c = c.replace("emoji:'??', doneLabel:'Habitat done!'", "emoji:'🌿', doneLabel:'Habitat done!'");
c = c.replace("eraEmoji:'??', eraColor:'#2DD4BF'", "eraEmoji:'🌿', eraColor:'#2DD4BF'");
c = c.replace("?? Habitat says...", "🌿 Habitat says...");

// Streak display
c = c.replace("n>=7?' ????':''", "n>=7?' 🔥🔥🔥🔥':''");

// Remaining specific patterns - use generic ?? to specific emoji
// SVG text elements - various game emojis
c = c.replace("<text x='70' y='62'>?</text><text x='140' y='58'>??</text><text x='210' y='63'>??</text>",
  "<text x='70' y='62'>🏃</text><text x='140' y='58'>⬅️</text><text x='210' y='63'>🦘</text>");
c = c.replace("<text x='280' y='59'>??</text><text x='340' y='62'>??</text>",
  "<text x='280' y='59'>💎</text><text x='340' y='62'>🔁</text>");
c = c.replace("<text x='70' y='84'>??</text><text x='330' y='84'>??</text>",
  "<text x='70' y='84'>🏃</text><text x='330' y='84'>🏃</text>");
c = c.replace("<text x='0' y='12' font-size='28' text-anchor='middle'>??</text>",
  "<text x='0' y='12' font-size='28' text-anchor='middle'>🐱</text>");
c = c.replace("<text x='0' y='8' font-size='22' text-anchor='middle'>??</text>",
  "<text x='0' y='8' font-size='22' text-anchor='middle'>🐶</text>");
c = c.replace("<text x='90' y='70' font-size='26' text-anchor='middle'>????</text>",
  "<text x='90' y='70' font-size='26' text-anchor='middle'>🧪🔬</text>");
c = c.replace("<text x='310' y='90' font-size='26' text-anchor='middle'>????</text>",
  "<text x='310' y='90' font-size='26' text-anchor='middle'>💧❄️</text>");
c = c.replace("?? match the flag", "🚩 match the flag");
c = c.replace("<text x='80' y='70' font-size='30' text-anchor='middle'>???</text>",
  "<text x='80' y='70' font-size='30' text-anchor='middle'>🏆</text>");
c = c.replace("<text x='70' y='55' font-size='26' text-anchor='middle' opacity='.8'>??</text>",
  "<text x='70' y='55' font-size='26' text-anchor='middle' opacity='.8'>🚀</text>");
c = c.replace("<text x='330' y='70' font-size='30' text-anchor='middle' opacity='.8'>??</text>",
  "<text x='330' y='70' font-size='30' text-anchor='middle' opacity='.8'>🌍</text>");
c = c.replace("<text x='0' y='4' font-size='12' text-anchor='middle'>??</text>",
  "<text x='0' y='4' font-size='12' text-anchor='middle'>⭐</text>");
c = c.replace("<text x='80' y='68' font-size='28' text-anchor='middle'>??</text>",
  "<text x='80' y='68' font-size='28' text-anchor='middle'>🌿</text>");
c = c.replace("<text x='320' y='60' font-size='26' text-anchor='middle'>??</text>",
  "<text x='320' y='60' font-size='26' text-anchor='middle'>🐾</text>");
c = c.replace("<text x='90' y='70' font-size='24' text-anchor='middle' opacity='.7'>??</text>",
  "<text x='90' y='70' font-size='24' text-anchor='middle' opacity='.7'>🍎</text>");
c = c.replace("<text x='310' y='55' font-size='24' text-anchor='middle' opacity='.7'>??</text>",
  "<text x='310' y='55' font-size='24' text-anchor='middle' opacity='.7'>🍊</text>");
c = c.replace("<text x='300' y='60' font-size='26' text-anchor='middle'>??</text>",
  "<text x='300' y='60' font-size='26' text-anchor='middle'>🎵</text>");
c = c.replace("<text x='80' y='50' font-size='22' text-anchor='middle' opacity='.8'>??</text>",
  "<text x='80' y='50' font-size='22' text-anchor='middle' opacity='.8'>💡</text>");

// Remaining misc patterns
c = c.replace("fb.textContent='??';", "fb.textContent='🎵';");
c = c.replace("' ${BM.streak} in a row!`:'')", "' 🔥 ${BM.streak} in a row!`:'')");
c = c.replace("??????", "🎉🎉🎉🎉🎉🎉");
c = c.replace("?????", "🎉🎉🎉🎉🎉");
c = c.replace("????", "🎉🎉🎉🎉");

// Learning panel emojis
c = c.replace("'<div class='learn-panel'><div class='learn-eyebrow' style='color:#3EC9A7'>?? Echo explains...'", "'<div class='learn-panel'><div class='learn-eyebrow' style='color:#3EC9A7'>🦎 Echo explains...'");
c = c.replace("ctx.fillText('??',tx+T/2,GY-10)", "ctx.fillText('🐢',tx+T/2,GY-10)");
c = c.replace("ctx.fillText('??',ex,ey+6)", "ctx.fillText('🐢',ex,ey+6)");

// Loop picker
c = c.replace("?? loop(${b.n})", "🔁 loop(${b.n})");
c = c.replace("? Echo's hint;", "💡 Echo's hint;");

// Remaining ?? in text
c = c.replace("All 10 levels done! You are a real programmer!", "All 10 levels done! You are a real programmer! 🎉");
c = c.replace("ECHO_LVS[window.ES.lv].hint", "ECHO_LVS[window.ES.lv].hint");
c = c.replace("You cracked the ${p.title} puzzle!", "You cracked the ${p.title} puzzle! ✅");
c = c.replace("'${p.title} puzzle!'", "'${p.title} puzzle! ✅'");

// Generic catch-all for remaining ?? in specific game contexts
// Number bonds final screen
c = c.replace("'??????':'??????'", "'🎉🎉🎉🎉🎉🎉':'😢😢😢😢😢😢'");
c = c.replace("'${NB.lives>0?'??'.re", "'${NB.lives>0?'❤️'.re");

// History done emoji  
c = c.replace("emoji:'???', doneLabel:'History done!'", "emoji:'📜', doneLabel:'History done!'");

// Remaining streak in code
c = c.replace("combo!''", "combo!🔥''");

// Final pass - replace remaining ?? in known contexts
c = c.replace("'??? Chronicle says...'", "'📜 Chronicle says...'");
c = c.replace("sceneEmojis:['??','?','??']", "sceneEmojis:['🚀','⭐','🌍']");

const after = (c.match(/\?\?/g)||[]).length;
fs.writeFileSync('workshops/learning-lab.html', c, 'utf8');
console.log(`learning-lab.html: ${before} -> ${after} remaining ??`);
