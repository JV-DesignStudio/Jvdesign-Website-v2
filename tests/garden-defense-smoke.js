#!/usr/bin/env node
/*
 * tests/garden-defense-smoke.js , A593
 *
 * Lumo's Garden Defense is five waves with a saved-garden ending. The page used
 * to promise ten waves and then Endless Mode.
 *
 * What this test can prove in a headless browser: the promise and the game
 * agree. Five waves, no endless anywhere, an honest session length, the Studio
 * Pick panel and wave intel intact, the start gate, the wave counter starting at
 * 1/5, an end screen with a Play Again and no endless button, and the source
 * level wave logic capped at five.
 *
 * What it cannot prove here: the wave loop itself. The canvas defence does not
 * advance under headless automation on this machine, and that is pre-existing,
 * not caused by this card: the committed page behaves the same way. Playing the
 * five waves through to the ending is still a manual check.
 *
 * Run: node tests/garden-defense-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.GD_PORT || 8146);
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };

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

const SNAP = () => ({
  wave: (document.getElementById('waveLbl') || {}).textContent || '',
  intel: ((document.getElementById('waveIntel') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  startHidden: document.getElementById('startScreen') ? document.getElementById('startScreen').classList.contains('hidden') : null,
  endHidden: document.getElementById('endScreen') ? document.getElementById('endScreen').classList.contains('hidden') : null,
  startBtn: !!document.getElementById('startBtn'),
  againBtn: !!document.getElementById('againBtn'),
  endlessBtn: !!document.getElementById('endlessBtn'),
  endTitle: !!document.getElementById('endTitle'),
  endStats: !!document.getElementById('endStats'),
  scrolls: document.documentElement.scrollWidth > window.innerWidth + 1
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/garden-defense.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#waveLbl', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': the run is five waves', /Wave 1 \/ 5/.test(start.wave), start.wave);
      ok(vp.name + ': the counter never shows a wave zero', !/\b0 \//.test(start.wave), start.wave);
      ok(vp.name + ': there is a Plant and Defend start gate', start.startBtn && start.startHidden === false);
      ok(vp.name + ': the end screen exists and starts hidden', start.endHidden === true && start.endTitle && start.endStats);
      ok(vp.name + ': there is no Endless Mode button', !start.endlessBtn);
      ok(vp.name + ': a Play Again button exists for the replay path', start.againBtn);
      ok(vp.name + ': wave intel is still shown', start.intel.length > 10, start.intel.slice(0, 60));
      ok(vp.name + ': no sideways scrolling', !start.scrolls);

      const copy = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
      ok(vp.name + ': the page never promises ten waves or endless',
         !/10 waves|wave 10|endless/i.test(copy), (copy.match(/[^.]{0,40}(10 waves|endless)[^.]{0,40}/i) || [''])[0]);
      ok(vp.name + ': the page states a 3-5 min session', /3-5 min/.test(copy));
      ok(vp.name + ': the Studio Pick panel survived', /Goal/.test(copy) && /Skill/.test(copy) && /Build next/.test(copy));

      // starting the run hides the gate, and the counter stays honest
      await page.evaluate(() => document.getElementById('startBtn').click());
      await new Promise(r => setTimeout(r, 500));
      const begun = await page.evaluate(SNAP);
      ok(vp.name + ': starting the run hides the start gate', begun.startHidden === true && begun.endHidden === true);
      ok(vp.name + ': the counter still reads wave 1 after starting', /Wave 1 \/ 5/.test(begun.wave), begun.wave);

      // replay returns to a fresh five-wave defence
      await page.evaluate(() => { const b = document.getElementById('againBtn'); if (b) b.click(); });
      await new Promise(r => setTimeout(r, 400));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': replay resets to wave 1 of 5', /Wave 1 \/ 5/.test(replay.wave), replay.wave);
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // the wave logic itself: five waves, no endless, single story ending
    const src = fs.readFileSync(path.join(ROOT, 'games', 'garden-defense.html'), 'utf8');
    ok('no endless mode left in the page', !/endless/i.test(src));
    ok('no ten wave promise left in the page', !/10 waves|wave 10|waveIdx>10|waveIdx===10/.test(src));
    ok('the run ends after wave five', /if\(waveIdx>5\)\{ win\(\); return; \}/.test(src));
    ok('the end screen counts to five', /const reachedWave=won\?5:Math\.min\(waveIdx,5\)/.test(src));
    ok('the wave five boss is the climax', /if\(waveIdx===5\) banner\('Wave 5/.test(src));
    ok('the wave label stops at five', /Math\.max\(1,Math\.min\(waveIdx,5\)\)/.test(src));
    ok('the wave intel stops at five', /const next=waveIdx>=5\?5:Math\.max\(1,waveIdx\+1\)/.test(src));
    ok('the debug snapshot no longer exposes endless', !/get endless\(\)/.test(src));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nGarden defense: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
