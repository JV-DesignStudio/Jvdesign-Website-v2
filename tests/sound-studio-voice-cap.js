#!/usr/bin/env node
// tests/sound-studio-voice-cap.js (A2758)
// Proves Audio Studio caps concurrent voices so a dense pattern cannot pile up
// oscillators, and that resetAudio clears the count.
// Run: node tests/sound-studio-voice-cap.js
const { open } = require('./lib/sound-studio-harness');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const ctx = await open();
  const { page, errors } = ctx;
  try {
    const res = await page.evaluate(() => {
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      if (isPlaying) stopAll();
      const start = getCtx().currentTime + 0.02;
      for (let i = 0; i < MAX_VOICES + 48; i++) playNote(4, start + i * 0.0001, 0.5, 0);
      const atCap = liveVoices;
      const tooMany = liveVoices > MAX_VOICES;
      resetAudio();
      return { max: MAX_VOICES, atCap, tooMany, afterReset: liveVoices };
    });
    check('MAX_VOICES is defined', Number.isFinite(res.max) && res.max > 0, JSON.stringify(res));
    check('extra voices stay at the cap (stolen, never exceeded)', res.atCap === res.max && res.tooMany === false, JSON.stringify(res));
    check('resetAudio clears the voice count', res.afterReset === 0, JSON.stringify(res));
    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO VOICE CAP CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
