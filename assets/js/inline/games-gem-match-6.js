// -- GAME SYSTEM INTEGRATION --
const gameSystem = new GameSystem('gem-match', 'Gem Match', 'pip');
const soundManager = new SoundManager(gameSystem);
const gemPause = GameUI.autoPause({
  pause: () => { if (!gameOn) return false; arcadePaused = true; gameOn = false; return true; },
  resume: () => { arcadePaused = false; gameOn = true; }
});
JVDSArcade.register({
  start: init,
  restart: init,
  pause: () => arcadePaused ? gemPause.resume() : gemPause.pause(),
  sound: () => $('sndBtn').click()
});

// Score ? XP + score-tier achievements, handled reactively by the engine
// (replaces the two setInterval pollers this used to copy-paste).
gameSystem.trackScore({ xpDivisor: 10, tiers: [[1, 'firstMatch'], [500, 'score500'], [1000, 'score1000'], [2000, 'score2000']] });

window.addEventListener('beforeunload', () => {
  gameSystem.recordGamePlay(Date.now());
  gameSystem.saveState();
});
