// ══ GAME SYSTEM INTEGRATION ══  (writes window.__gsScore / window.__gsBestRun in-game)
const gameSystem = window.gs;
const soundManager = new SoundManager(gameSystem);

// Score → XP + score-tier achievements, handled reactively by the engine
// (replaces the two setInterval pollers this used to copy-paste).
gameSystem.trackScore({ xpDivisor: 10, tiers: [[300, 'gd_score300'], [800, 'gd_score800']] });

window.addEventListener('beforeunload', () => {
  gameSystem.recordGamePlay(Date.now());
  gameSystem.saveState();
});
