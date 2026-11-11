#!/usr/bin/env node
// tests/sound-studio-timeline.js (A2935)
// Covers bar lengths, loop readout, render length and moveable song sections.
// Run: node tests/sound-studio-timeline.js
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
    const sizes = await page.evaluate(() => {
      const out = {};
      [1, 2, 4, 8].forEach((n) => { setBars(n); out[n] = { steps, sel: document.getElementById('barsSel').value }; });
      return out;
    });
    check('1/2/4/8 bars set the right step counts',
      sizes[1].steps === 16 && sizes[2].steps === 32 && sizes[4].steps === 64 && sizes[8].steps === 128,
      JSON.stringify(sizes));
    check('the bars control stays in sync', sizes[4].sel === '4' && sizes[8].sel === '8', JSON.stringify(sizes));

    const readout = await page.evaluate(() => {
      setBars(4);
      document.getElementById('loopsSelect').value = '2';
      setLoopCount();
      return document.getElementById('loopBarsReadout').textContent;
    });
    check('loop readout counts bars and repeats', /8 bars/.test(readout), readout);

    const render = await page.evaluate(async () => {
      setBars(2);
      songMode = false;
      document.getElementById('loopsSelect').value = '1';
      const b = await renderMixdown(true);
      return { len: b.length, sr: b.sampleRate, expected: Math.round(steps * (60 / bpm) / 4 * b.sampleRate), steps };
    });
    check('export length matches the visible bars', Math.abs(render.len - render.expected) <= 2, JSON.stringify(render));

    const persist = await page.evaluate(() => {
      setBars(2);
      const mk = () => tracks.map((t) => Array.from({ length: steps }, () => ({ on: false, note: 'C', len: 1, vel: 1, oct: t.oct })));
      patterns = [{ name: 'A', grid: mk() }, { name: 'B', grid: mk() }];
      currentPattern = 1; grid = patterns[1].grid;
      song = [{ p: 0, rep: 1 }, { p: 1, rep: 2 }];
      songMode = true;
      moveSongSection(0, 1);
      const order = song.map((s) => s.p + ':' + s.rep);
      const data = JSON.parse(JSON.stringify(songData()));
      applySongData(data);
      return { order, after: song.map((s) => s.p + ':' + s.rep), steps };
    });
    check('reordering and repeats survive save and load',
      persist.order.join('|') === '1:2|0:1' && persist.after.join('|') === persist.order.join('|') && persist.steps === 32,
      JSON.stringify(persist));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO TIMELINE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
