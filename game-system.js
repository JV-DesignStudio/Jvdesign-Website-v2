/* ═══════════════════════════════════════════════════════════
   JVDS Game System — Progression, Achievements, Leaderboard
   ═══════════════════════════════════════════════════════════ */

class GameSystem {
  constructor(gameId, gameName, gameCharacter = 'squirt') {
    this.gameId = gameId;
    this.gameName = gameName;
    this.gameCharacter = gameCharacter;
    this.storageKey = `jvds_game_${gameId}`;
    this.leaderboardKey = `jvds_lb_${gameId}`;

    this.state = this.loadState() || {
      score: 0,
      highScore: 0,
      gamesPlayed: 0,
      totalTime: 0,
      level: 1,
      xp: 0,
      coins: 0,
      achievements: [],
      lastPlayed: null,
      dailyPlayStreak: 0,
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        sfxVolume: 0.8,
        musicVolume: 0.5,
      }
    };

    this.achievements = this.defineAchievements();
  }

  /* ─── STATE MANAGEMENT ─── */
  loadState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to load game state:', e);
      return null;
    }
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save game state:', e);
    }
  }

  resetState() {
    this.state = {
      score: 0,
      highScore: this.state.highScore,
      gamesPlayed: this.state.gamesPlayed,
      totalTime: this.state.totalTime,
      level: 1,
      xp: 0,
      coins: 0,
      achievements: this.state.achievements,
      lastPlayed: new Date().toISOString(),
      dailyPlayStreak: this.state.dailyPlayStreak,
      settings: this.state.settings
    };
    this.saveState();
  }

  /* ─── SCORE & PROGRESSION ─── */
  addScore(points) {
    this.state.score += points;
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
      this.checkHighScoreAchievement();
    }
    this.saveState();
    return this.state.score;
  }

  addXP(amount) {
    this.state.xp += amount;
    const xpPerLevel = 1000;
    const newLevel = Math.floor(this.state.xp / xpPerLevel) + 1;

    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      this.saveState();
      return { levelUp: true, level: newLevel };
    }

    this.saveState();
    return { levelUp: false, xp: this.state.xp };
  }

  addCoins(amount) {
    this.state.coins += amount;
    this.saveState();
    return this.state.coins;
  }

  getXPProgress() {
    const xpPerLevel = 1000;
    const currentXP = this.state.xp % xpPerLevel;
    return {
      current: currentXP,
      max: xpPerLevel,
      percentage: (currentXP / xpPerLevel) * 100
    };
  }

  recordGamePlay(duration) {
    this.state.gamesPlayed += 1;
    this.state.totalTime += duration;
    this.state.lastPlayed = new Date().toISOString();
    this.updatePlayStreak();
    this.saveState();
  }

  updatePlayStreak() {
    const lastPlayed = new Date(this.state.lastPlayed);
    const today = new Date();
    const daysDiff = Math.floor((today - lastPlayed) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      return;
    } else if (daysDiff === 1) {
      this.state.dailyPlayStreak += 1;
    } else {
      this.state.dailyPlayStreak = 1;
    }
  }

  /* ─── ACHIEVEMENTS ─── */
  defineAchievements() {
    return {
      firstPlay: {
        id: 'firstPlay',
        name: '🎮 Getting Started',
        description: 'Play your first game',
        icon: '🎮',
        unlocked: false
      },
      tenGames: {
        id: 'tenGames',
        name: '🌟 Dedicated Player',
        description: 'Play 10 games',
        icon: '🌟',
        unlocked: false
      },
      fiftyGames: {
        id: 'fiftyGames',
        name: '👑 Pro Player',
        description: 'Play 50 games',
        icon: '👑',
        unlocked: false
      },
      streak7: {
        id: 'streak7',
        name: '🔥 On Fire',
        description: 'Maintain a 7-day play streak',
        icon: '🔥',
        unlocked: false
      },
      streak30: {
        id: 'streak30',
        name: '⭐ Legendary',
        description: 'Maintain a 30-day play streak',
        icon: '⭐',
        unlocked: false
      },
      level10: {
        id: 'level10',
        name: '📈 Rising Star',
        description: 'Reach level 10',
        icon: '📈',
        unlocked: false
      }
    };
  }

  unlockAchievement(achievementId) {
    if (!this.state.achievements.includes(achievementId)) {
      this.state.achievements.push(achievementId);
      this.saveState();
      return true;
    }
    return false;
  }

  checkAchievements() {
    const toUnlock = [];

    if (this.state.gamesPlayed === 1 && !this.state.achievements.includes('firstPlay')) {
      toUnlock.push('firstPlay');
    }

    if (this.state.gamesPlayed >= 10 && !this.state.achievements.includes('tenGames')) {
      toUnlock.push('tenGames');
    }

    if (this.state.gamesPlayed >= 50 && !this.state.achievements.includes('fiftyGames')) {
      toUnlock.push('fiftyGames');
    }

    if (this.state.dailyPlayStreak >= 7 && !this.state.achievements.includes('streak7')) {
      toUnlock.push('streak7');
    }

    if (this.state.dailyPlayStreak >= 30 && !this.state.achievements.includes('streak30')) {
      toUnlock.push('streak30');
    }

    if (this.state.level >= 10 && !this.state.achievements.includes('level10')) {
      toUnlock.push('level10');
    }

    toUnlock.forEach(id => this.unlockAchievement(id));
    return toUnlock;
  }

  getAchievements() {
    return Object.values(this.achievements).map(ach => ({
      ...ach,
      unlocked: this.state.achievements.includes(ach.id)
    }));
  }

  /* ─── LEADERBOARD ─── */
  addToLeaderboard(playerName, score) {
    try {
      let leaderboard = this.getLeaderboard();

      leaderboard.push({
        name: playerName || 'Player',
        score: score,
        timestamp: new Date().toISOString(),
        gameCharacter: this.gameCharacter
      });

      leaderboard.sort((a, b) => b.score - a.score);
      leaderboard = leaderboard.slice(0, 50);

      localStorage.setItem(this.leaderboardKey, JSON.stringify(leaderboard));
      return leaderboard;
    } catch (e) {
      console.error('Failed to update leaderboard:', e);
      return [];
    }
  }

  getLeaderboard() {
    try {
      const stored = localStorage.getItem(this.leaderboardKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
      return [];
    }
  }

  /* ─── SETTINGS ─── */
  updateSetting(key, value) {
    this.state.settings[key] = value;
    this.saveState();
  }

  getSetting(key) {
    return this.state.settings[key];
  }

  /* ─── UTILITY ─── */
  getStats() {
    return {
      score: this.state.score,
      highScore: this.state.highScore,
      level: this.state.level,
      xp: this.state.xp,
      coins: this.state.coins,
      gamesPlayed: this.state.gamesPlayed,
      achievements: this.state.achievements.length,
      dailyPlayStreak: this.state.dailyPlayStreak,
      totalTime: this.formatTime(this.state.totalTime)
    };
  }

  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  clearAllData() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.leaderboardKey);
    this.state = this.loadState() || {
      score: 0,
      highScore: 0,
      gamesPlayed: 0,
      totalTime: 0,
      level: 1,
      xp: 0,
      coins: 0,
      achievements: [],
      lastPlayed: null,
      dailyPlayStreak: 0,
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        sfxVolume: 0.8,
        musicVolume: 0.5,
      }
    };
  }
}

/* ═══════════════════════════════════════════════════════════
   UI COMPONENTS — Modal, Achievement Notifications, etc
   ═══════════════════════════════════════════════════════════ */

class GameUI {
  static showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-notification-content">
        <div class="achievement-notification-icon">${achievement.icon}</div>
        <div class="achievement-notification-text">
          <div class="achievement-notification-title">Achievement Unlocked!</div>
          <div class="achievement-notification-name">${achievement.name}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  static showScorePopup(score, x, y) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${score}`;
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 1000);
  }

  static updateHUD(stats) {
    const scoreEl = document.querySelector('[data-stat="score"]');
    if (scoreEl) scoreEl.textContent = stats.score;

    const coinsEl = document.querySelector('[data-stat="coins"]');
    if (coinsEl) coinsEl.textContent = stats.coins;

    const levelEl = document.querySelector('[data-stat="level"]');
    if (levelEl) levelEl.textContent = stats.level;
  }

  static showModal(title, content, buttons = []) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';

    let buttonsHTML = '';
    buttons.forEach(btn => {
      buttonsHTML += `<button class="btn btn-${btn.type || 'primary'}" data-action="${btn.action}">${btn.label}</button>`;
    });

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">${buttonsHTML}</div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        modal.remove();
        if (window.onModalAction) {
          window.onModalAction(action);
        }
      });
    });

    return modal;
  }
}

/* ═══════════════════════════════════════════════════════════
   SOUND MANAGER — Audio effects and music
   ═══════════════════════════════════════════════════════════ */

class SoundManager {
  constructor(gameSystem) {
    this.gameSystem = gameSystem;
    this.audioContext = null;
  }

  playSound(frequency = 400, duration = 100, type = 'sine') {
    if (!this.gameSystem.getSetting('soundEnabled')) return;

    try {
      const audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
      this.audioContext = audioContext;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
      console.warn('Audio playback not available:', e);
    }
  }

  playSuccessSound() {
    this.playSound(800, 100);
    setTimeout(() => this.playSound(1000, 100), 100);
  }

  playErrorSound() {
    this.playSound(300, 100);
    setTimeout(() => this.playSound(200, 100), 100);
  }

  playPointSound() {
    this.playSound(600, 50);
  }
}

/* ═══════════════════════════════════════════════════════════
   CSS STYLES FOR UI COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const GAME_UI_STYLES = `
.achievement-notification {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(129, 140, 248, 0.2));
  border: 1px solid rgba(52, 211, 153, 0.4);
  border-radius: 12px;
  padding: 16px 20px;
  backdrop-filter: blur(8px);
  z-index: 300;
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  display: flex;
  gap: 12px;
  align-items: center;
}

.achievement-notification.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.achievement-notification-icon {
  font-size: 2rem;
}

.achievement-notification-text {
  color: #fff;
}

.achievement-notification-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.achievement-notification-name {
  font-size: 1rem;
  font-weight: 700;
}

.score-popup {
  position: fixed;
  font-size: 1.5rem;
  font-weight: 800;
  color: #34D399;
  text-shadow: 0 0 10px rgba(52, 211, 153, 0.5);
  pointer-events: none;
  z-index: 200;
  animation: scorePopupFloat 1s ease-out forwards;
  font-family: 'Fredoka', cursive;
}

@keyframes scorePopupFloat {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-40px);
  }
}
`;

// Inject styles on page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = GAME_UI_STYLES;
    document.head.appendChild(style);
  });
}
