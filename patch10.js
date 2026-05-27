// ── Patch 10: Game improvements ───────────────────────────────────────────────
// 1. Platformer: moving platforms in procedural level + collider wired up
// 2. Invaders: boss wave every 5th wave (multi-HP, sidescrolling boss)
//    — bullet-enemy overlap upgraded to support multi-HP enemies
// 3. Shooter: boss respawns every 500-pt milestone instead of ending the game
// 4. Beat Em Up: damage pop-up on non-kill hits (show hit flash number)
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

// ── 1a. Platformer: add _movPlats physics group alongside hazards ─────────────
rep(
    '            this.platforms = this.physics.add.staticGroup();' + N +
    '            this.hazards   = this.physics.add.group();' + N +
    '            this._coinGrp  = this.physics.add.group();' + N +
    '            this._buildLevel();',

    '            this.platforms = this.physics.add.staticGroup();' + N +
    '            this._movPlats = this.physics.add.group(); // kinematic moving platforms' + N +
    '            this.hazards   = this.physics.add.group();' + N +
    '            this._coinGrp  = this.physics.add.group();' + N +
    '            this._buildLevel();',
    'Platformer: add _movPlats group'
);

// ── 1b. Platformer: wire moving-platform collider with the actor ──────────────
rep(
    '            this.physics.add.collider(this.actor, this.platforms);',
    '            this.physics.add.collider(this.actor, this.platforms);' + N +
    '            this.physics.add.collider(this.actor, this._movPlats);',
    'Platformer: add actor ↔ _movPlats collider'
);

// ── 1c. Platformer: add 3 moving platforms to the procedural level ────────────
// Inject right before the end-goal flag section, after floating platforms loop.
rep(
    '                this.platforms.create(px, py, \'block\').setDisplaySize(pw,T).setTint(platCol).refreshBody();' + N +
    '            }' + N +
    '            // ──',

    '                this.platforms.create(px, py, \'block\').setDisplaySize(pw,T).setTint(platCol).refreshBody();' + N +
    '            }' + N +
    '            // Moving platforms — oscillate horizontally, use body.reset() to stay in sync' + N +
    '            if (this._movPlats) {' + N +
    '                const mpCol = themeInt(0, 0x00d4aa);' + N +
    '                const mpCount = 3;' + N +
    '                for (let mi = 0; mi < mpCount; mi++) {' + N +
    '                    const mpx = Math.round(400 + mi * Math.floor((WORLD_W - 600) / mpCount));' + N +
    '                    const mpy = Phaser.Math.Between(Math.round(GH * 0.38), GH - 90);' + N +
    '                    const mpw = Phaser.Math.Between(80, 130);' + N +
    '                    const mp = this._movPlats.create(mpx, mpy, \'block\').setDisplaySize(mpw, T).setTint(mpCol);' + N +
    '                    mp.body.allowGravity = false;' + N +
    '                    mp.setImmovable(true);' + N +
    '                    const range = Phaser.Math.Between(80, 150);' + N +
    '                    this.tweens.add({' + N +
    '                        targets: mp, x: mpx + range, duration: 1800 + mi * 600,' + N +
    '                        yoyo: true, repeat: -1, ease: \'Sine.easeInOut\',' + N +
    '                        onUpdate: () => { if (mp.active && mp.body) mp.body.reset(mp.x, mp.y); }' + N +
    '                    });' + N +
    '                }' + N +
    '            }' + N +
    '            // ──',
    'Platformer: add 3 oscillating moving platforms to procedural level'
);

// ── 2a. Invaders: upgrade bullet-enemy overlap to support multi-HP bosses ─────
// Original code destroys enemy immediately; now checks HP first.
// Regular enemies have no HP set → getData('hp') is undefined → (undefined||1)-1=0 → destroy (same as before).
// Boss enemies setData('hp', N) → take multiple hits.
rep(
    '                b.destroy(); e.destroy();' + N +
    '                _triggerHaptic(\'kill\');',

    '                b.destroy();' + N +
    '                // Multi-HP support: boss enemies set hp > 1; regular enemies fall through at hp=0' + N +
    '                const _ehp = (e.getData(\'hp\') || 1) - 1;' + N +
    '                e.setData(\'hp\', _ehp);' + N +
    '                if (_ehp > 0) {' + N +
    '                    // Hit but not killed — flash white, update boss HP bar' + N +
    '                    e.setTint(0xffffff);' + N +
    '                    this.time.delayedCall(80, () => { if (e.active) e.setTint(0xff2222); });' + N +
    '                    const _hBar = e.getData(\'hpFg\');' + N +
    '                    const _hTxt = e.getData(\'hpTxt\');' + N +
    '                    const _mhp  = e.getData(\'maxHp\') || 1;' + N +
    '                    if (_hBar) { _hBar.width = Math.round(160 * (_ehp / _mhp)); }' + N +
    '                    if (_hTxt) { _hTxt.setText(\'BOSS HP: \' + _ehp + \'/\' + _mhp); }' + N +
    '                    GameAudio.play(\'hit\');' + N +
    '                    return;' + N +
    '                }' + N +
    '                // Enemy fully dead — clean up boss UI if present' + N +
    '                const _hBg = e.getData(\'hpBg\'); if (_hBg && _hBg.active) _hBg.destroy();' + N +
    '                const _hBr = e.getData(\'hpFg\'); if (_hBr && _hBr.active) _hBr.destroy();' + N +
    '                const _hT  = e.getData(\'hpTxt\'); if (_hT  && _hT.active)  _hT.destroy();' + N +
    '                if (e.getData(\'isBoss\')) { showToast(\'💀 Boss defeated! +300 pts\'); this.score += 300; this.scoreText.setText(\'Score: \'+this.score); GameAudio.play(\'levelUp\'); }' + N +
    '                e.destroy();' + N +
    '                _triggerHaptic(\'kill\');',
    'Invaders: multi-HP boss support in bullet-enemy overlap'
);

// ── 2b. Invaders: spawn boss every 5th wave instead of normal formation ────────
rep(
    '                    this._buildFormation(); this.score+=100;',
    '                    // Boss wave every 5th wave' + N +
    '                    if (this._wave % 5 === 0) {' + N +
    '                        this._spawnInvaderBoss(); this.score += 200;' + N +
    '                    } else {' + N +
    '                        this._buildFormation(); this.score += 100;' + N +
    '                    }',
    'Invaders: boss wave every 5th wave'
);

// ── 2c. Invaders: add _spawnInvaderBoss() method ─────────────────────────────
// Add before _buildFormation (which is already defined)
rep(
    '        _buildFormation() {' + N +
    '            const rows=liveConfig.invaderRows||3, cols=liveConfig.invaderCols||8;',

    '        _spawnInvaderBoss() {' + N +
    '            showToast(\'⚡ BOSS WAVE! Defeat the giant alien!\');' + N +
    '            GameAudio.play(\'levelUp\');' + N +
    '            const bossHp = Math.min(12, 3 + Math.floor(this._wave / 5) * 2);' + N +
    '            const bx = GW / 2, by = 52;' + N +
    '            const boss = this.enemies.create(bx, by, \'enemy\').setDisplaySize(54, 50);' + N +
    '            boss.body.setSize(50, 46, true);' + N +
    '            boss.setTint(0xff2222);' + N +
    '            boss.body.allowGravity = false;' + N +
    '            boss.setData(\'hp\', bossHp);' + N +
    '            boss.setData(\'maxHp\', bossHp);' + N +
    '            boss.setData(\'isBoss\', true);' + N +
    '            // Strafe side-to-side' + N +
    '            this.tweens.add({ targets: boss, x: GW - 80, duration: 1400, yoyo: true, repeat: -1, ease: \'Sine.easeInOut\' });' + N +
    '            // HP bar (fixed to camera)' + N +
    '            const hpBg = this.add.rectangle(GW/2, 22, 164, 10, 0x333333, 0.85).setScrollFactor(0).setDepth(20);' + N +
    '            const hpFg = this.add.rectangle(GW/2 - 82, 22, 160, 8, 0xff2222).setOrigin(0, 0.5).setScrollFactor(0).setDepth(21);' + N +
    '            const hpTxt = this.add.text(GW/2, 32, \'BOSS HP: \'+bossHp+\'/\'+bossHp, { fontSize:\'9px\', fill:\'#fff\', stroke:\'#000\', strokeThickness:2 }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(22);' + N +
    '            boss.setData(\'hpBg\', hpBg);' + N +
    '            boss.setData(\'hpFg\', hpFg);' + N +
    '            boss.setData(\'hpTxt\', hpTxt);' + N +
    '            // Boss shoots a 3-spread burst every 1.8s' + N +
    '            this.time.addEvent({ delay: 1800, loop: true, callback: () => {' + N +
    '                if (!boss.active) return;' + N +
    '                [-28, 0, 28].forEach(ox => {' + N +
    '                    const eb = this.eBullets.create(boss.x + ox, boss.y + 28, \'laser\').setDisplaySize(8,14).setTint(0xff4444);' + N +
    '                    eb.body.allowGravity = false; eb.setVelocityY(220);' + N +
    '                });' + N +
    '            }});' + N +
    '        }' + N +
    '        _buildFormation() {' + N +
    '            const rows=liveConfig.invaderRows||3, cols=liveConfig.invaderCols||8;',
    'Invaders: add _spawnInvaderBoss() method with HP bar + spread shot'
);

// ── 3a. Shooter: use dynamic boss threshold (not one-shot) ───────────────────
rep(
    '            if (liveConfig.bossEnabled && !this._newBossActive && !this._newBossTriggered) {' + N +
    '                if (this.score >= (liveConfig.bossScore || 500)) {' + N +
    '                    this._newBossTriggered = true;' + N +
    '                    this._triggerNewBoss(time);' + N +
    '                }' + N +
    '            }',

    '            if (liveConfig.bossEnabled && !this._newBossActive && !this._newBossTriggered) {' + N +
    '                // Dynamic threshold: boss re-appears every bossScore pts after the last one' + N +
    '                const _bossThresh = (this._lastBossThresh || 0) + (liveConfig.bossScore || 500);' + N +
    '                if (this.score >= _bossThresh) {' + N +
    '                    this._newBossTriggered = true;' + N +
    '                    this._lastBossThresh = _bossThresh;' + N +
    '                    this._triggerNewBoss(time);' + N +
    '                }' + N +
    '            }',
    'Shooter: boss uses cumulative threshold so it respawns every N pts'
);

// ── 3b. Shooter: boss death — reset for next boss instead of ending game ──────
rep(
    '                        // Trigger victory if win condition is score-based' + N +
    '                        this.time.delayedCall(2200, ()=>{ showVictory(this.score); });',

    '                        // Reset so boss can re-appear at the next score milestone' + N +
    '                        this._newBossTriggered = false;' + N +
    '                        showToast(\'💀 Boss slain! Next boss at \' + ((this._lastBossThresh||(liveConfig.bossScore||500)) + (liveConfig.bossScore||500)) + \' pts\');',
    'Shooter: boss death resets trigger (repeat boss) instead of showVictory'
);

// ── 4. Beat Em Up: damage pop-up on non-kill hits ─────────────────────────────
// When an enemy takes a hit but still has HP, show a red hit number.
rep(
    '            this.tweens.add({targets:e,alpha:0.3,duration:80,yoyo:true});' + N +
    '            if (hp <= 0) {' + N +
    '                this._killCount++;',

    '            this.tweens.add({targets:e,alpha:0.3,duration:80,yoyo:true});' + N +
    '            // Hit indicator — show on damage, reddish for non-kill hits' + N +
    '            if (hp > 0) {' + N +
    '                if (typeof this._popText === \'function\') this._popText(e.x, e.y - 14, \'HIT!\', \'#ef4444\');' + N +
    '            }' + N +
    '            if (hp <= 0) {' + N +
    '                this._killCount++;',
    'Beat Em Up: show HIT! pop-up on non-lethal hits'
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
