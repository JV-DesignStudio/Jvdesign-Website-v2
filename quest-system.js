/* ═══════════════════════════════════════════════════════════
   Quest System — Definitions, unlock logic, reward tracking
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
  }
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
