// -- GAME SYSTEM INTEGRATION --
const gameSystem = new GameSystem('millionaire-quiz', 'Millionaire Quiz', 'sage');

// Score ? XP + score-tier achievements, handled reactively by the engine
// (replaces the two setInterval pollers this used to copy-paste).
gameSystem.trackScore({ xpDivisor: 10, tiers: [[1, 'firstQuestion'], [100, 'score100'], [500, 'score500'], [1000, 'score1000']] });

window.addEventListener('beforeunload', () => {
  // renderResults() already records the run once (guarded by state._scored)
  // the moment a completed quiz's results screen shows; only fall back to
  // recording here for a tab closed mid-quiz, before that ever happened.
  if (!state._scored) gameSystem.recordGamePlay(Date.now());
  gameSystem.saveState();
});
