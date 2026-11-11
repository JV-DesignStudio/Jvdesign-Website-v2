#!/usr/bin/env node
// tests/sound-studio-layering.js (A2947)
// Covers the layer lab: blend two sounds, per-layer controls, save, undo, export and send.
// Run: node tests/sound-studio-layering.js
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
    const blend = await page.evaluate(async () => {
      _loadSoundTemplate('blank');
      const a = document.getElementById('layerA');
      const b = document.getElementById('layerB');
      const opts = Array.from(a.options).map((o) => o.value);
      a.value = opts.find((v) => /builtin:Coin/.test(v)) || opts[0];
      b.value = opts.find((v) => /builtin:Hit/.test(v)) || opts[1];
      document.getElementById('layerAVol').value = '0.8';
      document.getElementById('layerBVol').value = '0.6';
      document.getElementById('layerAPitch').value = '1';
      document.getElementById('layerBPitch').value = '1.5';
      const buf = await blendLayers();
      let peak = 0;
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
      return { len: buf.length, peak, channels: buf.numberOfChannels, last: !!sfxLastBuf, options: opts.length };
    });
    check('two built-in layers blend into one sound', blend.len > 1000 && blend.peak > 0 && blend.last && blend.channels === 1, JSON.stringify(blend));
    check('the layer selectors are populated', blend.options >= 8, String(blend.options));

    const controls = await page.evaluate(async () => {
      document.getElementById('layerAPitch').value = '2';
      document.getElementById('layerBPitch').value = '2';
      const fast = await blendLayers();
      document.getElementById('layerAPitch').value = '0.5';
      document.getElementById('layerBPitch').value = '0.5';
      const slow = await blendLayers();
      return { fast: fast.length, slow: slow.length };
    });
    check('per-layer pitch changes the blend', controls.slow > controls.fast, JSON.stringify(controls));

    const saved = await page.evaluate(() => {
      const before = mySamples.length;
      saveLayerSound();
      return { before, after: mySamples.length, name: mySamples[mySamples.length - 1].name };
    });
    check('the layer sound saves to My Sounds', saved.after === saved.before + 1 && /^Layer /.test(saved.name), JSON.stringify(saved));

    const undone = await page.evaluate(() => {
      undo();
      return mySamples.length;
    });
    check('undo removes the saved layer sound', undone === saved.before, String(undone));

    const out = await page.evaluate(async () => {
      await blendLayers();
      const wav = bufferToWav(sfxLastBuf).byteLength;
      sendSfxToGameMaker();
      return { wav, stored: !!localStorage.getItem('jvds_sfx_last') };
    });
    check('the blend exports as a WAV', out.wav > 44, String(out.wav));
    check('the blend sends to Game Maker', out.stored === true, String(out.stored));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO LAYERING CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
