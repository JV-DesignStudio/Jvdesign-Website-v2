#!/usr/bin/env node
/*
 * tests/stardust-ruins-smoke.js , A595
 *
 * Stardust Ruins is one ruin now. The page used to cycle three symbol
 * sequences behind a Level counter with a free "Next" skip, and it had no
 * ending at all: solve it and it just bumped the level. This drives the single
 * order to the relic, then the out-of-chances ending, then a replay.
 *
 * Run: node tests/stardust-ruins-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.SR_PORT || 8150);
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

const ORDER = ['🌙', '⭐', '🌊'];

const SNAP = () => ({
  ruin: (document.getElementById('level') || {}).textContent || '',
  brief: ((document.getElementById('brief') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  symbols: document.querySelectorAll('#ruins .cell').length,
  disabled: document.querySelectorAll('#ruins .cell[disabled]').length,
  score: (document.getElementById('score') || {}).textContent,
  energy: (document.getElementById('energy') || {}).textContent,
  feedback: ((document.getElementById('feedback') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  replayShown: !(document.getElementById('reset') || {}).hidden,
  nextBtn: !!document.getElementById('next'),
  scrolls: document.documentElement.scrollWidth > window.innerWidth + 1
});

const tap = async (page, sym) => {
  await page.evaluate(s => {
    const b = document.querySelector('#ruins .cell[data-s="' + s + '"]');
    if (b) b.click();
  }, sym);
  await new Promise(r => setTimeout(r, 220));
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const warm = await browser.newPage();
    await warm.goto(BASE + '/index.html', { waitUntil: 'load' });

    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      await warm.evaluate(() => localStorage.clear());
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/stardust-ruins.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#ruins .cell', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': five symbols on the wall', start.symbols === 5, String(start.symbols));
      ok(vp.name + ': the counter reads one ruin, not a level', start.ruin === '1/1', start.ruin);
      ok(vp.name + ': the clue sequence is shown', /Clue sequence/.test(start.brief), start.brief);
      ok(vp.name + ': there is no free next ruin button', !start.nextBtn);
      ok(vp.name + ': the replay button is hidden at the start', start.replayShown === false);
      ok(vp.name + ': three chances are shown', start.energy === '3', start.energy);
      ok(vp.name + ': no sideways scrolling', !start.scrolls);

      // a wrong tap costs a chance and resets the sequence
      await tap(page, '✨');
      const wrong = await page.evaluate(SNAP);
      ok(vp.name + ': a wrong tap costs a chance', wrong.energy === '2', wrong.energy);
      ok(vp.name + ': a wrong tap explains itself', /order/i.test(wrong.feedback), wrong.feedback.slice(0, 60));
      ok(vp.name + ': the sequence resets after a wrong tap', /Clue sequence: 🌙/.test(wrong.brief), wrong.brief);

      // walk the order: Moon, Star, Wave
      await tap(page, ORDER[0]);
      const one = await page.evaluate(SNAP);
      ok(vp.name + ': the first correct symbol ticks off', /Clue sequence: ✓ → ⭐/.test(one.brief), one.brief);
      await tap(page, ORDER[1]);
      await tap(page, ORDER[2]);
      const opened = await page.evaluate(SNAP);
      ok(vp.name + ': the order opens the relic chamber', /chamber opens|relic/i.test(opened.feedback), opened.feedback.slice(0, 70));
      ok(vp.name + ': the ending says you are out with the relic', /chamber opens/i.test(opened.feedback), opened.feedback.slice(0, 90));
      ok(vp.name + ': the wall locks once it is open', opened.disabled === 5, String(opened.disabled));
      ok(vp.name + ': a score is banked', Number(opened.score) > 0, opened.score);
      ok(vp.name + ': the counter reads out', /out/i.test(opened.ruin), opened.ruin);
      ok(vp.name + ': the replay path appears', opened.replayShown === true);

      // replay puts you back at the top of the stair
      await page.evaluate(() => document.getElementById('reset').click());
      await new Promise(r => setTimeout(r, 300));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': replay resets score, chances and the order',
         replay.score === '0' && replay.energy === '3' && replay.ruin === '1/1' && replay.disabled === 0 && !replay.replayShown,
         JSON.stringify({ score: replay.score, energy: replay.energy, ruin: replay.ruin }));

      // three wrong taps end it kindly, still naming the order
      for (const wrongSym of ['✨', '🏺', '✨']) {
        await tap(page, wrongSym);
        const st = await page.evaluate(SNAP);
        if (/trap door/i.test(st.feedback)) break;
      }
      const lost = await page.evaluate(SNAP);
      ok(vp.name + ': running out of chances ends the ruin kindly',
         /trap door/i.test(lost.feedback), lost.feedback.slice(0, 70));
      ok(vp.name + ': the kind ending still gives the order', /Moon, then Star, then Wave/i.test(lost.feedback), lost.feedback.slice(0, 90));
      ok(vp.name + ': the replay path appears after losing too', lost.replayShown === true);
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
    await warm.close();

    const html = fs.readFileSync(path.join(ROOT, 'games', 'stardust-ruins.html'), 'utf8');
    ok('no ruin ladder left in the page', !/puzzles\[|id="next"|level\+\+|const puzzles/.test(html));
    ok('the page promises one ruin', /one ruin/i.test(html));
    ok('the noindex decision is preserved', /noindex,follow/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nStardust Ruins: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
