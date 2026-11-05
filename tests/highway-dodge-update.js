#!/usr/bin/env node
/*
 * tests/highway-dodge-update.js - substantial update coverage
 *
 * Covers the new Highway Dodge systems:
 *   - Classic / Sprint / Endless modes + traffic difficulty (defaults unchanged)
 *   - Daily seeded run and reproducible gameplay RNG
 *   - Clock (+time) and ghost (invulnerability) pickups
 *   - Roadworks barrier hazard
 *   - Pause / resume over keyboard and the pause screen
 *   - Mode bests, expanded result stats and the accessibility seams
 *   - Regression: drifting traffic no longer overlaps in the same lane
 *
 * Run: node tests/highway-dodge-update.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function watchErrors(page) {
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

async function goto(browser, base, query) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html' + (query || ''), { waitUntil: 'load', timeout: 30000 });
  return { page, errors };
}

async function startMode(page, mode, daily) {
  await page.evaluate((m, d) => window.__highway.start(m, d), mode, !!daily);
  await sleep(150);
}

(async () => {
  // 1. Static contract for the new UI and engine seams.
  const html = fs.readFileSync(path.join(ROOT, 'games', 'highway-dodge.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', 'games-highway-dodge-1.js'), 'utf8');
  for (const id of ['pauseBtn', 'pauseScreen', 'dailyBtn', 'modeBest', 'ghostLine', 'shieldCell', 'endMeta', 'srAnnounce']) {
    check('HUD/UI element #' + id, html.includes('id="' + id + '"'));
  }
  for (const token of ['mode-btn', 'diff-btn', 'pickup-key', 'Pip says']) {
    check('start-screen token ' + token, html.includes(token));
  }
  for (const token of ['MODE_INFO', 'DIFFICULTY', 'clockPickups', 'ghostPickups', 'ghostTimer', 'barrier',
    'laneChangeClear', 'applySeed', 'renderModeUI', 'pauseGame', 'flushGarageSave', 'saveGarageSoon', 'hd-modal-stats']) {
    check('engine token ' + token, js.includes(token));
  }

  await withServer(async ({ base, browser }) => {
    // 2. Defaults: Classic + Normal, with the full mode/difficulty row.
    const first = await goto(browser, base);
    const page = first.page;
    const initial = await page.evaluate(() => ({
      mode: window.__highway.mode,
      difficulty: window.__highway.difficulty,
      timed: window.__highway.timed,
      modeButtons: document.querySelectorAll('.mode-btn[data-mode]').length,
      diffButtons: document.querySelectorAll('.diff-btn[data-diff]').length,
      classicOn: document.querySelector('.mode-btn[data-mode="classic"]').classList.contains('on'),
      normalOn: document.querySelector('.diff-btn[data-diff="normal"]').classList.contains('on'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pip: !!document.querySelector('.pip-line'),
      pauseHidden: document.getElementById('pauseBtn').classList.contains('hidden')
    }));
    check('defaults: Classic mode is selected', initial.mode === 'classic' && initial.timed, JSON.stringify(initial));
    check('defaults: Normal traffic is selected', initial.difficulty === 'normal');
    check('defaults: three run modes and three difficulties render', initial.modeButtons === 3 && initial.diffButtons === 3);
    check('defaults: Classic and Normal are marked active', initial.classicOn && initial.normalOn);
    check('defaults: Pip has a start-screen touchpoint', initial.pip);
    check('defaults: pause button stays hidden before a run', initial.pauseHidden);
    check('defaults: no horizontal overflow at 390px', initial.overflow <= 2, String(initial.overflow));

    // 3. Sprint changes the clock and the pause screen works.
    await page.evaluate(() => document.querySelector('.mode-btn[data-mode="sprint"]').click());
    const sprintCfg = await page.evaluate(() => ({ mode: window.__highway.mode, limit: window.__highway.timeLimit }));
    check('sprint: selecting Sprint sets a 60s limit', sprintCfg.mode === 'sprint' && sprintCfg.limit === 60, JSON.stringify(sprintCfg));
    await startMode(page, 'sprint');
    const sprint = await page.evaluate(() => ({ limit: window.__highway.timeLimit, left: window.__highway.timeLeft, hud: document.getElementById('timeHud').textContent }));
    check('sprint: the run starts on a 60s clock', sprint.left > 58 && sprint.left <= 60, JSON.stringify(sprint));
    const paused = await page.evaluate(() => window.__highway.pause());
    check('pause: pause() freezes the run', paused === true && await page.evaluate(() => window.__highway.paused) &&
      await page.evaluate(() => !document.getElementById('pauseScreen').classList.contains('hidden')));
    const resumed = await page.evaluate(() => window.__highway.resume());
    check('pause: resume() returns to play', resumed === true && await page.evaluate(() => !window.__highway.paused));
    await page.close();

    // 4. Endless never runs the timed win path.
    const endless = await goto(browser, base);
    await startMode(endless.page, 'endless');
    const endlessState = await endless.page.evaluate(() => ({
      mode: window.__highway.mode, timed: window.__highway.timed, hud: document.getElementById('timeHud').textContent
    }));
    check('endless: mode is endless and has no clock', endlessState.mode === 'endless' && !endlessState.timed, JSON.stringify(endlessState));
    check('endless: HUD shows the endless marker', endlessState.hud === '∞', endlessState.hud);
    await sleep(500);
    const stillAlive = await endless.page.evaluate(() => ({ dead: window.__highway.dead, reason: window.__highway.endReason, left: window.__highway.timeLeft }));
    check('endless: the clock does not end the run', !stillAlive.dead && stillAlive.left === 0, JSON.stringify(stillAlive));
    await endless.page.close();

    // 5. Daily run uses a reproducible seed and its own best key.
    const daily = await goto(browser, base);
    const dailyInfo = await daily.page.evaluate(() => window.__highway.startDaily());
    check('daily: startDaily reports a numeric seed', Number.isFinite(dailyInfo.seed), JSON.stringify(dailyInfo));
    const dailyState = await daily.page.evaluate(() => ({ daily: window.__highway.daily, mode: window.__highway.mode, seed: window.__highway.seed }));
    check('daily: the run is flagged daily with its seed active', dailyState.daily && dailyState.mode === 'classic' && dailyState.seed === dailyInfo.seed, JSON.stringify(dailyState));
    const seeded = await daily.page.evaluate(() => {
      window.__highway.setSeed(424242);
      const a = window.__highway.randSeq(6);
      window.__highway.setSeed(424242);
      const b = window.__highway.randSeq(6);
      return { a, b, same: JSON.stringify(a) === JSON.stringify(b) };
    });
    check('daily: the seeded RNG is reproducible', seeded.same && seeded.a.length === 6, JSON.stringify(seeded.a));
    await daily.page.close();

    // 6. Clock pickup adds time, ghost pickup grants invulnerability.
    const pickups = await goto(browser, base);
    await startMode(pickups.page, 'classic');
    await pickups.page.evaluate(() => window.__highway.setTimeLeft(30));
    const beforeClock = await pickups.page.evaluate(() => window.__highway.timeLeft);
    await pickups.page.evaluate(() => window.__highway.debugPickup('clock'));
    let clock = { n: 0, left: beforeClock };
    for (let i = 0; i < 30 && !clock.n; i++) {
      await sleep(100);
      clock = await pickups.page.evaluate(() => ({ n: window.__highway.clockPickups, left: window.__highway.timeLeft }));
    }
    check('clock: a clock pickup is collected', clock.n > 0, 'n=' + clock.n);
    check('clock: collecting it adds time', clock.left > beforeClock, beforeClock.toFixed(1) + ' -> ' + clock.left.toFixed(1));
    await pickups.page.evaluate(() => window.__highway.debugPickup('ghost'));
    let ghost = { n: 0, timer: 0 };
    for (let i = 0; i < 30 && !ghost.n; i++) {
      await sleep(100);
      ghost = await pickups.page.evaluate(() => ({ n: window.__highway.ghostPickups, timer: window.__highway.ghost }));
    }
    check('ghost: a ghost pickup is collected', ghost.n > 0, 'n=' + ghost.n);
    check('ghost: collecting it grants brief invulnerability', ghost.timer > 0, 'ghost=' + ghost.timer.toFixed(2));
    await pickups.page.evaluate(() => window.__highway.debugPickup('shield'));
    let shield = { shield: 0, hud: false };
    for (let i = 0; i < 30 && !shield.shield; i++) {
      await sleep(100);
      shield = await pickups.page.evaluate(() => ({ shield: window.__highway.shield, hud: document.getElementById('shieldCell').classList.contains('on') }));
    }
    check('shield: the shield HUD badge appears', shield.shield > 0 && shield.hud, JSON.stringify(shield));
    await pickups.page.close();

    // 7. Barrier is a crash, and pause works from the keyboard.
    const hazard = await goto(browser, base);
    await startMode(hazard.page, 'classic');
    await sleep(400);
    await hazard.page.evaluate(() => window.__highway.debugHazard('barrier'));
    let barrier = { dead: false, reason: 'none' };
    for (let i = 0; i < 30 && !barrier.dead; i++) {
      await sleep(100);
      barrier = await hazard.page.evaluate(() => ({ dead: window.__highway.dead, reason: window.__highway.endReason }));
    }
    check('barrier: roadworks barrier ends a run as a crash', barrier.dead && barrier.reason === 'crash', JSON.stringify(barrier));
    await sleep(1500);
    const endInfo = await hazard.page.evaluate(() => ({
      stats: document.getElementById('endStats').textContent,
      meta: document.getElementById('endMeta').textContent,
      modalStats: !!document.querySelector('.hd-modal-stats'),
      best: window.__highway.bests.classic,
      newBest: window.__highway.newBest,
      saved: JSON.parse(localStorage.getItem('jvds-highway-bests') || '{}')
    }));
    check('result: expanded stats include combo, distance and mode', /Best Combo/i.test(endInfo.stats) && /Distance/i.test(endInfo.stats) && /Mode:/i.test(endInfo.meta), endInfo.stats.slice(0, 80));
    check('result: the StoryRun modal also shows the run stats', endInfo.modalStats);
    check('result: a mode best is recorded and saved', endInfo.best > 0 && (endInfo.saved.classic || 0) >= endInfo.best, JSON.stringify({ best: endInfo.best, saved: endInfo.saved.classic }));
    check('result: no page errors in the hazard run', hazard.errors.length === 0, hazard.errors.join(' | '));
    await hazard.page.close();

    // 8. Keyboard pause / Escape resume.
    const kb = await goto(browser, base);
    await startMode(kb.page, 'classic');
    await kb.page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true })));
    const kbPause = await kb.page.evaluate(() => ({ paused: window.__highway.paused, shown: !document.getElementById('pauseScreen').classList.contains('hidden') }));
    check('keyboard: P pauses and shows the pause screen', kbPause.paused && kbPause.shown, JSON.stringify(kbPause));
    await kb.page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
    const kbResume = await kb.page.evaluate(() => ({ paused: window.__highway.paused, hidden: document.getElementById('pauseScreen').classList.contains('hidden') }));
    check('keyboard: Escape resumes the run', !kbResume.paused && kbResume.hidden, JSON.stringify(kbResume));
    await kb.page.close();

    // 9. Regression: drifting same-lane traffic never overlaps.
    const overlap = await goto(browser, base);
    await startMode(overlap.page, 'classic');
    let maxOverlap = 0, maxCars = 0, runs = 0;
    const deadline = Date.now() + 9000;
    while (Date.now() < deadline) {
      await sleep(70);
      const s = await overlap.page.evaluate(() => ({
        dead: window.__highway.dead, overlaps: window.__highway.overlaps,
        cars: window.__highway.cars(), lane: window.__highway.playerLane
      }));
      if (s.dead) {
        runs++;
        await overlap.page.evaluate(() => { const b = document.querySelector('.sr-again') || document.getElementById('againBtn'); if (b) b.click(); });
        await sleep(200);
        continue;
      }
      maxOverlap = Math.max(maxOverlap, s.overlaps);
      maxCars = Math.max(maxCars, s.cars.length);
      const danger = l => s.cars.reduce((m, c) => c.lane === l ? Math.max(m, c.y) : m, -1);
      let best = 0;
      for (const l of [1, 2]) if (danger(l) < danger(best)) best = l;
      if (best !== s.lane) await overlap.page.keyboard.press(best < s.lane ? 'ArrowLeft' : 'ArrowRight');
    }
    check('traffic: cars spawned during the overlap run', maxCars > 0, 'maxCars=' + maxCars);
    check('regression: same-lane traffic never overlaps', maxOverlap === 0, 'maxOverlap=' + maxOverlap + ' runs=' + runs);
    check('regression: no page errors while driving', overlap.errors.length === 0, overlap.errors.join(' | '));
    await overlap.page.close();

    // 10. Accessibility labels + desktop start screen.
    const aria = await browser.newPage();
    await aria.setViewport({ width: 1440, height: 900 });
    await aria.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
    const labels = await aria.evaluate(() => ({
      pause: document.getElementById('pauseBtn').getAttribute('aria-label'),
      sound: document.getElementById('soundBtn').getAttribute('aria-label'),
      canvas: document.getElementById('game').getAttribute('aria-label'),
      pauseRole: document.getElementById('pauseScreen').getAttribute('role'),
      sr: !!document.getElementById('srAnnounce'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    check('a11y: pause, sound and canvas have labels', /pause/i.test(labels.pause) && /sound/i.test(labels.sound) && /lane/i.test(labels.canvas), JSON.stringify(labels));
    check('a11y: pause screen is a labelled dialog and a live region exists', labels.pauseRole === 'dialog' && labels.sr);
    check('desktop: start screen has no horizontal overflow at 1440px', labels.overflow <= 2, String(labels.overflow));
    await aria.close();
  });

  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL HIGHWAY DODGE UPDATE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
