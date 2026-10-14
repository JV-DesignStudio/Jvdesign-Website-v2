#!/usr/bin/env node
/*
 * tests/echo-casebook-smoke.js , A1456 (rewrites the A594 version)
 *
 * Echo's Casebook is a random-case deduction game behind a story-run intro:
 * press Open Casebook, read 4 clues, tap suspects to eliminate the innocent,
 * then Accuse the guilty one before 3 chances run out. The A594 test still
 * targeted the pre-A594 DOM (#task, #clues .cell, #energy, #level, #reset,
 * #feedback) and waited for suspects that only render after the intro, so it
 * timed out while the game was fine. This drives the current game: start
 * through the intro, reveal clues, eliminate, accuse correctly to open the
 * next case, then lose kindly on purpose and replay through the story modal.
 *
 * The test reads the answer key (window.__echoCasebook.answer) the way a
 * player reads the clues, but every action goes through the real UI: clue
 * taps, suspect taps and the Accuse button.
 *
 * Run: node tests/echo-casebook-smoke.js
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
  clues: document.querySelectorAll('.clue').length,
  revealed: document.querySelectorAll('.clue.revealed').length,
  suspects: document.querySelectorAll('.suspect').length,
  eliminated: document.querySelectorAll('.suspect.eliminated').length,
  score: (document.getElementById('scoreHud') || {}).textContent,
  caseNum: (document.getElementById('caseHud') || {}).textContent,
  streak: (document.getElementById('streakHud') || {}).textContent,
  lives: (function () { const t = ((document.querySelector('.case-card p') || {}).textContent || ''); const m = t.match(/❤️/g); return m ? m.length : 0; })(),
  feedback: ((document.getElementById('caseFeedback') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  feedbackHidden: (document.getElementById('caseFeedback') || { className: '' }).className.includes('hidden'),
  startHidden: (document.getElementById('startScreen') || { classList: { contains: () => true } }).classList.contains('hidden'),
  modal: !!document.querySelector('.sr-modal.show'),
  clock: (document.querySelector('[data-storyrun] .sr-time') || {}).textContent || '',
  scrolls: document.documentElement.scrollWidth > window.innerWidth + 1
});

const names = () => [...document.querySelectorAll('.suspect')].map((s) => s.querySelector('.name').textContent);
const clickSuspect = (name) => {
  const s = [...document.querySelectorAll('.suspect')].find((x) => x.querySelector('.name').textContent === name);
  if (s) s.click();
  return !!s;
};

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'games', 'echo-casebook.html'), 'utf8');
  ok('page loads the shared game system and run layer', /game-system\.js/.test(html) && /story-run\.js/.test(html));
  ok('no pre-A594 board left in the page', !/id="task"|id="level"|id="energy"|id="reset"|id="next"|id="clues"/.test(html));

  await withServer(async ({ base, browser }) => {
    const warm = await browser.newPage();
    await warm.goto(base + '/index.html', { waitUntil: 'load' });

    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      await warm.evaluate(() => localStorage.clear());
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(base + '/games/echo-casebook.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#playBtn', { timeout: 10000 });

      const menu = await page.evaluate(() => ({
        startVisible: !document.getElementById('startScreen').classList.contains('hidden'),
        boardUp: document.querySelectorAll('.suspect').length
      }));
      ok(vp.name + ': the casebook opens on its intro', menu.startVisible && menu.boardUp === 0);

      // Start through the story-run intro, the way a player does.
      await page.evaluate(() => document.getElementById('playBtn').click());
      await page.waitForSelector('.suspect', { timeout: 10000 });
      await sleep(400);

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': four clues and four suspects on the board', start.clues === 4 && start.suspects === 4, start.clues + '/' + start.suspects);
      ok(vp.name + ': the case starts with one clue open', start.revealed === 1, String(start.revealed));
      ok(vp.name + ': nothing eliminated yet', start.eliminated === 0);
      ok(vp.name + ': score and streak start at zero', start.score === '0' && start.streak === '0', start.score + '/' + start.streak);
      ok(vp.name + ': the counter reads case 1', start.caseNum === '1', start.caseNum);
      ok(vp.name + ': three chances are shown', start.lives === 3, String(start.lives));
      ok(vp.name + ': the story clock is running', /^\d+:\d\d$/.test(start.clock), start.clock);
      ok(vp.name + ': no sideways scrolling', !start.scrolls);

      // Reveal the hidden clues by tapping them.
      for (let k = 0; k < 4; k++) {
        await page.evaluate(() => { const c = document.querySelector('.clue.hidden'); if (c) c.click(); });
        await sleep(250);
      }
      const open = await page.evaluate(SNAP);
      ok(vp.name + ': tapping reveals every clue', open.revealed === 4, String(open.revealed));

      // Eliminate the three innocents, then accuse the guilty one.
      const answer = await page.evaluate(() => (window.__echoCasebook || {}).answer && window.__echoCasebook.answer());
      ok(vp.name + ': the answer key names a suspect on the board',
        await page.evaluate((a) => [...document.querySelectorAll('.suspect')].map((s) => s.querySelector('.name').textContent).includes(a), answer), String(answer));
      const others = (await page.evaluate(names)).filter((n) => n !== answer);
      for (const n of others) {
        const clicked = await page.evaluate(clickSuspect, n);
        if (!clicked) break;
        await sleep(250);
      }
      const lined = await page.evaluate(SNAP);
      ok(vp.name + ': tapping suspects crosses out the innocent', lined.eliminated === 3, String(lined.eliminated));

      await page.evaluate(() => document.querySelector('.btn-accuse').click());
      await sleep(250);
      const prompt = await page.evaluate(SNAP);
      ok(vp.name + ': Accuse asks for the culprit', /tap the suspect/i.test(prompt.feedback), prompt.feedback.slice(0, 60));
      await page.evaluate(clickSuspect, answer);
      await sleep(400);
      const solved = await page.evaluate(SNAP);
      ok(vp.name + ': the right accusation closes the case', /correct/i.test(solved.feedback), solved.feedback.slice(0, 70));
      ok(vp.name + ': the verdict names the culprit', new RegExp(answer, 'i').test(solved.feedback), solved.feedback.slice(0, 90));
      ok(vp.name + ': a score is banked', Number(solved.score) > 0, solved.score);
      await page.waitForFunction(() => (document.getElementById('caseHud') || {}).textContent === '2', { timeout: 8000 }).catch(() => {});
      const next = await page.evaluate(SNAP);
      ok(vp.name + ': closing a case opens case 2 clean', next.caseNum === '2' && next.eliminated === 0, next.caseNum + '/' + next.eliminated);

      // Lose kindly on the new case: three wrong accusations end the run.
      const answer2 = await page.evaluate(() => window.__echoCasebook.answer());
      const wrongs = (await page.evaluate(names)).filter((n) => n !== answer2);
      for (const n of wrongs.slice(0, 3)) {
        await page.evaluate(() => document.querySelector('.btn-accuse').click());
        await sleep(200);
        await page.evaluate(clickSuspect, n);
        await sleep(400);
      }
      const lost = await page.evaluate(SNAP);
      ok(vp.name + ': a wrong accusation says the suspect is innocent', /innocent|chances/i.test(lost.feedback), lost.feedback.slice(0, 70));
      await page.waitForSelector('.sr-modal.show .sr-again', { timeout: 8000 }).catch(() => {});
      const end = await page.evaluate(() => ({
        modal: !!document.querySelector('.sr-modal.show'),
        result: (document.querySelector('.sr-modal.show .sr-result') || {}).textContent || '',
        stats: [...document.querySelectorAll('.sr-modal.show .sr-stats b')].map((b) => b.textContent),
        guide: (document.querySelectorAll('.sr-modal.show .sr-stats b')[2] || {}).textContent || ''
      }));
      ok(vp.name + ': running out of chances ends the run kindly', end.modal, end.result.slice(0, 60));
      ok(vp.name + ': the ending is guided by Echo', end.guide === 'Echo', end.guide);

      // Replay through the story modal starts a fresh casebook.
      await page.evaluate(() => document.querySelector('.sr-modal.show .sr-again').click());
      await page.waitForSelector('.suspect', { timeout: 8000 }).catch(() => {});
      await sleep(400);
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': replay reopens case 1 with three chances',
        replay.caseNum === '1' && replay.score === '0' && replay.lives === 3 && replay.eliminated === 0 && !replay.modal,
        JSON.stringify({ c: replay.caseNum, s: replay.score, l: replay.lives }));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
    await warm.close();
  });

  console.log(failures ? `\n${failures} FAILED` : "\nEcho's Casebook: all checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
