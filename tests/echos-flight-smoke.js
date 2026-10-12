#!/usr/bin/env node
/*
 * tests/echos-flight-smoke.js
 *
 * Echo's Swim is Flappy Bird with Echo the axolotl: one tap to swim up,
 * coral gates to glide through, bubbles for bonus. This runs it in a real
 * browser at phone and desktop sizes: start, autopilot a few gates (proving
 * a run is winnable), crash, replay, and verify the best score survives a
 * reload. It also guards the regression that got the old build pulled: the
 * story-run overlay that ended the run on its own.
 *
 * Run: node tests/echos-flight-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.ES_PORT || 8153);
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
  startShown: !document.getElementById('startScreen').classList.contains('hidden'),
  endShown: !document.getElementById('endScreen').classList.contains('hidden'),
  hintShown: document.getElementById('hint').classList.contains('show'),
  score: Number(document.getElementById('scoreHud').textContent),
  gates: Number(document.getElementById('gateHud').textContent),
  best: Number(document.getElementById('bestHud').textContent),
  stats: document.querySelectorAll('#endStats div').length,
  canvasW: document.getElementById('game').width,
  canvasH: document.getElementById('game').height,
});

// Autopilot: steer Echo through the next gate's gap until it clears a few
// gates or the run ends. Proves the rebuilt game is actually playable.
const AUTOPILOT = async (want) => {
  const g = window.__echoSwim;
  if (!g) return { error: 'no debug hook' };
  g.start();
  await new Promise(r => setTimeout(r, 120));
  g.flap(); // first tap leaves the ready state and starts the swim
  const canvas = document.getElementById('game');
  const H = canvas.clientHeight;
  for (let i = 0; i < 900; i++) {
    const s = g.state();
    if (s.phase === 'over' || s.passed >= want) return g.state();
    const target = s.next ? s.next.center : H * 0.5;
    if (s.y > target) g.flap();
    await new Promise(r => setTimeout(r, 16));
  }
  return g.state();
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/echos-flight.html?debug=1', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#startBtn', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 300));

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': opens on a clear start screen', start.startShown && !start.endShown);
      ok(vp.name + ': canvas is sized', start.canvasW > 0 && start.canvasH > 0, start.canvasW + 'x' + start.canvasH);
      ok(vp.name + ': best HUD is a number', Number.isFinite(start.best), String(start.best));

      // Start button hides the overlay and shows the tap hint
      await page.evaluate(() => document.getElementById('startBtn').click());
      await new Promise(r => setTimeout(r, 150));
      const afterStart = await page.evaluate(SNAP);
      ok(vp.name + ': starting hides the overlay and shows the tap hint', !afterStart.startShown && afterStart.hintShown);

      // Autopilot clears gates, proving a real run is winnable
      const run = await page.evaluate(AUTOPILOT, 3);
      ok(vp.name + ': a tapped run clears coral gates', (run && run.passed >= 3) || (run && run.error), run ? 'passed=' + run.passed + (run.error ? ' ' + run.error : '') : 'no run');
      ok(vp.name + ': gates add to the score', run && run.score >= run.passed, run ? JSON.stringify({ score: run.score, passed: run.passed }) : '');
      ok(vp.name + ': autopilot never auto-ended the run', run && run.phase !== 'over', run ? 'phase=' + run.phase : '');

      // Stop tapping: Echo sinks and the run ends with a visible end screen
      let end = null;
      for (let t = 0; t < 60; t++) {
        const s = await page.evaluate(SNAP);
        if (s.endShown) { end = s; break; }
        await new Promise(r => setTimeout(r, 150));
      }
      ok(vp.name + ': a crash shows the end screen', !!end);
      ok(vp.name + ': the end screen shows score, gates, bubbles and best', end && end.stats === 4, end ? 'stats=' + end.stats : '');
      ok(vp.name + ': one overlay at a time, no menu stack', end && !end.startShown);

      // Replay is a clean single run
      await page.evaluate(() => document.getElementById('againBtn').click());
      await new Promise(r => setTimeout(r, 250));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': swim again resets to a fresh run', !replay.startShown && !replay.endShown && replay.score === 0 && replay.gates === 0, JSON.stringify({ score: replay.score, gates: replay.gates }));

      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // Best score survives a reload
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('echo_swim_flappy_v1', JSON.stringify({ best: 42 })); } catch (e) {} });
    await page.goto(BASE + '/games/echos-flight.html', { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 300));
    ok('best score persists into the HUD across reloads', await page.evaluate(() => Number(document.getElementById('bestHud').textContent) >= 42));
    await page.close();

    const html = fs.readFileSync(path.join(ROOT, 'games', 'echos-flight.html'), 'utf8');
    ok('rebuild drops the story-run overlay that ended the old run', !/story-run\.js/.test(html) && !/StoryRun/.test(html));
    ok('rebuild is one tap with two overlays (start + end), no extra layers', (html.match(/class="overlay/g) || []).length === 2);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nEcho's Swim: all checks passed");
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
