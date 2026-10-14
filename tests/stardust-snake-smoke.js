#!/usr/bin/env node
/*
 * tests/stardust-snake-smoke.js
 *
 * Regression guard for games/stardust-snake.html: classic Snake reskinned as a
 * Stardust trail of light, at full arcade parity with the other curated games.
 * Proves the whole loop through the real UI:
 *   - loads at 390 and 1440 with no errors and no sideways scroll
 *   - the shared StoryRun layer mounts (guide Stardust, a mm:ss clock)
 *   - Play starts the run; eating a star grows the trail and speeds it up
 *   - the star milestones fire and advance the goal
 *   - the on-screen D-pad steers the trail
 *   - leaving the sky ends the run and shows the StoryRun finish modal
 *   - Play again restarts; pause/resume works
 *   - prefers-reduced-motion disables the death shake
 *
 * Run: node tests/stardust-snake-smoke.js
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

const SNAP = () => ({
  running: window.__stardustSnake.running(),
  dead: window.__stardustSnake.dead(),
  paused: window.__stardustSnake.paused(),
  score: window.__stardustSnake.score(),
  len: window.__stardustSnake.snake().length,
  speed: window.__stardustSnake.speed(),
  head: window.__stardustSnake.snake()[0],
  particles: window.__stardustSnake.particles(),
  milestone: window.__stardustSnake.milestone(),
  milestoneHits: window.__stardustSnake.milestoneHits(),
  shakeHits: window.__stardustSnake.shakeHits(),
  startShown: !document.getElementById('startScreen').classList.contains('hidden'),
  domScore: document.getElementById('score').textContent,
  domGoal: document.getElementById('goal').textContent,
  srBar: !!document.querySelector('[data-storyrun] .sr-bar'),
  srGuide: (document.querySelector('[data-storyrun] .sr-guide') || {}).textContent || '',
  srClock: (document.querySelector('[data-storyrun] .sr-time') || {}).textContent || '',
  modal: !!document.querySelector('.sr-modal.show'),
  modalScore: (document.querySelector('.sr-modal.show .sr-stats b') || {}).textContent || '',
  title: document.title
});

async function playViewport(browser, base, vp) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
  await page.goto(base + '/games/stardust-snake.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__stardustSnake, { timeout: 10000 });

  const boot = await page.evaluate(SNAP);
  check(vp.name + ': title names the game', /Stardust Snake/.test(boot.title), boot.title);
  check(vp.name + ': intro screen shows first', boot.startShown && !boot.running);
  check(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  // Start through the real button.
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(260);
  const started = await page.evaluate(SNAP);
  check(vp.name + ': Play starts the run', started.running && !started.startShown, JSON.stringify({ running: started.running, startShown: started.startShown }));
  check(vp.name + ': the StoryRun HUD mounts', started.srBar);
  check(vp.name + ': the guide is Stardust', started.srGuide === 'Stardust', started.srGuide);
  check(vp.name + ': the run clock renders mm:ss', /^\d+:\d\d$/.test(started.srClock), started.srClock);

  // Eat stars until the first milestone (5): each feed proves grow + speed-up.
  const beforeEat = await page.evaluate(SNAP);
  await page.evaluate(() => window.__stardustSnake.setDir(1, 0));
  let fed = beforeEat, guard = 0;
  while (fed.score < 5 && guard < 80) {
    await page.evaluate(() => window.__stardustSnake.placeFoodAhead());
    await sleep(55);
    fed = await page.evaluate(SNAP);
    guard++;
  }
  check(vp.name + ': eating stars grows the trail', fed.len >= 8, 'len=' + fed.len);
  check(vp.name + ': the run speeds up as it grows', fed.speed < beforeEat.speed, beforeEat.speed + ' -> ' + fed.speed);
  check(vp.name + ': the HUD score matches the run', fed.domScore === String(fed.score), fed.domScore);
  check(vp.name + ': the star milestone fires', fed.milestoneHits >= 1, 'hits=' + fed.milestoneHits);
  check(vp.name + ': the goal advances past the first milestone', fed.milestone > 5 && fed.domGoal === String(fed.milestone), 'goal=' + fed.domGoal);

  // Steer with the on-screen D-pad: turn down and the head should descend.
  const preTurn = await page.evaluate(SNAP);
  await page.evaluate(() => document.getElementById('dDown').click());
  await sleep(420);
  const turned = await page.evaluate(SNAP);
  check(vp.name + ': the D-pad steers the trail', turned.head.y > preTurn.head.y, 'y ' + preTurn.head.y + ' -> ' + turned.head.y);

  // Keep going until the trail leaves the sky (edge hit).
  let end = turned;
  for (let i = 0; i < 90 && !end.dead; i++) { await sleep(80); end = await page.evaluate(SNAP); }
  check(vp.name + ': leaving the sky ends the run', end.dead && !end.running, JSON.stringify({ dead: end.dead, running: end.running }));
  check(vp.name + ': the StoryRun finish modal shows', end.modal);
  check(vp.name + ': the finish modal reports the score', Number(end.modalScore) === end.score, end.modalScore + ' vs ' + end.score);

  // Play again restarts a clean trail through the StoryRun modal.
  await page.evaluate(() => { const b = document.querySelector('.sr-modal.show .sr-again'); if (b) b.click(); });
  await sleep(300);
  const replay = await page.evaluate(SNAP);
  check(vp.name + ': Play again restarts a fresh trail',
    replay.running && !replay.dead && replay.score === 0 && replay.len === 3 && !replay.modal,
    JSON.stringify({ running: replay.running, dead: replay.dead, score: replay.score, len: replay.len, modal: replay.modal }));

  // Pause and resume.
  await page.evaluate(() => document.getElementById('pause').click());
  await sleep(150);
  const paused = await page.evaluate(SNAP);
  check(vp.name + ': pause stops the run', paused.paused === true, String(paused.paused));
  await page.evaluate(() => { const ov = document.querySelector('.gs-resume'); if (ov) ov.click(); });
  await sleep(150);
  const resumed = await page.evaluate(SNAP);
  check(vp.name + ': resume continues the run', resumed.paused === false && resumed.running, JSON.stringify({ paused: resumed.paused, running: resumed.running }));

  check(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function reduceMotionCheck(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  if (typeof page.emulateMediaFeatures === 'function') {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(base + '/games/stardust-snake.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__stardustSnake, { timeout: 10000 });
  const rm = await page.evaluate(() => window.__stardustSnake.reduceMotion);
  check('reduced motion: the game detects the preference', rm === true, String(rm));

  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(200);
  await page.evaluate(() => window.__stardustSnake.setDir(0, 1));
  let s = await page.evaluate(SNAP);
  for (let i = 0; i < 60 && !s.dead; i++) { await sleep(80); s = await page.evaluate(SNAP); }
  check('reduced motion: the run still ends', s.dead);
  check('reduced motion: no death screen shake', s.shakeHits === 0, 'hits=' + s.shakeHits);
  check('reduced motion: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

function staticChecks() {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(ROOT, 'games/stardust-snake.html'), 'utf8');
  const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
  check('page loads the shared game engine', /game-system\.js/.test(html) && /game-system\.css/.test(html));
  check('page loads the shared run + showcase layers', /story-run\.js/.test(html) && /game-showcase\.js/.test(html) && /story-run\.css/.test(html));
  check('page carries no inline game script (CSP safe)', !/<script(?![^>]*\bsrc=)[^>]*>\s*\(function/.test(html));
  check('registry lists stardust-snake with the Stardust guide', /"id":\s*"stardust-snake"/.test(registry) && /"character":\s*"Stardust"/.test(registry));
  check('registry gives the game a quality label', /"stardust-snake":\s*"(READY|BETA|EXPERIMENT)"/.test(registry));
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => {
    await playViewport(browser, base, { name: 'phone 390px', width: 390, height: 844 });
    await playViewport(browser, base, { name: 'desktop 1440px', width: 1440, height: 900 });
    await reduceMotionCheck(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL STARDUST SNAKE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
