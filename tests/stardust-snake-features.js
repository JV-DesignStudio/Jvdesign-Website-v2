#!/usr/bin/env node
/*
 * tests/stardust-snake-features.js
 *
 * Covers the Stardust Snake 30-point update through the real page:
 *   - star map, achievements, mission list and cosmetic shop
 *   - high contrast, large symbols, remappable keys
 *   - Nightfall timer ending a run
 *   - Duo mode with a second WASD-controlled trail
 *   - Mission campaign loading a board and advancing on a win
 *   - Nebula wormholes and the new star types
 *   - sky events, music toggle and resume-after-reload
 *
 * Run: node tests/stardust-snake-features.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await withServer(async ({ base, browser }) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/ERR_|Failed to load resource|favicon|Manifest/.test(t)) return;
      errors.push('console: ' + t);
    });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(base + '/games/stardust-snake.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => !!window.__stardustSnake, { timeout: 10000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    /* Star map + shop */
    await page.evaluate(() => document.getElementById('starMapBtn').click());
    check('star map opens', await page.evaluate(() => !document.getElementById('starMap').classList.contains('hidden')));
    check('star map lists achievements', await page.evaluate(() => document.querySelectorAll('#smAch .sm-row').length >= 4));
    check('star map lists all missions', await page.evaluate(() => document.querySelectorAll('#smMissions .sm-row').length === 8));
    check('star map lists the shop', await page.evaluate(() => document.querySelectorAll('#smShop .sm-row').length === 3));
    await page.evaluate(() => { window.__stardustSnake.addDust(100); window.__stardustSnake.buildStarMap(); });
    await page.evaluate(() => { const b = document.querySelector('#smShop button'); if (b) b.click(); });
    const shop = await page.evaluate(() => ({ owned: window.__stardustSnake.owned(), dust: window.__stardustSnake.dust() }));
    check('shop buys a cosmetic', shop.owned.indexOf('comet-head') >= 0, JSON.stringify(shop));
    check('shop spends dust', shop.dust < 100, String(shop.dust));
    await page.evaluate(() => document.getElementById('starMapClose').click());

    /* Options */
    await page.evaluate(() => { const b = document.getElementById('hcBox'); b.checked = true; b.dispatchEvent(new Event('change')); });
    check('high contrast class toggles', await page.evaluate(() => document.body.classList.contains('hc')));
    await page.evaluate(() => { const b = document.getElementById('largeBox'); b.checked = true; b.dispatchEvent(new Event('change')); });
    check('large symbols flag turns on', await page.evaluate(() => window.__stardustSnake.largeCells() === true));

    /* Remappable keys */
    await page.evaluate(() => document.getElementById('keysBtn').click());
    await page.evaluate(() => document.querySelector('#keyPanel [data-bind="up"]').click());
    await page.keyboard.press('q');
    check('key remap saves a new key', await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('jvds_sd_snake_keys') || '{}').up === 'q'; } catch (e) { return false; }
    }));
    await page.evaluate(() => document.getElementById('keysBtn').click());

    /* Nightfall */
    await page.evaluate(() => window.__stardustSnake.setMode('nightfall'));
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(200);
    const nf = await page.evaluate(() => ({ running: window.__stardustSnake.running(), t: window.__stardustSnake.timeLeft() }));
    check('nightfall starts a timed run', nf.running && nf.t > 88 && nf.t <= 90, JSON.stringify(nf));
    await page.evaluate(() => window.__stardustSnake.setTimeLeft(0.02));
    await sleep(2200);
    const nfEnd = await page.evaluate(() => ({ dead: window.__stardustSnake.dead(), t: window.__stardustSnake.timeLeft() }));
    check('nightfall ends when time runs out', nfEnd.dead && nfEnd.t === 0, JSON.stringify(nfEnd));

    /* Duo */
    await page.evaluate(() => { window.__stardustSnake.setMode('duo'); window.__stardustSnake.setWrap(true); });
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(250);
    const duo = await page.evaluate(() => ({ has2: !!window.__stardustSnake.snake2(), alive: window.__stardustSnake.alive2() }));
    check('duo mode spawns player two', duo.has2 && duo.alive, JSON.stringify(duo));
    const y0 = await page.evaluate(() => window.__stardustSnake.snake2()[0].y);
    await page.keyboard.press('w');
    await sleep(1600);
    const y1 = await page.evaluate(() => window.__stardustSnake.snake2()[0].y);
    check('player two steers with WASD', y1 < y0, y0 + ' -> ' + y1);

    /* Mission campaign */
    await page.evaluate(() => window.__stardustSnake.setMode('mission'));
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(200);
    const miss = await page.evaluate(() => ({ goal: window.__stardustSnake.mission().goal, idx: window.__stardustSnake.missionProgress() }));
    check('mission loads a board and goal', miss.goal === 5 && miss.idx === 0, JSON.stringify(miss));
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__stardustSnake.feedNow('normal'); });
    await sleep(120);
    const miss2 = await page.evaluate(() => ({ idx: window.__stardustSnake.missionProgress(), won: window.__stardustSnake.won() }));
    check('mission win advances the campaign', miss2.idx === 1, JSON.stringify(miss2));

    /* Nebula wormholes */
    await page.evaluate(() => window.__stardustSnake.setMode('nebula'));
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(200);
    check('nebula builds wormholes', await page.evaluate(() => window.__stardustSnake.portals().length >= 1));

    /* New star types + sky events in a clean classic run */
    await page.evaluate(() => { window.__stardustSnake.setMode('classic'); window.__stardustSnake.setWrap(true); });
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(200);
    await page.evaluate(() => { for (let i = 0; i < 14; i++) window.__stardustSnake.feedNow('normal'); window.__stardustSnake.setEventTimer(0); });
    await sleep(2000);
    check('a sky event fires', await page.evaluate(() => window.__stardustSnake.eventKind() !== ''), await page.evaluate(() => window.__stardustSnake.eventKind()));
    /* Fresh run so a meteor cannot end it before the star checks. */
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(200);
    await page.evaluate(() => window.__stardustSnake.setWrap(true));
    await page.evaluate(() => window.__stardustSnake.feedNow('ghost'));
    await sleep(40);
    check('ghost star grants pass-through', await page.evaluate(() => window.__stardustSnake.ghostPass() > 0));
    await page.evaluate(() => window.__stardustSnake.feedNow('freeze'));
    await sleep(40);
    check('freeze star pauses hazards', await page.evaluate(() => window.__stardustSnake.freeze() > 0));
    await page.evaluate(() => window.__stardustSnake.feedNow('double'));
    await sleep(40);
    check('double star activates double score', await page.evaluate(() => window.__stardustSnake.double() > 0));
    await page.evaluate(() => window.__stardustSnake.feedNow('bomb'));
    await sleep(40);
    check('bomb star is accepted', await page.evaluate(() => window.__stardustSnake.lastEat() === 'bomb'));

    /* Improvement checks */
    const imp = await page.evaluate(() => {
      window.__stardustSnake.setShields(1);
      const before = window.__stardustSnake.snake().length;
      window.__stardustSnake.shieldHit();
      return { before, after: window.__stardustSnake.snake().length, shields: window.__stardustSnake.shields() };
    });
    check('shield keeps the trail length', imp.after === imp.before && imp.shields === 0, JSON.stringify(imp));

    await page.evaluate(() => window.__stardustSnake.feedNow('speed'));
    const spd = await page.evaluate(() => ({ step: window.__stardustSnake.speed(), eff: window.__stardustSnake.effectiveStep() }));
    check('slow star actually eases movement', spd.eff > spd.step, JSON.stringify(spd));

    await page.evaluate(() => window.__stardustSnake.feedNow('ghost'));
    const g0 = await page.evaluate(() => window.__stardustSnake.ghostPass());
    await page.evaluate(() => document.getElementById('pause').click());
    await sleep(2000);
    const g1 = await page.evaluate(() => window.__stardustSnake.ghostPass());
    check('power-up timers freeze while paused', Math.abs(g1 - g0) < 0.01, g0 + ' -> ' + g1);
    await page.evaluate(() => document.getElementById('pause').click());

    await page.evaluate(() => { window.__stardustSnake.resetBest(); window.__stardustSnake.feedNow('normal'); });
    const bm = await page.evaluate(() => ({ best: window.__stardustSnake.best(), score: window.__stardustSnake.score() }));
    check('best updates during a run', bm.best === bm.score && bm.best > 0, JSON.stringify(bm));

    /* Music */
    await page.evaluate(() => document.getElementById('musicBtn').click());
    check('music toggles on', await page.evaluate(() => window.__stardustSnake.musicOn() === true));
    await page.evaluate(() => document.getElementById('musicBtn').click());
    check('music toggles off', await page.evaluate(() => window.__stardustSnake.musicOn() === false));

    /* Resume after reload */
    await page.evaluate(() => window.__stardustSnake.setMode('classic'));
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(200);
    await page.evaluate(() => { window.__stardustSnake.feedNow('normal'); window.__stardustSnake.saveResume(); });
    const savedScore = await page.evaluate(() => window.__stardustSnake.score());
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => !!window.__stardustSnake, { timeout: 10000 });
    check('a saved run is offered', await page.evaluate(() => window.__stardustSnake.resumeAvailable()));
    await page.evaluate(() => document.getElementById('resumeBtn').click());
    await sleep(200);
    const resumed = await page.evaluate(() => ({ running: window.__stardustSnake.running(), score: window.__stardustSnake.score() }));
    check('continue restores the run', resumed.running && resumed.score === savedScore, JSON.stringify(resumed));

    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL STARDUST SNAKE FEATURE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
