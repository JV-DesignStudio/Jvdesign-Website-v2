#!/usr/bin/env node
// tests/sound-studio-library.js (A2940)
// Covers the tempo-matched loop library: 12 loops across 4 packs, key transposition,
// BPM following and project round trips.
// Run: node tests/sound-studio-library.js
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
    const catalog = await page.evaluate(() => {
      const ids = Object.keys(LOOP_LIBRARY);
      const packs = [];
      ids.forEach((id) => { if (packs.indexOf(LOOP_LIBRARY[id].pack) < 0) packs.push(LOOP_LIBRARY[id].pack); });
      return { ids, packs };
    });
    check('library has at least 12 loops in 4 packs', catalog.ids.length >= 12 && catalog.packs.length === 4, JSON.stringify(catalog));

    const loaded = await page.evaluate(() => {
      const out = {};
      Object.keys(LOOP_LIBRARY).forEach((id) => {
        _loadSoundTemplate('blank');
        applyLoop(id);
        out[id] = { notes: grid.flat().filter((c) => c.on).length, steps };
      });
      return out;
    });
    const empty = Object.keys(loaded).filter((id) => loaded[id].notes === 0);
    check('every loop loads playable notes', empty.length === 0, JSON.stringify(empty));

    const transposed = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      musicalKey = 'D'; musicalScale = 'major';
      applyLoop('chip-coin');
      const notes = grid[4].filter((c) => c.on).map((c) => c.note);
      const scale = scalePitchClasses();
      return { notes, scale, inScale: notes.every((n) => scale.indexOf(n) >= 0) };
    });
    check('loops transpose into the project key', transposed.inScale && transposed.notes.indexOf('D') >= 0, JSON.stringify(transposed));

    const lengths = await page.evaluate(async () => {
      _loadSoundTemplate('blank');
      musicalKey = 'C'; musicalScale = 'major';
      applyLoop('chip-run');
      bpm = 120; syncTransportUI();
      const slow = await renderMixdown(true);
      bpm = 240; syncTransportUI();
      const fast = await renderMixdown(true);
      return { slow: slow.length, fast: fast.length };
    });
    check('loops follow the tempo', lengths.fast < lengths.slow * 0.6, JSON.stringify(lengths));

    const roundTrip = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      applyLoop('spooky-pad');
      const sig = () => grid.map((row) => row.map((c) => (c.on ? c.note + ':' + c.oct : '.')).join('')).join('|');
      const before = sig();
      const data = JSON.parse(JSON.stringify(songData()));
      applySongData(data);
      return { same: sig() === before, notes: grid.flat().filter((c) => c.on).length };
    });
    check('loops survive project export and import', roundTrip.same && roundTrip.notes > 0, JSON.stringify(roundTrip));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO LOOP LIBRARY CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
