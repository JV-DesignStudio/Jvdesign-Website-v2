const fs = require('fs');
let c = fs.readFileSync('arcade-game-maker.html', 'utf8');
const results = [];

function rep(from, to, label) {
    if (!c.includes(from)) { results.push('MISSING: ' + label); return; }
    c = c.replace(from, to);
    results.push('OK: ' + label);
}

// Use CRLF for all replacements
const N = '\r\n';

// ── A. Add _autoCloseIntro after closeIntro ───────────────────────────────────
rep(
    "function closeIntro() {" + N +
    "    document.getElementById('introOverlay').classList.remove('show');" + N +
    "    _updateLandscapeNudge(true);" + N +
    "    // Play 'before' cutscene if configured, countdown, then launch game" + N +
    "    _maybeCutscene('before', () => _runCountdown(() => _launchPhaserGame()));" + N +
    "}",
    "function closeIntro() {" + N +
    "    document.getElementById('introOverlay').classList.remove('show');" + N +
    "    _updateLandscapeNudge(true);" + N +
    "    _maybeCutscene('before', () => _runCountdown(() => _launchPhaserGame()));" + N +
    "}" + N +
    "function _autoCloseIntro() {" + N +
    "    const ov = document.getElementById('introOverlay');" + N +
    "    if (!ov) return;" + N +
    "    setTimeout(() => { if (ov.classList.contains('show')) closeIntro(); }, 800);" + N +
    "}",
    'Add _autoCloseIntro'
);

// ── B. Auto-start in _showTitleScreen ────────────────────────────────────────
rep(
    "    // Focus the overlay so SPACE works immediately without clicking first" + N +
    "    document.getElementById('introOverlay').focus();" + N +
    "}",
    "    // Focus the overlay so SPACE works immediately without clicking first" + N +
    "    document.getElementById('introOverlay').focus();" + N +
    "    if (window._shareAutoStart) { window._shareAutoStart = false; _autoCloseIntro(); }" + N +
    "}",
    'Auto-start in _showTitleScreen'
);

// ── C. Set _shareAutoStart in URL handler ────────────────────────────────────
rep(
    "                loadedOk = true;" + N +
    "                if(isRemix) {",
    "                loadedOk = true;" + N +
    "                if (!isRemix) window._shareAutoStart = true;" + N +
    "                if(isRemix) {",
    'Set _shareAutoStart in URL handler'
);

// ── D. Slim _buildSharePayload ────────────────────────────────────────────────
rep(
    "function _buildSharePayload(d) {" + N +
    "    const genre = d.genre || 'SHOOTER';" + N +
    "    let bestScore = 0;" + N +
    "    try { const board=JSON.parse(localStorage.getItem('jv_lb_'+genre)||'[]'); bestScore=board.length?board[0].score:0; } catch(e){}" + N +
    "    // Track how many times this has been forked" + N +
    "    let forkCount = 0;" + N +
    "    try { forkCount = parseInt(localStorage.getItem('jv_fork_count')||'0'); } catch(e){}" + N +
    "    return { title:d.title, genre, speed:d.speed, gravity:d.gravity, jump:d.jump," + N +
    "             map:d.map, liveConfig:Object.assign({},liveConfig)," + N +
    "             theme:{cols:gameTheme.cols.slice(),name:gameTheme.name}," + N +
    "             bestScore, forkCount };" + N +
    "}",
    "function _buildSharePayload(d) {" + N +
    "    const genre = d.genre || 'SHOOTER';" + N +
    "    let bestScore = 0;" + N +
    "    try { const board=JSON.parse(localStorage.getItem('jv_lb_'+genre)||'[]'); bestScore=board.length?board[0].score:0; } catch(e){}" + N +
    "    let forkCount = 0;" + N +
    "    try { forkCount = parseInt(localStorage.getItem('jv_fork_count')||'0'); } catch(e){}" + N +
    "    // Strip runtime state and large defaults to keep URL short" + N +
    "    const _skip = new Set(['_score','_wave','_combo','_timer','_currentLevel'," + N +
    "        '_puSpeed','_puShield','_puMagnet','_puDouble','_lootMagnet','_customPuScoreMul'," + N +
    "        'achievements','customPowerUps','levelConfigs','events','cutsceneSlides','tileMap']);" + N +
    "    const lc = {};" + N +
    "    Object.entries(liveConfig).forEach(([k,v]) => {" + N +
    "        if (_skip.has(k)) return;" + N +
    "        if (Array.isArray(v) && v.length === 0) return;" + N +
    "        lc[k] = v;" + N +
    "    });" + N +
    "    const isDefaultMap = !d.map || (Array.isArray(d.map) && d.map.every(v => v === 0));" + N +
    "    return { title:d.title, genre, speed:d.speed, gravity:d.gravity, jump:d.jump," + N +
    "             map: isDefaultMap ? null : d.map," + N +
    "             liveConfig: lc," + N +
    "             theme:{cols:gameTheme.cols.slice(),name:gameTheme.name}," + N +
    "             bestScore, forkCount };" + N +
    "}",
    'Slim _buildSharePayload'
);

// ── E. Better _copyShareUrl feedback ─────────────────────────────────────────
rep(
    "function _copyShareUrl() {" + N +
    "    navigator.clipboard.writeText(_shareCurrentUrl)" + N +
    "        .then(() => showToast('🔗 Link copied!', 'success'))" + N +
    "        .catch(() => { document.getElementById('shareUrlInput').select(); document.execCommand('copy'); showToast('🔗 Copied!', 'success'); });" + N +
    "}",
    "function _copyShareUrl() {" + N +
    "    navigator.clipboard.writeText(_shareCurrentUrl)" + N +
    "        .then(() => {" + N +
    "            showToast('🔗 Copied! Anyone with this link can open and play your game.', 'success');" + N +
    "            const btn = document.querySelector('#shareModal .btn-sm.purple');" + N +
    "            if (btn) { const orig=btn.textContent; btn.textContent='✅ Copied!'; setTimeout(()=>btn.textContent=orig, 2500); }" + N +
    "        })" + N +
    "        .catch(() => { document.getElementById('shareUrlInput').select(); document.execCommand('copy'); showToast('🔗 Copied!', 'success'); });" + N +
    "}",
    'Better _copyShareUrl feedback'
);

fs.writeFileSync('arcade-game-maker.html', c);

// Syntax check
const { spawnSync } = require('child_process');
const c2 = fs.readFileSync('arcade-game-maker.html', 'utf8');
let idx2 = 0, n = 0, allOk = true;
while (true) {
    const s = c2.indexOf('<script', idx2);
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
    idx2 = e + 9;
}
try { fs.unlinkSync('_tmp.js'); } catch(e) {}

results.forEach(r => console.log(r));
console.log('\nSyntax:', allOk ? 'ALL OK' : 'HAS ERRORS');
console.log('Size:', (fs.statSync('arcade-game-maker.html').size/1024).toFixed(1) + 'KB');
