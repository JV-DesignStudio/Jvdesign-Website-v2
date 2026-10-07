/* game-score.js - the single documented score schema for JVDS games.
 *
 * Every game keeps its best score through window.GameSystem.saveScore(gameId,
 * score, meta). Scores are written to one unified key:
 *
 *   jvds_game_<gameId> = {
 *     score,        // last run score
 *     highScore,    // all-time best (what the Arcade hub + me.html read)
 *     level,        // furthest level/wave/stage reached
 *     gamesPlayed,  // run counter when meta.newPlay is true
 *     extra,        // optional game-specific data (bestWave, leaderboard...)
 *     lastPlayed
 *   }
 *
 * The same key is what the Arcade hub (arcade.html saveOf) and me.html scan, so
 * one write is enough to show up everywhere. This file is standalone so light
 * games that never load the whole engine can still use the schema; the engine
 * (game-system.js) exposes the same API as class statics.
 *
 * Older games wrote their own keys (jvds-best-<id>, gmBest, gdBest,
 * cc_shift_best, ac_scores, echo_picnic_best). getBestScore still reads those
 * once so nobody loses a personal best, but nothing writes them any more.
 */
(function (root) {
  'use strict';

  var PREFIX = 'jvds_game_';

  // Legacy best-only keys still read (never written) for a smooth migration.
  var LEGACY_KEYS = {
    'gem-match': ['gmBest'],
    'garden-defense': ['gdBest'],
    'cozy-cafe': ['cc_shift_best'],
    'arcane-citadel': ['ac_scores'],
    'echo-fruit': ['echo_picnic_best'],
    'critter-whack': ['critter_ranger_best'],
    'dough-dash': ['doughDashBest'],
    'pastry-match': ['pastryMatchBest'],
    'stack-attack': ['stackBest'],
    'void-rush': ['voidrush-best'],
    'stardust_collection': ['stardust_constellation_best_v1']
  };

  function key(gameId) { return PREFIX + gameId; }

  function readState(gameId) {
    try {
      var s = JSON.parse(localStorage.getItem(key(gameId)) || 'null');
      return (s && typeof s === 'object' && !Array.isArray(s)) ? s : null;
    } catch (e) { return null; }
  }

  function toScore(v) {
    v = Number(v);
    return (isFinite(v) && v > 0) ? Math.floor(v) : 0;
  }

  // Best value held in any legacy key for this game (numbers, {score/highScore}
  // objects, or arrays of score entries).
  function legacyBest(gameId) {
    var best = 0;
    var keys = (LEGACY_KEYS[gameId] || []).concat([
      'jvds-best-' + gameId,
      gameId + '_best',
      gameId + '-best'
    ]);
    keys.forEach(function (k) {
      var raw;
      try { raw = localStorage.getItem(k); } catch (e) { return; }
      if (raw == null) return;
      var v;
      try { v = JSON.parse(raw); } catch (e) { v = raw; }
      if (v && typeof v === 'object') {
        if (Array.isArray(v)) {
          v.forEach(function (o) { best = Math.max(best, toScore(o && o.score)); });
        } else {
          best = Math.max(best, toScore(v.highScore), toScore(v.score),
            toScore(v.best), toScore(v.bestScore));
        }
      } else {
        best = Math.max(best, toScore(v));
      }
    });
    return best;
  }

  function saveScore(gameId, score, meta) {
    if (!gameId || typeof score !== 'number' || !isFinite(score)) {
      return getBestScore(gameId);
    }
    score = Math.max(0, Math.floor(score));
    var state = readState(gameId) || {};
    state.score = score;
    state.highScore = Math.max(toScore(state.highScore), legacyBest(gameId), score);
    if (typeof state.gamesPlayed !== 'number') state.gamesPlayed = 0;
    if (meta && typeof meta === 'object') {
      if (meta.newPlay) state.gamesPlayed += 1;
      if (typeof meta.level === 'number' && meta.level > 0) {
        state.level = Math.max(toScore(state.level) || 1, Math.floor(meta.level));
      }
      if (meta.extra && typeof meta.extra === 'object' && !Array.isArray(meta.extra)) {
        state.extra = Object.assign({}, state.extra, meta.extra);
      }
    }
    state.lastPlayed = new Date().toISOString();
    try { localStorage.setItem(key(gameId), JSON.stringify(state)); } catch (e) {}
    return state.highScore;
  }

  function getBestScore(gameId) {
    var state = readState(gameId);
    return Math.max(state ? toScore(state.highScore) : 0, legacyBest(gameId));
  }

  // Full unified state for a game, so callers can read extra fields
  // (bestWave, bestSector, leaderboard...) without touching a bespoke key.
  function getScoreState(gameId) {
    var state = readState(gameId) || {};
    if (state.highScore == null) state.highScore = legacyBest(gameId);
    return state;
  }

  root.JVDSGameScore = { saveScore: saveScore, getBestScore: getBestScore, getScoreState: getScoreState, key: key };

  // Light pages call window.GameSystem?.saveScore; make that resolve even when
  // the full engine is not loaded. On engine pages the GameSystem class is
  // defined later and takes the name over, exposing the same two methods.
  var GS = root.GameSystem = root.GameSystem || {};
  if (typeof GS.saveScore !== 'function') GS.saveScore = saveScore;
  if (typeof GS.getBestScore !== 'function') GS.getBestScore = getBestScore;
  if (typeof GS.getScoreState !== 'function') GS.getScoreState = getScoreState;

  if (root.JVDSEngine) {
    root.JVDSEngine.score = root.JVDSEngine.score || {};
    if (typeof root.JVDSEngine.score.saveScore !== 'function') root.JVDSEngine.score.saveScore = saveScore;
    if (typeof root.JVDSEngine.score.getBestScore !== 'function') root.JVDSEngine.score.getBestScore = getBestScore;
  }
})(typeof window !== 'undefined' ? window : this);
