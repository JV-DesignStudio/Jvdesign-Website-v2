#!/usr/bin/env node
// tests/sound-studio-takes.js (A2110)
// Named takes must survive a reload, restore pattern count, track count and BPM
// exactly, and prune when the list grows. Run: node tests/sound-studio-takes.js
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
    const saved = await page.evaluate(() => {
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      bpm = 140; steps = 8; setSteps(8);
      while (patterns.length < 2) addPattern();
      const input = document.getElementById('takeName');
      input.value = 'Verse idea';
      const rec = saveTake();
      return { id: rec && rec.id, count: takeAll().length, name: takeAll()[0] && takeAll()[0].name, patterns: patterns.length, tracks: tracks.length };
    });
    check('saveTake stores a named take', saved.count === 1 && saved.name === 'Verse idea' && !!saved.id, JSON.stringify(saved));

    const restored = await page.evaluate((id) => {
      bpm = 90; steps = 16; setSteps(16);
      const ti = activeTrack;
      for (let s = 0; s < steps; s++) grid[ti][s] = { on: false, note: 'C', len: 1, vel: 1, oct: tracks[ti].oct };
      takeLoad(id);
      return { bpm, steps, tracks: tracks.length, patterns: patterns.length };
    }, saved.id);
    check('restore returns BPM, steps, tracks and patterns', restored.bpm === 140 && restored.steps === 8 && restored.tracks === saved.tracks && restored.patterns === saved.patterns, JSON.stringify(restored));

    await page.reload({ waitUntil: 'load' });
    await sleep(1300);
    await page.evaluate(() => {
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      openProject();
    });
    const afterReload = await page.evaluate(() => ({
      count: takeAll().length,
      name: takeAll()[0] && takeAll()[0].name,
      rows: document.querySelectorAll('#takeList .lib-row').length
    }));
    check('takes survive a reload and render in the project panel', afterReload.count === 1 && afterReload.name === 'Verse idea' && afterReload.rows === 1, JSON.stringify(afterReload));
    await page.evaluate(() => closeProject());

    const pruned = await page.evaluate(() => {
      for (let i = 0; i < 16; i++) {
        document.getElementById('takeName').value = 'Take ' + i;
        saveTake();
      }
      return { count: takeAll().length };
    });
    check('takes prune to the capped list', pruned.count <= 12 && pruned.count >= 1, JSON.stringify(pruned));

    const dupDel = await page.evaluate(() => {
      const first = takeAll()[0];
      takeDuplicate(first.id);
      const afterDup = takeAll().length;
      const copy = takeAll().find((t) => / copy$/.test(t.name));
      takeDelete(copy.id);
      return { afterDup, afterDel: takeAll().length };
    });
    check('duplicate and delete update the take list', dupDel.afterDup >= 2 && dupDel.afterDel === dupDel.afterDup - 1, JSON.stringify(dupDel));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO TAKES CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
