const fs = require('fs');
let c = fs.readFileSync('F:/Website/Jvdesign-Website-v2/arcade-game-maker.html', 'utf8');
const orig = c;
let ok = 0, fail = 0;

function rep(from, to, label) {
  const idx = c.indexOf(from);
  if (idx < 0) { console.error('NOT FOUND: ' + label + '\n  >> ' + from.substring(0, 70)); fail++; return; }
  c = c.slice(0, idx) + to + c.slice(idx + from.length);
  console.log('OK: ' + label); ok++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. FONTS — load extra Google Fonts + font picker in Theme panel
// ═══════════════════════════════════════════════════════════════════════════

// 1a. Add Orbitron, Bangers, Press Start 2P to the fonts link
rep(
  'family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">',
  'family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">\r\n<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Bangers&family=Press+Start+2P&family=Nunito:wght@700;900&display=swap" rel="stylesheet">',
  'Load game fonts'
);

// 1b. Add game font field to liveConfig
rep(
  '    soundPack:\'chiptune\',',
  '    soundPack:\'chiptune\',\r\n    gameFont:\'JetBrains\',',
  'Add gameFont to liveConfig'
);

// 1c. Make _makeScoreText use liveConfig.gameFont
rep(
  '_makeScoreText() {\r\n            return this.add.text(12,12,\'Score: 0\',{fontSize:\'15px\',fill:themeHex(0,\'#a78bfa\'),fontFamily:"\'JetBrains Mono\',monospace",fontStyle:\'bold\'}).setDepth(10);\r\n        }',
  '_makeScoreText() {\r\n            const _fontFamilyMap = {\'JetBrains\':"\'JetBrains Mono\',monospace",\'Fredoka\':"\'Fredoka\',sans-serif",\'Orbitron\':"\'Orbitron\',sans-serif",\'Bangers\':"\'Bangers\',cursive",\'PressStart\':"\'Press Start 2P\',monospace",\'Nunito\':"\'Nunito\',sans-serif"};\r\n            const _ff = _fontFamilyMap[liveConfig.gameFont] || "\'JetBrains Mono\',monospace";\r\n            return this.add.text(12,12,\'Score: 0\',{fontSize:\'15px\',fill:themeHex(0,\'#a78bfa\'),fontFamily:_ff,fontStyle:\'bold\'}).setDepth(10);\r\n        }',
  'Make scoreText use liveConfig.gameFont'
);

// 1d. Add font picker to Theme extras panel (before Emoji Theme section)
rep(
  '                <span class="sec-label" style="margin-top:4px;">🎨 Emoji Theme</span>',
  '                <span class="sec-label" style="margin-top:4px;">🔤 Game Font</span>\r\n                <div class="form-group">\r\n                    <div class="pill-row" id="pillGameFont" style="flex-wrap:wrap;">\r\n                        <button class="pill active" onclick="activePill(\'pillGameFont\',this);liveConfig.gameFont=\'JetBrains\';" style="font-family:\'JetBrains Mono\',monospace;">Mono</button>\r\n                        <button class="pill" onclick="activePill(\'pillGameFont\',this);liveConfig.gameFont=\'Fredoka\';" style="font-family:\'Fredoka\',sans-serif;">Fredoka</button>\r\n                        <button class="pill" onclick="activePill(\'pillGameFont\',this);liveConfig.gameFont=\'Orbitron\';" style="font-family:\'Orbitron\',sans-serif;font-size:.6rem;">Orbitron</button>\r\n                        <button class="pill" onclick="activePill(\'pillGameFont\',this);liveConfig.gameFont=\'Bangers\';" style="font-family:\'Bangers\',cursive;">Bangers</button>\r\n                        <button class="pill" onclick="activePill(\'pillGameFont\',this);liveConfig.gameFont=\'PressStart\';" style="font-family:\'Press Start 2P\',monospace;font-size:.45rem;">8-Bit</button>\r\n                        <button class="pill" onclick="activePill(\'pillGameFont\',this);liveConfig.gameFont=\'Nunito\';" style="font-family:\'Nunito\',sans-serif;">Nunito</button>\r\n                    </div>\r\n                </div>\r\n                <span class="sec-label" style="margin-top:4px;">🎨 Emoji Theme</span>',
  'Add font picker to Theme panel'
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. PAUSE MENU
// ═══════════════════════════════════════════════════════════════════════════

// 2a. Add pause menu HTML inside game-wrap (after countdown overlay)
rep(
  '            <!-- Dynamic joystick zone (left 58% of game — touch anywhere to spawn joystick) -->',
  '            <!-- ── PAUSE MENU OVERLAY ── -->\r\n            <div id="pauseMenu" style="display:none;position:absolute;inset:0;z-index:940;background:rgba(0,0,0,.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;">\r\n                <div style="background:var(--panel2);border:1px solid rgba(124,58,237,.35);border-radius:18px;padding:22px 28px;width:min(280px,90%);display:flex;flex-direction:column;gap:12px;align-items:center;box-shadow:0 8px 48px rgba(0,0,0,.6);">\r\n                    <div style="font-size:1.8rem;">⏸</div>\r\n                    <div id="pauseMenuTitle" style="font-family:\'Fredoka\',sans-serif;font-size:1.1rem;font-weight:800;color:white;text-align:center;">PAUSED</div>\r\n                    <button class="btn-run" style="width:100%;font-size:.85rem;" onclick="resumeGame()">▶ Resume</button>\r\n                    <button class="btn-run" style="width:100%;font-size:.85rem;background:#1e293b;box-shadow:0 3px 0 #0f172a;" onclick="closePauseAndRestart()">↺ Restart</button>\r\n                    <div style="width:100%;border-top:1px solid var(--border);padding-top:8px;">\r\n                        <div style="font-size:.65rem;color:var(--muted);margin-bottom:5px;text-align:center;">Volume</div>\r\n                        <input type="range" min="0" max="100" id="pauseVolumeSlider" style="width:100%;" value="50" oninput="GameAudio.volume=this.value/100;document.getElementById(\'volumeSlider\').value=this.value;document.querySelector(\'#volumeSlider ~ .range-val\').textContent=this.value+\'%\';">\r\n                    </div>\r\n                    <button class="btn-sm" style="width:100%;color:#f87171;border-color:rgba(248,113,113,.3);background:rgba(248,113,113,.08);font-size:.75rem;" onclick="quitGame()">✕ Quit to Editor</button>\r\n                </div>\r\n            </div>\r\n\r\n            <!-- Dynamic joystick zone (left 58% of game — touch anywhere to spawn joystick) -->',
  'Add pause menu HTML'
);

// 2b. Add pause JS functions (before compileAndBootEngine)
rep(
  'function compileAndBootEngine() {',
  'let _gamePaused = false;\r\n\r\nfunction pauseGame() {\r\n    if (!currentPhaserGame || _gamePaused) return;\r\n    _gamePaused = true;\r\n    try {\r\n        currentPhaserGame.scene.getScenes(true).forEach(s => s.scene.pause());\r\n        GameAudio.stopMusic();\r\n    } catch(e) {}\r\n    const pm = document.getElementById(\'pauseMenu\');\r\n    if (pm) {\r\n        pm.style.display = \'flex\';\r\n        // Sync volume slider\r\n        const vol = document.getElementById(\'pauseVolumeSlider\');\r\n        const main = document.getElementById(\'volumeSlider\');\r\n        if (vol && main) vol.value = main.value;\r\n        // Show game title\r\n        const tEl = document.getElementById(\'pauseMenuTitle\');\r\n        const gTitle = document.getElementById(\'gameTitle\');\r\n        if (tEl && gTitle) tEl.textContent = (gTitle.value || \'PAUSED\').toUpperCase();\r\n    }\r\n}\r\n\r\nfunction resumeGame() {\r\n    if (!currentPhaserGame || !_gamePaused) return;\r\n    _gamePaused = false;\r\n    const pm = document.getElementById(\'pauseMenu\');\r\n    if (pm) pm.style.display = \'none\';\r\n    try {\r\n        currentPhaserGame.scene.getScenes(false).forEach(s => {\r\n            if (s.scene.isPaused()) s.scene.resume();\r\n        });\r\n        if (document.getElementById(\'musicToggle\').checked) {\r\n            GameAudio.startMusic(document.getElementById(\'musicStyle\').value);\r\n        }\r\n    } catch(e) {}\r\n}\r\n\r\nfunction closePauseAndRestart() {\r\n    _gamePaused = false;\r\n    const pm = document.getElementById(\'pauseMenu\');\r\n    if (pm) pm.style.display = \'none\';\r\n    compileAndBootEngine();\r\n}\r\n\r\nfunction quitGame() {\r\n    _gamePaused = false;\r\n    const pm = document.getElementById(\'pauseMenu\');\r\n    if (pm) pm.style.display = \'none\';\r\n    if (currentPhaserGame) { try { currentPhaserGame.destroy(true); } catch(e) {} currentPhaserGame = null; }\r\n    const gw = document.getElementById(\'gameWrap\');\r\n    if (gw) gw.classList.add(\'idle\');\r\n    const ph = document.getElementById(\'idle-placeholder\');\r\n    if (ph) ph.style.display = \'\';\r\n    const rb = document.getElementById(\'runGameBtn\');\r\n    if (rb) { rb.classList.add(\'pulsing\'); rb.innerHTML = \'▶ Run Game <kbd class="run-kbd">[R]</kbd>\'; }\r\n    const eb = document.getElementById(\'engine-branding\');\r\n    if (eb) { eb.textContent = \'JV Engine · Ready\'; eb.classList.remove(\'playing\'); }\r\n    showToast(\'Game stopped\');\r\n}\r\n\r\nfunction togglePause() {\r\n    if (!currentPhaserGame) return;\r\n    const goVisible = document.getElementById(\'goOverlay\')?.classList.contains(\'show\');\r\n    const introVisible = document.getElementById(\'introOverlay\')?.classList.contains(\'show\');\r\n    if (goVisible || introVisible) return;\r\n    _gamePaused ? resumeGame() : pauseGame();\r\n}\r\n\r\nfunction compileAndBootEngine() {',
  'Add pause/resume/quit JS functions'
);

// 2c. Fix P key handler to toggle pause when game running
rep(
  'if ((e.key === \'p\' || e.key === \'P\') && !currentPhaserGame) takeScreenshot();',
  'if (e.key === \'p\' || e.key === \'P\') { if (currentPhaserGame) { togglePause(); } else { takeScreenshot(); } }',
  'Fix P key to toggle pause'
);

// 2d. Reset _gamePaused on each new boot
rep(
  '    _runTransitionOut(()=>_showTitleScreen(data));\r\n    \r\n}',
  '    _gamePaused = false;\r\n    const _pmReset = document.getElementById(\'pauseMenu\'); if (_pmReset) _pmReset.style.display=\'none\';\r\n    _runTransitionOut(()=>_showTitleScreen(data));\r\n    \r\n}',
  'Reset pause on new boot'
);

// 2e. Add Pause button to viewport bar
rep(
  '            <button class="vp-btn" onclick="takeScreenshot()" title="Screenshot (P)">📷 Shot</button>',
  '            <button class="vp-btn" onclick="togglePause()" id="pauseBtn" title="Pause game (P)">⏸ Pause</button>\r\n            <button class="vp-btn" onclick="takeScreenshot()" title="Screenshot">📷 Shot</button>',
  'Add Pause button to viewport'
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. LIVE INSPECTOR (FPS + player debug overlay)
// ═══════════════════════════════════════════════════════════════════════════

// 3a. Add inspector HTML inside game-wrap (after pause menu)
rep(
  '            <!-- Dynamic joystick zone',
  '            <!-- ── LIVE INSPECTOR ── -->\r\n            <div id="liveInspector" style="display:none;position:absolute;top:8px;right:8px;z-index:930;background:rgba(0,0,0,.78);border:1px solid rgba(0,212,170,.25);border-radius:8px;padding:7px 10px;font-family:\'JetBrains Mono\',monospace;font-size:.6rem;color:#4ade80;line-height:1.8;min-width:130px;pointer-events:none;">\r\n                <div id="inspFps" style="color:#fbbf24;font-weight:700;">FPS: --</div>\r\n                <div id="inspScore">Score: --</div>\r\n                <div id="inspLives">Lives: --</div>\r\n                <div id="inspPos">Pos: --</div>\r\n                <div id="inspVel">Vel: --</div>\r\n                <div id="inspScene" style="color:var(--muted);">Scene: --</div>\r\n            </div>\r\n\r\n            <!-- Dynamic joystick zone',
  'Add live inspector HTML'
);

// 3b. Add inspector toggle button to viewport bar
rep(
  '            <button class="vp-btn" onclick="togglePause()" id="pauseBtn"',
  '            <button class="vp-btn" onclick="toggleInspector()" id="inspectorBtn" title="Live debug inspector">🔍 Info</button>\r\n            <button class="vp-btn" onclick="togglePause()" id="pauseBtn"',
  'Add inspector toggle button'
);

// 3c. Add inspector JS
rep(
  'let _gamePaused = false;',
  '// ── LIVE INSPECTOR ────────────────────────────────────────────────────────────\r\nlet _inspectorOn = false;\r\nlet _inspectorInterval = null;\r\n\r\nfunction toggleInspector() {\r\n    _inspectorOn = !_inspectorOn;\r\n    const el = document.getElementById(\'liveInspector\');\r\n    const btn = document.getElementById(\'inspectorBtn\');\r\n    if (el) el.style.display = _inspectorOn ? \'block\' : \'none\';\r\n    if (btn) btn.style.background = _inspectorOn ? \'rgba(74,222,128,.2)\' : \'\';\r\n    if (_inspectorOn) {\r\n        clearInterval(_inspectorInterval);\r\n        _inspectorInterval = setInterval(_updateInspector, 200);\r\n    } else {\r\n        clearInterval(_inspectorInterval);\r\n    }\r\n}\r\n\r\nfunction _updateInspector() {\r\n    if (!_inspectorOn || !currentPhaserGame) return;\r\n    try {\r\n        const fps = Math.round(currentPhaserGame.loop.actualFps || 0);\r\n        const scenes = currentPhaserGame.scene.getScenes(true);\r\n        const s = scenes[0];\r\n        const score = s ? (s.score !== undefined ? s.score : (s.pScore || 0)) : 0;\r\n        const lives = gameState.lives !== undefined ? gameState.lives : \'?\';\r\n        let px = \'--\', py = \'--\', vx = \'--\', vy = \'--\';\r\n        if (s && s.actor && s.actor.body) {\r\n            px = Math.round(s.actor.x); py = Math.round(s.actor.y);\r\n            vx = Math.round(s.actor.body.velocity.x); vy = Math.round(s.actor.body.velocity.y);\r\n        } else if (s && s.player && s.player.body) {\r\n            px = Math.round(s.player.x); py = Math.round(s.player.y);\r\n            vx = Math.round(s.player.body.velocity.x); vy = Math.round(s.player.body.velocity.y);\r\n        }\r\n        const sceneName = s ? (s.constructor.name || \'Scene\') : \'--\';\r\n        const fpsEl = document.getElementById(\'inspFps\');\r\n        if (fpsEl) { fpsEl.textContent = \'FPS: \' + fps; fpsEl.style.color = fps >= 55 ? \'#4ade80\' : fps >= 40 ? \'#fbbf24\' : \'#f87171\'; }\r\n        const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };\r\n        set(\'inspScore\', \'Score: \' + score);\r\n        set(\'inspLives\', \'Lives: \' + lives);\r\n        set(\'inspPos\', \'Pos: \' + px + \', \' + py);\r\n        set(\'inspVel\', \'Vel: \' + vx + \', \' + vy);\r\n        set(\'inspScene\', sceneName);\r\n    } catch(e) {}\r\n}\r\n\r\nlet _gamePaused = false;',
  'Add live inspector JS'
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. GAMEPAD SUPPORT
// ═══════════════════════════════════════════════════════════════════════════

// 4a. Add gamepad: true to Phaser config
rep(
  '                physics: { default:\'arcade\', arcade:{ debug:false } },\r\n                render: { preserveDrawingBuffer: true },',
  '                physics: { default:\'arcade\', arcade:{ debug:false } },\r\n                input: { gamepad: true },\r\n                render: { preserveDrawingBuffer: true },',
  'Add gamepad to Phaser config'
);

// 4b. Add gamepad polling to the step event (after user script hooks)
rep(
  '                    // Achievement check',
  '                    // ── Gamepad input → global keys ──────────────────────────\r\n                    try {\r\n                        const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;\r\n                        if (gp) {\r\n                            const ax0 = gp.axes[0] || 0, ax1 = gp.axes[1] || 0;\r\n                            window._gpLeft  = ax0 < -0.3 || (gp.buttons[14] && gp.buttons[14].pressed);\r\n                            window._gpRight = ax0 >  0.3 || (gp.buttons[15] && gp.buttons[15].pressed);\r\n                            window._gpUp    = ax1 < -0.3 || (gp.buttons[12] && gp.buttons[12].pressed);\r\n                            window._gpDown  = ax1 >  0.3 || (gp.buttons[13] && gp.buttons[13].pressed);\r\n                            window._gpFire  = (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[2] && gp.buttons[2].pressed);\r\n                            window._gpStart = (gp.buttons[9] && gp.buttons[9].pressed);\r\n                            if (window._gpStart && !window._gpStartPrev) togglePause();\r\n                            window._gpStartPrev = window._gpStart;\r\n                        } else {\r\n                            window._gpLeft=window._gpRight=window._gpUp=window._gpDown=window._gpFire=false;\r\n                        }\r\n                    } catch(e) {}\r\n                    // Achievement check',
  'Add gamepad polling to step'
);

// 4c. Add gamepad status indicator to Build tab (near Run button area)
rep(
  '            <div style="display:flex;gap:5px;margin-bottom:4px;">\r\n                <button id="configUndoBtn"',
  '            <div id="gamepadStatus" style="display:none;font-size:.58rem;color:#4ade80;text-align:center;padding:3px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.18);border-radius:5px;margin-bottom:3px;">🎮 Controller connected</div>\r\n            <div style="display:flex;gap:5px;margin-bottom:4px;">\r\n                <button id="configUndoBtn"',
  'Add gamepad status indicator'
);

// 4d. Add gamepad connect/disconnect listeners
rep(
  '_checkFirstVisit(); // shows tutorial on first visit',
  '_checkFirstVisit(); // shows tutorial on first visit\r\n    window.addEventListener(\'gamepadconnected\', (e) => {\r\n        const el = document.getElementById(\'gamepadStatus\');\r\n        if (el) { el.style.display=\'block\'; el.textContent=\'🎮 \'+e.gamepad.id.substring(0,30)+\' connected\'; }\r\n        showToast(\'🎮 Controller connected!\');\r\n    });\r\n    window.addEventListener(\'gamepaddisconnected\', () => {\r\n        const el = document.getElementById(\'gamepadStatus\'); if (el) el.style.display=\'none\';\r\n    });',
  'Add gamepad connect listeners'
);

// ═══════════════════════════════════════════════════════════════════════════
// 5. HOT-RELOAD — apply config to running game without restart
// ═══════════════════════════════════════════════════════════════════════════

// 5a. Add Hot Reload button next to Run button
rep(
  '            <button class="btn-run pulsing" id="runGameBtn" onclick="compileAndBootEngine()">▶ Run Game <kbd class="run-kbd">[R]</kbd></button>',
  '            <button class="btn-run pulsing" id="runGameBtn" onclick="compileAndBootEngine()">▶ Run Game <kbd class="run-kbd">[R]</kbd></button>\r\n            <button class="btn-sm" id="hotReloadBtn" style="width:100%;margin-top:3px;background:rgba(34,197,94,.1);color:#4ade80;border-color:rgba(34,197,94,.25);display:none;" onclick="hotReloadConfig()" title="Apply current settings to running game without restarting">⚡ Apply Live (no restart)</button>',
  'Add hot reload button'
);

// 5b. Add hotReloadConfig JS function
rep(
  'function pauseGame() {',
  'function hotReloadConfig() {\r\n    if (!currentPhaserGame) { showToast(\'Start the game first\'); return; }\r\n    const data = getPayload();\r\n    // Sync the key live-readable config values\r\n    liveConfig.speed       = data.speed;\r\n    liveConfig.gravity     = data.gravity;\r\n    liveConfig.jumpForce   = data.jump;\r\n    liveConfig.spawnDelay  = data.spawnDelay || liveConfig.spawnDelay;\r\n    liveConfig.enemySpeed  = data.enemySpeed || liveConfig.enemySpeed;\r\n    liveConfig.gameSpeed   = data.gameSpeed  || liveConfig.gameSpeed;\r\n    liveConfig.lives       = data.lives      || liveConfig.lives;\r\n    liveConfig.difficultyScale = data.difficultyScale !== undefined ? data.difficultyScale : liveConfig.difficultyScale;\r\n    // Apply to running Phaser scenes\r\n    try {\r\n        currentPhaserGame.scene.getScenes(true).forEach(s => {\r\n            if (s.physics && s.physics.world) s.physics.world.gravity.y = liveConfig.gravity;\r\n        });\r\n    } catch(e) {}\r\n    showToast(\'⚡ Config applied live!\');\r\n}\r\n\r\nfunction pauseGame() {',
  'Add hotReloadConfig function'
);

// 5c. Show/hide hot-reload button based on whether game is running
rep(
  '    const _rb = document.getElementById(\'runGameBtn\');\r\n    if (_rb) { _rb.classList.remove(\'pulsing\'); _rb.innerHTML = \'↺ Restart <kbd class="run-kbd">[R]</kbd>\'; }',
  '    const _rb = document.getElementById(\'runGameBtn\');\r\n    if (_rb) { _rb.classList.remove(\'pulsing\'); _rb.innerHTML = \'↺ Restart <kbd class="run-kbd">[R]</kbd>\'; }\r\n    const _hrb = document.getElementById(\'hotReloadBtn\'); if (_hrb) _hrb.style.display = \'\';\r\n    document.getElementById(\'pauseBtn\') && (document.getElementById(\'pauseBtn\').style.opacity=\'1\');',
  'Show hot reload btn when game starts'
);

// ═══════════════════════════════════════════════════════════════════════════
// 6. PARTICLE PRESETS
// ═══════════════════════════════════════════════════════════════════════════

// 6a. Add particle presets section to Effects panel
rep(
  '                <div class="form-group" style="flex-direction:row;align-items:center;justify-content:space-between;">\r\n                    <label>Player Trail Effect</label>',
  '                <span class="sec-label" style="margin-top:4px;">🎆 Particle Presets</span>\r\n                <div class="form-group">\r\n                    <div style="display:flex;flex-wrap:wrap;gap:5px;">\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'fire\')">🔥 Fire</button>\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'confetti\')">🎊 Confetti</button>\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'sparkle\')">✨ Sparkle</button>\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'ice\')">❄️ Ice</button>\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'explosion\')">💥 Explosion</button>\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'stars\')">🌟 Stars</button>\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'bubble\')">🫧 Bubble</button>\r\n                        <button class="btn-sm" style="font-size:.63rem;padding:3px 8px;" onclick="applyParticlePreset(\'smoke\')">💨 Smoke</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group" style="flex-direction:row;align-items:center;justify-content:space-between;">\r\n                    <label>Player Trail Effect</label>',
  'Add particle presets UI'
);

// 6b. Add applyParticlePreset JS function
rep(
  'function applyColourPreset(cols) {',
  'function applyParticlePreset(name) {\r\n    _pushLcHistory();\r\n    const P = {\r\n        fire:      { particleStyle:\'burst\',   particleColor:\'red\',    particleCount:20, particleSize:\'medium\', trailEffect:true  },\r\n        confetti:  { particleStyle:\'star\',    particleColor:\'rainbow\',particleCount:24, particleSize:\'medium\', trailEffect:false },\r\n        sparkle:   { particleStyle:\'sparkle\', particleColor:\'gold\',   particleCount:16, particleSize:\'small\',  trailEffect:true  },\r\n        ice:       { particleStyle:\'sparkle\', particleColor:\'blue\',   particleCount:14, particleSize:\'small\',  trailEffect:true  },\r\n        explosion: { particleStyle:\'burst\',   particleColor:\'red\',    particleCount:30, particleSize:\'large\',  trailEffect:false },\r\n        stars:     { particleStyle:\'star\',    particleColor:\'gold\',   particleCount:18, particleSize:\'medium\', trailEffect:false },\r\n        bubble:    { particleStyle:\'swirl\',   particleColor:\'blue\',   particleCount:12, particleSize:\'large\',  trailEffect:false },\r\n        smoke:     { particleStyle:\'swirl\',   particleColor:\'purple\', particleCount:15, particleSize:\'large\',  trailEffect:true  },\r\n    }[name];\r\n    if (!P) return;\r\n    Object.assign(liveConfig, P);\r\n    // Sync UI pills\r\n    const styleMap = {burst:\'💥 Burst\',sparkle:\'✨ Sparkle\',star:\'🌟 Star\',swirl:\'💫 Swirl\'};\r\n    document.querySelectorAll(\'#pillParticleStyle .pill\').forEach(p => p.classList.toggle(\'active\', p.textContent.trim()===styleMap[P.particleStyle]));\r\n    const colorMap = {red:\'🔴\',gold:\'🟡\',blue:\'🔵\',rainbow:\'🌈\',purple:\'🟣\',green:\'🟢\'};\r\n    document.querySelectorAll(\'#pillParticleColor .pill\').forEach(p => p.classList.toggle(\'active\', p.textContent.trim()===colorMap[P.particleColor]));\r\n    document.querySelectorAll(\'#pillParticleSize .pill\').forEach(p => p.classList.toggle(\'active\', p.textContent.trim().toLowerCase()===P.particleSize));\r\n    showToast(\'Particle preset: \' + name);\r\n}\r\n\r\nfunction applyColourPreset(cols) {',
  'Add applyParticlePreset function'
);

// ═══════════════════════════════════════════════════════════════════════════
// 7. BUILT-IN SPRITE LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

// 7a. Add sprite library section after spriteStatus in Art tab
rep(
  '                <div id="spriteStatus" class="asset-status none">No custom sprite loaded</div>\r\n            </div>\r\n\r\n            <!-- ── QUICK SPRITE EDITOR ──',
  '                <div id="spriteStatus" class="asset-status none">No custom sprite loaded</div>\r\n            </div>\r\n\r\n            <!-- ── BUILT-IN SPRITE LIBRARY ── -->\r\n            <div class="asset-block">\r\n                <div class="asset-block-title">🎭 Built-in Sprites <span style="font-size:.58rem;color:var(--muted);font-weight:400;">— click to use as player sprite</span></div>\r\n                <div id="builtinSpriteGrid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px 0;"></div>\r\n            </div>\r\n\r\n            <!-- ── QUICK SPRITE EDITOR ──',
  'Add built-in sprite library HTML'
);

// 7b. Add sprite library JS (init + click handler)
rep(
  'function applyParticlePreset(name) {',
  '// ── BUILT-IN SPRITE LIBRARY ─────────────────────────────────────────────────\r\nconst _BUILTIN_SPRITES = [\r\n    {key:\'ship\',    label:\'Ship\',    emoji:\'🚀\'},\r\n    {key:\'knight\',  label:\'Knight\', emoji:\'⚔️\'},\r\n    {key:\'frog\',    label:\'Frog\',   emoji:\'🐸\'},\r\n    {key:\'robot\',   label:\'Robot\',  emoji:\'🤖\'},\r\n    {key:\'cat\',     label:\'Cat\',    emoji:\'🐱\'},\r\n    {key:\'dino\',    label:\'Dino\',   emoji:\'🦕\'},\r\n    {key:\'wizard\',  label:\'Wizard\', emoji:\'🧙\'},\r\n    {key:\'car\',     label:\'Car\',    emoji:\'🏎️\'},\r\n    {key:\'bird\',    label:\'Bird\',   emoji:\'🐦\'},\r\n    {key:\'skull\',   label:\'Skull\',  emoji:\'💀\'},\r\n    {key:\'gem\',     label:\'Gem\',    emoji:\'💎\'},\r\n    {key:\'star\',    label:\'Star\',   emoji:\'⭐\'},\r\n    {key:\'fire\',    label:\'Fire\',   emoji:\'🔥\'},\r\n    {key:\'bolt\',    label:\'Bolt\',   emoji:\'⚡\'},\r\n    {key:\'heart\',   label:\'Heart\',  emoji:\'❤️\'},\r\n    {key:\'dragon\',  label:\'Dragon\', emoji:\'🐉\'},\r\n    {key:\'alien\',   label:\'Alien\',  emoji:\'👾\'},\r\n    {key:\'ninja\',   label:\'Ninja\',  emoji:\'🥷\'},\r\n];\r\n\r\nfunction _initBuiltinSprites() {\r\n    const grid = document.getElementById(\'builtinSpriteGrid\');\r\n    if (!grid) return;\r\n    grid.innerHTML = _BUILTIN_SPRITES.map(sp => {\r\n        return `<button onclick="_applyBuiltinSprite(\'${sp.key}\')" title="Use ${sp.label}" style="aspect-ratio:1;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.22);border-radius:8px;font-size:1.3rem;cursor:pointer;transition:all .15s;padding:4px;" onmouseover="this.style.borderColor=\'rgba(124,58,237,.6)\';this.style.background=\'rgba(124,58,237,.25)\'" onmouseout="this.style.borderColor=\'rgba(124,58,237,.22)\';this.style.background=\'rgba(124,58,237,.12)\'">${sp.emoji}</button>`;\r\n    }).join(\'\');\r\n}\r\n\r\nfunction _applyBuiltinSprite(key) {\r\n    const sp = _BUILTIN_SPRITES.find(s => s.key === key);\r\n    if (!sp) return;\r\n    // Render emoji to a 64x64 canvas and use as sprite\r\n    const cvs = document.createElement(\'canvas\');\r\n    cvs.width = cvs.height = 64;\r\n    const ctx = cvs.getContext(\'2d\');\r\n    ctx.clearRect(0, 0, 64, 64);\r\n    ctx.font = \'48px serif\';\r\n    ctx.textAlign = \'center\';\r\n    ctx.textBaseline = \'middle\';\r\n    ctx.fillText(sp.emoji, 32, 34);\r\n    const dataUrl = cvs.toDataURL();\r\n    customSpriteDataUrl = dataUrl;\r\n    customSpriteFrameCount = 1;\r\n    customSpriteFrameW = 0;\r\n    // Update the preview thumb\r\n    const thumb = document.getElementById(\'spriteThumb\');\r\n    if (thumb) thumb.innerHTML = `<img src="${dataUrl}" style="width:48px;height:48px;image-rendering:pixelated;">`;\r\n    const infoName = document.getElementById(\'spriteInfoName\');\r\n    if (infoName) infoName.textContent = sp.label + \' (built-in)\';\r\n    const status = document.getElementById(\'spriteStatus\');\r\n    if (status) { status.textContent = sp.label + \' sprite loaded\'; status.className = \'asset-status custom\'; }\r\n    showToast(sp.emoji + \' \' + sp.label + \' sprite applied — hit ▶ Run!\');\r\n}\r\n\r\nfunction applyParticlePreset(name) {',
  'Add built-in sprite library JS'
);

// 7c. Init sprite library on page load
rep(
  'setTimeout(() => { _pushLcHistory(); }, 500); // seed the undo history',
  'setTimeout(() => { _pushLcHistory(); }, 500); // seed the undo history\r\n    _initBuiltinSprites();',
  'Init sprite library on load'
);

// ═══════════════════════════════════════════════════════════════════════════
// 8. GAME TAGS
// ═══════════════════════════════════════════════════════════════════════════

// 8a. Add tags section to Build tab (after game title input)
rep(
  '            <div class="form-group">\r\n                <label>Genre</label>',
  '            <div class="form-group">\r\n                <label>Tags <span style="color:var(--muted);font-weight:400;">— describe your game</span></label>\r\n                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;" id="tagPills">\r\n                    <button class="pill" onclick="_toggleTag(this,\'action\')">Action</button>\r\n                    <button class="pill" onclick="_toggleTag(this,\'puzzle\')">Puzzle</button>\r\n                    <button class="pill" onclick="_toggleTag(this,\'chill\')">Chill</button>\r\n                    <button class="pill" onclick="_toggleTag(this,\'hard\')">Hard</button>\r\n                    <button class="pill" onclick="_toggleTag(this,\'kids\')">Kids</button>\r\n                    <button class="pill" onclick="_toggleTag(this,\'retro\')">Retro</button>\r\n                    <button class="pill" onclick="_toggleTag(this,\'funny\')">Funny</button>\r\n                    <button class="pill" onclick="_toggleTag(this,\'scary\')">Scary</button>\r\n                </div>\r\n            </div>\r\n            <div class="form-group">\r\n                <label>Genre</label>',
  'Add game tags to Build tab'
);

// 8b. Add tags field to liveConfig
rep(
  '    gameFont:\'JetBrains\',',
  '    gameFont:\'JetBrains\',\r\n    tags:[],',
  'Add tags to liveConfig'
);

// 8c. Add _toggleTag JS function
rep(
  'function hotReloadConfig() {',
  'function _toggleTag(btn, tag) {\r\n    if (!liveConfig.tags) liveConfig.tags = [];\r\n    const idx = liveConfig.tags.indexOf(tag);\r\n    if (idx >= 0) {\r\n        liveConfig.tags.splice(idx, 1);\r\n        btn.classList.remove(\'active\');\r\n    } else {\r\n        liveConfig.tags.push(tag);\r\n        btn.classList.add(\'active\');\r\n    }\r\n}\r\n\r\nfunction hotReloadConfig() {',
  'Add _toggleTag function'
);

// ═══════════════════════════════════════════════════════════════════════════
// 9. MORE STARTER TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

rep(
  '  space_survival: {\r\n    genre:\'WAVESURVIVAL\', theme:\'space\', title:\'Space Siege\',',
  '  ghost_maze: {\r\n    genre:\'ROGUELIKE\', theme:\'castle\', title:\'Ghost Maze\',\r\n    speed:170, lives:5, rogueRooms:8, rogueDensity:0.4, rogueStartHp:5,\r\n    coinsEnabled:true, coinEmoji:\'💎\', particleStyle:\'sparkle\', particleColor:\'purple\',\r\n    bossEnabled:true, bossHpNew:25, bossScore:400,\r\n    storyIntro:\'Escape the haunted maze and defeat the ghost king!\',\r\n    storyWin:\'The ghost king is banished! 👻\', storyLose:\'Trapped forever...\',\r\n    difficultyScale:1, weatherEffect:\'none\',\r\n  },\r\n  neon_wave: {\r\n    genre:\'WAVESURVIVAL\', theme:\'cyber\', title:\'Neon Wave\',\r\n    speed:260, lives:2, bgStyle:\'neon\',\r\n    waveScaling:3, wavePause:1500, waveClearBonus:true,\r\n    enemyAI:\'zigzag\', bossEnabled:true, bossHpNew:30, bossScore:500,\r\n    coinsEnabled:true, particleStyle:\'swirl\', particleColor:\'purple\',\r\n    storyIntro:\'Waves of neon drones are charging the grid!\',\r\n    storyWin:\'Grid secured! 💻\', storyLose:\'System overloaded...\',\r\n    difficultyScale:2, gameFont:\'Orbitron\',\r\n  },\r\n  candy_memory: {\r\n    genre:\'MEMORY\', theme:\'candy\', title:\'Candy Match\',\r\n    speed:200, lives:3,\r\n    storyIntro:\'Match all the sweet candy pairs!\',\r\n    storyWin:\'All pairs found! 🍬\', storyLose:\'So many sweets...\',\r\n    difficultyScale:0, particleStyle:\'star\', particleColor:\'rainbow\',\r\n  },\r\n  dino_runner: {\r\n    genre:\'RUNNER\', theme:\'forest\', title:\'Dino Dash\',\r\n    speed:300, lives:1,\r\n    runnerObstacleMix:\'mixed\', runnerCoinFreq:0.3, spawnDelay:800,\r\n    coinsEnabled:true, coinEmoji:\'🦴\', particleStyle:\'burst\', particleColor:\'green\',\r\n    doubleJump:true,\r\n    storyIntro:\'A tiny dino sprints through the jungle — how far can you go?\',\r\n    storyWin:\'Legendary runner! 🦕\', storyLose:\'Bonk!\',\r\n    difficultyScale:1.5, weatherEffect:\'none\',\r\n  },\r\n  space_survival: {\r\n    genre:\'WAVESURVIVAL\', theme:\'space\', title:\'Space Siege\',',
  'Add 4 more starter templates'
);

// ═══════════════════════════════════════════════════════════════════════════
// 10. GAMEPAD — update _gpLeft etc. in base scene input handling
// ═══════════════════════════════════════════════════════════════════════════
// The scenes check window.LEFT, window.RIGHT etc. — need to merge gamepad state
// Find where LEFT is checked and add OR with _gpLeft

// Actually let's find the key input helpers
const leftIdx = c.indexOf("window.LEFT = cursors.left.isDown");
const leftLine = leftIdx >= 0 ? 'found' : 'missing';
console.log('window.LEFT assignment:', leftLine);

// Search for where LEFT/RIGHT are set
const lines2 = c.split('\n');
for (let i = 0; i < lines2.length; i++) {
  const l = lines2[i];
  if (l && l.includes('window.LEFT') && l.includes('isDown')) {
    console.log('found at line', i+1, l.substring(0,100));
    break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WRITE
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\nResults: ${ok} OK, ${fail} FAILED`);
if (c !== orig) {
  fs.writeFileSync('F:/Website/Jvdesign-Website-v2/arcade-game-maker.html', c, 'utf8');
  console.log('Written. Size delta:', c.length - orig.length);
} else {
  console.error('NO CHANGES MADE');
}
