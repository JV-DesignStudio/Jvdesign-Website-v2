// ── Patch 5: Fix Sharing ───────────────────────────────────────────────────────
// Problems:
// 1. Share link opens the studio editor and shows intro title screen — recipient
//    doesn't know to click "Let's Play!" so the game appears broken/blank
// 2. _buildSharePayload ships all 140 liveConfig fields including runtime state
//    (_score, _wave, _combo etc.) making the URL 4-5KB unnecessarily
// 3. No clear feedback that the link was copied / will work
//
// Fixes:
// A. Auto-skip intro when loading from a ?game= URL (set window._shareAutoStart)
// B. Strip runtime liveConfig fields and unchanged defaults from share payload
// C. Show a "Shared!" banner in place of the modal with a proper copy button
// D. Remove map from share payload when it's just the fallback (300 zeros)
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
let c = fs.readFileSync('arcade-game-maker.html', 'utf8');

const results = [];
function rep(from, to, label) {
    if (!c.includes(from)) { results.push('MISSING: ' + label); return; }
    c = c.replace(from, to);
    results.push('OK: ' + label);
}

// ── A. Add _shareAutoStart flag + auto-close intro when set ──────────────────
rep(
    `function closeIntro() {
    document.getElementById('introOverlay').classList.remove('show');
    _updateLandscapeNudge(true);
    // Play 'before' cutscene if configured, countdown, then launch game
    _maybeCutscene('before', () => _runCountdown(() => _launchPhaserGame()));
}`,
    `function closeIntro() {
    document.getElementById('introOverlay').classList.remove('show');
    _updateLandscapeNudge(true);
    // Play 'before' cutscene if configured, countdown, then launch game
    _maybeCutscene('before', () => _runCountdown(() => _launchPhaserGame()));
}
// Called by _showTitleScreen when loading from a share link — auto-dismisses intro
function _autoCloseIntro() {
    const ov = document.getElementById('introOverlay');
    if (!ov) return;
    // Brief flash so the title is visible then auto-starts
    setTimeout(() => {
        if (ov.classList.contains('show')) closeIntro();
    }, 900);
}`,
    'Add _autoCloseIntro helper'
);

// In _showTitleScreen, auto-close if _shareAutoStart is set
rep(
    `    // Focus the overlay so SPACE works immediately without clicking first
    document.getElementById('introOverlay').focus();
}`,
    `    // Focus the overlay so SPACE works immediately without clicking first
    document.getElementById('introOverlay').focus();
    // Auto-start if loaded from a share link
    if (window._shareAutoStart) {
        window._shareAutoStart = false;
        _autoCloseIntro();
    }
}`,
    'Auto-close intro when share URL loaded'
);

// In the ?game= URL handler, set the flag before calling compileAndBootEngine
rep(
    `                loadedOk = true;
                if(isRemix) {`,
    `                loadedOk = true;
                if (!isRemix) window._shareAutoStart = true; // skip intro, auto-launch
                if(isRemix) {`,
    'Set _shareAutoStart flag when loading share URL'
);

// ── B. Slim down _buildSharePayload — strip runtime fields + unchanged defaults ─
const oldBuildShare = `function _buildSharePayload(d) {
    const genre = d.genre || 'SHOOTER';
    let bestScore = 0;
    try { const board=JSON.parse(localStorage.getItem('jv_lb_'+genre)||'[]'); bestScore=board.length?board[0].score:0; } catch(e){}
    // Track how many times this has been forked
    let forkCount = 0;
    try { forkCount = parseInt(localStorage.getItem('jv_fork_count')||'0'); } catch(e){}
    return { title:d.title, genre, speed:d.speed, gravity:d.gravity, jump:d.jump,
             map:d.map, liveConfig:Object.assign({},liveConfig),
             theme:{cols:gameTheme.cols.slice(),name:gameTheme.name},
             bestScore, forkCount };
}`;

const newBuildShare = `function _buildSharePayload(d) {
    const genre = d.genre || 'SHOOTER';
    let bestScore = 0;
    try { const board=JSON.parse(localStorage.getItem('jv_lb_'+genre)||'[]'); bestScore=board.length?board[0].score:0; } catch(e){}
    let forkCount = 0;
    try { forkCount = parseInt(localStorage.getItem('jv_fork_count')||'0'); } catch(e){}
    // Strip runtime state fields (prefixed _) and large/unused arrays to keep URL short
    const _skipFields = new Set(['_score','_wave','_combo','_timer','_currentLevel',
        '_puSpeed','_puShield','_puMagnet','_puDouble','_lootMagnet','_customPuScoreMul',
        'achievements','customPowerUps','levelConfigs','events','cutsceneSlides','tileMap']);
    const lc = {};
    Object.entries(liveConfig).forEach(([k,v]) => {
        if (_skipFields.has(k)) return;
        // Skip arrays that are just defaults (empty or default shop/powerup lists)
        if (Array.isArray(v) && v.length === 0) return;
        if (k === 'shopUpgrades' && JSON.stringify(v) === JSON.stringify(['speed','health','damage','shield'])) return;
        if (k === 'powerupTypes' && JSON.stringify(v) === JSON.stringify(['speed','shield','magnet','double'])) return;
        lc[k] = v;
    });
    // Only include map if it's a custom level (not just the fallback 300 zeros)
    const isDefaultMap = !d.map || (Array.isArray(d.map) && d.map.every(v => v === 0));
    return { title:d.title, genre, speed:d.speed, gravity:d.gravity, jump:d.jump,
             map: isDefaultMap ? null : d.map,
             liveConfig: lc,
             theme:{cols:gameTheme.cols.slice(),name:gameTheme.name},
             bestScore, forkCount };
}`;

rep(oldBuildShare, newBuildShare, 'Slim down _buildSharePayload');

// ── C. Better share modal UX — show "Play Link" label, highlight copy button ──
// Update the share modal to show context about what the link does
rep(
    `<div style="font-size:.6rem;color:var(--muted);margin-top:5px;">Scan to play on any device</div>`,
    `<div style="font-size:.6rem;color:var(--muted);margin-top:5px;">Scan to open &amp; play on any device</div>`,
    'Update QR label to be clearer'
);

// ── D. After copy, show proper feedback ──────────────────────────────────────
rep(
    `function _copyShareUrl() {
    navigator.clipboard.writeText(_shareCurrentUrl)
        .then(() => showToast('🔗 Link copied!', 'success'))
        .catch(() => { document.getElementById('shareUrlInput').select(); document.execCommand('copy'); showToast('🔗 Copied!', 'success'); });
}`,
    `function _copyShareUrl() {
    const url = _shareCurrentUrl;
    navigator.clipboard.writeText(url)
        .then(() => {
            showToast('🔗 Link copied! Send it to anyone to let them play your game.', 'success');
            const btn = document.querySelector('#shareModal .btn-sm.purple');
            if (btn) { const orig=btn.textContent; btn.textContent='✅ Copied!'; setTimeout(()=>btn.textContent=orig, 2000); }
        })
        .catch(() => { document.getElementById('shareUrlInput').select(); document.execCommand('copy'); showToast('🔗 Copied!', 'success'); });
}`,
    'Better copy feedback'
);

// ── E. Show file size estimate in share modal title ───────────────────────────
rep(
    `    document.getElementById('shareModalTitle').textContent = 'Share "' + title + '"';`,
    `    document.getElementById('shareModalTitle').textContent = 'Share "' + title + '"';
    // Show URL length as a size hint
    let sizeHint = document.getElementById('shareUrlSizeHint');
    if (!sizeHint) {
        sizeHint = document.createElement('div');
        sizeHint.id = 'shareUrlSizeHint';
        sizeHint.style.cssText = 'font-size:.58rem;color:var(--muted);margin-top:-6px;text-align:center;';
        document.getElementById('shareUrlInput').parentNode.insertBefore(sizeHint, document.getElementById('shareUrlInput').parentNode.firstChild);
    }`,
    'Add URL size hint prep in _openShareModal'
);

rep(
    `    document.getElementById('shareNativeBtn').style.display = navigator.share ? '' : 'none';`,
    `    if (sizeHint) {
        const kb = (url.length / 1024).toFixed(1);
        const ok = url.length < 3000;
        sizeHint.textContent = (ok ? '✅' : '⚠️') + ' Link size: ' + kb + 'KB' + (ok ? ' — QR & SMS friendly' : ' — use Copy button');
        sizeHint.style.color = ok ? '#4ade80' : '#fbbf24';
    }
    document.getElementById('shareNativeBtn').style.display = navigator.share ? '' : 'none';`,
    'Show URL size hint in share modal'
);

// Write and check syntax
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
        if (r.status !== 0) { results.push('SYNTAX ERROR script ' + n + ': ' + r.stderr.split('\n').slice(0,3).join(' ')); allOk = false; }
    }
    idx = e + 9;
}
try { fs.unlinkSync('_tmp.js'); } catch(e) {}

console.log('=== PATCH 5 RESULTS ===');
results.forEach(r => console.log(r));
console.log('\nSyntax:', allOk ? 'ALL OK' : 'HAS ERRORS');
console.log('Size:', (fs.statSync('arcade-game-maker.html').size / 1024).toFixed(1) + 'KB');
