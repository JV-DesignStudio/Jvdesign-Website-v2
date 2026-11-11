#!/usr/bin/env node
// tests/sound-studio-intro-loop.js (A2934)
// Covers game export: intro plus seamless loop, mono/48k rendering, engine presets
// and the sound.json sidecar.
// Run: node tests/sound-studio-intro-loop.js
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
    const presets = await page.evaluate(() => {
      const out = {};
      ['unity', 'godot', 'defold', 'scratch'].forEach((id) => {
        setGameEngine(id);
        out[id] = {
          mono: document.getElementById('gameMono').checked,
          sr: document.getElementById('gameSr').value,
        };
      });
      setGameEngine('unity');
      return out;
    });
    check('engine presets set mono and sample rate',
      presets.unity.mono === false && presets.defold.mono === true &&
      presets.scratch.mono === true && presets.unity.sr === '44100',
      JSON.stringify(presets));

    const fmt = await page.evaluate(async () => {
      const b = await renderMixdown(true, { sampleRate: 48000, mono: true });
      return { ch: b.numberOfChannels, sr: b.sampleRate, len: b.length };
    });
    check('render honours mono and 48 kHz', fmt.ch === 1 && fmt.sr === 48000 && fmt.len > 0, JSON.stringify(fmt));

    const zip = await page.evaluate(async () => {
      const mk = () => tracks.map((t) => Array.from({ length: steps }, () => ({ on: false, note: 'C', len: 1, vel: 1, oct: t.oct })));
      patterns = [{ name: 'A', grid: mk() }, { name: 'B', grid: mk() }];
      patterns[0].grid[0][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 1 };
      patterns[1].grid[0][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 1 };
      patterns[1].grid[4][8] = { on: true, note: 'E', len: 1, vel: 1, oct: 4 };
      currentPattern = 1; grid = patterns[1].grid;
      song = [{ p: 0, rep: 1 }, { p: 1, rep: 1 }]; songMode = true;
      document.getElementById('loopsSelect').value = '1';
      document.getElementById('gameIntro').checked = true;
      setGameEngine('unity');
      let captured = null;
      const real = _downloadAudio;
      _downloadAudio = (blob, name) => { captured = { blob, name }; };
      try { await exportGameLoop(); } finally { _downloadAudio = real; }
      const bytes = new Uint8Array(await captured.blob.arrayBuffer());
      return {
        name: captured.name, size: bytes.length,
        sig: [bytes[0], bytes[1], bytes[2], bytes[3]],
        text: new TextDecoder().decode(bytes),
      };
    });
    check('game loop zip downloads', /_unity_game_loop\.zip$/.test(zip.name) && zip.sig.join(',') === '80,75,3,4' && zip.size > 1000,
      JSON.stringify({ name: zip.name, size: zip.size }));
    check('zip has intro, loop, music and manifest',
      /music_intro\.wav/.test(zip.text) && /music_loop\.wav/.test(zip.text) && /music\.wav/.test(zip.text) && /sound\.json/.test(zip.text),
      '');
    check('manifest names loop start, rate and channels',
      /"loopStart":\s*2/.test(zip.text) && /"sampleRate":\s*44100/.test(zip.text) && /"channels":\s*2/.test(zip.text) && /"intro":\s*"music_intro\.wav"/.test(zip.text),
      '');

    const loopOnly = await page.evaluate(async () => {
      songMode = false;
      document.getElementById('gameIntro').checked = false;
      let captured = null;
      const real = _downloadAudio;
      _downloadAudio = (blob, name) => { captured = { blob, name }; };
      try { await exportGameLoop(); } finally { _downloadAudio = real; }
      const text = new TextDecoder().decode(new Uint8Array(await captured.blob.arrayBuffer()));
      return { hasIntro: /music_intro\.wav/.test(text), intro: /"intro":\s*null/.test(text) };
    });
    check('no intro section means no intro file', loopOnly.hasIntro === false && loopOnly.intro === true, JSON.stringify(loopOnly));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO INTRO/LOOP EXPORT CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
