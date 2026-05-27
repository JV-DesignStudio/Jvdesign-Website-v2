// ── Patch 9: Fix 9 game-specific bugs ─────────────────────────────────────────
// 1. Flappy Bird crashes  → gapY undefined in _spawnPipe()
// 2. Breaker ball never falls → setCollideWorldBounds blocks bottom
// 3. Pong controls broken → W/S only bound to 2P right paddle; fire used for down
// 4. Asteroids cramped → rocks spawn touching player; add safe-zone exclusion
// 5. Roguelike doors open with enemies → add _roomSpawnDone guard flag
// 6. Beat Em Up not good → add enemy knockback on hit
// 7. Pinball stuck / small space → anti-stuck nudge + widen wall bounds
// 8. Clicker can't buy upgrades → tc-joy-zone covers buttons; hide for CLICKER/MEMORY
// 9. Share shows just the engine → _syncCustomTabUI throws, silently aborts share load
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

// ── 1. Flappy Bird: define gapY before pipe creation ─────────────────────────
rep(
    '            const spd = -Math.max(120, liveConfig.obstacleSpeed + Math.floor(this.score * 2.8));' + N +
    '            const tp=this.pipes.create(GW+30,gapY/2,\'block\').setDisplaySize(40,gapY);',

    '            const spd = -Math.max(120, liveConfig.obstacleSpeed + Math.floor(this.score * 2.8));' + N +
    '            const gapY = Phaser.Math.Between(50, GH - gap - 50);' + N +
    '            const tp=this.pipes.create(GW+30,gapY/2,\'block\').setDisplaySize(40,gapY);',
    'Flappy: define gapY before pipe creation (was undefined → crash)'
);

// ── 2. Breaker: open bottom world bound so ball can fall past paddle ──────────
rep(
    '            this.ball.setBounce(1).setCollideWorldBounds(true);' + N +
    '            this.ball.body.allowGravity=false; this.ball.body.checkCollision.down=false;',

    '            this.ball.setBounce(1).setCollideWorldBounds(true);' + N +
    '            this.physics.world.setBounds(0, 0, GW, GH, true, true, true, false); // open bottom so ball drains' + N +
    '            this.ball.body.allowGravity=false; this.ball.body.checkCollision.down=false;',
    'Breaker: disable bottom world bound so ball falls past paddle'
);

// ── 3. Pong: W/S also controls left (player) paddle in 1P mode; fix touch down ─
rep(
    '            if(up.isDown||touchInput.up)                            this.pLeft.setVelocityY(-liveConfig.speed);' + N +
    '            else if(down.isDown||this.spaceKey.isDown||touchInput.fire) this.pLeft.setVelocityY(liveConfig.speed);' + N +
    '            else                                                    this.pLeft.setVelocityY(0);',

    '            // W/S also move the player paddle in 1P mode (no conflict in 2P — pRight gets W/S below)' + N +
    '            const _p1Up   = up.isDown   || touchInput.up   || (!liveConfig.pong2Player && this.p2Up.isDown);' + N +
    '            const _p1Down = down.isDown || touchInput.down || this.spaceKey.isDown || (!liveConfig.pong2Player && this.p2Down.isDown);' + N +
    '            if(_p1Up)        this.pLeft.setVelocityY(-liveConfig.speed);' + N +
    '            else if(_p1Down) this.pLeft.setVelocityY(liveConfig.speed);' + N +
    '            else             this.pLeft.setVelocityY(0);',
    'Pong: W/S move player paddle in 1P mode; touchInput.down replaces .fire'
);

// ── 4. Asteroids: add safe-spawn zone so rocks don\'t appear on the player ─────
rep(
    '                const x = side===0?0 : side===1?GW : Phaser.Math.Between(0,GW);' + N +
    '                const y = side===2?0 : side===3?GH : Phaser.Math.Between(0,GH);' + N +
    '                this._spawnRock(x, y, \'large\');',

    '                let x = side===0?0 : side===1?GW : Phaser.Math.Between(0,GW);' + N +
    '                let y = side===2?0 : side===3?GH : Phaser.Math.Between(0,GH);' + N +
    '                // Keep rocks at least 120px away from the player\'s start (centre)' + N +
    '                if (Math.abs(x - GW/2) < 120 && Math.abs(y - GH/2) < 100) x = x < GW/2 ? 0 : GW;' + N +
    '                this._spawnRock(x, y, \'large\');',
    'Asteroids: push rocks away from player spawn so game starts less cramped'
);

// ── 5. Roguelike: guard door-open check with _roomSpawnDone flag ──────────────
// Without this flag, the first update() tick after _buildRoom() could see
// countActive()==0 for one frame before enemy physics bodies activate.
rep(
    '                for(let i=0;i<eCount;i++) this._spawnEnemyRandom();' + N +
    '                // Enemy shooting (floor 1 = slow, gets faster every floor)',

    '                for(let i=0;i<eCount;i++) this._spawnEnemyRandom();' + N +
    '                this._roomSpawnDone = true; // enemies placed — door-open check can now run' + N +
    '                // Enemy shooting (floor 1 = slow, gets faster every floor)',
    'Roguelike: set _roomSpawnDone=true after all enemies are placed'
);

// Clear the flag at room start (in _buildRoom just after _roomCleared=false)
rep(
    '            this._boss=null; this._roomCleared=false; this._doorOpen=false;',
    '            this._boss=null; this._roomCleared=false; this._doorOpen=false; this._roomSpawnDone=false;',
    'Roguelike: reset _roomSpawnDone at start of _buildRoom'
);

// For shop/treasure rooms that open the door immediately, also set the flag
// (they call _openDoor() directly, so _roomSpawnDone doesn't need to gate them)
// Instead, gate the update() door-open check on the flag
rep(
    '            const anyAlive = this.enemies.countActive(true) + this._ghosts.countActive(true);' + N +
    '            if(anyAlive===0 && !this._roomCleared && !this._isBossRoom){',

    '            const anyAlive = this.enemies.countActive(true) + this._ghosts.countActive(true);' + N +
    '            if(anyAlive===0 && this._roomSpawnDone && !this._roomCleared && !this._isBossRoom){',
    'Roguelike: only open door after _roomSpawnDone (prevents premature open)'
);

// ── 6. Beat Em Up: add knockback when hitting enemies ─────────────────────────
rep(
    '            this.tweens.add({targets:e,alpha:0.3,duration:80,yoyo:true});',
    '            // Knockback — push enemy away from player on hit' + N +
    '            const _kbDir = e.x >= this.actor.x ? 1 : -1;' + N +
    '            e.setVelocityX(_kbDir * 280);' + N +
    '            this.time.delayedCall(160, () => { if (e.active) e.setVelocityX(0); });' + N +
    '            this.tweens.add({targets:e,alpha:0.3,duration:80,yoyo:true});',
    'Beat Em Up: add knockback velocity on enemy hit'
);

// ── 7. Pinball: widen play field + add anti-stuck ball nudge ─────────────────
// Widen walls from 26px to 14px each side (GW-52 → GW-28 wide, more room to play)
rep(
    '            this.physics.world.setBounds(26, -600, GW - 52, GH + 800);',
    '            this.physics.world.setBounds(14, -600, GW - 28, GH + 800);',
    'Pinball: widen play field (14px walls instead of 26px)'
);

// Add anti-stuck nudge before _tickBase in update()
rep(
    '            this._tickBase(this.score);' + N +
    '        }' + N +
    N +
    '        _showMilestone(txt) {',

    '            // Anti-stuck: if ball is launched but barely moving, give it a kick upward' + N +
    '            if (this._launched) {' + N +
    '                const _bvx = this.ball.body ? Math.abs(this.ball.body.velocity.x) : 999;' + N +
    '                const _bvy = this.ball.body ? Math.abs(this.ball.body.velocity.y) : 999;' + N +
    '                if (_bvx + _bvy < 28) {' + N +
    '                    this._stuckMs = (this._stuckMs || 0) + delta;' + N +
    '                    if (this._stuckMs > 1800) {' + N +
    '                        this.ball.setVelocity((Math.random()-0.5)*260, -300 - Math.random()*120);' + N +
    '                        this._stuckMs = 0;' + N +
    '                    }' + N +
    '                } else { this._stuckMs = 0; }' + N +
    '            }' + N +
    '            this._tickBase(this.score);' + N +
    '        }' + N +
    N +
    '        _showMilestone(txt) {',
    'Pinball: anti-stuck nudge after 1800ms of near-zero ball velocity'
);

// ── 8. Clicker/Memory: hide joystick zone (it intercepts button clicks) ────────
// The tc-joy-zone (left 58% of screen, pointer-events:auto) was absorbing
// clicks meant for upgrade buttons and memory cards.
rep(
    "    const showLR = !['RUNNER','FLAPPY','PONG','DEFENSE','PINBALL','RHYTHM'].includes(genre);",
    "    const showLR = !['RUNNER','FLAPPY','PONG','DEFENSE','PINBALL','RHYTHM','CLICKER','MEMORY','BREAKER'].includes(genre);",
    'Clicker/Memory/Breaker: hide joystick zone so buttons receive pointer events'
);

// ── 9. Share URL: wrap _syncCustomTabUI in its own try/catch ──────────────────
// If _syncCustomTabUI throws (e.g. nextElementSibling is null), the outer
// try/catch swallows it and onGenreChange()/_shareAutoStart are never reached.
rep(
    '                if (_dlc) {' + N +
    '                    // Merge delta onto defaults so omitted fields use correct defaults' + N +
    '                    const _merged = Object.assign({}, _lcDefaults || {}, _dlc);' + N +
    '                    Object.assign(liveConfig, _merged);' + N +
    '                    _syncCustomTabUI(_merged);' + N +
    '                }',

    '                if (_dlc) {' + N +
    '                    // Merge delta onto defaults so omitted fields use correct defaults' + N +
    '                    const _merged = Object.assign({}, _lcDefaults || {}, _dlc);' + N +
    '                    Object.assign(liveConfig, _merged);' + N +
    '                    try { _syncCustomTabUI(_merged); } catch(e) {} // non-critical: don\'t abort share load' + N +
    '                }',
    'Share: wrap _syncCustomTabUI in try/catch so UI errors don\'t abort game load'
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
