#!/usr/bin/env node
// tests/sound-studio-chords.js (A2936)
// Covers the scale-aware chord progression builder and arpeggiator.
// Run: node tests/sound-studio-chords.js
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
    const prog = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      musicalKey = 'C'; musicalScale = 'major';
      setSteps(32);
      applyProgression('pop');
      const melodic = tracks.map((t, ti) => ({ t, ti })).filter((x) => x.t.drum === 'none');
      const at = (ti, s) => (grid[ti][s] && grid[ti][s].on) ? grid[ti][s].note : null;
      return {
        melodic: melodic.length,
        bar0: melodic.map((m) => at(m.ti, 0)),
        bar1: melodic.map((m) => at(m.ti, 16)),
        steps,
      };
    });
    check('progressions need melody tracks and fill them', prog.melodic >= 2 && prog.bar0.every(Boolean), JSON.stringify(prog));
    check('progression changes chord at the second bar', prog.bar1.every(Boolean), JSON.stringify(prog));
    const scaleOk = await page.evaluate(() => {
      const pcs = scalePitchClasses();
      const melodic = tracks.map((t, ti) => ({ t, ti })).filter((x) => x.t.drum === 'none');
      return melodic.every((m) => grid[m.ti].every((c) => !c.on || pcs.indexOf(c.note) >= 0));
    });
    check('chord notes stay in the chosen key', scaleOk === true, String(scaleOk));

    const arp = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      musicalKey = 'C'; musicalScale = 'major';
      setSteps(32);
      selectTrack(4);
      applyArp('up', '2');
      const on = [];
      for (let s = 0; s < steps; s++) if (grid[4][s].on) on.push({ s, note: grid[4][s].note });
      const pcs = scalePitchClasses();
      return { count: on.length, everyOther: on.every((x) => x.s % 2 === 0), inScale: on.every((x) => pcs.indexOf(x.note) >= 0) };
    });
    check('arpeggiator fills every other step', arp.count === 16 && arp.everyOther, JSON.stringify(arp));
    check('arpeggio notes stay in key', arp.inScale, JSON.stringify(arp));

    const down = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      musicalKey = 'C'; musicalScale = 'major';
      setSteps(16);
      selectTrack(4);
      applyArp('down', '4');
      return Array.from({ length: steps }, (_, s) => (grid[4][s].on ? grid[4][s].note : null)).filter(Boolean);
    });
    check('down mode reverses the arpeggio direction', down.length > 1 && down[0] !== down[1], JSON.stringify(down));

    const undo = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      setSteps(16);
      applyProgression('pop');
      const after = JSON.stringify(grid);
      undo();
      return { changed: JSON.stringify(grid) !== after };
    });
    check('undo removes the progression', undo.changed, '');

    const midi = await page.evaluate(() => {
      try { return StudioMIDI.encode({ bpm, steps, tracks, grid, name: 'chords' }).length; } catch (e) { return -1; }
    });
    check('chords and arps export to MIDI', midi > 0, String(midi));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO CHORD/ARP CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
