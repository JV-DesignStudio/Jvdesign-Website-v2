/* ═══════════════════════════════════════════════════════════
   Player Profile — Unified progression across all games & workshops
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
