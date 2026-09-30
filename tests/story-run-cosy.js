#!/usr/bin/env node
/*
 * tests/story-run-cosy.js , A587
 *
 * A585 made the fifteen action games run as real five-minute stories; A587 does
 * the same for the six cosy games. Four are playable shifts and rounds and get
 * the shared StoryRun layer: Creature Rescue Clinic, Pip's Bakery Rush, Star
 * Chef: Recipe Queue and Echo's Fruit Catch. The other two stay honest on their
 * cards: Biscuit Tin Clicker keeps its idle core but gains a light first-visit
 * "fill the tin" shift, and Cozy Creatures is a tabletop rulebook, so its card
 * describes reading the rules rather than a timed digital run.
 *
 * This smoke pass proves each of the five interactive pages loads the shared
 * StoryRun layer, mounts its run HUD (story bar + five-minute clock), reports
 * the right guide and a five-minute cap, and throws no page error. The deep
 * test (tests/story-run-cosy-deep.js) plays each run to its finish screen.
 *
 * Run: node tests/story-run-cosy.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.SRC_PORT || 8167);
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };

// the cosy games A587 reworks, with the guide each card promises
const GAMES = [
  { file: 'creature-rescue-clinic.html', id: 'creature-rescue-clinic', character: 'Pip' },
  { file: 'pips-bakery-empire.html', id: 'bakery-empire', character: 'Pip' },
  { file: 'star-chef.html', id: 'star-chef', character: 'Lumo' },
  { file: 'echo_fruit_catch.html', id: 'echo-fruit', character: 'Echo' },
  { file: 'cozy-biscuit-clicker.html', id: 'biscuit-clicker', character: 'Pip' }
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
        // Start the run: try the game's own control, then fall back to begin().
        await page.evaluate(() => {
          const sels = ['#startBtn', '#start', '#playBtn', '#play-btn', '#modalPrimary',
            '[data-start]', 'button.primary', '.sr-again', '.btn.primary'];
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && !el.disabled && el.offsetParent !== null) { el.click(); return; }
          }
          const btns = [...document.querySelectorAll('button')];
          const hit = btns.find(b => /start|play|go|begin/i.test(b.textContent || '') && b.offsetParent !== null);
          if (hit) hit.click();
        });
        await page.waitForFunction(() => {
          const r = window.__storyRun;
          return r && r.running && document.querySelector('[data-storyrun] .sr-bar');
        }, { timeout: 6000 }).catch(() => {});
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
  console.log(failures ? '\nSTORY RUN COSY FAILURES (' + failures + ')' : '\nALL STORY RUN COSY CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
