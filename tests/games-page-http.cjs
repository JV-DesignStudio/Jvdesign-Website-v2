#!/usr/bin/env node
/*
 * tests/games-page-http.cjs - shared load check for a single arcade game page.
 *
 * Used by the tiny <page>-http.js wrappers so every game named in a board card
 * has a real check the bot gate can run. Proves the page renders at 390 and
 * 1440 with no page errors, no sideways scrolling and a play surface present.
 */
const { withServer } = require('./story-run-harness.cjs');

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest|analytics|googletagmanager/i.test(t)) return;
    errors.push('console: ' + t);
  });
  return errors;
}

module.exports = async function run(pagePath, expectedTitle) {
  let failures = 0;
  const check = (name, ok, detail = '') => {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
    if (!ok) failures++;
  };

  await withServer(async ({ base, browser }) => {
    for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
      const page = await browser.newPage();
      const errors = watchErrors(page);
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 800, hasTouch: vp.width < 800 });
      const res = await page.goto(base + '/' + pagePath, { waitUntil: 'load', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 600));
      const info = await page.evaluate(() => ({
        title: document.title,
        canvas: !!document.querySelector('canvas'),
        main: !!document.querySelector('main, [role="main"], [data-game-root]'),
        buttons: document.querySelectorAll('button, [role="button"], a').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check(vp.name + ': page returns 200', !!(res && res.status() === 200), res ? String(res.status()) : 'no response');
      check(vp.name + ': title matches', !expectedTitle || new RegExp(expectedTitle, 'i').test(info.title), info.title);
      check(vp.name + ': play surface present', info.canvas || info.main);
      check(vp.name + ': has a control', info.buttons > 0, String(info.buttons));
      check(vp.name + ': no horizontal overflow', info.overflow <= 2, String(info.overflow));
      check(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
  });

  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL GAME PAGE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
};
