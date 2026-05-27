// ── Patch 8: Fix share-link loading + save-slot loading ───────────────────────
// Bug 1 (share): _bs referenced before const _bs = ... declaration (TDZ crash)
//   Patch6 left two colliding edits: outer `if ((_bs||0) > 0)` guard uses _bs
//   before the inner `const _bs = d.bs !== undefined...` declares it.
//   ReferenceError is caught by outer try/catch → loadedOk stays false →
//   onGenreChange() skipped → _shareAutoStart never set → intro shows, no auto-play.
//
// Bug 2 (saves): loadFromSlot calls _applyLoadData which calls compileAndBootEngine
//   → _showTitleScreen → user must click "Let's Play!" manually.
//   Fix: set _shareAutoStart = true so the title screen auto-dismisses after 800ms.
//
// Bug 3 (saves): save data contains stale runtime values (_score, _wave, _combo)
//   from when the game was saved, so a fresh load inherits mid-game state.
//   Fix: zero out runtime fields after Object.assign in _applyLoadData.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
let c = fs.readFileSync('arcade-game-maker.html', 'utf8');
const N = '\r\n';
const results = [];

function rep(from, to, label) {
    if (!c.includes(from)) { results.push('MISSING: ' + label); return; }
    c = c.replace(from, to);
    results.push('OK: ' + label);
}

// ── 1. Fix _bs temporal dead zone in share URL handler ────────────────────────
// Move `const _bs = ...` declaration ABOVE the outer `if` that uses it,
// and remove the duplicate inner `const _bs` and the mis-indented inner `if`.
rep(
    '                // Seed the creator\'s best score so recipients have a target to beat' + N +
    '                if ((_bs||0) > 0) {' + N +
    '                    try {' + N +
    '                        const lbKey = \'jv_lb_\' + (d.genre||\'SHOOTER\');' + N +
    '                        let board = [];' + N +
    '                        try { board = JSON.parse(localStorage.getItem(lbKey)||\'[]\'); } catch(e) {}' + N +
    '                        const _bs = d.bs !== undefined ? d.bs : (d.bestScore || 0);' + N +
    '                if (_bs > 0 && !board.some(e=>e.score===_bs && e.date===\'🏆 Creator\')) {' + N +
    '                            board.push({ score: _bs, date: \'🏆 Creator\' });' + N +
    '                            board.sort((a,b)=>b.score-a.score);' + N +
    '                            localStorage.setItem(lbKey, JSON.stringify(board.slice(0,3)));' + N +
    '                        }' + N +
    '                    } catch(e) {}' + N +
    '                }',

    '                // Seed the creator\'s best score so recipients have a target to beat' + N +
    '                const _bs = d.bs !== undefined ? d.bs : (d.bestScore || 0);' + N +
    '                if (_bs > 0) {' + N +
    '                    try {' + N +
    '                        const lbKey = \'jv_lb_\' + (d.genre||\'SHOOTER\');' + N +
    '                        let board = [];' + N +
    '                        try { board = JSON.parse(localStorage.getItem(lbKey)||\'[]\'); } catch(e) {}' + N +
    '                        if (!board.some(e=>e.score===_bs && e.date===\'🏆 Creator\')) {' + N +
    '                            board.push({ score: _bs, date: \'🏆 Creator\' });' + N +
    '                            board.sort((a,b)=>b.score-a.score);' + N +
    '                            localStorage.setItem(lbKey, JSON.stringify(board.slice(0,3)));' + N +
    '                        }' + N +
    '                    } catch(e) {}' + N +
    '                }',
    'Fix _bs TDZ: declare before outer if guard'
);

// ── 2. Auto-start game when loading from a save slot ─────────────────────────
// loadFromSlot → _applyLoadData → compileAndBootEngine → _showTitleScreen
// _showTitleScreen checks window._shareAutoStart to auto-dismiss intro.
// Set it here so saves feel instant just like opening a share link.
rep(
    'function loadFromSlot(slotIdx) {' + N +
    '    try {' + N +
    '        const raw = localStorage.getItem(SLOT_KEYS[slotIdx]);' + N +
    '        if (!raw) { showToast(`Slot ${slotIdx+1} is empty`); return; }' + N +
    '        _applyLoadData(JSON.parse(raw));',

    'function loadFromSlot(slotIdx) {' + N +
    '    try {' + N +
    '        const raw = localStorage.getItem(SLOT_KEYS[slotIdx]);' + N +
    '        if (!raw) { showToast(`Slot ${slotIdx+1} is empty`); return; }' + N +
    '        window._shareAutoStart = true; // auto-dismiss intro so game boots directly' + N +
    '        _applyLoadData(JSON.parse(raw));',
    'loadFromSlot: set _shareAutoStart so game auto-boots'
);

// ── 3. Reset runtime liveConfig fields on _applyLoadData ─────────────────────
// Saves include stale _score/_wave/_combo from the saved session.
// Zero them out so the loaded game starts fresh (saves store CONFIG, not progress).
rep(
    '    if(d.liveConfig) {' + N +
    '        Object.assign(liveConfig, d.liveConfig);' + N +
    '        // Sync lives from startLives if present' + N +
    '        if (d.liveConfig.startLives) liveConfig.lives = d.liveConfig.startLives;' + N +
    '        _syncCustomTabUI(d.liveConfig);' + N +
    '    }',

    '    if(d.liveConfig) {' + N +
    '        Object.assign(liveConfig, d.liveConfig);' + N +
    '        // Sync lives from startLives if present' + N +
    '        if (d.liveConfig.startLives) liveConfig.lives = d.liveConfig.startLives;' + N +
    '        // Reset runtime state so game starts fresh (saves store config, not progress)' + N +
    '        liveConfig._score = 0; liveConfig._wave = 0; liveConfig._combo = 0;' + N +
    '        liveConfig._timer = 0; liveConfig._currentLevel = 0;' + N +
    '        _syncCustomTabUI(d.liveConfig);' + N +
    '    }',
    '_applyLoadData: zero runtime fields after restore'
);

// ── Write and syntax-check ─────────────────────────────────────────────────────
fs.writeFileSync('arcade-game-maker.html', c);

const { spawnSync } = require('child_process');
const c2 = fs.readFileSync('arcade-game-maker.html', 'utf8');
let idx = 0, n = 0, allOk = true;
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
        const r = spawnSync('node', ['--check', '_tmp.js'], {encoding:'utf8'});
        if (r.status !== 0) { results.push('SYNTAX ERROR script '+n+': '+r.stderr.split('\n').slice(0,3).join(' ')); allOk=false; }
    }
    idx = e + 9;
}
try { fs.unlinkSync('_tmp.js'); } catch(e) {}

results.forEach(r => console.log(r));
console.log('\nSyntax:', allOk ? 'ALL OK' : 'HAS ERRORS');
console.log('Size:', (fs.statSync('arcade-game-maker.html').size/1024).toFixed(1) + 'KB');
