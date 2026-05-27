// ── Patch 7: Performance + theme-matching examples ────────────────────────────
// 1. _spawnParticles: ditch Graphics objects → cheap Arc/Rectangle Shapes
//    Graphics allocs a full WebGL buffer per object; Arc/Rectangle re-use batched
//    geometry. 3-5× cheaper. Also reduce default count 12 → 8.
// 2. sceneInvaders kill handler: remove duplicate _spawnParticles call
//    (_burst already fires the juice burst — don't double-spawn particles)
// 3. sceneInvaders update: throttle AI overlay to every-other frame
// 4. sceneClicker: throttle particles to every 3rd click
// 5. Starter template buttons: swap candy/castle/forest for dark-theme examples
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

// ── 1. Replace _spawnParticles with shape-based version ───────────────────────
rep(
    'function _spawnParticles(scene, x, y, opts) {' + N +
    '    opts = opts || {};' + N +
    '    const count = opts.count !== undefined ? opts.count : (liveConfig.particleCount || 12);' + N +
    '    const style = opts.style || liveConfig.particleStyle || \'burst\';' + N +
    '    const colorKey = opts.color || liveConfig.particleColor || \'purple\';' + N +
    '    const sizeKey  = liveConfig.particleSize || \'medium\';' + N +
    '    const COLORS = { purple:0xa78bfa, red:0xef4444, green:0x4ade80, gold:0xfbbf24, blue:0x60a5fa };' + N +
    '    const SIZES  = { small:3, medium:6, large:11 };' + N +
    '    const sz = SIZES[sizeKey] || 6;' + N +
    '    const isRainbow = colorKey === \'rainbow\';' + N +
    '    const baseColor = COLORS[colorKey] || 0xa78bfa;' + N +
    '    for (let i = 0; i < count; i++) {' + N +
    '        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;' + N +
    '        const spd   = 55 + Math.random() * 130;' + N +
    '        const col   = isRainbow ? Phaser.Display.Color.HSVToRGB(i / count, 0.9, 0.95).color : baseColor;' + N +
    '        const g = scene.add.graphics();' + N +
    '        if (style === \'star\' || style === \'sparkle\') {' + N +
    '            g.fillStyle(col, 1);' + N +
    '            g.fillPoints([' + N +
    '                {x:0,y:-sz},{x:sz*0.3,y:-sz*0.3},{x:sz,y:0},{x:sz*0.3,y:sz*0.3},' + N +
    '                {x:0,y:sz},{x:-sz*0.3,y:sz*0.3},{x:-sz,y:0},{x:-sz*0.3,y:-sz*0.3}' + N +
    '            ], true);' + N +
    '        } else {' + N +
    '            g.fillStyle(col, 1).fillCircle(0, 0, sz * 0.5);' + N +
    '        }' + N +
    '        g.setPosition(x, y).setDepth(50);' + N +
    '        scene.tweens.add({' + N +
    '            targets: g,' + N +
    '            x: x + Math.cos(angle) * spd,' + N +
    '            y: y + Math.sin(angle) * spd,' + N +
    '            alpha: 0,' + N +
    '            scaleX: style === \'burst\' ? 0.15 : 1.4,' + N +
    '            scaleY: style === \'burst\' ? 0.15 : 1.4,' + N +
    '            duration: 380 + Math.random() * 220,' + N +
    '            onComplete: () => { try { g.destroy(); } catch(_){} }' + N +
    '        });' + N +
    '    }' + N +
    '    if (style === \'swirl\') {' + N +
    '        for (let i = 0; i < 3; i++) {' + N +
    '            const ring = scene.add.graphics().lineStyle(2, isRainbow ? 0xfbbf24 : baseColor, 0.7).strokeCircle(0, 0, sz).setPosition(x, y).setDepth(49);' + N +
    '            scene.tweens.add({ targets: ring, scaleX: 4 + i, scaleY: 4 + i, alpha: 0, duration: 300 + i * 100, onComplete: () => { try { ring.destroy(); } catch(_){} } });' + N +
    '        }' + N +
    '    }' + N +
    '}',

    'function _spawnParticles(scene, x, y, opts) {' + N +
    '    opts = opts || {};' + N +
    '    const count = opts.count !== undefined ? opts.count : (liveConfig.particleCount || 8);' + N +
    '    const style = opts.style || liveConfig.particleStyle || \'burst\';' + N +
    '    const colorKey = opts.color || liveConfig.particleColor || \'purple\';' + N +
    '    const sizeKey  = liveConfig.particleSize || \'medium\';' + N +
    '    const COLORS = { purple:0xa78bfa, red:0xef4444, green:0x4ade80, gold:0xfbbf24, blue:0x60a5fa };' + N +
    '    const SIZES  = { small:3, medium:5, large:9 };' + N +
    '    const sz = SIZES[sizeKey] || 5;' + N +
    '    const isRainbow = colorKey === \'rainbow\';' + N +
    '    const baseColor = COLORS[colorKey] || 0xa78bfa;' + N +
    '    // Use Arc/Rectangle Shapes — far cheaper than Graphics objects' + N +
    '    // (Graphics allocs a full WebGL buffer per object; Shapes are batched)' + N +
    '    for (let i = 0; i < count; i++) {' + N +
    '        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;' + N +
    '        const spd   = 50 + Math.random() * 110;' + N +
    '        const col   = isRainbow ? Phaser.Display.Color.HSVToRGB(i / count, 0.9, 0.95).color : baseColor;' + N +
    '        const p = (style === \'star\' || style === \'sparkle\')' + N +
    '            ? scene.add.rectangle(x, y, sz, sz, col).setDepth(50)' + N +
    '            : scene.add.circle(x, y, sz * 0.6, col).setDepth(50);' + N +
    '        scene.tweens.add({' + N +
    '            targets: p,' + N +
    '            x: x + Math.cos(angle) * spd,' + N +
    '            y: y + Math.sin(angle) * spd,' + N +
    '            alpha: 0,' + N +
    '            scaleX: 0.2,' + N +
    '            scaleY: 0.2,' + N +
    '            duration: 360 + Math.random() * 200,' + N +
    '            onComplete: () => { try { p.destroy(); } catch(_){} }' + N +
    '        });' + N +
    '    }' + N +
    '    if (style === \'swirl\') {' + N +
    '        // Expanding Arc rings — much cheaper than Graphics strokeCircle' + N +
    '        for (let i = 0; i < 3; i++) {' + N +
    '            const r = scene.add.circle(x, y, sz * (i + 1), isRainbow ? 0xfbbf24 : baseColor, 0.55).setDepth(49);' + N +
    '            scene.tweens.add({ targets: r, scaleX: 3 + i, scaleY: 3 + i, alpha: 0, duration: 280 + i * 90, onComplete: () => { try { r.destroy(); } catch(_){} } });' + N +
    '        }' + N +
    '    }' + N +
    '}',
    'Replace _spawnParticles with Shape-based version (no Graphics objects)'
);

// ── 2. Invaders kill: remove duplicate _spawnParticles call ───────────────────
// _burst already fires a juice burst — calling _spawnParticles too doubles cost
rep(
    '                this._burst(e.x,e.y,themeInt(1,0xa78bfa));' + N +
    '                _spawnParticles(this, e.x, e.y);' + N +
    '                const ex = e.x, ey = e.y;',
    '                this._burst(e.x,e.y,themeInt(1,0xa78bfa));' + N +
    '                const ex = e.x, ey = e.y;',
    'Invaders kill: remove duplicate _spawnParticles (kept _burst)'
);

// ── 3. Invaders AI overlay: throttle to every other frame ─────────────────────
rep(
    '            // ── Enemy AI overlay for invaders ─────────────────────────────────' + N +
    '            const invAI = liveConfig.enemyAI || \'classic\';' + N +
    '            if (invAI !== \'classic\') {',
    '            // ── Enemy AI overlay for invaders (throttled: every 2nd frame) ────' + N +
    '            this._aiTick = (this._aiTick || 0) + 1;' + N +
    '            const invAI = liveConfig.enemyAI || \'classic\';' + N +
    '            if (invAI !== \'classic\' && this._aiTick % 2 === 0) {',
    'Invaders AI overlay: throttle to every-other frame'
);

// ── 4. Clicker: throttle particles to every 3rd click ─────────────────────────
rep(
    'btn.on(\'pointerdown\', () => {' + N +
    '                liveConfig._score += _mult + Math.floor(_autoRate / 2);' + N +
    '                this.tweens.add({ targets: btn, scaleX: 1.25, scaleY: 1.25, duration: 60, yoyo: true });' + N +
    '                _spawnParticles(this, GW/2, GH/2 - 30, { count: 6, style: \'burst\' });' + N +
    '                GameAudio.play(\'score\');',
    'btn.on(\'pointerdown\', () => {' + N +
    '                liveConfig._score += _mult + Math.floor(_autoRate / 2);' + N +
    '                this.tweens.add({ targets: btn, scaleX: 1.25, scaleY: 1.25, duration: 60, yoyo: true });' + N +
    '                // Throttle particles: spawn every 3rd click to keep framerate smooth' + N +
    '                _clickN = (_clickN + 1) % 3;' + N +
    '                if (_clickN === 0) _spawnParticles(this, GW/2, GH/2 - 30, { count: 5, style: \'burst\' });' + N +
    '                GameAudio.play(\'score\');',
    'Clicker: throttle particles every 3rd click'
);

// Add _clickN variable declaration before the button
rep(
    '            let _mult = 1;' + N +
    '            const btn = this.add.text(GW/2, GH/2 - 30,',
    '            let _mult = 1, _clickN = 0;' + N +
    '            const btn = this.add.text(GW/2, GH/2 - 30,',
    'Clicker: add _clickN throttle counter'
);

// ── 5. Starter template buttons: replace candy/castle/forest with dark themes ─
rep(
    'onclick="_loadTemplate(\'ocean_shooter\')">🌊 Ocean Shooter</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'castle_boss\')">🏰 Castle Boss Rush</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'candy_runner\')">🍬 Candy Runner</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'cyber_invaders\')">🤖 Cyber Invaders</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'forest_platform\')">🌲 Forest Platformer</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'space_survival\')">🚀 Space Survival</button>',

    'onclick="_loadTemplate(\'space_survival\')">🚀 Space Survival</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'cyber_invaders\')">🤖 Cyber Invaders</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'neon_wave\')">💫 Neon Wave</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'ocean_shooter\')">🌊 Ocean Shooter</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'ghost_maze\')">👻 Ghost Maze</button>' + N +
    '                <button class="starter-btn" onclick="_loadTemplate(\'dino_runner\')">🦕 Dino Dash</button>',
    'Starter buttons: swap to dark-themed examples'
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
