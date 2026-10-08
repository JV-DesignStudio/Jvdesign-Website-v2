/* game-system-score.js - score/progression module for the JVDS arcade engine (A672).
 *
 * Pure helpers that mutate a plain state object, so scoring can be tested and
 * reused without the GameSystem class. game-system.js delegates to it, with an
 * inline fallback if this file is not loaded.
 */
(function (root) {
  'use strict';
  var api = root.JVDSEngine = root.JVDSEngine || {};
  api.version = api.version || '2.1.0';
  var XP_PER_LEVEL = 1000;
  api.score = {
    version: '2.1.0',
    XP_PER_LEVEL: XP_PER_LEVEL,
    // Add run points. Returns { score, newBest, totalScore }.
    add: function (state, points) {
      state.score += points;
      state.totalScore = (state.totalScore || 0) + points;
      var newBest = false;
      if (state.score > state.highScore) { state.highScore = state.score; newBest = true; }
      return { score: state.score, newBest: newBest, totalScore: state.totalScore };
    },
    // Add XP. Returns { levelUp:true, level } on a level up, else { levelUp:false, xp }.
    addXP: function (state, amount) {
      state.xp += amount;
      var newLevel = Math.floor(state.xp / XP_PER_LEVEL) + 1;
      if (newLevel > state.level) { state.level = newLevel; return { levelUp: true, level: newLevel }; }
      return { levelUp: false, xp: state.xp };
    },
    // Add coins. Returns the new coin count.
    addCoins: function (state, amount) {
      state.coins += amount;
      return state.coins;
    },
    // XP progress within the current level.
    progress: function (state) {
      var currentXP = state.xp % XP_PER_LEVEL;
      return { current: currentXP, max: XP_PER_LEVEL, percentage: (currentXP / XP_PER_LEVEL) * 100 };
    }
  };
})(typeof window !== 'undefined' ? window : this);
