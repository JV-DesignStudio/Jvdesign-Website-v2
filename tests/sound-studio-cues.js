#!/usr/bin/env node
// tests/sound-studio-cues.js (A2937)
// Covers the game-cue starter templates and their welcome-modal buttons.
// Run: node tests/sound-studio-cues.js
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
    const buttons = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#start-modal [data-on="_loadSoundTemplate"]')).map((b) => b.getAttribute('data-on-arg')));
    check('welcome modal lists the five game cues',
      ['menu', 'boss', 'victory', 'coin', 'gameover'].every((n) => buttons.includes(n)),
      JSON.stringify(buttons));
    check('old song starters stay reachable',
      ['groove', 'fourfloor', 'lofi', 'blank'].every((n) => buttons.includes(n)),
      JSON.stringify(buttons));

    const cues = await page.evaluate(() => {
      const out = {};
      ['menu', 'boss', 'victory', 'coin', 'gameover'].forEach((name) => {
        _loadSoundTemplate(name);
        let notes = 0, bass = 0, melody = 0;
        for (let ti = 0; ti < tracks.length; ti++) {
          for (let s = 0; s < steps; s++) {
            if (!grid[ti][s].on) continue;
            notes++;
            if (/bass/i.test(tracks[ti].name)) bass++;
            if (/melody/i.test(tracks[ti].name)) melody++;
          }
        }
        out[name] = { bpm, steps, scale: musicalScale, notes, bass, melody };
      });
      return out;
    });
    ['menu', 'boss', 'victory', 'coin', 'gameover'].forEach((name) => {
      const c = cues[name];
      check(name + ' cue loads playable notes', c.notes > 0 && c.melody > 0, JSON.stringify(c));
    });
    check('boss cue is fast and minor', cues.boss.bpm === 152 && cues.boss.scale === 'minor', JSON.stringify(cues.boss));
    check('coin cue is a short 8 step sting', cues.coin.steps === 8, JSON.stringify(cues.coin));
    check('menu cue has a bass line', cues.menu.bass > 0, JSON.stringify(cues.menu));

    const energy = await page.evaluate(async () => {
      _loadSoundTemplate('menu');
      const b = await renderMixdown(true);
      let e = 0; const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i += 13) e += d[i] * d[i];
      return e;
    });
    check('a cue renders real audio', energy > 0.0005, String(energy));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO CUE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
