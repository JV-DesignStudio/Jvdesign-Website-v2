#!/usr/bin/env node
// tests/sound-studio-share.js (A2942)
// Covers the play-only share page, Remix, and the custom-sound warning.
// Run: node tests/sound-studio-share.js
const { open, sleep } = require('./lib/sound-studio-harness');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const ctx = await open({ width: 390, height: 844 });
  const { page, base, errors } = ctx;
  try {
    const info = await page.evaluate(() => {
      _loadSoundTemplate('menu');
      bpm = 140;
      projectName = 'Space Menu';
      return { b64: b64encode(songData()), notes: grid.flat().filter((c) => c.on).length };
    });
    const playUrl = base + '/tools/sound-studio.html?play=1#song=' + info.b64;

    await page.goto(playUrl, { waitUntil: 'load', timeout: 30000 });
    await sleep(900);
    const play = await page.evaluate(() => ({
      playOnly: document.body.classList.contains('play-only'),
      view: document.getElementById('play-view').hidden === false,
      app: getComputedStyle(document.getElementById('app')).display,
      bpm,
      notes: grid.flat().filter((c) => c.on).length,
      title: document.getElementById('play-view-title').textContent,
      noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }));
    check('a share link opens the play-only view',
      play.playOnly && play.view && play.app === 'none' && play.title === 'Space Menu' && play.noOverflow,
      JSON.stringify(play));
    check('the shared song keeps its tempo and notes', play.bpm === 140 && play.notes === info.notes, JSON.stringify(play));

    const playing = await page.evaluate(async () => {
      await getCtx().resume();
      playViewToggle();
      await new Promise((r) => setTimeout(r, 400));
      return { playing: isPlaying, label: document.getElementById('playViewPlay').textContent };
    });
    check('the play-only view plays the song', playing.playing === true && playing.label === 'Stop', JSON.stringify(playing));

    const remix = await page.evaluate(() => {
      remixSong();
      return {
        playOnly: document.body.classList.contains('play-only'),
        viewHidden: document.getElementById('play-view').hidden,
        app: getComputedStyle(document.getElementById('app')).display,
        bpm,
      };
    });
    check('Remix returns to the editor with the song loaded',
      remix.playOnly === false && remix.viewHidden === true && remix.app !== 'none' && remix.bpm === 140,
      JSON.stringify(remix));

    const warn = await page.evaluate(async () => {
      if (!mySamples.length) mySamples.push({ id: 'unit-share-sample', name: 'unit-share-sample', bytes: 1 });
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }); } catch (e) {}
      copySoundShareLink();
      await new Promise((r) => setTimeout(r, 40));
      return (document.getElementById('toast') || {}).textContent || '';
    });
    check('custom sounds are stripped with a warning', /Custom sounds cannot be shared via link/.test(warn), warn);

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/tools/sound-studio.html?play=1&layout=1440#song=' + info.b64, { waitUntil: 'load', timeout: 30000 });
    await sleep(700);
    const desktop = await page.evaluate(() => ({
      noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      view: document.getElementById('play-view').hidden === false,
    }));
    check('play-only layout holds at 1440px', desktop.noOverflow && desktop.view, JSON.stringify(desktop));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO SHARE CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
