#!/usr/bin/env node
/*
 * tests/story-run-smoke.js , A585
 *
 * Unit smoke for the shared StoryRun layer itself: it mounts the run HUD with a
 * five-minute clock, fires a rising beat, then shows a finish/score screen with
 * the one-line story result and a replay button, all in a real browser. This is
 * the fast guard for the shared file; tests/story-run-games.js proves all
 * fifteen games load it.
 *
 * Run: node tests/story-run-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = 8199;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      const s1 = document.createElement('script'); s1.src = '/story-run.js'; document.head.appendChild(s1);
      const l1 = document.createElement('link'); l1.rel = 'stylesheet'; l1.href = '/story-run.css'; document.head.appendChild(l1);
    });
    await page.waitForFunction(() => !!window.StoryRun, { timeout: 8000 });

    const r = await page.evaluate(async () => {
      const run = new StoryRun({
        id: 'harness', title: 'Harness Run', character: 'Pip', cap: 2,
        open: 'Pip needs a beat.', objective: 'Finish the run.',
        beats: [{ at: 0, text: 'beat one' }, { at: 0.5, text: 'beat two' }],
        result: { success: 'Win line.', partial: 'Partial line.', fail: 'Fail line.' }
      });
      window.__run = run;
      run.begin();
      const mounted = !!document.querySelector('[data-storyrun="harness"]');
      const clockBefore = document.querySelector('.storyrun .sr-time').textContent;
      run.setScore(123);
      run.finish('success', 123);
      const modal = !!document.querySelector('.sr-modal.show');
      const result = (document.querySelector('.storyrun .sr-result') || {}).textContent || '';
      const scoreShown = (document.querySelector('.storyrun .sr-stats b') || {}).textContent || '';
      const again = !!document.querySelector('.storyrun .sr-again');
      return { mounted, clockBefore, modal, result, scoreShown, again };
    });
    ok('mounts HUD', r.mounted);
    ok('shows a clock', /^\d+:\d\d$/.test(r.clockBefore), r.clockBefore);
    ok('finish shows modal', r.modal);
    ok('finish shows one-line story result', r.result === 'Win line.', r.result);
    ok('finish shows score', r.scoreShown === '123', r.scoreShown);
    ok('finish offers replay', r.again);
    ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? '\nSTORY RUN SMOKE FAILURES: ' + failures : '\nSTORY RUN SMOKE PASSED');
  process.exit(failures ? 1 : 0);
})();
