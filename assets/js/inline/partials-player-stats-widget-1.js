  // Initialize stats widget from player profile
  function initPlayerStatsWidget() {
    if (typeof playerProfile === 'undefined') {
      console.warn('playerProfile not loaded, skipping widget init');
      return;
    }

    const stats = playerProfile.getStats();
    const xpProgress = playerProfile.getXPProgress();

    document.getElementById('playerLevel').textContent = `Level ${stats.level}`;
    document.getElementById('playerXP').textContent = `${xpProgress.current} / ${xpProgress.max}`;
    document.getElementById('xpFill').style.width = xpProgress.percentage + '%';
    document.getElementById('workshopCount').textContent = stats.workshopsCompleted;
    document.getElementById('achievementCount').textContent = stats.achievementsUnlocked;
    document.getElementById('streakCount').textContent = stats.dailyStreak;

    // Listen for XP changes
    playerProfile.onXPGained((data) => {
      const newProgress = playerProfile.getXPProgress();
      document.getElementById('playerLevel').textContent = `Level ${newProgress.level}`;
      document.getElementById('playerXP').textContent = `${newProgress.current} / ${newProgress.max}`;
      document.getElementById('xpFill').style.width = newProgress.percentage + '%';
    });

    playerProfile.onLevelUp((data) => {
      document.getElementById('playerLevel').textContent = `Level ${data.newLevel}`;
      showLevelUpToast(data.newLevel);
    });

    playerProfile.onWorkshopCompleted((data) => {
      const newStats = playerProfile.getStats();
      document.getElementById('workshopCount').textContent = newStats.workshopsCompleted;
    });

    playerProfile.onAchievementUnlocked((data) => {
      const newStats = playerProfile.getStats();
      document.getElementById('achievementCount').textContent = newStats.achievementsUnlocked;
    });
  }

  function showLevelUpToast(level) {
    const toast = document.createElement('div');
    toast.className = 'level-up-toast';
    toast.textContent = `🎉 Level ${level}!`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideUp 0.5s ease reverse';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  // Auto-init on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayerStatsWidget);
  } else {
    initPlayerStatsWidget();
  }
