#!/usr/bin/env node
// tests/sound-studio-jam.js (A2938)
// Covers jam mode: metronome, count-in, live record into the grid and MIDI input.
// Run: node tests/sound-studio-jam.js
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
    const met = await page.evaluate(() => {
      metronomeOn = false;
      _metroClicks = 0;
      toggleMetronome();
      metronomeTick(0, getCtx().currentTime);
      metronomeTick(4, getCtx().currentTime);
      return { on: metronomeOn, clicks: _metroClicks };
    });
    check('metronome toggles and clicks on the beat', met.on && met.clicks >= 2, JSON.stringify(met));

    const count = await page.evaluate(async () => {
      stopAll();
      await getCtx().resume();
      bpm = 200; syncTransportUI();
      countInOn = false; toggleCountIn();
      togglePlay();
      const active = countInActive;
      await new Promise((r) => setTimeout(r, 1500));
      const playing = isPlaying;
      stopAll();
      countInOn = false;
      return { active, playing };
    });
    check('count-in delays playback then starts', count.active === true && count.playing === true, JSON.stringify(count));

    const rec = await page.evaluate(async () => {
      stopAll();
      await getCtx().resume();
      countInOn = false;
      bpm = 120; syncTransportUI();
      _loadSoundTemplate('blank');
      selectTrack(4);
      recording = false;
      toggleJamRecord();
      await new Promise((r) => setTimeout(r, 450));
      const step = currentStep;
      recordAt(step, 'E', 5);
      const cell = grid[4][step];
      const was = recording;
      stopAll();
      return { was, step, on: !!cell.on, note: cell.note, oct: cell.oct, after: recording };
    });
    check('record writes the played note to the current step', rec.was && rec.on && rec.note === 'E' && rec.oct === 5, JSON.stringify(rec));
    check('stopping playback stops recording', rec.after === false, String(rec.after));

    const midi = await page.evaluate(() => {
      _loadSoundTemplate('blank');
      selectTrack(4);
      recording = true; isPlaying = true; currentStep = 0;
      handleMidiMessage({ data: [0x90, 76, 100] });
      const cell = grid[4][0];
      recording = false; isPlaying = false;
      return { on: !!cell.on, note: cell.note, oct: cell.oct, init: typeof initMidiInput };
    });
    check('MIDI input records a note and degrades cleanly', midi.on && midi.note === 'E' && midi.oct === 5 && midi.init === 'function', JSON.stringify(midi));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO JAM CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();

