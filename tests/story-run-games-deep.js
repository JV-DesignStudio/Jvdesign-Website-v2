#!/usr/bin/env node
/*
 * tests/story-run-games-deep.js , A585
 *
 * Deep pass for the shared StoryRun layer, one scenario per action game. The
 * fast smoke (tests/story-run-games.js) proves each page loads the layer and
 * mounts the HUD; this test plays each game's run all the way to its finish
 * screen and then replays it, which is the finish + restart contract every
 * arcade card promises (A584).
 *
 * For each game it drives the game's own StoryRun instance through begin, a
 * winning finish and a play-again click, and asserts:
 *   - the run begins and the HUD is live
 *   - finishing shows the finish/score modal with the game's one-line result,
 *     a score, a time and the guide
 *   - "Play again" hides the modal and restarts the run (clock back to cap)
 *   - the page throws no uncaught errors through the whole loop
 *
 * Run: node tests/story-run-games-deep.js
 *   ARCADE_QA_OUT=<dir> writes depth-results.json for the audit pipeline.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SRG_PORT || 8247);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };

// The fifteen A585 action games: registry id + the guide the card promises.
const GAMES = [
  { file: 'beat-builder-battle.html', id: 'beat-builder-battle', character: 'Pip' },
  { file: 'neon-tiles.html', id: 'neon-tiles', character: 'Echo' },
  { file: 'paper-toss-deluxe.html', id: 'paper-toss', character: 'Pip' },
  { file: 'echos-flight.html', id: 'echo-flight', character: 'Echo' },
  { file: 'dough-dash.html', id: 'dough-dash', character: 'Ember' },
  { file: 'lumo_firefly_night.html', id: 'lumo-firefly', character: 'Lumo' },
  { file: 'voidrush.html', id: 'void-rush', character: 'Echo' },
  { file: 'crypt-crawlers.html', id: 'crypt-crawlers', character: 'Ember' },
  { file: 'tiger_smash.html', id: 'tiger-smash', character: 'Ember' },
  { file: 'little_steps.html', id: 'little-steps', character: 'Echo' },
  { file: 'critter-whack.html', id: 'critter-whack', character: 'Echo' },
  { file: 'lumo-dash.html', id: 'lumo-dash', character: 'Lumo' },
  { file: 'nibble-quest.html', id: 'nibble-quest', character: 'Pip' },
  { file: 'stack-attack.html', id: 'stack-attack', character: 'Ember' },
  { file: 'sky_high_with_friends.html', id: 'sky-high-friends', character: 'Echo' }
];

const results = [];
let failures = 0;

const server = http.createServer((req, res) => {
  let p;
  try { p = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0])); } catch { res.writeHead(400); return res.end(); }
  if (!p.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, b) => {
    res.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(e ? '' : b);
  });
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const g of GAMES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.setRequestInterception(true);
      page.on('request', r => (r.url().startsWith(BASE) || r.url().startsWith('data:')) ? r.continue() : r.abort());

      const check = async (name, fn) => {
        try { await fn(); results.push({ game: g.file, name, pass: true }); console.log('PASS ' + g.id + ' ' + name); }
        catch (e) { results.push({ game: g.file, name, pass: false, error: e.message }); console.log('FAIL ' + g.id + ' ' + name + ' ' + e.message); failures++; }
      };

      try {
        await page.goto(BASE + '/games/' + g.file, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluate(() => document.getElementById('cookie-decline')?.click());

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
              kicker: modal.querySelector('.sr-modal-kicker').textContent,
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

        await page.waitForTimeout?.(0);
        await check('no uncaught errors through the run', () => assert.deepEqual(errors, []));
      } catch (e) {
        await check('page loads and runs', () => { throw e; });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (process.env.ARCADE_QA_OUT) {
    fs.mkdirSync(process.env.ARCADE_QA_OUT, { recursive: true });
    fs.writeFileSync(path.join(process.env.ARCADE_QA_OUT, 'depth-results.json'), JSON.stringify(results, null, 2));
  }
  console.log(failures ? '\nSTORY RUN DEEP FAILURES (' + failures + ')' : '\nALL STORY RUN DEEP CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
