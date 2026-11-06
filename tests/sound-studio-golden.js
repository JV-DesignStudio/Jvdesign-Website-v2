#!/usr/bin/env node
// tests/sound-studio-golden.js (A2108)
// The offline mixdown is seeded (A2108), so the same pattern must render the same
// audio every time. This stores a small canonical signature (peak + 16 RMS
// buckets) and fails if the sound changes, for example when a drum or FX
// constant is edited by hand.
//
// Capture a new signature after a reviewed sound change:
//   node tests/sound-studio-golden.js --print
// Then paste the printed object into EXPECTED below.
const { open } = require('./lib/sound-studio-harness');

// Canonical signature for the fixed pattern below (44100 Hz, stereo, 2s).
const EXPECTED = {
  channels: 2,
  sampleRate: 44100,
  length: 88200,
  peak: 1.003,
  rms: [0.225, 0.208, 0.394, 0.167, 0.269, 0.009, 0.392, 0.167, 0.33, 0.217, 0.369, 0.166, 0.281, 0.012, 0.388, 0.167]
};
const TOLERANCE = 0.002;

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

function closeEnough(a, b) {
  if (!a || !b) return false;
  if (a.channels !== b.channels || a.sampleRate !== b.sampleRate || a.length !== b.length) return false;
  if (Math.abs((a.peak || 0) - (b.peak || 0)) > TOLERANCE) return false;
  if (!Array.isArray(a.rms) || !Array.isArray(b.rms) || a.rms.length !== b.rms.length) return false;
  return a.rms.every((v, i) => Math.abs(v - b.rms[i]) <= TOLERANCE);
}

(async () => {
  const printOnly = process.argv.includes('--print');
  const ctx = await open();
  const { page, errors } = ctx;
  try {
    const res = await page.evaluate(async () => {
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      if (isPlaying) stopAll();
      songMode = false; document.body.classList.remove('song-mode');
      document.getElementById('loopsSelect').value = '1';
      bpm = 120; steps = 16; swing = 0; normalizeExport = false;
      setSteps(16); syncTransportUI();
      for (let ti = 0; ti < tracks.length; ti++) {
        for (let s = 0; s < steps; s++) grid[ti][s] = { on: false, note: 'C', len: 1, vel: 1, oct: tracks[ti].oct };
      }
      const hit = (ti, s, note, oct) => { grid[ti][s] = { on: true, note: note || 'C', len: 1, vel: 1, oct: oct == null ? tracks[ti].oct : oct }; };
      [0, 4, 8, 12].forEach((s) => hit(0, s));
      [4, 12].forEach((s) => hit(1, s));
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => hit(2, s));
      hit(3, 0, 'C', 2); hit(3, 8, 'G', 2);
      hit(4, 2, 'E', 4); hit(4, 6, 'G', 4); hit(4, 10, 'A', 4); hit(4, 14, 'C', 5);
      patterns[currentPattern].grid = grid;
      const one = await renderMixdown(true);
      const two = await renderMixdown(true);
      const s1 = audioSignature(one), s2 = audioSignature(two);
      return { s1, s2, h1: signatureHash(s1), h2: signatureHash(s2) };
    });

    if (printOnly) {
      console.log(JSON.stringify(res.s1, null, 2));
      await ctx.close();
      return;
    }

    check('two renders are byte-for-byte repeatable', JSON.stringify(res.s1) === JSON.stringify(res.s2) && res.h1 === res.h2, JSON.stringify({ h1: res.h1, h2: res.h2 }));
    check('render length matches a 1-loop 16-step bar', res.s1.length === EXPECTED.length && res.s1.sampleRate === EXPECTED.sampleRate && res.s1.channels === EXPECTED.channels, JSON.stringify({ len: res.s1.length, sr: res.s1.sampleRate }));
    check('canonical signature is unchanged', closeEnough(res.s1, EXPECTED), 'got ' + JSON.stringify(res.s1) + ' hash ' + res.h1);
    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO GOLDEN RENDER CHECK PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
