#!/usr/bin/env node
/*
 * tests/story-run-arcade-deep.js , A718
 *
 * A585 gave the action games and A587 the cosy games the shared StoryRun layer.
 * A718 finishes the arcade: twelve more self-contained games now run as one
 * short story instead of a bare loop. Each one loads the shared layer, mounts the
 * run HUD (story bar + five-minute clock), and reports a run that finishes with
 * the game's own one-line result, a score, a time and the guide.
 *
 * This is the deep pass: for every game it drives the game's own StoryRun
 * instance through begin, a winning finish and a play-again click, and asserts
 * the run starts, the HUD is live, finishing shows the finish screen with the
 * result, score and guide, and play again restarts the run with no page errors.
 *
 * Run: node tests/story-run-arcade-deep.js
 *   ARCADE_QA_OUT=<dir> writes story-run-arcade-deep.json for the audit pipeline.
 */
const { withServer, writeResults } = require('./story-run-harness.cjs');
const assert = require('assert/strict');

// The twelve A718 arcade games: registry id + the guide the card promises.
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

const results = [];
let failures = 0;

(async () => {
  await withServer(async ({ base, browser }) => {
    for (const g of GAMES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.setRequestInterception(true);
      page.on('request', r => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());

      const check = async (name, fn) => {
        try { await fn(); results.push({ game: g.file, name, pass: true }); console.log('PASS ' + g.id + ' ' + name); }
        catch (e) { results.push({ game: g.file, name, pass: false, error: e.message }); console.log('FAIL ' + g.id + ' ' + name + ' ' + e.message); failures++; }
      };

      try {
        await page.goto(base + '/games/' + g.file, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluate(() => document.getElementById('cookie-decline')?.click());

        await check('loads the shared run layer', async () => {
          const info = await page.evaluate(() => {
            const r = window.__storyRun;
            return { has: !!r, id: r ? r.id : null, character: r ? r.character : null, cap: r ? r.cap : null };
          });
          assert.equal(info.has, true, 'no window.__storyRun');
          assert.equal(info.id, g.id, 'run id ' + info.id + ' != registry id ' + g.id);
          assert.equal(info.character, g.character, 'guide ' + info.character + ' != ' + g.character);
          assert.equal(info.cap, 300, 'cap ' + info.cap + ' != 300');
        });

        await check('starts the story run', async () => {
          await page.evaluate(() => { if (window.__storyRun && !window.__storyRun.running) window.__storyRun.begin(); });
          await page.waitForFunction(() => window.__storyRun && window.__storyRun.running, { timeout: 5000 });
        });

        await check('HUD is live while running', async () => {
          const live = await page.evaluate(() => {
            const r = window.__storyRun, el = document.querySelector('[data-storyrun] .sr-time');
            return !!(r.running && el && /^\d+:\d\d$/.test(el.textContent));
          });
          assert.equal(live, true, 'HUD clock not live');
        });

        await check('finish shows the result, score and guide', async () => {
          await page.evaluate(() => window.__storyRun.finish('success', 1234));
          await page.waitForSelector('.sr-modal.show .sr-again', { timeout: 4000 });
          const m = await page.evaluate(() => {
            const r = window.__storyRun;
            const modal = document.querySelector('.sr-modal.show');
            const stats = [...modal.querySelectorAll('.sr-stats b')].map(b => b.textContent);
            return {
              finished: r.finished,
              result: modal.querySelector('.sr-result').textContent.trim(),
              score: stats[0], time: stats[1], guide: stats[2],
              hasAgain: !!modal.querySelector('.sr-again')
            };
          });
          assert.equal(m.finished, true, 'run not marked finished');
          assert.ok(m.result.length > 20, 'result line missing: ' + JSON.stringify(m.result));
          assert.equal(m.score, '1234', 'score not shown: ' + m.score);
          assert.ok(/^\d+:\d\d$/.test(m.time), 'time not mm:ss: ' + m.time);
          assert.equal(m.guide, g.character, 'guide mismatch: ' + m.guide);
          assert.equal(m.hasAgain, true, 'no play-again button');
        });

        await check('play again restarts the run', async () => {
          await page.click('.sr-modal.show .sr-again');
          await page.waitForFunction(() => {
            const r = window.__storyRun;
            return r.running && !r.finished && !document.querySelector('.sr-modal.show');
          }, { timeout: 4000 }).catch(() => {});
          const s = await page.evaluate(() => {
            const r = window.__storyRun;
            const el = document.querySelector('[data-storyrun] .sr-time');
            return { running: r.running, finished: r.finished, elapsed: r.elapsed, modal: !!document.querySelector('.sr-modal.show'), clock: el ? el.textContent : null };
          });
          assert.equal(s.running, true, 'run not running after replay');
          assert.equal(s.finished, false, 'still marked finished after replay');
          assert.equal(s.modal, false, 'finish modal still visible after replay');
          assert.ok(s.elapsed < 1, 'clock did not reset: ' + s.elapsed);
        });

        await check('no uncaught errors through the run', () => assert.deepEqual(errors, []));
      } catch (e) {
        await check('page loads and runs', () => { throw e; });
      } finally {
        await page.close();
      }
    }
  });

  writeResults(process.env.ARCADE_QA_OUT, 'story-run-arcade-deep.json', results);
  console.log(failures ? '\nSTORY RUN ARCADE DEEP FAILURES (' + failures + ')' : '\nALL STORY RUN ARCADE DEEP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
