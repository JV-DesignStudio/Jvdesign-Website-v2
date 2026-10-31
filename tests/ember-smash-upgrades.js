#!/usr/bin/env node
/*
 * tests/ember-smash-upgrades.js , A2166
 *
 * After a campaign forge is cleared, Ember Smash pauses and offers three spark
 * upgrades. This drives the real page at phone and desktop widths: forces a
 * wall clear, checks the overlay, picks an upgrade, proves the perk applied and
 * the next forge started, then restarts and proves the run is fresh again.
 *
 * Run: node tests/ember-smash-upgrades.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail && !cond ? ' - ' + detail : ''));
  if (!cond) failures++;
};

const fresh = (u) => !u.paddle && !u.luck && !u.blast && !u.shield;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'games', 'ember-smash.html'), 'utf8');
  ok('page ships the upgrade overlay', /id="upgradeOverlay"/.test(html) && /id="upgradeChoices"/.test(html));

  await withServer(async ({ base, browser }) => {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(base + '/games/ember-smash.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#canvas', { timeout: 10000 });
      await page.evaluate(() => { window.__emberSmash.wake(); });
      await new Promise((r) => setTimeout(r, 300));

      await page.evaluate(() => window.__emberSmash.clearWall());
      await page.waitForSelector('#upgradeOverlay.show', { timeout: 5000 });
      const offered = await page.evaluate(() => ({
        count: document.querySelectorAll('.upgrade-choice').length,
        ids: Array.from(document.querySelectorAll('.upgrade-choice')).map((b) => b.dataset.id),
        state: window.__emberSmash.state(),
        scroll: document.documentElement.scrollWidth <= window.innerWidth + 1
      }));
      ok(vp.name + ': clearing a forge offers three upgrades', offered.count === 3, JSON.stringify(offered));
      ok(vp.name + ': the three upgrades are different', new Set(offered.ids).size === 3, offered.ids.join(','));
      ok(vp.name + ': the game waits for the choice', offered.state.playing === false, JSON.stringify(offered.state));
      ok(vp.name + ': the overlay does not scroll sideways', offered.scroll);

      await page.click('.upgrade-choice');
      await page.waitForFunction(() => window.__emberSmash.state().level === 2, { timeout: 5000 }).catch(() => {});
      const after = await page.evaluate(() => ({
        state: window.__emberSmash.state(),
        hidden: !document.getElementById('upgradeOverlay').classList.contains('show')
      }));
      ok(vp.name + ': choosing moves to the next forge', after.state.level === 2 && after.state.playing === true, JSON.stringify(after.state));
      ok(vp.name + ': the overlay closes after choosing', after.hidden);
      const picked = offered.ids[0];
      const u = after.state.upgrades;
      const applied = picked === 'paddle' ? u.paddle > 0
        : picked === 'life' ? after.state.lives > 3
        : picked === 'luck' ? u.luck === true
        : picked === 'blast' ? u.blast === true
        : u.shield > 0;
      ok(vp.name + ': the chosen upgrade is applied', applied, picked + ' ' + JSON.stringify(after.state));

      await page.click('#reset');
      await new Promise((r) => setTimeout(r, 250));
      const reset = await page.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': restart clears the upgrades', reset.level === 1 && reset.lives === 3 && fresh(reset.upgrades), JSON.stringify(reset));

      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  });

  console.log(failures ? `\n${failures} FAILED` : '\nEmber Smash upgrades: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
