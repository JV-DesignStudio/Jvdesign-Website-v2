const fs = require('fs');
let c = fs.readFileSync('arcade-game-maker.html', 'utf8');

// Find the _CODE_SNIPPETS block by locating start and end markers
const START = 'const _CODE_SNIPPETS = {';
const END_AFTER = '};\nfunction _insertSnippet';

const si = c.indexOf(START);
const ei = c.indexOf(END_AFTER, si);

if (si === -1 || ei === -1) {
    // Try CRLF variant
    const END_AFTER2 = '};\r\nfunction _insertSnippet';
    const ei2 = c.indexOf(END_AFTER2, si);
    if (si === -1 || ei2 === -1) {
        console.log('BLOCK NOT FOUND - si:', si, 'ei:', ei);
        process.exit(1);
    }
    console.log('Found with CRLF at', si, ei2);
}

// Find the actual end of the block (the closing }; line)
let blockEnd = c.indexOf('\n};', si);
// Make sure we get the right one (the closing of _CODE_SNIPPETS, not something inside)
// The block ends with the last snippet followed by \n};
// Let's find }; followed by \nfunction _insertSnippet
const endPattern1 = '};\nfunction _insertSnippet';
const endPattern2 = '};\r\nfunction _insertSnippet';
let endIdx = c.indexOf(endPattern1, si);
let endLen = endPattern1.length;
if (endIdx === -1) {
    endIdx = c.indexOf(endPattern2, si);
    endLen = endPattern2.length;
}

if (si === -1 || endIdx === -1) {
    console.log('NOT FOUND. si=', si, 'endIdx=', endIdx);
    process.exit(1);
}

console.log('Block start:', si, 'Block end:', endIdx);

// The new block — use \n inside strings (NOT template literals, to avoid nesting issues)
// Use single-quoted strings with \n escapes
const newBlock = "const _CODE_SNIPPETS = {\n" +
"    score:   '// Award points\\nscene.score = (scene.score||0) + 10;\\nif(scene.scoreText) scene.scoreText.setText(\\'Score: \\'+scene.score);\\nGameAudio.play(\\'score\\');',\n" +
"    speed:   '// Speed up when score passes 100 (put in onUpdate)\\nif(scene.score > 100) liveConfig.speed = 350;',\n" +
"    message: '// Show a toast popup\\nshowToast(\\'Great job!\\');',\n" +
"    flash:   '// Flash screen white\\nif(scene.cameras && scene.cameras.main){\\n  scene.cameras.main.flash(300, 255, 255, 255, true);\\n}',\n" +
"    timer:   '// Countdown timer - paste in onCreate\\nthis._cd = 30;\\nthis._cdTxt = this.add.text(320,20,\\'Time: 30\\',{fontSize:\\'18px\\',color:\\'#fff\\'}).setOrigin(0.5);\\nthis.time.addEvent({delay:1000,loop:true,callback:()=>{\\n  this._cd--;\\n  if(this._cdTxt) this._cdTxt.setText(\\'Time: \\'+this._cd);\\n  if(this._cd<=0) showGameOver(this.score||0);\\n}});',\n" +
"    spawn:   '// Spawn a random object - paste in onCreate\\nconst obj=this.physics.add.image(\\n  Phaser.Math.Between(50,590),\\n  Phaser.Math.Between(50,350),\\n  \\'player\\'\\n);\\nobj.setVelocity(Phaser.Math.Between(-100,100),Phaser.Math.Between(-100,100));',\n" +
"    shake:   '// Shake the camera\\nif(scene.cameras && scene.cameras.main){\\n  scene.cameras.main.shake(250,0.01);\\n}',\n" +
"    sound:   '// Play a sound effect\\nGameAudio.play(\\'score\\'); // shoot, jump, hit, score, levelup, death, powerup, victory'\n" +
"}";

// Replace just the block content (keep ;\nfunction _insertSnippet intact)
// endIdx points to the '}' of '};' at the end of the old block
// newBlock already ends with '}', so skip the old '}' (+1) and keep ';\r\nfunction...'
c = c.slice(0, si) + newBlock + c.slice(endIdx + 1);

fs.writeFileSync('arcade-game-maker.html', c);
console.log('Written. Verifying...');

// Verify with node --check
const { execSync } = require('child_process');
// Extract script block and check
const c2 = fs.readFileSync('arcade-game-maker.html', 'utf8');
let idx = 0, scriptNum = 0, mainSrc = '';
while (true) {
    const start = c2.indexOf('<script', idx);
    if (start === -1) break;
    const tagEnd = c2.indexOf('>', start);
    const end = c2.indexOf('</script>', tagEnd);
    if (end === -1) break;
    const src = c2.slice(tagEnd+1, end);
    if (src.trim() && !c2.slice(start, tagEnd+1).includes('src=')) {
        scriptNum++;
        if (scriptNum === 2) { mainSrc = src; break; }
    }
    idx = end + 9;
}
fs.writeFileSync('_tmp_check.js', mainSrc);
try {
    execSync('node --check _tmp_check.js', { encoding: 'utf8' });
    console.log('SYNTAX OK');
} catch(e) {
    console.log('SYNTAX ERROR:', e.stderr || e.message);
}
try { fs.unlinkSync('_tmp_check.js'); } catch(e) {}
