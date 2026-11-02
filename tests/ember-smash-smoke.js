#!/usr/bin/env node
/*
 * tests/ember-smash-smoke.js , A980
 *
 * Ember Smash is Ember's brick breaker: slide the forge paddle, keep the spark
 * alive and smash every glowing brick across six forges. This drives the real
 * page at phone and desktop widths, proves the shared run layer and HUD mount,
 * serves the spark through a genuine pointer event and checks it is loose and
 * moving, then confirms there are no page errors and no sideways scroll.
 *
 * Run: node tests/ember-smash-smoke.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail && !cond ? ' - ' + detail : ''));
  if (!cond) failures++;
};

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'games', 'ember-smash.html'), 'utf8');
  ok('page is the Ember Smash brick breaker', /Ember Smash/.test(html) && !/Tiger Smash/.test(html));
  ok('loads the shared game system and run layer', /game-system\.js/.test(html) && /story-run\.js/.test(html));
  ok('uses the shared brick-breaker css', /style-game-ember-smash\.css/.test(html));
  ok('offers the forge editor from the start card and HUD', /id="forgeEditor"/.test(html) && /id="forgeOpenStart"/.test(html) && /id="forgeHud"/.test(html));

  await withServer(async ({ base, browser }) => {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(base + '/games/ember-smash.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#canvas', { timeout: 10000 });
      await page.waitForSelector('[data-storyrun] .sr-bar', { timeout: 10000 });

      const boot = await page.evaluate(() => ({
        title: document.title,
        hud: ['score', 'level', 'lives', 'bricks', 'goal', 'levelName'].every((id) => document.getElementById(id)),
        run: !!(window.__storyRun && window.__storyRun.id === 'ember-smash'),
        guide: window.__storyRun && window.__storyRun.character,
        state: window.__emberSmash && window.__emberSmash.state()
      }));
      ok(vp.name + ': title names the game', /Ember Smash/.test(boot.title), boot.title);
      ok(vp.name + ': the HUD is complete', boot.hud);
      ok(vp.name + ': the run layer is Ember', boot.run && boot.guide === 'Ember', boot.guide);
      ok(vp.name + ': opens with a full wall and three lives',
        !!boot.state && boot.state.alive >= 9 && boot.state.lives === 3, JSON.stringify(boot.state));

      // Serve with a genuine pointerdown where the paddle sits.
      await page.evaluate(() => {
        const c = document.getElementById('canvas'), r = c.getBoundingClientRect();
        c.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 2, clientY: r.top + r.height - 16, bubbles: true }));
      });
      await page.waitForFunction(() => window.__emberSmash && !window.__emberSmash.state().stuck, { timeout: 3000 }).catch(() => {});
      const moving = await page.evaluate(() => new Promise((res) => {
        const a = window.__emberSmash.state();
        const t0 = Date.now();
        const tick = () => {
          const b = window.__emberSmash.state();
          if (b.bx !== a.bx || b.by !== a.by || b.alive < a.alive || Date.now() - t0 > 2500) return res({ a, b });
          setTimeout(tick, 60);
        };
        tick();
      }));
      ok(vp.name + ': the spark serves and moves',
        !moving.a.stuck && (moving.b.bx !== moving.a.bx || moving.b.by !== moving.a.by || moving.b.alive < moving.a.alive),
        JSON.stringify(moving));

      // Paddle follows the pointer across the stage.
      await page.evaluate(() => {
        const c = document.getElementById('canvas'), r = c.getBoundingClientRect();
        c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.2, clientY: r.top + r.height - 16, bubbles: true }));
      });
      await new Promise((r) => setTimeout(r, 120));
      ok(vp.name + ': the paddle tracks the pointer', await page.evaluate(() => window.__emberSmash.state().paddleX < 300));

      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // prefers-reduced-motion: reduce must stop the decorative embers, particle
    // bursts, brick debris and screen shake while the game stays playable.
    const rm = await browser.newPage();
    const rmErrors = [];
    rm.on('pageerror', (e) => rmErrors.push(e.message));
    if (typeof rm.emulateMediaFeatures === 'function') {
      await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    }
    await rm.setViewport({ width: 390, height: 844, isMobile: true });
    await rm.goto(base + '/games/ember-smash.html', { waitUntil: 'load', timeout: 30000 });
    await rm.waitForSelector('#canvas', { timeout: 10000 });
    await rm.waitForFunction(() => !!window.__emberSmash, { timeout: 10000 });
    const bootRM = await rm.evaluate(() => window.__emberSmash.state());
    ok('reduce motion: the game detects the preference', bootRM.reducedMotion === true, JSON.stringify(bootRM));
    ok('reduce motion: no ambient embers at boot', bootRM.embers === 0, String(bootRM.embers));

    await rm.evaluate(() => {
      const c = document.getElementById('canvas'), r = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 2, clientY: r.top + r.height - 16, bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 3000));
    const afterRM = await rm.evaluate(() => window.__emberSmash.state());
    ok('reduce motion: the ball still plays', afterRM.alive < bootRM.alive || afterRM.score > 0, JSON.stringify(afterRM));
    ok('reduce motion: no particles, debris or shake keep running',
      afterRM.particles === 0 && afterRM.debris === 0 && afterRM.shake === 0 && afterRM.embers === 0,
      JSON.stringify({ particles: afterRM.particles, debris: afterRM.debris, shake: afterRM.shake, embers: afterRM.embers }));
    ok('reduce motion: no page errors', rmErrors.length === 0, rmErrors.slice(0, 2).join(' | '));
    await rm.close();
  });

  console.log(failures ? `\n${failures} FAILED` : '\nEmber Smash smoke: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
