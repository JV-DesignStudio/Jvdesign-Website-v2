#!/usr/bin/env node
/*
 * tests/crossy-crew-polish.js
 *
 * Fairness, feel and performance polish for Crossy Crew:
 *   - difficulty keeps climbing past row 100 and is finally capped
 *   - every river row is generated with a log that is on screen
 *   - the sprite rides a log continuously instead of snapping column to column
 *   - hopping into open water still ends the run
 *   - Daily rows are identical however the player uncovers them
 *   - a Pixel Studio character can be used as the player skin
 *   - the game-over card gives an Echo next-step tip
 *
 * Run: node tests/crossy-crew-polish.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function polish(browser, base) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(t)) return;
    errors.push('console: ' + t);
  });
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('jvds-cookie-consent', 'accepted');
      localStorage.setItem('jvds_sprite_player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
    } catch (e) {}
  });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/crossy-crew.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(300);

  // Difficulty must keep climbing after the old row-100 ceiling.
  const diff = await page.evaluate(() => ({
    d100: window.__crossyTest.difficultyAt(100),
    d250: window.__crossyTest.difficultyAt(250),
    d2000: window.__crossyTest.difficultyAt(2000)
  }));
  check('difficulty reaches 1.0 by row 100', Math.abs(diff.d100 - 1) < 1e-9, String(diff.d100));
  check('difficulty keeps climbing after row 100', diff.d250 > diff.d100, diff.d100 + '->' + diff.d250);
  check('difficulty is capped so late rows stay playable', diff.d2000 <= 1.5 + 1e-9, String(diff.d2000));

  // River rows must always offer a landing log inside the play area.
  const rivers = await page.evaluate(() => {
    const out = [];
    for (let i = 11; i <= 320; i++) {
      const r = window.__crossyTest.rowDetail(i);
      if (r.type === 'river') out.push(r);
    }
    return out;
  });
  check('river rows are generated', rivers.length > 0, String(rivers.length));
  check('every river row has at least one log', rivers.every(r => r.items >= 1));
  check('every river row has a log on screen', rivers.every(r => r.logs.some(l => l.x < 9 && l.x + l.w > 0)));

  // Daily rows must be identical even if rows are discovered in another order.
  const daily = await page.evaluate(() => {
    window.__crossyTest.setMode('daily');
    window.__crossyTest.restart();
    const a = {};
    [70, 15, 10, 25, 40].forEach(i => { a[i] = JSON.stringify(window.__crossyTest.rowDetail(i)); });
    window.__crossyTest.restart();
    const b = {};
    [10, 40, 25, 70, 15].forEach(i => { b[i] = JSON.stringify(window.__crossyTest.rowDetail(i)); });
    const key = [10, 15, 25, 40, 70];
    return { same: key.every(i => a[i] === b[i]), a: a[40], b: b[40] };
  });
  check('daily rows are identical regardless of discovery order', daily.same, daily.same ? '' : daily.a + ' vs ' + daily.b);

  // Ride a forced log and prove the sprite moves continuously with it.
  await page.evaluate(() => { window.__crossyTest.setMode('classic'); window.__crossyTest.restart(); });
  await sleep(140);
  await page.evaluate(() => window.__crossyTest.forceRiverRow({ x: 3, w: 3, speed: 1.4 }));
  await page.keyboard.press('ArrowUp');
  await sleep(260);
  const rideA = await page.evaluate(() => ({ onLog: window.__crossy.onLog, px: window.__crossy.px, dead: window.__crossy.dead }));
  await sleep(240);
  const rideB = await page.evaluate(() => ({ onLog: window.__crossy.onLog, px: window.__crossy.px, dead: window.__crossy.dead }));
  check('lands on the log', rideA.onLog && !rideA.dead, JSON.stringify(rideA));
  check('the sprite rides the log instead of snapping', rideB.px > rideA.px + 4, Math.round(rideA.px) + '->' + Math.round(rideB.px));
  check('stays on the log while it moves', rideB.onLog && !rideB.dead, JSON.stringify(rideB));

  // Falling into open water is still lethal.
  await page.evaluate(() => window.__crossyTest.restart());
  await sleep(140);
  await page.evaluate(() => window.__crossyTest.forceRiverRow({ x: 0, w: 1, speed: 1.4 }));
  await page.keyboard.press('ArrowUp');
  await sleep(320);
  const water = await page.evaluate(() => ({ dead: window.__crossy.dead, save: !document.getElementById('saveMeScreen').classList.contains('hidden') }));
  check('open water still ends the run', water.dead || water.save, JSON.stringify(water));

  // Pixel Studio character becomes a selectable skin.
  const skinBtn = await page.evaluate(() => !!document.getElementById('skinBtn'));
  check('Pixel Studio skin button appears when a sprite exists', skinBtn);
  await page.evaluate(() => { const b = document.getElementById('skinBtn'); if (b) b.click(); });
  await sleep(150);
  check('the custom skin can be switched on', await page.evaluate(() => window.__crossy.pixelSkin === true));
  await page.evaluate(() => window.__crossyTest.restart());
  await sleep(220);
  check('a run plays with the custom skin', await page.evaluate(() => window.__crossy.running && !window.__crossy.dead));

  // Echo gives one honest next step on the game-over card.
  await page.evaluate(() => { window.__crossyTest.setCoins(0); window.__crossyTest.kill('Test splat'); });
  await sleep(320);
  const tip = await page.evaluate(() => {
    const el = document.querySelector('.cc-end-tip');
    return { text: el ? el.textContent : '', modal: !!document.querySelector('.sr-modal.show') };
  });
  check('game over shows an Echo next-step tip', /Echo says:/.test(tip.text), (tip.text || '').slice(0, 70));
  check('the Echo tip lives in the game-over modal', tip.modal);

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => { await polish(browser, base); });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL CROSSY CREW POLISH CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
