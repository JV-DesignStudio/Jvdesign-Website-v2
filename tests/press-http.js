#!/usr/bin/env node
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await withServer(async ({ base, browser }) => {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width, height, isMobile: width < 700 });
      await page.goto(base + '/pages/press.html', { waitUntil: 'load', timeout: 30000 });
      await sleep(200);
      const info = await page.evaluate(() => ({
        title: document.title,
        body: document.body.textContent,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      check(width + 'px: press page loads', /Press/i.test(info.title) && info.title.length > 5, info.title);
      check(width + 'px: press page lists 14 games', /14 free browser games/.test(info.body));
      check(width + 'px: no sideways scrolling', info.overflow <= 2, String(info.overflow));
      check(width + 'px: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL PRESS HTTP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
