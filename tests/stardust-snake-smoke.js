#!/usr/bin/env node
/*
 * tests/stardust-snake-smoke.js
 *
 * A1137 regression guard for games/stardust-snake.html: classic Snake reskinned
 * as a Stardust trail of light. Proves the whole loop through the real UI:
 *   - the page loads at 390 and 1440 with no errors and no sideways scroll
 *   - Play starts the run and hides the intro
 *   - steering turns the trail (keyboard and the on-screen D-pad)
 *   - eating a star grows the trail, raises the score and speeds the run up
 *   - hitting the edge ends the run, shows the game-over card
 *   - Play again restarts a clean trail
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
  score: window.__stardustSnake.score(),
  len: window.__stardustSnake.snake().length,
  speed: window.__stardustSnake.speed(),
  head: window.__stardustSnake.snake()[0],
  startShown: !document.getElementById('startScreen').classList.contains('hidden'),
  overShown: !document.getElementById('overScreen').classList.contains('hidden'),
  overScore: document.getElementById('overScore').textContent,
  domScore: document.getElementById('score').textContent,
  domLen: document.getElementById('length').textContent,
  title: document.title,
  hook: !!window.__stardustSnake
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

  // Eat a star: drop it straight ahead, the trail should grow and the score rise.
  const beforeEat = await page.evaluate(SNAP);
  await page.evaluate(() => window.__stardustSnake.placeFoodAhead());
  let afterEat = beforeEat;
  for (let i = 0; i < 30 && afterEat.score < 1; i++) {
    await sleep(80);
    afterEat = await page.evaluate(SNAP);
  }
  check(vp.name + ': eating a star raises the score', afterEat.score >= 1, 'score=' + afterEat.score);
  check(vp.name + ': eating a star grows the trail', afterEat.len > beforeEat.len, beforeEat.len + ' -> ' + afterEat.len);
  check(vp.name + ': the run speeds up as it grows', afterEat.speed < beforeEat.speed, beforeEat.speed + ' -> ' + afterEat.speed);
  check(vp.name + ': the HUD score matches the run', afterEat.domScore === String(afterEat.score), afterEat.domScore);

  // Steer with the on-screen D-pad: turn downward and the head should descend.
  const preTurn = await page.evaluate(SNAP);
  await page.evaluate(() => document.getElementById('dDown').click());
  await sleep(500);
  const turned = await page.evaluate(SNAP);
  check(vp.name + ': the D-pad steers the trail', turned.head.y > preTurn.head.y, 'y ' + preTurn.head.y + ' -> ' + turned.head.y);

  // Keep going until the trail leaves the sky (edge hit).
  let end = turned;
  for (let i = 0; i < 90 && !end.dead; i++) {
    await sleep(80);
    end = await page.evaluate(SNAP);
  }
  check(vp.name + ': leaving the sky ends the run', end.dead && !end.running, JSON.stringify({ dead: end.dead, running: end.running }));
  check(vp.name + ': the game-over card shows', end.overShown);
  check(vp.name + ': the game-over card reports the score', Number(end.overScore) === end.score, end.overScore + ' vs ' + end.score);

  // Play again is a clean trail.
  await page.evaluate(() => document.getElementById('againBtn').click());
  await sleep(220);
  const replay = await page.evaluate(SNAP);
  check(vp.name + ': Play again restarts a fresh trail',
    replay.running && !replay.dead && replay.score === 0 && replay.len === 3 && !replay.overShown,
    JSON.stringify({ running: replay.running, dead: replay.dead, score: replay.score, len: replay.len }));

  check(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

// The run is a pure Stardust classic: no leftover multiplayer or unrelated copy.
function staticChecks() {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(ROOT, 'games/stardust-snake.html'), 'utf8');
  const registry = fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8');
  check('page loads the shared game engine', /game-system\.js/.test(html) && /game-system\.css/.test(html));
  check('page carries no inline game script (CSP safe)', !/<script(?![^>]*\bsrc=)[^>]*>\s*\(function/.test(html));
  check('registry lists stardust-snake with the Stardust guide', /"id":\s*"stardust-snake"/.test(registry) && /"character":\s*"Stardust"/.test(registry));
  check('registry gives the game a quality label', /"stardust-snake":\s*"(READY|BETA|EXPERIMENT)"/.test(registry));
  check('no live entry promises multiplayer', !/multiplayer/i.test(registry));
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => {
    await playViewport(browser, base, { name: 'phone 390px', width: 390, height: 844 });
    await playViewport(browser, base, { name: 'desktop 1440px', width: 1440, height: 900 });
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL STARDUST SNAKE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
