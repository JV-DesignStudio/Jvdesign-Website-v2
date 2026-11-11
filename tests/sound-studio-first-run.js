#!/usr/bin/env node
// tests/sound-studio-first-run.js (A2939)
// Covers the guided 60-second first run: shows for a fresh profile, loads a cue,
// restyles it, exports a WAV, and does not return.
// Run: node tests/sound-studio-first-run.js
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
      localStorage.removeItem('jvds_sound_guided');
      _guidedActive = false;
      maybeShowGuided();
      const el = document.getElementById('guided-strip');
      return { visible: el ? el.hidden === false : false, step: document.getElementById('gsStep').textContent, text: document.getElementById('gsText').textContent };
    });
    check('guide appears for a fresh profile', start.visible && /Step 1/.test(start.step), JSON.stringify(start));

    const cue = await page.evaluate(async () => {
      await guidedNext();
      return { bpm, notes: grid.flat().filter((c) => c.on).length, step: document.getElementById('gsStep').textContent };
    });
    check('step 1 loads a game cue', cue.notes > 0 && cue.bpm === 100 && /Step 2/.test(cue.step), JSON.stringify(cue));

    const style = await page.evaluate(async () => {
      await guidedNext();
      return { bassWave: tracks[3].wave, chip: !!tracks[3].fx.bitcrush, step: document.getElementById('gsStep').textContent };
    });
    check('step 2 applies a style', style.bassWave === 'square' && style.chip && /Step 3/.test(style.step), JSON.stringify(style));

    const exported = await page.evaluate(async () => {
      let captured = null;
      const real = _downloadAudio;
      _downloadAudio = (blob, name) => { captured = { blob, name }; };
      try { await guidedNext(); } finally { _downloadAudio = real; }
      return {
        size: captured ? captured.blob.size : 0,
        hidden: document.getElementById('guided-strip').hidden,
        key: localStorage.getItem('jvds_sound_guided'),
      };
    });
    check('step 3 downloads a WAV and finishes', exported.size > 1000 && exported.hidden === true && exported.key === '1', JSON.stringify(exported));

    const again = await page.evaluate(() => {
      _guidedActive = false;
      maybeShowGuided();
      return document.getElementById('guided-strip').hidden;
    });
    check('guide does not return for a returning user', again === true, String(again));

    const simple = await page.evaluate(() => ({
      level: document.body.classList.contains('level-beginner'),
      fx: getComputedStyle(document.querySelector('.ipseg-fx')).display,
    }));
    check('beginner mode still hides FX and sends', simple.level && simple.fx === 'none', JSON.stringify(simple));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO FIRST RUN CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
