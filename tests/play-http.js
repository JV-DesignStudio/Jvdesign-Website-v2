#!/usr/bin/env node
/*
 * tests/play-http.js , the shared Arcade cover/launcher page (games/play.html).
 *
 * The flow contract: every arcade card opens the cover page, the cover shows
 * the game's own art and details, and pressing Play loads the game full screen
 * with an Exit path back.
 *
 * Proves at 390px and 1440px:
 *   - /games/play.html?g=<id> renders the cover art, title and Play button
 *   - the card links in arcade.html route through play.html?g=<id>
 *   - pressing Play adds the full screen state and loads the real game file
 *   - Exit leaves the full screen state
 *   - an unknown game shows a friendly fallback, no page errors
 *   - no horizontal overflow
 *
 * Run: node tests/play-http.js
 */
const fs = require('fs');
const path = require('path');
const { withServer, ROOT } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticChecks() {
  const arcade = fs.readFileSync(path.join(ROOT, 'arcade.html'), 'utf8');
  check('arcade routes cards through the cover page', /function playHref\(g\)/.test(arcade) && /play\.html\?g=/.test(arcade));
  check('no arcade card links straight to a game file any more', !/href="games\/' \+ g\.file/.test(arcade) && !/location\.href = 'games\/' \+/.test(arcade));
  check('cover page file exists', fs.existsSync(path.join(ROOT, 'games', 'play.html')));
  const cover = fs.readFileSync(path.join(ROOT, 'games', 'play.html'), 'utf8');
  check('cover page is noindex', /name="robots" content="noindex/.test(cover));
  check('cover requests full screen on play', /requestFullscreen/.test(cover));
}

async function browserChecks(browser, base, width) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.setViewport({ width, height: 900 });
  await page.goto(base + '/games/play.html?g=nova-siege', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__play && window.__play.game, { timeout: 15000 });

  const cover = await page.evaluate(() => {
    const img = document.querySelector('#playCover img');
    return {
      title: document.getElementById('playTitle').textContent,
      img: img ? img.getAttribute('src') : null,
      hasPlay: !!document.getElementById('playBtn'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  check(width + ': cover shows the game title', /Nova Siege/.test(cover.title), cover.title);
  check(width + ': cover shows the game cover art', !!cover.img && cover.img.indexOf('NovaSiegeCover') >= 0, String(cover.img));
  check(width + ': cover has a Play button', cover.hasPlay);
  check(width + ': no horizontal overflow on the cover', cover.overflow <= 2, String(cover.overflow));

  await page.click('#playBtn');
  await sleep(300);
  const playing = await page.evaluate(() => ({
    playing: document.body.classList.contains('playing'),
    src: document.getElementById('playFrame').getAttribute('src'),
    exitVisible: getComputedStyle(document.getElementById('playExit')).display !== 'none'
  }));
  check(width + ': Play enters the full screen shell', playing.playing);
  check(width + ': Play loads the real game file', playing.src === 'nova-siege.html', String(playing.src));
  check(width + ': Exit control is visible while playing', playing.exitVisible);

  await page.click('#playExit');
  await sleep(200);
  const left = await page.evaluate(() => document.body.classList.contains('playing'));
  check(width + ': Exit leaves the full screen shell', !left);

  check(width + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function fallbackCheck(browser, base) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/games/play.html?g=does-not-exist', { waitUntil: 'load', timeout: 30000 });
  await sleep(300);
  const hasFallback = await page.evaluate(() => !!document.querySelector('.play-missing'));
  check('unknown game shows a friendly fallback', hasFallback);
  check('unknown game has no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => {
    await browserChecks(browser, base, 390);
    await browserChecks(browser, base, 1440);
    await fallbackCheck(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL PLAY COVER CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
