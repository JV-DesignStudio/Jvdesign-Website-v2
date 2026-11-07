#!/usr/bin/env node
// tests/sound-studio-kid-mode.js (A2757)
// Checks the kid-first music helpers in Audio Studio:
//   1. the helper bar exists and the default view is Beginner,
//   2. In tune snaps notes to the chosen key and melody squares cycle
//      off -> root -> third -> fifth -> off,
//   3. Surprise me builds a playable loop,
//   4. feels set tempo and mood, stamps fill/clear a track,
//   5. friendly sound presets change the instrument,
//   6. Advanced shows the panels that Beginner hides.
// Run: node tests/sound-studio-kid-mode.js
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
    const bar = await page.evaluate(() => ({
      hasBar: !!document.getElementById('kid-bar'),
      hasSurprise: !!document.getElementById('surpriseBtn'),
      hasKey: !!document.getElementById('keySel'),
      hasScale: !!document.getElementById('scaleSel'),
      hasLock: !!document.getElementById('lockBtn'),
      hasView: !!document.getElementById('viewBtn'),
      level: document.body.className,
      lockOn: scaleLock,
      key: musicalKey,
      scale: musicalScale
    }));
    check('kid helper bar renders', bar.hasBar && bar.hasSurprise && bar.hasKey && bar.hasScale && bar.hasLock && bar.hasView, JSON.stringify(bar));
    check('default view is Beginner and In tune is on', /\blevel-beginner\b/.test(bar.level) && bar.lockOn === true && bar.key === 'C' && bar.scale === 'major', JSON.stringify(bar));

    const scale = await page.evaluate(() => {
      setKey('D');
      const snapped = snapToScale('C');
      const pcs = scalePitchClasses();
      return { snapped, inScale: noteInScale(snapped), pcs };
    });
    check('In tune snaps an out-of-key note into the new key', scale.inScale && scale.pcs.length === 7, JSON.stringify(scale));

    const cycle = await page.evaluate(() => {
      setKey('C');
      if (musicalScale !== 'major') setScale('major');
      if (!scaleLock) toggleScaleLock();
      selectTrack(4);
      _clearRow(4);
      buildGrid();
      const ti = 4;
      const cell = document.querySelector('.step-cell[data-track="' + ti + '"][data-step="0"]');
      const seq = [];
      for (let i = 0; i < 4; i++) {
        toggleCell(ti, 0, cell, tracks[ti]);
        seq.push({ on: grid[ti][0].on, note: grid[ti][0].note });
      }
      return seq;
    });
    const notes = cycle.map((s) => s.note);
    check('tapping a melody square cycles off, root, third, fifth, off',
      cycle[0].on && notes[0] === 'C' && cycle[1].on && notes[1] === 'E' && cycle[2].on && notes[2] === 'G' && cycle[3].on === false,
      JSON.stringify(cycle));

    const surprise = await page.evaluate(() => {
      const real = togglePlay;
      togglePlay = function () {};
      surpriseSong();
      togglePlay = real;
      const rows = grid.map((row) => row.filter((c) => c.on).length);
      return { rows, bpm, steps, total: rows.reduce((a, b) => a + b, 0) };
    });
    check('Surprise me fills drums, bass and a melody', surprise.total >= 12 && surprise.rows[0] >= 2 && surprise.rows[3] >= 2 && surprise.rows[4] >= 2 && surprise.steps === 16, JSON.stringify(surprise));

    const feel = await page.evaluate(() => { setFeel('party'); return { bpm, steps, swing, cls: document.body.className }; });
    check('Party feel sets a dance tempo and a beat', feel.bpm === 128 && feel.steps === 16, JSON.stringify(feel));

    const stamps = await page.evaluate(() => {
      selectTrack(0);
      stampFill();
      const filled = grid[0].every((c) => c.on);
      stampClear();
      const cleared = grid[0].every((c) => !c.on);
      return { filled, cleared };
    });
    check('pattern stamps fill and clear the selected track', stamps.filled && stamps.cleared, JSON.stringify(stamps));

    const sound = await page.evaluate(() => {
      if (musicalScale !== 'major') setScale('major');
      selectTrack(4);
      applySoundPreset('robot');
      return { wave: tracks[4].wave, bitcrush: !!tracks[4].fx.bitcrush, label: (document.querySelector('.sound-preset-btn.on') || {}).textContent || '' };
    });
    check('friendly sound preset changes the instrument', sound.wave === 'sawtooth' && sound.bitcrush === true, JSON.stringify(sound));

    const views = await page.evaluate(() => {
      const env = document.querySelector('.ipseg-env');
      applyViewLevel('beginner');
      const hiddenInBeginner = getComputedStyle(env).display === 'none';
      applyViewLevel('advanced');
      const shownInAdvanced = getComputedStyle(env).display !== 'none';
      applyViewLevel('beginner');
      return { hiddenInBeginner, shownInAdvanced, cls: document.body.className };
    });
    check('Beginner hides advanced panels and Advanced brings them back', views.hiddenInBeginner && views.shownInAdvanced && /\blevel-beginner\b/.test(views.cls), JSON.stringify(views));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO KID MODE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
