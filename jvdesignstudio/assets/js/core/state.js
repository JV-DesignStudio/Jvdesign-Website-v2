/**
 * state.js — Persistent player state via localStorage.
 * No framework, no server. Everything lives in the browser.
 */
const STATE_KEY = 'jvds_rpg_state';

const DEFAULT_STATE = {
  version: 1,
  player: {
    name: 'Adventurer',
    level: 1,
    xp: 0,
    xpToNext: 100,
    rank: 'bronze',   // bronze | silver | gold | diamond
    streak: 0,
    lastActiveDate: null,
  },
  progress: {},        // { [trackId]: { completed: [lessonId,...], xpEarned: n } }
  achievements: [],    // earned achievement ids
  skillTree: {},       // { [nodeId]: true }
  settings: {
    sound: true,
    theme: 'dark',
  },
};

export const State = {
  _state: null,

  load() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      this._state = raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
    } catch {
      this._state = { ...DEFAULT_STATE };
    }
    this._checkStreak();
    return this;
  },

  save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(this._state));
    } catch { /* storage full — graceful no-op */ }
    return this;
  },

  get(path) {
    return path.split('.').reduce((o, k) => o?.[k], this._state);
  },

  set(path, value) {
    const keys = path.split('.');
    let obj = this._state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] === undefined) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this.save();
    return this;
  },

  /* XP & levelling */
  addXP(amount) {
    const p = this._state.player;
    p.xp += amount;
    let levelled = false;
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = Math.floor(p.xpToNext * 1.4);
      levelled = true;
      this._updateRank(p.level);
    }
    this.save();
    return { levelled, level: p.level, xp: p.xp, xpToNext: p.xpToNext };
  },

  _updateRank(level) {
    const p = this._state.player;
    if (level >= 40) p.rank = 'diamond';
    else if (level >= 20) p.rank = 'gold';
    else if (level >= 10) p.rank = 'silver';
    else p.rank = 'bronze';
  },

  /* Lesson progress */
  markLessonComplete(trackId, lessonId, xp = 50) {
    if (!this._state.progress[trackId]) {
      this._state.progress[trackId] = { completed: [], xpEarned: 0 };
    }
    const t = this._state.progress[trackId];
    if (!t.completed.includes(lessonId)) {
      t.completed.push(lessonId);
      t.xpEarned += xp;
    }
    this.save();
    return this.addXP(xp);
  },

  isLessonComplete(trackId, lessonId) {
    return this._state.progress[trackId]?.completed.includes(lessonId) ?? false;
  },

  trackProgress(trackId) {
    return this._state.progress[trackId] ?? { completed: [], xpEarned: 0 };
  },

  /* Achievements */
  unlockAchievement(id) {
    if (this._state.achievements.includes(id)) return false;
    this._state.achievements.push(id);
    this.save();
    return true;
  },

  /* Skill tree */
  unlockSkill(nodeId) {
    this._state.skillTree[nodeId] = true;
    this.save();
  },

  hasSkill(nodeId) {
    return !!this._state.skillTree[nodeId];
  },

  /* Streak */
  _checkStreak() {
    const p = this._state.player;
    const today = new Date().toDateString();
    if (p.lastActiveDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    p.streak = p.lastActiveDate === yesterday ? p.streak + 1 : 1;
    p.lastActiveDate = today;
    this.save();
  },

  reset() {
    this._state = { ...DEFAULT_STATE };
    this.save();
  },
};
