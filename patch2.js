const fs = require('fs');
let c = fs.readFileSync('F:/Website/Jvdesign-Website-v2/arcade-game-maker.html', 'utf8');
const orig = c;

function rep(from, to, label) {
  const idx = c.indexOf(from);
  if (idx < 0) { console.error('NOT FOUND: ' + label + ' | ' + from.substring(0,60)); return; }
  c = c.slice(0, idx) + to + c.slice(idx + from.length);
  console.log('OK: ' + label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. COUNTDOWN 3-2-1 OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

// 1a. Add countdown overlay HTML inside game-wrap (after customPuBar closing)
rep(
  '            <!-- Dynamic joystick zone (left 58% of game — touch anywhere to spawn joystick) -->\r\n            <div id="tc-joy-zone" aria-hidden="true"></div>',
  '            <!-- Countdown overlay -->\r\n            <div id="countdownOverlay" style="display:none;position:absolute;inset:0;z-index:950;background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;backdrop-filter:blur(3px);">\r\n                <div id="countdownNum" style="font-family:\'Fredoka\',sans-serif;font-size:6rem;font-weight:900;color:white;text-shadow:0 0 40px rgba(124,58,237,.9),0 4px 0 rgba(0,0,0,.5);transition:transform .15s,opacity .15s;transform:scale(1);opacity:1;pointer-events:none;user-select:none;">3</div>\r\n            </div>\r\n\r\n            <!-- Dynamic joystick zone (left 58% of game — touch anywhere to spawn joystick) -->\r\n            <div id="tc-joy-zone" aria-hidden="true"></div>',
  'Add countdown overlay HTML'
);

// 1b. Add countdown CSS
rep(
  '#countdownOverlay',
  '#countdownOverlay',  // we'll handle via inline style — already done above
  'skip css'
);
// Actually let's not do that, it's already inline. Skip.

// 1c. Add countdown JS function before closeIntro
rep(
  'function closeIntro() {',
  'function _runCountdown(cb) {\r\n    const ov = document.getElementById(\'countdownOverlay\');\r\n    const num = document.getElementById(\'countdownNum\');\r\n    if (!ov || !num || !liveConfig.countdownEnabled) { cb(); return; }\r\n    ov.style.display = \'flex\';\r\n    let n = 3;\r\n    const _step = () => {\r\n        if (n > 0) {\r\n            num.textContent = n;\r\n            num.style.transform = \'scale(1.4)\';\r\n            num.style.opacity = \'1\';\r\n            num.style.color = n===3?\'#f87171\':n===2?\'#fbbf24\':\'#4ade80\';\r\n            num.style.textShadow = n===3?\'0 0 40px rgba(248,113,113,.9),0 4px 0 rgba(0,0,0,.5)\':n===2?\'0 0 40px rgba(251,191,36,.9),0 4px 0 rgba(0,0,0,.5)\':\'0 0 40px rgba(74,222,128,.9),0 4px 0 rgba(0,0,0,.5)\';\r\n            setTimeout(() => { num.style.transform=\'scale(0.7)\'; num.style.opacity=\'0.2\'; }, 600);\r\n            n--;\r\n            setTimeout(_step, 850);\r\n        } else {\r\n            num.textContent = \'GO!\';\r\n            num.style.transform = \'scale(1.6)\';\r\n            num.style.opacity = \'1\';\r\n            num.style.color = \'#a78bfa\';\r\n            num.style.textShadow = \'0 0 60px rgba(167,139,250,.9),0 4px 0 rgba(0,0,0,.5)\';\r\n            setTimeout(() => { num.style.transform=\'scale(0.5)\'; num.style.opacity=\'0\'; }, 500);\r\n            setTimeout(() => { ov.style.display=\'none\'; cb(); }, 700);\r\n        }\r\n    };\r\n    _step();\r\n}\r\n\r\nfunction closeIntro() {',
  'Add _runCountdown JS function'
);

// 1d. Hook countdown into closeIntro
rep(
  'function closeIntro() {\r\n    document.getElementById(\'introOverlay\').classList.remove(\'show\');\r\n    _updateLandscapeNudge(true);\r\n    // Play \'before\' cutscene if configured, then launch game\r\n    _maybeCutscene(\'before\', () => _launchPhaserGame());\r\n}',
  'function closeIntro() {\r\n    document.getElementById(\'introOverlay\').classList.remove(\'show\');\r\n    _updateLandscapeNudge(true);\r\n    // Play \'before\' cutscene if configured, countdown, then launch game\r\n    _maybeCutscene(\'before\', () => _runCountdown(() => _launchPhaserGame()));\r\n}',
  'Hook countdown into closeIntro'
);

// 1e. Add countdown toggle to the Camera extras panel (after Hit Flash)
rep(
  '                <div class="form-group">\r\n                    <label>Slow-Mo on Hit</label>\r\n                    <div class="pill-row" id="pillSlowMo">\r\n                        <button class="pill active" onclick="activePill(\'pillSlowMo\',this);liveConfig.slowMoHit=false;">Off</button>\r\n                        <button class="pill" onclick="activePill(\'pillSlowMo\',this);liveConfig.slowMoHit=true;">On</button>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n\r\n            <!-- ── COMBAT panel ── -->',
  '                <div class="form-group">\r\n                    <label>Slow-Mo on Hit</label>\r\n                    <div class="pill-row" id="pillSlowMo">\r\n                        <button class="pill active" onclick="activePill(\'pillSlowMo\',this);liveConfig.slowMoHit=false;">Off</button>\r\n                        <button class="pill" onclick="activePill(\'pillSlowMo\',this);liveConfig.slowMoHit=true;">On</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Countdown on Start</label>\r\n                    <div class="pill-row" id="pillCountdown">\r\n                        <button class="pill active" onclick="activePill(\'pillCountdown\',this);liveConfig.countdownEnabled=false;">Off</button>\r\n                        <button class="pill" onclick="activePill(\'pillCountdown\',this);liveConfig.countdownEnabled=true;">3-2-1-GO!</button>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n\r\n            <!-- ── COMBAT panel ── -->',
  'Add countdown toggle to Camera panel'
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. ANIMATED BACKGROUND OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

// 2a. Add more bgStyle options to the pillBg
rep(
  '                        <button class="pill" onclick="activePill(\'pillBg\',this);liveConfig.bgStyle=\'neon\';">Neon</button>\r\n                    </div>',
  '                        <button class="pill" onclick="activePill(\'pillBg\',this);liveConfig.bgStyle=\'neon\';">Neon</button>\r\n                        <button class="pill" onclick="activePill(\'pillBg\',this);liveConfig.bgStyle=\'city\';">City</button>\r\n                        <button class="pill" onclick="activePill(\'pillBg\',this);liveConfig.bgStyle=\'sunset\';">Sunset</button>\r\n                        <button class="pill" onclick="activePill(\'pillBg\',this);liveConfig.bgStyle=\'matrix\';">Matrix</button>\r\n                    </div>',
  'Add animated bg options to pillBg'
);

// 2b. Add handling in _drawBg for new bg styles
// There are 2 _drawBg() bodies that handle bgStyle. Update both.
// First occurrence:
rep(
  '            } else if (style === \'neon\') {\r\n                const g = this.add.graphics().setDepth(-1);\r\n                const nc = themeInt(0, 0x7c3aed);\r\n                g.lineStyle(2, nc, 0.18);\r\n                for (let x=0;x<=GW;x+=60) { g.beginPath(); g.moveTo(x,0); g.lineTo(x,GH); g.strokePath(); }\r\n                for (let y=0;y<=GH;y+=40) { g.beginPath(); g.moveTo(0,y); g.lineTo(GW,y); g.strokePath(); }\r\n                g.lineStyle(1, 0x000000, 0.1);\r\n                for (let y=0;y<=GH;y+=4) { g.beginPath(); g.moveTo(0,y); g.lineTo(GW,y); g.strokePath(); }\r\n            }',
  '            } else if (style === \'neon\') {\r\n                const g = this.add.graphics().setDepth(-1);\r\n                const nc = themeInt(0, 0x7c3aed);\r\n                g.lineStyle(2, nc, 0.18);\r\n                for (let x=0;x<=GW;x+=60) { g.beginPath(); g.moveTo(x,0); g.lineTo(x,GH); g.strokePath(); }\r\n                for (let y=0;y<=GH;y+=40) { g.beginPath(); g.moveTo(0,y); g.lineTo(GW,y); g.strokePath(); }\r\n                g.lineStyle(1, 0x000000, 0.1);\r\n                for (let y=0;y<=GH;y+=4) { g.beginPath(); g.moveTo(0,y); g.lineTo(GW,y); g.strokePath(); }\r\n            } else if (style === \'city\') {\r\n                // Silhouette city skyline\r\n                const g = this.add.graphics().setDepth(-1);\r\n                g.fillStyle(0x0f172a, 1);\r\n                const bldgs = [[0,80,60,GH],[70,100,40,GH],[120,60,50,GH],[180,90,35,GH],[225,50,55,GH],[290,75,45,GH],[345,55,65,GH],[420,85,40,GH],[470,65,50,GH],[530,80,40,GH],[580,45,60,GH]];\r\n                bldgs.forEach(([x,h,w]) => g.fillRect(x, GH-h, w, h));\r\n                g.fillStyle(0xfbbf24, 0.5);\r\n                // Windows\r\n                for (let bx=5;bx<GW;bx+=15) for (let by=GH-90;by<GH-10;by+=18) { if(Math.random()>0.4) g.fillRect(bx,by,6,8); }\r\n            } else if (style === \'sunset\') {\r\n                // Gradient sunset sky\r\n                const g = this.add.graphics().setDepth(-1);\r\n                const steps = 20;\r\n                for (let i=0;i<steps;i++) {\r\n                    const t = i/steps;\r\n                    const r = Math.round(20 + t*220), gr = Math.round(10 + t*80), bl = Math.round(60 - t*50);\r\n                    const col = (r<<16)|(gr<<8)|bl;\r\n                    g.fillStyle(col, 1);\r\n                    g.fillRect(0, (i/steps)*GH, GW, GH/steps+2);\r\n                }\r\n                // Sun circle\r\n                g.fillStyle(0xfbbf24, 0.9);\r\n                g.fillCircle(GW*0.72, GH*0.38, 28);\r\n                g.fillStyle(0xf97316, 0.3);\r\n                g.fillCircle(GW*0.72, GH*0.38, 44);\r\n            } else if (style === \'matrix\') {\r\n                // Dark green grid with glowing lines\r\n                const g = this.add.graphics().setDepth(-1);\r\n                g.lineStyle(1, 0x00ff41, 0.12);\r\n                for (let x=0;x<=GW;x+=20) { g.beginPath(); g.moveTo(x,0); g.lineTo(x,GH); g.strokePath(); }\r\n                for (let y=0;y<=GH;y+=20) { g.beginPath(); g.moveTo(0,y); g.lineTo(GW,y); g.strokePath(); }\r\n                g.lineStyle(1, 0x00ff41, 0.35);\r\n                for (let x=0;x<=GW;x+=100) { g.beginPath(); g.moveTo(x,0); g.lineTo(x,GH); g.strokePath(); }\r\n                for (let y=0;y<=GH;y+=100) { g.beginPath(); g.moveTo(0,y); g.lineTo(GW,y); g.strokePath(); }\r\n            }',
  'Add city/sunset/matrix bg styles (first occurrence)'
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. COLOUR PALETTE PRESETS
// ═══════════════════════════════════════════════════════════════════════════

// 3a. Add colour presets section after the "Colour Theme" sec-label, before the swatches
rep(
  '                <div class="form-group">\r\n                    <label>Game Colours <span style="color:var(--muted);font-weight:400;">— 4 slots used throughout all scenes</span></label>',
  '                <div class="form-group" style="margin-bottom:4px;">\r\n                    <label>Colour Presets <span style="color:var(--muted);font-weight:400;">— pick a palette to fill all 4 slots at once</span></label>\r\n                    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;">\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#7c3aed\',\'#4ade80\',\'#1e293b\',\'#f59e0b\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#7c3aed;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#4ade80;display:inline-block;"></span></span>Neon</button>\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#ef4444\',\'#f97316\',\'#1c1917\',\'#fbbf24\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#ef4444;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#f97316;display:inline-block;"></span></span>Fire</button>\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#0ea5e9\',\'#06b6d4\',\'#0f172a\',\'#4ade80\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#0ea5e9;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#06b6d4;display:inline-block;"></span></span>Ocean</button>\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#f0abfc\',\'#86efac\',\'#dbeafe\',\'#fde68a\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#f0abfc;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#86efac;display:inline-block;"></span></span>Pastel</button>\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#22c55e\',\'#15803d\',\'#0a0a12\',\'#86efac\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#22c55e;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#15803d;display:inline-block;"></span></span>Matrix</button>\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#f472b6\',\'#c084fc\',\'#1e1b4b\',\'#fbbf24\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#f472b6;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#c084fc;display:inline-block;"></span></span>Candy</button>\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#fbbf24\',\'#f97316\',\'#1c1917\',\'#fff7ed\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#fbbf24;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#f97316;display:inline-block;"></span></span>Sunset</button>\r\n                        <button class="btn-sm" style="padding:4px 9px;font-size:.64rem;display:flex;align-items:center;gap:4px;" onclick="applyColourPreset([\'#34d399\',\'#6ee7b7\',\'#064e3b\',\'#d1fae5\'])"><span style="display:flex;gap:2px;"><span style="width:8px;height:8px;border-radius:2px;background:#34d399;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:2px;background:#6ee7b7;display:inline-block;"></span></span>Forest</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Game Colours <span style="color:var(--muted);font-weight:400;">— 4 slots used throughout all scenes</span></label>',
  'Add colour preset buttons'
);

// 3b. Add applyColourPreset JS function (before applyPalette)
rep(
  'function applyPalette(d) {',
  'function applyColourPreset(cols) {\r\n    if (!Array.isArray(cols) || cols.length < 4) return;\r\n    cols.forEach((hex, i) => {\r\n        const inp = document.getElementById(\'themeCol\'+i);\r\n        const swatch = document.getElementById(\'themeSwatchPreview\'+i);\r\n        if (inp) inp.value = hex;\r\n        if (swatch) swatch.style.background = hex;\r\n        gameTheme.cols[i] = hex;\r\n    });\r\n    showToast(\'Palette applied — hit ▶ Run to see it!\');\r\n}\r\n\r\nfunction applyPalette(d) {',
  'Add applyColourPreset function'
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. CODE SNIPPETS — Quick Insert in Code tab
// ═══════════════════════════════════════════════════════════════════════════

// 4a. Add Quick Insert section above the code editor
rep(
  '            <textarea id="customCodeEditor" class="code-editor"',
  '            <!-- ── Quick Insert Snippets ── -->\r\n            <div style="margin-bottom:6px;">\r\n                <div style="font-size:.62rem;color:var(--muted);margin-bottom:4px;">Quick Insert — click to add snippet to editor:</div>\r\n                <div style="display:flex;flex-wrap:wrap;gap:4px;">\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'score\')">⭐ Award Score</button>\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'speed\')">⚡ Change Speed</button>\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'message\')">💬 Show Message</button>\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'flash\')">✨ Screen Flash</button>\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'timer\')">⏱ Add Timer</button>\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'spawn\')">👾 Spawn Object</button>\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'shake\')">📳 Screen Shake</button>\r\n                    <button class="btn-sm" style="font-size:.6rem;padding:3px 7px;" onclick="_insertSnippet(\'sound\')">🔊 Play Sound</button>\r\n                </div>\r\n            </div>\r\n            <textarea id="customCodeEditor" class="code-editor"',
  'Add code snippets quick insert UI'
);

// 4b. Add _insertSnippet JS function
rep(
  'function _clearUserCode() {',
  'const _CODE_SNIPPETS = {\r\n    score:   \'// Award 10 points\\nscene.score = (scene.score || 0) + 10;\\nif (scene.scoreText) scene.scoreText.setText(\'Score: \' + scene.score);\\nGameAudio.play(\'score\');\',\r\n    speed:   \'// Change player speed (call from onUpdate)\\nif (scene.score > 100) liveConfig.speed = 350;\',\r\n    message: \'// Show a toast message\\nshowToast(\'Your message here!\');\',\r\n    flash:   \'// Flash the screen white\\nif (scene.cameras && scene.cameras.main) {\\n  scene.cameras.main.flash(300, 255, 255, 255, true);\\n}\',\r\n    timer:   \'// Add a countdown timer (call from onCreate)\\nthis._countdownSecs = 30;\\nthis._timerText = this.add.text(320, 20, \'Time: 30\', {fontSize:\'18px\',color:\'#fff\'}).setOrigin(0.5);\\nthis.time.addEvent({delay:1000, loop:true, callback:() => {\\n  this._countdownSecs--;\\n  if (this._timerText) this._timerText.setText(\'Time: \' + this._countdownSecs);\\n  if (this._countdownSecs <= 0) showGameOver(scene.score);\\n}});\',\r\n    spawn:   \'// Spawn an object at a random position (call from onCreate)\\nconst obj = this.physics.add.image(\\n  Phaser.Math.Between(50, 590), // x\\n  Phaser.Math.Between(50, 350), // y\\n  \'player\'                      // texture key\\n);\\nobj.setVelocity(Phaser.Math.Between(-100,100), Phaser.Math.Between(-100,100));\',\r\n    shake:   \'// Shake the camera\\nif (scene.cameras && scene.cameras.main) {\\n  scene.cameras.main.shake(250, 0.01);\\n}\',\r\n    sound:   \'// Play a sound effect\\nGameAudio.play(\'score\');  // options: shoot, jump, hit, score, levelup, death, powerup, victory\'\r\n};\r\nfunction _insertSnippet(key) {\r\n    const ta = document.getElementById(\'customCodeEditor\');\r\n    if (!ta) return;\r\n    const snip = _CODE_SNIPPETS[key] || \'\';\r\n    if (!snip) return;\r\n    const existing = ta.value.trim();\r\n    // Wrap in onCreate if no function context yet\r\n    const hasOnCreate = existing.includes(\'onCreate\') || existing.includes(\'onUpdate\');\r\n    if (!hasOnCreate && existing === \'\') {\r\n        ta.value = \'function onCreate(scene) {\\n  \' + snip.replace(/\\n/g, \'\\n  \') + \'\\n}\';\r\n    } else {\r\n        ta.value = existing + (existing ? \'\\n\\n\' : \'\') + \'// --- \' + key + \' snippet ---\\n\' + snip;\r\n    }\r\n    ta.focus();\r\n    ta.setSelectionRange(ta.value.length, ta.value.length);\r\n    showToast(\'Snippet inserted!\');\r\n}\r\n\r\nfunction _clearUserCode() {',
  'Add _insertSnippet function'
);

// ═══════════════════════════════════════════════════════════════════════════
// 5. CONFIG UNDO / REDO
// ═══════════════════════════════════════════════════════════════════════════

// 5a. Add the history data structures after liveConfig definition
rep(
  'let _sessionKills = 0;',
  '// Config history for undo/redo\r\nlet _lcHistory = [];\r\nlet _lcHistoryIdx = -1;\r\nconst _LC_HISTORY_MAX = 20;\r\n\r\nfunction _pushLcHistory() {\r\n    const snap = JSON.stringify(liveConfig);\r\n    // Don\'t push if same as current top\r\n    if (_lcHistory.length && _lcHistory[_lcHistoryIdx] === snap) return;\r\n    // Truncate forward history\r\n    _lcHistory = _lcHistory.slice(0, _lcHistoryIdx + 1);\r\n    _lcHistory.push(snap);\r\n    if (_lcHistory.length > _LC_HISTORY_MAX) _lcHistory.shift();\r\n    _lcHistoryIdx = _lcHistory.length - 1;\r\n    _updateUndoBtn();\r\n}\r\n\r\nfunction _undoLiveConfig() {\r\n    if (_lcHistoryIdx <= 0) { showToast(\'Nothing to undo\'); return; }\r\n    _lcHistoryIdx--;\r\n    const snap = _lcHistory[_lcHistoryIdx];\r\n    if (!snap) return;\r\n    try {\r\n        const parsed = JSON.parse(snap);\r\n        Object.assign(liveConfig, parsed);\r\n        _syncCustomTabUI(liveConfig);\r\n        // Sync Build tab sliders\r\n        [\'playerSpeed\',\'gravityY\',\'jumpForce\'].forEach(id => {\r\n            const el = document.getElementById(id);\r\n            const key = id===\'playerSpeed\'?\'speed\':id===\'gravityY\'?\'gravity\':\'jumpForce\';\r\n            if (el) el.value = liveConfig[key];\r\n        });\r\n        [\'playerSpeedRange\',\'gravityRange\',\'jumpForceRange\'].forEach((id,i)=>{\r\n            const el=document.getElementById(id); if(!el) return;\r\n            const keys=[\'speed\',\'gravity\',\'jumpForce\'];\r\n            el.value = liveConfig[keys[i]];\r\n            const nxt=el.nextElementSibling; if(nxt) nxt.textContent=liveConfig[keys[i]];\r\n        });\r\n        showToast(\'Undid config change\');\r\n    } catch(e) {}\r\n    _updateUndoBtn();\r\n}\r\n\r\nfunction _redoLiveConfig() {\r\n    if (_lcHistoryIdx >= _lcHistory.length - 1) { showToast(\'Nothing to redo\'); return; }\r\n    _lcHistoryIdx++;\r\n    const snap = _lcHistory[_lcHistoryIdx];\r\n    if (!snap) return;\r\n    try {\r\n        const parsed = JSON.parse(snap);\r\n        Object.assign(liveConfig, parsed);\r\n        _syncCustomTabUI(liveConfig);\r\n        showToast(\'Redid config change\');\r\n    } catch(e) {}\r\n    _updateUndoBtn();\r\n}\r\n\r\nfunction _updateUndoBtn() {\r\n    const btn = document.getElementById(\'configUndoBtn\');\r\n    if (btn) btn.disabled = _lcHistoryIdx <= 0;\r\n    const rbtn = document.getElementById(\'configRedoBtn\');\r\n    if (rbtn) rbtn.disabled = _lcHistoryIdx >= _lcHistory.length - 1;\r\n}\r\n\r\nlet _sessionKills = 0;',
  'Add config undo/redo system'
);

// 5b. Add undo/redo buttons to the Build tab (near Run Game button)
rep(
  '            <button class="btn-run pulsing" id="runGameBtn" onclick="compileAndBootEngine()">▶ Run Game <kbd class="run-kbd">[R]</kbd></button>',
  '            <div style="display:flex;gap:5px;margin-bottom:4px;">\r\n                <button id="configUndoBtn" class="btn-sm" disabled onclick="_undoLiveConfig()" title="Undo last settings change (Ctrl+Shift+Z)" style="flex:1;font-size:.65rem;">↩ Undo</button>\r\n                <button id="configRedoBtn" class="btn-sm" disabled onclick="_redoLiveConfig()" title="Redo last settings change" style="flex:1;font-size:.65rem;">↪ Redo</button>\r\n            </div>\r\n            <button class="btn-run pulsing" id="runGameBtn" onclick="compileAndBootEngine()">▶ Run Game <kbd class="run-kbd">[R]</kbd></button>',
  'Add undo/redo buttons to Build tab'
);

// 5c. Push history on applyDiffPreset
rep(
  'function applyDiffPreset(preset) {\r\n    const P = {',
  'function applyDiffPreset(preset) {\r\n    _pushLcHistory();\r\n    const P = {',
  'Push history in applyDiffPreset'
);

// 5d. Hook Ctrl+Shift+Z for config undo (alongside existing Ctrl+Z for tiles)
rep(
  'if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()===\'z\' && !e.shiftKey) { e.preventDefault(); tmUndo(); }',
  'if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()===\'z\' && !e.shiftKey) { e.preventDefault(); tmUndo(); }\r\n        if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()===\'u\') { e.preventDefault(); _undoLiveConfig(); }\r\n        if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()===\'i\') { e.preventDefault(); _redoLiveConfig(); }',
  'Add keyboard shortcuts for config undo/redo'
);

// 5e. Push history when any slider/pill in the Extras tab changes — hook into applyColourPreset and applySoundPack
rep(
  'function applyColourPreset(cols) {',
  'function applyColourPreset(cols) {\r\n    _pushLcHistory();',
  'Push history in applyColourPreset'
);
rep(
  'function applySoundPack(pack) {',
  'function applySoundPack(pack) {\r\n    _pushLcHistory();',
  'Push history in applySoundPack'
);

// Also hook on blueprint slider changes — wrap liveConfig.speed changes etc with history push
// Actually, sliders fire hundreds of times, better to debounce. Let's add a debounced push.
// Add debounced history saver:
rep(
  'function _pushLcHistory() {',
  'let _lcHistoryDebounce = null;\r\nfunction _debouncedLcPush() {\r\n    clearTimeout(_lcHistoryDebounce);\r\n    _lcHistoryDebounce = setTimeout(_pushLcHistory, 600);\r\n}\r\n\r\nfunction _pushLcHistory() {',
  'Add debounced history push helper'
);

// ═══════════════════════════════════════════════════════════════════════════
// 6. INITIALIZE HISTORY ON PAGE LOAD
// ═══════════════════════════════════════════════════════════════════════════
rep(
  '_checkFirstVisit(); // shows tutorial on first visit, skips if already seen',
  '_checkFirstVisit(); // shows tutorial on first visit, skips if already seen\r\n    setTimeout(() => { _pushLcHistory(); }, 500); // seed the undo history with initial state',
  'Seed undo history on page load'
);

// ═══════════════════════════════════════════════════════════════════════════
// WRITE
// ═══════════════════════════════════════════════════════════════════════════
if (c === orig) {
  console.error('NO CHANGES MADE');
} else {
  fs.writeFileSync('F:/Website/Jvdesign-Website-v2/arcade-game-maker.html', c, 'utf8');
  console.log('Written. Size delta:', c.length - orig.length);
}
