/* game-system-save.js - save/load module for the JVDS arcade engine (A672).
 *
 * A small, versioned, dependency-free module. It owns localStorage persistence
 * for a game's state so game-system.js does not have to. If this file is not
 * loaded, game-system.js keeps its own inline fallback, so games never break.
 */
(function (root) {
  'use strict';
  var api = root.JVDSEngine = root.JVDSEngine || {};
  api.version = api.version || '2.1.0';
  api.save = {
    version: '2.1.0',
    // Load and repair a stored state object for a game's storage key.
    load: function (storageKey) {
      try {
        var stored = localStorage.getItem(storageKey);
        var state = stored ? JSON.parse(stored) : null;
        // Repair totalTime corrupted by older pages that recorded timestamps
        // as durations (anything over about a year of play is not real).
        if (state && !(state.totalTime >= 0 && state.totalTime < 3.15e10)) state.totalTime = 0;
        return state;
      } catch (e) {
        console.error('Failed to load game state:', e);
        return null;
      }
    },
    // Persist a state object. Returns true on success.
    persist: function (storageKey, state) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
        return true;
      } catch (e) {
        console.error('Failed to save game state:', e);
        return false;
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);
