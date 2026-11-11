#!/usr/bin/env node
// tests/sound-studio-mix-doctor.js (A2946)
// Covers Echo's mix check: crowd, clipping, loud/quiet tracks and a cut loop tail.
// Run: node tests/sound-studio-mix-doctor.js
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
    const flagged = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      for (let ti = 0; ti < 5; ti++) grid[ti][0] = { on: true, note: 'C', len: 1, vel: 1, oct: tracks[ti].oct };
      tracks[0].vol = 1.0;
      tracks[4].vol = 0.1;
      tracks[1]['env'].release = 2;
      grid[1][steps - 1] = { on: true, note: 'C', len: 1, vel: 1, oct: 3 };
      const ids = diagnoseMix().map((i) => i.id);
      openMixDoctor();
      return {
        ids,
        rows: document.querySelectorAll('#mixList .mix-item').length,
        quietBefore: tracks[4].vol,
        loudBefore: tracks[0].vol,
        releaseBefore: tracks[1]['env'].release,
      };
    });
    check('flags a crowded step', flagged.ids.includes('crowd'), JSON.stringify(flagged.ids));
    check('flags a loud track', flagged.ids.includes('loud'), JSON.stringify(flagged.ids));
    check('flags a quiet track', flagged.ids.includes('quiet'), JSON.stringify(flagged.ids));
    check('flags a cut loop tail', flagged.ids.includes('tail'), JSON.stringify(flagged.ids));
    check('mix doctor renders a row per issue', flagged.rows === flagged.ids.length && flagged.rows >= 4, JSON.stringify({ rows: flagged.rows, ids: flagged.ids }));

    const fixed = await page.evaluate(() => {
      _fixMix('quiet');
      const quietAfter = tracks[4].vol;
      _fixMix('loud');
      const loudAfter = tracks[0].vol;
      _fixMix('crowd');
      let busiest = 0;
      for (let s = 0; s < steps; s++) {
        let n = 0;
        tracks.forEach((t, ti) => { if (grid[ti][s] && grid[ti][s].on) n++; });
        busiest = Math.max(busiest, n);
      }
      _fixMix('tail');
      const releaseAfter = tracks[1]['env'].release;
      const stepSec = (60 / bpm) / 4;
      return { quietAfter, loudAfter, busiest, releaseAfter, stepSec };
    });
    check('quiet fix raises the quiet track', fixed.quietAfter > 0.25, String(fixed.quietAfter));
    check('loud fix lowers the loud track', fixed.loudAfter < 0.95, String(fixed.loudAfter));
    check('crowd fix leaves at most three sounds on a step', fixed.busiest <= 3, String(fixed.busiest));
    check('tail fix shortens the release to fit the loop', fixed.releaseAfter <= fixed.stepSec * 0.85 + 1e-9, JSON.stringify(fixed));

    const okCase = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      const ids = diagnoseMix().map((i) => i.id);
      return ids;
    });
    check('a clean project reports ok instead of inventing problems', okCase.length === 1 && okCase[0] === 'ok', JSON.stringify(okCase));

    const fixAll = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      for (let ti = 0; ti < 5; ti++) grid[ti][0] = { on: true, note: 'C', len: 1, vel: 1, oct: tracks[ti].oct };
      tracks[0].vol = 1.0; tracks[4].vol = 0.1;
      fixAllMix();
      let busiest = 0;
      for (let s = 0; s < steps; s++) {
        let n = 0;
        tracks.forEach((t, ti) => { if (grid[ti][s] && grid[ti][s].on) n++; });
        busiest = Math.max(busiest, n);
      }
      return { busiest, loud: tracks[0].vol, quiet: tracks[4].vol };
    });
    check('fix all balances the whole mix', fixAll.busiest <= 3 && fixAll.loud < 0.95 && fixAll.quiet > 0.25, JSON.stringify(fixAll));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO MIX DOCTOR CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
