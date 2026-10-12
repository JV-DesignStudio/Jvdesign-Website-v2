#!/usr/bin/env node
/*
 * tests/voidrush-http.js , A984 regression guard for games/voidrush.html
 *
 * The chase-the-sun rework left a few things rough, fixed together here:
 *   1. The old quest "Void Survivor" asked for metric 'wave' x10, but the game
 *      has sectors, not waves, so the badge could never be earned. The quest now
 *      uses game-level (sector) and the game writes that level on save.
 *   2. Dragging on the canvas teleported the ship straight to the pointer and
 *      also auto-started the run on the first touch. It now steers toward the
 *      pointer at a capped speed and never starts on its own.
 *   3. Movement snapped to full speed with no easing and the combo never
 *      expired. Both are now smoothed/decaying.
 *   4. Screen shake and flashes ignored prefers-reduced-motion.
 *   5. Gradients were rebuilt every frame (heavy on weak school PCs).
 *   6. The play view had no character presence; Echo now coaches in the panel.
 *
 * This suite proves the page loads clean at 390/1440, the canvas does not
 * auto-start, the Start button does, drag steers instead of teleporting, and
 * reduced motion is honoured. Static checks guard the quest + level save.
 *
 * Run: node tests/voidrush-http.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
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

// Static guards: the quest is earnable and the game saves the level it needs.
function staticChecks() {
  const quest = fs.readFileSync(path.join(ROOT, 'quest-system.js'), 'utf8');
  const block = quest.slice(quest.indexOf("'quest-19-void-survivor'"), quest.indexOf("'quest-20"));
  check('quest-19 uses a requirement VoidRush can satisfy (game-level)',
    /type:\s*'game-level'/.test(block) && /gameId:\s*'void-rush'/.test(block), block.slice(0, 80).replace(/\s+/g, ' '));
  check('quest-19 no longer asks for a wave metric',
    !/metric:\s*'wave'/.test(block));

  const html = fs.readFileSync(path.join(ROOT, 'games/voidrush.html'), 'utf8');
  check('game writes the reached sector as save level',
    /level:\s*Math\.max\(1,\s*bestSector\)/.test(html));
  check('game honours prefers-reduced-motion', /prefers-reduced-motion/.test(html));
  check('game has a combo decay timer', /comboTimer/.test(html));
  check('game steers through a capped steer vector', /steer\s*=\s*\{/.test(html));
  check('game calls gameSystem.addScore on finish', /sys\?\.addScore\?\.\(score\)/.test(html));
  check('game has a first-run coach', /id="coach"/.test(html) && /function showCoach/.test(html));
  check('game has a void tide', /function drawTide/.test(html) && /Void tide/.test(html));

  const arcade = fs.readFileSync(path.join(ROOT, 'arcade.html'), 'utf8');
  check('arcade reads the registry line-up', /window\.JVDS_GAMES/.test(arcade));
  const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
  check('void-rush is held back from the live line-up until reworked', !/"id":\s*"void-rush"/.test(registry));
  const qb = fs.readFileSync(path.join(ROOT, 'pages/quest-board.html'), 'utf8');
  check('quest-board loads void-rush and flattens extra', /'void-rush'/.test(qb) && /st\.extra/.test(qb));
}

async function desktop(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/games/voidrush.html', { waitUntil: 'load', timeout: 30000 });
  const info = await page.evaluate(() => ({
    title: document.title,
    canvas: !!document.getElementById('canvas'),
    echo: !!document.getElementById('echoLine'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check('desktop: title loads', info.title.includes('VoidRush'), info.title);
  check('desktop: canvas present', info.canvas);
  check('desktop: Echo coach present', info.echo);
  check('desktop: no horizontal overflow', info.overflow <= 2, String(info.overflow));
  check('desktop: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function touchAndSteer(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(base + '/games/voidrush.html', { waitUntil: 'load', timeout: 30000 });
  const hit = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), pe: getComputedStyle(c).pointerEvents };
  });
  check('mobile: canvas has a real tappable size', hit.w > 0 && hit.h > 0 && hit.pe !== 'none', JSON.stringify(hit));

  const coach = await page.evaluate(() => ({
    firstRun: window.__voidrush().firstRun,
    shown: document.getElementById('coach').classList.contains('show'),
    dpad: document.querySelectorAll('.dpad button').length,
    meters: !!document.getElementById('sunFill') && !!document.getElementById('gradeFill'),
    tide: typeof window.__voidrush().tide
  }));
  check('mobile: first-run coach shows when there is no saved best',
    coach.firstRun === true && coach.shown, JSON.stringify(coach));
  check('mobile: sunlight + grade meters present', coach.meters === true);
  check('mobile: touch dpad has four directions', coach.dpad === 4, String(coach.dpad));
  check('mobile: void tide is tracked', coach.tide === 'number', coach.tide);

  // Fire real PointerEvents straight at the canvas so the check is about the
  // game logic, not about which overlay happens to sit on top.
  const pointer = (type, fx, fy) => page.evaluate((t, x, y) => {
    const c = document.getElementById('canvas');
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent(t, {
      clientX: r.x + r.width * x, clientY: r.y + r.height * y, bubbles: true
    }));
  }, type, fx, fy);

  // 1. A tap on the canvas must NOT auto-start the chase.
  await pointer('pointerdown', 0.5, 0.5);
  await sleep(120);
  const afterTap = await page.evaluate(() => ({
    run: window.__voidrush().run,
    story: !!(window.__storyRun && window.__storyRun.running)
  }));
  await pointer('pointerup', 0.5, 0.5);
  check('mobile: tapping the canvas does not auto-start', afterTap.run === false && afterTap.story === false,
    'run=' + afterTap.run + ' story=' + afterTap.story);

  // 2. The Start button starts the run.
  await page.evaluate(() => document.getElementById('start').click());
  await sleep(150);
  const started = await page.evaluate(() => window.__voidrush().run);
  check('mobile: Start button begins the chase', started === true);
  const coachHidden = await page.evaluate(() => !document.getElementById('coach').classList.contains('show'));
  check('mobile: coach dismisses once the chase starts', coachHidden === true);

  // 3. Drag steers toward the pointer instead of teleporting. Read straight
  // after the move: the old code snapped player.x to ~0.9 here, steering leaves
  // it near zero until the next frame integrates the capped velocity.
  const before = await page.evaluate(() => window.__voidrush().player.x);
  await pointer('pointerdown', 0.5, 0.5);
  await pointer('pointermove', 0.95, 0.5);
  const immediate = await page.evaluate(() => window.__voidrush().player.x);
  await sleep(1400);
  const drag = await page.evaluate(() => window.__voidrush());
  await pointer('pointerup', 0.95, 0.5);
  check('mobile: drag does not teleport the ship', immediate < 0.5, before + ' -> ' + immediate + ' (steer.x=' + drag.steer.x + ')');
  check('mobile: drag steers the ship toward the pointer', drag.player.x > before + 0.02,
    before + ' -> ' + drag.player.x + ' (steer.x=' + drag.steer.x + ' run=' + drag.run + ')');

  check('mobile: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function reducedMotion(browser, base) {
  const page = await browser.newPage();
  if (typeof page.emulateMediaFeatures === 'function') {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(base + '/games/voidrush.html', { waitUntil: 'load', timeout: 30000 });
  const info = await page.evaluate(() => {
    const crt = document.querySelector('.crt-overlay');
    return {
      reduce: window.__voidrush().reduceMotion,
      crt: crt ? getComputedStyle(crt).display : 'missing'
    };
  });
  check('reduced motion: game detects the preference', info.reduce === true, String(info.reduce));
  check('reduced motion: CRT overlay is hidden', info.crt === 'none', info.crt);
  await page.close();

  const cpage = await browser.newPage();
  let contrastSupported = true;
  try {
    await cpage.emulateMediaFeatures([{ name: 'prefers-contrast', value: 'more' }]);
  } catch (e) { contrastSupported = false; }
  await cpage.setViewport({ width: 390, height: 844, isMobile: true });
  await cpage.goto(base + '/games/voidrush.html', { waitUntil: 'load', timeout: 30000 });
  const crt = await cpage.evaluate(() => {
    const el = document.querySelector('.crt-overlay');
    return el ? getComputedStyle(el).display : 'missing';
  });
  if (contrastSupported) check('prefers-contrast: CRT overlay is hidden', crt === 'none', crt);
  else console.log('SKIP prefers-contrast check (emulation not supported by this puppeteer)');
  await cpage.close();
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => {
    await desktop(browser, base);
    await touchAndSteer(browser, base);
    await reducedMotion(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL VOIDRUSH CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
