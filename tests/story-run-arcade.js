#!/usr/bin/env node
/*
 * tests/story-run-arcade.js , A718
 *
 * A585 (action) and A587 (cosy) wired their arcs to the shared StoryRun layer;
 * A718 finishes the arcade. This smoke pass proves each of the twelve remaining
 * self-contained games loads the shared run layer, mounts its run HUD (story bar
 * + five-minute clock), reports the registry id, the promised guide and a
 * five-minute cap, and throws no page error. The deep pass
 * (tests/story-run-arcade-deep.js) plays each run to its finish screen.
 *
 * Run: node tests/story-run-arcade.js
 */
const { withServer } = require('./story-run-harness.cjs');

// the twelve A718 games, with the guide each card promises
const GAMES = [
  { file: 'pixel-pet-arena.html', id: 'pixel-pet-arena', character: 'Pip' },
  { file: 'marble-run-lab.html', id: 'marble-run-lab', character: 'Lumo' },
  { file: 'backpack-quest.html', id: 'backpack-quest', character: 'Lumo' },
  { file: 'garden-defense.html', id: 'garden-defense', character: 'Lumo' },
  { file: 'pastry-match.html', id: 'pastry-match', character: 'Pip' },
  { file: 'candy_kingdom.html', id: 'candy-kingdom', character: 'Pip' },
  { file: 'call_of_the_cards.html', id: 'call-of-cards', character: 'Lumo' },
  { file: 'echo-casebook.html', id: 'echo-casebook', character: 'Echo' },
  { file: 'stardust-ruins.html', id: 'stardust-ruins', character: 'Stardust' },
  { file: 'cozy-cafe-match-game.html', id: 'cozy-cafe-match', character: 'Pip' },
  { file: 'bubble-pop-galaxy.html', id: 'bubble-pop', character: 'Stardust' },
  { file: 'arcane_citadel.html', id: 'arcane-citadel', character: 'Ember' }
];

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : ''));
  if (!cond) failures++;
};

(async () => {
  await withServer(async ({ base, browser }) => {
    for (const g of GAMES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      try {
        await page.goto(base + '/games/' + g.file, { waitUntil: 'load', timeout: 30000 });
        // Start the run: click the game's own start control, then fall back to begin().
        await page.evaluate(() => {
          const sels = ['#startBtn', '#start', '#playBtn', '#play-btn', '#btnPlayNow',
            '[data-start]', 'button.primary', '.sr-again', '.btn.primary'];
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && !el.disabled && el.offsetParent !== null) { el.click(); return; }
          }
          const btns = [...document.querySelectorAll('button')];
          const hit = btns.find(b => /start|play|go|begin|launch|roll|accuse/i.test(b.textContent || '') && b.offsetParent !== null);
          if (hit) hit.click();
        });
        await page.waitForFunction(() => {
          const r = window.__storyRun;
          return r && r.running && document.querySelector('[data-storyrun] .sr-bar');
        }, { timeout: 6000 }).catch(() => {});
        // If no start control matched, begin the run directly so the HUD itself is
        // still proven to mount. The deep test covers real play.
        await page.evaluate(() => {
          if (window.__storyRun && !window.__storyRun.running) window.__storyRun.begin();
        });
        const info = await page.evaluate(() => {
          const run = window.__storyRun;
          const bar = document.querySelector('[data-storyrun] .sr-bar');
          const clock = document.querySelector('[data-storyrun] .sr-time');
          return {
            hasRun: !!run,
            id: run ? run.id : null,
            character: run ? run.character : null,
            cap: run ? run.cap : null,
            mounted: !!bar,
            clock: clock ? clock.textContent : null,
            hasFinish: !!(run && typeof run.finish === 'function')
          };
        });
        ok(g.id + ': loads shared run layer', info.hasRun);
        ok(g.id + ': run id matches registry', info.id === g.id, info.id);
        ok(g.id + ': guide is the registry character', info.character === g.character, info.character);
        ok(g.id + ': cap is five minutes', info.cap === 300, String(info.cap));
        ok(g.id + ': run HUD mounts', info.mounted);
        ok(g.id + ': clock renders mm:ss', /^\d+:\d\d$/.test(info.clock || ''), info.clock);
        ok(g.id + ': run can finish', info.hasFinish);
        ok(g.id + ': no page errors on load', errors.length === 0, errors.slice(0, 2).join(' | '));
      } catch (e) {
        ok(g.id + ': page loads', false, e.message);
      } finally {
        await page.close();
      }
    }
  });
  console.log(failures ? '\nSTORY RUN ARCADE FAILURES (' + failures + ')' : '\nALL STORY RUN ARCADE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
