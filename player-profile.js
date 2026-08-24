/* ═══════════════════════════════════════════════════════════
   Player Profile, Unified progression across all games & workshops
   ═══════════════════════════════════════════════════════════ */

class PlayerProfile {
  constructor() {
    this.storageKey = 'jvds_profile';
    // Read the RAW stored profile before defaults are merged: a legacy
    // profile has no xpSchema field, but createDefaultProfile() supplies
    // xpSchema:2 during the merge — which would silently skip migration.
    var storedRaw = null;
    try { storedRaw = JSON.parse(localStorage.getItem(this.storageKey) || 'null'); } catch (e) { storedRaw = null; }
    var isLegacy = !!storedRaw && storedRaw.xpSchema === undefined;
    this.state = this.loadProfile() || this.createDefaultProfile();
    this.migrateXP(isLegacy);
    this.refreshXP();
    if (isLegacy) this.saveProfile(); // persist the migration
  }

  /* ─── UNIFIED XP LEDGER ───
     Three XP systems used to exist side-by-side with three level curves
     (profile 1000/lvl, per-game 1000/lvl, workshop dashboard 100/lvl) and
     nothing fed each other. Now the profile is the single ledger:
       workshopXP — re-scanned from per-workshop progress keys
       gameXP     — re-scanned from jvds_game_* state keys
       bonusXP    — challenges, tools, and anything awarded via addXP()
     One curve: 100 XP per level. */

  migrateXP(isLegacy) {
    if (!isLegacy) return;
    // Pre-schema profiles kept globalXP = 75/workshop-completion + challenges
    // + tool XP. Everything that wasn't the completion bump becomes bonusXP;
    // workshop and game XP are re-derived from their source keys below.
    var legacy = this.state.globalXP || 0;
    var completions = (this.state.completedWorkshops || []).length;
    this.state.bonusXP = Math.max(0, legacy - 75 * completions);
    this.state.workshopXP = 0;
    this.state.gameXP = 0;
    this.state.xpSchema = 2;
  }

  scanComponentXP() {
    var workshopXP = 0, gameXP = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key === this.storageKey) continue;
        if (key.indexOf('jvds_game_') === 0) {
          var g = null;
          try { g = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { g = null; }
          if (g && typeof g.xp === 'number' && g.xp > 0) gameXP += Math.floor(g.xp);
          continue;
        }
        // Workshop progress fingerprint (workshop-engine saveProgress shape):
        // numeric xp + numeric total + completed array.
        if (key.indexOf('jvds-') !== 0) continue;
        var w = null;
        try { w = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { w = null; }
        if (w && typeof w.xp === 'number' && typeof w.total === 'number' && Array.isArray(w.completed)) {
          workshopXP += Math.max(0, Math.floor(w.xp));
        }
      }
    } catch (e) { /* private-mode / quota: keep last known values */ }
    return { workshopXP: workshopXP, gameXP: gameXP };
  }

  refreshXP() {
    var parts = this.scanComponentXP();
    this.state.workshopXP = parts.workshopXP;
    this.state.gameXP = parts.gameXP;
    this.state.bonusXP = Math.max(0, this.state.bonusXP || 0);
    var oldLevel = this.state.level;
    this.state.globalXP = this.state.workshopXP + this.state.gameXP + this.state.bonusXP;
    this.state.level = Math.floor(this.state.globalXP / this.XP_PER_LEVEL()) + 1;
    return oldLevel !== this.state.level;
  }

  XP_PER_LEVEL() { return 100; }

  createDefaultProfile() {
    return {
      playerId: this.generateUUID(),
      globalXP: 0,
      level: 1,
      // ── Unified XP ledger (xpSchema 2) ──
      // globalXP = workshopXP + gameXP + bonusXP. workshopXP and gameXP are
      // RECOMPUTED from their source keys (see scanComponentXP) so they can
      // never drift; bonusXP collects challenge/tool XP awarded directly.
      // One level curve site-wide: 100 XP per level.
      xpSchema: 2,
      workshopXP: 0,
      gameXP: 0,
      bonusXP: 0,
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
      // Same shape, but keyed by week number: feeds the Weekly Challenge.
      weeklyActivity: { key: null, games: [], runs: 0, workshops: 0, xp: 0, claimed: null },
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
      const parsed = stored ? JSON.parse(stored) : null;
      // Merge over defaults: profiles saved by older versions (or truncated
      // by a full disk / private-mode eviction) must never crash consumers.
      // A missing questProgress alone used to break getStats() everywhere.
      return parsed ? Object.assign(this.createDefaultProfile(), parsed) : null;
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
    var oldLevel = this.state.level;
    amount = Math.max(0, Math.floor(amount) || 0);
    // Direct awards (challenges, tools, quest board) land in bonusXP.
    // Workshop XP arrives via progress keys and game XP via jvds_game_* —
    // both are re-scanned, so awarding them here would double-count.
    this.state.bonusXP += amount;
    this.refreshXP();
    var newLevel = this.state.level;

    var result = {
      xpAdded: amount,
      source,
      totalXP: this.state.globalXP,
      levelUp: newLevel > oldLevel,
      oldLevel,
      newLevel
    };

    if (newLevel > oldLevel) {
      this.emitEvent('level-up', result);
    }

    this.trackDailyActivity(amount, source);
    this.updateDailyStreak();
    this.saveProfile();
    this.emitEvent('xp-gained', result);
    return result;
  }

  getXPProgress() {
    const xpPerLevel = this.XP_PER_LEVEL();
    const currentXP = this.state.globalXP % xpPerLevel;
    return {
      current: currentXP,
      max: xpPerLevel,
      percentage: (currentXP / xpPerLevel) * 100,
      level: this.state.level,
      totalXP: this.state.globalXP
    };
  }

  /* ─── WORKSHOPS ───
     Completion is recorded for quest/achievement purposes. XP is NOT added
     here — workshop XP is owned by the per-workshop progress keys and picked
     up by scanComponentXP, so awarding a flat bonus would double-count. */
  markWorkshopCompleted(workshopId) {
    if (!this.state.completedWorkshops.includes(workshopId)) {
      this.state.completedWorkshops.push(workshopId);
      this.refreshXP();
      this.saveProfile();
      this.emitEvent('workshop-completed', { workshopId, xpEarned: 0 });
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

  // Week number: whole days since epoch / 7 — no timezone math, and every
  // device computes the identical bucket, like the daily rotation.
  getWeekNumber() {
    const n = new Date();
    const days = Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000);
    return Math.floor(days / 7);
  }

  getWeeklyActivity() {
    const key = this.getWeekNumber();
    let w = this.state.weeklyActivity;
    if (!w || w.key !== key) {
      w = { key: key, games: [], runs: 0, workshops: 0, xp: 0, claimed: null };
      this.state.weeklyActivity = w;
    }
    return w;
  }

  trackDailyActivity(amount, source) {
    const parts = typeof source === 'string' ? source.split(':') : [];
    const isGame = parts[0] === 'game' && !!parts[1];
    const isRun = parts[2] === 'run';

    // Today's totals. Never count a challenge's own bonus, or it could
    // self-complete its own "earn N XP" goal.
    if (source !== 'daily-challenge') {
      const d = this.getDailyActivity();
      if (amount > 0) d.xp += amount;
      if (isGame) {
        if (d.games.indexOf(parts[1]) === -1) d.games.push(parts[1]);
        if (isRun) d.runs += 1;
      } else if (parts[0] === 'workshop') {
        d.workshops += 1;
      }
    }

    // This week's totals (feeds the Weekly Challenge). Same self-feed guard.
    if (source !== 'weekly-challenge') {
      const w = this.getWeeklyActivity();
      if (amount > 0) w.xp += amount;
      if (isGame) {
        if (w.games.indexOf(parts[1]) === -1) w.games.push(parts[1]);
        if (isRun) w.runs += 1;
      } else if (parts[0] === 'workshop') {
        w.workshops += 1;
      }
    }
  }

  // Grants the weekly challenge bonus exactly once per week.
  claimWeeklyChallenge(challengeId, xp) {
    const w = this.getWeeklyActivity();
    if (w.claimed) return false;
    w.claimed = challengeId;
    this.addXP(xp || 0, 'weekly-challenge'); // saves profile
    this.emitEvent('weekly-challenge-complete', { challengeId, xp: xp || 0 });
    return true;
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
      workshopXP: this.state.workshopXP,
      gameXP: this.state.gameXP,
      bonusXP: this.state.bonusXP,
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
