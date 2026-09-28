#!/usr/bin/env node
/*
 * tests/star-connect-smoke.js , A586
 *
 * PiP's Star Connect is one quest now: trace Orion before the sky goes dark,
 * see the Found ending, and trace it again. The 8-constellation ladder and the
 * cycling Next button are gone. This traces Orion in a real browser, taps a
 * wrong star to prove the gentle correction still works, and replays.
 *
 * Run: node tests/star-connect-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.SC_PORT || 8151);
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

// Orion star fractions from the page, in internal 820x620 space
const STARS = [[.45,.18],[.55,.18],[.51,.34],[.43,.40],[.51,.45],[.59,.40],[.40,.72],[.62,.72]];
const PATH = [0,2,1,2,3,4,5,2,4,6,4,7];

const SNAP = () => ({
  level: document.getElementById('level').textContent,
  target: document.getElementById('targetName').textContent,
  revealShown: document.getElementById('reveal').classList.contains('show'),
  revealName: document.getElementById('revealName').textContent,
  revealFact: document.getElementById('revealFact').textContent,
  nextLabel: document.getElementById('next').textContent,
  book: document.getElementById('book').textContent.replace(/\s+/g, ' ').trim(),
  score: document.getElementById('score').textContent,
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
      await page.goto(BASE + '/games/pip_star_connect.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#canvas', { timeout: 10000 });

      const tapStar = (n) => page.evaluate(([fx, fy]) => {
        const C = document.getElementById('canvas');
        const r = C.getBoundingClientRect();
        const x = r.left + fx * 820 / 820 * r.width;
        const y = r.top + fy * 620 / 620 * r.height;
        C.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
      }, STARS[n]);

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': one constellation on the board, not a ladder of 8', start.level === '1/1', start.level);
      ok(vp.name + ': the trace button offers a replay, not a next sky', /trace again/i.test(start.nextLabel), start.nextLabel);
      ok(vp.name + ': the page states a single-night quest', /before the sky goes dark/i.test(await page.evaluate(() => document.body.textContent)));

      // wrong star first: gentle correction, run survives
      await tapStar(7);
      await new Promise(r => setTimeout(r, 200));
      const corrected = await page.evaluate(SNAP);
      ok(vp.name + ': a wrong tap corrects without ending anything', !corrected.revealShown && corrected.level === '1/1');

      // trace Orion in order
      for (const n of PATH) {
        await tapStar(n);
        await new Promise(r => setTimeout(r, 120));
      }
      const won = await page.evaluate(SNAP);
      ok(vp.name + ': tracing Orion reveals the ending', won.revealShown, 'reveal shown=' + won.revealShown);
      ok(vp.name + ': the ending names Orion with a sky fact', won.revealName === 'Orion' && won.revealFact.length > 40, won.revealName);
      ok(vp.name + ': the counter reads Found, not another level', won.level === 'Found', won.level);
      ok(vp.name + ': a score was banked', Number(won.score) > 0, won.score);

      // replay is the same single quest again
      await page.evaluate(() => document.getElementById('next').click());
      await new Promise(r => setTimeout(r, 300));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': tracing again resets to the same single quest', !replay.revealShown && replay.level === '1/1', replay.level);
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    const html = fs.readFileSync(path.join(ROOT, 'games', 'pip_star_connect.html'), 'utf8');
    ok('no constellation ladder left in the page', !/Ursa Major|Cassiopeia|Cygnus|Scorpius|Taurus/.test(html));
    ok('no cycling next-constellation logic left', !/\(i\+1\)%data\.length/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nStar Connect run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
