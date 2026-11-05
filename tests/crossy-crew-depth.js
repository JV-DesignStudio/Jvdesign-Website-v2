#!/usr/bin/env node
/*
 * tests/crossy-crew-depth.js
 *
 * Crossy Crew depth update: Daily / Time Attack / One Life / Practice modes,
 * pause, golden flies, biome checkpoints, double coins, crew perks, milestones,
 * badges, best distance, the revive fix and the mobile/a11y polish.
 *
 * Run: node tests/crossy-crew-depth.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};
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

const open = async (browser, base, opts = {}) => {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-cookie-consent', 'accepted'); } catch (e) {} });
  if (opts.reduceMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(opts.viewport || { width: 1440, height: 900 });
  await page.goto(base + '/games/crossy-crew.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(250);
  return { page, errors };
};

async function desktopModes(browser, base) {
  const { page, errors } = await open(browser, base);
  const start = await page.evaluate(() => ({
    modes: [...document.querySelectorAll('#modeSelect .mode-btn')].map(b => b.dataset.mode),
    current: window.__crossy.mode,
    label: window.__crossy.modeLabel,
    title: document.title,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tip: !!document.getElementById('tipLine') && document.getElementById('tipLine').textContent.length > 10,
    badges: document.querySelectorAll('#badgeRow .badge').length
  }));
  check('desktop: title loads', start.title.includes('Crossy Crew'), start.title);
  check('desktop: five run modes are offered', start.modes.length === 5, start.modes.join(','));
  check('default mode is Classic (existing behaviour)', start.current === 'classic' && start.label === 'Classic', start.current);
  check('start screen shows a daily tip', start.tip);
  check('start screen shows badge slots', start.badges === 6, String(start.badges));
  check('desktop: no horizontal overflow', start.overflow <= 2, String(start.overflow));

  // Mode buttons update aria-pressed and the description.
  await page.evaluate(() => document.querySelector('.mode-btn[data-mode="daily"]').click());
  const daily = await page.evaluate(() => ({
    mode: window.__crossy.mode,
    desc: document.getElementById('modeDesc').textContent,
    pressed: document.querySelector('.mode-btn[data-mode="daily"]').getAttribute('aria-pressed')
  }));
  check('mode button switches to Daily', daily.mode === 'daily' && daily.pressed === 'true', daily.mode);
  check('mode description explains Daily', /seeded/i.test(daily.desc), daily.desc);

  // Daily worlds are seeded, so the same date produces the same rows.
  await page.evaluate(() => { window.__crossyTest.setMode('daily'); window.__crossyTest.restart(); });
  await sleep(150);
  const rowsA = await page.evaluate(() => window.__crossyTest.rowsSummary(40));
  await page.evaluate(() => window.__crossyTest.restart());
  await sleep(120);
  const rowsB = await page.evaluate(() => window.__crossyTest.rowsSummary(40));
  check('daily: seeded world is identical on restart', JSON.stringify(rowsA) === JSON.stringify(rowsB), rowsA.slice(0, 8).join(','));
  check('daily: run exposes the daily goal', await page.evaluate(() => window.__crossy.dailyGoal >= 30));

  // Practice removes rivers and trains and does not set records.
  await page.evaluate(() => { window.__crossyTest.setMode('practice'); window.__crossyTest.restart(); });
  await sleep(120);
  const practice = await page.evaluate(() => ({
    rows: window.__crossyTest.rowsSummary(80),
    label: window.__crossy.modeLabel,
    beforeDistance: window.__crossy.bestDistance,
    beforeScore: window.__crossy.best
  }));
  check('practice: no rivers or trains', !practice.rows.includes('river') && !practice.rows.includes('rail'), practice.rows.slice(0, 12).join(','));
  await page.evaluate(() => { window.__crossyTest.setFurthest(50); window.__crossyTest.addScore(900); window.__crossyTest.setCoins(0); window.__crossyTest.kill('Practice end'); });
  await sleep(250);
  const practiceAfter = await page.evaluate(() => ({ dead: window.__crossy.dead, bestDistance: window.__crossy.bestDistance, bestScore: window.__crossy.best }));
  check('practice: run ends normally', practiceAfter.dead);
  check('practice: does not overwrite the distance record', practiceAfter.bestDistance === practice.beforeDistance, practice.beforeDistance + '->' + practiceAfter.bestDistance);
  check('practice: does not overwrite the high score', practiceAfter.bestScore === practice.beforeScore, practice.beforeScore + '->' + practiceAfter.bestScore);

  // Golden flies give 200 points and 2 coins.
  await page.evaluate(() => { window.__crossyTest.setMode('classic'); window.__crossyTest.restart(); window.__crossyTest.forceGoldenRow(); });
  const beforeGold = await page.evaluate(() => ({ score: window.__crossy.score, coins: window.__crossy.coins, golden: window.__crossy.golden }));
  await page.keyboard.press('ArrowUp');
  await sleep(180);
  const afterGold = await page.evaluate(() => ({ score: window.__crossy.score, coins: window.__crossy.coins, golden: window.__crossy.golden }));
  check('golden fly: caught and counted', afterGold.golden === beforeGold.golden + 1, beforeGold.golden + '->' + afterGold.golden);
  check('golden fly: awards 200 points', afterGold.score - beforeGold.score >= 200, (afterGold.score - beforeGold.score) + ' pts');
  check('golden fly: awards 2 coins', afterGold.coins - beforeGold.coins === 2, beforeGold.coins + '->' + afterGold.coins);

  // Checkpoints restock coins and a shield once per row.
  await page.evaluate(() => { window.__crossyTest.restart(); window.__crossyTest.forceCheckpointRow(); });
  const beforeCp = await page.evaluate(() => ({ score: window.__crossy.score, coins: window.__crossy.coins, cp: window.__crossy.checkpoints }));
  await page.keyboard.press('ArrowUp');
  await sleep(180);
  const afterCp = await page.evaluate(() => ({ score: window.__crossy.score, coins: window.__crossy.coins, cp: window.__crossy.checkpoints, shield: window.__crossy.shield }));
  check('checkpoint: counted on first visit', afterCp.cp === beforeCp.cp + 1, beforeCp.cp + '->' + afterCp.cp);
  check('checkpoint: restocks coins and a shield', afterCp.coins === beforeCp.coins + 2 && afterCp.shield, 'coins=' + afterCp.coins + ' shield=' + afterCp.shield);
  check('checkpoint: awards 100 points', afterCp.score - beforeCp.score >= 100, (afterCp.score - beforeCp.score) + ' pts');

  // Double coins doubles a coin pickup.
  await page.evaluate(() => { window.__crossyTest.restart(); window.__crossyTest.grant('doublecoins'); window.__crossyTest.forceCoinRow(); });
  check('double coins power engages', await page.evaluate(() => window.__crossy.doubleCoins));
  const beforeCoin = await page.evaluate(() => window.__crossy.coins);
  await page.keyboard.press('ArrowUp');
  await sleep(160);
  const afterCoin = await page.evaluate(() => window.__crossy.coins);
  check('double coins pays 2 coins per pickup', afterCoin - beforeCoin === 2, beforeCoin + '->' + afterCoin);

  // Time Attack runs a countdown and ends when the clock reaches zero.
  await page.evaluate(() => { window.__crossyTest.setMode('timeattack'); window.__crossyTest.restart(); });
  await sleep(150);
  const ta = await page.evaluate(() => ({ time: window.__crossy.timeLeft, label: window.__crossy.modeLabel }));
  check('time attack: clock starts near 90s', ta.time > 80 && ta.time <= 90, String(ta.time));
  check('time attack: HUD shows the clock', await page.evaluate(() => document.getElementById('timeHud').style.display !== 'none'));
  await page.evaluate(() => window.__crossyTest.setTime(0.02));
  await sleep(400);
  const taEnd = await page.evaluate(() => ({ dead: window.__crossy.dead, kicker: (document.querySelector('.sr-modal-kicker') || {}).textContent || '' }));
  check('time attack: time up ends the run', taEnd.dead, JSON.stringify(taEnd));
  check('time attack: result says Time up', /time up/i.test(taEnd.kicker), taEnd.kicker);

  // One Life has no second chance, even with coins.
  await page.evaluate(() => { window.__crossyTest.setMode('onelife'); window.__crossyTest.restart(); window.__crossyTest.setCoins(20); window.__crossyTest.kill('One life crash'); });
  await sleep(250);
  const one = await page.evaluate(() => ({
    dead: window.__crossy.dead,
    save: !document.getElementById('saveMeScreen').classList.contains('hidden'),
    label: window.__crossy.modeLabel
  }));
  check('one life: death ends the run', one.dead);
  check('one life: never offers a second chance', !one.save);
  check('one life: uses 1.5x scoring', await page.evaluate(() => document.getElementById('modeGoal').textContent.includes('1.5x')));

  check('desktop modes: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

async function pauseAndA11y(browser, base) {
  const { page, errors } = await open(browser, base, { viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } });
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    modes: document.querySelectorAll('#modeSelect .mode-btn').length,
    dpadGroup: document.getElementById('dpad').getAttribute('role'),
    dpadLabel: document.getElementById('dpad').getAttribute('aria-label'),
    saveRole: document.getElementById('saveMeScreen').getAttribute('role'),
    pauseRole: document.getElementById('pauseScreen').getAttribute('role'),
    startOverflow: document.getElementById('startScreen').scrollHeight - document.getElementById('startScreen').clientHeight
  }));
  check('mobile: no horizontal overflow', mobile.overflow <= 2, String(mobile.overflow));
  check('mobile: all five modes visible', mobile.modes === 5, String(mobile.modes));
  check('mobile: D-pad is a labelled group', mobile.dpadGroup === 'group' && /movement/i.test(mobile.dpadLabel), mobile.dpadGroup + '/' + mobile.dpadLabel);
  check('mobile: save prompt is a dialog', mobile.saveRole === 'dialog');
  check('mobile: pause screen is a dialog', mobile.pauseRole === 'dialog');
  check('mobile: start screen scrolls rather than clipping', mobile.startOverflow >= 0, String(mobile.startOverflow));

  // Pause via the button, resume via Escape.
  await page.evaluate(() => { window.__crossyTest.setMode('classic'); window.__crossyTest.restart(); });
  await sleep(150);
  await page.evaluate(() => document.getElementById('pauseBtn').click());
  await sleep(120);
  const paused = await page.evaluate(() => ({
    paused: window.__crossy.paused,
    running: window.__crossy.running,
    open: !document.getElementById('pauseScreen').classList.contains('hidden'),
    aria: document.getElementById('pauseBtn').getAttribute('aria-pressed')
  }));
  check('pause: stops the run', paused.paused && !paused.running);
  check('pause: overlay is visible and the button is pressed', paused.open && paused.aria === 'true');
  await page.keyboard.press('Escape');
  await sleep(120);
  const resumed = await page.evaluate(() => ({ paused: window.__crossy.paused, running: window.__crossy.running, open: !document.getElementById('pauseScreen').classList.contains('hidden') }));
  check('pause: Escape resumes and hides the overlay', !resumed.paused && resumed.running && !resumed.open);

  // Help opened mid-run pauses the traffic and closing it resumes.
  await page.evaluate(() => document.getElementById('helpBtn').click());
  await sleep(150);
  const help = await page.evaluate(() => ({
    open: !document.getElementById('howToPlay').classList.contains('hidden'),
    paused: window.__crossy.paused,
    running: window.__crossy.running,
    focus: document.activeElement && document.activeElement.id
  }));
  check('help: opens without the run continuing behind it', help.open && help.paused && !help.running, JSON.stringify(help));
  check('help: Got it button receives focus', help.focus === 'gotItBtn', String(help.focus));
  await page.evaluate(() => document.getElementById('gotItBtn').click());
  await sleep(150);
  const helpClosed = await page.evaluate(() => ({ open: !document.getElementById('howToPlay').classList.contains('hidden'), running: window.__crossy.running, paused: window.__crossy.paused }));
  check('help: closing resumes the run', !helpClosed.open && helpClosed.running && !helpClosed.paused);

  // Second chance copy and revive placement.
  await page.evaluate(() => { window.__crossyTest.setCoins(20); window.__crossyTest.kill('Test splat'); });
  await sleep(150);
  const saveCopy = await page.evaluate(() => ({
    text: document.getElementById('saveMeText').textContent,
    btn: document.getElementById('saveBtn').textContent,
    shown: !document.getElementById('saveMeScreen').classList.contains('hidden'),
    focus: document.activeElement && document.activeElement.id
  }));
  check('second chance: prompt appears', saveCopy.shown);
  check('second chance: copy and button both say 3 coins', /3 coins/.test(saveCopy.text) && /3 coins/.test(saveCopy.btn), saveCopy.btn);
  check('second chance: save button receives focus', saveCopy.focus === 'saveBtn', String(saveCopy.focus));
  await page.evaluate(() => document.getElementById('saveBtn').click());
  await sleep(180);
  const revived = await page.evaluate(() => ({
    running: window.__crossy.running,
    dead: window.__crossy.dead,
    coins: window.__crossy.coins,
    rowType: window.__crossyTest.rowInfo(window.__crossy.row).type
  }));
  check('second chance: spends exactly 3 coins', revived.coins === 17, String(revived.coins));
  check('second chance: revives and places the player on solid ground',
    revived.running && !revived.dead && (revived.rowType === 'grass' || revived.rowType === 'safe'), JSON.stringify(revived));

  // Backwards hops do not build a near-miss combo. Force a safe next row so the
  // test never depends on a random car spawning over the start column.
  await page.evaluate(() => { window.__crossyTest.restart(); window.__crossyTest.forceCheckpointRow(); });
  await sleep(120);
  await page.keyboard.press('ArrowUp');
  await sleep(100);
  await page.keyboard.press('ArrowDown');
  await sleep(140);
  check('combo: backwards hop resets the streak', await page.evaluate(() => window.__crossy.combo === 0 && window.__crossy.forwardStreak === 0));

  check('mobile pause/a11y: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

async function recordsAndBadges(browser, base) {
  const { page, errors } = await open(browser, base);
  await page.evaluate(() => { window.__crossyTest.setMode('classic'); window.__crossyTest.restart(); });
  await sleep(120);
  await page.evaluate(() => {
    window.__crossyTest.setCoins(0);
    window.__crossyTest.setFurthest(26);
    window.__crossyTest.addScore(520);
    window.__crossyTest.kill('Record run');
  });
  await sleep(300);
  const record = await page.evaluate(() => ({
    dead: window.__crossy.dead,
    bestDistance: window.__crossy.bestDistance,
    badges: window.__crossy.badges,
    modalText: (document.querySelector('.sr-modal-card') || {}).textContent || '',
    storedDistance: Number(localStorage.getItem('jvds_cc_bestdist') || 0),
    storedBadges: JSON.parse(localStorage.getItem('jvds_cc_badges') || '{}'),
    focus: document.activeElement && document.activeElement.className || ''
  }));
  check('records: best distance is saved', record.bestDistance >= 26 && record.storedDistance >= 26, String(record.storedDistance));
  check('records: first 10 and 25 row badges unlock', !!record.badges.first10 && !!record.badges.rows25, JSON.stringify(record.badges));
  check('records: 500 point badge unlocks', !!record.badges.score500, JSON.stringify(record.storedBadges));
  check('end card shows distance, mode and a next goal', /Best distance/.test(record.modalText) && /Mode/.test(record.modalText) && /Next goal/.test(record.modalText));
  check('end card: Play again receives focus', /sr-again/.test(record.focus), record.focus);

  await page.evaluate(() => window.__crossyTest.restart());
  await sleep(120);
  const tip = await page.evaluate(() => document.getElementById('tipLine').textContent);
  check('start screen keeps the daily tip after a run', tip.length > 10, tip.slice(0, 40));

  // Persistence survives a reload.
  await page.reload({ waitUntil: 'load' });
  await sleep(350);
  const reload = await page.evaluate(() => ({
    distance: window.__crossy.bestDistance,
    record: document.getElementById('recordLine').textContent,
    badgeCount: document.querySelectorAll('#badgeRow .badge:not(.locked)').length,
    mode: window.__crossy.mode
  }));
  check('reload: best distance persists', reload.distance >= 26, String(reload.distance));
  check('reload: record line shows the saved distance', reload.record.includes('best distance ' + reload.distance), reload.record);
  check('reload: unlocked badges persist', reload.badgeCount >= 3, String(reload.badgeCount));
  check('reload: saved mode is restored', reload.mode === 'classic', reload.mode);
  check('records: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

async function reducedMotion(browser, base) {
  const { page, errors } = await open(browser, base, { reduceMotion: true });
  check('reduced motion: detected on load', await page.evaluate(() => window.__crossy.reduceMotion === true));
  check('reduced motion: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await desktopModes(browser, base);
    await pauseAndA11y(browser, base);
    await recordsAndBadges(browser, base);
    await reducedMotion(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL CROSSY CREW DEPTH CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
