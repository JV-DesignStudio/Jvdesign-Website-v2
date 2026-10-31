#!/usr/bin/env node
/*
 * tests/ember-smash-forge.js , A2162
 *
 * Ember Smash lets a learner paint their own 9x5 wall in the in-game forge,
 * play it straight away and share it as a URL hash. This drives the real page
 * at phone and desktop widths: opens the editor from the start card and the
 * HUD, paints normal and gold bricks, plays the wall, checks the score state,
 * reloads the share link, clears the grid, and returns to the campaign forges.
 *
 * Run: node tests/ember-smash-forge.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail && !cond ? ' - ' + detail : ''));
  if (!cond) failures++;
};

const WALL = '111111111200000000000000000000000000000000000';

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'games', 'ember-smash.html'), 'utf8');
  ok('page ships the forge editor', /id="forgeEditor"/.test(html) && /id="forgeGrid"/.test(html));
  ok('page offers both forge entry points', /id="forgeOpenStart"/.test(html) && /id="forgeHud"/.test(html));

  await withServer(async ({ base, browser }) => {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(base + '/games/ember-smash.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#canvas', { timeout: 10000 });

      await page.click('#forgeOpenStart');
      await page.waitForSelector('#forgeEditor.show', { timeout: 5000 });
      ok(vp.name + ': the editor opens with 45 cells', await page.evaluate(() => document.querySelectorAll('.forge-cell').length === 45));

      await page.click('#forgeClear');
      ok(vp.name + ': clear empties the grid', await page.evaluate(() => document.querySelectorAll('.forge-cell.brick, .forge-cell.gold').length === 0));

      await page.click('.forge-tools [data-brush="1"]');
      for (let c = 0; c < 9; c++) await page.click(`.forge-cell[data-r="0"][data-c="${c}"]`);
      await page.click('.forge-tools [data-brush="2"]');
      await page.click('.forge-cell[data-r="1"][data-c="0"]');
      ok(vp.name + ': painting marks bricks and gold', await page.evaluate(() =>
        document.querySelectorAll('.forge-cell.brick').length === 9 && document.querySelectorAll('.forge-cell.gold').length === 1));

      await page.click('#forgePlay');
      await page.waitForFunction((p) => (location.hash || '').indexOf(p) >= 0, { timeout: 5000 }, WALL).catch(() => {});
      await new Promise((r) => setTimeout(r, 250));
      const played = await page.evaluate(() => ({
        hash: location.hash,
        state: window.__emberSmash.state(),
        level: document.getElementById('level').textContent,
        name: document.getElementById('levelName').textContent,
        immersive: document.documentElement.classList.contains('jvds-immersive')
      }));
      ok(vp.name + ': the share hash encodes the wall', played.hash === '#forge=' + WALL, played.hash);
      ok(vp.name + ': the painted wall is the one in play',
        played.state.alive === 10 && played.state.level === 1 && played.level === '1/1', JSON.stringify(played));
      ok(vp.name + ': play enters the immersive forge', played.immersive);
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

      // The share link should rebuild the same wall from a cold load.
      const shared = await browser.newPage();
      await shared.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await shared.goto(base + '/games/ember-smash.html#forge=' + WALL, { waitUntil: 'load', timeout: 30000 });
      await shared.waitForSelector('#canvas', { timeout: 10000 });
      await shared.waitForFunction(() => window.__emberSmash && window.__emberSmash.state().alive === 10, { timeout: 5000 }).catch(() => {});
      const sharedState = await shared.evaluate(() => window.__emberSmash.state());
      ok(vp.name + ': the share link rebuilds the wall', sharedState.alive === 10, JSON.stringify(sharedState));
      await shared.close();

      // Empty walls are refused with a message, then the campaign can return.
      await page.click('#forgeHud');
      await page.waitForSelector('#forgeEditor.show', { timeout: 5000 });
      await page.click('#forgeClear');
      await page.click('#forgePlay');
      ok(vp.name + ': an empty wall is refused', /at least one brick/.test(await page.evaluate(() => document.getElementById('forgeMsg').textContent)));
      await page.click('#forgeCampaign');
      await new Promise((r) => setTimeout(r, 200));
      const campaign = await page.evaluate(() => ({
        state: window.__emberSmash.state(),
        level: document.getElementById('level').textContent,
        hash: location.hash
      }));
      ok(vp.name + ': back to the six campaign forges', campaign.state.level === 1 && campaign.level === '1/6' && campaign.hash === '', JSON.stringify(campaign));

      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  });

  console.log(failures ? `\n${failures} FAILED` : '\nEmber Smash forge: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
