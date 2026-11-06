#!/usr/bin/env node
// tests/sound-studio-lifecycle.js (A2069)
// Proves the audio engine can be rebuilt repeatedly without leaking nodes or
// throwing, that the WAV writer emits 16-bit PCM, and that all three modes
// render sound. Run: node tests/sound-studio-lifecycle.js
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
    const resets = await page.evaluate(async () => {
      const out = { ok: 0, contexts: [] };
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      for (let i = 0; i < 12; i++) {
        const before = ctx;
        playNote(0, getCtx().currentTime + 0.01, 0.1, 0);
        resetAudio();
        const after = getCtx();
        out.contexts.push(!!after && after !== before);
        if (after && after.state !== 'closed') out.ok++;
      }
      return out;
    });
    check('12 audio resets each rebuild a live context', resets.ok === 12 && resets.contexts.every(Boolean), JSON.stringify(resets));

    const wav = await page.evaluate(async () => {
      const off = new OfflineAudioContext(1, 2205, 44100);
      const o = off.createOscillator(); const g = off.createGain(); g.gain.value = 0.2;
      o.connect(g); g.connect(off.destination); o.start(0); o.stop(0.05);
      const buf = await off.startRendering();
      const bytes = new Uint8Array(bufferToWav(buf));
      const view = new DataView(bytes.buffer);
      return {
        riff: String.fromCharCode(...bytes.slice(0, 4)),
        wave: String.fromCharCode(...bytes.slice(8, 12)),
        pcm: view.getUint16(20, true),
        bits: view.getUint16(34, true),
        size: bytes.length
      };
    });
    check('WAV export is 16-bit PCM RIFF/WAVE', wav.riff === 'RIFF' && wav.wave === 'WAVE' && wav.pcm === 1 && wav.bits === 16 && wav.size > 44, JSON.stringify(wav));

    const modes = await page.evaluate(async () => {
      const out = {};
      const energy = (buf) => { const d = buf.getChannelData(0); let e = 0; for (let i = 0; i < d.length; i += 11) e += d[i] * d[i]; return e; };
      try { closeStart && closeStart(); } catch (e) {}
      document.querySelectorAll('.ss-overlay').forEach((o) => { o.style.display = 'none'; });
      songMode = false; document.body.classList.remove('song-mode');
      document.getElementById('loopsSelect').value = '1';
      setSteps(16);
      for (let ti = 0; ti < tracks.length; ti++) for (let s = 0; s < steps; s++) grid[ti][s] = { on: false, note: 'C', len: 1, vel: 1, oct: tracks[ti].oct };
      grid[0][0] = { on: true, note: 'C', len: 1, vel: 1, oct: tracks[0].oct };
      grid[4][0] = { on: true, note: 'C', len: 1, vel: 1, oct: tracks[4].oct };
      patterns[currentPattern].grid = grid;
      setMode('music'); out.music = energy(await renderMixdown(true));
      setMode('drums'); out.drums = energy(await renderMixdown(true));
      setMode('sfx'); out.sfxMode = document.body.className;
      out.sfxLab = document.querySelectorAll('#sfxBody .sfx-vbtn').length;
      setMode('music');
      return out;
    });
    check('music and drums modes render audio', modes.music > 0.001 && modes.drums > 0.001, JSON.stringify({ music: modes.music, drums: modes.drums }));
    check('sfx mode stays usable and lists sounds', /\bmode-sfx\b/.test(modes.sfxMode) && modes.sfxLab >= 12, JSON.stringify({ cls: modes.sfxMode, lab: modes.sfxLab }));

    await page.evaluate(() => { try { stopAll(); } catch (e) {} });
    await sleep(2500);
    const nodes = await page.evaluate(() => (typeof liveNodes !== 'undefined' ? liveNodes.size : -1));
    check('transient nodes are released after playback', nodes >= 0 && nodes < 80, String(nodes));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO LIFECYCLE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
