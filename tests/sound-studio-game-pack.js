#!/usr/bin/env node
// tests/sound-studio-game-pack.js (A2945)
// Covers the named game pack: jump/coin/hit slots, music loop, sounds.json and snippet.
// Run: node tests/sound-studio-game-pack.js
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
    const pack = await page.evaluate(async () => {
      _loadSoundTemplate('blank');
      openProject();
      const slot = (s) => document.querySelector('.pack-slot[data-slot="' + s + '"]');
      slot('jump').value = 'builtin';
      slot('coin').value = 'builtin';
      slot('hit').value = '';
      document.getElementById('packName').value = 'Space Game';
      let captured = null;
      const real = _downloadAudio;
      _downloadAudio = (blob, name) => { captured = { blob, name }; };
      try { await exportGamePack(); } finally { _downloadAudio = real; }
      const bytes = new Uint8Array(await captured.blob.arrayBuffer());
      return {
        name: captured.name,
        size: bytes.length,
        sig: [bytes[0], bytes[1], bytes[2], bytes[3]],
        text: new TextDecoder().decode(bytes),
        slots: Array.from(document.querySelectorAll('.pack-slot')).map((s) => ({ slot: s.dataset.slot, options: s.options.length })),
      };
    });
    check('game pack zip downloads', /_game_pack\.zip$/.test(pack.name) && pack.sig.join(',') === '80,75,3,4' && pack.size > 1000, JSON.stringify({ name: pack.name, size: pack.size }));
    check('named sounds and music are in the zip',
      /jump\.wav/.test(pack.text) && /coin\.wav/.test(pack.text) && /music_loop\.wav/.test(pack.text) && /sounds\.json/.test(pack.text) && /game-sounds\.js/.test(pack.text),
      '');
    check('an empty slot is skipped', /hit\.wav/.test(pack.text) === false, '');
    check('sounds.json names the slots', /"jump"/.test(pack.text) && /"coin"/.test(pack.text) && /"music"/.test(pack.text), '');
    check('snippet maps names to files', /jump: 'jump\.wav'/.test(pack.text) && /music: 'music_loop\.wav'/.test(pack.text), '');
    check('slots offer the built-in sound and My Sounds', pack.slots.length === 3 && pack.slots.every((s) => s.options >= 2), JSON.stringify(pack.slots));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO GAME PACK CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
