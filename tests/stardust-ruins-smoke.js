#!/usr/bin/env node
/*
 * tests/stardust-ruins-smoke.js , A1456 (rewrites the A595 version)
 *
 * Stardust Ruins is a Simon-says memory game behind a story-run intro:
 * press Enter the Ruins, watch the symbols flash in sequence, then tap them
 * back in order. Each cleared ruin grows the next sequence; three wrong taps
 * seal the ruins kindly. The A595 test still targeted the pre-A595 DOM
 * (#ruins .cell, #level, #energy, #score, #feedback, #brief, #reset, #next)
 * and waited for a wall that only renders after the intro, so it timed out
 * while the game was fine. This drives the current game: start through the
 * intro, record the flashed sequence the way a player watches it, take a
 * wrong tap on purpose, solve a ruin for real, then lose kindly and replay
 * through the story modal.
 *
 * Run: node tests/stardust-ruins-smoke.js
 */
const fs = require('fs');
const path = require('path');
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : ''));
  if (!cond) failures++;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SNAP = () => ({
  syms: document.querySelectorAll('.sym').length,
  score: (document.getElementById('scoreHud') || {}).textContent,
  ruin: (document.getElementById('ruinHud') || {}).textContent,
  seqLen: (document.getElementById('seqHud') || {}).textContent,
  lives: (function () { const m = ((document.getElementById('livesDisplay') || {}).textContent || '').match(/❤️/g); return m ? m.length : 0; })(),
  ruinName: (document.getElementById('ruinName') || {}).textContent || '',
  seqText: (document.getElementById('seqDisplay') || {}).textContent || '',
  status: (document.getElementById('status') || {}).textContent || '',
  modal: !!document.querySelector('.sr-modal.show'),
  clock: (document.querySelector('[data-storyrun] .sr-time') || {}).textContent || '',
  scrolls: document.documentElement.scrollWidth > window.innerWidth + 1
});

// Watch the wall the way a player does: every flash is one sequence symbol.
// Only a newly added flash counts. When the player's turn starts the game
// unlocks the buttons (removing "locked"), and the last symbol can still be
// lit at that moment, which must not record twice, so oldValue is checked.
const RECORDER = `() => {
  window.__flashes = [];
  new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target;
      const was = m.oldValue || '';
      if (t.classList && t.classList.contains('flash') && was.indexOf('flash') < 0) {
        window.__flashes.push(Number(t.dataset.idx));
      }
    }
  }).observe(document.getElementById('symbolGrid'), { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
}`;
const readSeq = `() => window.__flashes.slice()`;
const WATCH = `() => /Watch the sequence/.test(document.getElementById('seqDisplay').textContent)`;
const TURN = `() => /Your turn/.test(document.getElementById('seqDisplay').textContent)`;

const tapSym = (idx) => {
  const b = document.querySelector('.sym[data-idx="' + idx + '"]');
  if (b) b.click();
  return !!b;
};

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'games', 'stardust-ruins.html'), 'utf8');
  ok('page loads the shared game system and run layer', /game-system\.js/.test(html) && /story-run\.js/.test(html));
  ok('the wall renders symbol buttons', /id="symbolGrid"/.test(html) && /id="playBtn"/.test(html));
  ok('no pre-A595 wall left in the page', !/id="(level|energy|reset|next|score|feedback|brief|ruins)"/.test(html) && !/#ruins\s*\.cell/.test(html));

  await withServer(async ({ base, browser }) => {
    const warm = await browser.newPage();
    await warm.goto(base + '/index.html', { waitUntil: 'load' });

    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      await warm.evaluate(() => localStorage.clear());
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(base + '/games/stardust-ruins.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#playBtn', { timeout: 10000 });

      const menu = await page.evaluate(() => ({
        startVisible: !document.getElementById('startScreen').classList.contains('hidden'),
        wallUp: document.querySelectorAll('.sym').length
      }));
      ok(vp.name + ': the ruins open on their intro', menu.startVisible && menu.wallUp === 0);

      // Start through the story-run intro, then watch the first showing.
      await page.evaluate(eval(RECORDER));
      await page.evaluate(() => document.getElementById('playBtn').click());
      await page.waitForSelector('.sym', { timeout: 10000 });
      await page.waitForFunction(eval(WATCH), { timeout: 20000 }).catch(() => {});
      await page.evaluate(() => { window.__flashes = []; });
      await page.waitForFunction(eval(TURN), { timeout: 20000 });

      const seq = await page.evaluate(eval(readSeq));
      const start = await page.evaluate(SNAP);
      ok(vp.name + ': six symbols on the wall', start.syms === 6, String(start.syms));
      ok(vp.name + ': the watch taught a three-symbol order', seq.length === 3, JSON.stringify(seq));
      ok(vp.name + ': the counter reads ruin 1', start.ruin === '1', start.ruin);
      ok(vp.name + ': the first ruin asks for three', start.seqLen === '3', start.seqLen);
      ok(vp.name + ': three chances are shown', start.lives === 3, String(start.lives));
      ok(vp.name + ': the story clock is running', /^\d+:\d\d$/.test(start.clock), start.clock);
      ok(vp.name + ': no sideways scrolling', !start.scrolls);

      // A wrong tap costs a chance and the order shows again.
      const n = start.syms;
      const wrongIdx = (seq[0] + 1) % n;
      await page.evaluate(tapSym, wrongIdx);
      await sleep(400);
      const wrong = await page.evaluate(SNAP);
      ok(vp.name + ': a wrong tap costs a chance', wrong.lives === 2, String(wrong.lives));
      ok(vp.name + ': a wrong tap explains itself', /wrong symbol/i.test(wrong.status), wrong.status.slice(0, 50));
      await page.waitForFunction(eval(WATCH), { timeout: 20000 }).catch(() => {});
      await page.evaluate(() => { window.__flashes = []; });
      await page.waitForFunction(eval(TURN), { timeout: 20000 });
      const seq2 = await page.evaluate(eval(readSeq));
      ok(vp.name + ': the order shows again after a wrong tap', seq2.length === 3, JSON.stringify(seq2));

      // Tap the order back exactly and the ruin clears.
      for (const idx of seq2) {
        await page.evaluate(tapSym, idx);
        await sleep(250);
      }
      await sleep(400);
      const opened = await page.evaluate(SNAP);
      ok(vp.name + ': the order clears the ruin', /cleared/i.test(opened.status), opened.status.slice(0, 50));
      ok(vp.name + ': a score is banked', Number(opened.score) > 0, opened.score);
      await page.waitForFunction(() => (document.getElementById('ruinHud') || {}).textContent === '2', { timeout: 10000 }).catch(() => {});
      const deeper = await page.evaluate(SNAP);
      ok(vp.name + ': clearing a ruin opens the next one', deeper.ruin === '2', deeper.ruin);

      // Spend the last two chances so the ruins seal kindly.
      for (let round = 0; round < 2; round++) {
        await page.waitForFunction(eval(WATCH), { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => { window.__flashes = []; });
        await page.waitForFunction(eval(TURN), { timeout: 20000 }).catch(() => {});
        const cur = await page.evaluate(eval(readSeq));
        const count = await page.evaluate(() => document.querySelectorAll('.sym').length);
        if (!cur.length) break;
        await page.evaluate(tapSym, (cur[0] + 1) % count);
        await sleep(500);
      }
      const spent = await page.evaluate(SNAP);
      ok(vp.name + ': the last chances are spent', spent.lives === 0, String(spent.lives));
      await page.waitForSelector('.sr-modal.show .sr-again', { timeout: 8000 }).catch(() => {});
      const end = await page.evaluate(() => ({
        modal: !!document.querySelector('.sr-modal.show'),
        result: (document.querySelector('.sr-modal.show .sr-result') || {}).textContent || '',
        guide: (document.querySelectorAll('.sr-modal.show .sr-stats b')[2] || {}).textContent || ''
      }));
      ok(vp.name + ': running out of chances seals the ruins kindly', end.modal, end.result.slice(0, 60));
      ok(vp.name + ': the ending is guided by Stardust', end.guide === 'Stardust', end.guide);

      // Replay through the story modal walks back into ruin 1.
      await page.evaluate(() => document.querySelector('.sr-modal.show .sr-again').click());
      await page.waitForSelector('.sym', { timeout: 10000 }).catch(() => {});
      await sleep(400);
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': replay restarts score, chances and the ruin',
        replay.score === '0' && replay.lives === 3 && replay.ruin === '1' && !replay.modal,
        JSON.stringify({ s: replay.score, l: replay.lives, r: replay.ruin }));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
    await warm.close();
  });

  console.log(failures ? `\n${failures} FAILED` : '\nStardust Ruins: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
