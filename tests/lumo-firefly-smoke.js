#!/usr/bin/env node
/* Lumo's Firefly Shooter: story return, modes, fixes and accessibility. */
const fs = require('fs');
const path = require('path');
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
    const text = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(text)) return;
    errors.push('console: ' + text);
  });
  return errors;
}

async function openGame(browser, base, width, height, suffix = '') {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width, height, isMobile: width < 700, hasTouch: width < 700 });
  await page.goto(base + '/games/lumo_firefly_night.html' + suffix, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__lumoFirefly, { timeout: 10000 });
  await sleep(120);
  return { page, errors };
}

const snap = () => window.__lumoFirefly.state();
const statusText = () => (document.getElementById('srStatus') || {}).textContent || '';
const clockText = () => (document.querySelector('.sr-time') || {}).textContent || '';

function staticChecks() {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'games/lumo_firefly_night.html'), 'utf8');
  const reg = fs.readFileSync(path.join(root, 'games-registry.js'), 'utf8');
  const paths = fs.readFileSync(path.join(root, 'scripts/lib/paths.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'assets/js/inline/games-lumo-firefly-night-1.js'), 'utf8');

  check('page loads the shared engine', /game-system\.js/.test(html) && /game-system\.css/.test(html));
  check('page loads the story run layer', /story-run\.js/.test(html) && /story-run\.css/.test(html));
  check('page loads the external game script', /assets\/js\/inline\/games-lumo-firefly-night-1\.js/.test(html));
  check('page loads the registry and onboarding', /games-registry\.js/.test(html) && /assets\/js\/game-onboarding\.js/.test(html));
  check('page has no inline game script', !/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html));
  check('page is indexable for the sitemap', !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html));
  check('registry lists lumo-firefly with Lumo', /"id":\s*"lumo-firefly"/.test(reg) && /"character":\s*"Lumo"/.test(reg));
  check('registry gives the game a BETA label', /"lumo-firefly":\s*"BETA"/.test(reg));
  check('the game is no longer an orphan', !/lumo_firefly_night\.html/.test(paths));
  check('the service worker precaches the page', /\/games\/lumo_firefly_night\.html/.test(sw));
  check('the thumbnail exists', fs.existsSync(path.join(root, 'assets/game-thumbs/lumo-firefly.webp')));
  check('page loads the self-hosted fonts', /assets\/fonts\/fonts\.css/.test(html));
  check('the a11y toggle names screen-reader messages', /Screen-reader game messages/.test(html) && !/Read game events aloud/.test(html));
  check('the game script links the Lumo book', /lumo_and_the_grumble_grit\.html/.test(js));
}

async function mainFlow(browser, base) {
  const { page, errors } = await openGame(browser, base, 390, 844, '?seed=smoke&story=1');

  const boot = await page.evaluate(snap);
  check('phone: title names Lumo', /Lumo's Firefly Shooter/.test(await page.title()));
  check('phone: start briefing shows first', boot.startShown && !boot.running, JSON.stringify({ startShown: boot.startShown, running: boot.running }));
  check('phone: start screen offers pace and run modes', await page.evaluate(() => !!document.querySelector('#diffPills .pill') && document.querySelectorAll('#modePills .pill').length === 2));
  check('phone: no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('phone: coarse pointer raises the tap radius', boot.coarsePointer === true && boot.tapRadius >= 44, JSON.stringify({ coarsePointer: boot.coarsePointer, tapRadius: boot.tapRadius }));

  await page.evaluate(() => document.getElementById('start').click());
  await sleep(300);
  const started = await page.evaluate(snap);
  const guide = await page.evaluate(() => (document.querySelector('.sr-guide') || {}).textContent || '');
  const clock = await page.evaluate(clockText);
  check('phone: Start begins the run', started.running && !started.startShown, JSON.stringify({ running: started.running, startShown: started.startShown }));
  check('phone: StoryRun mounts with Lumo', guide === 'Lumo', guide);
  check('phone: StoryRun clock renders mm:ss', /^\d+:\d\d$/.test(clock), clock);

  await page.evaluate(() => window.__lumoFirefly.collect('firefly'));
  const collected = await page.evaluate(snap);
  check('phone: rescuing a firefly scores and glows', collected.fireflies >= 1 && collected.score > 0 && collected.glow >= 100, JSON.stringify({ fireflies: collected.fireflies, score: collected.score, glow: collected.glow }));
  check('phone: firefly rescue starts the combo', collected.combo >= 2, 'combo=' + collected.combo);
  check('phone: firefly count is shown', await page.evaluate(() => document.getElementById('fireflies').textContent) === String(collected.fireflies));

  await page.evaluate(() => { window.__lumoFirefly.powerup('rapid'); window.__lumoFirefly.powerup('shield'); });
  const powered = await page.evaluate(snap);
  check('phone: power-up drops activate rapid fire', powered.power.rapid > 0, 'rapid=' + powered.power.rapid);
  check('phone: power-up drops activate a shield', powered.power.shield >= 1, 'shield=' + powered.power.shield);
  const beforeShield = await page.evaluate(snap);
  await page.evaluate(() => window.__lumoFirefly.damage(20));
  const afterShield = await page.evaluate(snap);
  check('phone: a shield absorbs a garden hit', afterShield.glow === beforeShield.glow && afterShield.power.shield === 0, JSON.stringify({ glow: afterShield.glow, shield: afterShield.power.shield }));
  await page.evaluate(() => window.__lumoFirefly.damage(20));
  const afterHit = await page.evaluate(snap);
  check('phone: an unshielded hit lowers the glow', afterHit.glow < beforeShield.glow, beforeShield.glow + ' -> ' + afterHit.glow);

  const beforeBurst = await page.evaluate(snap);
  await page.evaluate(() => {
    const game = window.__lumoFirefly;
    game.spawn('shadow');
    game.spawn('moth');
    game.spawn('firefly');
    game.burstAll();
  });
  await sleep(100);
  const burstState = await page.evaluate(snap);
  check('phone: burst clears threats and rescues fireflies', burstState.burst === beforeBurst.burst - 1 && burstState.threats > beforeBurst.threats && burstState.fireflies >= beforeBurst.fireflies, JSON.stringify({ burst: burstState.burst, threats: burstState.threats, fireflies: burstState.fireflies }));
  await page.evaluate(() => window.__lumoFirefly.slowPollen());
  const slowState = await page.evaluate(snap);
  check('phone: slow pollen has a real timer', slowState.slow === 1 && slowState.slowT > 0, JSON.stringify({ slow: slowState.slow, slowT: slowState.slowT }));

  const beforeWave = await page.evaluate(snap);
  await page.evaluate(() => window.__lumoFirefly.clearWave());
  await sleep(200);
  const wave2 = await page.evaluate(snap);
  check('phone: clearing a wave starts the next one', beforeWave.wave === 1 && wave2.wave === 2, beforeWave.wave + ' -> ' + wave2.wave);
  check('phone: clearing wave 1 does not finish the story', !wave2.modal && !wave2.finished, JSON.stringify({ modal: wave2.modal, finished: wave2.finished }));

  await page.evaluate(() => window.__lumoFirefly.clearWave());
  await sleep(200);
  const wave3 = await page.evaluate(snap);
  check('phone: the third wave is the boss wave', wave3.wave === 3 && wave3.target >= 10, 'wave=' + wave3.wave + ' target=' + wave3.target);

  await page.evaluate(() => { window.__lumoFirefly.addScore(4000); window.__lumoFirefly.clearWave(); });
  await sleep(350);
  const won = await page.evaluate(snap);
  check('phone: clearing wave 3 wins the story run', won.finished && won.result === 'success' && won.modal, JSON.stringify({ finished: won.finished, result: won.result, modal: won.modal }));
  check('phone: the result carries stars and best', await page.evaluate(() => !!document.querySelector('.sr-modal.show .ff-modal-extra') && /Best/.test(document.querySelector('.sr-modal.show .ff-modal-extra').textContent)), '');
  check('phone: the run summary records three waves', await page.evaluate(() => document.getElementById('sumWaves').textContent) === '3', await page.evaluate(() => document.getElementById('sumWaves').textContent));
  check('phone: the best score updates', won.best >= 4000, 'best=' + won.best);
  check('phone: a win offers the Lumo book', await page.evaluate(() => {
    const card = document.querySelector('.sr-modal.show .ff-book-card');
    const link = card && card.querySelector('.ff-book-link');
    const kicker = card && card.querySelector('.ff-book-kicker');
    const cover = card && card.querySelector('img');
    return !!link && /lumo_and_the_grumble_grit\.html/.test(link.getAttribute('href')) &&
      /story continues/i.test(kicker ? kicker.textContent : '') &&
      !!cover && /lumo-front-cover-concept-v001\.webp/.test(cover.getAttribute('src'));
  }));

  await page.evaluate(() => document.querySelector('.sr-modal.show .sr-again').click());
  await sleep(400);
  const replay = await page.evaluate(snap);
  check('phone: Play again resets a clean run', replay.running && !replay.finished && replay.score === 0 && replay.wave === 1 && replay.glow === 100 && !replay.modal, JSON.stringify({ running: replay.running, finished: replay.finished, score: replay.score, wave: replay.wave, glow: replay.glow, modal: replay.modal }));

  const clockA = await page.evaluate(clockText);
  await page.evaluate(() => document.getElementById('pause').click());
  await sleep(150);
  const paused = await page.evaluate(snap);
  const clockPaused = await page.evaluate(clockText);
  await sleep(1200);
  const clockStill = await page.evaluate(clockText);
  check('phone: pause stops the run', paused.paused && paused.pauseShown, JSON.stringify({ paused: paused.paused, pauseShown: paused.pauseShown }));
  check('phone: pause freezes the StoryRun clock', clockStill === clockPaused, clockPaused + ' -> ' + clockStill);
  await page.evaluate(() => document.getElementById('resumeBtn').click());
  await sleep(1200);
  const resumed = await page.evaluate(snap);
  const clockResumed = await page.evaluate(clockText);
  check('phone: resume continues the run', !resumed.paused && !resumed.pauseShown, JSON.stringify({ paused: resumed.paused, pauseShown: resumed.pauseShown }));
  check('phone: resume restarts the StoryRun clock', clockResumed !== clockStill, clockStill + ' -> ' + clockResumed);
  check('phone: the pause button relabels', await page.evaluate(() => document.getElementById('pause').getAttribute('aria-pressed')) === 'false', '');

  const beforeKeyboard = await page.evaluate(snap);
  await page.keyboard.press('Space');
  await sleep(100);
  const afterKeyboard = await page.evaluate(snap);
  check('phone: Space shoots during play', afterKeyboard.shotsFired > beforeKeyboard.shotsFired, beforeKeyboard.shotsFired + ' -> ' + afterKeyboard.shotsFired);
  await page.keyboard.press('KeyP');
  await sleep(120);
  check('phone: P pauses the run', (await page.evaluate(snap)).paused);
  await page.keyboard.press('KeyP');
  await sleep(120);

  await page.evaluate(() => document.getElementById('a11yBox').click());
  await page.evaluate(() => window.__lumoFirefly.collect('firefly'));
  await sleep(120);
  const live = await page.evaluate(statusText);
  check('phone: text mode announces game events', /firefly/i.test(live) || /rescued/i.test(live), live.slice(0, 80));

  await page.evaluate(() => document.getElementById('soundBtn').click());
  const muted = await page.evaluate(snap);
  check('phone: the sound toggle mutes', muted.soundOn === false, String(muted.soundOn));
  check('phone: the mute setting is stored', await page.evaluate(() => localStorage.getItem('jvds_sound')) === '0');
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__lumoFirefly, { timeout: 10000 });
  const persisted = await page.evaluate(snap);
  check('phone: the best run survives a reload', persisted.best >= 4000, 'best=' + persisted.best);
  check('phone: the mute survives a reload', persisted.soundOn === false, String(persisted.soundOn));

  check('phone: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function optionsFlow(browser, base) {
  const { page, errors } = await openGame(browser, base, 390, 844, '?seed=options');
  await page.evaluate(() => document.querySelector('#diffPills .pill[data-diff="cozy"]').click());
  await page.evaluate(() => document.querySelector('#modePills .pill[data-mode="endless"]').click());
  const choice = await page.evaluate(snap);
  check('options: pace and mode are selectable', choice.difficulty === 'cozy' && choice.mode === 'endless', choice.difficulty + '/' + choice.mode);

  await page.evaluate(() => window.__lumoFirefly.start());
  await sleep(250);
  const started = await page.evaluate(snap);
  check('options: endless mode has a starting goal', started.target >= 6 && started.target <= 12, 'target=' + started.target);
  await page.evaluate(() => { window.__lumoFirefly.clearWave(); });
  await sleep(150);
  await page.evaluate(() => { window.__lumoFirefly.clearWave(); });
  await sleep(150);
  await page.evaluate(() => { window.__lumoFirefly.clearWave(); });
  await sleep(200);
  const endless = await page.evaluate(snap);
  check('options: endless mode keeps going past three waves', endless.wave >= 4 && !endless.finished && !endless.modal, JSON.stringify({ wave: endless.wave, finished: endless.finished, modal: endless.modal }));

  const seqA = await page.evaluate(() => {
    const game = window.__lumoFirefly;
    game.reset();
    game.setSeed('repeat');
    game.start();
    const out = [];
    for (let i = 0; i < 6; i++) {
      const bug = game.spawn();
      out.push(bug ? bug.type : 'none');
    }
    return out;
  });
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__lumoFirefly, { timeout: 10000 });
  const seqB = await page.evaluate(() => {
    const game = window.__lumoFirefly;
    game.reset();
    game.setSeed('repeat');
    game.start();
    const out = [];
    for (let i = 0; i < 6; i++) {
      const bug = game.spawn();
      out.push(bug ? bug.type : 'none');
    }
    return out;
  });
  check('options: a garden seed gives the same run', JSON.stringify(seqA) === JSON.stringify(seqB), JSON.stringify(seqA));
  check('options: challenge links carry the seed', /seed=repeat/.test(await page.evaluate(() => window.__lumoFirefly.shareLink())), await page.evaluate(() => window.__lumoFirefly.shareLink()));

  check('options: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function reducedMotionFlow(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  if (typeof page.emulateMediaFeatures === 'function') {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/lumo_firefly_night.html?seed=motion', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__lumoFirefly, { timeout: 10000 });
  const boot = await page.evaluate(snap);
  check('motion: the preference is detected', boot.reduceMotion === true, String(boot.reduceMotion));
  await page.evaluate(() => window.__lumoFirefly.start());
  await sleep(200);
  await page.evaluate(() => window.__lumoFirefly.damage(20));
  const after = await page.evaluate(snap);
  check('motion: reduced motion removes the damage shake', after.stats.shakeHits === 0, 'hits=' + after.stats.shakeHits);
  check('motion: the run still works', after.glow < 100, 'glow=' + after.glow);
  check('motion: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function desktopCheck(browser, base) {
  const { page, errors } = await openGame(browser, base, 1440, 900, '?seed=desktop');
  const boot = await page.evaluate(snap);
  check('desktop 1440: the briefing shows', boot.startShown);
  check('desktop 1440: no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.evaluate(() => document.getElementById('start').click());
  await sleep(250);
  const started = await page.evaluate(snap);
  check('desktop 1440: Start begins the run', started.running && !started.startShown);
  check('desktop 1440: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function bookCardFlow(browser, base) {
  const { page, errors } = await openGame(browser, base, 390, 844, '?seed=book');
  await page.evaluate(() => window.__lumoFirefly.start());
  await sleep(200);
  await page.evaluate(() => window.__lumoFirefly.damage(200));
  await sleep(300);
  const lost = await page.evaluate(snap);
  check('book: a lost run shows the result modal', lost.finished && lost.result === 'fail' && lost.modal, JSON.stringify({ finished: lost.finished, result: lost.result, modal: lost.modal }));
  check('book: a lost run offers the Lumo book with recovery copy', await page.evaluate(() => {
    const card = document.querySelector('.sr-modal.show .ff-book-card');
    const link = card && card.querySelector('.ff-book-link');
    const kicker = card && card.querySelector('.ff-book-kicker');
    return !!link && /lumo_and_the_grumble_grit\.html/.test(link.getAttribute('href')) &&
      /read the book/i.test(link.textContent) &&
      /more light/i.test(kicker ? kicker.textContent : '');
  }));
  check('book: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => {
    await mainFlow(browser, base);
    await optionsFlow(browser, base);
    await reducedMotionFlow(browser, base);
    await bookCardFlow(browser, base);
    await desktopCheck(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL LUMO FIREFLY CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
