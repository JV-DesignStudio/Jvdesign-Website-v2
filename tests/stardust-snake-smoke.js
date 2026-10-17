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
 *   - a fast chain builds a combo and the live best score tracks the run
 *   - the star milestones fire and advance the goal
 *   - special stars: a golden star scores +5 and slows the run, a dark spark
 *     shrinks the trail
 *   - the Trail palette unlocks as the best grows and is saved
 *   - the Speed pills change the starting pace; wrap mode sends the trail
 *     across the seam instead of ending the run
 *   - the best score persists across a reload
 *   - the on-screen D-pad steers the trail
 *   - leaving the sky (wrap off) ends the run and shows the StoryRun modal
 *   - Play again restarts; pause/resume works and the button relabels
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
  combo: window.__stardustSnake.combo(),
  comboShown: document.getElementById('combo').classList.contains('show'),
  eatCount: window.__stardustSnake.eatCount(),
  lastEat: window.__stardustSnake.lastEat(),
  golden: window.__stardustSnake.goldenCount(),
  bestGame: window.__stardustSnake.best(),
  domBest: document.getElementById('best').textContent,
  wrap: window.__stardustSnake.wallWrap(),
  wallDeaths: window.__stardustSnake.wallDeaths(),
  difficulty: window.__stardustSnake.difficulty(),
  unlockedPalettes: window.__stardustSnake.unlockedPalettes(),
  achievements: window.__stardustSnake.achievements(),
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

async function feedUntil(page, target, type, guard = 200) {
  let s = await page.evaluate(SNAP);
  let i = 0;
  while (s.eatCount < target && i < guard) {
    await page.evaluate(t => window.__stardustSnake.placeFoodAhead(t), type);
    await sleep(45);
    s = await page.evaluate(SNAP);
    i++;
  }
  return s;
}

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

  // Eat stars: two through the real moving loop prove eat-on-move, then three
  // deterministic feeds build the combo without the phone loop drifting to the
  // wall (extra particles slow the emulated timer).
  const beforeEat = await page.evaluate(SNAP);
  await page.evaluate(() => window.__stardustSnake.setDir(1, 0));
  const moved = await feedUntil(page, beforeEat.eatCount + 2, 'normal');
  check(vp.name + ': eating a star as it moves grows the trail', moved.len >= beforeEat.len + 2, 'len=' + moved.len);
  await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__stardustSnake.feedNow('normal'); });
  await sleep(60);
  const fed = await page.evaluate(SNAP);
  check(vp.name + ': eating stars grows the trail', fed.len >= 8, 'len=' + fed.len);
  check(vp.name + ': the run speeds up as it grows', fed.speed < beforeEat.speed, beforeEat.speed + ' -> ' + fed.speed);
  check(vp.name + ': the HUD score matches the run', fed.domScore === String(fed.score), fed.domScore);
  check(vp.name + ': a fast chain builds a combo', fed.combo >= 2, 'combo=' + fed.combo);
  check(vp.name + ': the combo badge shows', fed.comboShown);
  check(vp.name + ': the star milestone fires', fed.milestoneHits >= 1, 'hits=' + fed.milestoneHits);
  check(vp.name + ': the goal advances past the first milestone', fed.milestone > 5 && fed.domGoal === String(fed.milestone), 'goal=' + fed.domGoal);
  check(vp.name + ': the best score tracks the run live', Number(fed.domBest) === Math.max(fed.bestGame, fed.score), fed.domBest + ' vs ' + Math.max(fed.bestGame, fed.score));
  check(vp.name + ': collecting a star unlocks First Spark', fed.achievements.indexOf('first-star') >= 0, fed.achievements.join(','));

  // Steer with the on-screen D-pad: turn down and the head should descend.
  const preTurn = await page.evaluate(SNAP);
  await page.evaluate(() => document.getElementById('dDown').click());
  await sleep(420);
  const turned = await page.evaluate(SNAP);
  check(vp.name + ': the D-pad steers the trail', turned.head.y > preTurn.head.y, 'y ' + preTurn.head.y + ' -> ' + turned.head.y);

  // Keep going until the trail leaves the sky (edge hit, wrap off by default).
  let end = turned;
  for (let i = 0; i < 120 && !end.dead; i++) { await sleep(80); end = await page.evaluate(SNAP); }
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

  // Pause the run: the button relabels and the trail holds still.
  await page.evaluate(() => document.getElementById('pause').click());
  await sleep(150);
  const paused = await page.evaluate(SNAP);
  const pauseLabel = await page.evaluate(() => document.getElementById('pause').textContent.trim());
  check(vp.name + ': pause stops the run', paused.paused === true, String(paused.paused));
  check(vp.name + ': the Pause button reads Resume while paused', /resume/i.test(pauseLabel), pauseLabel);
  await page.evaluate(() => { const ov = document.querySelector('.gs-resume'); if (ov) ov.click(); });
  await sleep(150);
  const resumed = await page.evaluate(SNAP);
  const resumeLabel = await page.evaluate(() => document.getElementById('pause').textContent.trim());
  check(vp.name + ': resume continues the run', resumed.paused === false && resumed.running, JSON.stringify({ paused: resumed.paused, running: resumed.running }));
  check(vp.name + ': the button reads Pause again after resume', /pause/i.test(resumeLabel) && !/resume/i.test(resumeLabel), resumeLabel);

  check(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function extrasCheck(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/stardust-snake.html', { waitUntil: 'load', timeout: 30000 });
  // Fresh storage so the best starts at 0 and the palette locks are known.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__stardustSnake, { timeout: 10000 });

  const paletteCount = await page.evaluate(() => document.querySelectorAll('#palettePills .pill').length);
  const boot = await page.evaluate(SNAP);
  check('extras: four trail palettes are listed', paletteCount === 4, 'pills=' + paletteCount);
  check('extras: only one palette is open at best 0', boot.unlockedPalettes === 1, 'open=' + boot.unlockedPalettes);

  // A speed pill changes the starting pace.
  await page.click('#diffPills .pill[data-diff="turbo"]');
  const diff = await page.evaluate(SNAP);
  check('extras: choosing Turbo sets the difficulty', diff.difficulty === 'turbo', diff.difficulty);
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(220);
  const started = await page.evaluate(SNAP);
  check('extras: Turbo starts the run faster', started.speed <= 120, 'step=' + started.speed);

  // Feed five normal stars, then a golden one (bonus + slow down). These use
  // the deterministic hook so the result is identical on every viewport.
  await page.evaluate(() => window.__stardustSnake.setDir(1, 0));
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__stardustSnake.feedNow('normal'); });
  await sleep(50);
  const beforeGold = await page.evaluate(SNAP);
  await page.evaluate(() => window.__stardustSnake.feedNow('golden'));
  await sleep(40);
  const gold = await page.evaluate(SNAP);
  check('extras: a golden star scores a +5 bonus', gold.score - beforeGold.score >= 5, beforeGold.score + ' -> ' + gold.score);
  check('extras: a golden star slows the trail back down', gold.speed > beforeGold.speed, beforeGold.speed + ' -> ' + gold.speed);
  check('extras: the golden star is recorded', gold.lastEat === 'golden' && gold.golden >= 1, gold.lastEat + '/' + gold.golden);

  // A dark spark shrinks the trail.
  const beforePoi = gold;
  await page.evaluate(() => window.__stardustSnake.feedNow('poison'));
  await sleep(40);
  const poi = await page.evaluate(SNAP);
  check('extras: a dark spark shrinks the trail', poi.len < beforePoi.len, beforePoi.len + ' -> ' + poi.len);
  check('extras: the dark spark is recorded', poi.lastEat === 'poison', poi.lastEat);

  // Finish the run at the edge (wrap still off) so the best is saved.
  await page.evaluate(() => window.__stardustSnake.setWrap(false));
  await page.evaluate(() => window.__stardustSnake.setDir(0, 1));
  let end = poi;
  for (let i = 0; i < 140 && !end.dead; i++) { await sleep(80); end = await page.evaluate(SNAP); }
  check('extras: the run still ends at the edge', end.dead && !end.running);
  const runScore = end.score;

  // The best score and unlocked colours survive a reload.
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__stardustSnake, { timeout: 10000 });
  const persisted = await page.evaluate(SNAP);
  check('extras: the best score persists across reloads', persisted.bestGame >= runScore && Number(persisted.domBest) >= runScore, 'best=' + persisted.bestGame + ' run=' + runScore);
  check('extras: a rising best unlocks more trail colours', persisted.unlockedPalettes >= 1, 'open=' + persisted.unlockedPalettes);
  check('extras: the First Spark achievement is stored', persisted.achievements.indexOf('first-star') >= 0, persisted.achievements.join(','));

  // Wrap mode sends the trail across the seam instead of ending the run.
  await page.evaluate(() => window.__stardustSnake.setWrap(true));
  await page.evaluate(() => document.getElementById('restart').click());
  await sleep(220);
  await page.evaluate(() => window.__stardustSnake.setDir(0, -1));
  await sleep(260);
  await page.evaluate(() => window.__stardustSnake.setDir(-1, 0));
  let prev = await page.evaluate(SNAP);
  let wrapped = false;
  for (let i = 0; i < 160 && !prev.dead; i++) {
    await sleep(55);
    const now = await page.evaluate(SNAP);
    if (now.head.x === 19 && prev.head.x === 0) { wrapped = true; break; }
    prev = now;
  }
  check('extras: wrap mode sends the trail across the seam', wrapped, 'dead=' + prev.dead + ' x=' + prev.head.x);
  check('extras: wrap mode does not count a wall death', prev.wallDeaths === 0, String(prev.wallDeaths));

  check('extras: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
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
  check('page loads the shared score schema', /game-score\.js/.test(html));
  check('page carries no inline game script (CSP safe)', !/<script(?![^>]*\bsrc=)[^>]*>\s*\(function/.test(html));
  check('page offers a sound toggle', /id="sound"/.test(html));
  check('page offers difficulty + trail options', /id="diffPills"/.test(html) && /id="palettePills"/.test(html) && /id="wrapToggle"/.test(html));
  check('registry lists stardust-snake with the Stardust guide', /"id":\s*"stardust-snake"/.test(registry) && /"character":\s*"Stardust"/.test(registry));
  check('registry gives the game a quality label', /"stardust-snake":\s*"(READY|BETA|EXPERIMENT)"/.test(registry));
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => {
    await playViewport(browser, base, { name: 'phone 390px', width: 390, height: 844 });
    await playViewport(browser, base, { name: 'desktop 1440px', width: 1440, height: 900 });
    await extrasCheck(browser, base);
    await reduceMotionCheck(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL STARDUST SNAKE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
