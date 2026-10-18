#!/usr/bin/env node
/*
 * tests/play-http.js , the Arcade routing contract.
 *
 * The 2026-10-12 overhaul (9189b4ce) made every cabinet link straight to its
 * game file, so the old shared cover/launcher (games/play.html?g=id) became
 * orphaned. The cover UI is retired, but old links still exist, so play.html
 * is now a noindex redirect stub. This test pins that contract:
 *
 *   - games/play.html exists only as a noindex redirect stub
 *   - paths.js still treats it as a non-game orphan (not sitemap/search)
 *   - ?g=<known id> forwards to the real game file
 *   - ?g=<unknown> forwards back to the arcade
 *   - arcade.html cards link straight to game files, every file exists,
 *     and the page is clean at 390px and 1440px
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
  const paths = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'paths.js'), 'utf8');
  const stubPath = path.join(ROOT, 'games', 'play.html');
  const stub = fs.existsSync(stubPath) ? fs.readFileSync(stubPath, 'utf8') : '';

  check('cover stub exists', fs.existsSync(stubPath));
  check('cover stub is noindex', /name="robots" content="noindex/.test(stub));
  check('cover stub loads the redirect script', /assets\/js\/play-redirect\.js/.test(stub));
  check('paths.js keeps play.html out of the game line-up', /games\/play\.html/.test(paths));
  check('arcade links cards straight to game files', /href="games\/' \+ encodeURI\(g\.file\)/.test(arcade));
  check('arcade has no cover-page routing left', !/play\.html\?g=/.test(arcade) && !/function playHref\(g\)/.test(arcade));
}

async function redirectCheck(browser, base, query, expected) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/games/play.html' + query, { waitUntil: 'load', timeout: 30000 });
  await sleep(900);
  const url = new URL(page.url());
  check('redirect ' + (query || '(no query)') + ' -> ' + expected, url.pathname === expected, url.pathname);
  check('redirect ' + (query || '(no query)') + ' has no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

async function arcadeChecks(browser, base, width) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.setViewport({ width, height: 900 });
  await page.goto(base + '/arcade.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#grid .cab', { timeout: 15000 });
  await sleep(250);

  const result = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#grid .cab'));
    return {
      count: cards.length,
      hrefs: cards.map(c => c.getAttribute('href')),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  check(width + ': arcade renders cabinets', result.count > 0, String(result.count));
  check(width + ': every cabinet is a game file', result.hrefs.length > 0 && result.hrefs.every(h => /^games\/[^/]+\.html$/.test(h || '')), result.hrefs.slice(0, 3).join(', '));
  check(width + ': no cabinet uses the retired cover flow', !result.hrefs.some(h => /play\.html/.test(h || '')));
  const missing = result.hrefs.filter(h => h && !fs.existsSync(path.join(ROOT, decodeURIComponent(h))));
  check(width + ': every cabinet file exists', missing.length === 0, missing.slice(0, 3).join(', '));
  check(width + ': no horizontal overflow', result.overflow <= 2, String(result.overflow));
  check(width + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

(async () => {
  staticChecks();
  await withServer(async ({ base, browser }) => {
    await redirectCheck(browser, base, '?g=nova-siege', '/games/nova-siege.html');
    await redirectCheck(browser, base, '?g=does-not-exist', '/arcade.html');
    await redirectCheck(browser, base, '', '/arcade.html');
    await arcadeChecks(browser, base, 390);
    await arcadeChecks(browser, base, 1440);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL ARCADE ROUTING CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
