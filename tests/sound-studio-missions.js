#!/usr/bin/env node
// tests/sound-studio-missions.js (A2944)
// Covers Lumo's missions, badges, persistence across reload and reset on New song.
// Run: node tests/sound-studio-missions.js
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
    const missions = await page.evaluate(() => {
      localStorage.removeItem('jvds_sound_badges');
      _loadSoundTemplate('blank');
      musicalScale = 'minor';
      bpm = 150;
      grid[4][0] = { on: true, note: 'C', len: 1, vel: 1, oct: 4 };
      grid[4][4] = { on: true, note: 'D#', len: 1, vel: 1, oct: 4 };
      grid[4][8] = { on: true, note: 'G', len: 1, vel: 1, oct: 4 };
      grid[4][12] = { on: true, note: 'C', len: 1, vel: 1, oct: 5 };
      const boss = checkMissions();
      sfxLastBuf = { duration: 0.2 };
      const coin = checkMissions();
      addPattern();
      addSection();
      songMode = true;
      const section = checkMissions();
      return { boss, coin, section, badges: Object.keys(badgeAll()) };
    });
    check('a minor boss theme completes a mission', missions.boss.boss === true, JSON.stringify(missions.boss));
    check('a made sound completes the coin mission', missions.coin.coin === true, JSON.stringify(missions.coin));
    check('a B section completes the song mission', missions.section.section === true, JSON.stringify(missions.section));
    check('completed missions unlock badges',
      ['missionBoss', 'missionCoin', 'missionSection'].every((id) => missions.badges.indexOf(id) >= 0),
      JSON.stringify(missions.badges));

    const badgesBefore = await page.evaluate(() => Object.keys(badgeAll()).sort().join(','));
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await sleep(900);
    const reload = await page.evaluate(() => ({
      badges: Object.keys(badgeAll()).sort().join(','),
      open: (() => { openMissions(); return getComputedStyle(document.getElementById('missions-modal')).display !== 'none'; })(),
      rows: document.querySelectorAll('#missionsList .mix-item').length,
    }));
    check('badges survive a reload', reload.badges === badgesBefore && reload.badges.indexOf('missionBoss') >= 0, JSON.stringify(reload));
    check('the missions modal lists three missions', reload.open && reload.rows === 3, JSON.stringify(reload));

    const reset = await page.evaluate(() => {
      window.confirm = () => true;
      newSong();
      const state = checkMissions();
      return { state, badges: Object.keys(badgeAll()) };
    });
    check('New song resets mission progress', reset.state.boss === false && reset.state.section === false && reset.state.coin === false, JSON.stringify(reset.state));
    check('New song keeps earned badges', reset.badges.indexOf('missionBoss') >= 0, JSON.stringify(reset.badges));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await sleep(100);
    await ctx.close();
    if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
    console.log('\nAUDIO STUDIO MISSION CHECKS PASSED');
  } catch (e) {
    await ctx.close();
    console.error(e);
    process.exit(1);
  }
})();
