/**
 * state.js - Persistent player state via localStorage.
 * Key: jv_studio_player_v1
 * Level formula: floor(sqrt(xp / 50)) + 1
 */

const STORAGE_KEY = 'jv_studio_player_v1';

const DEFAULT_STATE = {
  xp: 0,
  streak: 0,
  lastActiveDate: null,
  completedNodes: [],
  unlockedBadges: [],
  currentTrack: 'web-dev-adventurer',
};

export const GameState = {
  /** Returns parsed state from localStorage, or the default schema. */
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...parsed };
    } catch {
      return { ...DEFAULT_STATE };
    }
  },

  /** Serializes and writes state to localStorage. */
  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* storage full - silent fail */ }
  },

  /** Level formula: floor(sqrt(xp / 50)) + 1 */
  calcLevel(xp) {
    return Math.floor(Math.sqrt(xp / 50)) + 1;
  },

  /**
   * Increments XP, calculates level change, updates streak, saves.
   * Returns { state, leveledUp, newLevel }.
   */
  addXP(amount) {
    const state = this.get();
    const oldLevel = this.calcLevel(state.xp);
    state.xp += amount;
    const newLevel = this.calcLevel(state.xp);
    this.updateStreak(state);
    this.save(state);
    return { state, leveledUp: newLevel > oldLevel, newLevel };
  },

  /**
   * Idempotently marks a node complete and awards XP.
   * Returns the result of addXP (or null if already completed).
   */
  markCompleted(nodeId, xpReward) {
    const state = this.get();
    if (state.completedNodes.includes(nodeId)) {
      return { state, leveledUp: false, newLevel: this.calcLevel(state.xp) };
    }
    state.completedNodes.push(nodeId);
    this.save(state);
    return this.addXP(xpReward);
  },

  /**
   * Compares lastActiveDate (YYYY-MM-DD) to today.
   * Increments streak if consecutive day; resets to 1 if broken.
   * Mutates and saves the provided state object.
   */
  updateStreak(state) {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastActiveDate === today) return;

    if (state.lastActiveDate) {
      const last = new Date(state.lastActiveDate);
      const now  = new Date(today);
      const diffDays = Math.round((now - last) / 86400000);
      state.streak = diffDays === 1 ? (state.streak || 0) + 1 : 1;
    } else {
      state.streak = 1;
    }
    state.lastActiveDate = today;
  },

  /** Serialises current state to JSON string for download/copy. */
  exportSave() {
    const state = this.get();
    return JSON.stringify(state, null, 2);
  },

  /**
   * Restores state from a JSON string.
   * Returns true on success, false if validation fails.
   */
  importSave(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      // Basic validation: must have the key fields
      const required = ['xp', 'streak', 'completedNodes', 'unlockedBadges'];
      for (const key of required) {
        if (!(key in parsed)) return false;
      }
      this.save({ ...DEFAULT_STATE, ...parsed });
      return true;
    } catch {
      return false;
    }
  },

  unlockBadge(badgeId) {
    const state = this.get();
    if (!state.unlockedBadges.includes(badgeId)) {
      state.unlockedBadges.push(badgeId);
      this.save(state);
      return true;
    }
    return false;
  },

  reset() {
    this.save({ ...DEFAULT_STATE });
  },
};
