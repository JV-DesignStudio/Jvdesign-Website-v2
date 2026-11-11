#!/usr/bin/env node
// tests/sound-studio-jam-challenge.js (A2943)
// Covers the timed challenge: constraints, countdown, result, export and exit.
// Run: node tests/sound-studio-jam-challenge.js
const { open, sleep } = require('./lib/sound-studio-harness');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const ctx = await open();
  const { page, errors } = ctx;
  try {
    const start = await page.evaluate(() => {
      _loadSoundTemplate('groove');
      startChallenge('space', 0.05);
      return {
        active: _challengeActive,
        steps,
        tracks: tracks.length,
        strip: document.getElementById('challenge-strip').hidden === false,
        style: CHALLENGE_THEMES.space.style,
        notes: grid.flat().filter((c) => c.on).length,
      };
    });
    check('starting a challenge applies one bar and three tracks',
      start.active && start.steps === 16 && start.tracks === 3 && start.strip && start.style === 'synthwave',
      JSON.stringify(start));
    check('the challenge theme has playable notes', start.notes > 0, String(start.notes));

    await sleep(3400);
    const done = await page.evaluate(() => ({
      active: _challengeActive,
      result: getComputedStyle(document.getElementById('challenge-result')).display !== 'none',
      text: document.getElementById('challengeResultText').textContent,
    }));
    check('the countdown finishes and shows the result card', done.result && /tracks/.test(done.text), JSON.stringify(done));

    const exp = await page.evaluate(async () => {
      let captured = null;
      const real = _downloadAudio;
      _downloadAudio = (blob) => { captured = blob; };
      try { await exportChallengeEntry(); } finally { _downloadAudio = real; }
      return captured ? captured.size : 0;
    });
    check('the result card can export a WAV', exp > 1000, String(exp));

    const keep = await page.evaluate(() => {
      exitChallengeKeep();
      return {
        active: _challengeActive,
        strip: document.getElementById('challenge-strip').hidden,
        result: getComputedStyle(document.getElementById('challenge-result')).display,
        tracks: tracks.length,
      };
    });
    check('leaving can keep the challenge track', keep.active === false && keep.strip === true && keep.result === 'none' && keep.tracks === 3, JSON.stringify(keep));

    const restore = await page.evaluate(() => {
      _loadSoundTemplate('groove');
      const sig = () => bpm + '|' + steps + '|' + tracks.length + '|' + grid.flat().filter((c) => c.on).length;
      const before = sig();
      startChallenge('spooky', 10);
      const during = { tracks: tracks.length, steps };
      exitChallenge(true);
      return { before, after: sig(), during };
    });
    check('leaving can restore the project exactly',
      restore.before === restore.after && restore.during.tracks === 3 && restore.during.steps === 16,
      JSON.stringify(restore));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO JAM CHALLENGE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
