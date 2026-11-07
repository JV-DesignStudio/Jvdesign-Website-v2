#!/usr/bin/env node
// tests/sound-studio-engine.js (A2759)
// Covers the engine-layer upgrades:
//   1. the echo follows BPM,
//   2. bitcrush/distortion curves and drum noise buffers are cached,
//   3. a full voice pool steals the oldest melodic voice instead of dropping
//      the incoming drum,
//   4. the per-track Tone filter maps to a lowpass,
//   5. the master bus fades in and out,
//   6. the OGG button is labelled as real-time capture.
// Run: node tests/sound-studio-engine.js
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
    const echo = await page.evaluate(async () => {
      bpm = 120; const at120 = _echoSeconds();
      bpm = 60; const at60 = _echoSeconds();
      bpm = 200; const at200 = _echoSeconds();
      bpm = 120;
      getLiveBuses(getCtx());
      const live120 = liveBuses && liveBuses.delayNode ? liveBuses.delayNode.delayTime.value : null;
      setBPM(60);
      await new Promise((r) => setTimeout(r, 500));
      const live60 = liveBuses && liveBuses.delayNode ? liveBuses.delayNode.delayTime.value : null;
      setBPM(120);
      return { at120, at60, at200, live120, live60 };
    });
    check('echo time follows the tempo', Math.abs(echo.at120 - 0.375) < 0.001 && Math.abs(echo.at60 - 0.75) < 0.001 && Math.abs(echo.at200 - 0.225) < 0.001, JSON.stringify(echo));
    check('live delay bus is updated when BPM changes', echo.live120 !== null && Math.abs(echo.live60 - 0.75) < 0.05, JSON.stringify(echo));

    const cache = await page.evaluate(() => {
      const ac = getCtx();
      return {
        bit: _bitcrushCurve(ac) === _bitcrushCurve(ac),
        dist: _distortCurve(ac) === _distortCurve(ac),
        noise: _noiseBuffer(ac, 0.05) === _noiseBuffer(ac, 0.05),
        noiseDifferentSize: _noiseBuffer(ac, 0.05) !== _noiseBuffer(ac, 0.08)
      };
    });
    check('bitcrush/distortion curves are cached per context', cache.bit && cache.dist, JSON.stringify(cache));
    check('drum noise buffers are cached and separated by length', cache.noise && cache.noiseDifferentSize, JSON.stringify(cache));

    const steal = await page.evaluate(() => {
      if (isPlaying) stopAll();
      activeVoices = []; liveVoices = 0;
      const start = getCtx().currentTime + 0.02;
      for (let i = 0; i < MAX_VOICES; i++) playNote(4, start + i * 0.0001, 1.5, 0);
      const before = liveVoices;
      const melodicBefore = activeVoices.filter((v) => v.drum === 'none').length;
      playNote(0, start + 0.01, 0.2, 0);
      const after = liveVoices;
      const drums = activeVoices.filter((v) => v.drum !== 'none').length;
      const melodicAfter = activeVoices.filter((v) => v.drum === 'none').length;
      resetAudio();
      return { max: MAX_VOICES, before, after, drums, melodicBefore, melodicAfter, afterReset: liveVoices };
    });
    check('voice pool stays capped when a drum needs room', steal.before === steal.max && steal.after === steal.max, JSON.stringify(steal));
    check('the oldest melodic voice is stolen for the drum', steal.drums >= 1 && steal.melodicAfter === steal.melodicBefore - 1, JSON.stringify(steal));
    check('reset clears the active voice list', steal.afterReset === 0, JSON.stringify(steal));

    const tone = await page.evaluate(() => {
      const hz = [_toneHz(0), _toneHz(50), _toneHz(100)];
      selectTrack(3);
      setTone(30);
      return { hz, value: tracks[3].tone, label: document.getElementById('toneVal').textContent };
    });
    check('Tone maps 0 to muffled and 100 to bright', tone.hz[0] === 200 && tone.hz[1] === 2000 && tone.hz[2] === 20000, JSON.stringify(tone));
    check('Tone slider writes the track and the label', tone.value === 30 && /Soft|Muffled/.test(tone.label), JSON.stringify(tone));

    const fade = await page.evaluate(async () => {
      getCtx();
      fadeMaster(0, 0.02);
      await new Promise((r) => setTimeout(r, 90));
      const low = masterFade.gain.value;
      fadeMaster(1, 0.02);
      await new Promise((r) => setTimeout(r, 90));
      const high = masterFade.gain.value;
      return { low, high };
    });
    check('master bus fades down and back up', fade.low < 0.15 && fade.high > 0.85, JSON.stringify(fade));

    const clip = await page.evaluate(() => {
      const el = document.getElementById('clipWarn');
      return { exists: !!el, hidden: el ? el.hidden : null, fn: typeof updateClipWarn };
    });
    check('clip warning exists, starts hidden and has a checker', clip.exists && clip.hidden === true && clip.fn === 'function', JSON.stringify(clip));

    const ogg = await page.evaluate(() => {
      const btn = document.querySelector('[data-on="exportOGG"]');
      return { title: btn ? btn.getAttribute('title') || '' : '', text: btn ? btn.textContent : '', fn: typeof exportOGG };
    });
    check('OGG export is labelled as real-time capture', /real-time/i.test(ogg.title) === true && /real-time/i.test(ogg.text) === true && ogg.fn === 'function', JSON.stringify(ogg));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO ENGINE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
