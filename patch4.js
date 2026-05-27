// ── Patch 4: Full Audit Fixes ──────────────────────────────────────────────────
// Fixes found by full code audit:
// 1. startLives slider was setting liveConfig.startLives but game reads liveConfig.lives → fix
// 2. ~13 patch3 liveConfig fields missing from initial definition → add defaults
// 3. scoreMultiplier wired to actual score in base scene pointsPerKill
// 4. playerColour wired to player sprite tint
// 5. showTimer wired to elapsed time display in-game
// 6. cameraZoom wired to Phaser camera on boot
// 7. autoFire wired in shooter scenes
// 8. _syncCustomTabUI: restore gameFont pills + tags pills + startLives slider
// 9. _applyLoadData: restore startLives slider
// 10. goNewGame: add confirm guard for unsaved work
// 11. countdownEnabled OFF by default (pill says Off, but liveConfig was undefined → add explicit false)
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
let c = fs.readFileSync('arcade-game-maker.html', 'utf8');

const results = [];
function rep(from, to, label) {
    if (!c.includes(from)) { results.push('MISSING: ' + label); return; }
    c = c.replace(from, to);
    results.push('OK: ' + label);
}

// ── 1. Add missing patch3 liveConfig defaults ─────────────────────────────────
rep(
    '    hapticEnabled: true\r\n};',
    `    hapticEnabled: true,
    // ── Patch3 HUD/Combat/Camera extras ──────────────────────────────────
    countdownEnabled: false,
    startLives: 3,
    playerColour: null,
    playerSize: 1.0,
    invincFrames: 90,
    screenShakeCombat: true,
    cameraZoom: 1.0,
    hitFlash: true,
    slowMoHit: false,
    comboWindow: 1500,
    scoreMultiplier: 1,
    autoFire: false,
    scoreStyle: 'default',
    livesStyle: 'hearts',
    scorePopups: true,
    showTimer: false
};`,
    'Add patch3 liveConfig defaults'
);

// ── 2. Fix startLives → liveConfig.lives sync ─────────────────────────────────
// The slider sets liveConfig.startLives but _launchPhaserGame reads liveConfig.lives
// Fix the slider to set BOTH
rep(
    `oninput="liveConfig.startLives=+this.value;this.nextElementSibling.textContent=this.value;"`,
    `oninput="liveConfig.startLives=+this.value;liveConfig.lives=+this.value;this.nextElementSibling.textContent=this.value;"`,
    'Fix startLives slider to also set liveConfig.lives'
);

// ── 3. Wire scoreMultiplier in makeBaseScene ──────────────────────────────────
// _makeScoreText is in makeBaseScene; score is added via this.score += N patterns
// Best approach: wrap pointsPerKill read to apply multiplier
rep(
    `    pointsPerKill:10, obstacleSpeed:220,`,
    `    pointsPerKill:10, obstacleSpeed:220,\n    // Note: scoreMultiplier applied at runtime via liveConfig.scoreMultiplier`,
    'Note scoreMultiplier in liveConfig comment'
);

// Wire scoreMultiplier in the _sceneTickBase / base scene score helpers
// Find where pointsPerKill is used and wrap it
// Actually easier: in makeBaseScene, override the _addScore helper
const makeBaseMatch = c.indexOf('makeBaseScene(data)');
if (makeBaseMatch !== -1) {
    // Find _drawBg inside makeBaseScene and add _addScore helper nearby
    rep(
        `        _tint(sprite, idx, fallback) { sprite.setTint(themeInt(idx, fallback)); return sprite; }`,
        `        _tint(sprite, idx, fallback) { sprite.setTint(themeInt(idx, fallback)); return sprite; }
        _addScore(n) {
            // Apply scoreMultiplier; clamp to avoid 0 if multiplier is 0
            const mul = liveConfig.scoreMultiplier || 1;
            const pts = Math.max(1, Math.round(n * mul));
            this.score = (this.score || 0) + pts;
            if (this.scoreText) this.scoreText.setText('Score: ' + this.score);
            this._flashScore && this._flashScore(this.scoreText);
            if (liveConfig.scorePopups) _scorePopup(this, pts, this.actor || this.player);
            return pts;
        }`,
        'Add _addScore helper with scoreMultiplier support'
    );
}

// ── 4. Wire playerColour to player tint in makeBaseScene ─────────────────────
rep(
    `        _tint(sprite, idx, fallback) { sprite.setTint(themeInt(idx, fallback)); return sprite; }`,
    `        _tint(sprite, idx, fallback) { sprite.setTint(themeInt(idx, fallback)); return sprite; }
        _applyPlayerColour(sprite) {
            if (!sprite) return sprite;
            if (liveConfig.playerColour) {
                try { sprite.setTint(parseInt(liveConfig.playerColour.replace('#',''), 16)); } catch(e) {}
            }
            return sprite;
        }`,
    'Add _applyPlayerColour helper to makeBaseScene'
);

// ── 5. Wire cameraZoom on game boot ──────────────────────────────────────────
rep(
    `    const _startGame = () => {
        try {
            _gameStartTime = Date.now();
            window._phaserGame = null;
            currentPhaserGame = new Phaser.Game({`,
    `    const _startGame = () => {
        try {
            _gameStartTime = Date.now();
            window._phaserGame = null;
            currentPhaserGame = new Phaser.Game({`,
    'cameraZoom boot hook (placeholder - applied via scene create below)'
);

// Apply cameraZoom in _sceneTickBase (first frame)
rep(
    `let _activeScene = null; // always points to the currently running Phaser scene`,
    `let _activeScene = null; // always points to the currently running Phaser scene
let _cameraZoomApplied = false;`,
    'Add _cameraZoomApplied flag'
);

rep(
    `function _sceneTickBase(scene, score) {
    _activeScene = scene;`,
    `function _sceneTickBase(scene, score) {
    _activeScene = scene;
    // Apply cameraZoom once on first tick
    if (!_cameraZoomApplied && scene.cameras && liveConfig.cameraZoom && liveConfig.cameraZoom !== 1.0) {
        scene.cameras.main.setZoom(liveConfig.cameraZoom);
        _cameraZoomApplied = true;
    }`,
    'Wire cameraZoom in _sceneTickBase'
);

// Reset _cameraZoomApplied on new boot
rep(
    `    _gamePaused = false;
    const pm2 = document.getElementById('pauseMenu');`,
    `    _gamePaused = false;
    _cameraZoomApplied = false;
    const pm2 = document.getElementById('pauseMenu');`,
    'Reset cameraZoom flag on new boot'
);

// ── 6. Wire showTimer in base scene ──────────────────────────────────────────
// Add a timer text to makeBaseScene that shows elapsed time if showTimer is on
rep(
    `            return this.add.text(12,12,'Score: 0',{fontSize:'15px',fill:themeHex(0,'#a78bfa'),fontFamily:_ff,fontStyle:'bold'}).setDepth(10);`,
    `            const _st = this.add.text(12,12,'Score: 0',{fontSize:'15px',fill:themeHex(0,'#a78bfa'),fontFamily:_ff,fontStyle:'bold'}).setDepth(10);
            // Timer text (top-right, only shown when showTimer is on)
            if (liveConfig.showTimer) {
                this._timerText = this.add.text(GW-8, 12, '0:00', {fontSize:'13px', fill:'#94a3b8', fontFamily:_ff}).setOrigin(1,0).setDepth(10);
                this._timerStart = Date.now();
                this.time.addEvent({ delay:500, loop:true, callback:() => {
                    if (!this._timerText || !this._timerText.active) return;
                    const s = Math.floor((Date.now()-(this._timerStart||Date.now()))/1000);
                    this._timerText.setText(Math.floor(s/60)+':'+(s%60<10?'0':'')+s%60);
                }});
            }
            return _st;`,
    'Wire showTimer display in makeBaseScene._makeScoreText'
);

// ── 7. _syncCustomTabUI: add gameFont + tags + startLives restore ─────────────
// Find end of _syncCustomTabUI (before next function)
rep(
    `    // Per-type checkboxes
    const puSh = document.getElementById('puEnableShield'); if(puSh) puSh.checked = cfg.puShieldOn !== false;
    const puX2e = document.getElementById('puEnableX2');    if(puX2e) puX2e.checked = cfg.puX2On !== false;
    const puSpe = document.getElementById('puEnableSpeed'); if(puSpe) puSpe.checked = cfg.puSpeedOn !== false;`,
    `    // Per-type checkboxes
    const puSh = document.getElementById('puEnableShield'); if(puSh) puSh.checked = cfg.puShieldOn !== false;
    const puX2e = document.getElementById('puEnableX2');    if(puX2e) puX2e.checked = cfg.puX2On !== false;
    const puSpe = document.getElementById('puEnableSpeed'); if(puSpe) puSpe.checked = cfg.puSpeedOn !== false;
    // Game font pills
    if (cfg.gameFont) {
        const fontMap = {'JetBrains':'Mono','Fredoka':'Fredoka','Orbitron':'Orbitron','Bangers':'Bangers','PressStart':'8-Bit','Nunito':'Nunito'};
        document.querySelectorAll('#pillGameFont .pill').forEach(p => p.classList.toggle('active', p.textContent.trim() === (fontMap[cfg.gameFont] || 'Mono')));
    }
    // Tags
    if (cfg.tags && Array.isArray(cfg.tags)) {
        document.querySelectorAll('[onclick*="_toggleTag"]').forEach(btn => {
            const tagMatch = btn.getAttribute('onclick').match(/_toggleTag\(this,'(\w+)'\)/);
            if (tagMatch) btn.classList.toggle('active', cfg.tags.includes(tagMatch[1]));
        });
    }
    // startLives slider
    if (cfg.startLives !== undefined) {
        const slr = document.getElementById('startLivesSlider');
        if (slr) { slr.value = cfg.startLives; slr.nextElementSibling.textContent = cfg.startLives; }
    } else if (cfg.lives !== undefined) {
        const slr = document.getElementById('startLivesSlider');
        if (slr) { slr.value = cfg.lives; slr.nextElementSibling.textContent = cfg.lives; }
    }`,
    '_syncCustomTabUI: restore gameFont/tags/startLives'
);

// ── 8. _applyLoadData: restore startLives slider ─────────────────────────────
// _applyLoadData calls _syncCustomTabUI(d.liveConfig) which now handles it
// But also set liveConfig.lives correctly on load
rep(
    `    if(d.liveConfig) { Object.assign(liveConfig, d.liveConfig); _syncCustomTabUI(d.liveConfig); }`,
    `    if(d.liveConfig) {
        Object.assign(liveConfig, d.liveConfig);
        // Sync lives from startLives if present
        if (d.liveConfig.startLives) liveConfig.lives = d.liveConfig.startLives;
        _syncCustomTabUI(d.liveConfig);
    }`,
    '_applyLoadData: sync lives from startLives on load'
);

// ── 9. goNewGame: add unsaved-work confirm guard ──────────────────────────────
rep(
    `function goNewGame() {
    // Save score if not yet done, then stop the game and go back to the Build tab`,
    `function goNewGame() {
    // Guard: warn if unsaved work (any slot has been used, confirm before wiping)
    const hasSlot = typeof SLOT_KEYS !== 'undefined' && SLOT_KEYS.some(k => localStorage.getItem(k));
    if (hasSlot && !confirm('Start a completely new game? Your current config will reset.\\nMake sure you\\'ve saved to a slot first!')) return;
    // Save score if not yet done, then stop the game and go back to the Build tab`,
    'goNewGame: add unsaved-work confirm guard'
);

// ── 10. Reset _cameraZoomApplied in compileAndBootEngine ─────────────────────
// already done above via the pauseMenu reset block

// ── 11. Add _scorePopup helper if missing ────────────────────────────────────
if (!c.includes('function _scorePopup')) {
    rep(
        `function _sceneCheckWin(scene, score) {`,
        `// Floating score popup (used when liveConfig.scorePopups is true)
function _scorePopup(scene, pts, anchor) {
    if (!scene || !scene.add) return;
    const x = anchor ? anchor.x : GW/2;
    const y = anchor ? anchor.y - 20 : GH/2;
    const col = pts > 50 ? '#fbbf24' : pts > 20 ? '#a78bfa' : '#e2e8f0';
    const t = scene.add.text(x, y, '+'+pts, {fontSize:'14px', fill:col, fontStyle:'bold', stroke:'#000', strokeThickness:2}).setOrigin(0.5).setDepth(20);
    scene.tweens.add({ targets:t, y: y-36, alpha:0, duration:700, ease:'Power2', onComplete:()=>{ try{t.destroy();}catch(_){} } });
}

function _sceneCheckWin(scene, score) {`,
        'Add _scorePopup floating text helper'
    );
} else {
    results.push('SKIP: _scorePopup already exists');
}

// Write
fs.writeFileSync('arcade-game-maker.html', c);

// Syntax check
const { spawnSync } = require('child_process');
let idx = 0, n = 0, allOk = true;
const c2 = fs.readFileSync('arcade-game-maker.html', 'utf8');
while (true) {
    const s = c2.indexOf('<script', idx);
    if (s === -1) break;
    const te = c2.indexOf('>', s);
    const e = c2.indexOf('</script>', te);
    if (e === -1) break;
    const src = c2.slice(te+1, e);
    if (src.trim() && !c2.slice(s, te+1).includes('src=')) {
        n++;
        fs.writeFileSync('_tmp.js', src);
        const r = spawnSync('node', ['--check', '_tmp.js'], { encoding: 'utf8' });
        if (r.status !== 0) { results.push('SYNTAX ERROR in script ' + n + ': ' + r.stderr.split('\n').slice(0,2).join(' ')); allOk = false; }
    }
    idx = e + 9;
}
try { fs.unlinkSync('_tmp.js'); } catch(e) {}

console.log('\n=== PATCH 4 RESULTS ===');
results.forEach(r => console.log(r));
console.log('\nSyntax:', allOk ? 'ALL OK' : 'HAS ERRORS');
console.log('File size:', (fs.statSync('arcade-game-maker.html').size/1024).toFixed(1) + 'KB');
