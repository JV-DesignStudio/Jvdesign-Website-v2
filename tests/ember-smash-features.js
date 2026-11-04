#!/usr/bin/env node
/*
 * tests/ember-smash-features.js , A2470
 *
 * Covers the Ember Smash feature pass: the start-screen forge select, Endless
 * and Daily modes, the motion override, pause/timer behaviour, the recent-run
 * list, steel bricks, magnet and fire drops, full-heart conversion, forge
 * undo/redo and brush tools, grid keyboard navigation, sub-stepped ball
 * movement (no tunnelling) and the fix that banks a run score exactly once.
 *
 * Run: node tests/ember-smash-features.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail && !cond ? ' - ' + detail : ''));
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'games', 'ember-smash.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'assets', 'js', 'inline', 'games-ember-smash-1.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'style-game-ember-smash.css'), 'utf8');

  ok('start card ships the forge select and mode buttons',
    /id="forgeSelect"/.test(html) && /id="endlessBtn"/.test(html) && /id="dailyBtn"/.test(html) && /id="motionBtn"/.test(html));
  ok('HUD ships the timer, run stats and pause control',
    /id="timer"/.test(html) && /id="runStats"/.test(html) && /id="pause"/.test(html));
  ok('pause overlay and live status region exist', /id="pauseOverlay"/.test(html) && /id="srStatus"/.test(html));
  ok('recent-run list exists', /id="runList"/.test(html) && /id="dailyBest"/.test(html));
  ok('canvas is a keyboard application', /role="application"/.test(html) && /tabindex="0"/.test(html));
  ok('styles cover the new start and pause UI', /\.pause-overlay/.test(css) && /\.start-forges/.test(css) && /\.start-runs/.test(css));
  ok('engine ships magnet and fire drops', /magnet:/.test(js) && /fire:/.test(js));
  ok('engine understands three-hit steel bricks', /ch==='3'\?3/.test(js));
  ok('engine ships the deterministic daily wall', /function dailyRows/.test(js));
  ok('engine ships forge undo/redo history', /function pushForgeHistory/.test(js) && /forgeUndo/.test(html));
  ok('engine sub-steps the spark', /function advanceBall/.test(js) && /Math\.ceil\(dist\/8\)/.test(js));

  await withServer(async ({ base, browser }) => {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(base + '/games/ember-smash.html', { waitUntil: 'load', timeout: 30000 });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#canvas', { timeout: 10000 });
      await page.waitForFunction(() => !!window.__emberSmash, { timeout: 10000 });

      const boot = await page.evaluate(() => ({
        buttons: Array.from(document.querySelectorAll('#forgeSelect button')).map((b) => ({
          disabled: b.disabled, pressed: b.getAttribute('aria-pressed')
        })),
        role: document.getElementById('canvas').getAttribute('role'),
        tab: document.getElementById('canvas').tabIndex,
        status: document.getElementById('srStatus').getAttribute('role'),
        timer: document.getElementById('timer').textContent,
        stats: document.getElementById('runStats').textContent,
        runs: document.getElementById('runList').textContent
      }));
      ok(vp.name + ': forge select lists all six forges', boot.buttons.length === 6, JSON.stringify(boot.buttons));
      ok(vp.name + ': only the first forge is open on a new profile',
        boot.buttons[0] && !boot.buttons[0].disabled && boot.buttons.slice(1).every((b) => b.disabled),
        JSON.stringify(boot.buttons));
      ok(vp.name + ': canvas is a focusable application', boot.role === 'application' && boot.tab === 0);
      ok(vp.name + ': live status region is polite', boot.status === 'status');
      ok(vp.name + ': HUD shows a timer and run stats', /^\d+:\d\d$/.test(boot.timer) && /Accuracy/.test(boot.stats));
      ok(vp.name + ': recent-run list starts empty', /No runs yet/.test(boot.runs));

      // Forge select starts the chosen campaign forge without skipping ahead.
      await page.click('#forgeSelect button');
      await sleep(180);
      const chosen = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': forge select starts forge 1',
        chosen.level === 1 && chosen.mode === 'campaign' && chosen.playing === true, JSON.stringify(chosen));

      // A clean reload restores the title screen for the keyboard test.
      await page.reload({ waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => !!window.__emberSmash, { timeout: 10000 });
      await page.keyboard.press('Space');
      await sleep(140);
      const woke = await page.evaluate(() => ({
        hidden: document.getElementById('startOverlay').classList.contains('hide'),
        state: window.__emberSmash.state()
      }));
      ok(vp.name + ': Space leaves the title screen without serving',
        woke.hidden && woke.state.stuck === true, JSON.stringify(woke.state));
      await page.keyboard.press('Space');
      await sleep(300);
      const served = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': Space then serves the spark', served.stuck === false, JSON.stringify(served));

      // Pause overlay stops the forge timer until resumed.
      await page.evaluate(() => window.__emberSmash.startAt(0));
      await sleep(160);
      await page.click('#pause');
      await page.waitForSelector('#pauseOverlay.show', { timeout: 4000 });
      const paused1 = await page.evaluate(() => window.__emberSmash.state());
      await sleep(420);
      const paused2 = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': pause overlay opens', paused1.paused === true, JSON.stringify(paused1));
      ok(vp.name + ': pause freezes the forge timer',
        Math.abs(paused2.timer - paused1.timer) < 0.02, paused1.timer + ' -> ' + paused2.timer);
      await page.click('#pauseResume');
      await sleep(260);
      const resumed = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': resume restarts the timer',
        resumed.paused === false && resumed.timer > paused2.timer, JSON.stringify({ paused: resumed.paused, timer: resumed.timer }));

      // Endless and motion toggles keep their state in the UI.
      const toggle = await page.evaluate(() => {
        document.getElementById('endlessBtn').click();
        const on = { state: window.__emberSmash.state().endless, pressed: document.getElementById('endlessBtn').getAttribute('aria-pressed') };
        document.getElementById('endlessBtn').click();
        const off = window.__emberSmash.state().endless;
        return { on, off };
      });
      ok(vp.name + ': endless mode toggles on and off',
        toggle.on.state === true && toggle.on.pressed === 'true' && toggle.off === false, JSON.stringify(toggle));
      const motion = await page.evaluate(() => {
        const before = window.__emberSmash.state().reducedMotion;
        document.getElementById('motionBtn').click();
        const after = window.__emberSmash.state().reducedMotion;
        document.getElementById('motionBtn').click();
        return { before, after, restored: window.__emberSmash.state().reducedMotion };
      });
      ok(vp.name + ': motion override toggles', motion.after === !motion.before && motion.restored === motion.before, JSON.stringify(motion));

      // The daily wall is deterministic for a date and loads as a one-wall run.
      const daily = await page.evaluate(() => {
        const a = window.__emberSmash.dailyRows('2026-11-04');
        const b = window.__emberSmash.dailyRows('2026-11-04');
        return {
          same: a.join('|') === b.join('|'),
          valid: a.length === 5 && a.every((r) => r.length === 9 && /[12]/.test(r))
        };
      });
      ok(vp.name + ': daily wall is deterministic and playable', daily.same && daily.valid, JSON.stringify(daily));
      await page.evaluate(() => window.__emberSmash.startDaily());
      await sleep(220);
      const dailyRun = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': daily forge loads one wall',
        dailyRun.mode === 'daily' && dailyRun.custom === true && dailyRun.level === 1 && dailyRun.alive > 0,
        JSON.stringify(dailyRun));

      // Forge editor: undo, redo, checker brush and arrow-key navigation.
      await page.evaluate(() => { window.__emberSmash.startAt(0); window.__emberSmash.openForge(); });
      await sleep(180);
      await page.click('#forgeClear');
      await page.click('.forge-cell[data-r="0"][data-c="1"]');
      const painted = await page.evaluate(() => document.querySelectorAll('.forge-cell.brick,.forge-cell.gold').length);
      await page.click('#forgeUndo');
      const undone = await page.evaluate(() => document.querySelectorAll('.forge-cell.brick,.forge-cell.gold').length);
      await page.click('#forgeRedo');
      const redone = await page.evaluate(() => document.querySelectorAll('.forge-cell.brick,.forge-cell.gold').length);
      ok(vp.name + ': forge undo and redo restore the wall', painted === 1 && undone === 0 && redone === 1,
        JSON.stringify({ painted, undone, redone }));
      await page.click('.forge-tools [data-brush="checker"]');
      await page.click('.forge-cell[data-r="1"][data-c="1"]');
      const checker = await page.evaluate(() => document.querySelectorAll('.forge-cell.brick,.forge-cell.gold').length);
      ok(vp.name + ': checker brush paints a brick', checker === 2, String(checker));
      await page.evaluate(() => document.querySelector('.forge-cell[data-r="0"][data-c="0"]').focus());
      await page.keyboard.press('ArrowRight');
      await sleep(80);
      const focused = await page.evaluate(() => {
        const a = document.activeElement;
        return a && a.classList.contains('forge-cell') ? a.dataset.c : null;
      });
      ok(vp.name + ': arrow keys move through the forge grid', focused === '1', String(focused));
      await page.evaluate(() => window.__emberSmash.closeForge());

      // Steel bricks appear in the later campaign forges.
      await page.evaluate(() => window.__emberSmash.startAt(3));
      await sleep(140);
      const steel = await page.evaluate(() => window.__emberSmash.bricks().filter((b) => b.max >= 3).length);
      ok(vp.name + ': later forges include steel bricks', steel > 0, String(steel));

      // A very fast spark still registers a brick hit instead of tunnelling.
      const hitIndex = await page.evaluate(() => {
        window.__emberSmash.startAt(0);
        const arr = window.__emberSmash.bricks();
        const i = arr.findIndex((b) => b.alive);
        const b = arr[i];
        window.__emberSmash.setBall({ x: b.x + b.w / 2, y: b.y + b.h + 14, vx: 0, vy: -1400, stuck: false });
        return i;
      });
      await sleep(260);
      const hitBrick = await page.evaluate((i) => window.__emberSmash.bricks()[i], hitIndex);
      ok(vp.name + ': a fast spark cannot tunnel through a brick',
        !hitBrick.alive || hitBrick.hp < hitBrick.max, JSON.stringify(hitBrick));

      // A horizontal spark is nudged back into a playable angle.
      await page.evaluate(() => {
        window.__emberSmash.startAt(0);
        window.__emberSmash.setBall({ x: 450, y: 300, vx: 620, vy: 0, stuck: false });
      });
      await sleep(220);
      const nudged = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': a horizontal spark is nudged back into a vertical angle',
        Math.abs(nudged.vy) >= 40, JSON.stringify({ vx: nudged.vx, vy: nudged.vy }));

      // Full hearts convert an extra-life drop into points.
      await page.evaluate(() => { window.__emberSmash.startAt(0); window.__emberSmash.setLives(5); });
      await sleep(120);
      const beforeDrop = await page.evaluate(() => window.__emberSmash.state());
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.__emberSmash.forceDrop('life'));
        await sleep(140);
      }
      const afterDrop = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': a full-heart drop becomes points',
        afterDrop.lives === 5 && afterDrop.score >= beforeDrop.score + 400,
        JSON.stringify({ before: beforeDrop.score, after: afterDrop.score, lives: afterDrop.lives }));

      // Magnet drop applies its effect.
      await page.evaluate(() => window.__emberSmash.forceDrop('wide'));
      await sleep(160);
      const wide = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': a drop can be collected at the paddle', wide.effects.wide > 0, JSON.stringify(wide.effects));
      await page.evaluate(() => window.__emberSmash.forceDrop('magnet'));
      await sleep(160);
      const magnet = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': magnet drop applies its effect', magnet.effects.magnet > 0, JSON.stringify(magnet.effects));
      await page.evaluate(() => { window.__emberSmash.startAt(0); window.__emberSmash.setEffect('fire', 3); });
      await sleep(120);
      const fire = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': fire spark effect runs', fire.effects.fire > 0, JSON.stringify(fire.effects));

      // Maxed perks still fill the upgrade picker with three choices.
      await page.evaluate(() => {
        window.__emberSmash.startAt(0);
        window.__emberSmash.setPerks({ paddle: 2, luck: true, blast: true, shield: 2 });
        window.__emberSmash.clearWall();
      });
      await page.waitForSelector('#upgradeOverlay.show', { timeout: 4000 });
      const fallback = await page.evaluate(() => ({
        count: document.querySelectorAll('.upgrade-choice').length,
        ids: Array.from(document.querySelectorAll('.upgrade-choice')).map((b) => b.dataset.id)
      }));
      ok(vp.name + ': maxed perks still offer three choices',
        fallback.count === 3 && new Set(fallback.ids).size === 3, JSON.stringify(fallback));
      await page.click('.upgrade-choice');
      await sleep(180);

      // The run score is banked once when the run finishes, and saved to the list.
      await page.evaluate(() => window.__emberSmash.startAt(0));
      await sleep(140);
      await page.evaluate(() => window.__emberSmash.clearWall());
      await page.waitForSelector('#upgradeOverlay.show', { timeout: 4000 });
      const clearedState = await page.evaluate(() => window.__emberSmash.state());
      await page.evaluate(() => window.__emberSmash.endRun(true));
      await sleep(250);
      const ended = await page.evaluate(() => ({
        state: window.__emberSmash.state(),
        runs: document.querySelectorAll('#runList li').length
      }));
      ok(vp.name + ': the run score is banked exactly once',
        ended.state.best === clearedState.best + clearedState.score && clearedState.score > 0,
        JSON.stringify({ bestBefore: clearedState.best, score: clearedState.score, bestAfter: ended.state.best }));
      ok(vp.name + ': finished runs appear in the recent list',
        ended.state.runs.length >= 1 && ended.runs >= 1, JSON.stringify({ runs: ended.state.runs, list: ended.runs }));

      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
  });

  console.log(failures ? `\n${failures} FAILED` : '\nEmber Smash features: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
