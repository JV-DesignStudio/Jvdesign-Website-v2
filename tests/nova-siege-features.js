#!/usr/bin/env node
/*
 * tests/nova-siege-features.js
 *
 * Covers the 2026 Nova Siege update: modes, seeded Daily Challenge, difficulty,
 * local leaderboard, EMP pickup, Shielder + Ion Serpent content, the new
 * evolutions, the Specter hull, pause/help panels, mute, WASD and Escape,
 * wave progress, event announcements, anti-softlock wave progress and the
 * transient-power / forceEnd fixes.
 *
 * Run: node tests/nova-siege-features.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function watch(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(t)) return;
    errors.push('console: ' + t);
  });
  return errors;
}

(async () => {
  await withServer(async ({ base, browser }) => {
    const page = await browser.newPage();
    const errors = watch(page);
    await page.evaluateOnNewDocument(() => {
      try { localStorage.removeItem('jvds-nova-siege-v1'); localStorage.removeItem('jvds-nova-last-run'); } catch (e) {}
    });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });

    const start = async (mode) => {
      if (mode) await page.evaluate(m => window.__nova.setMode(m), mode);
      await page.evaluate(() => document.getElementById('startBtn').click());
      await sleep(260);
    };
    const leaveShop = () => page.evaluate(() => { if (window.__nova.shopOpen) document.getElementById('shopLeave').click(); });

    // 1. Title screen controls and Daily mode.
    const title = await page.evaluate(() => ({
      modes: document.querySelectorAll('.modebtn').length,
      diff: !!document.getElementById('diffBtn'),
      help: !!document.getElementById('helpBtn'),
      lb: /LOCAL TOP 5/.test(document.getElementById('leaderboard').textContent),
      daily: /Daily/.test(document.getElementById('dailyStats').textContent)
    }));
    check('title: mode, difficulty, help and leaderboard controls render', title.modes === 4 && title.diff && title.help && title.lb && title.daily, JSON.stringify(title));
    await page.evaluate(() => window.__nova.setMode('daily'));
    const dailyPressed = await page.evaluate(() => document.getElementById('modeDaily').getAttribute('aria-pressed'));
    check('modes: Daily marks itself selected', dailyPressed === 'true', String(dailyPressed));
    await start();
    const dailyRun = await page.evaluate(() => ({ mode: window.__nova.mode, seed: window.__nova.seed }));
    check('daily: starts in daily mode with a date seed', dailyRun.mode === 'daily' && typeof dailyRun.seed === 'number' && dailyRun.seed > 0, JSON.stringify(dailyRun));

    // 2. Seeded RNG is reproducible.
    const seqA = await page.evaluate(() => { window.__nova.setSeed(12345); const a = []; for (let i = 0; i < 60; i++) a.push(window.__nova.pickKind()); return a; });
    const seqB = await page.evaluate(() => { window.__nova.setSeed(12345); const a = []; for (let i = 0; i < 60; i++) a.push(window.__nova.pickKind()); return a; });
    check('daily: the same seed produces the same enemy sequence', JSON.stringify(seqA) === JSON.stringify(seqB), seqA.slice(0, 6).join(','));
    await page.evaluate(() => window.__nova.setSeed(null));

    // 3. Difficulty cycles and applies to a new run.
    const diffBefore = await page.evaluate(() => window.__nova.diff);
    await page.evaluate(() => window.__nova.cycleDiff());
    const diffAfter = await page.evaluate(() => window.__nova.diff);
    await start('classic');
    check('difficulty: the selector cycles and the run reads it', diffAfter !== diffBefore && (await page.evaluate(() => window.__nova.diff)) === diffAfter, diffBefore + '->' + diffAfter);
    await page.evaluate(() => { window.__nova.cycleDiff(); window.__nova.cycleDiff(); }); // back to Pilot

    // 4. Boss Rush starts on a boss.
    await start('bossrush');
    const rush = await page.evaluate(() => ({ active: window.__nova.run.bossActive, boss: window.__nova.bossType, mode: window.__nova.mode }));
    check('boss rush: launches straight into a boss', rush.active && rush.boss != null && rush.mode === 'bossrush', JSON.stringify(rush));

    // 5. Zen practice does not deal damage or end the run.
    await start('zen');
    const zen = await page.evaluate(() => { const h = window.__nova.run.health; window.__nova.hurt(); return { before: h, after: window.__nova.run.health, over: window.__nova.run.over }; });
    check('zen: taking a hit does not reduce health or end the run', zen.after === zen.before && !zen.over, JSON.stringify(zen));

    // 6. Specter hull adds shot pierce, and the hull list grew to nine.
    const specter = await page.evaluate(() => {
      const n = window.__nova;
      n.meta.hull = n.hulls.length - 1;
      n.setMode('classic');
      document.getElementById('startBtn').click();
      return { count: n.hullCount, name: n.hulls[n.hulls.length - 1].name, pierce: n.runPierce };
    });
    await sleep(200);
    check('progression: Specter hull exists and grants +1 pierce', specter.count === 9 && specter.name === 'Specter' && specter.pierce >= 1, JSON.stringify(specter));

    // 7. EMP clears enemy bullets and transient power resets on the next run.
    await page.evaluate(() => {
      const n = window.__nova, r = n.run;
      r.bullets.push({ eb: 1, x: r.px + 40, y: r.py - 40, vx: 0, vy: 1, dmg: 1 });
      r.drops.push({ x: r.px, y: r.py, type: 'power', w: 'emp', label: 'EMP BLAST', c: '#7ef0ff' });
    });
    await sleep(260);
    const emp = await page.evaluate(() => ({ kind: window.__nova.powerKind, eb: window.__nova.run.bullets.filter(b => b.eb).length }));
    check('powers: EMP pickup clears enemy bullets', emp.kind === 'emp' && emp.eb === 0, JSON.stringify(emp));
    await page.evaluate(() => document.getElementById('startBtn').click());
    await sleep(160);
    const reset = await page.evaluate(() => ({ kind: window.__nova.powerKind, timer: window.__nova.powerTimer }));
    check('fix: transient power state resets on a new run', reset.kind === null && reset.timer === 0, JSON.stringify(reset));

    // 8. New content: Shielder enemy, Ion Serpent boss, Railgun + Bulwark.
    await page.evaluate(() => { window.__nova.run.stage = 9; window.__nova.setSeed(null); });
    const kinds = await page.evaluate(() => { const s = new Set(); for (let i = 0; i < 4000; i++) s.add(window.__nova.pickKind()); return [...s]; });
    check('content: Shielder is reachable from stage 9', kinds.indexOf('shielder') >= 0, kinds.join(','));
    const boss5 = await page.evaluate(() => window.__nova.forceBoss());
    check('content: Ion Serpent boss appears from stage 9', boss5 === 4, 'type=' + boss5);
    const evo = await page.evaluate(() => {
      const n = window.__nova;
      n.applyRunUpgrade('pierce'); n.applyRunUpgrade('pierce');
      n.applyRunUpgrade('crit'); n.applyRunUpgrade('crit');
      n.applyRunUpgrade('shield'); n.applyRunUpgrade('shield');
      n.applyRunUpgrade('life'); n.applyRunUpgrade('life');
      return { evos: n.evolutions, shieldMax: n.shieldMax, pierce: n.runPierce };
    });
    check('depth: Railgun unlocks and adds pierce + crit', evo.evos.indexOf('railgun') >= 0 && evo.pierce >= 3, JSON.stringify(evo));
    check('depth: Bulwark unlocks and raises shield capacity to 3', evo.evos.indexOf('bulwark') >= 0 && evo.shieldMax === 3, JSON.stringify(evo));

    // 9. Local leaderboard and daily best persist.
    await start('daily');
    await page.evaluate(() => { window.__nova.run.score = 4321; window.__nova.forceEnd(); });
    await sleep(220);
    const board = await page.evaluate(() => ({
      lb: window.__nova.leaderboard,
      daily: window.__nova.dailyBest,
      text: document.getElementById('leaderboard').textContent,
      dailyText: document.getElementById('dailyStats').textContent
    }));
    check('payoff: the local leaderboard records the run', board.lb.length >= 1 && board.lb[0].score >= 4321 && /4,321/.test(board.text), JSON.stringify(board.lb));
    check('daily: the daily best is stored and shown on the title', board.daily >= 4321 && /Daily/.test(board.dailyText), JSON.stringify({ daily: board.daily, text: board.dailyText }));

    // 10. Pause menu, mute, help panel.
    await start('classic');
    await page.click('#pauseBtn');
    await sleep(90);
    const paused = await page.evaluate(() => ({ paused: window.__nova.paused, open: !document.getElementById('pauseOverlay').classList.contains('hidden') }));
    check('ux: Pause opens the pause menu', paused.paused && paused.open, JSON.stringify(paused));
    await page.click('#pauseMute');
    const muted = await page.evaluate(() => ({ mute: window.__nova.mute, label: document.getElementById('pauseMute').textContent }));
    check('ux: the pause menu mutes sound and remembers it', muted.mute && /Off/.test(muted.label), JSON.stringify(muted));
    await page.click('#pauseMute');
    await page.click('#pauseResume');
    await sleep(90);
    const resumed = await page.evaluate(() => ({ paused: window.__nova.paused, open: !document.getElementById('pauseOverlay').classList.contains('hidden') }));
    check('ux: Resume closes the pause menu and restarts the loop', !resumed.paused && !resumed.open, JSON.stringify(resumed));
    await page.evaluate(() => window.__nova.forceEnd());
    await sleep(160);
    await page.click('#helpBtn');
    await sleep(80);
    const helpOn = await page.evaluate(() => window.__nova.helpOpen);
    await page.click('#helpClose');
    const helpOff = await page.evaluate(() => window.__nova.helpOpen);
    check('ux: How to Play opens and closes', helpOn && !helpOff, String(helpOn) + '->' + String(helpOff));

    // 11. Event announcements, wave progress and anti-softlock wave advance.
    await start('classic');
    const prog = await page.evaluate(() => { const r = window.__nova.run; r.waveKills = 3; r.waveTarget = 6; return window.__nova.waveProgress; });
    check('hud: wave progress reflects kills over the wave target', Math.abs(prog - 0.5) < 0.001, String(prog));
    await page.evaluate(() => window.__nova.forceWave());
    await sleep(60);
    const live = await page.evaluate(() => document.getElementById('a11yStatus').textContent);
    check('access: a new wave is announced to the live region', /Wave 2/i.test(live), live);
    await leaveShop();
    await sleep(80);
    await start('classic');
    await page.evaluate(() => {
      const n = window.__nova, r = n.run;
      r.waveKills = 0; r.waveEscaped = 0; r.waveTarget = 1; r.enemies.length = 0;
      r.enemies.push({ kind: 'ufo', pattern: 'straight', x: r.px, y: 99999, vy: 1, t: 0, hp: 1, r: 12, spr: n.sprites.ufo, dir: 1, amp: 0, freq: 0, fire: 999 });
    });
    await sleep(220);
    const escaped = await page.evaluate(() => ({ wave: window.__nova.run.wave, escaped: window.__nova.waveEscaped, shop: window.__nova.shopOpen }));
    check('fix: an enemy that flies off screen still advances the wave', escaped.wave > 1, JSON.stringify(escaped));

    // 12. WASD movement and Escape closing the shop.
    await leaveShop();
    await start('classic');
    const beforeMove = await page.evaluate(() => window.__nova.run.px);
    await page.keyboard.down('d');
    await sleep(220);
    await page.keyboard.up('d');
    const afterMove = await page.evaluate(() => window.__nova.run.px);
    check('controls: W A S D moves the ship', afterMove > beforeMove + 5, beforeMove.toFixed(0) + '->' + afterMove.toFixed(0));
    await page.evaluate(() => window.__nova.forceShop());
    await sleep(90);
    const shopOpen = await page.evaluate(() => window.__nova.shopOpen);
    await page.keyboard.press('Escape');
    await sleep(120);
    const shopClosed = await page.evaluate(() => window.__nova.shopOpen);
    check('controls: Escape closes the station shop', shopOpen && !shopClosed, String(shopOpen) + '->' + String(shopClosed));

    // 13. Reroll is disabled when it is unaffordable.
    await page.evaluate(() => { window.__nova.forceShop(); window.__nova.run.credits = 0; window.__nova.refreshShop(); });
    await sleep(90);
    const reroll = await page.evaluate(() => ({ disabled: document.getElementById('shopReroll').disabled, text: document.getElementById('shopReroll').textContent }));
    check('shop: reroll is disabled when credits are too low', reroll.disabled && /20/.test(reroll.text), JSON.stringify(reroll));
    await leaveShop();

    // 14. forceEnd beats a shield so the debug/test path always ends a run.
    await start('classic');
    await page.evaluate(() => { window.__nova.applyRunUpgrade('shield'); window.__nova.run.shield = 2; window.__nova.forceEnd(); });
    await sleep(160);
    const ended = await page.evaluate(() => ({ over: window.__nova.run.over, shown: !document.getElementById('overlay').classList.contains('hidden') }));
    check('fix: forceEnd ends the run even with a shield up', ended.over && ended.shown, JSON.stringify(ended));

    check('features: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL NOVA SIEGE FEATURE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
