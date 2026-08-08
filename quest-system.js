/* ═══════════════════════════════════════════════════════════
   Quest System, Definitions, unlock logic, reward tracking
   ═══════════════════════════════════════════════════════════ */

const QUESTS = {
  'quest-1-scratch-catch': {
    id: 'quest-1-scratch-catch',
    title: 'Fruit Catcher Challenge',
    description: 'Complete the Scratch Fruit Catch workshop, then score 500 in Echo\'s Fruit Catch game.',
    icon: '🍎',
    workshopId: 'scratch-catch-workshop',
    gameId: 'echo-fruit-catch',
    category: 'intro',
    difficulty: 'beginner',
    order: 1,
    requirements: [
      { type: 'workshop', id: 'scratch-catch-workshop' },
      { type: 'game-score', gameId: 'echo-fruit-catch', minScore: 500 }
    ],
    rewards: {
      xp: 100,
      cosmetic: { gameId: 'echo-fruit-catch', cosmeticId: 'special-basket' },
      badge: '🏆 Fruit Master'
    }
  },

  'quest-2-jump-jump-master': {
    id: 'quest-2-jump-jump-master',
    title: 'Godot Platformer Master',
    description: 'Complete the Jump Jump Mario workshop, then reach height 500 in Sky High Squirt.',
    icon: '⭐',
    workshopId: 'jump-jump-mario-workshop',
    gameId: 'sky-high-squirt',
    category: 'platformer',
    difficulty: 'intermediate',
    order: 2,
    prerequisites: ['quest-1-scratch-catch'],
    requirements: [
      { type: 'workshop', id: 'jump-jump-mario-workshop' },
      { type: 'game-metric', gameId: 'sky-high-squirt', metric: 'maxHeight', minValue: 500 }
    ],
    rewards: {
      xp: 150,
      cosmetic: { gameId: 'sky-high-squirt', cosmeticId: 'godot-skin' },
      badge: '🎮 Platformer Pro'
    }
  },

  'quest-3-scratch-series': {
    id: 'quest-3-scratch-series',
    title: 'Scratch Master Series',
    description: 'Complete 3 Scratch workshops to unlock a special Scratch cosmetic pack.',
    icon: '🐱',
    category: 'coding',
    difficulty: 'intermediate',
    order: 3,
    prerequisites: ['quest-1-scratch-catch'],
    requirements: [
      { type: 'workshop-count', workshopIds: ['scratch-catch-workshop', 'scratch-maze-workshop', 'scratch-platformer-workshop'], minCount: 3 }
    ],
    rewards: {
      xp: 200,
      badge: '🐱 Scratch Master',
      achievement: 'scratchMaster'
    }
  },

  'quest-4-game-collector': {
    id: 'quest-4-game-collector',
    title: 'Game Collector',
    description: 'Play and score at least 100 points in 5 different games.',
    icon: '🎮',
    category: 'gaming',
    difficulty: 'beginner',
    order: 4,
    requirements: [
      { type: 'game-variety', minGamesPlayed: 5, minScorePerGame: 100 }
    ],
    rewards: {
      xp: 175,
      badge: '🎮 Game Collector',
      achievement: 'gameCollector'
    }
  },

  'quest-5-streak-champion': {
    id: 'quest-5-streak-champion',
    title: 'Streak Champion',
    description: 'Maintain a 7-day play streak to unlock a special achievement.',
    icon: '🔥',
    category: 'engagement',
    difficulty: 'intermediate',
    order: 5,
    requirements: [
      { type: 'daily-streak', minDays: 7 }
    ],
    rewards: {
      xp: 250,
      badge: '🔥 Week Warrior',
      achievement: 'streakChampion'
    }
  },

  'quest-6-pip-baker': {
    id: 'quest-6-pip-baker',
    title: 'Pip\'s Baker Empire',
    description: 'Reach level 5 in Pip\'s Bakery Empire idle game.',
    icon: '🥐',
    gameId: 'pips-bakery-empire',
    category: 'gaming',
    difficulty: 'beginner',
    order: 6,
    requirements: [
      { type: 'game-level', gameId: 'pips-bakery-empire', minLevel: 5 }
    ],
    rewards: {
      xp: 125,
      cosmetic: { gameId: 'pips-bakery-empire', cosmeticId: 'golden-apron' },
      badge: '🥐 Baker\'s Pride'
    }
  },

  'quest-7-sky-high': {
    id: 'quest-7-sky-high',
    title: 'Sky High Explorer',
    description: 'Unlock 5 cosmetics in Sky High Squirt game.',
    icon: '☁️',
    gameId: 'sky-high-squirt',
    category: 'gaming',
    difficulty: 'intermediate',
    order: 7,
    requirements: [
      { type: 'cosmetic-unlock-count', gameId: 'sky-high-squirt', minCount: 5 }
    ],
    rewards: {
      xp: 150,
      badge: '☁️ Sky Explorer',
      achievement: 'skyHighExplorer'
    }
  },

  'quest-8-all-workshops': {
    id: 'quest-8-all-workshops',
    title: 'Learning Legend',
    description: 'Complete 10 workshops from different categories.',
    icon: '📚',
    category: 'learning',
    difficulty: 'advanced',
    order: 8,
    prerequisites: ['quest-3-scratch-series'],
    requirements: [
      { type: 'workshop-count', minCount: 10, minCategories: 5 }
    ],
    rewards: {
      xp: 300,
      badge: '📚 Learning Legend',
      achievement: 'learningLegend'
    }
  },

  'quest-9-python-coder': {
    id: 'quest-9-python-coder',
    title: 'Python Programmer',
    description: 'Complete 2 Python workshops and score 300 in a Python-based game.',
    icon: '🐍',
    category: 'coding',
    difficulty: 'intermediate',
    order: 9,
    requirements: [
      { type: 'workshop-count', workshopIds: ['python-basics-workshop', 'python-advanced-workshop'], minCount: 2 },
      { type: 'game-score', gameId: 'python-game', minScore: 300 }
    ],
    rewards: {
      xp: 180,
      badge: '🐍 Python Pro',
      achievement: 'pythonCoder'
    }
  },

  'quest-10-roblox-builder': {
    id: 'quest-10-roblox-builder',
    title: 'Roblox Builder',
    description: 'Complete 3 Roblox development workshops.',
    icon: '🟥',
    category: 'coding',
    difficulty: 'intermediate',
    order: 10,
    requirements: [
      { type: 'workshop-count', workshopIds: ['roblox-basics', 'roblox-scripts', 'roblox-games'], minCount: 3 }
    ],
    rewards: {
      xp: 200,
      badge: '🟥 Roblox Master',
      achievement: 'robloxBuilder'
    }
  },

  'quest-11-puzzle-master': {
    id: 'quest-11-puzzle-master',
    title: 'Puzzle Master',
    description: 'Score 1000+ in 3 different puzzle games.',
    icon: '🧩',
    category: 'gaming',
    difficulty: 'intermediate',
    order: 11,
    requirements: [
      { type: 'multi-game-scores', minGames: 3, minScore: 1000, gameCategory: 'puzzle' }
    ],
    rewards: {
      xp: 220,
      badge: '🧩 Puzzle Solver',
      achievement: 'puzzleMaster'
    }
  },

  'quest-12-godot-expert': {
    id: 'quest-12-godot-expert',
    title: 'Godot Expert',
    description: 'Complete 4 Godot workshops and reach level 10 in a Godot game.',
    icon: '🔷',
    category: 'coding',
    difficulty: 'advanced',
    order: 12,
    prerequisites: ['quest-2-jump-jump-master'],
    requirements: [
      { type: 'workshop-count', workshopIds: ['godot-basics', 'godot-2d', 'godot-3d', 'godot-multiplayer'], minCount: 4 },
      { type: 'game-level', gameId: 'sky-high-squirt', minLevel: 10 }
    ],
    rewards: {
      xp: 280,
      badge: '🔷 Godot Wizard',
      achievement: 'godotExpert'
    }
  },

  'quest-13-game-speedrunner': {
    id: 'quest-13-game-speedrunner',
    title: 'Speedrunner',
    description: 'Complete 5 games with perfect or near-perfect scores.',
    icon: '⚡',
    category: 'gaming',
    difficulty: 'advanced',
    order: 13,
    requirements: [
      { type: 'perfect-scores', minGames: 5, minScore: 0.9 }
    ],
    rewards: {
      xp: 300,
      badge: '⚡ Speed Master',
      achievement: 'speedrunner'
    }
  },

  'quest-14-creative-coder': {
    id: 'quest-14-creative-coder',
    title: 'Creative Coder',
    description: 'Complete workshops from all 3 categories: Scratch, Godot, and MUGEN.',
    icon: '🎨',
    category: 'learning',
    difficulty: 'advanced',
    order: 14,
    prerequisites: ['quest-8-all-workshops'],
    requirements: [
      { type: 'category-diversity', minCategories: 3 }
    ],
    rewards: {
      xp: 320,
      cosmetic: { gameId: 'pastry-match', cosmeticId: 'sparkle-effect' },
      badge: '🎨 Creative Genius',
      achievement: 'creativeCoder'
    }
  },

  'quest-15-achievement-hunter': {
    id: 'quest-15-achievement-hunter',
    title: 'Achievement Hunter',
    description: 'Unlock 8 different achievements across the platform.',
    icon: '🏅',
    category: 'engagement',
    difficulty: 'advanced',
    order: 15,
    requirements: [
      { type: 'achievement-count', minCount: 8 }
    ],
    rewards: {
      xp: 350,
      badge: '🏅 Achievement Legend',
      achievement: 'achievementHunter'
    }
  },

  'quest-16-tower-defender': {
    id: 'quest-16-tower-defender',
    title: 'Tower Defender',
    description: 'Reach level 5 in Arcane Citadel.',
    icon: '🏰',
    gameId: 'arcane-citadel',
    category: 'gaming',
    difficulty: 'intermediate',
    order: 16,
    requirements: [
      { type: 'game-level', gameId: 'arcane-citadel', minLevel: 5 }
    ],
    rewards: { xp: 180, badge: '🏰 Citadel Defender', achievement: 'towerDefender' }
  },

  'quest-17-gem-hunter': {
    id: 'quest-17-gem-hunter',
    title: 'Gem Hunter',
    description: 'Reach level 8 in Gem Match.',
    icon: '💎',
    gameId: 'gem-match',
    category: 'gaming',
    difficulty: 'intermediate',
    order: 17,
    requirements: [
      { type: 'game-level', gameId: 'gem-match', minLevel: 8 }
    ],
    rewards: { xp: 150, badge: '💎 Gem Hunter', achievement: 'gemHunter' }
  },

  'quest-18-dungeon-diver': {
    id: 'quest-18-dungeon-diver',
    title: 'Dungeon Diver',
    description: 'Reach level 5 in Dungeon Delve.',
    icon: '🗝️',
    gameId: 'dungeon-delve',
    category: 'gaming',
    difficulty: 'intermediate',
    order: 18,
    requirements: [
      { type: 'game-level', gameId: 'dungeon-delve', minLevel: 5 }
    ],
    rewards: { xp: 200, badge: '🗝️ Dungeon Diver', achievement: 'dungeonDiver' }
  },

  'quest-19-void-survivor': {
    id: 'quest-19-void-survivor',
    title: 'Void Survivor',
    description: 'Survive to wave 10 in VoidRush.',
    icon: '🌌',
    gameId: 'void-rush',
    category: 'gaming',
    difficulty: 'advanced',
    order: 19,
    requirements: [
      { type: 'game-metric', gameId: 'void-rush', metric: 'wave', minValue: 10 }
    ],
    rewards: { xp: 220, badge: '🌌 Void Survivor', achievement: 'voidSurvivor' }
  },

  'quest-20-chef-supreme': {
    id: 'quest-20-chef-supreme',
    title: 'Chef Supreme',
    description: 'Reach level 5 in Star Chef.',
    icon: '👨‍🍳',
    gameId: 'star-chef',
    category: 'gaming',
    difficulty: 'intermediate',
    order: 20,
    requirements: [
      { type: 'game-level', gameId: 'star-chef', minLevel: 5 }
    ],
    rewards: { xp: 150, badge: '👨‍🍳 Chef Supreme', achievement: 'chefSupreme' }
  },

  'quest-21-arcade-veteran': {
    id: 'quest-21-arcade-veteran',
    title: 'Arcade Veteran',
    description: 'Maintain a 30-day play streak.',
    icon: '🎖️',
    category: 'engagement',
    difficulty: 'advanced',
    order: 21,
    prerequisites: ['quest-5-streak-champion'],
    requirements: [
      { type: 'daily-streak', minDays: 30 }
    ],
    rewards: { xp: 400, badge: '🎖️ Arcade Veteran', achievement: 'arcadeVeteran' }
  },

  'quest-22-stage-master': {
    id: 'quest-22-stage-master',
    title: 'Stage Master',
    description: 'Score at least 50 points in 8 different games.',
    icon: '🌟',
    category: 'gaming',
    difficulty: 'advanced',
    order: 22,
    prerequisites: ['quest-4-game-collector'],
    requirements: [
      { type: 'game-variety', minGamesPlayed: 8, minScorePerGame: 50 }
    ],
    rewards: { xp: 250, badge: '🌟 Stage Master', achievement: 'stageMaster' }
  },

  'quest-23-tiger-collector': {
    id: 'quest-23-tiger-collector',
    title: 'Tiger Collector',
    description: 'Unlock 3 cosmetics in Tiger Smash.',
    icon: '🐯',
    gameId: 'tiger-smash',
    category: 'gaming',
    difficulty: 'beginner',
    order: 23,
    requirements: [
      { type: 'cosmetic-unlock-count', gameId: 'tiger-smash', minCount: 3 }
    ],
    rewards: { xp: 160, badge: '🐯 Tiger Collector', achievement: 'tigerCollector' }
  }
};

/* Real workshop-id -> category map, built from the actual ids that call
   markWorkshopCompleted() across the site today (grep-verified, not the
   aspirational "5 major categories" the original quest-14 description
   claimed). Only 3 real categories exist in tracked data right now. */
const WORKSHOP_CATEGORIES = {
  'scratch-catch-workshop': 'scratch',
  'scratch-clicker-workshop': 'scratch',
  'scratch-maze-workshop': 'scratch',
  'scratch-platformer-workshop': 'scratch',
  'scratch-quiz-workshop': 'scratch',
  'scratch-story-workshop': 'scratch',
  'jump-jump-mario-workshop': 'godot',
  'godot-racing-workshop': 'godot',
  'gml-shooter-trainer': 'godot',
  'mugen-workshop': 'mugen',
  'mugen-ai-workshop': 'mugen',
  'add-your-own-stage': 'mugen',
};

class QuestSystem {
  constructor() {
    this.quests = QUESTS;
  }

  defineQuests() {
    return this.quests;
  }

  getQuest(questId) {
    return this.quests[questId];
  }

  getAllQuests() {
    return Object.values(this.quests).sort((a, b) => a.order - b.order);
  }

  isQuestUnlocked(questId, playerProfile) {
    const quest = this.getQuest(questId);
    if (!quest) return false;

    // Check prerequisites
    if (quest.prerequisites && quest.prerequisites.length > 0) {
      for (const prereqId of quest.prerequisites) {
        const prereqProgress = playerProfile.getQuestProgress(prereqId);
        if (!prereqProgress || !prereqProgress.completed) {
          return false;
        }
      }
    }

    return true;
  }

  isQuestActive(questId, playerProfile) {
    const progress = playerProfile.getQuestProgress(questId);
    return progress && !progress.completed;
  }

  isQuestCompleted(questId, playerProfile) {
    const progress = playerProfile.getQuestProgress(questId);
    return progress && progress.completed;
  }

  checkQuestCompletion(questId, playerProfile, gameStates = {}) {
    const quest = this.getQuest(questId);
    if (!quest || this.isQuestCompleted(questId, playerProfile)) {
      return { completed: false, reason: 'invalid_or_already_done' };
    }

    // Check all requirements
    for (const req of quest.requirements) {
      if (!this.checkRequirement(req, playerProfile, gameStates)) {
        return { completed: false, requirement: req };
      }
    }

    return { completed: true };
  }

  checkRequirement(requirement, playerProfile, gameStates) {
    switch (requirement.type) {
      case 'workshop':
        return playerProfile.isWorkshopCompleted(requirement.id);

      case 'game-score':
        // Assumes game state includes highScore
        const gameScore = gameStates[requirement.gameId];
        return gameScore && gameScore.highScore >= requirement.minScore;

      case 'game-metric':
        const gameMetric = gameStates[requirement.gameId];
        return gameMetric && gameMetric[requirement.metric] >= requirement.minValue;

      case 'game-level':
        const gameLevel = gameStates[requirement.gameId];
        return gameLevel && gameLevel.level >= requirement.minLevel;

      case 'workshop-count':
        if (requirement.workshopIds) {
          const completed = requirement.workshopIds.filter(id => playerProfile.isWorkshopCompleted(id)).length;
          return completed >= requirement.minCount;
        }
        return playerProfile.getStats().workshopsCompleted >= requirement.minCount;

      case 'daily-streak':
        return playerProfile.state.dailyStreak >= requirement.minDays;

      case 'game-variety':
        const gamesPlayed = Object.keys(gameStates).filter(
          gameId => gameStates[gameId] && gameStates[gameId].highScore >= requirement.minScorePerGame
        ).length;
        return gamesPlayed >= requirement.minGamesPlayed;

      case 'cosmetic-unlock-count':
        const cosmeticsUnlocked = playerProfile.state.unlockedGameModes.filter(
          u => u.startsWith(requirement.gameId + ':')
        ).length;
        return cosmeticsUnlocked >= requirement.minCount;

      case 'achievement-count':
        return playerProfile.getStats().achievementsUnlocked >= requirement.minCount;

      case 'multi-game-scores':
        // No per-game genre/category data exists anywhere in the codebase
        // (games-registry.js has no category field), so this can't actually
        // filter by requirement.gameCategory as originally written. Falls
        // back to counting any N games meeting the score bar, functionally
        // the same shape as 'game-variety' but reusing this type's own
        // field names.
        const scoringGames = Object.keys(gameStates).filter(
          gameId => gameStates[gameId] && gameStates[gameId].highScore >= requirement.minScore
        ).length;
        return scoringGames >= requirement.minGames;

      case 'perfect-scores':
        // No game tracks a normalized 0-1 accuracy/completion field, so
        // requirement.minScore (e.g. 0.9) is read as a fraction of level
        // progress instead: level >= minScore * 10. Reuses the same
        // `level` field 'game-level' already relies on.
        const masteredGames = Object.keys(gameStates).filter(gameId => {
          const g = gameStates[gameId];
          return g && (g.level || 0) >= Math.round(requirement.minScore * 10);
        }).length;
        return masteredGames >= requirement.minGames;

      case 'category-diversity':
        // Real category data only exists for the 3 workshop series that
        // actually call markWorkshopCompleted() with quest-system-known
        // ids today (Scratch, Godot/GML, MUGEN) — see WORKSHOP_CATEGORIES
        // below. requirement.minCategories should be sized to that reality.
        const completedCats = new Set(
          playerProfile.state.completedWorkshops
            .map(id => WORKSHOP_CATEGORIES[id])
            .filter(Boolean)
        );
        return completedCats.size >= requirement.minCategories;

      default:
        return false;
    }
  }

  getAvailableQuests(playerProfile) {
    return this.getAllQuests().filter(quest => this.isQuestUnlocked(quest.id, playerProfile));
  }

  getLockedQuests(playerProfile) {
    return this.getAllQuests().filter(quest => !this.isQuestUnlocked(quest.id, playerProfile));
  }

  getActiveQuests(playerProfile) {
    return this.getAllQuests().filter(quest => this.isQuestActive(quest.id, playerProfile));
  }

  getCompletedQuests(playerProfile) {
    return this.getAllQuests().filter(quest => this.isQuestCompleted(quest.id, playerProfile));
  }

  getQuestStatus(questId, playerProfile) {
    if (this.isQuestCompleted(questId, playerProfile)) return 'completed';
    if (this.isQuestActive(questId, playerProfile)) return 'active';
    if (this.isQuestUnlocked(questId, playerProfile)) return 'available';
    return 'locked';
  }

  getUnlockReason(questId, playerProfile) {
    const quest = this.getQuest(questId);
    if (!quest) return null;

    if (quest.prerequisites && quest.prerequisites.length > 0) {
      for (const prereqId of quest.prerequisites) {
        const prereqQuest = this.getQuest(prereqId);
        const progress = playerProfile.getQuestProgress(prereqId);
        if (!progress || !progress.completed) {
          return `Complete "${prereqQuest.title}" first`;
        }
      }
    }

    return null;
  }
}

const questSystem = new QuestSystem();
