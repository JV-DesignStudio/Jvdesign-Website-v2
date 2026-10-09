/* ═══════════════════════════════════════════════════════════
   Player Profile, Unified progression across all games & workshops
   ═══════════════════════════════════════════════════════════ */

/* Storage key -> workshop id for ledger reconciliation (A791).
   Covers every SERIES episode in workshops/my-progress.html, every
   window.BQ quiz page, and every other complete-able progress key found
   in workshops/*.html. Canvas preview keys are intentionally absent. */
var WORKSHOP_KEY_TO_ID = {
    'jvds-3d-print-ep1-v2': 'tinkercad-ep1-spinner',
    'jvds-3d-print-ep2-v2': 'tinkercad-ep2-popit',
    'jvds-3d-print-ep3-v2': 'tinkercad-ep3-blocks',
    'jvds-3d-print-ep4-v2': 'tinkercad-ep4-pattern',
    'jvds-3d-print-ep5-v2': 'tinkercad-ep5-phonestand',
    'jvds-3d-print-ep6-v2': 'tinkercad-ep6-marblerun',
    'jvds-3d-print-ep7-v2': 'tinkercad-ep7-keychain',
    'jvds-3d-print-ep8-v2': 'tinkercad-ep8-shapes',
    'jvds-barrel-blast-v2': 'barrel-blast-workshop',
    'jvds-blender-animation-v2': 'blender-animation-workshop',
    'jvds-blender-character-v2': 'blender-character-workshop',
    'jvds-blender-cube-v2': 'blender-cube-workshop',
    'jvds-blender-lighting-v2': 'blender-lighting-workshop',
    'jvds-blender-materials-v2': 'blender-materials-workshop',
    'jvds-blender-rigging-v2': 'blender-rigging-workshop',
    'jvds-blender-scene-v2': 'blender-scene-workshop',
    'jvds-blender-v2': 'blender-workshop',
    'jvds-castle-builder-v2': 'castle-builder',
    'jvds-castle-siege-v2': 'castle-siege-blueprint',
    'jvds-cpp-breakout-v2': 'cpp-breakout-workshop',
    'jvds-cpp-platformer-v2': 'cpp-platformer-workshop',
    'jvds-cpp-platformer2-v2': 'cpp-platformer-part2-workshop',
    'jvds-cpp-pong-v2': 'cpp-pong-workshop',
    'jvds-cpp-snake-v2': 'cpp-snake-workshop',
    'jvds-cpp-tower-defence-v2': 'cpp-tower-defence-builder',
    'jvds-cpp-tower-part1-v2': 'cpp-tower-part1-workshop',
    'jvds-cpp-tower-part2-v2': 'cpp-tower-part2-workshop',
    'jvds-defold-dungeon-v2': 'defold-dungeon-workshop',
    'jvds-defold-platformer-v2': 'defold-platformer-workshop',
    'jvds-defold-pong-v2': 'defold-pong-workshop',
    'jvds-defold-puzzle-v2': 'defold-puzzle-workshop',
    'jvds-defold-shooter-v2': 'defold-shooter-workshop',
    'jvds-defold-snake-v2': 'defold-snake-workshop',
    'jvds-diablo-blueprint-v2': 'diablo-blueprint',
    'jvds-fairy-survivors-v2': 'fairy-survivors-guide',
    'jvds-fairy-tale-builder': 'fairy-tale-builder',
    'jvds-fnaf-blueprint-v2': 'fnaf-blueprint',
    'jvds-gdevelop-adventure-v2': 'gdevelop-adventure-workshop',
    'jvds-gdevelop-platformer-v2': 'gdevelop-platformer-workshop',
    'jvds-gdevelop-pointclick-v2': 'gdevelop-pointclick-workshop',
    'jvds-gdevelop-pong-v2': 'gdevelop-pong-workshop',
    'jvds-gdevelop-shooter-v2': 'gdevelop-shooter-workshop',
    'jvds-gdevelop-snake-v2': 'gdevelop-snake-workshop',
    'jvds-gml-breakout-v2': 'gml-breakout-workshop',
    'jvds-gml-platformer-v2': 'gml-platformer-workshop',
    'jvds-gml-pong-v2': 'gml-pong-workshop',
    'jvds-gml-rpg-v2': 'gml-rpg-workshop',
    'jvds-gml-shooter-v2': 'gml_shooter_trainer_project',
    'jvds-godot-gatekeeper3d-p1-v2': 'godot-gatekeeper-3d-part1',
    'jvds-godot-gatekeeper3d-p2-v2': 'godot-gatekeeper-3d-part2',
    'jvds-godot-gdscript-v2': 'godot-gdscript-essentials',
    'jvds-godot-racing-v2': 'godot-racing-workshop',
    'jvds-godot-racing2-v2': 'godot-racing-workshop-2',
    'jvds-godot-tutorial-v2': 'godot_tutorial',
    'jvds-java-breakout-v2': 'java-breakout-workshop',
    'jvds-java-breakout-workshop': 'java-breakout-workshop',
    'jvds-java-platformer-v2': 'java-platformer-workshop',
    'jvds-java-platformer-workshop': 'java-platformer-workshop',
    'jvds-java-pong-v2': 'java-pong-workshop',
    'jvds-java-pong-workshop': 'java-pong-workshop',
    'jvds-java-rpg-part1-v2': 'java-rpg-part1-workshop',
    'jvds-java-rpg-part2-v2': 'java-rpg-part2-workshop',
    'jvds-java-rpg-part3-v2': 'java-rpg-part3-workshop',
    'jvds-java-rpg1-workshop': 'java-rpg-part1-workshop',
    'jvds-java-rpg2-workshop': 'java-rpg-part2-workshop',
    'jvds-java-rpg3-workshop': 'java-rpg-part3-workshop',
    'jvds-java-space-v2': 'java-space-workshop',
    'jvds-java-space-workshop': 'java-space-workshop',
    'jvds-js-breakout-v2': 'js-breakout-workshop',
    'jvds-js-flappy-v2': 'js-flappy-workshop',
    'jvds-js-memory-v2': 'js-memory-workshop',
    'jvds-js-platformer-v2': 'js-platformer-builder',
    'jvds-js-platformer2-v2': 'js-platformer-part2-workshop',
    'jvds-js-snake-v2': 'js-snake-workshop',
    'jvds-jump-jump-mario-v2': 'jump-jump-mario-workshop',
    'jvds-minecraft-custom-block-v2': 'minecraft-custom-block-mod',
    'jvds-minecraft-custom-food-v2': 'minecraft-custom-food-mod',
    'jvds-minecraft-custom-mob-v2': 'minecraft-custom-mob-mod',
    'jvds-minecraft-custom-tool-v2': 'minecraft-custom-tool-mod',
    'jvds-minecraft-first-item-v2': 'minecraft-first-item-mod',
    'jvds-minecraft-lucky-v2': 'minecraft-lucky-mod',
    'jvds-mugen-ai-v2': 'mugen-ai-workshop',
    'jvds-mugen-basics-v2': 'mugen-basics-workshop',
    'jvds-mugen-game-v2': 'mugen-game-setup-workshop',
    'jvds-mugen-stage-v2': 'add-your-own-stage',
    'jvds-mugen-v2': 'mugen-workshop',
    'jvds-night-watch-p2-v2': 'night-watch-part2-workshop',
    'jvds-night-watch-p3-v2': 'night-watch-part3-workshop',
    'jvds-night-watch-v2': 'night-watch-workshop',
    'jvds-nuclear-blueprint-v2': 'nuclear-blueprint',
    'jvds-nuclear-throne-v2': 'nuclear-throne-guide',
    'jvds-openrct2-modding-v2': 'openrct2-modding-builder',
    'jvds-openrct2-swim-v2': 'openrct2-swim-rescue',
    'jvds-pico8-dungeon-v2': 'pico8-dungeon-workshop',
    'jvds-pico8-match3-v2': 'pico8-match3-workshop',
    'jvds-pico8-platformer-v2': 'pico8-platformer-workshop',
    'jvds-pico8-pong-v2': 'pico8-pong-workshop',
    'jvds-pico8-shooter-v2': 'pico8-shooter-workshop',
    'jvds-pico8-snake-v2': 'pico8-snake-workshop',
    'jvds-pirate-cannon-v2': 'pirate-cannon-builder',
    'jvds-pirate-ship-v2': 'pirate-ship-builder',
    'jvds-pixel-quest-v2': 'pixel-quest-workshop',
    'jvds-python-breakout-v2': 'python-breakout-workshop',
    'jvds-python-breakout2-v2': 'python-breakout-part2-workshop',
    'jvds-python-catch-v2': 'python-catch-workshop',
    'jvds-python-dodge-v2': 'python-dodge-workshop',
    'jvds-python-game-v2': 'python-game-builder',
    'jvds-python-maze-v2': 'python-maze-workshop',
    'jvds-python-platformer-v2': 'python-platformer-workshop',
    'jvds-python-platformer2-v2': 'python-platformer-part2-workshop',
    'jvds-race-builder-v2': 'race-builder',
    'jvds-race-car-builder': 'race-car-builder',
    'jvds-racing-blueprint-v2': 'racing-blueprint',
    'jvds-roblox-adventure-v2': 'roblox-adventure-workshop',
    'jvds-roblox-battle-v2': 'roblox-battle-workshop',
    'jvds-roblox-collapse-v2': 'roblox-collapse-obby-workshop',
    'jvds-roblox-corruption-v1': 'roblox-corruption-obby-workshop',
    'jvds-roblox-creator-journey-v2': 'roblox-creator-journey',
    'jvds-roblox-creator-v2': 'roblox-creator-journey',
    'jvds-roblox-horror-v2': 'roblox-horror-workshop',
    'jvds-roblox-obby-v2': 'roblox-obby-workshop',
    'jvds-roblox-pirate-v2': 'roblox-pirate-workshop',
    'jvds-roblox-simulator-v2': 'roblox-simulator-workshop',
    'jvds-roblox-tycoon-v2': 'roblox-tycoon-workshop',
    'jvds-robot-builder-v2': 'robot-builder',
    'jvds-rocket-builder-v2': 'rocket-builder',
    'jvds-scifi-runner-v2': 'sci-fi-runner-builder',
    'jvds-scratch-catch-v2': 'scratch-catch-workshop',
    'jvds-scratch-clicker-v2': 'scratch-clicker-workshop',
    'jvds-scratch-maze-v2': 'scratch-maze-workshop',
    'jvds-scratch-platformer-v2': 'scratch-platformer-workshop',
    'jvds-scratch-quiz-v2': 'scratch-quiz-workshop',
    'jvds-scratch-story-v2': 'scratch-story-workshop',
    'jvds-space-invaders-v2': 'space_invaders_tutorial',
    'jvds-steampunk-airship-v2': 'steampunk-airship-builder',
    'jvds-submarine-builder': 'submarine-builder',
    'jvds-unity-2d-platformer-v2': 'unity-2d-platformer',
    'jvds-unity-3d-platformer-v2': 'unity-3d-platformer',
    'jvds-unity-action-rpg-v2': 'unity-action-rpg-workshop',
    'jvds-unity-breakout-v2': 'unity-breakout-workshop',
    'jvds-unity-multiplayer-v2': 'unity-multiplayer-workshop',
    'jvds-unity-pong-v2': 'unity-pong-workshop',
    'jvds-unity-top-down-v2': 'unity-top-down-shooter',
    'jvds-unity-ui-menus-v2': 'unity-ui-workshop',
    'jvds-unreal-2d-platformer-v2': 'unreal-2d-platformer',
    'jvds-unreal-advanced-v2': 'unreal-advanced-workshop',
    'jvds-unreal-basics-v2': 'unreal-basics-workshop',
    'jvds-unreal-bp-shooter-v2': 'unreal-blueprint-shooter',
    'jvds-unreal-clicker-v2': 'unreal-clicker-builder',
    'jvds-unreal-fighter-v2': 'unreal-fighter-workshop',
    'jvds-unreal-multiplayer-v2': 'unreal-multiplayer-workshop',
    'jvds-unreal-top-down-v2': 'unreal-top-down-shooter',
    'jvds-unreal-zombie-v2': 'unreal-zombie-survivor',
    'jvds-stardew-world-ep1-v2': 'stardew-world-ep1-setup',
    'jvds-stardew-world-ep2-v2': 'stardew-world-ep2-mods-folder',
    'jvds-stardew-world-ep3-v2': 'stardew-world-ep3-first-tile',
    'jvds-stardew-world-ep4-v2': 'stardew-world-ep4-layers',
    'jvds-stardew-world-ep5-v2': 'stardew-world-ep5-tile-properties',
    'jvds-stardew-world-ep6-v2': 'stardew-world-ep6-build-and-decorate',
    'jvds-stardew-world-ep7-v2': 'stardew-world-ep7-warps',
    'jvds-stardew-world-ep8-v2': 'stardew-world-ep8-new-area',
    'jvds-stardew-world-ep9-v2': 'stardew-world-ep9-package-mod',
    'jvds-stardew-world-ep10-v2': 'stardew-world-ep10-troubleshoot',
    'jvds-stardew-world-ep11-v2': 'stardew-world-ep11-play-share'
};

class PlayerProfile {
  constructor() {
    this.storageKey = 'jvds_profile';
    // Read the RAW stored profile before defaults are merged: a legacy
    // profile has no xpSchema field, but createDefaultProfile() supplies
    // xpSchema:2 during the merge , which would silently skip migration.
    var storedRaw = null;
    try { storedRaw = JSON.parse(localStorage.getItem(this.storageKey) || 'null'); } catch (e) { storedRaw = null; }
    var isLegacy = !!storedRaw && storedRaw.xpSchema === undefined;
    this.state = this.loadProfile() || this.createDefaultProfile();
    this.migrateXP(isLegacy);
    this.refreshXP();
    if (isLegacy) this.saveProfile(); // persist the migration
    // A791: reconcile already-complete progress keys into the single ledger.
    if (this.syncWorkshopCompletions()) this.saveProfile();
  }

  /* ─── UNIFIED XP LEDGER ───
     Three XP systems used to exist side-by-side with three level curves
     (profile 1000/lvl, per-game 1000/lvl, workshop dashboard 100/lvl) and
     nothing fed each other. Now the profile is the single ledger:
       workshopXP , re-scanned from per-workshop progress keys
       gameXP     , re-scanned from jvds_game_* state keys
       bonusXP    , challenges, tools, and anything awarded via addXP()
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
    // Workshop XP arrives via progress keys and game XP via jvds_game_* -
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
     here , workshop XP is owned by the per-workshop progress keys and picked
     up by scanComponentXP, so awarding a flat bonus would double-count.
     completedWorkshops is the single authoritative "workshops done" ledger
     (A791): me.html and workshops/my-progress.html both read it, and
     syncWorkshopCompletions() reconciles progress keys that finished
     without reporting, so every surface shows the same total. */
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

  /* ─── LEDGER RECONCILIATION (A791) ───
     Fold every already-complete per-workshop progress key into
     completedWorkshops exactly once. "Complete" uses the same shape rule as
     workshops/my-progress.html (completed array covers total), so the two
     pages agree by construction. Canvas preview keys (jvds-*-canvas) carry
     no total and are skipped: the canvas engine has no completion signal.
     Direct push, no events: this runs on every load and must stay silent. */
  syncWorkshopCompletions() {
    var added = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf('jvds-') !== 0 || key === this.storageKey) continue;
        var id = WORKSHOP_KEY_TO_ID[key];
        if (!id || this.state.completedWorkshops.indexOf(id) !== -1) continue;
        var w = null;
        try { w = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { w = null; }
        if (w && Array.isArray(w.completed) && w.completed.length > 0 &&
            typeof w.total === 'number' && w.completed.length >= w.total) {
          this.state.completedWorkshops.push(id);
          added++;
        }
      }
    } catch (e) { /* private-mode: keep last known ledger */ }
    return added;
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
  // Use UTC ISO dates (YYYY-MM-DD) so the day boundary is consistent
  // regardless of the user's timezone and local clock.
  _utcDay(d) { return (d || new Date()).toISOString().slice(0, 10); }

  updateDailyStreak() {
    const today = this._utcDay();
    const lastPlayed = this.state.lastPlayedDate ? this._utcDay(new Date(this.state.lastPlayedDate)) : null;

    if (lastPlayed === today) {
      return; // Already played today
    } else if (lastPlayed) {
      const yesterday = this._utcDay(new Date(Date.now() - 86400000));
      if (lastPlayed === yesterday) {
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
    const today = this._utcDay();
    let d = this.state.dailyActivity;
    if (!d || d.date !== today) {
      d = { date: today, games: [], runs: 0, workshops: 0, xp: 0, claimed: null };
      this.state.dailyActivity = d;
    }
    return d;
  }

  // Week number: whole days since epoch / 7 , no timezone math, and every
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
// A791: a top-level const in a classic script does not attach to window, but
// me.html, pages/workshop.html and several games read window.playerProfile,
// so the ledger was unreachable there. Export it explicitly.
if (typeof window !== 'undefined') window.playerProfile = playerProfile;

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
  window.addEventListener('workshop-completed', function () {
    if (window.JVDSFunnel) window.JVDSFunnel.complete({ surface: 'workshop', trigger: 'workshop-completed' });
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
