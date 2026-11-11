#!/usr/bin/env node
// tests/sound-studio-take-resample.js (A2718)
// Covers resampling recorded takes to the AudioContext rate so pitch is kept.
// Run: node tests/sound-studio-take-resample.js
const { open, sleep } = require('./lib/sound-studio-harness');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const ctx = await open({ width: 390, height: 844 });
  const { page, errors } = ctx;
  try {
    const resample = await page.evaluate(() => {
      const ac = getCtx();
      const src = ac.createBuffer(1, 48000, 48000);
      const d = src.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 440 * i / 48000);
      const out = _resampleBuffer(src, 44100);
      const o = out.getChannelData(0);
      let z = 0;
      for (let i = 1; i < o.length; i++) if ((o[i - 1] < 0) !== (o[i] < 0)) z++;
      return {
        sr: out.sampleRate,
        len: out.length,
        duration: out.duration,
        freq: z / (2 * out.duration),
        contextRate: ac.sampleRate,
      };
    });
    check('a 48 kHz take resamples to 44.1 kHz', resample.sr === 44100 && Math.abs(resample.len - 44100) <= 2, JSON.stringify(resample));
    check('resampling keeps the pitch', Math.abs(resample.freq - 440) < 22, JSON.stringify(resample));

    const stored = await page.evaluate(() => {
      const ac = getCtx();
      const n = 96000;
      const arr = new Float32Array(n);
      for (let i = 0; i < n; i++) arr[i] = Math.sin(2 * Math.PI * 220 * i / 96000) * 0.4;
      const rec = { id: 'unit-take', name: 'unit take', sampleRate: 96000, length: n, numberOfChannels: 1, channels: [arr.buffer], bytes: arr.byteLength };
      const buf = _recordToBuf(rec);
      return { sr: buf.sampleRate, len: buf.length, contextRate: ac.sampleRate };
    });
    check('stored takes are fitted to the current AudioContext', stored.sr === stored.contextRate && Math.abs(stored.len - stored.contextRate) <= 300, JSON.stringify(stored));

    const mobile = await page.evaluate(() => {
      setMode('sfx');
      const b = document.getElementById('recBtn');
      return { has: !!b, width: b ? b.getBoundingClientRect().width : 0 };
    });
    check('the record button is usable at 390px', mobile.has && mobile.width > 0, JSON.stringify(mobile));

    await page.setViewport({ width: 1440, height: 900 });
    await sleep(200);
    const desktop = await page.evaluate(() => {
      const b = document.getElementById('recBtn');
      return { has: !!b, width: b ? b.getBoundingClientRect().width : 0 };
    });
    check('the record button is usable at 1440px', desktop.has && desktop.width > 0, JSON.stringify(desktop));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO TAKE RESAMPLE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
