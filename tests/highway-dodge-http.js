#!/usr/bin/env node
/*
 * tests/highway-dodge-http.js - A966
 *
 * Guards two defects that shipped with games/highway-dodge.html:
 *   1. On death the StoryRun game-over modal (z-index 9999) rendered behind the
 *      fullscreen canvas (game-shell.js sets z-index 99990), so the frozen board
 *      looked like a crash with no restart.
 *   2. Traffic spawned on top of itself: spawns picked a random lane with no
 *      clearance check and per-car speed gave faster cars a chance to overtake
 *      slower ones in the same lane.
 *
 * The fix makes the game shell the immersive root + storyrun host, lifts the
 * game-over modal above it, and gives every car in a lane the same pace plus a
 * spawn clearance check. This test proves the modal wins on death and that
 * same-lane traffic never overlaps while driving, even after several restarts.
 *
 * Run: node tests/highway-dodge-http.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
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

async function desktop(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  const info = await page.evaluate(() => ({
    title: document.title,
    canvas: !!document.getElementById('game'),
    startVisible: !document.getElementById('startScreen').classList.contains('hidden'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check('desktop: title loads', info.title.includes('Highway Dodge'), info.title);
  check('desktop: canvas present', info.canvas);
  check('desktop: start screen visible', info.startVisible);
  check('desktop: no horizontal overflow', info.overflow <= 2, String(info.overflow));
  check('desktop: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function mobile(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });

  // Force the same immersive path a real touch Start takes (skips the
  // navigator.webdriver guard game-shell uses for automation).
  await page.evaluate(() => { if (window.JVDSGameShell) window.JVDSGameShell.enter(); });
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(300);

  const root = await page.evaluate(() => {
    const r = document.querySelector('.jvds-root');
    return r ? r.className : null;
  });
  check('mobile: fullscreen root is the game shell, not the canvas',
    !!root && root.includes('game-wrap'), root || 'none');

  // Idle until the traffic hits the parked player.
  let death = null;
  for (let i = 0; i < 80 && !death; i++) {
    await sleep(120);
    death = await page.evaluate(() => {
      if (!window.__highway || !window.__highway.dead) return null;
      const m = document.querySelector('.sr-modal.show');
      const c = document.getElementById('game');
      const center = document.elementFromPoint(195, 420);
      return {
        shown: !!m,
        modalZ: m ? parseInt(getComputedStyle(m).zIndex, 10) : null,
        canvasZ: parseInt(getComputedStyle(c).zIndex, 10) || 0,
        modalOnTop: !!(m && center && m.contains(center))
      };
    });
  }
  check('mobile: reaching the end shows the game-over state', !!death);
  check('mobile: game-over modal is shown', !!(death && death.shown));
  check('mobile: game-over modal sits above the fullscreen canvas',
    !!(death && death.modalOnTop && death.modalZ > death.canvasZ),
    death ? 'modal z-' + death.modalZ + ' canvas z-' + death.canvasZ : 'n/a');

  const show = await page.evaluate(() => ({
    goal: (document.getElementById('goalHud') || {}).textContent,
    milestone: window.__highway.milestone,
    shakeHits: window.__highway.shakeHits
  }));
  check('showcase: goal is shown in the HUD', /^\d+$/.test(show.goal || ''), show.goal);
  check('showcase: milestone progression is armed',
    [500, 1500, 3000, 6000, null].includes(show.milestone), String(show.milestone));
  check('showcase: crash triggers a screen shake', show.shakeHits >= 1, 'hits=' + show.shakeHits);

  await page.evaluate(() => document.querySelector('.sr-again')?.click());
  await sleep(500);
  const restarted = await page.evaluate(() => ({ running: window.__highway.running, dead: window.__highway.dead }));
  check('mobile: play again restarts a live run', restarted.running && !restarted.dead, JSON.stringify(restarted));
  check('mobile: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function noOverlap(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.getElementById('playBtn').click());

  // Drive for a while, restarting after each crash, sampling same-lane overlap
  // the whole time. A tiny autopilot keeps the run alive so plenty of traffic
  // spawns. Equal lane pace + spawn clearance must keep overlaps at zero.
  let maxOverlap = 0, maxCars = 0, samples = 0, runs = 0;
  const deadline = Date.now() + 22000;
  while (Date.now() < deadline) {
    await sleep(60);
    const s = await page.evaluate(() => ({
      dead: window.__highway ? window.__highway.dead : false,
      overlaps: window.__highway ? window.__highway.overlaps : 0,
      cars: window.__highway ? window.__highway.cars() : [],
      playerLane: window.__highway ? window.__highway.playerLane : -1
    }));
    if (s.dead) {
      runs++;
      await page.evaluate(() => {
        const btn = document.querySelector('.sr-again') || document.getElementById('againBtn');
        if (btn) btn.click();
      });
      await sleep(250);
      continue;
    }
    samples++;
    maxOverlap = Math.max(maxOverlap, s.overlaps);
    maxCars = Math.max(maxCars, s.cars.length);

    // Steer to the lane whose nearest oncoming car is furthest away.
    const danger = l => s.cars.reduce((m, c) => c.lane === l ? Math.max(m, c.y) : m, -1);
    let best = 0;
    for (const l of [1, 2]) if (danger(l) < danger(best)) best = l;
    if (best !== s.playerLane) {
      await page.keyboard.press(best < s.playerLane ? 'ArrowLeft' : 'ArrowRight');
    }
  }
  check('traffic: cars actually spawned during the run', maxCars > 0, 'maxCars=' + maxCars);
  check('traffic: same-lane traffic never overlaps', maxOverlap === 0, 'maxOverlap=' + maxOverlap + ' samples=' + samples + ' runs=' + runs);
  check('traffic: sustained traffic reached a busy screen', maxCars >= 4, 'maxCars=' + maxCars);
  check('traffic: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await desktop(browser, base);
    await mobile(browser, base);
    await noOverlap(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL HIGHWAY DODGE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
