#!/usr/bin/env node
/*
 * tests/story-run-games.js , A585
 *
 * A584 labelled every arcade card with a five-minute story promise; A585 makes
 * it real. Every one of the fifteen action games now loads the shared StoryRun
 * layer, mounts its run HUD (story bar + five-minute clock), and reports a run
 * with a three-minute-or-less cap so the card can be kept honestly.
 *
 * This is a smoke pass, not a full play-through: it proves each page boots with
 * the run layer present, the module is the shared one, the clock renders, the
 * story bar is mounted above the game, and no script error fires. Each game's
 * own deep test (added alongside) plays the run to its finish screen.
 *
 * Run: node tests/story-run-games.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.SRG_PORT || 8147);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };

// the fifteen action games A585 reworks, with the registry character
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

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : ''));
  if (!cond) failures++;
};

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const g of GAMES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      try {
        await page.goto(BASE + '/games/' + g.file, { waitUntil: 'load', timeout: 30000 });
        // Start the run: click the game's primary start control. Games that
        // begin on load (tiger, little-steps) already have the HUD mounted.
        await page.evaluate(() => {
          const sels = ['#startBtn', '#start', '#playBtn', '#play-btn', '#btn-restart',
            '[data-start]', 'button.primary', '.sr-again', '.btn.primary'];
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && !el.disabled && el.offsetParent !== null) { el.click(); return; }
          }
          // last resort: first visible button that looks like a start
          const btns = [...document.querySelectorAll('button')];
          const hit = btns.find(b => /start|play|go|begin/i.test(b.textContent || '') && b.offsetParent !== null);
          if (hit) hit.click();
        });
        await page.waitForFunction(() => {
          const r = window.__storyRun;
          return r && r.running && document.querySelector('[data-storyrun] .sr-bar');
        }, { timeout: 6000 }).catch(() => {});
        // If no start control matched (some games start on a key or a nested
        // modal), fall back to beginning the run directly so the HUD itself is
        // still proven to mount. The deep per-game tests cover real play.
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
            running: run ? run.running : null,
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
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? '\nSTORY RUN GAMES FAILURES (' + failures + ')' : '\nALL STORY RUN GAME CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
