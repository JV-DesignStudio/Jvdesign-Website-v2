/* ═══════════════════════════════════════════════════════════
   GA4 Analytics System, Comprehensive Event Tracking

   ⚠ NOT WIRED UP. This class is loaded by only a handful of hub pages
   and has no call sites anywhere, so none of these events ever fired.
   It is kept as the reference SCHEMA for event names and parameter
   shapes only.

   The live instrumentation lives in three places, which emit the same
   event names directly and therefore need no per-page wiring:
     - player-profile.js  → workshop_complete, quest_complete,
                            player_level_up, achievement_unlock,
                            cosmetic_unlock  (all games + ~59 workshops)
     - game-system.js     → game_start, game_end, game_achievement
                            (~34 games)
     - workshops/workshop-engine.js → workshop_progress, quiz_attempt
                            (~48 workshops)

   If you add an event here, mirror it in whichever file above owns that
   surface, or it will not be collected.
   ═══════════════════════════════════════════════════════════ */

class GA4Analytics {
  constructor() {
    this.isEnabled = typeof gtag !== 'undefined';
    this.userId = this.generateOrGetUserId();
    this.sessionId = this.generateSessionId();
    this.initializeUserProperties();
  }

  generateOrGetUserId() {
    let userId = localStorage.getItem('ga4_user_id');
    if (!userId) {
      userId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ga4_user_id', userId);
    }
    return userId;
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  initializeUserProperties() {
    if (!this.isEnabled) return;

    // Set persistent user properties
    if (typeof playerProfile !== 'undefined') {
      const stats = playerProfile.getStats();
      gtag('set', {
        'user_id': this.userId,
        'user_properties': {
          'player_level': stats.level,
          'total_xp': stats.totalXP,
          'workshops_completed': stats.workshopsCompleted,
          'quests_completed': stats.questsCompleted,
          'games_played': stats.gamesPlayed,
          'cosmetics_unlocked': stats.cosmeticsUnlocked,
          'daily_streak': stats.currentStreak
        }
      });
    }
  }

  // ═══ GAME EVENTS ═══
  trackGameStart(gameId, gameName, difficulty = 'normal') {
    if (!this.isEnabled) return;
    gtag('event', 'game_start', {
      game_id: gameId,
      game_name: gameName,
      difficulty: difficulty,
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  trackGameEnd(gameId, gameName, score, level, timeSpent, won = false) {
    if (!this.isEnabled) return;
    gtag('event', 'game_end', {
      game_id: gameId,
      game_name: gameName,
      score: score,
      level: level,
      time_spent_seconds: timeSpent,
      game_won: won,
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  trackGameScore(gameId, gameName, score, isNewHighScore = false) {
    if (!this.isEnabled) return;
    gtag('event', 'game_score', {
      game_id: gameId,
      game_name: gameName,
      score: score,
      is_high_score: isNewHighScore,
      session_id: this.sessionId
    });
  }

  trackGameAchievement(gameId, gameName, achievementId, achievementName) {
    if (!this.isEnabled) return;
    gtag('event', 'game_achievement', {
      game_id: gameId,
      game_name: gameName,
      achievement_id: achievementId,
      achievement_name: achievementName,
      session_id: this.sessionId
    });
  }

  trackGameLevelUp(gameId, gameName, newLevel, xpEarned) {
    if (!this.isEnabled) return;
    gtag('event', 'game_level_up', {
      game_id: gameId,
      game_name: gameName,
      new_level: newLevel,
      xp_earned: xpEarned,
      session_id: this.sessionId
    });
  }

  // ═══ WORKSHOP EVENTS ═══
  trackWorkshopStart(workshopId, workshopName, category = 'general') {
    if (!this.isEnabled) return;
    gtag('event', 'workshop_start', {
      workshop_id: workshopId,
      workshop_name: workshopName,
      category: category,
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  trackWorkshopComplete(workshopId, workshopName, category, timeSpent, difficulty = 'beginner') {
    if (!this.isEnabled) return;
    gtag('event', 'workshop_complete', {
      workshop_id: workshopId,
      workshop_name: workshopName,
      category: category,
      difficulty: difficulty,
      time_spent_minutes: Math.round(timeSpent / 60),
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  trackQuizAttempt(workshopId, workshopName, score, passed) {
    if (!this.isEnabled) return;
    gtag('event', 'quiz_attempt', {
      workshop_id: workshopId,
      workshop_name: workshopName,
      quiz_score: score,
      quiz_passed: passed,
      session_id: this.sessionId
    });
  }

  // ═══ QUEST EVENTS ═══
  trackQuestStart(questId, questName, difficulty) {
    if (!this.isEnabled) return;
    gtag('event', 'quest_start', {
      quest_id: questId,
      quest_name: questName,
      difficulty: difficulty,
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  trackQuestComplete(questId, questName, difficulty, xpReward, rewardType = 'none') {
    if (!this.isEnabled) return;
    gtag('event', 'quest_complete', {
      quest_id: questId,
      quest_name: questName,
      difficulty: difficulty,
      xp_reward: xpReward,
      reward_type: rewardType, // cosmetic, achievement, cosmetic+achievement
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });

    // Also track as conversion
    gtag('event', 'conversion', {
      conversion_id: 'quest_' + questId,
      conversion_value: xpReward / 100, // Normalize XP to value
      conversion_name: 'quest_completion'
    });
  }

  trackQuestAbandoned(questId, questName) {
    if (!this.isEnabled) return;
    gtag('event', 'quest_abandoned', {
      quest_id: questId,
      quest_name: questName,
      session_id: this.sessionId
    });
  }

  // ═══ COSMETIC EVENTS ═══
  trackCosmeticUnlock(gameId, gameName, cosmeticId, cosmeticName, unlockMethod = 'quest') {
    if (!this.isEnabled) return;
    gtag('event', 'cosmetic_unlock', {
      game_id: gameId,
      game_name: gameName,
      cosmetic_id: cosmeticId,
      cosmetic_name: cosmeticName,
      unlock_method: unlockMethod, // quest, achievement, game_level, etc.
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });

    // Track as ecommerce purchase event
    gtag('event', 'purchase', {
      items: [{
        item_id: cosmeticId,
        item_name: cosmeticName,
        item_category: 'cosmetic',
        item_brand: gameName,
        price: 0, // Free cosmetics
        currency: 'XP'
      }],
      currency: 'XP',
      transaction_id: 'cosmetic_' + Date.now()
    });
  }

  // ═══ MILESTONE EVENTS ═══
  trackPlayerLevelUp(newLevel, xpTotal) {
    if (!this.isEnabled) return;
    gtag('event', 'player_level_up', {
      new_level: newLevel,
      total_xp: xpTotal,
      timestamp: new Date().toISOString()
    });

    // Track as conversion for milestone achievements
    if (newLevel % 5 === 0) {
      gtag('event', 'conversion', {
        conversion_id: 'level_' + newLevel,
        conversion_value: newLevel,
        conversion_name: 'milestone_level_' + newLevel
      });
    }
  }

  trackStreak(dayCount) {
    if (!this.isEnabled) return;
    gtag('event', 'play_streak', {
      streak_days: dayCount,
      timestamp: new Date().toISOString()
    });

    // Major streak milestones
    if ([7, 14, 30, 60, 100].includes(dayCount)) {
      gtag('event', 'conversion', {
        conversion_id: 'streak_' + dayCount,
        conversion_value: dayCount,
        conversion_name: 'streak_milestone_' + dayCount + 'days'
      });
    }
  }

  trackAchievementUnlock(achievementId, achievementName) {
    if (!this.isEnabled) return;
    gtag('event', 'achievement_unlock', {
      achievement_id: achievementId,
      achievement_name: achievementName,
      timestamp: new Date().toISOString()
    });
  }

  // ═══ ENGAGEMENT EVENTS ═══
  trackPageView(pagePath, pageTitle, pageType = 'hub') {
    if (!this.isEnabled) return;
    gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle,
      page_type: pageType, // game, workshop, quest, hub, leaderboard, profile
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  trackEngagementMetric(metricName, metricValue, category = 'general') {
    if (!this.isEnabled) return;
    gtag('event', 'engagement_metric', {
      metric_name: metricName,
      metric_value: metricValue,
      category: category,
      session_id: this.sessionId
    });
  }

  trackSessionDuration(durationSeconds) {
    if (!this.isEnabled) return;
    gtag('event', 'session_duration', {
      session_duration_seconds: durationSeconds,
      session_id: this.sessionId
    });
  }

  trackContentCategory(contentType, contentName, contentCategory) {
    if (!this.isEnabled) return;
    gtag('event', 'view_item', {
      items: [{
        item_id: contentName,
        item_name: contentName,
        item_category: contentCategory,
        item_category2: contentType
      }]
    });
  }

  // ═══ USER PROPERTIES UPDATE ═══
  updateUserProperties(properties) {
    if (!this.isEnabled) return;
    gtag('set', {
      'user_properties': properties
    });
  }

  // ═══ FUNNEL TRACKING ═══
  trackFunnelStep(funnelName, step, stepName, stepData = {}) {
    if (!this.isEnabled) return;
    gtag('event', 'funnel_step', {
      funnel_name: funnelName,
      step_number: step,
      step_name: stepName,
      ...stepData,
      session_id: this.sessionId
    });
  }

  // Example: trackQuestFunnel
  trackQuestFunnel(step, questId, questName, difficulty) {
    const steps = {
      1: 'view_quest_board',
      2: 'quest_viewed',
      3: 'quest_started',
      4: 'quest_in_progress',
      5: 'quest_completed'
    };

    this.trackFunnelStep('quest_completion', step, steps[step], {
      quest_id: questId,
      quest_name: questName,
      difficulty: difficulty
    });
  }

  // ═══ ERROR TRACKING ═══
  trackError(errorName, errorMessage, errorContext = '') {
    if (!this.isEnabled) return;
    gtag('event', 'exception', {
      description: errorName + ': ' + errorMessage,
      fatal: false,
      error_context: errorContext,
      session_id: this.sessionId
    });
  }

  // ═══ CUSTOM EVENTS ═══
  trackCustomEvent(eventName, eventData = {}) {
    if (!this.isEnabled) return;
    gtag('event', eventName, {
      ...eventData,
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }
}

// Initialize globally
const ga4Analytics = new GA4Analytics();
