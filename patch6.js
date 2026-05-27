// ── Patch 6: Delta-encode share payload for QR-friendly URLs ─────────────────
// Strategy:
// 1. Snapshot liveConfig defaults right after it's defined → _lcDefaults
// 2. _buildSharePayload: only include liveConfig fields that DIFFER from defaults
// 3. Share URL handler: merge received delta onto fresh defaults before applying
// 4. Result: basic game = ~100-200 char URL; heavily customised = ~400-600 chars
//    Both are well within QR code limits (v10 QR holds ~400 alphanumeric chars)
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

// ── 1. Snapshot defaults right after liveConfig definition ───────────────────
// Insert: let _lcDefaults = null; right before "// ── AUDIO ENGINE"
// And: _lcDefaults = JSON.parse(JSON.stringify(liveConfig)); right after liveConfig ends
rep(
    '// ── AUDIO ENGINE ─────────────────────────────────────────────────────────────',
    '// Snapshot of factory defaults — used to delta-encode share payloads' + N +
    'const _lcDefaults = JSON.parse(JSON.stringify(liveConfig));' + N +
    N +
    '// ── AUDIO ENGINE ─────────────────────────────────────────────────────────────',
    'Add _lcDefaults snapshot after liveConfig'
);

// ── 2. Replace _buildSharePayload with delta-encoding version ─────────────────
rep(
    'function _buildSharePayload(d) {' + N +
    '    const genre = d.genre || \'SHOOTER\';' + N +
    '    let bestScore = 0;' + N +
    '    try { const board=JSON.parse(localStorage.getItem(\'jv_lb_\'+genre)||\'[]\'); bestScore=board.length?board[0].score:0; } catch(e){}' + N +
    '    let forkCount = 0;' + N +
    '    try { forkCount = parseInt(localStorage.getItem(\'jv_fork_count\')||\'0\'); } catch(e){}' + N +
    '    // Strip runtime state and large defaults to keep URL short' + N +
    '    const _skip = new Set([\'_score\',\'_wave\',\'_combo\',\'_timer\',\'_currentLevel\',' + N +
    '        \'_puSpeed\',\'_puShield\',\'_puMagnet\',\'_puDouble\',\'_lootMagnet\',\'_customPuScoreMul\',' + N +
    '        \'achievements\',\'customPowerUps\',\'levelConfigs\',\'events\',\'cutsceneSlides\',\'tileMap\']);' + N +
    '    const lc = {};' + N +
    '    Object.entries(liveConfig).forEach(([k,v]) => {' + N +
    '        if (_skip.has(k)) return;' + N +
    '        if (Array.isArray(v) && v.length === 0) return;' + N +
    '        lc[k] = v;' + N +
    '    });' + N +
    '    const isDefaultMap = !d.map || (Array.isArray(d.map) && d.map.every(v => v === 0));' + N +
    '    return { title:d.title, genre, speed:d.speed, gravity:d.gravity, jump:d.jump,' + N +
    '             map: isDefaultMap ? null : d.map,' + N +
    '             liveConfig: lc,' + N +
    '             theme:{cols:gameTheme.cols.slice(),name:gameTheme.name},' + N +
    '             bestScore, forkCount };' + N +
    '}',

    'function _buildSharePayload(d) {' + N +
    '    const genre = d.genre || \'SHOOTER\';' + N +
    '    let bestScore = 0;' + N +
    '    try { const board=JSON.parse(localStorage.getItem(\'jv_lb_\'+genre)||\'[]\'); bestScore=board.length?board[0].score:0; } catch(e){}' + N +
    '    let forkCount = 0;' + N +
    '    try { forkCount = parseInt(localStorage.getItem(\'jv_fork_count\')||\'0\'); } catch(e){}' + N +
    '    // Delta-encode: only ship fields that differ from factory defaults' + N +
    '    const _skipKeys = new Set([\'_score\',\'_wave\',\'_combo\',\'_timer\',\'_currentLevel\',' + N +
    '        \'_puSpeed\',\'_puShield\',\'_puMagnet\',\'_puDouble\',\'_lootMagnet\',\'_customPuScoreMul\',' + N +
    '        \'achievements\',\'customPowerUps\',\'levelConfigs\',\'events\',\'cutsceneSlides\',\'tileMap\']);' + N +
    '    const defs = _lcDefaults || {};' + N +
    '    const lc = {};' + N +
    '    Object.entries(liveConfig).forEach(([k,v]) => {' + N +
    '        if (_skipKeys.has(k)) return;' + N +
    '        // Skip if identical to default (deep-compare via JSON)' + N +
    '        try { if (JSON.stringify(v) === JSON.stringify(defs[k])) return; } catch(e) {}' + N +
    '        lc[k] = v;' + N +
    '    });' + N +
    '    const isDefaultMap = !d.map || (Array.isArray(d.map) && d.map.every(v => v === 0));' + N +
    '    return { title:d.title, genre, speed:d.speed, gravity:d.gravity, jump:d.jump,' + N +
    '             map: isDefaultMap ? null : d.map,' + N +
    '             lc: lc,' + N +  // use 'lc' (shorter key) instead of 'liveConfig'
    '             th:{c:gameTheme.cols.slice(),n:gameTheme.name},' + N +  // 'th' instead of 'theme'
    '             bs:bestScore,fk:forkCount };' + N +  // short keys
    '}',
    'Delta-encode _buildSharePayload'
);

// ── 3. Update URL handler to use new short keys + merge with defaults ─────────
// The handler at DOMContentLoaded applies: d.liveConfig → now d.lc
// Also handle the short theme key: d.th instead of d.theme
rep(
    '                if(d.liveConfig) { Object.assign(liveConfig, d.liveConfig); _syncCustomTabUI(d.liveConfig); }' + N +
    '                if(d.theme && d.theme.cols && d.theme.cols.length) applyPalette(d.theme);',
    '                // Support both old key (liveConfig) and new short key (lc)' + N +
    '                const _dlc = d.lc || d.liveConfig;' + N +
    '                if (_dlc) {' + N +
    '                    // Merge delta onto defaults so omitted fields use correct defaults' + N +
    '                    const _merged = Object.assign({}, _lcDefaults || {}, _dlc);' + N +
    '                    Object.assign(liveConfig, _merged);' + N +
    '                    _syncCustomTabUI(_merged);' + N +
    '                }' + N +
    '                // Support both old key (theme) and new short key (th)' + N +
    '                const _dth = (d.th && d.th.c) ? {cols:d.th.c,name:d.th.n} : d.theme;' + N +
    '                if(_dth && _dth.cols && _dth.cols.length) applyPalette(_dth);',
    'URL handler: use short keys + merge delta with defaults'
);

// ── 4. Fix _openShareModal to also handle short bestScore key ─────────────────
// bestScore was d.bestScore, now d.bs (but fallback to d.bestScore for old links)
rep(
    '                if (!board.some(e=>e.score===d.bestScore && e.date===\'🏆 Creator\')) {' + N +
    '                            board.push({ score: d.bestScore, date: \'🏆 Creator\' });',
    '                const _bs = d.bs !== undefined ? d.bs : (d.bestScore || 0);' + N +
    '                if (_bs > 0 && !board.some(e=>e.score===_bs && e.date===\'🏆 Creator\')) {' + N +
    '                            board.push({ score: _bs, date: \'🏆 Creator\' });',
    'Handle short bestScore key (bs) in URL handler'
);

// Also fix the bestScore check condition
rep(
    '                if (d.bestScore > 0) {' + N +
    '                    try {',
    '                if ((_bs||0) > 0) {' + N +
    '                    try {',
    'Fix bestScore > 0 check to use _bs'
);

// Write and verify
fs.writeFileSync('arcade-game-maker.html', c);

// Syntax check
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
