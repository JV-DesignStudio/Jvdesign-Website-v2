// ══ GAME SYSTEM INTEGRATION ══
const gameSystem = new GameSystem('stack-attack', 'Stack Attack', 'tiger');
const soundManager = new SoundManager(gameSystem);

// Score → XP + score-tier achievements, handled reactively by the engine
// (replaces the two setInterval pollers this used to copy-paste).
gameSystem.trackScore({ xpDivisor: 10, tiers: [[1, 'firstStack'], [100, 'score100'], [300, 'score300'], [500, 'score500']] });

window.addEventListener('beforeunload', () => {
  gameSystem.recordGamePlay(Date.now());
  gameSystem.saveState();
});
