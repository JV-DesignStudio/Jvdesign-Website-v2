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

  // A1431: the shared engine touch controls give phones visible lane buttons.
  const lane = await page.evaluate(() => {
    const el = document.querySelector('.gs-touch');
    const btns = el ? el.querySelectorAll('.gs-touch-btn') : [];
    const before = window.__highway ? window.__highway.playerLane : -1;
    const right = btns[1];
    if (right) {
      right.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 21, bubbles: true, cancelable: true }));
      right.dispatchEvent(new PointerEvent('pointerup', { pointerId: 21, bubbles: true, cancelable: true }));
    }
    const after = window.__highway ? window.__highway.playerLane : -1;
    return { has: !!el, n: btns.length, before, after };
  });
  check('mobile: engine touch lane buttons render', lane.has && lane.n === 2, 'n=' + lane.n);
  check('mobile: a lane button steers the car', lane.after !== lane.before, lane.before + '->' + lane.after);

  const root = await page.evaluate(() => {
    const r = document.querySelector('.jvds-root');
    return r ? r.className : null;
  });
  check('mobile: fullscreen root is the game shell, not the canvas',
    !!root && root.includes('game-wrap'), root || 'none');

  // Reach the game-over state. Steer into the lane with the nearest oncoming car
  // so a crash is guaranteed quickly instead of waiting on traffic to wander in.
  let death = null;
  for (let i = 0; i < 120 && !death; i++) {
    await sleep(100);
    const want = await page.evaluate(() => {
      if (!window.__highway || window.__highway.dead) return null;
      const g = window.__highway, cars = g.cars();
      let lane = -1, bestY = -1;
      for (const l of [0, 1, 2]) {
        const y = cars.reduce((m, c) => c.lane === l ? Math.max(m, c.y) : m, -1);
        if (y > bestY) { bestY = y; lane = l; }
      }
      return { lane, current: g.playerLane };
    });
    if (want && want.lane >= 0 && want.lane !== want.current) {
      await page.keyboard.press(want.lane < want.current ? 'ArrowLeft' : 'ArrowRight');
    }
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

// Regression: entering the fullscreen game shell used to let the canvas grow
// unbounded (its bitmap size fed back into its own flex layout), and lane
// positions changed without re-anchoring the player, stranding it off the road.
async function desktopFullscreen(browser, base) {
  for (const [w, h] of [[1440, 900], [1920, 1080]]) {
    const page = await browser.newPage();
    const errors = watchErrors(page);
    await page.setViewport({ width: w, height: h });
    await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => { if (window.JVDSGameShell) window.JVDSGameShell.enter(); });
    await page.evaluate(() => document.getElementById('playBtn').click());
    await sleep(700);
    const s = await page.evaluate(() => {
      const r = document.getElementById('game').getBoundingClientRect();
      const g = window.__highway;
      const sr = document.querySelector('.game-wrap .storyrun');
      return {
        cssH: Math.round(r.height), vh: window.innerHeight,
        playerX: g.playerX, laneW: g.laneW, roadL: g.roadL, roadR: g.roadR,
        srHidden: !!sr && getComputedStyle(sr).display === 'none'
      };
    });
    check(`fullscreen ${w}x${h}: canvas height fits the viewport`,
      s.cssH <= s.vh && s.cssH > 120, `cssH=${s.cssH} vh=${s.vh}`);
    check(`fullscreen ${w}x${h}: player sits on the road`,
      s.playerX > s.roadL && s.playerX < s.roadR,
      `x=${Math.round(s.playerX)} road=${Math.round(s.roadL)}-${Math.round(s.roadR)}`);
    check(`fullscreen ${w}x${h}: StoryRun bar is hidden (beats use toasts)`, s.srHidden);
    check(`fullscreen ${w}x${h}: no page errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }
}

// A1518: first-run steer tip, the fuel resource, the keepsake export and
// reduce-motion support.
async function learnerPolish(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => localStorage.removeItem('highway-tip-seen'));
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(200);

  const tip = await page.evaluate(() => ({
    shown: document.getElementById('tip').classList.contains('show'),
    text: document.getElementById('tip').textContent || ''
  }));
  check('polish: first-run steer tip shows', tip.shown && /steer/i.test(tip.text), tip.text.slice(0, 40));

  // Fuel drains while driving and the HUD tracks it. Sample early, before any
  // traffic can reach the parked player.
  const f1 = await page.evaluate(() => window.__highway.fuel);
  await sleep(450);
  const f2 = await page.evaluate(() => ({
    fuel: window.__highway.fuel,
    hud: document.getElementById('fuelHud').textContent,
    w: document.getElementById('fuelFill').style.width
  }));
  check('polish: fuel drains while driving', f2.fuel < f1, f1.toFixed(1) + ' -> ' + f2.fuel.toFixed(1));
  check('polish: fuel HUD tracks the tank', f2.hud !== '' && /%$/.test(f2.w), 'hud=' + f2.hud + ' w=' + f2.w);

  let hasKeepsake = false;
  for (let i = 0; i < 90 && !hasKeepsake; i++) {
    await sleep(150);
    hasKeepsake = await page.evaluate(() => !!document.querySelector('.sr-modal.show .sr-keepsake'));
  }
  check('polish: game-over offers a keepsake export', hasKeepsake);
  check('polish: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();

  // prefers-reduced-motion must suppress the crash shake.
  const rm = await browser.newPage();
  const rmErrors = watchErrors(rm);
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rm.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await rm.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  await rm.evaluate(() => document.getElementById('playBtn').click());
  let rmDead = false;
  for (let i = 0; i < 90 && !rmDead; i++) { await sleep(150); rmDead = await rm.evaluate(() => window.__highway.dead); }
  const rmHits = await rm.evaluate(() => window.__highway.shakeHits);
  check('polish: prefers-reduced-motion disables the crash shake', rmDead && rmHits === 0, 'dead=' + rmDead + ' hits=' + rmHits);
  check('polish: no page errors (reduce-motion)', rmErrors.length === 0, rmErrors.join(' | '));
  await rm.close();
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

// A1648: fairness. Traffic is spawned in rows that always leave a reachable
// open lane, and rows can never merge (they keep a two-lane vertical gap), so a
// "wall" (all three lanes blocked at one height) should never exist. The game
// counts those frames; a long autopiloted run must report zero.
async function fairness(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => { localStorage.setItem('highway-tip-seen', '1'); document.getElementById('playBtn').click(); });

  let maxWalls = 0, maxRows = 0, samples = 0, runs = 0, maxCars = 0;
  const deadline = Date.now() + 22000;
  while (Date.now() < deadline) {
    await sleep(70);
    const s = await page.evaluate(() => ({
      dead: window.__highway ? window.__highway.dead : false,
      walls: window.__highway ? window.__highway.walls : 0,
      rows: window.__highway ? window.__highway.rows : 0,
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
    maxWalls = Math.max(maxWalls, s.walls);
    maxRows = Math.max(maxRows, s.rows);
    maxCars = Math.max(maxCars, s.cars.length);

    const danger = l => s.cars.reduce((m, c) => c.lane === l ? Math.max(m, c.y) : m, -1);
    let best = 0;
    for (const l of [1, 2]) if (danger(l) < danger(best)) best = l;
    if (best !== s.playerLane) {
      await page.keyboard.press(best < s.playerLane ? 'ArrowLeft' : 'ArrowRight');
    }
  }
  check('fairness: traffic rows spawned', maxRows > 0, 'rows=' + maxRows);
  check('fairness: sustained traffic reached a busy screen', maxCars >= 4, 'maxCars=' + maxCars);
  check('fairness: no impossible traffic wall ever forms', maxWalls === 0,
    'walls=' + maxWalls + ' samples=' + samples + ' runs=' + runs);
  check('fairness: no page errors', errors.length === 0, errors.join(' | '));
  await page.evaluate(() => { localStorage.removeItem('highway-tip-seen'); });
  await page.close();
}

// A1648: the car shop. Coins bank per run, buy custom cars, and the choice
// persists on the device via localStorage (no account).
async function carShop(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('jvds-highway-garage'); localStorage.removeItem('highway-tip-seen'); });
  await page.reload({ waitUntil: 'load' });

  const initial = await page.evaluate(() => window.__highway.garage);
  check('shop: starts with the classic car and no coins',
    initial.equipped === 'classic' && initial.coins === 0, JSON.stringify(initial));

  const opened = await page.evaluate(() => {
    document.getElementById('shopBtn').click();
    const scr = document.getElementById('shopScreen');
    const cards = document.querySelectorAll('#shopCars .shop-card');
    return { visible: !scr.classList.contains('hidden'), cards: cards.length, list: window.__highway.carList().length };
  });
  check('shop: opens with one card per car', opened.visible && opened.cards === opened.list && opened.cards >= 6, JSON.stringify(opened));

  const poor = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('#shopCars .shop-card')).find(c => c.dataset.skin === 'racer');
    const btn = card.querySelector('.shop-buy');
    const disabled = btn.disabled;
    btn.click();
    return { disabled, coins: window.__highway.coins, equipped: window.__highway.equipped };
  });
  check('shop: an unaffordable car cannot be bought', poor.disabled && poor.equipped === 'classic', JSON.stringify(poor));

  const bought = await page.evaluate(() => {
    window.__highway.grantCoins(500);
    const card = Array.from(document.querySelectorAll('#shopCars .shop-card')).find(c => c.dataset.skin === 'racer');
    card.querySelector('.shop-buy').click();
    return { coins: window.__highway.coins, equipped: window.__highway.equipped, owned: window.__highway.garage.owned };
  });
  check('shop: buying a car spends coins and equips it',
    bought.equipped === 'racer' && bought.coins === 380 && bought.owned.indexOf('racer') !== -1, JSON.stringify(bought));

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds-highway-garage') || '{}'));
  check('shop: the garage is saved to localStorage',
    stored.equipped === 'racer' && (stored.owned || []).indexOf('racer') !== -1, JSON.stringify(stored));

  await page.reload({ waitUntil: 'load' });
  const after = await page.evaluate(() => window.__highway.equipped);
  check('shop: the equipped car persists across a reload', after === 'racer', after);

  // A run banks coins into the wallet.
  await page.evaluate(() => { localStorage.setItem('highway-tip-seen', '1'); document.getElementById('playBtn').click(); });
  let banked = 0;
  for (let i = 0; i < 140 && !banked; i++) {
    await sleep(120);
    banked = await page.evaluate(() => window.__highway.dead ? window.__highway.coins : 0);
  }
  check('shop: a run banks coins for the shop', banked > 380, 'coins=' + banked);

  check('shop: no page errors', errors.length === 0, errors.join(' | '));
  await page.evaluate(() => { localStorage.removeItem('jvds-highway-garage'); localStorage.removeItem('highway-tip-seen'); });
  await page.close();
}

// A1649: upgrades change the run, missions rotate by date, achievements unlock.
async function progression(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.removeItem('jvds-highway-garage');
    localStorage.removeItem('jvds_game_highway-dodge');
    localStorage.setItem('highway-tip-seen', '1');
  });
  await page.reload({ waitUntil: 'load' });

  const list = await page.evaluate(() => window.__highway.upgradeList());
  check('progress: upgrades are listed at level 0',
    Array.isArray(list) && list.length >= 4 && list.every(u => u.level === 0 && u.cost > 0), JSON.stringify(list));

  const before = await page.evaluate(() => window.__highway.fuelMax);
  await page.evaluate(() => { window.__highway.grantCoins(3000); window.__highway.buyUpgrade('tank'); });
  const after = await page.evaluate(() => ({ fuelMax: window.__highway.fuelMax, level: window.__highway.upgrades.tank }));
  check('progress: a fuel upgrade raises max fuel', after.level === 1 && after.fuelMax > before, JSON.stringify({ before, after }));

  await page.evaluate(() => window.__highway.buyUpgrade('shield'));
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(200);
  const shield = await page.evaluate(() => window.__highway.shield);
  check('progress: a shield upgrade starts a run shielded', shield >= 1, 'shield=' + shield);

  // Buy a car and prove the matching achievement unlocks.
  const unlocked = await page.evaluate(() => {
    window.__highway.openShop();
    const card = Array.from(document.querySelectorAll('#shopCars .shop-card')).find(c => c.dataset.skin === 'racer');
    card.querySelector('.shop-buy').click();
    return window.__highway.unlocked();
  });
  const ach = await page.evaluate(() => window.__highway.achievements());
  check('progress: game achievements are defined', ach.length >= 4 && ach.indexOf('hd-buy-car') !== -1, ach.join(','));
  check('progress: buying a car unlocks the New Wheels achievement', unlocked.indexOf('hd-buy-car') !== -1, unlocked.join(','));

  const mission = await page.evaluate(() => {
    const m = window.__highway.missions;
    return { daily: m.daily && m.daily.id, goal: m.daily && m.daily.goal, weekly: m.weekly && m.weekly.id };
  });
  check('progress: a daily and weekly mission are active', !!mission.daily && !!mission.weekly && mission.goal > 0, JSON.stringify(mission));

  check('progress: no page errors', errors.length === 0, errors.join(' | '));
  await page.evaluate(() => { localStorage.removeItem('jvds-highway-garage'); localStorage.removeItem('highway-tip-seen'); });
  await page.close();
}

// A1649: coins and oil slicks add depth without ever forming a wall.
async function gameplayDepth(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/highway-dodge.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('jvds-highway-garage'); localStorage.setItem('highway-tip-seen', '1'); });
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => document.getElementById('playBtn').click());

  let maxWalls = 0, samples = 0, coinPickups = 0, coinSpawns = 0, slickSpawns = 0;
  const deadline = Date.now() + 22000;
  while (Date.now() < deadline) {
    await sleep(70);
    const s = await page.evaluate(() => ({
      dead: window.__highway.dead, walls: window.__highway.walls,
      coinPickups: window.__highway.coinPickups, coinSpawns: window.__highway.coinSpawns,
      slickSpawns: window.__highway.slickSpawns, H: window.__highway.H,
      cars: window.__highway.cars(), pickups: window.__highway.pickups(), playerLane: window.__highway.playerLane
    }));
    if (s.dead) {
      await page.evaluate(() => { const b = document.querySelector('.sr-again') || document.getElementById('againBtn'); if (b) b.click(); });
      await sleep(200);
      continue;
    }
    samples++;
    maxWalls = Math.max(maxWalls, s.walls);
    coinPickups = Math.max(coinPickups, s.coinPickups);
    coinSpawns = Math.max(coinSpawns, s.coinSpawns);
    slickSpawns = Math.max(slickSpawns, s.slickSpawns);

    // Autopilot: take the safest lane, which is also where coins are spawned,
    // so a long survival picks coins up as it passes through the gap.
    const danger = l => s.cars.reduce((m, c) => c.lane === l ? Math.max(m, c.y) : m, -1);
    let target = 0;
    for (const l of [1, 2]) if (danger(l) < danger(target)) target = l;
    if (target !== s.playerLane) {
      await page.keyboard.press(target < s.playerLane ? 'ArrowLeft' : 'ArrowRight');
    }
  }
  check('depth: coins appear on the road', coinSpawns > 0, 'coinSpawns=' + coinSpawns);
  check('depth: a coin can be collected while driving', coinPickups > 0, 'coinPickups=' + coinPickups);
  check('depth: oil slicks spawn on the road', slickSpawns > 0, 'slickSpawns=' + slickSpawns);
  check('depth: coins and oil never create a wall', maxWalls === 0, 'walls=' + maxWalls + ' samples=' + samples);
  check('depth: no page errors', errors.length === 0, errors.join(' | '));
  await page.evaluate(() => { localStorage.removeItem('jvds-highway-garage'); localStorage.removeItem('highway-tip-seen'); });
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await desktop(browser, base);
    await desktopFullscreen(browser, base);
    await mobile(browser, base);
    await learnerPolish(browser, base);
    await noOverlap(browser, base);
    await fairness(browser, base);
    await carShop(browser, base);
    await progression(browser, base);
    await gameplayDepth(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL HIGHWAY DODGE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
