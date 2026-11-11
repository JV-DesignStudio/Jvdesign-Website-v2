#!/usr/bin/env node
// tests/sound-studio-restyle.js (A2941)
// Covers one-click remix styles: notes stay identical, sound changes, undo works.
// Run: node tests/sound-studio-restyle.js
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
    const result = await page.evaluate(() => {
      _loadSoundTemplate('groove');
      const sig = () => tracks.map((t, ti) => grid[ti].map((c) => (c.on ? c.note + ':' + c.oct : '.')).join(''));
      const beforeNotes = sig();
      const beforeWaves = tracks.map((t) => t.wave);
      const beforeWave = tracks.map((t) => t.wave);

      applyRemixStyle('spooky');
      const spookyNotes = sig();
      const spookyWaves = tracks.map((t) => t.wave);
      const spookyBpm = bpm;
      undo();
      const undoneWaves = tracks.map((t) => t.wave);

      applyRemixStyle('chiptune');
      const chipWaves = tracks.map((t) => t.wave);
      const chipBpm = bpm;
      const chipFx = tracks.map((t) => !!t.fx.bitcrush);

      applyRemixStyle('lofi');
      const lofiBpm = bpm;
      const lofiSwing = swing;

      return {
        beforeNotes, spookyNotes, chipNotes: sig(), lofiNotes: sig(),
        beforeWaves, beforeWave, spookyWaves, undoneWaves, chipWaves,
        spookyBpm, chipBpm, lofiBpm, lofiSwing, chipFx,
      };
    });

    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check('all four styles keep the melody unchanged',
      same(result.beforeNotes, result.spookyNotes) && same(result.beforeNotes, result.chipNotes) && same(result.beforeNotes, result.lofiNotes),
      '');
    check('styles change the instrument sound (waveforms differ)',
      !same(result.beforeWaves, result.spookyWaves) && !same(result.spookyWaves, result.chipWaves),
      JSON.stringify({ before: result.beforeWaves, spooky: result.spookyWaves, chip: result.chipWaves }));
    check('undo restores the previous sound', same(result.beforeWave, result.undoneWaves), '');
    check('styles set their tempo and swing',
      result.spookyBpm === 80 && result.chipBpm === 150 && result.lofiBpm === 82 && Math.abs(result.lofiSwing - 0.18) < 1e-9,
      JSON.stringify({ spookyBpm: result.spookyBpm, chipBpm: result.chipBpm, lofiBpm: result.lofiBpm, lofiSwing: result.lofiSwing }));
    check('chiptune turns on bitcrush', result.chipFx.some(Boolean), JSON.stringify(result.chipFx));

    const differs = await page.evaluate(async () => {
      _loadSoundTemplate('groove');
      const sig = (b) => {
        let e = 0; const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i += 17) e += d[i] * d[i];
        return e.toFixed(6);
      };
      applyRemixStyle('chiptune');
      const chip = sig(await renderMixdown(true));
      applyRemixStyle('lofi');
      const lofi = sig(await renderMixdown(true));
      return { chip, lofi };
    });
    check('style changes the rendered audio', differs.chip !== differs.lofi, JSON.stringify(differs));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO RESTYLE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
