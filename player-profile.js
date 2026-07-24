/* ═══════════════════════════════════════════════════════════
   Player Profile, Unified progression across all games & workshops
   ═══════════════════════════════════════════════════════════ */

class PlayerProfile {
  constructor() {
    this.storageKey = 'jvds_profile';
    this.state = this.loadProfile() || this.createDefaultProfile();
  }

  createDefaultProfile() {
    return {
      playerId: this.generateUUID(),
      globalXP: 0,
      level: 1,
      totalPlayTime: 0, // minutes
      completedWorkshops: [],
      unlockedGameModes: [], // format: "gameId:cosmetic-id"
      unlockedGames: [],
      achievements: [],
      dailyStreak: 0,
      lastPlayedDate: null,
      createdAt: new Date().toISOString(),
      questProgress: {}, // format: { "quest-id": { completed: bool, unlockedAt: timestamp } }
      // Rolling record of today's activity, derived from XP sources so the
      // daily challenge can read it without any game-code changes. Resets
      // automatically when the calendar day changes (see getDailyActivity).
      dailyActivity: { date: null, games: [], runs: 0, workshops: 0, xp: 0, claimed: null },
      shareCode: null
    };
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  loadProfile() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load player profile:', e);
      return null;
    }
  }

  saveProfile() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      this.emitEvent('profile-saved', this.state);
    } catch (e) {
      console.error('Failed to save player profile:', e);
    }
  }

  /* ─── XP & LEVELING ─── */
  addXP(amount, source = 'game') {
    const oldLevel = this.state.level;
    this.state.globalXP += amount;
    const newLevel = Math.floor(this.state.globalXP / 1000) + 1;

    const result = {
      xpAdded: amount,
      source,
      totalXP: this.state.globalXP,
      levelUp: newLevel > oldLevel,
      oldLevel,
      newLevel
    };

    if (newLevel > oldLevel) {
      this.state.level = newLevel;
      this.emitEvent('level-up', result);
    }

    this.trackDailyActivity(amount, source);
    this.updateDailyStreak();
    this.saveProfile();
    this.emitEvent('xp-gained', result);
    return result;
  }

  getXPProgress() {
    const xpPerLevel = 1000;
    const currentXP = this.state.globalXP % xpPerLevel;
    return {
      current: currentXP,
      max: xpPerLevel,
      percentage: (currentXP / xpPerLevel) * 100,
      level: this.state.level,
      totalXP: this.state.globalXP
    };
  }

  /* ─── WORKSHOPS ─── */
  markWorkshopCompleted(workshopId, xpEarned = 75) {
    if (!this.state.completedWorkshops.includes(workshopId)) {
      this.state.completedWorkshops.push(workshopId);
      this.addXP(xpEarned, `workshop:${workshopId}`);
      this.saveProfile();
      this.emitEvent('workshop-completed', { workshopId, xpEarned });
      return true;
    }
    return false;
  }

  isWorkshopCompleted(workshopId) {
    return this.state.completedWorkshops.includes(workshopId);
  }

  /* ─── ACHIEVEMENTS ─── */
  unlockAchievement(achievementId) {
    if (!this.state.achievements.includes(achievementId)) {
      this.state.achievements.push(achievementId);
      this.saveProfile();
      this.emitEvent('achievement-unlocked', { achievementId });
      return true;
    }
    return false;
  }

  hasAchievement(achievementId) {
    return this.state.achievements.includes(achievementId);
  }

  /* ─── QUESTS ─── */
  updateQuestProgress(questId, progress = {}) {
    if (!this.state.questProgress[questId]) {
      this.state.questProgress[questId] = { completed: false };
    }
    Object.assign(this.state.questProgress[questId], progress);
    this.saveProfile();
    this.emitEvent('quest-progress', { questId, ...progress });
  }

  completeQuest(questId) {
    this.state.questProgress[questId] = {
      completed: true,
      unlockedAt: new Date().toISOString()
    };
    this.saveProfile();
    this.emitEvent('quest-completed', { questId });
  }

  getQuestProgress(questId) {
    return this.state.questProgress[questId] || null;
  }

  /* ─── COSMETICS & UNLOCKS ─── */
  unlockGameMode(gameId, cosmeticId) {
    const unlock = `${gameId}:${cosmeticId}`;
    if (!this.state.unlockedGameModes.includes(unlock)) {
      this.state.unlockedGameModes.push(unlock);
      this.saveProfile();
      this.emitEvent('cosmetic-unlocked', { gameId, cosmeticId });
      return true;
    }
    return false;
  }

  hasCosmeticUnlocked(gameId, cosmeticId) {
    return this.state.unlockedGameModes.includes(`${gameId}:${cosmeticId}`);
  }

  /* ─── DAILY STREAK ─── */
  updateDailyStreak() {
    const today = new Date().toDateString();
    const lastPlayed = this.state.lastPlayedDate ? new Date(this.state.lastPlayedDate).toDateString() : null;

    if (lastPlayed === today) {
      return; // Already played today
    } else if (lastPlayed) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastPlayed === yesterday.toDateString()) {
        this.state.dailyStreak += 1;
      } else {
        this.state.dailyStreak = 1;
      }
    } else {
      this.state.dailyStreak = 1;
    }

    this.state.lastPlayedDate = new Date().toISOString();
  }

  /* ─── DAILY ACTIVITY & CHALLENGE ───
     A per-day record derived entirely from the XP `source` strings the
     game/workshop bridge already emits (e.g. "game:echo-fruit-catch:run",
     "workshop:scratch-catch-workshop"). Because this lives in addXP, and
     player-profile.js loads on every game and workshop page, the counters
     accrue site-wide with no per-game code. daily-challenge.js reads these
     to decide whether today's rotating goal is met. */
  getDailyActivity() {
    const today = new Date().toDateString();
    let d = this.state.dailyActivity;
    if (!d || d.date !== today) {
      d = { date: today, games: [], runs: 0, workshops: 0, xp: 0, claimed: null };
      this.state.dailyActivity = d;
    }
    return d;
  }

  trackDailyActivity(amount, source) {
    // Never count the challenge's own bonus, or it could self-complete the
    // "earn N XP today" goal.
    if (source === 'daily-challenge') return;
    const d = this.getDailyActivity();
    if (amount > 0) d.xp += amount;
    if (typeof source === 'string') {
      const parts = source.split(':');
      if (parts[0] === 'game' && parts[1]) {
        if (d.games.indexOf(parts[1]) === -1) d.games.push(parts[1]);
        if (parts[2] === 'run') d.runs += 1;
      } else if (parts[0] === 'workshop') {
        d.workshops += 1;
      }
    }
  }

  // Grants the daily challenge bonus exactly once per day. Returns true only
  // on the grant that actually awards XP, so callers can celebrate just once.
  claimDailyChallenge(challengeId, xp) {
    const d = this.getDailyActivity();
    if (d.claimed) return false;
    d.claimed = challengeId;
    this.addXP(xp || 0, 'daily-challenge'); // saves profile + advances streak
    this.emitEvent('daily-challenge-complete', { challengeId, xp: xp || 0 });
    return true;
  }

  getStats() {
    return {
      level: this.state.level,
      totalXP: this.state.globalXP,
      xpProgress: this.getXPProgress(),
      workshopsCompleted: this.state.completedWorkshops.length,
      achievementsUnlocked: this.state.achievements.length,
      dailyStreak: this.state.dailyStreak,
      totalPlayTime: this.state.totalPlayTime,
      questsCompleted: Object.values(this.state.questProgress).filter(q => q.completed).length
    };
  }

  /* ─── EVENTS ─── */
  emitEvent(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data });
    window.dispatchEvent(event);
  }

  onXPGained(callback) {
    window.addEventListener('xp-gained', (e) => callback(e.detail));
  }

  onLevelUp(callback) {
    window.addEventListener('level-up', (e) => callback(e.detail));
  }

  onWorkshopCompleted(callback) {
    window.addEventListener('workshop-completed', (e) => callback(e.detail));
  }

  onAchievementUnlocked(callback) {
    window.addEventListener('achievement-unlocked', (e) => callback(e.detail));
  }

  onQuestCompleted(callback) {
    window.addEventListener('quest-completed', (e) => callback(e.detail));
  }

  onCosmeticUnlocked(callback) {
    window.addEventListener('cosmetic-unlocked', (e) => callback(e.detail));
  }

  /* ─── RESET (DEV ONLY) ─── */
  resetProfile() {
    if (confirm('Reset your entire player profile? This cannot be undone.')) {
      localStorage.removeItem(this.storageKey);
      this.state = this.createDefaultProfile();
      this.saveProfile();
      window.location.reload();
    }
  }
}

// Create and export singleton
const playerProfile = new PlayerProfile();

/* ═══════════════════════════════════════════════════════════
   GA4 BRIDGE
   Forwards the profile's existing CustomEvents to GA4. This file is
   loaded directly by ~59 workshop pages and auto-loaded by every game
   (game-system.js pulls it in), so subscribing here instruments the
   whole site without touching a single page.

   Consent is handled centrally: analytics-loader.js sets Consent Mode
   v2 to denied by default and cookie-consent.js flips it on Accept, so
   these calls are safe to make unconditionally.

   Event names/params mirror the schema in ga4-analytics.js so both stay
   in sync. Note: 'xp-gained' is deliberately NOT forwarded, it fires on
   every award and would flood the property; 'level-up' is the signal.
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (typeof window === 'undefined') return;

  function track(name, params) {
    if (typeof gtag !== 'function') return;
    try { gtag('event', name, params || {}); } catch (e) { /* never break gameplay */ }
  }

  // Level/streak context on every event, so reports can segment by how
  // engaged the player already was.
  function ctx() {
    try {
      var s = playerProfile.getStats();
      return { player_level: s.level, daily_streak: s.dailyStreak };
    } catch (e) { return {}; }
  }

  // evt = profile CustomEvent name, gaName = GA4 event name,
  // build = maps event detail to GA4 params.
  function on(evt, gaName, build) {
    window.addEventListener(evt, function (e) {
      var params = build((e && e.detail) || {}) || {};
      var c = ctx();
      for (var k in c) if (!(k in params)) params[k] = c[k];
      track(gaName, params);
    });
  }

  on('workshop-completed', 'workshop_complete', function (d) {
    return { workshop_id: d.workshopId, xp_earned: d.xpEarned };
  });

  on('quest-completed', 'quest_complete', function (d) {
    return { quest_id: d.questId };
  });

  on('level-up', 'player_level_up', function (d) {
    return { new_level: d.newLevel, total_xp: d.totalXP, source: d.source };
  });

  on('achievement-unlocked', 'achievement_unlock', function (d) {
    return { achievement_id: d.achievementId };
  });

  on('cosmetic-unlocked', 'cosmetic_unlock', function (d) {
    return { game_id: d.gameId, cosmetic_id: d.cosmeticId };
  });
})();
