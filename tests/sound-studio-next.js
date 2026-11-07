#!/usr/bin/env node
// tests/sound-studio-next.js (A2760)
// Covers the second engine/learner batch:
//   1. offline exports apply the live FX chain,
//   2. My Sounds can be used as a pitched instrument,
//   3. the loop nudge and beginner Undo exist,
//   4. stems export a zip with per-track WAVs and loop.json,
//   5. drum Tune changes the offline render,
//   6. announcements and render cancel work.
// Run: node tests/sound-studio-next.js
const { open, sleep } = require('./lib/sound-studio-harness');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const CLEAR = 'for(let ti=0;ti<tracks.length;ti++){for(let s=0;s<steps;s++)grid[ti][s]={on:false,note:"C",len:1,vel:1,oct:tracks[ti].oct};} patterns[currentPattern].grid=grid;';

(async () => {
  const ctx = await open();
  const { page, errors } = ctx;
  try {
    await page.evaluate(() => {
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      if (isPlaying) stopAll();
      document.getElementById('loopsSelect').value = '1';
    });

    const fx = await page.evaluate(async (clear) => {
      eval(clear);
      grid[4][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 4 };
      patterns[currentPattern].grid = grid;
      tracks[4].fx.bitcrush = false;
      const dry = audioSignature(await renderMixdown(true));
      tracks[4].fx.bitcrush = true;
      const crushed = audioSignature(await renderMixdown(true));
      tracks[4].fx.bitcrush = false;
      return { dry, crushed, same: JSON.stringify(dry) === JSON.stringify(crushed) };
    }, CLEAR);
    check('offline render applies bitcrush like live', fx.same === false, JSON.stringify({ dry: fx.dry.peak, crushed: fx.crushed.peak }));

    const sample = await page.evaluate(async (clear) => {
      eval(clear);
      const ac = getCtx();
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.4), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 440 * i / ac.sampleRate) * 0.5;
      mySamples.push({ id: 'test-sample', name: 'Test tone', buf, bytes: 1024 });
      renderMySamples();
      selectTrack(4);
      setSample('test-sample');
      const found = !!_findSample(tracks[4]);
      const opt = Array.from(document.getElementById('sampleSel').options).some((o) => o.value === 'test-sample');
      grid[4][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 4 };
      patterns[currentPattern].grid = grid;
      const b = await renderMixdown(true, { only: 4 });
      let energy = 0; const ch = b.getChannelData(0);
      for (let i = 0; i < ch.length; i += 11) energy += ch[i] * ch[i];
      tracks[4].sampleId = null; tracks[4].sampleName = null;
      mySamples.pop(); renderMySamples();
      return { found, opt, energy };
    }, CLEAR);
    check('My Sounds becomes a selectable instrument', sample.found && sample.opt, JSON.stringify(sample));
    check('a sample renders into the offline mix', sample.energy > 0.001, String(sample.energy));

    const drum = await page.evaluate(async (clear) => {
      eval(clear);
      grid[0][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 1 };
      patterns[currentPattern].grid = grid;
      tracks[0].tune = 0;
      const low = audioSignature(await renderMixdown(true));
      tracks[0].tune = 12;
      const high = audioSignature(await renderMixdown(true));
      tracks[0].tune = 0;
      return { same: JSON.stringify(low) === JSON.stringify(high) };
    }, CLEAR);
    check('drum Tune changes the offline render', drum.same === false, JSON.stringify(drum));

    const nudge = await page.evaluate(() => {
      applyViewLevel('beginner');
      _loopNudgeDone = false;
      const el = document.getElementById('loop-nudge');
      if (el) el.hidden = true;
      _loopCompleted();
      const shown = el ? el.hidden === false : false;
      const before = bpm;
      nudgeFaster();
      const delta = bpm - before;
      const hidden = el ? el.hidden === true : false;
      return { shown, delta, hidden, undo: !!document.getElementById('kidUndoBtn') };
    });
    check('the loop nudge appears and faster works', nudge.shown && nudge.delta === 10 && nudge.hidden, JSON.stringify(nudge));
    check('Beginner has an Undo button', nudge.undo === true, JSON.stringify(nudge));

    const stems = await page.evaluate(async (clear) => {
      eval(clear);
      grid[0][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 1 };
      grid[4][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 4 };
      patterns[currentPattern].grid = grid;
      let captured = null;
      const real = _downloadAudio;
      _downloadAudio = (blob, name) => { captured = { blob, name, size: blob.size }; };
      try { await exportStems(); } finally { _downloadAudio = real; }
      let text = '';
      if (captured) text = new TextDecoder().decode(await captured.blob.arrayBuffer());
      return { name: captured && captured.name, size: captured && captured.size, hasJson: /stems\/loop\.json/.test(text), hasWav: /\.wav/.test(text) };
    }, CLEAR);
    check('stems export one zip with WAVs and loop.json', !!stems.name && /_stems\.zip$/.test(stems.name) && stems.size > 1000 && stems.hasJson && stems.hasWav, JSON.stringify({ name: stems.name, size: stems.size, hasJson: stems.hasJson, hasWav: stems.hasWav }));

    const misc = await page.evaluate(async () => {
      announce('Hello test');
      const announced = (document.getElementById('jvds-announce') || {}).textContent || '';
      _renderCancelled = true;
      let msg = '';
      try { await renderMixdown(true); } catch (e) { msg = e.message; }
      return { announced, msg, flag: _renderCancelled, bar: !!document.getElementById('render-bar') };
    });
    check('announce writes to the live region', misc.announced === 'Hello test', JSON.stringify(misc.announced));
    check('cancel aborts a render and resets the flag', misc.msg === 'cancelled' && misc.flag === false && misc.bar === true, JSON.stringify(misc));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO NEXT CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
